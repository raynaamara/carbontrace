import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as tf from "@tensorflow/tfjs";
import jpeg from "jpeg-js";

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function loadLocalLayersModel(directory) {
  const model = JSON.parse(await readFile(path.join(directory, "model.json"), "utf8"));
  if (!Array.isArray(model.weightsManifest) || !model.modelTopology) throw new Error("Invalid model manifest.");
  const weights = [];
  const chunks = [];
  for (const group of model.weightsManifest) {
    weights.push(...group.weights);
    for (const file of group.paths) {
      if (path.basename(file) !== file) throw new Error("Model weight path must remain inside its directory.");
      chunks.push(await readFile(path.join(directory, file)));
    }
  }
  const buffer = Buffer.concat(chunks);
  const weightData = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return tf.loadLayersModel(tf.io.fromMemory({ modelTopology: model.modelTopology, weightSpecs: weights, weightData }));
}

export async function saveLocalLayersModel(model, directory) {
  await mkdir(directory, { recursive: true });
  let digest = "";
  await model.save(tf.io.withSaveHandler(async (artifacts) => {
    if (!(artifacts.weightData instanceof ArrayBuffer) || !artifacts.modelTopology || !artifacts.weightSpecs) {
      throw new Error("Model save did not produce complete weight artifacts.");
    }
    const weights = Buffer.from(artifacts.weightData);
    digest = sha256(weights);
    const filename = `weights-${digest.slice(0, 12)}.bin`;
    await writeFile(path.join(directory, filename), weights);
    await writeFile(path.join(directory, "model.json"), JSON.stringify({
      format: "layers-model",
      generatedBy: `TensorFlow.js ${tf.version.tfjs}`,
      convertedBy: null,
      modelTopology: artifacts.modelTopology,
      weightsManifest: [{ paths: [filename], weights: artifacts.weightSpecs }],
    }));
    return { modelArtifactsInfo: tf.io.getModelArtifactsInfoForJSON(artifacts) };
  }), { includeOptimizer: false });
  return digest;
}

export async function jpegTensor(filename) {
  const image = jpeg.decode(await readFile(filename), { useTArray: true, formatAsRGBA: false });
  if (image.width <= 0 || image.height <= 0 || image.data.length !== image.width * image.height * 3) {
    throw new Error(`Invalid JPEG image: ${filename}`);
  }
  return tf.tensor3d(image.data, [image.height, image.width, 3], "int32");
}
