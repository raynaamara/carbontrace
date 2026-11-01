import type { EvaluationCohort } from "./dataset.ts";

export const MATERIALS = ["pet", "cardboard", "drywall"] as const;
export type Material = typeof MATERIALS[number];
type LegacyMaterial = "pet" | "cardboard";
export type RecordStatus = "all" | "confirmed" | "pending";

export interface DemoSample {
  id: string;
  name: string;
  description: string;
  material: LegacyMaterial;
  weightGrams: number;
  prediction: LegacyMaterial;
  score: number;
  imageFile: string;
}

export interface CatalogSample {
  id: string;
  name: string;
  description: string;
  material: Material;
  imageFile: string;
  role: "train" | "test" | "outside";
  testCohort?: EvaluationCohort | null;
}

export interface FactorSnapshot {
  baseline: number;
  alternative: number;
  version: "dummy-v1";
}

export interface SampleRecord {
  sampleId: string;
  weightGrams: number;
  prediction: { category: LegacyMaterial; score: number };
  confirmedCategory: LegacyMaterial | null;
  factors: FactorSnapshot | null;
  source: "dummy";
  createdAt: string;
  updatedAt: string;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const STORAGE_KEY = "carbontrace.demo.v1";
export const MATERIAL_LABELS: Readonly<Record<Material, string>> = {
  pet: "Botol PET",
  cardboard: "Kardus",
  drywall: "Papan gipsum",
};

export const DEMO_FACTORS = Object.freeze({
  pet: Object.freeze({ baseline: 3, alternative: 1 }),
  cardboard: Object.freeze({ baseline: 1.5, alternative: 0.5 }),
});

export const DEMO_SAMPLES: readonly DemoSample[] = [
  { id: "CT-001", name: "Botol minuman kecil", description: "Foto pengguna untuk kategori referensi PET. Jenis bahan dan ukuran belum diverifikasi.", material: "pet", weightGrams: 24, prediction: "pet", score: 0.96, imageFile: "CT-001_01.png" },
  { id: "CT-002", name: "Botol air mineral", description: "Foto pengguna untuk kategori referensi PET. Kode resin perlu dikonfirmasi dari kemasan.", material: "pet", weightGrams: 32, prediction: "pet", score: 0.91, imageFile: "CT-002_01.png" },
  { id: "CT-003", name: "Kotak pengiriman kecil", description: "Foto pengguna untuk kategori referensi kardus. Bahan dan kondisi kemasan belum diverifikasi.", material: "cardboard", weightGrams: 180, prediction: "cardboard", score: 0.93, imageFile: "CT-003_01.png" },
  { id: "CT-004", name: "Kardus bergelombang tipis", description: "Foto pengguna untuk kategori referensi kardus. Jenis bahan perlu dikonfirmasi secara terpisah.", material: "cardboard", weightGrams: 95, prediction: "cardboard", score: 0.88, imageFile: "CT-004_01.png" },
  { id: "CT-005", name: "Kardus pipih", description: "Foto kardus pipih dari pengguna. Periksa jenis bahan pada kemasan sebelum mencatat material.", material: "cardboard", weightGrams: 68, prediction: "pet", score: 0.58, imageFile: "CT-005_01.png" },
  { id: "CT-006", name: "Botol tanpa label", description: "Foto botol tanpa label. Kode resin perlu diperiksa pada benda fisik sebelum menetapkan kategori.", material: "pet", weightGrams: 30, prediction: "pet", score: 0.66, imageFile: "CT-006_01.png" },
  { id: "CT-007", name: "Botol kemasan besar", description: "Foto pengguna untuk kategori referensi PET. Berat dan ukuran fisik belum diukur oleh aplikasi.", material: "pet", weightGrams: 42, prediction: "pet", score: 0.94, imageFile: "CT-007_01.png" },
  { id: "CT-008", name: "Kotak kardus sedang", description: "Foto pengguna untuk kategori referensi kardus. Berat dan pengolahan aktual belum diverifikasi.", material: "cardboard", weightGrams: 240, prediction: "cardboard", score: 0.92, imageFile: "CT-008_01.png" },
];

export const CATALOG_SAMPLES: readonly CatalogSample[] = [
  ...DEMO_SAMPLES.map((sample): CatalogSample => ({
    id: sample.id, name: sample.name, description: sample.description,
    material: sample.material, imageFile: sample.imageFile, role: "outside",
  })),
  ...[9, 10, 11, 12].map((number): CatalogSample => {
    const id = `CT-${String(number).padStart(3, "0")}`;
    return {
      id, name: `Papan gipsum ${String(number).padStart(3, "0")}`,
      description: "Foto eksplorasi papan gipsum berlapis kertas dari pengguna. Bahan dan kondisi belum diverifikasi; jangan samakan dengan papan semen atau semua puing bangunan.",
      material: "drywall", imageFile: `${id}_01.png`, role: "outside",
    };
  }),
  ...TRAINING_SAMPLES.map((sample): CatalogSample => ({
    ...sample,
    name: `${MATERIAL_LABELS[sample.material]} ${sample.id.slice(-3)}`,
    description: `Foto dataset pengguna, kelompok ${sample.role === "train" ? "latih" : sample.testCohort === "previous-test" ? "uji lama/regresi" : "uji baru"}. Label material dan asal foto belum diverifikasi independen.`,
  })),
];

export function sortCatalogSamples(samples: readonly CatalogSample[]): CatalogSample[] {
  return [...samples].sort((left, right) =>
    left.imageFile.localeCompare(right.imageFile, "en")
    || left.id.localeCompare(right.id, "en"));
}

export function isMaterial(value: unknown): value is Material {
  return isLegacyMaterial(value) || value === "drywall";
}

function isLegacyMaterial(value: unknown): value is LegacyMaterial {
  return value === "pet" || value === "cardboard";
}

export function getSample(id: string): CatalogSample {
  const sample = CATALOG_SAMPLES.find((item) => item.id === id);
  if (!sample) throw new ValidationError("Sampel tidak dikenal.");
  return sample;
}

export function parseWeight(value: string): number {
  const trimmed = value.trim();
  if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(trimmed)) {
    throw new ValidationError("Masukkan berat dalam gram, misalnya 24 atau 24,5. Jangan gunakan pemisah ribuan.");
  }
  const weight = Number(trimmed.replace(",", "."));
  assertWeight(weight);
  return weight;
}

