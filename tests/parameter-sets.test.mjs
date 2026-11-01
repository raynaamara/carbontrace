import test from "node:test";
import assert from "node:assert/strict";
import { ValidationError, calculateScenarioDetails } from "../src/model.ts";
import {
  DEFAULT_PARAMETER_SET_IDS, PARAMETER_SETS, PLACES_REFERENCE, WARM_REFERENCE, getParameterSet, isParameterSetId,
  normalizeParameterFactor, normalizeWarmFactor, parameterFactorInputs, parameterSetMaterialLabel, parameterSetsForMaterial,
} from "../src/parameter-sets.ts";
import {
  activeParameterSetId, applyMaterialParameterSet, createDocumentedFactors, createParameterSetConfig, ensureMaterialDefault, materialParameterSetId, recordFactorConfig,
  deserializeFactorConfig, deserializeOperationalState, emptyFactorConfig,
  exportManualCsv, factorParameterName, migrateLegacyData, saveManualRecord,
  serializeFactorConfig, serializeOperationalState, validateFactorConfig,
} from "../src/operational.ts";

const FIRST = "warm16-us-average-r1";
const SECOND = "warm16-no-lfg-r1";
const INDONESIA_SANITARY = "places-id-pet-sanitary-20261024-r1";
const INDONESIA_OPEN_DUMP = "places-id-pet-open-dump-20261024-r1";
const NOW = "2026-10-24T06:30:00.000Z";
const LATER = "2026-10-24T07:00:00.000Z";

test("material-specific options contain only supported immutable references with the agreed default first", () => {
  const original = JSON.stringify(PARAMETER_SETS);
  for (const [material, ids] of [
    ["pet", [FIRST, SECOND, INDONESIA_SANITARY, INDONESIA_OPEN_DUMP]],
    ["cardboard", [FIRST, SECOND]],
    ["drywall", ["warm16-drywall-us-average-r1"]],
  ]) {
    assert.deepEqual(parameterSetsForMaterial(material).map((set) => set.id), ids);
    assert.equal(DEFAULT_PARAMETER_SET_IDS[material], ids[0]);
    assert.ok(parameterSetsForMaterial(material).every((set) => set.factors[material] !== undefined));
  }
  assert.equal(JSON.stringify(PARAMETER_SETS), original);
  assert.throws(() => parameterSetsForMaterial("unknown"), ValidationError);
});

test("defaults fill only the confirmed material's missing slot and preserve every existing source choice", () => {
  const empty = emptyFactorConfig();
  const pet = ensureMaterialDefault(empty, "pet", NOW);
  assert.equal(empty.pet, null);
  assert.equal(pet.pet.parameterSetId, FIRST);
  assert.equal(pet.cardboard, null);
  assert.equal(pet.drywall, null);
  const dry = ensureMaterialDefault(pet, "drywall", LATER);
  assert.deepEqual(dry.pet, pet.pet);
  assert.equal(dry.drywall.parameterSetId, "warm16-drywall-us-average-r1");
  const card = ensureMaterialDefault(dry, "cardboard", NOW);
  assert.equal(card.cardboard.parameterSetId, FIRST);
  assert.equal(materialParameterSetId(card, "drywall"), "warm16-drywall-us-average-r1");
  assert.equal(ensureMaterialDefault(card, "pet", LATER), card);
  const custom = createDocumentedFactors("pet", parameterFactorInputs(FIRST, "pet"), NOW);
  const chosen = { ...card, pet: custom };
  assert.equal(ensureMaterialDefault(chosen, "pet", LATER), chosen);
  assert.equal(materialParameterSetId(chosen, "pet"), "custom");
  const { parameterSetId, parameterSetName, ...legacy } = custom;
  const old = { ...card, pet: legacy };
  assert.equal(ensureMaterialDefault(old, "pet", LATER), old);
  assert.equal(materialParameterSetId(old, "pet"), "custom");
  assert.equal(materialParameterSetId(empty, "pet"), null);
});

