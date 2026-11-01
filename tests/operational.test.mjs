import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG_SAMPLES, ValidationError, createSeedRecords, serializeRecords } from "../src/model.ts";
import { predictionFromScores } from "../src/ai-contract.ts";
import {
  createDocumentedFactors, deserializeFactorConfig, deserializeOperationalState,
  emptyFactorConfig, exportManualCsv, filterManualRecords, manualRecordImpact,
  migrateLegacyData, parseFactorNumber, saveManualRecord, serializeFactorConfig,
  serializeOperationalState, summarizeManual, summarizeHistory, validateFactorConfig, validateOperationalState,
  createParameterSetConfig,
} from "../src/operational.ts";

const NOW = "2026-10-24T04:00:00.000Z";
const LATER = "2026-10-24T05:00:00.000Z";
const factorInput = {
  baseline: "2",
  alternative: "0,5",
  baselineScenario: "Skenario awal untuk pengujian",
  alternativeScenario: "Skenario alternatif untuk pengujian",
  sourceTitle: "Dokumen uji otomatis - bukan faktor untuk penggunaan nyata",
  sourceUrl: "https://example.org/test-method",
  scope: "Lingkup data uji, satuan kg CO2e/kg material",
};

function configuration(material = "pet", input = {}) {
  return { ...emptyFactorConfig(), [material]: createDocumentedFactors(material, { ...factorInput, ...input }, NOW) };
}

test("drywall records keep three-class AI scores and source snapshots separate from prior two-class records", () => {
  const factors = createParameterSetConfig("warm16-drywall-us-average-r1", NOW);
  const inference = {
    ...predictionFromScores([0.1, 0.15, 0.75], "ct-mobilenet-913cfe5aa706"),
    sampleId: "SYN-DRYWALL-008", inputSha256: "f".repeat(64), analyzedAt: NOW, source: "trained-model",
  };
  const oldAnalysis = {
    ...predictionFromScores([0.9, 0.1], "ct-mobilenet-414f2c4df422"),
    sampleId: "SYN-PET-040", inputSha256: "e".repeat(64), analyzedAt: NOW, source: "trained-model",
  };
  const prior = saveManualRecord(migrateLegacyData(null), "SYN-PET-040", 24, "pet", createParameterSetConfig("warm16-us-average-r1", NOW), NOW, oldAnalysis);
  const state = saveManualRecord(prior, inference.sampleId, 1000, "drywall", factors, LATER, inference);
  inference.scores.drywall = 0.5;
  assert.equal(state.records[1].analysis.scores.drywall, 0.75);
  assert.deepEqual(state.records[0], prior.records[0]);
  assert.equal(manualRecordImpact(state.records[1]).toFixed(6), "-0.096043");
  assert.deepEqual(deserializeOperationalState(serializeOperationalState(state)), state);
  const summary = summarizeHistory(state.records);
  assert.deepEqual(summary.materials.drywall, { count: 1, weightGrams: 1000 });
  assert.equal(summary.factorGroups.length, 2);
  assert.equal(Object.hasOwn(summary, "impactKg"), false);
  assert.equal(filterManualRecords(state.records, "", "all", "drywall").length, 1);
  const csv = exportManualCsv(state);
  assert.equal(csv.trim().split("\r\n")[0].split(",").length, 32);
  assert.ok(csv.includes('"Papan gipsum"') && csv.includes('"USER_REPORTED_NOT_VERIFIED"'));
  assert.ok(csv.includes("ct-mobilenet-414f2c4df422") && csv.includes("ct-mobilenet-913cfe5aa706"));
});

test("drywall can be recorded manually with absent factors rather than zero or a PET substitution", () => {
  for (const id of ["places-id-pet-sanitary-20261024-r1", "warm16-us-average-r1"]) {
    const state = saveManualRecord(migrateLegacyData(null), "CT-010", 500, "drywall", createParameterSetConfig(id, NOW), NOW);
    assert.equal(state.records[0].factors, null);
    assert.equal(state.records[0].analysis, undefined);
    assert.equal(manualRecordImpact(state.records[0]), null);
    assert.equal(summarizeHistory(state.records).missing, 1);
  }
});

test("legacy data is archived without promoting sample weights or predictions to operational records", () => {
  const legacy = createSeedRecords(NOW);
  const serialized = serializeRecords(legacy);
  const state = migrateLegacyData(serialized);
  assert.deepEqual(state.records, []);
  assert.deepEqual(state.archive, legacy);
  assert.deepEqual(summarizeManual(state.records), { count: 0, weightKg: 0, calculated: 0, missing: 0, impactKg: null });
  assert.deepEqual(migrateLegacyData(null), { version: 2, records: [], archive: [] });
});