export function assertWeight(weight: unknown): asserts weight is number {
  if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) {
    throw new ValidationError("Berat harus berupa angka lebih dari 0 gram.");
  }
}

function assertFactors(factors: { baseline: number; alternative: number }): void {
  if (![factors.baseline, factors.alternative].every((value) => Number.isFinite(value))) {
    throw new ValidationError("Faktor skenario harus berupa angka hingga.");
  }
}

export function calculateScenarioDetails(weightGrams: number, factors: { baseline: number; alternative: number }) {
  assertWeight(weightGrams);
  assertFactors(factors);
  const massKg = weightGrams / 1000;
  const baselineKg = massKg * factors.baseline;
  const alternativeKg = massKg * factors.alternative;
  const differenceKg = massKg * (factors.baseline - factors.alternative);
  if (![massKg, baselineKg, alternativeKg, differenceKg].every(Number.isFinite)) {
    throw new ValidationError("Hasil perhitungan di luar rentang angka yang didukung.");
  }
  return { massKg, baselineKg, alternativeKg, differenceKg };
}

export type ScenarioComparison = "alternative-lower" | "baseline-lower" | "equal";

export function compareScenario(weightGrams: number, factors: { baseline: number; alternative: number }) {
  const parts = calculateScenarioDetails(weightGrams, factors);
  const comparison: ScenarioComparison = parts.differenceKg > 0 ? "alternative-lower"
    : parts.differenceKg < 0 ? "baseline-lower" : "equal";
  return {
    ...parts,
    comparison,
    hasNegativeNet: parts.baselineKg < 0 || parts.alternativeKg < 0,
  };
}

