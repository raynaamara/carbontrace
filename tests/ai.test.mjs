import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CATALOG_SAMPLES, MATERIALS, ValidationError } from "../src/model.ts";
import { DATASET_DECLARATION, DATASET_SPLIT, TRAINING_SAMPLES } from "../src/dataset.ts";
import { parseModelInfo, predictionFromScores, validateModelAnalysis } from "../src/ai-contract.ts";
import {
  deserializeOperationalState, emptyFactorConfig, exportManualCsv, migrateLegacyData,
  saveManualRecord, serializeOperationalState, validateOperationalState,
} from "../src/operational.ts";

const report = JSON.parse(readFileSync(new URL("../public/models/carbontrace/report.json", import.meta.url), "utf8"));
const info = parseModelInfo(report);
const currentHeadDirectory = new URL(`../public/models/carbontrace/${info.version}/`, import.meta.url);
const previousVersion = "ct-mobilenet-4aa1cd74741b";
const previousHeadDirectory = new URL(`../public/models/carbontrace/${previousVersion}/`, import.meta.url);
const previousReport = JSON.parse(readFileSync(new URL("report.json", previousHeadDirectory), "utf8"));
const intermediateVersion = "ct-mobilenet-b090d45c6b58";
const intermediateHeadDirectory = new URL(`../public/models/carbontrace/${intermediateVersion}/`, import.meta.url);
const intermediateReport = JSON.parse(readFileSync(new URL("report.json", intermediateHeadDirectory), "utf8"));
const twoClassVersion = "ct-mobilenet-414f2c4df422";
const twoClassDirectory = new URL(`../public/models/carbontrace/${twoClassVersion}/`, import.meta.url);
const twoClassReport = JSON.parse(readFileSync(new URL("report.json", twoClassDirectory), "utf8"));
const NOW = "2026-10-24T06:00:00.000Z";
const analysis = () => ({
  ...predictionFromScores([0.9, 0.08, 0.02], info.version),
  sampleId: "SYN-PET-009",
  inputSha256: "e".repeat(64),
  analyzedAt: NOW,
  source: "trained-model",
});

test("120 photos keep 78 training images separate from 28 regressions and 14 new drywall holdouts", () => {
  assert.equal(TRAINING_SAMPLES.length, 120);
  assert.equal(new Set(TRAINING_SAMPLES.map((sample) => sample.id)).size, 120);
  assert.equal(info.trainIds.length, 78);
  assert.equal(info.testIds.length, 42);
  assert.deepEqual(info.labels, MATERIALS);
  assert.ok(info.trainIds.every((id) => !info.testIds.includes(id)));
  for (const material of MATERIALS) {
    assert.equal(TRAINING_SAMPLES.filter((sample) => sample.material === material && sample.role === "train").length, 26);
    assert.equal(TRAINING_SAMPLES.filter((sample) => sample.material === material && sample.role === "test").length, 14);
    assert.equal(TRAINING_SAMPLES.filter((sample) => sample.material === material && sample.testCohort === "previous-test").length, material === "drywall" ? 0 : 14);
    assert.equal(TRAINING_SAMPLES.filter((sample) => sample.material === material && sample.testCohort === "new-holdout").length, material === "drywall" ? 14 : 0);
  }
  assert.equal(DATASET_DECLARATION.source, "user-provided-photographs");
  assert.equal(DATASET_DECLARATION.independentlyVerified, false);
  assert.ok(CATALOG_SAMPLES.filter((sample) => sample.role === "outside").every((sample) => !info.trainIds.includes(sample.id)));
  assert.deepEqual([...info.evaluationGroups["previous-test"].ids].sort(), [...twoClassReport.testIds].sort());
  assert.ok(twoClassReport.testIds.every((id) => !info.trainIds.includes(id)));
  assert.ok(twoClassReport.trainIds.every((id) => info.trainIds.includes(id)));
  assert.ok(info.evaluationGroups["new-holdout"].ids.every((id) => id.startsWith("SYN-DRYWALL-")));
  assert.ok(TRAINING_SAMPLES.filter((sample) => sample.role === "train").every((sample) => sample.testCohort === null));
});

test("new photos use the declared seeded stratified split rather than evaluation-driven selection", () => {
  assert.equal(DATASET_SPLIT.seed, 20261026);
  assert.deepEqual(report.datasetSplit, DATASET_SPLIT);
  for (const material of ["drywall"]) {
    const added = TRAINING_SAMPLES.filter((sample) => sample.material === material);
    const ranked = added.toSorted((left, right) => Buffer.compare(
      createHash("sha256").update(`${DATASET_SPLIT.seed}:${left.id}`).digest(),
      createHash("sha256").update(`${DATASET_SPLIT.seed}:${right.id}`).digest(),
    ));
    assert.deepEqual(ranked.slice(0, 26).map((sample) => sample.id).sort(),
      added.filter((sample) => sample.role === "train").map((sample) => sample.id).sort());
    assert.ok(ranked.slice(26).every((sample) => sample.testCohort === "new-holdout"));
  }
});