test("applying a source changes only that material and never clears other materials or saved records", () => {
  let config = ensureMaterialDefault(emptyFactorConfig(), "pet", NOW);
  config = ensureMaterialDefault(config, "cardboard", NOW);
  config = ensureMaterialDefault(config, "drywall", NOW);
  const state = saveManualRecord(migrateLegacyData(null), "CT-007", 24, "pet", config, NOW);
  const original = serializeFactorConfig(config);
  const snapshots = serializeOperationalState(state);
  const next = applyMaterialParameterSet(config, INDONESIA_SANITARY, "pet", LATER);
  assert.equal(next.pet.parameterSetId, INDONESIA_SANITARY);
  assert.deepEqual(next.cardboard, config.cardboard);
  assert.deepEqual(next.drywall, config.drywall);
  assert.equal(serializeFactorConfig(config), original);
  assert.equal(serializeOperationalState(state), snapshots);
  assert.equal(ensureMaterialDefault(next, "pet", NOW), next);
  assert.throws(() => applyMaterialParameterSet(config, INDONESIA_SANITARY, "drywall", NOW), ValidationError);
});

test("per-record estimate opt-out leaves preferences intact and stores no false zero impact", () => {
  const config = ensureMaterialDefault(emptyFactorConfig(), "drywall", NOW);
  const original = serializeFactorConfig(config);
  assert.equal(recordFactorConfig(config, "drywall", true), config);
  const skipped = recordFactorConfig(config, "drywall", false);
  assert.equal(skipped.drywall, null);
  assert.equal(serializeFactorConfig(config), original);
  const state = saveManualRecord(migrateLegacyData(null), "CT-009", 1000, "drywall", skipped, NOW);
  assert.equal(state.records[0].factors, null);
  assert.ok(exportManualCsv(state).includes('"NOT_CONFIGURED"'));
  assert.deepEqual(deserializeOperationalState(serializeOperationalState(state)), state);
});

test("three immutable WARM references expose official links and material-specific assumptions", () => {
  assert.equal(PARAMETER_SETS.filter((set) => set.id.startsWith("warm16-")).length, 3);
  assert.equal(new Set(PARAMETER_SETS.map((set) => set.id)).size, PARAMETER_SETS.length);
  assert.ok(getParameterSet(FIRST).baselineScenario.includes("rata-rata nasional AS"));
  assert.ok(getParameterSet(SECOND).baselineDescription.includes("bukan skenario gas ditangkap lalu dibakar"));
  assert.ok(PARAMETER_SETS.every((set) => set.whenToUse.includes("Indonesia")));
  for (const url of [WARM_REFERENCE.workbookUrl, WARM_REFERENCE.explanationUrl, WARM_REFERENCE.versionsUrl]) {
    assert.equal(new URL(url).hostname, "www.epa.gov");
  }
  assert.equal(WARM_REFERENCE.workbookSha256, "5886bef6721735efdb95ffd904c1c50ff1d6f0ea567b2c8c7f8ee4633d519f22");
  assert.throws(() => getParameterSet("unknown"), ValidationError);
});

test("unit conversion uses metric CO2e and US short-ton material, rounded to six decimals", () => {
  assert.equal(WARM_REFERENCE.shortTonKg, 907.18474);
  assert.equal(normalizeWarmFactor(1), 1.102311);
  assert.equal(normalizeWarmFactor(0), 0);
  assert.equal(normalizeWarmFactor(-1.0357206316437553), -1.141687);
  assert.throws(() => normalizeWarmFactor(Infinity), ValidationError);
});

test("set one matches verified Summary Data E8/C8 and E9/C9", () => {
  const config = createParameterSetConfig(FIRST, NOW);
  assert.deepEqual([config.pet.baseline, config.pet.alternative], [0.022327, -1.141687]);
  assert.deepEqual([config.cardboard.baseline, config.cardboard.alternative], [0.200213, -3.456117]);
  assert.ok(config.pet.sourceTitle.includes("E8/C8"));
  assert.ok(config.cardboard.sourceTitle.includes("E9/C9"));
  assert.equal(config.pet.sourceUrl, WARM_REFERENCE.workbookUrl);
  assert.ok(config.pet.scope.includes("20 mil"));
  assert.ok(config.pet.scope.includes("Bukan faktor Indonesia"));
});

test("set two matches verified No Recovery F8/C8 and F9/C9 without changing recycling factors", () => {
  const first = createParameterSetConfig(FIRST, NOW);
  const second = createParameterSetConfig(SECOND, NOW);
  assert.deepEqual([second.pet.baseline, second.pet.alternative], [0.022327, -1.141687]);
  assert.deepEqual([second.cardboard.baseline, second.cardboard.alternative], [1.833663, -3.456117]);
  assert.equal(second.cardboard.alternative, first.cardboard.alternative);
  assert.ok(second.cardboard.sourceTitle.includes("F9/C9"));
});