export function calculateScenario(weightGrams: number, factors: { baseline: number; alternative: number }): number {
  return calculateScenarioDetails(weightGrams, factors).differenceKg;
}

export function recordImpact(record: SampleRecord): number | null {
  if (record.confirmedCategory === null) return null;
  if (record.factors === null) throw new ValidationError("Catatan yang dikonfirmasi harus memiliki faktor skenario.");
  return calculateScenario(record.weightGrams, record.factors);
}

function factorSnapshot(category: LegacyMaterial): FactorSnapshot {
  return { ...DEMO_FACTORS[category], version: "dummy-v1" };
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return false;
  return new Date(value).toISOString() === value;
}

export function createSeedRecords(now = new Date().toISOString()): SampleRecord[] {
  if (!isIsoDate(now)) throw new ValidationError("Waktu pencatatan tidak valid.");
  return DEMO_SAMPLES.slice(0, 6).map((sample, index) => {
    const category = index < 4 ? sample.material : null;
    const timestamp = new Date(Date.parse(now) - (6 - index) * 3_600_000).toISOString();
    return {
      sampleId: sample.id,
      weightGrams: sample.weightGrams,
      prediction: { category: sample.prediction, score: sample.score },
      confirmedCategory: category,
      factors: category === null ? null : factorSnapshot(category),
      source: "dummy",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
}

export function confirmSample(
  records: readonly SampleRecord[],
  sampleId: string,
  weightGrams: number,
  category: Material,
  now = new Date().toISOString(),
): SampleRecord[] {
  const sample = DEMO_SAMPLES.find((item) => item.id === sampleId);
  if (!sample) throw new ValidationError("Sampel arsip contoh tidak dikenal.");
  assertWeight(weightGrams);
  if (!isLegacyMaterial(category)) throw new ValidationError("Pilih material yang dikonfirmasi.");
  if (!isIsoDate(now)) throw new ValidationError("Waktu pencatatan tidak valid.");
  const existing = records.find((record) => record.sampleId === sampleId);
  const next: SampleRecord = {
    sampleId,
    weightGrams,
    prediction: { category: sample.prediction, score: sample.score },
    confirmedCategory: category,
    factors: factorSnapshot(category),
    source: "dummy",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const result = existing
    ? records.map((record) => record.sampleId === sampleId ? next : record)
    : [...records, next];
  validateRecords(result);
  return result;
}

export function summarize(records: readonly SampleRecord[]) {
  const confirmed = records.filter((record) => record.confirmedCategory !== null).length;
  const impactKg = records.reduce((total, record) => {
    const impact = recordImpact(record);
    return impact === null ? total : total + impact;
  }, 0);
  return {
    count: records.length,
    confirmed,
    pending: records.length - confirmed,
    weightKg: records.reduce((total, record) => total + record.weightGrams, 0) / 1000,
    impactKg,
  };
}

export function materialBreakdown(records: readonly SampleRecord[]) {
  return (["pet", "cardboard"] as const).map((category) => {
    const matching = records.filter((record) => record.confirmedCategory === category);
    return { category, ...summarize(matching) };
  });
}

export function filterRecords(records: readonly SampleRecord[], query: string, status: RecordStatus, material: Material | "all") {
  const search = query.trim().toLocaleLowerCase("id-ID");
  return records.filter((record) => {
    const sample = getSample(record.sampleId);
    const matchesSearch = `${sample.id} ${sample.name} ${MATERIAL_LABELS[sample.material]}`.toLocaleLowerCase("id-ID").includes(search);
    const matchesStatus = status === "all" || (status === "confirmed" ? record.confirmedCategory !== null : record.confirmedCategory === null);
    const matchesMaterial = material === "all" || record.confirmedCategory === material;
    return matchesSearch && matchesStatus && matchesMaterial;
  }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFactorSnapshot(value: unknown): value is FactorSnapshot {
  return isObject(value)
    && value.version === "dummy-v1"
    && typeof value.baseline === "number" && Number.isFinite(value.baseline) && value.baseline >= 0
    && typeof value.alternative === "number" && Number.isFinite(value.alternative) && value.alternative >= 0;
}

export function validateRecords(value: unknown): asserts value is SampleRecord[] {
  if (!Array.isArray(value)) throw new ValidationError("Daftar catatan tersimpan tidak valid.");
  const ids = new Set<string>();
  for (const record of value) {
    if (!isObject(record)
      || typeof record.sampleId !== "string"
      || !DEMO_SAMPLES.some((sample) => sample.id === record.sampleId)
      || !isObject(record.prediction)
      || !isLegacyMaterial(record.prediction.category)
      || typeof record.prediction.score !== "number"
      || !Number.isFinite(record.prediction.score)
      || record.prediction.score < 0 || record.prediction.score > 1
      || !(record.confirmedCategory === null || isLegacyMaterial(record.confirmedCategory))
      || record.source !== "dummy"
      || !isIsoDate(record.createdAt) || !isIsoDate(record.updatedAt)) {
      throw new ValidationError("Struktur catatan tersimpan tidak valid.");
    }
    assertWeight(record.weightGrams);
    if (ids.has(record.sampleId)) throw new ValidationError("ID sampel tersimpan ganda.");
    ids.add(record.sampleId);
    if (record.confirmedCategory === null ? record.factors !== null : !isFactorSnapshot(record.factors)) {
      throw new ValidationError("Faktor skenario tidak sesuai dengan status konfirmasi.");
    }
    if (record.confirmedCategory !== null && isFactorSnapshot(record.factors)) {
      calculateScenario(record.weightGrams, record.factors);
    }
  }
}

export function serializeRecords(records: SampleRecord[]): string {
  validateRecords(records);
  return JSON.stringify({ version: 1, records });
}

export function deserializeRecords(serialized: string): SampleRecord[] {
  const payload: unknown = JSON.parse(serialized);
  if (!isObject(payload) || payload.version !== 1) throw new ValidationError("Versi data tersimpan tidak didukung.");
  validateRecords(payload.records);
  return payload.records;
}

export function csvCell(value: string | number): string {
  const text = String(value);
  const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function exportCsv(records: SampleRecord[]): string {
  validateRecords(records);
  const headers = [
    "sample_id", "sample_name", "data_source", "weight_g", "prediction_demo",
    "score_dummy_not_model_accuracy", "confirmed_material", "confirmation_status",
    "baseline_factor_kgco2e_per_kg", "alternative_factor_kgco2e_per_kg",
    "factor_source", "scenario_difference_kgco2e", "treatment_verified",
    "carbon_credits_issued", "created_at", "updated_at",
    "current_sample_image_file", "current_sample_image_source", "image_content_verified",
  ];
  const rows = records.map((record) => [
    record.sampleId,
    getSample(record.sampleId).name,
    "DUMMY_NOT_MEASURED",
    record.weightGrams,
    MATERIAL_LABELS[record.prediction.category],
    record.prediction.score,
    record.confirmedCategory === null ? "" : MATERIAL_LABELS[record.confirmedCategory],
    record.confirmedCategory === null ? "PENDING" : "HUMAN_CONFIRMED_DEMO",
    record.factors?.baseline ?? "",
    record.factors?.alternative ?? "",
    record.factors === null ? "" : "DUMMY_NOT_OFFICIAL",
    recordImpact(record) ?? "",
    "NO",
    "NO",
    record.createdAt,
    record.updatedAt,
    getSample(record.sampleId).imageFile,
    "USER_PROVIDED_UNVERIFIED",
    "NO",
  ]);
  return "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
import { TRAINING_SAMPLES } from "./dataset.ts";
