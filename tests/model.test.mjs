import test from "node:test";
import assert from "node:assert/strict";
import {
  CATALOG_SAMPLES, DEMO_FACTORS, ValidationError, calculateScenario, calculateScenarioDetails, compareScenario, confirmSample, createSeedRecords,
  deserializeRecords, exportCsv, filterRecords, getSample, materialBreakdown,
  parseWeight, recordImpact, serializeRecords, sortCatalogSamples, summarize, validateRecords,
} from "../src/model.ts";

const NOW = "2026-10-24T01:37:40.000Z";
const LATER = "2026-10-24T02:00:00.000Z";

test("catalog presentation sorts each unchanged dataset group by filename without mixing CT and SYN suffixes", () => {
  const original = JSON.stringify(CATALOG_SAMPLES);
  for (const training of [true, false]) {
    const group = CATALOG_SAMPLES.filter((sample) => (sample.role === "train") === training);
    const shuffled = [...group].reverse();
    const before = JSON.stringify(shuffled);
    const sorted = sortCatalogSamples(shuffled);
    assert.equal(sorted.length, training ? 78 : 54);
    assert.equal(JSON.stringify(shuffled), before);
    assert.deepEqual(sorted.map((sample) => sample.id), sortCatalogSamples(group).map((sample) => sample.id));
    assert.deepEqual(new Set(sorted.map((sample) => sample.id)), new Set(group.map((sample) => sample.id)));
    assert.ok(sorted.every((sample) => sample === group.find((item) => item.id === sample.id)));
    assert.deepEqual(sorted.map((sample) => sample.imageFile), group.map((sample) => sample.imageFile).sort());
  }
  assert.deepEqual(sortCatalogSamples([
    getSample("SYN-DRYWALL-008"), getSample("CT-012"), getSample("SYN-DRYWALL-014"), getSample("CT-009"),
  ]).map((sample) => sample.imageFile),
  ["CT-009_01.png", "CT-012_01.png", "SYN-DRYWALL-008.png", "SYN-DRYWALL-014.png"]);
  assert.equal(JSON.stringify(CATALOG_SAMPLES), original);
});

test("seed data is explicitly dummy and has six distinct samples", () => {
  const records = createSeedRecords(NOW);
  validateRecords(records);
  assert.equal(records.length, 6);
  assert.equal(new Set(records.map((record) => record.sampleId)).size, 6);
  assert.ok(records.every((record) => record.source === "dummy"));
  assert.equal(summarize(records).pending, 2);
});

test("weight accepts Indonesian decimal commas and decimal points", () => {
  assert.equal(parseWeight(" 24,5 "), 24.5);
  assert.equal(parseWeight("24.5"), 24.5);
  assert.equal(parseWeight(".5"), 0.5);
});

test("weight rejects blank, zero, negative, malformed, and unbounded input", () => {
  for (const value of ["", " ", "0", "-1", "NaN", "Infinity", "1.000,5", "24 g", "0x10", "1e3", "9".repeat(400)]) {
    assert.throws(() => parseWeight(value), ValidationError, value);
  }
});

test("scenario converts grams to kilograms before multiplying the factor difference", () => {
  assert.equal(calculateScenario(250, DEMO_FACTORS.pet), 0.5);
  assert.equal(calculateScenario(250, DEMO_FACTORS.cardboard), 0.25);
});

test("scenario preserves negative differences instead of presenting them as savings", () => {
  assert.equal(calculateScenario(1000, { baseline: 1, alternative: 2 }), -1);
});

test("a 22 g WARM test fixture reproduces the displayed negative-net example without changing its arithmetic", () => {
  const result = compareScenario(22, { baseline: 0.022327, alternative: -1.141687 });
  assert.equal(result.baselineKg.toFixed(6), "0.000491");
  assert.equal(result.alternativeKg.toFixed(6), "-0.025117");
  assert.equal(result.differenceKg.toFixed(6), "0.025608");
  assert.ok(Math.abs(result.differenceKg - 0.025608308) < 1e-15);
  assert.equal(result.comparison, "alternative-lower");
  assert.equal(result.hasNegativeNet, true);
});

