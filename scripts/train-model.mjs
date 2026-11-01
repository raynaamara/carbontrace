import { constants } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as tf from "@tensorflow/tfjs";
import { DATASET_DECLARATION, DATASET_SPLIT, MODEL_SETTINGS, TRAINING_SAMPLES } from "../src/dataset.ts";
import { imageEmbedding, createFeatureExtractor, disposeFeatureModels } from "../src/ml-core.ts";
import { parseModelInfo, predictionFromScores } from "../src/ai-contract.ts";
import { jpegTensor, loadLocalLayersModel, saveLocalLayersModel, sha256 } from "./model-io.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = path.join(root, "node_modules", ".cache", "carbontrace-mobilenet");
const backboneDirectory = path.join(root, "public", "models", "mobilenet");
const headDirectory = path.join(root, "public", "models", "carbontrace");
const originalDirectory = path.join(root, "src", "assets", "samples");
const displayDirectory = path.join(originalDirectory, "optimized");
const licensePath = path.join(root, "public", "models", "LICENSE.txt");
const reportPath = path.join(headDirectory, "report.json");

async function fileExists(filename) {
  try { return (await stat(filename)).isFile(); }
  catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return false;
  }
}

async function preservePreviousModel(serialized) {
  if (serialized === null) return;
  const previous = JSON.parse(serialized);
  if (!/^ct-mobilenet-[a-f0-9]{12}$/.test(previous.version)
    || !/^[a-f0-9]{64}$/.test(previous.headSha256)
    || previous.version !== `ct-mobilenet-${previous.headSha256.slice(0, 12)}`
    || ![1, 2, 3].includes(previous.schemaVersion)) {
    throw new Error("The previous model report cannot be safely archived.");
  }
  const archive = path.join(headDirectory, previous.version);
  const source = previous.schemaVersion === 1 ? headDirectory : archive;
  const manifest = JSON.parse(await readFile(path.join(source, "model.json"), "utf8"));
  const weightFiles = manifest.weightsManifest.flatMap((group) => group.paths);
  if (weightFiles.length === 0 || weightFiles.some((file) => path.basename(file) !== file)) {
    throw new Error("The previous model contains unsafe weight paths.");
  }
  const weights = Buffer.concat(await Promise.all(weightFiles.map((file) => readFile(path.join(source, file)))));
  if (sha256(weights) !== previous.headSha256) throw new Error("The previous model weights do not match its report.");
  if (source === archive) return;
  await mkdir(archive, { recursive: true });
  for (const filename of ["model.json", ...weightFiles, "report.json"]) {
    const bytes = filename === "report.json" ? Buffer.from(serialized) : await readFile(path.join(source, filename));
    const destination = path.join(archive, filename);
    if (await fileExists(destination)) {
      if (sha256(await readFile(destination)) !== sha256(bytes)) throw new Error("An existing model archive differs; publication stopped.");
    } else if (filename === "report.json") {
      await writeFile(destination, bytes, { flag: "wx" });
    } else {
      await copyFile(path.join(source, filename), destination, constants.COPYFILE_EXCL);
    }
  }
  console.log(`Preserved previous model: ${previous.version}`);
}

async function publishHead(staging, report, previousSerialized) {
  const current = await fileExists(reportPath) ? await readFile(reportPath, "utf8") : null;
  if (current !== previousSerialized) throw new Error("The active model changed during training; publication stopped.");
  await preservePreviousModel(previousSerialized);
  const directory = path.join(headDirectory, report.version);
  await writeFile(path.join(staging, "report.json"), JSON.stringify(report, null, 2));
  let published = report;
  let activeReport = path.join(staging, "active-report.json");
  if (await fileExists(path.join(directory, "report.json"))) {
    const existing = JSON.parse(await readFile(path.join(directory, "report.json"), "utf8"));
    if (JSON.stringify({ ...existing, trainedAt: report.trainedAt }) !== JSON.stringify(report)) {
      throw new Error("This model version already exists with different dataset or evaluation metadata.");
    }
    const manifest = JSON.parse(await readFile(path.join(staging, "model.json"), "utf8"));
    for (const filename of ["model.json", ...manifest.weightsManifest.flatMap((group) => group.paths)]) {
      if (sha256(await readFile(path.join(directory, filename))) !== sha256(await readFile(path.join(staging, filename)))) {
        throw new Error("An existing versioned model artifact differs; publication stopped.");
      }
    }
    published = existing;
    await writeFile(activeReport, JSON.stringify(published, null, 2));
  } else {
    await writeFile(activeReport, JSON.stringify(report, null, 2));
    await rename(staging, directory);
    activeReport = path.join(directory, "active-report.json");
  }
  await rename(activeReport, reportPath);
  return published;
}

