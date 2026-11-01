import * as tf from "@tensorflow/tfjs";
import { parseModelInfo, predictionFromScores } from "./ai-contract.ts";
import type { ImagePrediction, ModelInfo } from "./ai-contract.ts";
import { createFeatureExtractor, disposeFeatureModels, imageEmbedding } from "./ml-core.ts";

export interface PixelPrediction extends ImagePrediction {
  inputSha256: string;
}

export interface ImageClassifier {
  info: ModelInfo;
  predict(image: HTMLImageElement): Promise<PixelPrediction>;
}

export async function loadClassifier(): Promise<ImageClassifier> {
  if (!await tf.setBackend("cpu")) throw new Error("Backend AI lokal tidak tersedia pada browser ini.");
  await tf.ready();
  const root = import.meta.env.BASE_URL;
  const response = await fetch(`${root}models/carbontrace/report.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Metadata model gagal dimuat (HTTP ${response.status}).`);
  const metadata: unknown = await response.json();
  const info = parseModelInfo(metadata);
  let backbone: tf.LayersModel | null = null;
  let head: tf.LayersModel | null = null;
  let extractor: tf.LayersModel | null = null;
  let ready = false;
  try {
    backbone = await tf.loadLayersModel(`${root}models/mobilenet/model.json?v=${info.backboneSha256.slice(0, 12)}`);
    head = await tf.loadLayersModel(`${root}models/carbontrace/${info.version}/model.json`);
    extractor = createFeatureExtractor(backbone);
    if (extractor.outputs[0].shape[1] !== info.featureSize
      || head.inputs[0].shape[1] !== info.featureSize
      || head.outputs[0].shape[1] !== info.labels.length) {
      throw new Error("Dimensi artefak model tidak sesuai dengan metadata pelatihan.");
    }
    const featureModel = extractor;
    const classifierHead = head;
    ready = true;
    return {
      info,
      async predict(image) {
        if (typeof crypto === "undefined" || !crypto.subtle) {
          throw new Error("Analisis dengan sidik foto memerlukan HTTPS atau localhost.");
        }
        if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
          throw new Error("Foto belum selesai dimuat. Tunggu gambar tampil lalu coba lagi.");
        }
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context === null) throw new Error("Browser tidak menyediakan pemrosesan gambar.");
        context.drawImage(image, 0, 0);
        const pixels = tf.browser.fromPixels(canvas, 3);
        let features: tf.Tensor2D | null = null;
        let output: tf.Tensor | tf.Tensor[] | null = null;
        try {
          features = imageEmbedding(featureModel, pixels);
          output = classifierHead.predict(features);
          if (Array.isArray(output) || output.shape[0] !== 1 || output.shape[1] !== info.labels.length) {
            throw new Error("Keluaran classifier tidak sesuai.");
          }
          const scores = await output.data();
          if (!(scores instanceof Float32Array)) throw new Error("Tipe skor model tidak sesuai.");
          const prediction = predictionFromScores(scores, info.version);
          const rgb = await pixels.data();
          if (!(rgb instanceof Int32Array)) throw new Error("Tipe piksel foto tidak sesuai.");
          const bytes = new Uint8Array(8 + rgb.length);
          const dimensions = new DataView(bytes.buffer);
          dimensions.setUint32(0, pixels.shape[1], true);
          dimensions.setUint32(4, pixels.shape[0], true);
          for (let index = 0; index < rgb.length; index++) bytes[index + 8] = rgb[index];
          const digest = await crypto.subtle.digest("SHA-256", bytes);
          const inputSha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
          return { ...prediction, inputSha256 };
        } finally {
          pixels.dispose();
          features?.dispose();
          if (Array.isArray(output)) output.forEach((tensor) => tensor.dispose());
          else output?.dispose();
        }
      },
    };
  } finally {
    if (!ready) {
      head?.dispose();
      if (extractor !== null && backbone !== null) disposeFeatureModels(backbone, extractor);
      else backbone?.dispose();
    }
  }
}