test("scenario conclusions use the difference, not the sign of an individual net impact", () => {
  for (const [baseline, alternative, comparison, hasNegativeNet] of [
    [2, 1, "alternative-lower", false],
    [1, 2, "baseline-lower", false],
    [-1, -2, "alternative-lower", true],
    [-2, -1, "baseline-lower", true],
    [0, 0, "equal", false],
    [-1, -1, "equal", true],
    [1e-8, 0, "alternative-lower", false],
    [0, 1e-8, "baseline-lower", false],
  ]) {
    const factors = { baseline, alternative };
    const result = compareScenario(1000, factors);
    assert.equal(result.comparison, comparison);
    assert.equal(result.hasNegativeNet, hasNegativeNet);
    const { comparison: ignoredComparison, hasNegativeNet: ignoredNegativeNet, ...parts } = result;
    assert.deepEqual(parts, calculateScenarioDetails(1000, factors));
    assert.deepEqual(factors, { baseline, alternative });
  }
});

test("scenario interpretation retains validation and rejects invalid or overflowing calculations", () => {
  for (const [weight, factors] of [
    [0, { baseline: 1, alternative: 0 }],
    [-1, { baseline: 1, alternative: 0 }],
    [1, { baseline: NaN, alternative: 0 }],
    [Number.MAX_VALUE, { baseline: Number.MAX_VALUE, alternative: 0 }],
  ]) {
    assert.throws(() => compareScenario(weight, factors), ValidationError);
  }
});

test("scenario rejects invalid weights, factors, and overflowing results", () => {
  assert.throws(() => calculateScenario(0, DEMO_FACTORS.pet), ValidationError);
  assert.throws(() => calculateScenario(10, { baseline: NaN, alternative: 1 }), ValidationError);
  assert.throws(() => calculateScenario(10, { baseline: 1, alternative: Infinity }), ValidationError);
  assert.throws(() => calculateScenario(Number.MAX_VALUE, { baseline: Number.MAX_VALUE, alternative: 0 }), ValidationError);
});

test("pending records never use predicted categories to calculate impact", () => {
  const pending = createSeedRecords(NOW).find((record) => record.sampleId === "CT-005");
  assert.equal(recordImpact(pending), null);
  assert.equal(pending.prediction.category, "pet");
  assert.equal(getSample(pending.sampleId).material, "cardboard");
});

test("summary includes all sample mass but only confirmed scenario differences", () => {
  const totals = summarize(createSeedRecords(NOW));
  assert.equal(totals.count, 6);
  assert.equal(totals.confirmed, 4);
  assert.equal(totals.pending, 2);
  assert.ok(Math.abs(totals.weightKg - 0.429) < 1e-12);
  assert.ok(Math.abs(totals.impactKg - 0.387) < 1e-12);
});

test("a corrected category uses the confirmed material, not the prediction", () => {
  const records = confirmSample(createSeedRecords(NOW), "CT-005", 68, "cardboard", LATER);
  const corrected = records.find((record) => record.sampleId === "CT-005");
  assert.equal(corrected.prediction.category, "pet");
  assert.equal(corrected.confirmedCategory, "cardboard");
  assert.equal(recordImpact(corrected), 0.068);
  assert.equal(summarize(records).pending, 1);
});

test("confirming an existing ID updates it without double counting", () => {
  const initial = createSeedRecords(NOW);
  const records = confirmSample(initial, "CT-001", 40, "pet", LATER);
  assert.equal(records.length, 6);
  assert.equal(records[0].createdAt, initial[0].createdAt);
  assert.equal(records[0].updatedAt, LATER);
  assert.equal(records[0].weightGrams, 40);
  assert.equal(initial[0].weightGrams, 24);
});

test("confirming a new sample adds one record with a factor snapshot", () => {
  const records = confirmSample(createSeedRecords(NOW), "CT-007", 42, "pet", LATER);
  assert.equal(records.length, 7);
  assert.deepEqual(records.at(-1).factors, { baseline: 3, alternative: 1, version: "dummy-v1" });
});

test("confirmation rejects unknown samples, categories, weights, and timestamps", () => {
  const records = createSeedRecords(NOW);
  assert.throws(() => confirmSample(records, "missing", 24, "pet", LATER), ValidationError);
  assert.throws(() => confirmSample(records, "CT-007", 24, "unknown", LATER), ValidationError);
  assert.throws(() => confirmSample(records, "CT-007", NaN, "pet", LATER), ValidationError);
  assert.throws(() => confirmSample(records, "CT-007", 24, "pet", "bad date"), ValidationError);
});

test("material breakdown excludes unconfirmed records", () => {
  const rows = materialBreakdown(createSeedRecords(NOW));
  assert.equal(rows[0].count, 2);
  assert.equal(rows[1].count, 2);
  assert.ok(Math.abs(rows.reduce((sum, row) => sum + row.impactKg, 0) - 0.387) < 1e-12);
});