test("preset configurations include both materials, immutable IDs and readable snapshot names", () => {
  const config = createParameterSetConfig(FIRST, NOW);
  validateFactorConfig(config);
  assert.equal(activeParameterSetId(config), FIRST);
  assert.equal(config.pet.parameterSetId, FIRST);
  assert.equal(config.cardboard.parameterSetName, getParameterSet(FIRST).name);
  assert.deepEqual(deserializeFactorConfig(serializeFactorConfig(config)), config);
});

test("tampered preset values, labels and source metadata are rejected rather than attributed to WARM", () => {
  for (const patch of [
    { baseline: 99 }, { alternative: 99 }, { parameterSetId: SECOND },
    { parameterSetName: "A different reference" }, { sourceTitle: "Changed source" },
    { scope: "Indonesia verified" }, { baselineScenario: "Different treatment" },
  ]) {
    const config = createParameterSetConfig(FIRST, NOW);
    config.cardboard = { ...config.cardboard, ...patch };
    assert.throws(() => validateFactorConfig(config), ValidationError);
  }
});

test("custom editing creates custom provenance even when starting with preset numeric values", () => {
  const factors = createDocumentedFactors("pet", parameterFactorInputs(FIRST, "pet"), NOW);
  assert.equal(factors.parameterSetId, "custom");
  assert.equal(factors.parameterSetName, "Parameter khusus");
  assert.equal(activeParameterSetId({ ...emptyFactorConfig(), pet: factors }), "custom");
});

test("legacy sourced factors without parameter metadata remain readable without being promoted to a preset", () => {
  const original = createParameterSetConfig(FIRST, NOW).pet;
  const { parameterSetId, parameterSetName, ...legacy } = original;
  const serialized = JSON.stringify({ version: 1, factors: { pet: legacy, cardboard: null } });
  const config = deserializeFactorConfig(serialized);
  assert.deepEqual(config.pet, legacy);
  assert.equal(activeParameterSetId(config), "custom");
  assert.equal(factorParameterName(config.pet), "Parameter khusus (data lama)");
});

test("missing and mixed settings are distinguished from a globally active reference set", () => {
  assert.equal(activeParameterSetId(emptyFactorConfig()), null);
  const first = createParameterSetConfig(FIRST, NOW);
  const second = createParameterSetConfig(SECOND, NOW);
  assert.equal(activeParameterSetId({ ...first, cardboard: second.cardboard }), "custom");
  assert.equal(activeParameterSetId({ ...first, cardboard: null }), "custom");
});

test("scenario details expose both net emissions while retaining the original difference calculation", () => {
  const factors = createParameterSetConfig(FIRST, NOW).pet;
  const details = calculateScenarioDetails(25, factors);
  assert.equal(details.massKg, 0.025);
  assert.ok(Math.abs(details.baselineKg - 0.000558175) < 1e-12);
  assert.ok(Math.abs(details.alternativeKg - (-0.028542175)) < 1e-12);
  assert.ok(Math.abs(details.differenceKg - 0.02910035) < 1e-12);
  const equal = calculateScenarioDetails(1000, { baseline: -1, alternative: -1 });
  assert.equal(equal.differenceKg, 0);
  assert.equal(equal.baselineKg, -1);
});

test("invalid or overflowing component emissions are not hidden by a zero difference", () => {
  assert.throws(() => calculateScenarioDetails(Number.MAX_VALUE, { baseline: Number.MAX_VALUE, alternative: Number.MAX_VALUE }), ValidationError);
  assert.throws(() => calculateScenarioDetails(0, { baseline: 1, alternative: 0 }), ValidationError);
});

test("changing the parameter set does not rewrite historical factor snapshots", () => {
  const first = createParameterSetConfig(FIRST, NOW);
  const second = createParameterSetConfig(SECOND, LATER);
  const saved = saveManualRecord(migrateLegacyData(null), "CT-003", 1000, "cardboard", first, NOW);
  assert.equal(saved.records[0].factors.parameterSetId, FIRST);
  const revised = saveManualRecord(saved, "CT-003", 1000, "cardboard", second, LATER);
  assert.equal(revised.records.length, 1);
  assert.equal(saved.records[0].factors.parameterSetId, FIRST);
  assert.equal(revised.records[0].factors.parameterSetId, SECOND);
  assert.equal(revised.records[0].createdAt, NOW);
  assert.equal(revised.records[0].updatedAt, LATER);
  assert.deepEqual(deserializeOperationalState(serializeOperationalState(saved)), saved);
});