test("factor settings start empty and never include dummy defaults", () => {
  assert.deepEqual(emptyFactorConfig(), { pet: null, cardboard: null, drywall: null });
  assert.deepEqual(deserializeFactorConfig(serializeFactorConfig(emptyFactorConfig())), emptyFactorConfig());
});

test("factor values support zero, Indonesian decimals and documented negative net factors", () => {
  assert.equal(parseFactorNumber("0"), 0);
  assert.equal(parseFactorNumber("-1,25"), -1.25);
  assert.equal(parseFactorNumber(" 0.5 "), 0.5);
  assert.equal(parseFactorNumber("-0"), 0);
  for (const input of ["", " ", "Infinity", "NaN", "1e3", "1.000,5", "2 kg", "9".repeat(400)]) {
    assert.throws(() => parseFactorNumber(input), ValidationError);
  }
});

test("factors require scenario names, a source and a scope", () => {
  for (const key of ["baselineScenario", "alternativeScenario", "sourceTitle", "scope"]) {
    assert.throws(() => createDocumentedFactors("pet", { ...factorInput, [key]: " " }, NOW), ValidationError);
  }
  assert.equal(createDocumentedFactors("pet", { ...factorInput, sourceUrl: "" }, NOW).sourceUrl, "");
});

test("factor links reject invalid protocols, malformed URLs and credentials", () => {
  for (const sourceUrl of ["javascript:alert(1)", "file:///C:/private", "not a URL", "https://name:secret@example.org/"]) {
    assert.throws(() => createDocumentedFactors("pet", { ...factorInput, sourceUrl }, NOW), ValidationError);
  }
});

test("manual records can be saved without a configured factor and leave CO2e unknown", () => {
  const state = saveManualRecord(migrateLegacyData(serializeRecords(createSeedRecords(NOW))), "CT-007", 42, "pet", emptyFactorConfig(), NOW);
  assert.equal(state.records.length, 1);
  assert.equal(state.archive.length, 6);
  assert.equal(state.records[0].source, "user-reported-unverified");
  assert.equal(state.records[0].method, "manual");
  assert.equal(manualRecordImpact(state.records[0]), null);
  assert.equal(summarizeManual(state.records).impactKg, null);
  assert.equal(summarizeManual(state.records).weightKg, 0.042);
});

test("a valid zero difference is displayed as zero rather than missing", () => {
  const state = saveManualRecord(migrateLegacyData(null), "CT-001", 100, "pet", configuration("pet", { baseline: "1", alternative: "1" }), NOW);
  assert.equal(manualRecordImpact(state.records[0]), 0);
  assert.equal(summarizeManual(state.records).impactKg, 0);
  assert.equal(summarizeManual(state.records).calculated, 1);
});

test("negative documented factors and negative scenario differences are preserved", () => {
  const state = saveManualRecord(migrateLegacyData(null), "CT-001", 1000, "pet", configuration("pet", { baseline: "-2", alternative: "-1" }), NOW);
  assert.equal(manualRecordImpact(state.records[0]), -1);
  assert.ok(exportManualCsv(state).includes('"-1"'));
});

test("each record snapshots its factor and source; later settings do not rewrite history", () => {
  const config = configuration();
  const initial = saveManualRecord(migrateLegacyData(null), "CT-001", 100, "pet", config, NOW);
  config.pet.baseline = 8;
  config.pet.sourceTitle = "Sumber baru";
  assert.equal(initial.records[0].factors.baseline, 2);
  assert.equal(initial.records[0].factors.sourceTitle, factorInput.sourceTitle);
  assert.ok(Math.abs(manualRecordImpact(initial.records[0]) - 0.15) < 1e-12);
  const updated = saveManualRecord(initial, "CT-001", 100, "pet", config, LATER);
  assert.equal(updated.records.length, 1);
  assert.equal(updated.records[0].createdAt, NOW);
  assert.equal(updated.records[0].updatedAt, LATER);
  assert.equal(updated.records[0].factors.sourceTitle, "Sumber baru");
  assert.equal(initial.records[0].factors.sourceTitle, factorInput.sourceTitle);
});

test("operational data and factor settings round-trip with their sources", () => {
  const config = configuration();
  const state = saveManualRecord(migrateLegacyData(serializeRecords(createSeedRecords(NOW))), "CT-003", 180, "cardboard", config, NOW);
  assert.deepEqual(deserializeOperationalState(serializeOperationalState(state)), state);
  assert.deepEqual(deserializeFactorConfig(serializeFactorConfig(config)), config);
});

test("stored settings reject missing material slots, mismatched materials and unsupported versions", () => {
  assert.throws(() => validateFactorConfig({ pet: null }), ValidationError);
  assert.throws(() => validateFactorConfig({ pet: configuration("cardboard").cardboard, cardboard: null }), ValidationError);
  assert.throws(() => deserializeFactorConfig('{"version":2,"factors":{"pet":null,"cardboard":null}}'), ValidationError);
  assert.throws(() => deserializeFactorConfig("{"), SyntaxError);
});