test("training report records actual source and display hashes with no identical source image in either split", () => {
  const hashes = new Set();
  const displayHashes = new Set();
  for (const sample of report.samples) {
    const original = readFileSync(new URL(`../src/assets/samples/${sample.imageFile}`, import.meta.url));
    const display = readFileSync(new URL(`../src/assets/samples/optimized/${sample.id}_01.jpg`, import.meta.url));
    assert.equal(createHash("sha256").update(original).digest("hex"), sample.originalSha256);
    assert.equal(createHash("sha256").update(display).digest("hex"), sample.displaySha256);
    assert.ok(!hashes.has(sample.originalSha256));
    hashes.add(sample.originalSha256);
    assert.ok(!displayHashes.has(sample.displaySha256));
    displayHashes.add(sample.displaySha256);
  }
  assert.equal(hashes.size, 120);
  assert.equal(displayHashes.size, 120);
  assert.equal(report.training.sourceImages, 78);
  assert.equal(report.training.augmentedExamples, 312);
  assert.equal(report.training.trainableParameters, 771);
});

test("saved neural-network weights match the report and are not fixture predictions", () => {
  for (const [directory, hash] of [[`carbontrace/${info.version}`, info.headSha256], ["mobilenet", info.backboneSha256]]) {
    const manifest = JSON.parse(readFileSync(new URL(`../public/models/${directory}/model.json`, import.meta.url), "utf8"));
    assert.equal(manifest.format, "layers-model");
    const weights = Buffer.concat(manifest.weightsManifest.flatMap((group) => group.paths.map((file) =>
      readFileSync(new URL(`../public/models/${directory}/${file}`, import.meta.url)))));
    assert.equal(createHash("sha256").update(weights).digest("hex"), hash);
    if (directory.startsWith("carbontrace")) assert.equal(weights.length, 771 * 4);
  }
});

test("model metadata rejects split overlap, exaggerated evaluation and version mismatch", () => {
  for (const changed of [
    { ...report, testIds: [report.trainIds[0], ...report.testIds.slice(1)] },
    { ...report, accuracy: 0.12345 },
    { ...report, version: "ct-mobilenet-000000000000" },
    { ...report, independentlyVerified: true },
    { ...report, schemaVersion: 1 },
    { ...report, schemaVersion: 2 },
    { ...report, labels: ["drywall", "cardboard", "pet"] },
    { ...report, labels: ["pet", "cardboard"] },
    { ...report, trainIds: report.trainIds.slice(1) },
    { ...report, accuracy: NaN },
  ]) assert.throws(() => parseModelInfo(changed), ValidationError);
});

test("metadata keeps new holdouts distinct from previously evaluated regression images", () => {
  const old = report.evaluationGroups["previous-test"];
  const fresh = report.evaluationGroups["new-holdout"];
  for (const groups of [
    { "previous-test": fresh, "new-holdout": old },
    { "previous-test": { ...old, correct: 5, accuracy: 1.25 }, "new-holdout": fresh },
    { "previous-test": old, "new-holdout": { ...fresh, accuracy: NaN } },
    { "previous-test": old },
    { "previous-test": { ...old, ids: [...old.ids.slice(1), old.ids[1]] }, "new-holdout": fresh },
  ]) assert.throws(() => parseModelInfo({ ...report, evaluationGroups: groups }), ValidationError);
  const correct = old.correct === 0 ? 1 : old.correct - 1;
  assert.throws(() => parseModelInfo({
    ...report, evaluationGroups: { "previous-test": { ...old, correct, accuracy: correct / old.ids.length }, "new-holdout": fresh },
  }), ValidationError);
  assert.equal(old.correct + fresh.correct, info.correct);
});

test("three-class scores are complete distributions and legacy two-class scores retain their shape", () => {
  assert.equal(predictionFromScores([0.1, 0.8, 0.1], info.version).category, "cardboard");
  assert.equal(predictionFromScores([0.2, 0.3, 0.5], info.version).category, "drywall");
  for (const values of [[0, 0], [0.9, 0.1], [NaN, 1, 0], [0.2, 0.2, 0.2], [1.2, -0.2, 0], [0.1, 0.2, 0.3, 0.4]]) {
    assert.throws(() => predictionFromScores(values, info.version), ValidationError);
  }
  const old = predictionFromScores([0.9, 0.1], twoClassVersion);
  assert.deepEqual(Object.keys(old.scores), ["pet", "cardboard"]);
  assert.throws(() => predictionFromScores([0.9, 0.1, 0], twoClassVersion), ValidationError);
  assert.throws(() => validateModelAnalysis({ ...analysis(), scores: { pet: 0.9, cardboard: 0.1 } }), ValidationError);
  assert.throws(() => validateModelAnalysis({ ...analysis(), scores: { pet: 0.9, cardboard: 0.08, drywall: 0.02, unknown: 0 } }), ValidationError);
});