test("CSV appends parameter-set provenance and leaves missing factors explicitly empty", () => {
  const state = saveManualRecord(migrateLegacyData(null), "CT-003", 1000, "cardboard", createParameterSetConfig(SECOND, NOW), NOW);
  const csv = exportManualCsv(state);
  assert.equal(csv.trim().split("\r\n")[0].split(",").length, 32);
  assert.ok(csv.includes('"REFERENCE_MODEL_NOT_SITE_VERIFIED"'));
  assert.ok(csv.trim().endsWith(`"${SECOND}","${getParameterSet(SECOND).name}"`));
  const missing = saveManualRecord(migrateLegacyData(null), "CT-001", 24, "pet", emptyFactorConfig(), NOW);
  assert.ok(exportManualCsv(missing).trim().endsWith('"",""'));
});

test("Indonesia references identify PLACES, the country, polymer, query quantity and methodology snapshot", () => {
  assert.equal(PARAMETER_SETS.length, 5);
  assert.equal(PLACES_REFERENCE.queryQuantityTonnes, 1_000_000);
  assert.equal(PLACES_REFERENCE.verifiedDate, "2026-10-24");
  assert.equal(PLACES_REFERENCE.methodologySha256, "5063ec73fa7ce9e09f9238658c8bf0683cc3de383b95fb629a9d152080615b7b");
  for (const [id, fate] of [[INDONESIA_SANITARY, "Sanitary Landfill"], [INDONESIA_OPEN_DUMP, "Open Dump"]]) {
    assert.ok(isParameterSetId(id));
    const set = getParameterSet(id);
    const url = new URL(set.reference.sourceUrl);
    assert.equal(url.hostname, "places.thecirculateinitiative.org");
    assert.equal(url.searchParams.get("countries"), "id");
    assert.equal(url.searchParams.get("pt_0_type"), "PET");
    assert.equal(url.searchParams.get("pt_0_qt"), "1000000");
    assert.equal(url.searchParams.get("pt_0_eol"), fate);
    assert.ok(set.reference.locationNote.includes("bukan faktor resmi pemerintah"));
    assert.ok(set.reference.unitNote.includes("bukan jumlah sampel proyek"));
    assert.ok(set.assumptions.includes("20 km"));
    assert.ok(set.assumptions.includes("95%"));
    assert.ok(set.reference.links.some((link) => link.url === PLACES_REFERENCE.methodologyUrl));
  }
  assert.equal(isParameterSetId(null), false);
  assert.equal(isParameterSetId("places-unknown"), false);
});

test("PLACES coefficients come from the verified totals, not the US short-ton conversion", () => {
  const sanitary = getParameterSet(INDONESIA_SANITARY).factors.pet;
  const openDump = getParameterSet(INDONESIA_OPEN_DUMP).factors.pet;
  assert.deepEqual([sanitary.baselineOriginal, sanitary.alternativeOriginal], [95_579, -2_497_533]);
  assert.deepEqual([openDump.baselineOriginal, openDump.alternativeOriginal], [101_700, -2_497_533]);
  assert.equal(normalizeParameterFactor(INDONESIA_SANITARY, 1_000_000), 1);
  assert.equal(normalizeParameterFactor(FIRST, 1), 1.102311);
  assert.deepEqual(
    [createParameterSetConfig(INDONESIA_SANITARY, NOW).pet.baseline, createParameterSetConfig(INDONESIA_SANITARY, NOW).pet.alternative],
    [0.095579, -2.497533],
  );
  assert.deepEqual(
    [createParameterSetConfig(INDONESIA_OPEN_DUMP, NOW).pet.baseline, createParameterSetConfig(INDONESIA_OPEN_DUMP, NOW).pet.alternative],
    [0.1017, -2.497533],
  );
  assert.throws(() => normalizeParameterFactor(INDONESIA_SANITARY, NaN), ValidationError);
  assert.throws(() => normalizeWarmFactor(Number.MAX_VALUE), ValidationError);
});