async function prepareBackbone() {
  await mkdir(cache, { recursive: true });
  if (!await fileExists(licensePath)) {
    const response = await fetch("https://www.apache.org/licenses/LICENSE-2.0.txt");
    if (!response.ok) throw new Error(`Model license download failed: HTTP ${response.status}`);
    const license = await response.text();
    if (!license.includes("Apache License")) throw new Error("The model license response is not valid.");
    await mkdir(path.dirname(licensePath), { recursive: true });
    await writeFile(licensePath, license);
  }
  if (await fileExists(path.join(backboneDirectory, "model.json"))) {
    console.log("Reusing the existing local MobileNet backbone; only the classifier head is retrained.");
    return loadLocalLayersModel(backboneDirectory);
  }
  const modelPath = path.join(cache, "model.json");
  if (!await fileExists(modelPath)) {
    console.log("Downloading the public MobileNet checkpoint (no user images are uploaded).");
    const response = await fetch(MODEL_SETTINGS.backboneUrl);
    if (!response.ok) throw new Error(`Backbone download failed: HTTP ${response.status}`);
    const model = await response.json();
    if (!model.modelTopology || !Array.isArray(model.weightsManifest)) throw new Error("Backbone response is not a valid layers model.");
    await writeFile(modelPath, JSON.stringify(model));
  }
  const model = JSON.parse(await readFile(modelPath, "utf8"));
  const files = model.weightsManifest.flatMap((group) => group.paths);
  for (let offset = 0; offset < files.length; offset += 4) {
    await Promise.all(files.slice(offset, offset + 4).map(async (file) => {
      if (path.basename(file) !== file) throw new Error("Unsafe backbone manifest path.");
      const destination = path.join(cache, file);
      if (await fileExists(destination)) return;
      const response = await fetch(new URL(file, MODEL_SETTINGS.backboneUrl));
      if (!response.ok) throw new Error(`Backbone weight download failed: ${file} HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength === 0) throw new Error(`Empty backbone weight file: ${file}`);
      await writeFile(destination, bytes);
    }));
  }
  return loadLocalLayersModel(cache);
}

if (!await tf.setBackend("cpu")) throw new Error("TensorFlow.js CPU backend is unavailable.");
await tf.ready();
const samples = [];
const hashes = new Set();
const displayHashes = new Set();
const previousSerialized = await fileExists(reportPath) ? await readFile(reportPath, "utf8") : null;
for (const sample of TRAINING_SAMPLES) {
  const original = await readFile(path.join(originalDirectory, sample.imageFile));
  const display = await readFile(path.join(displayDirectory, `${sample.id}_01.jpg`));
  const originalSha256 = sha256(original);
  const displaySha256 = sha256(display);
  if (hashes.has(originalSha256)) throw new Error(`Duplicate source image detected: ${sample.id}`);
  if (displayHashes.has(displaySha256)) throw new Error(`Duplicate prepared image detected: ${sample.id}`);
  hashes.add(originalSha256);
  displayHashes.add(displaySha256);
  samples.push({ ...sample, originalSha256, displaySha256 });
}
const training = samples.filter((sample) => sample.role === "train");
const testing = samples.filter((sample) => sample.role === "test");
if (training.length !== 78 || testing.length !== 42) throw new Error("Expected 78 training, 28 previously tested PET/cardboard and 14 new drywall holdout IDs.");
if (new Set([...training, ...testing].map((sample) => sample.id)).size !== 120) throw new Error("Dataset IDs overlap.");
for (const [cohort, expected] of [["previous-test", 28], ["new-holdout", 14]]) {
  if (testing.filter((sample) => sample.testCohort === cohort).length !== expected) {
    throw new Error(`Expected ${expected} evaluation images in ${cohort}.`);
  }
}

const backbone = await prepareBackbone();
const backboneSha256 = await saveLocalLayersModel(backbone, backboneDirectory);
const extractor = createFeatureExtractor(backbone);
const vectors = [];
const labels = [];
console.log(`Extracting features from ${training.length} training images; held-out images are excluded.`);
for (const sample of training) {
  const pixels = await jpegTensor(path.join(displayDirectory, `${sample.id}_01.jpg`));
  for (const variant of ["original", "flip", "dark", "bright"]) {
    const input = tf.tidy(() => {
      if (variant === "flip") return pixels.reverse(1);
      if (variant === "dark") return pixels.toFloat().mul(0.9).clipByValue(0, 255);
      if (variant === "bright") return pixels.toFloat().mul(1.1).clipByValue(0, 255);
      return pixels.clone();
    });
    const vector = imageEmbedding(extractor, input);
    vectors.push(Array.from(await vector.data()));
    labels.push(MODEL_SETTINGS.labels.map((material) => material === sample.material ? 1 : 0));
    vector.dispose();
    input.dispose();
  }
  pixels.dispose();
}
const featureSize = vectors[0].length;
const inputs = tf.tensor2d(vectors);
const targets = tf.tensor2d(labels);
const head = tf.sequential({ name: "carbontrace_material_classifier" });
head.add(tf.layers.dense({
  name: "material_head",
  inputShape: [featureSize],
  units: MODEL_SETTINGS.labels.length,
  activation: "softmax",
  kernelInitializer: tf.initializers.glorotUniform({ seed: MODEL_SETTINGS.seed }),
  kernelRegularizer: tf.regularizers.l2({ l2: MODEL_SETTINGS.l2 }),
}));
head.compile({ optimizer: tf.train.adam(MODEL_SETTINGS.learningRate), loss: "categoricalCrossentropy", metrics: ["accuracy"] });
console.log(`Training ${head.countParams()} parameters on ${training.length} source photos / ${vectors.length} augmented feature vectors.`);
const history = await head.fit(inputs, targets, {
  epochs: MODEL_SETTINGS.epochs,
  batchSize: vectors.length,
  shuffle: false,
  verbose: 0,
  callbacks: { onEpochEnd: (epoch, logs) => {
    if ((epoch + 1) % 50 === 0) console.log(`Epoch ${epoch + 1}: loss=${logs.loss.toFixed(6)}`);
  } },
});
inputs.dispose();
targets.dispose();
const staging = await mkdtemp(path.join(cache, "head-"));
try {
  const headSha256 = await saveLocalLayersModel(head, staging);
  const version = `ct-mobilenet-${headSha256.slice(0, 12)}`;
  console.log("Evaluating 42 held-out images: 28 PET/cardboard regressions and 14 newly held-out drywall photos; no tuning.");
  const evaluation = [];
  const confusion = Object.fromEntries(MODEL_SETTINGS.labels.map((actual) =>
    [actual, Object.fromEntries(MODEL_SETTINGS.labels.map((predicted) => [predicted, 0]))]));
  for (const sample of testing) {
    const pixels = await jpegTensor(path.join(displayDirectory, `${sample.id}_01.jpg`));
    const vector = imageEmbedding(extractor, pixels);
    const output = head.predict(vector);
    if (Array.isArray(output)) throw new Error("Classifier returned more than one output.");
    const prediction = predictionFromScores(await output.data(), version);
    evaluation.push({ id: sample.id, expected: sample.material, testCohort: sample.testCohort, ...prediction });
    confusion[sample.material][prediction.category]++;
    output.dispose();
    vector.dispose();
    pixels.dispose();
  }
  const summarize = (cohort) => {
    const results = evaluation.filter((result) => result.testCohort === cohort);
    const expected = testing.filter((sample) => sample.testCohort === cohort).length;
    if (results.length !== expected || expected === 0) throw new Error(`Incomplete evaluation in ${cohort}.`);
    const correct = results.filter((result) => result.expected === result.category).length;
    return { ids: results.map((result) => result.id), correct, accuracy: correct / results.length };
  };
  const correct = evaluation.filter((result) => result.expected === result.category).length;
  const report = {
    schemaVersion: 3,
    version,
    labels: MODEL_SETTINGS.labels,
    trainedAt: new Date().toISOString(),
    featureSize,
    trainIds: training.map((sample) => sample.id),
    testIds: testing.map((sample) => sample.id),
    correct,
    accuracy: correct / testing.length,
    evaluationGroups: {
      "previous-test": summarize("previous-test"),
      "new-holdout": summarize("new-holdout"),
    },
    headSha256,
    backboneSha256,
    sourceDeclaration: DATASET_DECLARATION.statement,
    independentlyVerified: false,
    declaration: DATASET_DECLARATION,
    datasetSplit: DATASET_SPLIT,
    architecture: "Frozen ImageNet MobileNetV1 0.25 + global average pooling + L2-normalized features + trained three-class softmax head",
    preprocessing: "RGB, bilinear 224x224 with aligned corners, pixel / 127.5 - 1, global average pooling, L2 normalization",
    training: {
      ...MODEL_SETTINGS,
      trainableParameters: head.countParams(),
      sourceImages: training.length,
      augmentedExamples: vectors.length,
      variants: ["original", "horizontal flip", "brightness x0.9", "brightness x1.1"],
      shuffle: false,
      lastLoss: Number(history.history.loss.at(-1)),
      validationSet: "No separate validation set; hyperparameters retained from the previous model, without tuning against either held-out cohort. The previous-test cohort had already been evaluated before this update.",
    },
    samples,
    confusion,
    evaluation,
    limitations: [
      "Only 120 user-supplied source photos; all 14 new holdouts are drywall, while all 28 PET/cardboard test photos have previously been evaluated.",
      "The balanced 42-image combined confusion matrix mixes new and regression evidence; it is not 42 newly unseen test objects.",
      "The new cohort contains no PET/cardboard reference images and cannot establish full three-class precision or general accuracy.",
      "Sample independence, physical material labels and photo origin are user declarations, not independently verified.",
      "The classifier only compares PET-bottle, cardboard and paper-faced drywall classes; unrelated objects or cement board can receive a misleading high score.",
      "Model scores are not calibrated probabilities or measured accuracy on real-world deployment.",
      "Material confirmation, physical weight measurement and sourced carbon factors remain separate requirements.",
    ],
    attribution: {
      checkpoint: MODEL_SETTINGS.backboneUrl,
      example: "https://github.com/tensorflow/tfjs-examples/tree/master/webcam-transfer-learning",
      framework: "TensorFlow.js 4.22.0",
      license: "Apache-2.0 (TensorFlow.js / MobileNet checkpoint sources)",
    },
  };
  parseModelInfo(report);
  const published = await publishHead(staging, report, previousSerialized);
  await writeFile(path.join(backboneDirectory, "SOURCE.txt"),
    `MobileNetV1 0.25 pretrained ImageNet checkpoint\nSource: ${MODEL_SETTINGS.backboneUrl}\nReference: https://github.com/tensorflow/tfjs-examples/tree/master/webcam-transfer-learning\nLicense: Apache-2.0\nImages from CarbonTrace are not uploaded to this source.\n`);
  console.log(JSON.stringify({
    version, featureSize, trainingPhotos: training.length, heldOutPhotos: testing.length,
    correct, evaluationGroups: published.evaluationGroups,
    results: evaluation.map(({ id, expected, category, score, testCohort }) => ({ id, expected, category, score, testCohort })),
    report: "public/models/carbontrace/report.json",
  }, null, 2));
} finally {
  await rm(staging, { recursive: true, force: true });
  head.optimizer.dispose();
  head.dispose();
  disposeFeatureModels(backbone, extractor);
}