test("AI analysis binds category, scores, input digest, model version and sample ID", () => {
  validateModelAnalysis(analysis());
  for (const change of [
    { score: 0.8 }, { category: "cardboard" }, { inputSha256: "invalid" },
    { modelVersion: "dummy" }, { sampleId: "unknown" }, { source: "fixture" },
  ]) assert.throws(() => validateModelAnalysis({ ...analysis(), ...change }), ValidationError);
});

test("AI-assisted records preserve actual inference separately from the user's corrected material", () => {
  const result = analysis();
  const state = saveManualRecord(migrateLegacyData(null), result.sampleId, 100, "cardboard", emptyFactorConfig(), NOW, result);
  assert.equal(state.records[0].method, "ai-assisted");
  assert.equal(state.records[0].analysis.category, "pet");
  assert.equal(state.records[0].category, "cardboard");
  result.scores.pet = 0.5;
  assert.equal(state.records[0].analysis.scores.pet, 0.9);
  assert.deepEqual(deserializeOperationalState(serializeOperationalState(state)), state);
  const csv = exportManualCsv(state);
  assert.ok(csv.includes('"AI_ASSISTED_HUMAN_CONFIRMED","MODEL_INFERENCE_RECORDED"'));
  assert.ok(csv.includes(info.version));
  assert.ok(csv.includes('"' + "e".repeat(64) + '"'));
  assert.ok(csv.trim().endsWith('"YES","",""'));
  assert.equal(csv.trim().split("\r\n")[0].split(",").length, 32);
});

test("AI methods cannot be saved without inference or bound to another sample", () => {
  const state = saveManualRecord(migrateLegacyData(null), "CT-001", 100, "pet", emptyFactorConfig(), NOW);
  assert.throws(() => validateOperationalState({ ...state, records: [{ ...state.records[0], method: "ai-assisted" }] }), ValidationError);
  assert.throws(() => saveManualRecord(state, "CT-001", 100, "pet", emptyFactorConfig(), NOW, analysis()), ValidationError);
  assert.throws(() => validateOperationalState({ ...state, records: [{ ...state.records[0], analysis: analysis() }] }), ValidationError);
});

test("the archived previous model and old photo hashes remain available for historical analysis", () => {
  assert.equal(previousReport.version, previousVersion);
  assert.notEqual(info.version, previousVersion);
  assert.equal(previousReport.schemaVersion, 1);
  assert.equal(previousReport.backboneSha256, info.backboneSha256);
  assert.equal(previousReport.trainIds.length, 16);
  assert.equal(previousReport.testIds.length, 4);
  for (const sample of previousReport.samples) {
    const current = report.samples.find((item) => item.id === sample.id);
    assert.equal(current.originalSha256, sample.originalSha256);
    assert.equal(current.displaySha256, sample.displaySha256);
  }
  const prediction = previousReport.evaluation[0];
  const historical = { ...analysis(), ...predictionFromScores([prediction.scores.pet, prediction.scores.cardboard], previousVersion), sampleId: prediction.id };
  const state = saveManualRecord(migrateLegacyData(null), historical.sampleId, 100, historical.category, emptyFactorConfig(), NOW, historical);
  assert.equal(deserializeOperationalState(serializeOperationalState(state)).records[0].analysis.modelVersion, previousVersion);
});

test("the intermediate model preserves all forty old photo hashes and saved analysis versions", () => {
  assert.equal(intermediateReport.version, intermediateVersion);
  assert.notEqual(info.version, intermediateVersion);
  assert.equal(intermediateReport.trainIds.length, 32);
  assert.equal(intermediateReport.testIds.length, 8);
  assert.equal(intermediateReport.backboneSha256, info.backboneSha256);
  for (const sample of intermediateReport.samples) {
    const current = report.samples.find((item) => item.id === sample.id);
    assert.equal(current.originalSha256, sample.originalSha256);
    assert.equal(current.displaySha256, sample.displaySha256);
  }
  const prediction = intermediateReport.evaluation[0];
  const historical = {
    ...analysis(),
    ...predictionFromScores([prediction.scores.pet, prediction.scores.cardboard], intermediateVersion),
    sampleId: prediction.id,
  };
  const state = saveManualRecord(migrateLegacyData(null), historical.sampleId, 100, historical.category, emptyFactorConfig(), NOW, historical);
  assert.equal(deserializeOperationalState(serializeOperationalState(state)).records[0].analysis.modelVersion, intermediateVersion);
});