test("PET-only sets round-trip as active presets without inventing cardboard factors", () => {
  for (const id of [INDONESIA_SANITARY, INDONESIA_OPEN_DUMP]) {
    const config = createParameterSetConfig(id, NOW);
    assert.equal(config.cardboard, null);
    assert.equal(config.pet.parameterSetId, id);
    assert.equal(activeParameterSetId(config), id);
    assert.equal(parameterSetMaterialLabel(id), "Botol PET");
    assert.equal(getParameterSet(id).factors.cardboard, undefined);
    assert.throws(() => parameterFactorInputs(id, "cardboard"), ValidationError);
    assert.deepEqual(deserializeFactorConfig(serializeFactorConfig(config)), config);
  }
  assert.equal(parameterSetMaterialLabel(FIRST), "Botol PET / Kardus");
});

test("unsupported and mixed material snapshots cannot masquerade as an Indonesia preset", () => {
  const indonesia = createParameterSetConfig(INDONESIA_SANITARY, NOW);
  const warm = createParameterSetConfig(FIRST, NOW);
  assert.equal(activeParameterSetId({ ...indonesia, cardboard: warm.cardboard }), "custom");
  assert.throws(() => validateFactorConfig({
    pet: indonesia.pet, cardboard: { ...indonesia.pet, material: "cardboard" },
  }), ValidationError);
  for (const patch of [
    { baseline: 0.10 }, { alternative: -2.50 }, { parameterSetId: INDONESIA_OPEN_DUMP },
    { sourceUrl: WARM_REFERENCE.workbookUrl }, { scope: "Faktor resmi pemerintah Indonesia" },
  ]) {
    assert.throws(() => validateFactorConfig({
      pet: { ...indonesia.pet, ...patch }, cardboard: null,
    }), ValidationError);
  }
});

test("Indonesia components and differences reproduce independently observed one-tonne results", () => {
  for (const [id, baseline, difference, displayedSavings] of [
    [INDONESIA_SANITARY, 0.095579, 2.593112, "2.59"],
    [INDONESIA_OPEN_DUMP, 0.1017, 2.599233, "2.60"],
  ]) {
    const factors = createParameterSetConfig(id, NOW).pet;
    const oneKg = calculateScenarioDetails(1000, factors);
    assert.ok(Math.abs(oneKg.baselineKg - baseline) < 1e-12);
    assert.ok(Math.abs(oneKg.alternativeKg - (-2.497533)) < 1e-12);
    assert.ok(Math.abs(oneKg.differenceKg - difference) < 1e-12);
    const oneTonne = calculateScenarioDetails(1_000_000, factors);
    assert.equal((oneTonne.baselineKg / 1000).toFixed(2), "0.10");
    assert.equal((oneTonne.alternativeKg / 1000).toFixed(2), "-2.50");
    assert.equal((oneTonne.differenceKg / 1000).toFixed(2), displayedSavings);
    const query = calculateScenarioDetails(1_000_000_000_000, factors);
    const raw = getParameterSet(id).factors.pet;
    assert.ok(Math.abs(query.baselineKg / 1000 - raw.baselineOriginal) < 1e-8);
    assert.ok(Math.abs(query.alternativeKg / 1000 - raw.alternativeOriginal) < 1e-8);
  }
});

test("applying an Indonesia set leaves old WARM snapshots intact and new cardboard records unestimated", () => {
  const warm = createParameterSetConfig(FIRST, NOW);
  const old = saveManualRecord(migrateLegacyData(null), "CT-003", 1000, "cardboard", warm, NOW);
  const indonesia = createParameterSetConfig(INDONESIA_SANITARY, LATER);
  const updated = saveManualRecord(old, "CT-001", 25, "pet", indonesia, LATER);
  assert.equal(warm.cardboard.parameterSetId, FIRST);
  assert.equal(updated.records.find((record) => record.sampleId === "CT-003").factors.parameterSetId, FIRST);
  const withCardboard = saveManualRecord(updated, "CT-004", 80, "cardboard", indonesia, LATER);
  assert.equal(withCardboard.records.find((record) => record.sampleId === "CT-004").factors, null);
  assert.deepEqual(deserializeOperationalState(serializeOperationalState(withCardboard)), withCardboard);
});