test("search and filters combine without mutating the input", () => {
  const records = createSeedRecords(NOW);
  assert.equal(filterRecords(records, "  CT-005 ", "pending", "all").length, 1);
  assert.equal(filterRecords(records, "", "confirmed", "pet").length, 2);
  assert.equal(filterRecords(records, "", "pending", "cardboard").length, 0);
  assert.equal(filterRecords(records, "not found", "all", "all").length, 0);
  assert.equal(records[0].sampleId, "CT-001");
});

test("storage round-trips validated records", () => {
  const records = createSeedRecords(NOW);
  assert.deepEqual(deserializeRecords(serializeRecords(records)), records);
});

test("storage rejects invalid JSON, unsupported versions, and malformed records", () => {
  assert.throws(() => deserializeRecords("{"), SyntaxError);
  assert.throws(() => deserializeRecords('{"version":2,"records":[]}'), ValidationError);
  assert.throws(() => deserializeRecords('{"version":1,"records":[{}]}'), ValidationError);
  assert.throws(() => deserializeRecords('{"version":1,"records":null}'), ValidationError);
});

test("storage rejects duplicate sample IDs and pending records with factors", () => {
  const records = createSeedRecords(NOW);
  assert.throws(() => validateRecords([...records, records[0]]), ValidationError);
  const pending = structuredClone(records.at(-1));
  pending.factors = { baseline: 3, alternative: 1, version: "dummy-v1" };
  assert.throws(() => validateRecords([pending]), ValidationError);
});

test("storage rejects missing factors, invalid confidence, unknown sources and invalid dates", () => {
  for (const patch of [
    { factors: null },
    { prediction: { category: "pet", score: 1.1 } },
    { source: "measured" },
    { createdAt: "invalid date" },
    { weightGrams: -1 },
  ]) {
    assert.throws(() => validateRecords([{ ...createSeedRecords(NOW)[0], ...patch }]), ValidationError);
  }
});

test("CSV identifies dummy data, factors, verification status, and leaves pending estimates empty", () => {
  const csv = exportCsv(createSeedRecords(NOW));
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"DUMMY_NOT_MEASURED"'));
  assert.ok(csv.includes('"DUMMY_NOT_OFFICIAL"'));
  assert.ok(csv.includes('"treatment_verified","carbon_credits_issued"'));
  const pending = csv.split("\r\n").find((row) => row.startsWith('"CT-005"'));
  assert.ok(pending.includes('"PENDING","","","","","NO","NO"'));
  assert.equal(csv.trim().split("\r\n").length, 7);
});

test("empty data remains a valid state with zero totals and a header-only CSV", () => {
  assert.deepEqual(summarize([]), { count: 0, confirmed: 0, pending: 0, weightKg: 0, impactKg: 0 });
  assert.deepEqual(deserializeRecords(serializeRecords([])), []);
  assert.equal(exportCsv([]).trim().split("\r\n").length, 1);
});

test("CSV preserves negative scenario differences as numeric values", () => {
  const record = createSeedRecords(NOW)[0];
  record.factors = { baseline: 1, alternative: 2, version: "dummy-v1" };
  const csv = exportCsv([record]);
  assert.ok(csv.includes('"-0.024"'));
  assert.ok(!csv.includes('"\'-0.024"'));
});

test("CSV separates current user-image provenance from simulated record data", () => {
  const csv = exportCsv(createSeedRecords(NOW));
  const lines = csv.trim().split("\r\n");
  assert.ok(lines[0].endsWith('"current_sample_image_file","current_sample_image_source","image_content_verified"'));
  for (const line of lines.slice(1)) {
    assert.ok(line.includes('"DUMMY_NOT_MEASURED"'));
    assert.ok(line.endsWith('"USER_PROVIDED_UNVERIFIED","NO"'));
    const sampleId = line.split(",")[0].replaceAll('"', "");
    assert.ok(line.includes(`"${sampleId}_01.png"`));
    assert.equal(line.split(",").length, 19);
  }
});

test("existing version-one records load without adding image verification or changing sources", () => {
  const legacy = { version: 1, records: createSeedRecords(NOW) };
  const records = deserializeRecords(JSON.stringify(legacy));
  assert.deepEqual(records, legacy.records);
  assert.ok(records.every((record) => record.source === "dummy"));
  assert.equal(summarize(records).count, 6);
});
