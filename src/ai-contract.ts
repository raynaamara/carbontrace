import { MATERIALS, getSample, isIsoDate, isMaterial, isObject, ValidationError } from "./model.ts";
import type { Material } from "./model.ts";
import { TRAINING_SAMPLES } from "./dataset.ts";
import type { EvaluationCohort } from "./dataset.ts";
import { isUploadedPhotoId } from "./photos.ts";

export interface ImagePrediction {
  category: Material;
  score: number;
  scores: { pet: number; cardboard: number; drywall?: number };
  modelVersion: string;
}

export interface ModelAnalysis extends ImagePrediction {
  sampleId: string;
  inputSha256: string;
  analyzedAt: string;
  source: "trained-model";
}

export interface EvaluationSummary {
  ids: string[];
  correct: number;
  accuracy: number;
}

export interface ModelInfo {
  version: string;
  trainedAt: string;
  featureSize: number;
  labels: readonly Material[];
  trainIds: string[];
  testIds: string[];
  correct: number;
  accuracy: number;
  headSha256: string;
  backboneSha256: string;
  sourceDeclaration: string;
  evaluationGroups: Record<EvaluationCohort, EvaluationSummary>;
}

const modelVersionPattern = /^ct-mobilenet-[a-f0-9]{12}$/;
const hashPattern = /^[a-f0-9]{64}$/;
export const LEGACY_MODEL_VERSIONS = [
  "ct-mobilenet-4aa1cd74741b", "ct-mobilenet-b090d45c6b58", "ct-mobilenet-414f2c4df422",
] as const;

export function predictionFromScores(values: ArrayLike<number>, version: string): ImagePrediction {
  const legacy = LEGACY_MODEL_VERSIONS.some((candidate) => candidate === version);
  if (!modelVersionPattern.test(version) || values.length !== (legacy ? 2 : 3)) throw new ValidationError("Identitas atau keluaran model tidak valid.");
  const pet = values[0];
  const cardboard = values[1];
  const scores = legacy ? { pet, cardboard } : { pet, cardboard, drywall: values[2] };
  const allScores = Object.values(scores);
  if (!allScores.every((score) => Number.isFinite(score) && score >= 0 && score <= 1)
    || Math.abs(allScores.reduce((sum, score) => sum + score, 0) - 1) > 0.001) {
    throw new ValidationError("Model tidak menghasilkan distribusi skor yang valid.");
  }
  let category: Material = pet >= cardboard ? "pet" : "cardboard";
  if (typeof scores.drywall === "number" && scores.drywall > scores[category]) category = "drywall";
  return { category, score: category === "drywall" ? values[2] : scores[category], scores, modelVersion: version };
}

