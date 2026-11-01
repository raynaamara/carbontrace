import type { Material } from "./model.ts";

export type EvaluationCohort = "previous-test" | "new-holdout";

export interface DatasetSample {
  id: string;
  material: Material;
  imageFile: string;
  role: "train" | "test";
  testCohort: EvaluationCohort | null;
}

export const DATASET_DECLARATION = {
  source: "user-provided-photographs",
  statement: "Pengguna menyatakan bahwa 120 foto dataset adalah foto barang nyata dengan objek berbeda antar-ID. Tambahan 40 foto drywall dan CT-009 sampai CT-012 dinyatakan sebagai papan gipsum berlapis kertas dengan objek berbeda, bukan papan semen. Deklarasi bahan, asal, dan independensi belum diverifikasi.",
  independentlyVerified: false,
  declaredDate: "2026-10-26",
};

const newTrainingNumbers: Readonly<Record<Material, readonly number[]>> = {
  pet: [21, 24, 25, 26, 27, 29, 35, 37, 38, 39],
  cardboard: [25, 26, 27, 32, 33, 35, 37, 38, 39, 40],
  drywall: [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 15, 17, 18, 19, 20, 26, 28, 32, 33, 34, 35, 36, 37, 39],
};

export const DATASET_SPLIT = {
  seed: 20261026,
  method: "Preserve all 52 PET/cardboard training IDs and 28 test IDs; all their tests are now regression. Rank drywall IDs 001-040 by SHA-256 of 20261026:<sample-id>; first 26 train, remaining 14 new holdouts.",
  previousSplitSeed: 20261025,
  newTrainingNumbers,
};

export const TRAINING_SAMPLES: readonly DatasetSample[] = (["pet", "cardboard", "drywall"] as const).flatMap((material) =>
  Array.from({ length: 40 }, (_, index): DatasetSample => {
    const number = index + 1;
    const id = `SYN-${material === "pet" ? "PET" : material === "cardboard" ? "CRD" : "DRYWALL"}-${String(number).padStart(3, "0")}`;
    const isTraining = material === "drywall" ? newTrainingNumbers.drywall.includes(number) : number <= 20
      ? number <= 8 || (number >= 11 && number <= 18)
      : newTrainingNumbers[material].includes(number);
    const role = isTraining ? "train" : "test";
    return {
      id, material, imageFile: `${id}.png`, role,
      testCohort: role === "train" ? null : material === "drywall" ? "new-holdout" : "previous-test",
    };
  }),
);

export const MODEL_SETTINGS = {
  backboneUrl: "https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json",
  featureLayer: "conv_pw_13_relu",
  imageSize: 224,
  epochs: 200,
  learningRate: 0.03,
  l2: 0.001,
  seed: 20261024,
  labels: ["pet", "cardboard", "drywall"] as const,
};