test("stored operational records reject fabricated methods, invalid weights, duplicate IDs and wrong factor material", () => {
  const state = saveManualRecord(migrateLegacyData(null), "CT-001", 100, "pet", configuration(), NOW);
  for (const patch of [
    { method: "ai" }, { source: "verified" }, { weightGrams: 0 }, { sampleId: "unknown" },
    { createdAt: "invalid" }, { factors: configuration("cardboard").cardboard },
  ]) {
    assert.throws(() => validateOperationalState({ ...state, records: [{ ...state.records[0], ...patch }] }), ValidationError);
  }
  assert.throws(() => validateOperationalState({ ...state, records: [state.records[0], state.records[0]] }), ValidationError);
  assert.throws(() => deserializeOperationalState('{"version":2,"records":[],"archive":[{}]}'), ValidationError);
});

test("operational CSV exports only manual records and distinguishes missing factors from verified data", () => {
  const state = saveManualRecord(migrateLegacyData(serializeRecords(createSeedRecords(NOW))), "CT-007", 42, "pet", emptyFactorConfig(), NOW);
  const csv = exportManualCsv(state);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 2);
  assert.equal(lines[0].split(",").length, 32);
  assert.equal(lines[1].split(",").length, 32);
  assert.ok(csv.includes('"USER_REPORTED_NOT_VERIFIED"'));
  assert.ok(csv.includes('"MANUAL","NOT_ANALYZED"'));
  assert.ok(csv.includes('"NOT_CONFIGURED","NO","NO"'));
  assert.ok(!csv.includes('"CT-005"'));
  assert.ok(!csv.includes("DUMMY_NOT_OFFICIAL"));
});

test("CSV includes the exact factor-source snapshot and escapes spreadsheet formulas", () => {
  const state = saveManualRecord(migrateLegacyData(null), "CT-001", 100, "pet", configuration("pet", { sourceTitle: '=HYPERLINK("https://example.org")' }), NOW);
  const csv = exportManualCsv(state);
  assert.ok(csv.includes('"\'' + '=HYPERLINK(""https://example.org"")"'));
  assert.ok(csv.includes('"USER_SUPPLIED_NOT_VERIFIED"'));
  assert.ok(csv.includes('"https://example.org/test-method"'));
});

test("filters distinguish estimated and missing-source records and exclude archives", () => {
  let state = saveManualRecord(migrateLegacyData(null), "CT-001", 100, "pet", configuration(), NOW);
  state = saveManualRecord(state, "CT-003", 180, "cardboard", emptyFactorConfig(), LATER);
  assert.equal(filterManualRecords(state.records, "", "estimated", "all").length, 1);
  assert.equal(filterManualRecords(state.records, "", "missing", "cardboard").length, 1);
  assert.equal(filterManualRecords(state.records, " CT-003 ", "all", "all").length, 1);
  assert.equal(filterManualRecords(state.records, "", "estimated", "cardboard").length, 0);
});

test("empty history has no invented comparison or cross-reference emission total", () => {
  const summary = summarizeHistory([]);
  assert.equal(summary.count, 0);
  assert.equal(summary.weightGrams, 0);
  assert.equal(summary.estimated, 0);
  assert.equal(summary.missing, 0);
  assert.equal(summary.aiAssisted, 0);
  assert.equal(summary.manual, 0);
  assert.equal(summary.corrected, 0);
  assert.deepEqual(summary.factorGroups, []);
  assert.equal(Object.hasOwn(summary, "impactKg"), false);
});

test("history summaries use only supplied records and their stored factors without rewriting data or exports", () => {
  const config = createParameterSetConfig("warm16-us-average-r1", NOW);
  let state = saveManualRecord(migrateLegacyData(null), "CT-007", 24, "pet", config, NOW);
  state = saveManualRecord(state, "CT-003", 200, "cardboard", emptyFactorConfig(), LATER);
  const before = serializeOperationalState(state);
  const csv = exportManualCsv(state);
  const summary = summarizeHistory(state.records);
  assert.equal(summary.count, 2);
  assert.equal(summary.weightGrams, 224);
  assert.deepEqual(summary.materials, { pet: { count: 1, weightGrams: 24 }, cardboard: { count: 1, weightGrams: 200 }, drywall: { count: 0, weightGrams: 0 } });
  assert.equal(summary.estimated, 1);
  assert.equal(summary.missing, 1);
  assert.equal(summary.factorGroups.length, 1);
  assert.equal(summary.factorGroups[0].weightGrams, 24);
  assert.ok(Math.abs(summary.factorGroups[0].differenceKg - 0.027936336) < 1e-15);
  assert.equal(summary.factorGroups[0].factors.parameterSetId, "warm16-us-average-r1");
  assert.equal(serializeOperationalState(state), before);
  assert.equal(exportManualCsv(state), csv);
  summary.factorGroups[0].factors.baseline = 99;
  assert.equal(state.records[0].factors.baseline, 0.022327);
  const subset = summarizeHistory(filterManualRecords(state.records, "", "missing", "cardboard"));
  assert.equal(subset.count, 1);
  assert.equal(subset.weightGrams, 200);
  assert.equal(subset.estimated, 0);
  assert.deepEqual(subset.factorGroups, []);
});