export function validateModelAnalysis(value: unknown): asserts value is ModelAnalysis {
  if (!isObject(value) || !isMaterial(value.category) || !isObject(value.scores)
    || typeof value.scores.pet !== "number" || typeof value.scores.cardboard !== "number"
    || typeof value.score !== "number" || typeof value.modelVersion !== "string"
    || typeof value.sampleId !== "string" || typeof value.inputSha256 !== "string"
    || !hashPattern.test(value.inputSha256) || !isIsoDate(value.analyzedAt)
    || value.source !== "trained-model") {
    throw new ValidationError("Catatan analisis AI tidak valid.");
  }
  if (!isUploadedPhotoId(value.sampleId)) getSample(value.sampleId);
  const legacy = LEGACY_MODEL_VERSIONS.some((version) => version === value.modelVersion);
  if (Object.keys(value.scores).length !== (legacy ? 2 : 3)
    || (legacy ? value.scores.drywall !== undefined : typeof value.scores.drywall !== "number")) {
    throw new ValidationError("Catatan analisis AI tidak valid.");
  }
  const values = typeof value.scores.drywall === "number"
    ? [value.scores.pet, value.scores.cardboard, value.scores.drywall]
    : [value.scores.pet, value.scores.cardboard];
  const prediction = predictionFromScores(values, value.modelVersion);
  if (prediction.category !== value.category || Math.abs(prediction.score - value.score) > 0.000001) {
    throw new ValidationError("Kategori dan skor analisis AI tidak konsisten.");
  }
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function hasExactIds(actual: string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && new Set(actual).size === actual.length
    && expected.every((id) => actual.includes(id));
}

function readEvaluationSummary(value: unknown, expectedIds: readonly string[]): EvaluationSummary {
  if (!isObject(value) || !isStringList(value.ids) || !hasExactIds(value.ids, expectedIds)
    || typeof value.correct !== "number" || !Number.isInteger(value.correct)
    || value.correct < 0 || value.correct > expectedIds.length
    || typeof value.accuracy !== "number" || !Number.isFinite(value.accuracy)
    || Math.abs(value.accuracy - value.correct / expectedIds.length) > 0.000001) {
    throw new ValidationError("Hasil uji baru atau regresi lama tidak sesuai pembagian dataset.");
  }
  return { ids: [...value.ids], correct: value.correct, accuracy: value.accuracy };
}

export function parseModelInfo(value: unknown): ModelInfo {
  if (!isObject(value) || value.schemaVersion !== 3 || typeof value.version !== "string"
    || !modelVersionPattern.test(value.version) || !isIsoDate(value.trainedAt)
    || typeof value.featureSize !== "number" || !Number.isInteger(value.featureSize) || value.featureSize <= 0
    || !isStringList(value.trainIds) || !isStringList(value.testIds)
    || value.trainIds.length === 0 || value.testIds.length === 0
    || typeof value.correct !== "number" || !Number.isInteger(value.correct)
    || value.correct < 0 || value.correct > value.testIds.length
    || typeof value.accuracy !== "number" || !Number.isFinite(value.accuracy)
    || Math.abs(value.accuracy - value.correct / value.testIds.length) > 0.000001
    || typeof value.headSha256 !== "string" || !hashPattern.test(value.headSha256)
    || typeof value.backboneSha256 !== "string" || !hashPattern.test(value.backboneSha256)
    || typeof value.sourceDeclaration !== "string" || value.sourceDeclaration.trim() === ""
    || value.independentlyVerified !== false || !isObject(value.evaluationGroups)
    || !isStringList(value.labels) || value.labels.length !== MATERIALS.length
    || value.labels.join("|") !== MATERIALS.join("|")) {
    throw new ValidationError("Metadata model tidak lengkap atau tidak valid. Jalankan ulang pelatihan.");
  }
  const expectedTrain = TRAINING_SAMPLES.filter((sample) => sample.role === "train").map((sample) => sample.id);
  const expectedTest = TRAINING_SAMPLES.filter((sample) => sample.role === "test").map((sample) => sample.id);
  if (!hasExactIds(value.trainIds, expectedTrain) || !hasExactIds(value.testIds, expectedTest)
    || value.version !== `ct-mobilenet-${value.headSha256.slice(0, 12)}`) {
    throw new ValidationError("Pembagian dataset atau versi model tidak sesuai dengan katalog.");
  }
  const expectedCohortIds = (cohort: EvaluationCohort) => TRAINING_SAMPLES
    .filter((sample) => sample.testCohort === cohort).map((sample) => sample.id);
  const evaluationGroups = {
    "previous-test": readEvaluationSummary(value.evaluationGroups["previous-test"], expectedCohortIds("previous-test")),
    "new-holdout": readEvaluationSummary(value.evaluationGroups["new-holdout"], expectedCohortIds("new-holdout")),
  };
  if (evaluationGroups["previous-test"].correct + evaluationGroups["new-holdout"].correct !== value.correct) {
    throw new ValidationError("Jumlah hasil uji lama dan uji baru tidak sesuai dengan hasil keseluruhan.");
  }
  return {
    version: value.version, trainedAt: value.trainedAt, featureSize: value.featureSize, labels: [...MATERIALS],
    trainIds: value.trainIds, testIds: value.testIds,
    correct: value.correct, accuracy: value.accuracy,
    headSha256: value.headSha256, backboneSha256: value.backboneSha256,
    sourceDeclaration: value.sourceDeclaration,
    evaluationGroups,
  };
}
