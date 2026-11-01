import {
  MATERIALS, MATERIAL_LABELS, ValidationError, assertWeight, calculateScenario, csvCell,
  deserializeRecords, getSample, isIsoDate, isMaterial, isObject, validateRecords,
} from "./model.ts";
import type { Material, SampleRecord } from "./model.ts";
import { validateModelAnalysis } from "./ai-contract.ts";
import type { ModelAnalysis } from "./ai-contract.ts";
import { CUSTOM_PARAMETER_NAME, DEFAULT_PARAMETER_SET_IDS, getParameterSet, isParameterSetId, parameterFactorInputs } from "./parameter-sets.ts";
import type { ParameterSetId } from "./parameter-sets.ts";
import { sameUploadedPhoto, validateUploadedPhoto } from "./photos.ts";
import type { UploadedPhoto } from "./photos.ts";

export const RECORDS_KEY = "carbontrace.records.v2";
export const FACTORS_KEY = "carbontrace.factors.v1";

export interface DocumentedFactors {
  material: Material;
  baseline: number;
  alternative: number;
  baselineScenario: string;
  alternativeScenario: string;
  sourceTitle: string;
  sourceUrl: string;
  scope: string;
  updatedAt: string;
  parameterSetId?: ParameterSetId | "custom";
  parameterSetName?: string;
}

export interface FactorConfig {
  pet: DocumentedFactors | null;
  cardboard: DocumentedFactors | null;
  drywall: DocumentedFactors | null;
}

export interface MaterialRecord {
  sampleId: string;
  weightGrams: number;
  category: Material;
  method: "manual" | "ai-assisted";
  source: "user-reported-unverified";
  factors: DocumentedFactors | null;
  createdAt: string;
  updatedAt: string;
  analysis?: ModelAnalysis | null;
  photo?: UploadedPhoto;
}

export interface OperationalState {
  version: 2;
  records: MaterialRecord[];
  archive: SampleRecord[];
}

export type EstimateFilter = "all" | "estimated" | "missing";

export interface HistoryFactorGroup {
  factors: DocumentedFactors;
  count: number;
  weightGrams: number;
  differenceKg: number;
}

export function emptyFactorConfig(): FactorConfig {
  return { pet: null, cardboard: null, drywall: null };
}

export function migrateLegacyData(serialized: string | null): OperationalState {
  return { version: 2, records: [], archive: serialized === null ? [] : deserializeRecords(serialized) };
}

export function parseFactorNumber(input: string): number {
  const trimmed = input.trim();
  if (!/^-?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(trimmed)) {
    throw new ValidationError("Isi faktor dengan angka, tanpa pemisah ribuan. Koma atau titik boleh digunakan untuk desimal.");
  }
  const value = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(value)) throw new ValidationError("Nilai faktor berada di luar rentang yang didukung.");
  return value === 0 ? 0 : value;
}

function requiredText(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new ValidationError(`${label} wajib diisi.`);
  return trimmed;
}

function validSourceUrl(value: string): boolean {
  if (value === "") return true;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.username === "" && url.password === "";
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return false;
  }
}

export function createDocumentedFactors(
  material: Material,
  input: {
    baseline: string;
    alternative: string;
    baselineScenario: string;
    alternativeScenario: string;
    sourceTitle: string;
    sourceUrl: string;
    scope: string;
  },
  now = new Date().toISOString(),
): DocumentedFactors {
  if (!isMaterial(material)) throw new ValidationError("Pilih material untuk faktor emisi.");
  if (!isIsoDate(now)) throw new ValidationError("Waktu perubahan faktor tidak valid.");
  const sourceUrl = input.sourceUrl.trim();
  if (!validSourceUrl(sourceUrl)) throw new ValidationError("Tautan sumber harus berupa URL HTTP/HTTPS yang valid, tanpa kredensial.");
  return {
    material,
    baseline: parseFactorNumber(input.baseline),
    alternative: parseFactorNumber(input.alternative),
    baselineScenario: requiredText(input.baselineScenario, "Nama skenario awal"),
    alternativeScenario: requiredText(input.alternativeScenario, "Nama skenario alternatif"),
    sourceTitle: requiredText(input.sourceTitle, "Dokumen sumber, tahun, atau versi"),
    sourceUrl,
    scope: requiredText(input.scope, "Konteks wilayah dan batas perhitungan"),
    updatedAt: now,
    parameterSetId: "custom",
    parameterSetName: CUSTOM_PARAMETER_NAME,
  };
}

