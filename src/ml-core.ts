import * as tf from "@tensorflow/tfjs";
import { MODEL_SETTINGS } from "./dataset.ts";

export function createFeatureExtractor(backbone: tf.LayersModel): tf.LayersModel {
  const output = backbone.getLayer(MODEL_SETTINGS.featureLayer).output;
  if (Array.isArray(output)) throw new Error("Layer fitur backbone harus memiliki satu keluaran.");
  const pooled = tf.layers.globalAveragePooling2d({ name: "carbontrace_feature_pool" }).apply(output);
  if (!(pooled instanceof tf.SymbolicTensor)) throw new Error("Keluaran fitur backbone tidak valid.");
  const extractor = tf.model({ inputs: backbone.inputs, outputs: pooled, name: "carbontrace_features" });
  extractor.trainable = false;
  return extractor;
}

export function imageEmbedding(extractor: tf.LayersModel, pixels: tf.Tensor3D): tf.Tensor2D {
  return tf.tidy(() => {
    const input = tf.image.resizeBilinear(pixels, [MODEL_SETTINGS.imageSize, MODEL_SETTINGS.imageSize], true)
      .toFloat().div(127.5).sub(1).expandDims(0);
    const features = extractor.predict(input);
    if (Array.isArray(features) || features.rank !== 2 || features.shape[0] !== 1 || features.shape[1] === undefined) {
      throw new Error("Dimensi fitur gambar tidak sesuai.");
    }

    const vector = features.as2D(1, features.shape[1]);
    return vector.div(vector.norm("euclidean", 1, true).add(1e-8)).as2D(1, features.shape[1]);
  });
}

export function disposeFeatureModels(backbone: tf.LayersModel, extractor: tf.LayersModel): void {
  // The extractor shares layer objects with the backbone.
  const sharedLayers = new Set(extractor.layers);
  for (const layer of backbone.layers) {
    if (!sharedLayers.has(layer)) layer.dispose();
  }
  extractor.dispose();
}