async function assertSavedPredictions(expectedReport, headDirectory) {
  const tf = await import("@tensorflow/tfjs");
  const { createFeatureExtractor, disposeFeatureModels, imageEmbedding } = await import("../src/ml-core.ts");
  const { jpegTensor, loadLocalLayersModel } = await import("../scripts/model-io.mjs");
  await tf.setBackend("cpu");
  const backbone = await loadLocalLayersModel(fileURLToPath(new URL("../public/models/mobilenet/", import.meta.url)));
  const head = await loadLocalLayersModel(fileURLToPath(headDirectory));
  const extractor = createFeatureExtractor(backbone);
  const tensorCount = tf.memory().numTensors;
  let correct = 0;
  const cohortCorrect = { "previous-test": 0, "new-holdout": 0 };
  try {
    for (const expected of expectedReport.evaluation) {
      const pixels = await jpegTensor(fileURLToPath(new URL(`../src/assets/samples/optimized/${expected.id}_01.jpg`, import.meta.url)));
      const vector = imageEmbedding(extractor, pixels);
      const output = head.predict(vector);
      assert.ok(!Array.isArray(output));
      const prediction = predictionFromScores(await output.data(), expectedReport.version);
      assert.equal(prediction.category, expected.category);
      assert.ok(Math.abs(prediction.score - expected.score) < 0.000001);
      if (prediction.category === expected.expected) {
        correct++;
        if (expected.testCohort) cohortCorrect[expected.testCohort]++;
      }
      output.dispose();
      vector.dispose();
      pixels.dispose();
    }
    assert.equal(correct, expectedReport.correct);
    if (expectedReport.evaluationGroups) {
      for (const cohort of ["previous-test", "new-holdout"]) {
        assert.equal(cohortCorrect[cohort], expectedReport.evaluationGroups[cohort].correct);
      }
    }
    assert.equal(tf.memory().numTensors, tensorCount, "Inference must dispose temporary tensors");
  } finally {
    head.dispose();
    disposeFeatureModels(backbone, extractor);
  }
}

test("saved model reproduces all 42 held-out pixel predictions and separate cohort scores", async () => {
  await assertSavedPredictions(report, currentHeadDirectory);
});

test("archived model still reproduces its four original held-out predictions", async () => {
  const manifest = JSON.parse(readFileSync(new URL("model.json", previousHeadDirectory), "utf8"));
  const weights = Buffer.concat(manifest.weightsManifest.flatMap((group) => group.paths.map((file) =>
    readFileSync(new URL(file, previousHeadDirectory)))));
  assert.equal(createHash("sha256").update(weights).digest("hex"), previousReport.headSha256);
  await assertSavedPredictions(previousReport, previousHeadDirectory);
});

test("intermediate model still reproduces its eight original held-out predictions", async () => {
  const manifest = JSON.parse(readFileSync(new URL("model.json", intermediateHeadDirectory), "utf8"));
  const weights = Buffer.concat(manifest.weightsManifest.flatMap((group) => group.paths.map((file) =>
    readFileSync(new URL(file, intermediateHeadDirectory)))));
  assert.equal(createHash("sha256").update(weights).digest("hex"), intermediateReport.headSha256);
  await assertSavedPredictions(intermediateReport, intermediateHeadDirectory);
});

test("the last two-class model and all 80 input hashes remain available without relabeling saved analyses", async () => {
  for (const sample of twoClassReport.samples) {
    const current = report.samples.find((item) => item.id === sample.id);
    assert.equal(current.originalSha256, sample.originalSha256);
    assert.equal(current.displaySha256, sample.displaySha256);
  }
  const expected = twoClassReport.evaluation[0];
  const historical = {
    ...analysis(), ...predictionFromScores([expected.scores.pet, expected.scores.cardboard], twoClassVersion),
    sampleId: expected.id,
  };
  const state = saveManualRecord(migrateLegacyData(null), historical.sampleId, 100, historical.category, emptyFactorConfig(), NOW, historical);
  const serialized = serializeOperationalState(state);
  assert.equal(serializeOperationalState(deserializeOperationalState(serialized)), serialized);
  assert.equal(state.records[0].analysis.modelVersion, twoClassVersion);
  assert.equal(Object.hasOwn(state.records[0].analysis.scores, "drywall"), false);
  await assertSavedPredictions(twoClassReport, twoClassDirectory);
});