function validParameterMetadata(value: Record<string, unknown>): boolean {
  if (value.parameterSetId === undefined && value.parameterSetName === undefined) return true;
  if (value.parameterSetId === "custom") return value.parameterSetName === CUSTOM_PARAMETER_NAME;
  if (!isParameterSetId(value.parameterSetId) || !isMaterial(value.material)) return false;
  const definition = getParameterSet(value.parameterSetId);
  if (definition.factors[value.material] === undefined) return false;
  const expected = parameterFactorInputs(definition.id, value.material);
  return value.parameterSetName === definition.name
    && value.baseline === Number(expected.baseline) && value.alternative === Number(expected.alternative)
    && value.baselineScenario === expected.baselineScenario && value.alternativeScenario === expected.alternativeScenario
    && value.sourceTitle === expected.sourceTitle && value.sourceUrl === expected.sourceUrl
    && value.scope === expected.scope;
}

function isDocumentedFactors(value: unknown): value is DocumentedFactors {
  return isObject(value)
    && isMaterial(value.material)
    && typeof value.baseline === "number" && Number.isFinite(value.baseline)
    && typeof value.alternative === "number" && Number.isFinite(value.alternative)
    && ["baselineScenario", "alternativeScenario", "sourceTitle", "scope"].every((key) =>
      typeof value[key] === "string" && value[key].trim().length > 0)
    && typeof value.sourceUrl === "string" && validSourceUrl(value.sourceUrl)
    && isIsoDate(value.updatedAt) && validParameterMetadata(value);
}

export function createParameterSetConfig(id: ParameterSetId, now = new Date().toISOString()): FactorConfig {
  const definition = getParameterSet(id);
  const create = (material: Material): DocumentedFactors | null => definition.factors[material] === undefined ? null : ({
    ...createDocumentedFactors(material, parameterFactorInputs(id, material), now),
    parameterSetId: definition.id,
    parameterSetName: definition.name,
  });
  const config = { pet: create("pet"), cardboard: create("cardboard"), drywall: create("drywall") };
  validateFactorConfig(config);
  return config;
}

export function activeParameterSetId(config: FactorConfig): ParameterSetId | "custom" | null {
  validateFactorConfig(config);
  const first = MATERIALS.map((material) => config[material]).find((factors) => factors !== null);
  if (first === undefined) return null;
  const id = first.parameterSetId;
  if (!isParameterSetId(id)) return "custom";
  return MATERIALS.every((material) => getParameterSet(id).factors[material] === undefined
    ? config[material] === null : config[material]?.parameterSetId === id) ? id : "custom";
}

export function materialParameterSetId(config: FactorConfig, material: Material): ParameterSetId | "custom" | null {
  validateFactorConfig(config);
  if (!isMaterial(material)) throw new ValidationError("Material parameter set tidak dikenal.");
  const factors = config[material];
  return factors === null ? null : isParameterSetId(factors.parameterSetId) ? factors.parameterSetId : "custom";
}

export function applyMaterialParameterSet(config: FactorConfig, id: ParameterSetId, material: Material, now = new Date().toISOString()): FactorConfig {
  validateFactorConfig(config);
  if (!isMaterial(material)) throw new ValidationError("Material parameter set tidak dikenal.");
  const factors = createParameterSetConfig(id, now)[material];
  if (factors === null) throw new ValidationError("Parameter set ini tidak menyediakan faktor untuk material yang dipilih.");
  return { ...config, [material]: factors };
}

export function ensureMaterialDefault(config: FactorConfig, material: Material, now = new Date().toISOString()): FactorConfig {
  validateFactorConfig(config);
  if (!isMaterial(material)) throw new ValidationError("Material parameter set tidak dikenal.");
  return config[material] === null ? applyMaterialParameterSet(config, DEFAULT_PARAMETER_SET_IDS[material], material, now) : config;
}