test("history combines identical factor bases across application dates but separates material, method and reference changes", () => {
  const base = configuration();
  const later = { ...emptyFactorConfig(), pet: { ...base.pet, updatedAt: LATER } };
  let state = saveManualRecord(migrateLegacyData(null), CATALOG_SAMPLES[0].id, 24, "pet", base, NOW);
  state = saveManualRecord(state, CATALOG_SAMPLES[1].id, 76, "pet", later, LATER);
  const changed = [
    { baseline: "3" }, { alternative: "1" },
    { baselineScenario: "A different baseline" }, { alternativeScenario: "A different alternative" },
    { sourceTitle: "Different source" }, { sourceUrl: "https://example.org/other-method" },
    { scope: "A different calculation boundary" },
  ];
  for (const [index, patch] of changed.entries()) {
    state = saveManualRecord(state, CATALOG_SAMPLES[index + 2].id, 10, "pet", configuration("pet", patch), NOW);
  }
  state = saveManualRecord(state, CATALOG_SAMPLES[9].id, 10, "cardboard", configuration("cardboard"), NOW);
  const legacy = { ...base.pet };
  delete legacy.parameterSetId;
  delete legacy.parameterSetName;
  state = saveManualRecord(state, CATALOG_SAMPLES[10].id, 10, "pet", { ...emptyFactorConfig(), pet: legacy }, NOW);
  const summary = summarizeHistory(state.records);
  assert.equal(summary.factorGroups.length, 10);
  assert.equal(summary.factorGroups[0].count, 2);
  assert.equal(summary.factorGroups[0].weightGrams, 100);
  assert.ok(Math.abs(summary.factorGroups[0].differenceKg - 0.15) < 1e-15);
  assert.equal(summary.factorGroups.filter((group) => group.factors.material === "cardboard").length, 1);
  assert.equal(Object.hasOwn(summary, "impactKg"), false);
});

test("stored AI results and human category changes are counted without treating agreement as model accuracy", () => {
  const analysis = (sampleId) => ({
    ...predictionFromScores([0.9, 0.1], "ct-mobilenet-b090d45c6b58"),
    sampleId, inputSha256: "e".repeat(64), analyzedAt: NOW, source: "trained-model",
  });
  let state = saveManualRecord(migrateLegacyData(null), "CT-001", 24, "pet", emptyFactorConfig(), NOW, analysis("CT-001"));
  state = saveManualRecord(state, "CT-003", 30, "cardboard", emptyFactorConfig(), NOW, analysis("CT-003"));
  state = saveManualRecord(state, "CT-007", 40, "pet", emptyFactorConfig(), NOW);
  const summary = summarizeHistory(state.records);
  assert.equal(summary.aiAssisted, 2);
  assert.equal(summary.manual, 1);
  assert.equal(summary.corrected, 1);
  assert.equal(Object.hasOwn(summary, "accuracy"), false);
});

test("history keeps signed, valid zero and tiny group differences separate from missing estimates", () => {
  let state = migrateLegacyData(null);
  for (const [index, [baseline, alternative]] of [["1", "2"], ["0", "0"], ["0.00000001", "0"]].entries()) {
    state = saveManualRecord(state, CATALOG_SAMPLES[index].id, 1000, "pet",
      configuration("pet", { baseline, alternative }), NOW);
  }
  const summary = summarizeHistory(state.records);
  assert.equal(summary.estimated, 3);
  assert.equal(summary.missing, 0);
  assert.deepEqual(summary.factorGroups.map((group) => group.differenceKg), [-1, 0, 1e-8]);
});

test("history aggregation rejects overflowing group estimates rather than displaying a fabricated total", () => {
  const config = configuration("pet", { baseline: "1" + "0".repeat(308), alternative: "0" });
  const first = saveManualRecord(migrateLegacyData(null), "CT-001", 1000, "pet", config, NOW).records[0];
  const second = saveManualRecord(migrateLegacyData(null), "CT-003", 1000, "pet", config, NOW).records[0];
  assert.throws(() => summarizeHistory([first, second]), ValidationError);
});