test("Indonesia CSV preserves reference identity and 32 columns without treating missing cardboard as zero", () => {
  const config = createParameterSetConfig(INDONESIA_OPEN_DUMP, NOW);
  const pet = saveManualRecord(migrateLegacyData(null), "CT-001", 25, "pet", config, NOW);
  const state = saveManualRecord(pet, "CT-003", 80, "cardboard", config, LATER);
  const csv = exportManualCsv(state);
  assert.equal(csv.trim().split("\r\n")[0].split(",").length, 32);
  assert.ok(csv.includes(`"${INDONESIA_OPEN_DUMP}","${getParameterSet(INDONESIA_OPEN_DUMP).name}"`));
  assert.ok(csv.includes('"REFERENCE_MODEL_NOT_SITE_VERIFIED"'));
  assert.ok(csv.includes('"NOT_CONFIGURED"'));
  assert.ok(csv.includes("places.thecirculateinitiative.org"));
});

test("manually copied or legacy PLACES coefficients remain custom instead of gaining preset identity", () => {
  const custom = createDocumentedFactors("pet", parameterFactorInputs(INDONESIA_SANITARY, "pet"), NOW);
  assert.equal(custom.parameterSetId, "custom");
  assert.equal(activeParameterSetId({ ...emptyFactorConfig(), pet: custom }), "custom");
  const { parameterSetId, parameterSetName, ...legacy } = createParameterSetConfig(INDONESIA_SANITARY, NOW).pet;
  const config = deserializeFactorConfig(JSON.stringify({ version: 1, factors: { pet: legacy, cardboard: null } }));
  assert.equal(activeParameterSetId(config), "custom");
  assert.equal(factorParameterName(config.pet), "Parameter khusus (data lama)");
});

test("drywall has its own immutable WARM E53/C53 basis, without rewriting the earlier four references", () => {
  const id = "warm16-drywall-us-average-r1";
  const config = createParameterSetConfig(id, NOW);
  assert.equal(PARAMETER_SETS.length, 5);
  assert.equal(config.pet, null);
  assert.equal(config.cardboard, null);
  assert.equal(config.drywall.baseline, -0.067287);
  assert.equal(config.drywall.alternative, 0.028756);
  assert.ok(config.drywall.sourceTitle.includes("E53/C53"));
  assert.ok(config.drywall.scope.includes("H2S"));
  assert.equal(activeParameterSetId(config), id);
  assert.equal(parameterSetMaterialLabel(id), "Papan gipsum");
  assert.equal(calculateScenarioDetails(1000, config.drywall).differenceKg.toFixed(6), "-0.096043");
  assert.deepEqual(deserializeFactorConfig(serializeFactorConfig(config)), config);
  for (const definition of PARAMETER_SETS.filter((set) => set.id !== id)) {
    assert.equal(definition.factors.drywall, undefined);
    assert.equal(createParameterSetConfig(definition.id, NOW).drywall, null);
    assert.throws(() => parameterFactorInputs(definition.id, "drywall"), ValidationError);
  }
  const warm = createParameterSetConfig(FIRST, NOW);
  const old = saveManualRecord(migrateLegacyData(null), "CT-007", 24, "pet", warm, NOW);
  const next = saveManualRecord(old, "CT-009", 1000, "drywall", config, LATER);
  assert.deepEqual(next.records[0], old.records[0]);
  assert.equal(next.records[1].factors.parameterSetId, id);
  assert.equal(activeParameterSetId({ ...config, pet: warm.pet }), "custom");
  assert.throws(() => validateFactorConfig({ ...config, drywall: { ...config.drywall, material: "pet" } }), ValidationError);
});

test("old two-material factor payloads migrate only the missing drywall slot, without inventing values", () => {
  const { drywall, ...old } = createParameterSetConfig(FIRST, NOW);
  const bytes = JSON.stringify({ version: 1, factors: old });
  const restored = deserializeFactorConfig(bytes);
  assert.equal(restored.drywall, null);
  assert.equal(JSON.stringify({ version: 1, factors: { pet: restored.pet, cardboard: restored.cardboard } }), bytes);
  assert.equal(activeParameterSetId(restored), FIRST);
  assert.throws(() => deserializeFactorConfig('{"version":1,"factors":{"pet":null}}'), ValidationError);
  assert.throws(() => deserializeFactorConfig('{"version":1,"factors":{"pet":null,"cardboard":null,"drywall":{}}}'), ValidationError);
});