export function recordFactorConfig(config: FactorConfig, material: Material, estimateEnabled: boolean): FactorConfig {
  validateFactorConfig(config);
  if (!isMaterial(material)) throw new ValidationError("Material parameter set tidak dikenal.");
  return estimateEnabled ? config : { ...config, [material]: null };
}

export function factorParameterName(factors: DocumentedFactors | null): string {
  if (factors === null) return "Belum diatur";
  return factors.parameterSetName ?? "Parameter khusus (data lama)";
}

export function validateFactorConfig(value: unknown): asserts value is FactorConfig {
  if (!isObject(value)) throw new ValidationError("Pengaturan faktor tersimpan tidak valid.");
  for (const category of MATERIALS) {
    const factors = value[category];
    if (factors !== null && (!isDocumentedFactors(factors) || factors.material !== category)) {
      throw new ValidationError(`Sumber dan nilai faktor ${MATERIAL_LABELS[category]} tidak lengkap atau tidak valid.`);
    }
  }
}

export function serializeFactorConfig(config: FactorConfig): string {
  validateFactorConfig(config);
  return JSON.stringify({ version: 1, factors: config });
}

export function deserializeFactorConfig(serialized: string): FactorConfig {
  const payload: unknown = JSON.parse(serialized);
  if (!isObject(payload) || payload.version !== 1) throw new ValidationError("Versi pengaturan faktor tidak didukung.");
  if (isObject(payload.factors) && !Object.hasOwn(payload.factors, "drywall")) {
    const migrated = { ...payload.factors, drywall: null };
    validateFactorConfig(migrated);
    return migrated;
  }
  validateFactorConfig(payload.factors);
  return payload.factors;
}

export function manualRecordImpact(record: MaterialRecord): number | null {
  return record.factors === null ? null : calculateScenario(record.weightGrams, record.factors);
}

export function summarizeManual(records: readonly MaterialRecord[]) {
  let total = 0;
  let calculated = 0;
  for (const record of records) {
    if (record.factors !== null) {
      total += calculateScenario(record.weightGrams, record.factors);
      calculated++;
    }
  }
  const weightKg = records.reduce((sum, record) => sum + record.weightGrams, 0) / 1000;
  if (!Number.isFinite(weightKg) || !Number.isFinite(total)) {
    throw new ValidationError("Total massa atau estimasi berada di luar rentang yang didukung.");
  }
  return {
    count: records.length,
    weightKg,
    calculated,
    missing: records.length - calculated,
    impactKg: calculated === 0 ? null : total,
  };
}

export function summarizeHistory(records: readonly MaterialRecord[]) {
  const materials: Record<Material, { count: number; weightGrams: number }> = {
    pet: { count: 0, weightGrams: 0 },
    cardboard: { count: 0, weightGrams: 0 },
    drywall: { count: 0, weightGrams: 0 },
  };
  const groups = new Map<string, HistoryFactorGroup>();
  let weightGrams = 0;
  let estimated = 0;
  let aiAssisted = 0;
  let corrected = 0;
  for (const record of records) {
    weightGrams += record.weightGrams;
    materials[record.category].count++;
    materials[record.category].weightGrams += record.weightGrams;
    if (record.analysis) {
      aiAssisted++;
      if (record.analysis.category !== record.category) corrected++;
    }
    const factors = record.factors;
    if (factors === null) continue;
    estimated++;
    // The application timestamp does not change the calculation basis.
    const key = JSON.stringify([
      factors.material, factors.baseline, factors.alternative,
      factors.baselineScenario, factors.alternativeScenario,
      factors.sourceTitle, factors.sourceUrl, factors.scope,
      factors.parameterSetId ?? null, factors.parameterSetName ?? null,
    ]);
    let group = groups.get(key);
    if (group === undefined) {
      group = { factors: { ...factors }, count: 0, weightGrams: 0, differenceKg: 0 };
      groups.set(key, group);
    }
    group.count++;
    group.weightGrams += record.weightGrams;
    group.differenceKg += calculateScenario(record.weightGrams, factors);
  }
  const factorGroups = [...groups.values()];
  if (![weightGrams, ...Object.values(materials).map((item) => item.weightGrams),
    ...factorGroups.flatMap((group) => [group.weightGrams, group.differenceKg])].every(Number.isFinite)) {
    throw new ValidationError("Total massa atau estimasi berada di luar rentang yang didukung.");
  }
  return {
    count: records.length, weightGrams, materials, estimated,
    missing: records.length - estimated, aiAssisted,
    manual: records.length - aiAssisted, corrected, factorGroups,
  };
}

function validateRecordPhoto(sampleId: string, photo: unknown): void {
  if (photo === undefined) {
    getSample(sampleId);
    return;
  }
  validateUploadedPhoto(photo);
  if (photo.id !== sampleId) throw new ValidationError("Identitas foto tidak sesuai dengan catatan material.");
}

export function validateOperationalState(value: unknown): asserts value is OperationalState {
  if (!isObject(value) || value.version !== 2 || !Array.isArray(value.records)) {
    throw new ValidationError("Format catatan material tersimpan tidak valid.");
  }
  validateRecords(value.archive);
  const ids = new Set<string>();
  for (const record of value.records) {
    if (!isObject(record) || typeof record.sampleId !== "string"
      || !isMaterial(record.category) || !(record.method === "manual" || record.method === "ai-assisted")
      || record.source !== "user-reported-unverified"
      || !isIsoDate(record.createdAt) || !isIsoDate(record.updatedAt)
      || !(record.factors === null || (isDocumentedFactors(record.factors) && record.factors.material === record.category))) {
      throw new ValidationError("Struktur catatan material tersimpan tidak valid.");
    }
    validateRecordPhoto(record.sampleId, record.photo);
    assertWeight(record.weightGrams);
    if (record.analysis !== undefined && record.analysis !== null) {
      validateModelAnalysis(record.analysis);
      if (record.analysis.sampleId !== record.sampleId || record.method !== "ai-assisted") {
        throw new ValidationError("Analisis AI tidak sesuai dengan sampel atau metode pencatatan.");
      }
    } else if (record.method !== "manual") {
      throw new ValidationError("Catatan berbantuan AI harus menyimpan hasil inferensi model.");
    }
    if (ids.has(record.sampleId)) throw new ValidationError("ID catatan material tersimpan ganda.");
    ids.add(record.sampleId);
    if (record.factors !== null && isDocumentedFactors(record.factors)) {
      calculateScenario(record.weightGrams, record.factors);
    }
  }
  const weightTotal = value.records.reduce((sum, record: unknown) => {
    if (!isObject(record) || typeof record.weightGrams !== "number") throw new ValidationError("Massa catatan tidak valid.");
    return sum + record.weightGrams;
  }, 0);
  if (!Number.isFinite(weightTotal)) throw new ValidationError("Total massa berada di luar rentang yang didukung.");
}

export function serializeOperationalState(state: OperationalState): string {
  validateOperationalState(state);
  summarizeManual(state.records);
  return JSON.stringify(state);
}

export function deserializeOperationalState(serialized: string): OperationalState {
  const payload: unknown = JSON.parse(serialized);
  validateOperationalState(payload);
  summarizeManual(payload.records);
  return payload;
}

export function saveManualRecord(
  state: OperationalState,
  sampleId: string,
  weightGrams: number,
  category: Material,
  config: FactorConfig,
  now = new Date().toISOString(),
  analysis: ModelAnalysis | null = null,
  photo: UploadedPhoto | null = null,
): OperationalState {
  validateRecordPhoto(sampleId, photo ?? undefined);
  assertWeight(weightGrams);
  if (!isMaterial(category)) throw new ValidationError("Pilih material berdasarkan pemeriksaan Anda.");
  if (!isIsoDate(now)) throw new ValidationError("Waktu pencatatan tidak valid.");
  validateFactorConfig(config);
  if (analysis !== null) {
    validateModelAnalysis(analysis);
    if (analysis.sampleId !== sampleId) throw new ValidationError("Foto yang dianalisis berbeda dari sampel yang disimpan.");
  }
  const previous = state.records.find((record) => record.sampleId === sampleId);
  if (previous?.photo !== undefined && (photo === null || !sameUploadedPhoto(previous.photo, photo))) {
    throw new ValidationError("Foto catatan lama tidak boleh diganti. Unggah foto baru untuk membuat ID baru.");
  }
  const factors = config[category];
  const record: MaterialRecord = {
    sampleId, weightGrams, category,
    method: analysis === null ? "manual" : "ai-assisted", source: "user-reported-unverified",
    factors: factors === null ? null : { ...factors },
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    ...(analysis === null ? {} : { analysis: { ...analysis, scores: { ...analysis.scores } } }),
    ...(photo === null ? {} : { photo: { ...photo } }),
  };
  const records = previous
    ? state.records.map((item) => item.sampleId === sampleId ? record : item)
    : [...state.records, record];
  const next: OperationalState = { ...state, records };
  validateOperationalState(next);
  summarizeManual(records);
  return next;
}

export function filterManualRecords(records: readonly MaterialRecord[], query: string, status: EstimateFilter, material: Material | "all") {
  const search = query.trim().toLocaleLowerCase("id-ID");
  return records.filter((record) => {
    const name = record.photo?.originalName ?? getSample(record.sampleId).name;
    const matchesSearch = `${record.sampleId} ${name} ${MATERIAL_LABELS[record.category]}`.toLocaleLowerCase("id-ID").includes(search);
    return matchesSearch
      && (status === "all" || (status === "estimated" ? record.factors !== null : record.factors === null))
      && (material === "all" || record.category === material);
  }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function exportManualCsv(state: OperationalState): string {
  validateOperationalState(state);
  const headers = [
    "sample_id", "sample_name", "weight_g", "weight_source", "material",
    "classification_method", "ai_status", "baseline_scenario", "alternative_scenario",
    "baseline_factor_kgco2e_per_kg", "alternative_factor_kgco2e_per_kg",
    "factor_source_title", "factor_source_url", "factor_scope", "factor_updated_at",
    "scenario_difference_kgco2e", "factor_verification", "treatment_verified",
    "carbon_credits_issued", "created_at", "updated_at", "current_sample_image_file",
    "current_sample_image_source", "image_content_verified",
    "ai_predicted_material", "ai_score_not_accuracy", "ai_model_version",
    "ai_input_rgb_sha256", "ai_analyzed_at", "ai_human_correction",
    "factor_parameter_set_id", "factor_parameter_set_name",
  ];
  const rows = state.records.map((record) => [
    record.sampleId, record.photo?.originalName ?? getSample(record.sampleId).name, record.weightGrams,
    "USER_REPORTED_NOT_VERIFIED", MATERIAL_LABELS[record.category],
    record.method === "manual" ? "MANUAL" : "AI_ASSISTED_HUMAN_CONFIRMED",
    record.analysis ? "MODEL_INFERENCE_RECORDED" : "NOT_ANALYZED",
    record.factors?.baselineScenario ?? "", record.factors?.alternativeScenario ?? "",
    record.factors?.baseline ?? "", record.factors?.alternative ?? "",
    record.factors?.sourceTitle ?? "", record.factors?.sourceUrl ?? "",
    record.factors?.scope ?? "", record.factors?.updatedAt ?? "",
    manualRecordImpact(record) ?? "", record.factors === null ? "NOT_CONFIGURED"
      : isParameterSetId(record.factors.parameterSetId) ? "REFERENCE_MODEL_NOT_SITE_VERIFIED" : "USER_SUPPLIED_NOT_VERIFIED",
    "NO", "NO", record.createdAt, record.updatedAt,
    record.photo ? `${record.photo.id}.jpg` : getSample(record.sampleId).imageFile,
    record.photo ? "USER_UPLOADED_UNVERIFIED" : "USER_PROVIDED_UNVERIFIED", "NO",
    record.analysis ? MATERIAL_LABELS[record.analysis.category] : "",
    record.analysis?.score ?? "", record.analysis?.modelVersion ?? "",
    record.analysis?.inputSha256 ?? "", record.analysis?.analyzedAt ?? "",
    record.analysis ? (record.analysis.category === record.category ? "NO" : "YES") : "",
    record.factors === null ? "" : record.factors.parameterSetId ?? "custom",
    record.factors === null ? "" : factorParameterName(record.factors),
  ]);
  return "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
