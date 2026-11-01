import "./styles.css";
import parameterGuideUrl from "./assets/guides/Parameter-Set-Emisi.md?url";
import parameterWordUrl from "./assets/guides/CarbonTrace-Skenario-dan-Panduan-Penggunaan.docx?url";
import {
  CATALOG_SAMPLES, MATERIALS, STORAGE_KEY, ValidationError,
  compareScenario, exportCsv as exportArchiveCsv, getSample, isMaterial, parseWeight, sortCatalogSamples,
} from "./model.ts";
import {
  FACTORS_KEY, RECORDS_KEY, createDocumentedFactors, deserializeFactorConfig,
  deserializeOperationalState, emptyFactorConfig, exportManualCsv, filterManualRecords,
  manualRecordImpact, migrateLegacyData, saveManualRecord, serializeFactorConfig,
  serializeOperationalState, summarizeManual, summarizeHistory,
  activeParameterSetId, applyMaterialParameterSet, createParameterSetConfig, ensureMaterialDefault, materialParameterSetId, recordFactorConfig,
} from "./operational.ts";
import type { DocumentedFactors, FactorConfig, MaterialRecord, OperationalState } from "./operational.ts";
import { deleteUploadedPhoto, isUploadedPhotoId, loadUploadedPhoto, prepareUploadedPhoto, storeUploadedPhoto } from "./photos.ts";
import type { PreparedPhoto, UploadedPhoto } from "./photos.ts";
import type { ModelAnalysis } from "./ai-contract.ts";
import type { ImageClassifier } from "./classifier.ts";
import { DEFAULT_PARAMETER_SET_IDS, getParameterSet, isParameterSetId, normalizeParameterFactor, parameterSetsForMaterial } from "./parameter-sets.ts";
import { DATASET_DECLARATION } from "./dataset.ts";
import { LANGUAGE_KEY, createFormatters, errorText, getLanguage, inputNumber, isLanguage, languageLocale, setLanguage, t, translateDocument } from "./i18n.ts";
import { factorFormText, factorName, factorScenarios, factorScope, factorScopeParagraphs, factorSource, materialName, parameterView, sampleDescription, sampleName, sampleOptionLabel, sampleSearchText, uploadedPhotoSearchText } from "./localized-content.ts";
import { THEME_KEY, getTheme, isTheme, setTheme } from "./themes.ts";
import { RECORD_STEPS, VIEW_IDS, isRecordStep, nextRecordStep, previousRecordStep, viewFromHash } from "./workflow.ts";
import type { AppView, RecordStep } from "./workflow.ts";
import type { Material } from "./model.ts";
import type { MessageKey } from "./i18n.ts";

function find<T extends HTMLElement>(root: ParentNode, selector: string, constructor: { new(): T }): T {
  const element = root.querySelector(selector);
  if (!(element instanceof constructor)) throw new Error(`Application element not found: ${selector}`);
  return element;
}
function byId<T extends HTMLElement>(id: string, constructor: { new(): T }): T {
  return find(document, `#${id}`, constructor);
}
function text(id: string, value: string): void {
  byId(id, HTMLElement).textContent = value;
}
type UiText = () => string;
const feedbackMessages = new Map<string, UiText>();
function feedback(id: string, message: UiText | null): void {
  if (message === null) feedbackMessages.delete(id);
  else feedbackMessages.set(id, message);
  text(id, message === null ? "" : message());
  if (id === "ai-error") text("guide-ai-error", modelState === "error" && message !== null ? message() : "");
}

const controls = {
  form: byId("sample-form", HTMLFormElement),
  sample: byId("sample-select", HTMLSelectElement),
  sampleId: byId("sample-id", HTMLInputElement),
  weight: byId("weight-input", HTMLInputElement),
  image: byId("sample-image", HTMLImageElement),
  category: byId("category-confirmation", HTMLSelectElement),
  save: byId("save-button", HTMLButtonElement),
  estimateEnabled: byId("estimate-enabled", HTMLInputElement),
  estimateGuidance: [
    byId("estimate-guidance", HTMLDivElement),
    byId("review-estimate-guidance", HTMLDivElement),
  ],
  search: byId("record-search", HTMLInputElement),
  status: byId("status-filter", HTMLSelectElement),
  material: byId("material-filter", HTMLSelectElement),
  rows: byId("record-rows", HTMLTableSectionElement),
  template: byId("record-row-template", HTMLTemplateElement),
  historyInsightContent: byId("history-insight-content", HTMLDivElement),
  historyInsightEmpty: byId("history-insight-empty", HTMLParagraphElement),
  historyInsightError: byId("history-insight-error", HTMLParagraphElement),
  historyInsightStart: byId("history-insight-start", HTMLAnchorElement),
  historyInsightMissing: byId("history-insight-missing", HTMLButtonElement),
  historyInsightDetails: byId("history-insight-details", HTMLDetailsElement),
  historyInsightGroups: byId("history-insight-groups", HTMLDivElement),
  historyInsightTemplate: byId("history-insight-group-template", HTMLTemplateElement),
  dialog: byId("confirm-dialog", HTMLDialogElement),
  factorForm: byId("factor-form", HTMLFormElement),
  factorMaterial: byId("factor-material", HTMLSelectElement),
  baseline: byId("factor-baseline", HTMLInputElement),
  alternative: byId("factor-alternative", HTMLInputElement),
  baselineScenario: byId("factor-baseline-scenario", HTMLInputElement),
  alternativeScenario: byId("factor-alternative-scenario", HTMLInputElement),
  sourceTitle: byId("factor-source-title", HTMLInputElement),
  sourceUrl: byId("factor-source-url", HTMLInputElement),
  scope: byId("factor-scope", HTMLTextAreaElement),
  predict: byId("predict-button", HTMLButtonElement),
  retryAi: byId("retry-ai", HTMLButtonElement),
  testPhoto: byId("test-photo", HTMLInputElement),
  catalogSource: byId("choose-catalog-source", HTMLButtonElement),
  uploadSource: byId("choose-upload-source", HTMLButtonElement),
  parameterSet: byId("parameter-set", HTMLSelectElement),
  applySet: byId("apply-parameter-set", HTMLButtonElement),
  language: byId("language-select", HTMLSelectElement),
  theme: byId("theme-select", HTMLSelectElement),
  workflowNext: byId("workflow-next", HTMLButtonElement),
  workflowBack: byId("workflow-back", HTMLButtonElement),
  guideRetryAi: byId("guide-retry-ai", HTMLButtonElement),
};
const factorTextFields = ["baselineScenario", "alternativeScenario", "sourceTitle", "scope"] as const;
const editedFactorTextFields = new Set<(typeof factorTextFields)[number]>();
let factorFormSource: DocumentedFactors | null = null;
const sampleImages = import.meta.glob<string>("./assets/samples/optimized/*.jpg", { eager: true, query: "?url", import: "default" });
const failedPhotos = new Set<string>();
let languageError: UiText | null = null;
loadLanguagePreference();
let themeError: UiText | null = null;
loadThemePreference();
renderTheme();
let formatters = createFormatters();
let classifier: ImageClassifier | null = null;
let modelState: "loading" | "ready" | "error" = "loading";
let modelLoading = false;
let analysisBusy = false;
let photoRevision = 0;
let draftRevision = 0;
let photoMode: "catalog" | "upload" = "catalog";
let currentUpload: PreparedPhoto | null = null;
let uploadMetadata: UploadedPhoto | null = null;
let uploadBusy = false;
let recordSaving = false;
let mainPhotoUrl: string | null = null;
let recordPhotoUrls: string[] = [];
let recordsRevision = 0;
let currentAnalysis: ModelAnalysis | null = null;
let historicalAnalysis = false;
let recordError: UiText | null = null;
let factorError: UiText | null = null;
let weightTouched = false;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let dialogAction: (() => void) | null = null;
let dialogText: { title: UiText; description: UiText; button: UiText } | null = null;
let toastMessage: UiText | null = null;
let activeView: AppView = "overview";
let recordStep: RecordStep = 1;
let recordDirty = false;
let recordSaved = false;
let returnToRecordReview = false;
let state = loadState();
let config = loadFactors();

function loadLanguagePreference(): void {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved !== null && !isLanguage(saved)) throw new ValidationError("Pilihan bahasa tersimpan tidak valid.");
    setLanguage(saved ?? "id");
  } catch (error) {
    if (!(error instanceof DOMException || error instanceof ValidationError)) throw error;
    console.error("CarbonTrace: language preference could not be loaded.", error);
    setLanguage("id");
    languageError = () => t("languageReadError", { error: errorText(error) });
  }
}

function loadThemePreference(): void {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved !== null && !isTheme(saved)) throw new ValidationError("Warna tema tersimpan tidak valid.");
    setTheme(saved ?? "green");
  } catch (error) {
    if (!(error instanceof DOMException || error instanceof ValidationError)) throw error;
    console.error("CarbonTrace: theme preference could not be loaded.", error);
    setTheme("green");
    themeError = () => t("themeReadError", { error: errorText(error) });
  }
}

function renderTheme(): void {
  document.documentElement.dataset.theme = getTheme();
  controls.theme.value = getTheme();
  const color = getComputedStyle(document.documentElement).getPropertyValue("--theme-chrome").trim();
  if (!/^#[a-f0-9]{6}$/i.test(color)) throw new Error("The theme chrome colour is not configured.");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!(meta instanceof HTMLMetaElement)) throw new Error("The theme-colour metadata element is missing.");
  meta.content = color;
}

function expectedStorageError(error: unknown): error is Error {
  return error instanceof DOMException || error instanceof SyntaxError || error instanceof ValidationError;
}
function loadState(): OperationalState | null {
  try {
    const current = localStorage.getItem(RECORDS_KEY);
    if (current !== null) return deserializeOperationalState(current);
    const migrated = migrateLegacyData(localStorage.getItem(STORAGE_KEY));
    localStorage.setItem(RECORDS_KEY, serializeOperationalState(migrated));
    return migrated;
  } catch (error) {
    if (!expectedStorageError(error)) throw error;
    recordError = () => t("recordsLoadError", { error: errorText(error) });
    return null;
  }
}
function loadFactors(): FactorConfig | null {
  try {
    const saved = localStorage.getItem(FACTORS_KEY);
    return saved === null ? emptyFactorConfig() : deserializeFactorConfig(saved);
  } catch (error) {
    if (!expectedStorageError(error)) throw error;
    factorError = () => t("factorsLoadError", { error: errorText(error) });
    return null;
  }
}
function renderStorageStatus(): void {
  const messages = [recordError, factorError, languageError, themeError].filter((message): message is UiText => message !== null);
  byId("storage-error", HTMLDivElement).hidden = messages.length === 0;
  text("storage-error-text", messages.map((message) => message()).join(" "));
  byId("storage-status", HTMLElement).classList.toggle("storage-unavailable", messages.length > 0);
  text("storage-status-text", t(messages.length === 0 ? "storedInBrowser" : "storageCheck"));
}
function showToast(message: UiText, error = false): void {
  const toast = byId("toast", HTMLDivElement);
  clearTimeout(toastTimer);
  toastMessage = message;
  toast.textContent = message();
  toast.classList.toggle("toast-error", error);
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; toastMessage = null; }, error ? 9000 : 5000);
}
function commitState(next: OperationalState, message: UiText): boolean {
  try {
    localStorage.setItem(RECORDS_KEY, serializeOperationalState(next));
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
    recordError = () => t("recordsWriteError", { name: error.name });
    renderStorageStatus();
    showToast(recordError, true);
    return false;
  }
  state = next;
  recordError = null;
  renderAll();
  showToast(message);
  return true;
}
function commitConfig(next: FactorConfig, message: UiText): boolean {
  const category = controls.category.value;
  const changesRecord = isMaterial(category) && JSON.stringify(config?.[category]) !== JSON.stringify(next[category]);
  try {
    localStorage.setItem(FACTORS_KEY, serializeFactorConfig(next));
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
    factorError = () => t("factorsWriteError", { name: error.name });
    renderStorageStatus();
    showToast(factorError, true);
    return false;
  }
  config = next;
  factorError = null;
  if (changesRecord) markRecordChanged();
  renderAll();
  renderFactorForm();
  showToast(message);
  return true;
}

function renderAiAvailability(): void {
  const photoReady = photoMode === "catalog" || currentUpload !== null;
  controls.predict.disabled = classifier === null || analysisBusy || uploadBusy || recordSaving || !photoReady || !controls.image.complete || controls.image.naturalWidth === 0;
  controls.testPhoto.disabled = analysisBusy || uploadBusy || recordSaving;
  controls.sample.disabled = analysisBusy || uploadBusy || recordSaving;
  controls.catalogSource.disabled = analysisBusy || uploadBusy || recordSaving;
  controls.uploadSource.disabled = analysisBusy || uploadBusy || recordSaving;
  byId("use-ai-suggestion", HTMLButtonElement).disabled = currentAnalysis === null || analysisBusy;
  controls.predict.textContent = t(analysisBusy ? "predictBusy" : "predict");
  controls.save.disabled = state === null || config === null || analysisBusy || uploadBusy || recordSaving;
  controls.form.inert = recordSaving;
  byId("record-save-status", HTMLParagraphElement).hidden = !recordSaving;
  text("record-save-status", recordSaving ? t("recordSaving") : "");
  renderWorkflow();
}

function renderAiResult(): void {
  byId("ai-result", HTMLDivElement).hidden = currentAnalysis === null;
  renderWorkflow();
  if (currentAnalysis === null) return;
  text("ai-category", materialName(currentAnalysis.category));
  text("ai-score", t("aiScore", { score: formatters.score.format(currentAnalysis.score) }));
  byId("ai-confidence-bar", HTMLElement).style.width = `${currentAnalysis.score * 100}%`;
  const sample = isUploadedPhotoId(currentAnalysis.sampleId) ? null : getSample(currentAnalysis.sampleId);
  const role = sample === null ? t("aiRoleUploaded") : sample.role === "train" ? t("aiRoleTrain")
    : sample.role === "test"
      ? t(sample.testCohort === "previous-test" ? "aiRoleOld" : "aiRoleNew")
      : t("aiRoleExploratory");
  text("ai-result-caption", t("analysisCaption", { context: t(historicalAnalysis ? "analysisHistorical" : "analysisLive"), role, version: currentAnalysis.modelVersion }));
  renderAiAvailability();
}

function renderModelState(): void {
  byId("ai-status", HTMLDivElement).dataset.modelState = modelState;
  controls.retryAi.hidden = modelState !== "error";
  controls.guideRetryAi.hidden = modelState !== "error";
  text("guide-model-status", t("guideModelStatus", {
    status: t(modelState === "ready" ? "activeModel" : modelState === "error" ? "modelFailed" : "loadingModel"),
  }));
  text("guide-ai-error", modelState === "error" ? feedbackMessages.get("ai-error")?.() ?? "" : "");
  text("ai-badge", t(modelState === "ready" ? "activeModel" : modelState === "error" ? "modelFailed" : "loadingModel"));
  byId("ai-badge", HTMLElement).className = `badge ${modelState === "ready" ? "badge-green" : modelState === "error" ? "badge-amber" : "badge-neutral"}`;
  text("ai-description", t(modelState === "ready" ? "modelReadyDescription" : modelState === "error" ? "modelFailedDescription" : "modelPendingDescription"));
  if (classifier !== null && modelState === "ready") {
    const info = classifier.info;
    const previousTest = info.evaluationGroups["previous-test"];
    const newHoldout = info.evaluationGroups["new-holdout"];
    text("model-summary", t("modelSummary", {
      train: info.trainIds.length, newCorrect: newHoldout.correct, newTotal: newHoldout.ids.length,
      oldCorrect: previousTest.correct, oldTotal: previousTest.ids.length, version: info.version,
    }));
    text("model-origin", info.sourceDeclaration === DATASET_DECLARATION.statement
      ? t("modelOrigin", { total: info.trainIds.length + info.testIds.length })
      : t("modelOriginOriginal", { declaration: info.sourceDeclaration }));
  } else {
    text("model-summary", t("modelPendingDescription"));
    text("model-origin", "");
  }
}

async function initializeAi(): Promise<void> {
  if (modelLoading) return;
  modelLoading = true;
  modelState = "loading";
  feedback("ai-error", null);
  renderModelState();
  renderAiAvailability();
  try {
    const module = await import("./classifier.ts");
    classifier = await module.loadClassifier();
    modelState = "ready";
    renderModelState();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    console.error("CarbonTrace: pemuatan model AI gagal.", error);
    classifier = null;
    modelState = "error";
    renderModelState();
    feedback("ai-error", () => errorText(error));
  } finally {
    modelLoading = false;
    renderAiAvailability();
  }
}

async function analyzeRecordPhoto(): Promise<void> {
  if (classifier === null || analysisBusy) {
    feedback("ai-error", () => t("aiNotReady"));
    return;
  }
  const selected = controls.sampleId.value;
  const revision = photoRevision;
  analysisBusy = true;
  feedback("ai-error", null);
  renderAiAvailability();
  try {
    const prediction = await classifier.predict(controls.image);
    if (revision !== photoRevision || selected !== controls.sampleId.value) {
      showToast(() => t("photoChanged"), true);
      return;
    }
    currentAnalysis = {
      ...prediction, sampleId: selected, analyzedAt: new Date().toISOString(), source: "trained-model",
    };
    historicalAnalysis = false;
    if (controls.weight.value.trim() !== "" || controls.category.value !== "") markRecordChanged();
    renderAiResult();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    console.error("CarbonTrace: analisis foto gagal.", error);
    if (revision === photoRevision) {
      currentAnalysis = null;
      renderAiResult();
      feedback("ai-error", () => t("analysisFailed", { error: errorText(error) }));
    }
  } finally {
    analysisBusy = false;
    if (recordStep === 1) feedback("workflow-error", null);
    renderAiAvailability();
  }
}

function renderPhotoErrors(): void {
  const banner = byId("photo-error", HTMLDivElement);
  banner.hidden = failedPhotos.size === 0;
  banner.textContent = failedPhotos.size === 0 ? "" : t("photosFailed", { ids: [...failedPhotos].join(", ") });
}
function setSamplePhoto(image: HTMLImageElement, sampleId: string): void {
  const sample = getSample(sampleId);
  const url = sampleImages[`./assets/samples/optimized/${sample.id}_01.jpg`];
  image.title = t("photoTitle", { file: sample.imageFile });
  image.onload = () => { failedPhotos.delete(sampleId); renderPhotoErrors(); renderAiAvailability(); };
  image.onerror = () => { failedPhotos.add(sampleId); renderPhotoErrors(); renderAiAvailability(); };
  if (typeof url !== "string") {
    failedPhotos.add(sampleId);
    image.removeAttribute("src");
    renderPhotoErrors();
    return;
  }
  image.src = url;
}

function releaseMainPhoto(): void {
  if (mainPhotoUrl !== null) URL.revokeObjectURL(mainPhotoUrl);
  mainPhotoUrl = null;
}

function showUploadedPhoto(prepared: PreparedPhoto): void {
  releaseMainPhoto();
  mainPhotoUrl = URL.createObjectURL(prepared.blob);
  const revision = photoRevision;
  controls.image.onload = () => {
    if (revision !== photoRevision) return;
    failedPhotos.delete(prepared.photo.id);
    renderPhotoErrors();
    renderAiAvailability();
  };
  controls.image.onerror = () => {
    if (revision !== photoRevision) return;
    failedPhotos.add(prepared.photo.id);
    renderPhotoErrors();
    renderAiAvailability();
  };
  controls.image.src = mainPhotoUrl;
}

async function readRecordedPhoto(photo: UploadedPhoto, revision: number): Promise<void> {
  uploadBusy = true;
  feedback("upload-file-note", () => t("uploadLoading"));
  renderAiAvailability();
  try {
    const prepared = await loadUploadedPhoto(photo);
    if (revision !== photoRevision) return;
    currentUpload = prepared;
    showUploadedPhoto(prepared);
    feedback("upload-file-note", () => t("uploadStored", { filename: photo.originalName }));
    renderSamplePresentation();
  } catch (error) {
    if (!expectedStorageError(error)) throw error;
    console.error("CarbonTrace: stored upload could not be loaded.", error);
    if (revision === photoRevision) feedback("upload-error", () => t("uploadFailed", { error: errorText(error) }));
  } finally {
    if (revision === photoRevision) {
      uploadBusy = false;
      renderAiAvailability();
    }
  }
}

async function acceptUploadedFile(file: File): Promise<void> {
  const revision = ++photoRevision;
  uploadBusy = true;
  feedback("upload-error", null);
  feedback("upload-file-note", () => t("uploadReading"));
  renderAiAvailability();
  try {
    const prepared = await prepareUploadedPhoto(file);
    if (revision !== photoRevision) return;
    releaseMainPhoto();
    photoMode = "upload";
    currentUpload = prepared;
    uploadMetadata = prepared.photo;
    resetRecordDraft(prepared.photo.id);
    recordDirty = true;
    showUploadedPhoto(prepared);
    renderSamplePresentation();
    feedback("upload-file-note", () => t("uploadReady", { filename: prepared.photo.originalName }));
  } catch (error) {
    if (!expectedStorageError(error)) throw error;
    console.error("CarbonTrace: uploaded photo could not be prepared.", error);
    if (revision === photoRevision) {
      feedback("upload-error", () => t("uploadFailed", { error: errorText(error) }));
      feedback("upload-file-note", null);
    }
  } finally {
    if (revision === photoRevision) {
      uploadBusy = false;
      renderAiAvailability();
    }
  }
}

function selectUploadSource(): void {
  photoRevision++;
  releaseMainPhoto();
  photoMode = "upload";
  currentUpload = null;
  uploadMetadata = null;
  uploadBusy = false;
  resetRecordDraft("");
  renderSamplePresentation();
  renderAiAvailability();
}

function requestPhotoChange(action: () => void): void {
  if (recordSaving || uploadBusy || analysisBusy) {
    showToast(() => t(analysisBusy ? "wizardWaitForAi" : uploadBusy ? "uploadReading" : "recordSaving"), true);
    return;
  }
  if (recordDirty) {
    openConfirmation(
      () => t("guardDraftTitle"), () => t("guardDraftDescription"), () => t("guardDraftConfirm"), action,
    );
  } else action();
}

function openUploadSource(): void {
  const open = () => {
    if (photoMode !== "upload") selectUploadSource();
    goToRecordStep(1);
    navigateView("workspace");
    controls.testPhoto.focus();
  };
  if (photoMode === "upload") open();
  else requestPhotoChange(open);
}

function renderSummary(): void {
  if (state === null) {
    for (const id of ["stat-count", "stat-weight", "stat-impact", "stat-pending", "record-count"]) text(id, "--");
    text("stat-confirmed", t("summaryUnavailable"));
    text("stat-impact-caption", t("checkStorage"));
    for (const material of MATERIALS) {
      text(`${material}-mass`, "--");
      text(`${material}-count`, t("recordsNotLoaded"));
      byId(`${material}-bar`, HTMLElement).style.width = "0%";
    }
    return;
  }
  const totals = summarizeManual(state.records);
  const groups = summarizeHistory(state.records).factorGroups;
  const singleGroup = groups.length === 1 ? groups[0] : undefined;
  text("stat-count", String(totals.count));
  text("stat-weight", formatters.kg.format(totals.weightKg));
  text("stat-impact", singleGroup === undefined ? "--" : formatters.kg.format(singleGroup.differenceKg));
  text("stat-pending", String(totals.missing));
  text("record-count", String(totals.count));
  const aiCount = state.records.filter((record) => record.analysis !== undefined && record.analysis !== null).length;
  text("stat-confirmed", t("recordStatistics", { count: totals.count, ai: aiCount }));
  text("stat-impact-caption", totals.calculated === 0
    ? t("summaryNoFactors")
    : groups.length > 1 ? t("summarySeparateBases", { groups: groups.length })
      : t("summaryCalculated", { calculated: totals.calculated, total: totals.count, missing: totals.missing }));
  for (const material of MATERIALS) {
    const matching = state.records.filter((record) => record.category === material);
    const weightKg = matching.reduce((sum, record) => sum + record.weightGrams, 0) / 1000;
    text(`${material}-mass`, formatters.kg.format(weightKg));
    text(`${material}-count`, t("confirmedCount", { count: matching.length }));
    byId(`${material}-bar`, HTMLElement).style.width = `${totals.weightKg === 0 ? 0 : weightKg / totals.weightKg * 100}%`;
  }
}
function renderSampleOptions(): void {
  const selected = controls.sample.value || "CT-007";
  const groups = [
    { label: t("trainingDataset"), samples: sortCatalogSamples(CATALOG_SAMPLES.filter((sample) => sample.role === "train")) },
    { label: t("testDataset"), samples: sortCatalogSamples(CATALOG_SAMPLES.filter((sample) => sample.role !== "train")) },
  ] as const;
  controls.sample.replaceChildren(...groups.map((group) => {
    const options = document.createElement("optgroup");
    options.label = group.label;
    for (const sample of group.samples) {
      options.append(new Option(sampleOptionLabel(sample), sample.id));
    }
    return options;
  }));
  controls.sample.value = selected;
}
function renderRecordNote(): void {
  const existing = state?.records.find((record) => record.sampleId === controls.sampleId.value);
  text("record-note", existing
    ? t("recordEditNote")
    : t("recordNewNote"));
  text("save-label", t(existing ? "updateRecord" : "saveRecord"));
}
function renderSamplePresentation(): void {
  const needsUpload = photoMode === "upload" && currentUpload === null;
  const uploadFlag = byId("upload-requirement", HTMLElement);
  const uploadLabel = needsUpload ? "fieldRequired" : "fieldPhotoReady";
  controls.testPhoto.setAttribute("aria-required", String(needsUpload));
  uploadFlag.dataset.i18n = uploadLabel;
  uploadFlag.classList.toggle("field-required", needsUpload);
  uploadFlag.textContent = t(uploadLabel);
  controls.catalogSource.setAttribute("aria-pressed", String(photoMode === "catalog"));
  controls.uploadSource.setAttribute("aria-pressed", String(photoMode === "upload"));
  byId("catalog-photo-picker", HTMLDivElement).hidden = photoMode !== "catalog";
  byId("upload-photo-picker", HTMLDivElement).hidden = photoMode !== "upload";
  byId("record-photo-preview", HTMLDivElement).hidden = photoMode === "upload" && currentUpload === null;
  byId("upload-empty", HTMLParagraphElement).hidden = photoMode !== "upload" || currentUpload !== null;
  if (photoMode === "upload") {
    controls.image.alt = uploadMetadata?.originalName ?? "";
    controls.image.title = uploadMetadata?.originalName ?? "";
    text("preview-id", uploadMetadata === null ? "" : `${uploadMetadata.id.slice(0, 12)}...`);
    byId("preview-id", HTMLElement).title = uploadMetadata?.id ?? "";
    text("sample-description", uploadMetadata === null ? "" : t("uploadedDescription"));
    text("photo-source", uploadMetadata === null ? "" : t("uploadedSource", {
      file: uploadMetadata.originalName, width: uploadMetadata.width, height: uploadMetadata.height,
    }));
    return;
  }
  const sample = getSample(controls.sample.value);
  controls.image.alt = t("photoAlt", { id: sample.id, name: sampleName(sample) });
  controls.image.title = t("photoTitle", { file: sample.imageFile });
  text("preview-id", sample.id);
  byId("preview-id", HTMLElement).title = sample.id;
  text("sample-description", sampleDescription(sample));
  const role = t(sample.role === "outside" ? "roleOutside" : sample.role === "train" ? "roleTrain" : "roleTest");
  text("photo-source", t("photoSource", { file: sample.imageFile, role }));
}
function resetRecordDraft(sampleId: string, existing?: MaterialRecord, step: RecordStep = 1): void {
  draftRevision++;
  controls.testPhoto.value = "";
  controls.sampleId.value = sampleId;
  controls.weight.value = existing ? inputNumber(existing.weightGrams) : "";
  controls.category.value = existing?.category ?? "";
  controls.estimateEnabled.checked = existing === undefined || existing.factors !== null;
  controls.category.removeAttribute("aria-invalid");
  currentAnalysis = existing?.analysis ?? null;
  historicalAnalysis = currentAnalysis !== null;
  recordStep = step;
  recordDirty = false;
  recordSaved = false;
  renderAiResult();
  weightTouched = false;
  controls.weight.removeAttribute("aria-invalid");
  feedback("weight-error", null);
  feedback("form-error", null);
  feedback("workflow-error", null);
  feedback("upload-error", null);
  feedback("upload-file-note", null);
  renderRecordNote();
  updateEstimate();
  renderAiAvailability();
  renderWorkflow();
}

function selectSample(sampleId: string, step: RecordStep = 1): void {
  const existing = state?.records.find((record) => record.sampleId === sampleId);
  if (isUploadedPhotoId(sampleId) && existing?.photo === undefined) {
    throw new ValidationError("Foto tersimpan tidak ditemukan atau tidak valid.");
  }
  if (existing?.photo === undefined) getSample(sampleId);
  photoRevision++;
  releaseMainPhoto();
  currentUpload = null;
  uploadMetadata = existing?.photo ?? null;
  uploadBusy = false;
  photoMode = uploadMetadata === null ? "catalog" : "upload";
  if (photoMode === "catalog") controls.sample.value = sampleId;
  resetRecordDraft(sampleId, existing, step);
  renderSamplePresentation();
  if (uploadMetadata !== null) void readRecordedPhoto(uploadMetadata, photoRevision);
  else setSamplePhoto(controls.image, sampleId);
  renderAiAvailability();
}

function assertSelectedPhoto(): void {
  if (photoMode === "catalog") {
    getSample(controls.sampleId.value);
  } else if (currentUpload === null || uploadMetadata === null || uploadMetadata.id !== controls.sampleId.value) {
    throw new ValidationError("Pilih foto katalog atau unggah foto sebelum melanjutkan.");
  }
}
function readWeight(): number {
  try {
    const weight = parseWeight(controls.weight.value);
    controls.weight.removeAttribute("aria-invalid");
    feedback("weight-error", null);
    return weight;
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    controls.weight.setAttribute("aria-invalid", "true");
    feedback("weight-error", () => errorText(error));
    throw error;
  }
}
function renderEstimateGuidance(summary: string, action: string, hasNegativeNet = false): void {
  for (const panel of controls.estimateGuidance) {
    find(panel, "[data-estimate-conclusion]", HTMLElement).textContent = summary;
    find(panel, "[data-estimate-action]", HTMLElement).textContent = action;
    find(panel, "[data-estimate-negative]", HTMLElement).hidden = !hasNegativeNet;
  }
}

function estimateNarrative(differenceKg: number, factors: DocumentedFactors): { summary: string; action: string } {
  const scenarios = factorScenarios(factors);
  const amount = formatters.factor.format(Math.abs(differenceKg));
  const roundsToZero = differenceKg !== 0 && amount === formatters.factor.format(0);
  const summary = roundsToZero ? t("estimateTinyDifference")
    : differenceKg === 0 ? t("estimateSame")
      : t(differenceKg > 0 ? "estimateAlternativeLower" : "estimateBaselineLower", {
        scenario: differenceKg > 0 ? scenarios.alternative : scenarios.baseline,
        amount,
      });
  const action = factors.material === "drywall" ? t("estimateDrywallAction")
    : roundsToZero ? t("estimateRecheckAction")
    : differenceKg === 0 ? t("estimateSameAction")
      : differenceKg > 0 && isParameterSetId(factors.parameterSetId)
        ? t("estimateRecycleAction") : t("estimateReviewAction");
  return { summary, action };
}

function updateEstimate(): void {
  text("sample-impact", "--");
  text("baseline-impact", "--");
  text("alternative-impact", "--");
  text("preview-baseline-name", t("baselineName"));
  text("preview-alternative-name", t("alternativeName"));
  const badge = byId("estimate-status", HTMLElement);
  badge.className = "badge badge-neutral";
  text("estimate-status", t("notCalculated"));
  renderEstimateGuidance(t("estimateUnavailable"), t("confirmBeforeEstimate"));
  const category = controls.category.value;
  let weight: number | null = null;
  if (controls.weight.value.trim() !== "" || weightTouched) {
    try { weight = readWeight(); }
    catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      text("estimate-note", errorText(error));
      renderEstimateGuidance(t("estimateUnavailable"), errorText(error));
      return;
    }
  }
  if (!isMaterial(category)) {
    text("estimate-note", t("confirmBeforeEstimate"));
    return;
  }
  if (!controls.estimateEnabled.checked) {
    text("estimate-status", t("estimateDisabled"));
    text("estimate-note", t("estimateDisabledHint"));
    renderEstimateGuidance(t("estimateDisabledHint"), t("estimateChoiceHint"));
    return;
  }
  if (config === null) {
    text("estimate-note", t("factorsUnavailable"));
    renderEstimateGuidance(t("estimateUnavailable"), t("factorsUnavailable"));
    return;
  }
  const factors = config[category];
  if (factors === null) {
    const active = activeParameterSetId(config);
    const unsupported = isParameterSetId(active) && getParameterSet(active).factors[category] === undefined;
    text("estimate-status", t(unsupported ? "outsideCoverage" : "missingFactors"));
    text("estimate-note", unsupported
      ? t("unsupportedFactorForMaterial", { material: materialName(category) })
      : t("missingFactorForMaterial", { material: materialName(category) }));
    renderEstimateGuidance(t("estimateUnavailable"), t("estimateChooseFactors", { material: materialName(category) }));
    return;
  }
  const scenarios = factorScenarios(factors);
  text("preview-baseline-name", scenarios.baseline);
  text("preview-alternative-name", scenarios.alternative);
  if (weight === null) {
    text("estimate-status", t("factorsAvailable"));
    text("estimate-note", t("enterWeight"));
    renderEstimateGuidance(t("estimateUnavailable"), t("enterWeight"));
    return;
  }
  try {
    const parts = compareScenario(weight, factors);
    text("baseline-impact", formatters.factor.format(parts.baselineKg));
    text("alternative-impact", formatters.factor.format(parts.alternativeKg));
    text("preview-baseline-name", scenarios.baseline);
    text("preview-alternative-name", scenarios.alternative);
    text("sample-impact", formatters.factor.format(parts.differenceKg));
    text("estimate-status", t("sourcedFactor"));
    badge.className = "badge badge-green";
    text("estimate-note", t("estimateSource", { name: factorName(factors), source: factorSource(factors) }));
    const { summary, action } = estimateNarrative(parts.differenceKg, factors);
    renderEstimateGuidance(summary, action, parts.hasNegativeNet);
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    text("estimate-note", errorText(error));
    renderEstimateGuidance(t("estimateUnavailable"), t("estimateRecheckAction"));
  }
}
function selectedParameterSet() {
  return controls.parameterSet.value === "custom" ? null : getParameterSet(controls.parameterSet.value);
}

function parameterMaterial(): Material {
  const material = returnToRecordReview ? controls.category.value : controls.factorMaterial.value;
  if (!isMaterial(material)) throw new Error("Unknown factor settings material.");
  return material;
}

function syncParameterMaterial(material: Material): void {
  controls.factorMaterial.value = material;
  const selected = config === null ? DEFAULT_PARAMETER_SET_IDS[material]
    : materialParameterSetId(config, material) ?? DEFAULT_PARAMETER_SET_IDS[material];
  renderParameterOptions(selected);
  renderFactorForm();
}

function ensureConfirmedDefault(): boolean {
  const material = controls.category.value;
  if (!isMaterial(material) || !controls.estimateEnabled.checked) return true;
  if (config === null) {
    showToast(() => t("factorsUnavailable"), true);
    return false;
  }
  const next = ensureMaterialDefault(config, material);
  return next === config || commitConfig(next, () => t("defaultParameterApplied", {
    material: materialName(material), name: parameterView(DEFAULT_PARAMETER_SET_IDS[material]).name,
  }));
}

function confirmRecordMaterial(): void {
  const material = controls.category.value;
  if (isMaterial(material)) controls.category.removeAttribute("aria-invalid");
  markRecordChanged();
  ensureConfirmedDefault();
  if (isMaterial(material)) syncParameterMaterial(material);
  updateEstimate();
  renderWorkflow();
}

function renderScenarioDescriptions(): void {
  const definition = selectedParameterSet();
  if (definition !== null) {
    const view = parameterView(definition.id);
    text("scenario-baseline-title", t("scenarioBaselineTitle", { name: view.baselineScenario }));
    text("scenario-alternative-title", t("scenarioAlternativeTitle", { name: view.alternativeScenario }));
    text("scenario-baseline-explanation", view.baselineDescription);
    text("scenario-alternative-explanation", view.alternativeDescription);
    text("scenario-context-note", t("scenarioSameMass"));
    return;
  }
  const baseline = controls.baselineScenario.value.trim();
  const alternative = controls.alternativeScenario.value.trim();
  text("scenario-baseline-title", t("scenarioBaselineTitle", { name: baseline || t("baselineDefault") }));
  text("scenario-alternative-title", t("scenarioAlternativeTitle", { name: alternative || t("alternativeDefault") }));
  text("scenario-baseline-explanation", t("customBaselineDescription"));
  text("scenario-alternative-explanation", t("customAlternativeDescription"));
  text("scenario-context-note", t("customScenarioContext"));
}

function renderParameterState(): void {
  const definition = selectedParameterSet();
  const material = parameterMaterial();
  const active = config === null ? null : materialParameterSetId(config, material);
  const globalActive = config === null ? null : activeParameterSetId(config);
  const activeText = config === null ? t("activeUnavailable")
    : active === null ? t("noActiveParameter")
      : active === "custom"
        ? t("activeMaterialCustom", { material: materialName(material), name: factorName(config[material]) })
        : t("activeMaterialParameter", { material: materialName(material), name: parameterView(active).name });
  text("active-parameter-note", activeText);
  text("overview-parameter-note", config === null ? t("activeUnavailable") : globalActive === null ? t("noActiveParameter")
    : t("activePerMaterial", { pet: factorName(config.pet), cardboard: factorName(config.cardboard), drywall: factorName(config.drywall) }));
  byId("parameter-material-picker", HTMLDivElement).hidden = returnToRecordReview;
  byId("parameter-material-context", HTMLParagraphElement).hidden = !returnToRecordReview;
  text("parameter-material-context", t("confirmedParameterMaterial", { material: materialName(material) })
    + (returnToRecordReview && !controls.estimateEnabled.checked ? ` ${t("estimateDisabledHint")}` : ""));
  controls.factorMaterial.disabled = returnToRecordReview;
  text("parameter-action-state", t(config === null ? "notLoaded" : definition === null
    ? "parameterCustomAction" : active === definition.id ? "presetActiveStatus" : "parameterPendingAction"));
  const actionState = byId("parameter-action-state", HTMLElement);
  actionState.classList.toggle("is-pending", config !== null && definition !== null && active !== definition.id);
  actionState.classList.toggle("is-active", config !== null && definition !== null && active === definition.id);
  byId("parameter-return-bar", HTMLDivElement).hidden = !returnToRecordReview;
  text("parameter-selection-note", definition === null
    ? t("customSelectedNote")
    : active === definition.id
      ? t("materialPresetActive", { material: materialName(material) })
      : t("presetDraft", { name: parameterView(definition.id).name, instructions: t("materialPresetDraft", { material: materialName(material) }) }));
  controls.applySet.textContent = definition === null ? t("applySet") : active === definition.id
    ? t("activeReferenceButton") : t("applyPreset", { coverage: materialName(material) });
  controls.applySet.hidden = definition === null;
  controls.applySet.disabled = config === null || (definition !== null && active === definition.id);
}

function renderParameterDocumentation(): void {
  const definition = selectedParameterSet();
  const material = parameterMaterial();
  if (!isMaterial(material)) throw new Error("Unknown documentation material.");
  const view = definition === null ? null : parameterView(definition.id);
  const stored = config?.[material];
  text("parameter-doc-title", view?.name ?? t("customParameter"));
  text("parameter-doc-summary", view?.summary ?? t("customDocSummary"));
  text("parameter-doc-usage", view?.whenToUse ?? t("customDocUsage"));
  text("parameter-doc-assumptions", view?.assumptions ?? (stored ? factorScope(stored) : t("customMissingScope")));
  text("parameter-values-caption", t(definition === null ? "storedFactorCaption" : "referenceFactorCaption"));
  const rows = [material].map((category) => {
    const row = document.createElement("tr");
    const active = config?.[category] ?? null;
    const reference = definition?.factors[category];
    const baseline = definition === null ? active?.baseline
      : reference === undefined ? undefined : normalizeParameterFactor(definition.id, reference.baselineOriginal);
    const alternative = definition === null ? active?.alternative
      : reference === undefined ? undefined : normalizeParameterFactor(definition.id, reference.alternativeOriginal);
    const values = [
      materialName(category),
      baseline === undefined ? "--" : formatters.factor.format(baseline),
      alternative === undefined ? "--" : formatters.factor.format(alternative),
      reference ? `${reference.baselineCell}/${reference.alternativeCell}`
        : definition !== null ? t("unsupported") : active === null ? t("unconfigured") : t("userSource"),
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  });
  byId("parameter-values", HTMLTableSectionElement).replaceChildren(...rows);
  text("parameter-unit-note", definition === null
    ? t("customUnitNote")
    : parameterView(definition.id).unitNote);
  text("parameter-location-note", definition === null
    ? t("customLocationNote")
    : parameterView(definition.id).locationNote);
  const references = definition === null
    ? [material].flatMap((category) => {
      const factors = config?.[category];
      return factors?.sourceUrl ? [{ label: factorSource(factors), url: factors.sourceUrl }] : [];
    })
    : parameterView(definition.id).links;
  const unique = [...new Map(references.map((reference) => [reference.url, reference])).values()];
  byId("parameter-reference-links", HTMLUListElement).replaceChildren(...unique.map((reference) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = reference.url;
    link.textContent = reference.label;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    item.append(link);
    return item;
  }));
}

function renderFactorForm(): void {
  const material = parameterMaterial();
  if (!isMaterial(material)) throw new Error("Unknown factor settings material.");
  const definition = selectedParameterSet();
  const factors = definition === null ? config?.[material] ?? null : createParameterSetConfig(definition.id)[material];
  factorFormSource = factors;
  editedFactorTextFields.clear();
  controls.baseline.value = factors === null ? "" : inputNumber(factors.baseline);
  controls.alternative.value = factors === null ? "" : inputNumber(factors.alternative);
  controls.sourceUrl.value = factors?.sourceUrl ?? "";
  renderFactorText();
  feedback("factor-error", null);
  renderFactorPresentation();
}

function renderFactorText(): void {
  const defaults = factorFormText(factorFormSource);
  for (const field of factorTextFields) {
    if (!editedFactorTextFields.has(field)) controls[field].value = defaults[field];
  }
}

function renderFactorPresentation(): void {
  const material = parameterMaterial();
  if (!isMaterial(material)) throw new Error("Unknown factor settings material.");
  const definition = selectedParameterSet();
  const factors = definition === null ? config?.[material] ?? null : createParameterSetConfig(definition.id)[material];
  const active = config === null ? null : materialParameterSetId(config, material);
  const applied = definition !== null && active === definition.id && factors !== null;
  text("factor-status", config === null ? t("notLoaded") : definition !== null
    ? t(factors === null ? "outsideCoverage" : applied ? "presetActiveStatus" : "presetPreview")
    : t(factors === null ? "unconfigured" : "savedStatus"));
  byId("factor-status", HTMLElement).className = `badge ${applied || (definition === null && factors !== null) ? "badge-green" : "badge-neutral"}`;
  for (const field of [controls.baseline, controls.alternative, controls.baselineScenario, controls.alternativeScenario, controls.sourceTitle, controls.sourceUrl, controls.scope]) {
    field.readOnly = definition !== null;
  }
  byId("save-factor", HTMLButtonElement).hidden = definition !== null;
  byId("clear-factor", HTMLButtonElement).hidden = definition !== null;
  controls.factorForm.hidden = definition !== null;
  byId("custom-factor-details", HTMLDetailsElement).hidden = definition !== null;
  text("factor-edit-note", definition === null
    ? t("customEditNote")
    : t("presetEditNote", { coverage: materialName(material) }));
  text("factor-current-note", factors === null
    ? definition === null ? t("missingCurrentFactor") : t("unsupportedCurrentFactor", { material: materialName(material) })
    : t("currentFactorNote", { label: definition === null ? factorName(factors) : t("referencePreview"), title: factorSource(factors), scope: factorScope(factors) }));
  const link = byId("factor-current-link", HTMLAnchorElement);
  link.hidden = factors === null || factors.sourceUrl === "";
  if (factors !== null && factors.sourceUrl !== "") link.href = factors.sourceUrl;
  else link.removeAttribute("href");
  byId("clear-factor", HTMLButtonElement).disabled = config === null || config[material] === null;
  renderScenarioDescriptions();
  renderParameterState();
  renderParameterDocumentation();
}
function renderDialog(): void {
  if (dialogText === null) return;
  text("dialog-title", dialogText.title());
  text("dialog-description", dialogText.description());
  text("dialog-confirm", dialogText.button());
}
function openConfirmation(title: UiText, description: UiText, buttonLabel: UiText, action: () => void): void {
  dialogText = { title, description, button: buttonLabel };
  renderDialog();
  dialogAction = action;
  controls.dialog.showModal();
}
function recordedMass(grams: number): string {
  const value = formatters.grams.format(grams);
  return grams > 0 && value === formatters.grams.format(0)
    ? t("historyMassBelowPrecision", { value: formatters.grams.format(0.001) })
    : `${value} g`;
}

function renderHistoryInsights(records: readonly MaterialRecord[]): void {
  controls.historyInsightContent.hidden = true;
  controls.historyInsightEmpty.hidden = true;
  controls.historyInsightError.hidden = true;
  controls.historyInsightStart.hidden = true;
  controls.historyInsightMissing.hidden = true;
  controls.historyInsightGroups.replaceChildren();
  if (state === null) {
    text("history-insight-scope", t("historyInsightsUnavailable"));
    controls.historyInsightEmpty.textContent = t("emptyStorageNote");
    controls.historyInsightEmpty.hidden = false;
    return;
  }
  text("history-insight-scope", t("historyInsightsScope", { shown: records.length, total: state.records.length }));
  if (records.length === 0) {
    controls.historyInsightEmpty.textContent = t(state.records.length === 0 ? "historyInsightsEmpty" : "emptyFilteredNote");
    controls.historyInsightEmpty.hidden = false;
    controls.historyInsightStart.hidden = state.records.length !== 0;
    return;
  }
  let summary: ReturnType<typeof summarizeHistory>;
  try {
    summary = summarizeHistory(records);
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    console.error("CarbonTrace: history insights could not be calculated.", error);
    text("history-insight-scope", t("historyInsightsUnavailable"));
    controls.historyInsightError.textContent = errorText(error);
    controls.historyInsightError.hidden = false;
    return;
  }
  controls.historyInsightContent.hidden = false;
  text("history-insight-weight", recordedMass(summary.weightGrams));
  text("history-insight-count", t("historyInsightCount", { count: summary.count }));
  const materialItems = MATERIALS.filter((material) => summary.materials[material].count > 0);
  byId("history-insight-materials", HTMLUListElement).replaceChildren(...materialItems.map((material) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = materialName(material);
    const mass = document.createElement("strong");
    mass.textContent = t("historyMaterialMass", {
      mass: recordedMass(summary.materials[material].weightGrams),
      count: summary.materials[material].count,
    });
    item.append(name, mass);
    return item;
  }));
  text("history-insight-coverage", t("historyFactorCoverage", { ready: summary.estimated, count: summary.count }));
  text("history-insight-missing-count", t("historyMissingCount", { count: summary.missing }));
  text("history-insight-ai", t("historyFactorCoverage", { ready: summary.aiAssisted, count: summary.count }));
  text("history-insight-ai-note", t("historyAiMethods", { manual: summary.manual, corrected: summary.corrected }));
  const groups = summary.factorGroups;
  const groupMass = groups.reduce((total, group) => total + group.weightGrams, 0);
  text("history-insight-comparison-scope", t("historyComparisonScope", {
    count: summary.estimated, mass: recordedMass(groupMass), groups: groups.length,
  }));
  const single = groups.length === 1 ? groups[0] : null;
  const basis = byId("history-insight-basis", HTMLParagraphElement);
  basis.hidden = single === null;
  if (single !== null) basis.textContent = t("historyGroupTitle", {
    material: materialName(single.factors.material), reference: factorName(single.factors),
  });
  text("history-insight-takeaway", single === null
    ? t(groups.length === 0 ? "historyNoComparison" : "historyMixedComparison")
    : estimateNarrative(single.differenceKg, single.factors).summary);
  text("history-insight-action", summary.missing > 0
    ? t("historyCompleteFactors", { count: summary.missing })
    : single === null ? t("historyReviewGroups") : estimateNarrative(single.differenceKg, single.factors).action);
  controls.historyInsightMissing.hidden = summary.missing === 0 || controls.status.value === "missing";
  controls.historyInsightDetails.hidden = groups.length === 0;
  text("history-insight-details-label", t("historyGroupDetails", { count: groups.length }));
  controls.historyInsightGroups.replaceChildren(...groups.map((group) => {
    const card = find(document.importNode(controls.historyInsightTemplate.content, true), "article", HTMLElement);
    const factors = group.factors;
    find(card, ".history-group-title", HTMLElement).textContent = materialName(factors.material);
    find(card, ".history-group-reference", HTMLElement).textContent = factorName(factors);
    find(card, ".history-group-count", HTMLElement).textContent = t("historyGroupCount", {
      count: group.count, mass: recordedMass(group.weightGrams),
    });
    const narrative = estimateNarrative(group.differenceKg, factors);
    find(card, ".history-group-result", HTMLElement).textContent = narrative.summary;
    find(card, ".history-group-action", HTMLElement).replaceChildren(...narrative.action.split("\n\n").map((paragraph) => {
      const element = document.createElement("p");
      element.textContent = paragraph;
      return element;
    }));
    const scenarios = factorScenarios(factors);
    find(card, ".history-group-baseline", HTMLElement).textContent = scenarios.baseline;
    find(card, ".history-group-alternative", HTMLElement).textContent = scenarios.alternative;
    find(card, ".history-group-source", HTMLElement).textContent = factorSource(factors);
    find(card, ".history-group-scope", HTMLElement).replaceChildren(...factorScopeParagraphs(factors).map((paragraph) => {
      const element = document.createElement("p");
      element.textContent = paragraph;
      return element;
    }));
    const link = find(card, ".history-group-link", HTMLAnchorElement);
    link.hidden = factors.sourceUrl === "";
    if (factors.sourceUrl !== "") link.href = factors.sourceUrl;
    return card;
  }));
}

function renderRecords(): void {
  const revision = ++recordsRevision;
  for (const url of recordPhotoUrls) URL.revokeObjectURL(url);
  recordPhotoUrls = [];
  const status = controls.status.value;
  const material = controls.material.value;
  if (status !== "all" && status !== "estimated" && status !== "missing") throw new Error("Unknown estimate filter.");
  if (material !== "all" && !isMaterial(material)) throw new Error("Unknown material filter.");
  const query = controls.search.value.trim().toLocaleLowerCase(languageLocale());
  const filtered = state === null ? [] : filterManualRecords(state.records, "", status, material).filter((record) => {
    if (record.photo !== undefined) {
      return uploadedPhotoSearchText(record.photo, record.category).toLocaleLowerCase(languageLocale()).includes(query);
    }
    const sample = getSample(record.sampleId);
    return sampleSearchText(sample, record.category)
      .toLocaleLowerCase(languageLocale()).includes(query);
  });
  controls.rows.replaceChildren(...filtered.map((record) => {
    const row = find(document.importNode(controls.template.content, true), "tr", HTMLTableRowElement);
    const image = find(row, ".record-image", HTMLImageElement);
    if (record.photo !== undefined) void renderUploadedThumbnail(image, record.photo, revision);
    else setSamplePhoto(image, record.sampleId);
    find(row, ".record-name", HTMLElement).textContent = record.photo?.originalName ?? sampleName(getSample(record.sampleId));
    find(row, ".record-id", HTMLElement).textContent = t("recordIdSource", { id: record.sampleId });
    find(row, ".record-weight", HTMLElement).textContent = recordedMass(record.weightGrams);
    find(row, ".record-material", HTMLElement).textContent = materialName(record.category);
    find(row, ".record-method", HTMLElement).textContent = record.analysis
      ? t(record.analysis.category === record.category ? "aiConfirmed" : "aiCorrected")
      : t("manualMethod");
    const aiNote = find(row, ".record-ai", HTMLElement);
    aiNote.hidden = !record.analysis;
    if (record.analysis) {
      aiNote.textContent = t("recordAi", { material: materialName(record.analysis.category), score: formatters.score.format(record.analysis.score) });
      aiNote.title = `${record.analysis.modelVersion} / ${formatters.date.format(new Date(record.analysis.analyzedAt))}`;
    }
    const source = find(row, ".record-source", HTMLElement);
    source.textContent = record.factors === null ? t("unconfigured") : factorSource(record.factors);
    source.title = t("recordSourceNote", { parameter: factorName(record.factors), scope: record.factors === null ? t("missingRecordScope") : factorScope(record.factors) });
    find(row, ".record-parameter-set", HTMLElement).textContent = factorName(record.factors);
    const sourceLink = find(row, ".record-source-link", HTMLAnchorElement);
    sourceLink.hidden = record.factors === null || record.factors.sourceUrl === "";
    if (record.factors !== null && record.factors.sourceUrl !== "") sourceLink.href = record.factors.sourceUrl;
    const impact = manualRecordImpact(record);
    const impactElement = find(row, ".record-impact", HTMLElement);
    impactElement.textContent = impact === null ? "--" : formatters.factor.format(impact);
    impactElement.classList.toggle("negative", impact !== null && impact < 0);
    find(row, ".record-impact-unit", HTMLElement).textContent = t(impact === null ? "missingFactors" : "impactUnit");
    const review = find(row, ".review-record", HTMLButtonElement);
    review.setAttribute("aria-label", t("editRecordAria", { id: record.sampleId }));
    review.addEventListener("click", () => {
      requestSampleSelection(record.sampleId, 2);
    });
    const remove = find(row, ".delete-record", HTMLButtonElement);
    remove.setAttribute("aria-label", t("deleteRecordAria", { id: record.sampleId }));
    remove.addEventListener("click", () => openConfirmation(
      () => t("deleteRecordTitle", { id: record.sampleId }),
      () => t(record.photo === undefined ? "deleteRecordDescription" : "deleteUploadDescription"),
      () => t("deleteRecordAction"),
      () => deleteRecord(record),
    ));
    return row;
  }));
  const empty = byId("empty-state", HTMLDivElement);
  empty.hidden = filtered.length !== 0;
  text("empty-title", t(state === null ? "summaryUnavailable" : state.records.length === 0 ? "emptyNoRecords" : "emptyNoMatches"));
  text("empty-description", t(state === null ? "emptyStorageNote" : state.records.length === 0 ? "emptyNewNote" : "emptyFilteredNote"));
  byId("clear-filters", HTMLButtonElement).hidden = state === null || state.records.length === 0;
  text("filter-count", state === null ? t("storageNotLoaded") : t("filterCount", { shown: filtered.length, total: state.records.length }));
  renderHistoryInsights(filtered);
}

async function renderUploadedThumbnail(image: HTMLImageElement, photo: UploadedPhoto, revision: number): Promise<void> {
  image.alt = photo.originalName;
  try {
    const prepared = await loadUploadedPhoto(photo);
    if (revision !== recordsRevision || !image.isConnected) return;
    const url = URL.createObjectURL(prepared.blob);
    recordPhotoUrls.push(url);
    image.onload = () => {
      if (revision !== recordsRevision) return;
      failedPhotos.delete(photo.id);
      renderPhotoErrors();
    };
    image.onerror = () => {
      if (revision !== recordsRevision) return;
      failedPhotos.add(photo.id);
      renderPhotoErrors();
    };
    image.src = url;
  } catch (error) {
    if (!expectedStorageError(error)) throw error;
    console.error("CarbonTrace: uploaded record thumbnail could not be loaded.", error);
    if (revision === recordsRevision) {
      failedPhotos.add(photo.id);
      image.title = errorText(error);
      renderPhotoErrors();
    }
  }
}

function deleteRecord(record: MaterialRecord): void {
  if (state === null || recordSaving) {
    showToast(() => t(recordSaving ? "recordSaving" : "summaryUnavailable"), true);
    return;
  }
  if (!commitState(
    { ...state, records: state.records.filter((item) => item.sampleId !== record.sampleId) },
    () => t("recordDeleted", { id: record.sampleId }),
  )) return;
  if (record.photo !== undefined) {
    if (controls.sampleId.value === record.sampleId) selectUploadSource();
    failedPhotos.delete(record.sampleId);
    renderPhotoErrors();
    void deleteUploadedPhoto(record.sampleId).catch((error: unknown) => {
      if (!expectedStorageError(error)) throw error;
      console.error("CarbonTrace: deleted record photo could not be removed.", error);
      showToast(() => t("photoDeleteFailed", { error: errorText(error) }), true);
    });
  }
}
function renderArchive(): void {
  const archive = state?.archive;
  byId("legacy-archive", HTMLDetailsElement).hidden = archive === undefined || archive.length === 0;
  text("archive-count", archive === undefined ? "--" : String(archive.length));
  const list = byId("archive-list", HTMLUListElement);
  list.replaceChildren(...(archive ?? []).map((record) => {
    const item = document.createElement("li");
    item.textContent = t("archiveItem", { id: record.sampleId, name: sampleName(getSample(record.sampleId)), weight: formatters.grams.format(record.weightGrams) });
    return item;
  }));
  byId("export-archive", HTMLButtonElement).disabled = archive === undefined || archive.length === 0;
}
function renderAll(): void {
  renderStorageStatus();
  renderSummary();
  renderSampleOptions();
  renderRecordNote();
  renderRecords();
  renderArchive();
  updateEstimate();
  controls.save.disabled = state === null || config === null;
  byId("export-button", HTMLButtonElement).disabled = state === null;
  byId("save-factor", HTMLButtonElement).disabled = config === null;
  renderAiAvailability();
  renderParameterState();
  renderWorkflow();
}
function downloadCsv(csv: string, prefix: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const viewLabels: Readonly<Record<AppView, MessageKey>> = {
  overview: "navOverview", workspace: "navRecord", records: "navHistory",
  "factor-settings": "navFactors", methodology: "navMethod",
};

function activateNavigation(focus = false): void {
  let view = viewFromHash(location.hash, activeView);
  if (view === null) {
    console.warn("CarbonTrace: unknown view.", location.hash);
    view = "overview";
    history.replaceState(null, "", "#overview");
    showToast(() => t("unknownView"), true);
  }
  const changed = activeView !== view;
  activeView = view;
  for (const id of VIEW_IDS) byId(id, HTMLElement).hidden = id !== activeView;
  for (const link of document.querySelectorAll<HTMLAnchorElement>(".nav-link")) {
    const active = link.hash === `#${activeView}`;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (activeView !== "factor-settings") returnToRecordReview = false;
  text("current-view-label", t(viewLabels[activeView]));
  document.title = `${t(viewLabels[activeView])} | CarbonTrace`;
  renderParameterState();
  if (focus || changed) {
    byId("main", HTMLElement).scrollIntoView({ behavior: "instant", block: "start" });
    const heading = byId(activeView, HTMLElement).querySelector<HTMLElement>("h1,h2");
    if (heading !== null) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }
}

function navigateView(view: AppView): void {
  if (location.hash === `#${view}`) activateNavigation(true);
  else location.hash = view;
}

function markRecordChanged(): void {
  draftRevision++;
  recordDirty = true;
  recordSaved = false;
  feedback("form-error", null);
  feedback("workflow-error", null);
  renderWorkflow();
}

function validatedRecordInput(): { weight: number; category: Material } {
  const category = controls.category.value;
  if (!isMaterial(category)) {
    controls.category.setAttribute("aria-invalid", "true");
    controls.category.focus();
    throw new ValidationError("Pilih material berdasarkan pemeriksaan Anda.");
  }
  controls.category.removeAttribute("aria-invalid");
  weightTouched = true;
  const weight = readWeight();
  return { weight, category };
}

function renderWorkflow(): void {
  const existing = state?.records.some((record) => record.sampleId === controls.sampleId.value) ?? false;
  if (recordSaved && !existing) {
    recordSaved = false;
    recordDirty = false;
    recordStep = 1;
  }
  for (const section of document.querySelectorAll<HTMLElement>("[data-record-step]")) {
    section.hidden = section.dataset.recordStep !== String(recordStep);
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-workflow-step]")) {
    const step = Number(button.dataset.workflowStep);
    button.disabled = step > recordStep || recordSaving || uploadBusy || analysisBusy;
    button.classList.toggle("is-complete", step < recordStep || recordSaved);
    if (step === recordStep) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  }
  text("workflow-step-count", t("wizardStepCount", { step: recordStep }));
  text("workflow-draft-status", t(recordSaved ? "wizardSavedBadge" : existing ? "wizardExistingBadge" : "wizardDraftBadge"));
  controls.workflowBack.hidden = recordStep === 1 || recordSaved;
  controls.workflowNext.hidden = recordStep === 4;
  controls.workflowNext.disabled = analysisBusy || uploadBusy || recordSaving;
  controls.workflowNext.textContent = t(analysisBusy ? "predictBusy" : uploadBusy ? "uploadReading" : recordSaving ? "recordSaving"
    : recordStep === 1 ? "wizardNextDetails" : recordStep === 2 ? "wizardNextEstimate" : "wizardNextSave");
  controls.save.hidden = recordStep !== 4 || recordSaved;
  byId("workflow-success", HTMLDivElement).hidden = !recordSaved;
  byId("workflow-save-hint", HTMLParagraphElement).hidden = recordSaved;
  byId("record-note", HTMLParagraphElement).hidden = recordSaved;
  text("workflow-saved-message", t("wizardSavedBody", { id: controls.sampleId.value }));
  const category = controls.category.value;
  const factors = controls.estimateEnabled.checked && config !== null && isMaterial(category) ? config[category] : null;
  const factorLabel = controls.estimateEnabled.checked ? factorName(factors) : t("estimateDisabled");
  controls.estimateEnabled.disabled = recordSaving || analysisBusy || uploadBusy;
  text("review-parameter-name", factorLabel);
  text("record-parameter-note", factors !== null && isMaterial(category) && factors.parameterSetId === DEFAULT_PARAMETER_SET_IDS[category]
    ? t("defaultReferenceScope") : "");
  text("step-ai-note", currentAnalysis === null ? t("wizardManualNote") : t("wizardAiNote", {
    material: materialName(currentAnalysis.category), score: formatters.score.format(currentAnalysis.score),
    version: currentAnalysis.modelVersion,
  }));
  text("review-sample", controls.sampleId.value || "--");
  text("review-photo", photoMode === "upload" ? uploadMetadata?.originalName ?? "--" : getSample(controls.sample.value).imageFile);
  text("review-material", isMaterial(category) ? materialName(category) : "--");
  let weight: number | null = null;
  if (controls.weight.value.trim() !== "") {
    try { weight = parseWeight(controls.weight.value); }
    catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      if (recordStep >= 3) feedback("workflow-error", () => errorText(error));
    }
  }
  text("review-weight", weight === null ? "--" : `${formatters.grams.format(weight)} g`);
  text("review-method", currentAnalysis === null ? t("manualMethod")
    : t(currentAnalysis.category === category ? "aiConfirmed" : "aiCorrected"));
  text("review-factor", factorLabel);
  const impact = byId("sample-impact", HTMLElement).textContent;
  text("review-impact", impact === "--" || !impact ? "--" : `${impact} kg CO2e`);
}

function goToRecordStep(step: RecordStep): void {
  recordStep = step;
  feedback("workflow-error", null);
  updateEstimate();
  renderWorkflow();
  const heading = document.querySelector<HTMLElement>(`[data-record-step="${step}"] h3`);
  if (heading !== null && activeView === "workspace") {
    byId("workspace", HTMLElement).scrollIntoView({ behavior: "instant", block: "start" });
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

function advanceRecordStep(): void {
  if (analysisBusy) {
    feedback("workflow-error", () => t("wizardWaitForAi"));
    return;
  }
  try {
    if (uploadBusy || recordSaving) throw new ValidationError("Tunggu proses foto atau penyimpanan selesai sebelum melanjutkan.");
    assertSelectedPhoto();
    if (recordStep >= 2) validatedRecordInput();
    goToRecordStep(nextRecordStep(recordStep));
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    feedback("workflow-error", () => errorText(error));
    if (photoMode === "upload" && currentUpload === null) {
      recordStep = 1;
      renderWorkflow();
      controls.testPhoto.focus();
    } else if (recordStep >= 2) {
      recordStep = 2;
      renderWorkflow();
      if (!isMaterial(controls.category.value)) controls.category.focus();
      else controls.weight.focus();
    }
  }
}

function requestSampleSelection(sampleId: string, step: RecordStep = 1): void {
  if (recordSaving || uploadBusy || analysisBusy) {
    if (photoMode === "catalog") controls.sample.value = controls.sampleId.value;
    showToast(() => t(analysisBusy ? "wizardWaitForAi" : uploadBusy ? "uploadReading" : "recordSaving"), true);
    return;
  }
  const current = controls.sampleId.value;
  if (recordDirty && sampleId !== current) {
    if (photoMode === "catalog") controls.sample.value = current;
    openConfirmation(
      () => t("guardDraftTitle"), () => t("guardDraftDescription"), () => t("guardDraftConfirm"),
      () => { selectSample(sampleId, step); if (activeView !== "workspace") navigateView("workspace"); },
    );
    return;
  }
  if (recordDirty && sampleId === current) goToRecordStep(step);
  else selectSample(sampleId, step);
  if (activeView !== "workspace") navigateView("workspace");
}

function renderParameterOptions(selected = controls.parameterSet.value || "custom"): void {
  const material = parameterMaterial();
  const definitions = parameterSetsForMaterial(material);
  const preferred = config === null ? DEFAULT_PARAMETER_SET_IDS[material]
    : materialParameterSetId(config, material) ?? DEFAULT_PARAMETER_SET_IDS[material];
  const next = selected === "custom" || definitions.some((definition) => definition.id === selected) ? selected : preferred;
  controls.parameterSet.replaceChildren(
    ...definitions.map((definition) => new Option(`${parameterView(definition.id).name}${definition.id === DEFAULT_PARAMETER_SET_IDS[material] ? t("defaultParameterSuffix") : ""}`, definition.id)),
    new Option(t("customOption", { name: t("customParameter") }), "custom"),
  );
  controls.parameterSet.value = next;
}

function refreshLocalizedInterface(): void {
  document.documentElement.lang = getLanguage();
  controls.language.value = getLanguage();
  controls.theme.value = getTheme();
  formatters = createFormatters();
  translateDocument(document);
  renderParameterOptions();
  renderAll();
  renderFactorText();
  renderFactorPresentation();
  renderSamplePresentation();
  renderAiResult();
  renderModelState();
  activateNavigation();
  for (const [id, message] of feedbackMessages) text(id, message());
  if (toastMessage !== null) text("toast", toastMessage());
  if (controls.dialog.open) renderDialog();
}

controls.language.addEventListener("change", () => {
  const next = controls.language.value;
  if (!isLanguage(next)) {
    console.error("CarbonTrace: unsupported language option.", next);
    controls.language.value = getLanguage();
    showToast(() => t("invalidLanguageChoice"), true);
    return;
  }
  try {
    localStorage.setItem(LANGUAGE_KEY, next);
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
    console.error("CarbonTrace: language preference was not saved.", error);
    languageError = () => t("languageSaveError", { name: error.name });
    controls.language.value = getLanguage();
    renderStorageStatus();
    showToast(languageError, true);
    return;
  }
  setLanguage(next);
  languageError = null;
  refreshLocalizedInterface();
});

controls.theme.addEventListener("change", () => {
  const next = controls.theme.value;
  if (!isTheme(next)) {
    console.error("CarbonTrace: unsupported theme option.", next);
    controls.theme.value = getTheme();
    showToast(() => t("invalidThemeChoice"), true);
    return;
  }
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
    console.error("CarbonTrace: theme preference was not saved.", error);
    themeError = () => t("themeSaveError", { name: error.name });
    controls.theme.value = getTheme();
    renderStorageStatus();
    showToast(themeError, true);
    return;
  }
  setTheme(next);
  themeError = null;
  renderTheme();
  renderStorageStatus();
});

controls.sample.addEventListener("change", () => requestSampleSelection(controls.sample.value));
controls.catalogSource.addEventListener("click", () => {
  if (photoMode === "catalog") return;
  requestPhotoChange(() => selectSample(controls.sample.value));
});
controls.uploadSource.addEventListener("click", openUploadSource);
byId("guide-upload-button", HTMLButtonElement).addEventListener("click", openUploadSource);
controls.weight.addEventListener("input", () => { weightTouched = true; markRecordChanged(); updateEstimate(); renderWorkflow(); });
controls.category.addEventListener("change", confirmRecordMaterial);
controls.estimateEnabled.addEventListener("change", () => {
  markRecordChanged();
  ensureConfirmedDefault();
  const material = controls.category.value;
  if (isMaterial(material)) syncParameterMaterial(material);
  updateEstimate();
  renderWorkflow();
});
controls.workflowNext.addEventListener("click", advanceRecordStep);
controls.workflowBack.addEventListener("click", () => goToRecordStep(previousRecordStep(recordStep)));
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-workflow-step]")) {
  button.addEventListener("click", () => {
    const step = Number(button.dataset.workflowStep);
    if (!isRecordStep(step) || !RECORD_STEPS.includes(step) || step > recordStep) throw new Error("This recording step is not available.");
    goToRecordStep(step);
  });
}
byId("review-parameters-button", HTMLButtonElement).addEventListener("click", () => {
  const material = controls.category.value;
  if (!isMaterial(material)) {
    feedback("workflow-error", () => t("confirmBeforeEstimate"));
    return;
  }
  returnToRecordReview = true;
  syncParameterMaterial(material);
  recordSaved = false;
  renderWorkflow();
  navigateView("factor-settings");
});
byId("return-to-review", HTMLButtonElement).addEventListener("click", () => {
  returnToRecordReview = false;
  navigateView("workspace");
  recordStep = 2;
  advanceRecordStep();
});
byId("next-sample-button", HTMLButtonElement).addEventListener("click", () => {
  recordSaved = false;
  goToRecordStep(1);
  if (photoMode === "upload") controls.testPhoto.focus();
  else controls.sample.focus();
});
controls.form.addEventListener("submit", (event) => {
  event.preventDefault();
  void persistRecord();
});

async function persistRecord(): Promise<void> {
  if (recordSaving) return;
  feedback("form-error", null);
  if (recordStep !== 4) {
    advanceRecordStep();
    return;
  }
  let insertedPhoto = false;
  let committed = false;
  const prepared = currentUpload;
  try {
    if (state === null || config === null) throw new ValidationError("Periksa penyimpanan sebelum menyimpan catatan.");
    if (analysisBusy || uploadBusy) throw new ValidationError("Tunggu proses foto atau penyimpanan selesai sebelum melanjutkan.");
    assertSelectedPhoto();
    const { weight, category } = validatedRecordInput();
    const id = controls.sampleId.value;
    const exists = state.records.some((record) => record.sampleId === id);
    const before = state;
    const revision = draftRevision;
    if (controls.estimateEnabled.checked && config[category] === null) {
      throw new ValidationError("Pilih rujukan yang sesuai atau matikan estimasi sebelum menyimpan.");
    }
    const recordConfig = recordFactorConfig(config, category, controls.estimateEnabled.checked);
    const next = saveManualRecord(state, id, weight, category, recordConfig, new Date().toISOString(), currentAnalysis, uploadMetadata);
    recordSaving = true;
    renderAiAvailability();
    if (prepared !== null) insertedPhoto = await storeUploadedPhoto(prepared);
    if (revision !== draftRevision || state !== before) throw new ValidationError("Draft berubah selama penyimpanan. Periksa kembali lalu simpan ulang.");
    committed = commitState(next, () => t(exists ? "recordUpdated" : "recordSaved"));
    if (committed) {
      recordDirty = false;
      recordSaved = true;
      if (prepared !== null) feedback("upload-file-note", () => t("uploadStored", { filename: prepared.photo.originalName }));
      renderWorkflow();
    }
  } catch (error) {
    if (!expectedStorageError(error)) throw error;
    console.error("CarbonTrace: material record could not be saved.", error);
    const savingFailed = recordSaving;
    feedback("form-error", () => savingFailed ? t("photoSaveFailed", { error: errorText(error) }) : errorText(error));
    if (!recordSaving && state !== null && config !== null) {
      recordStep = photoMode === "upload" && currentUpload === null ? 1 : 2;
      renderWorkflow();
    }
  } finally {
    if (insertedPhoto && !committed && prepared !== null) {
      try { await deleteUploadedPhoto(prepared.photo.id); }
      catch (error) {
        if (!expectedStorageError(error)) throw error;
        console.error("CarbonTrace: unsaved photo rollback failed.", error);
        feedback("form-error", () => t("photoCleanupFailed", { error: errorText(error) }));
      }
    }
    recordSaving = false;
    renderAiAvailability();
  }
}
controls.parameterSet.addEventListener("change", () => {
  renderFactorForm();
  byId("parameter-documentation", HTMLDetailsElement).open = selectedParameterSet() !== null;
  byId("custom-factor-details", HTMLDetailsElement).open = selectedParameterSet() === null;
});
controls.factorMaterial.addEventListener("change", () => {
  if (returnToRecordReview) {
    controls.factorMaterial.value = parameterMaterial();
    return;
  }
  syncParameterMaterial(parameterMaterial());
});
for (const field of factorTextFields) {
  controls[field].addEventListener("input", () => editedFactorTextFields.add(field));
}
controls.baselineScenario.addEventListener("input", renderScenarioDescriptions);
controls.alternativeScenario.addEventListener("input", renderScenarioDescriptions);
controls.applySet.addEventListener("click", () => {
  const id = controls.parameterSet.value;
  if (config === null || !isParameterSetId(id)) {
    feedback("factor-error", () => t("invalidPreset"));
    return;
  }
  const material = parameterMaterial();
  if (getParameterSet(id).factors[material] === undefined) {
    showToast(() => t("unsupportedCurrentFactor", { material: materialName(material) }), true);
    return;
  }
  if (materialParameterSetId(config, material) === id) {
    showToast(() => t("alreadyActive"));
    return;
  }
  const apply = () => {
    if (config === null) {
      showToast(() => t("factorUnavailableChange"), true);
      return;
    }
    commitConfig(applyMaterialParameterSet(config, id, material), () => t("materialPresetApplied", {
      name: parameterView(id).name, material: materialName(material),
    }));
  };
  if (config[material] !== null) {
    openConfirmation(
      () => t("replaceParameterTitle"),
      () => t("replaceMaterialParameterDescription", { name: parameterView(id).name, material: materialName(material) }),
      () => t("applySet"),
      apply,
    );
  } else {
    apply();
  }
});
controls.factorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  feedback("factor-error", null);
  try {
    if (controls.parameterSet.value !== "custom") {
      throw new ValidationError("Gunakan Terapkan set untuk menyimpan rujukan, atau pilih Parameter khusus untuk mengedit.");
    }
    const material = parameterMaterial();
    if (config === null || !isMaterial(material)) throw new ValidationError("Pengaturan faktor belum siap dimuat.");
    const factors = createDocumentedFactors(material, {
      baseline: controls.baseline.value, alternative: controls.alternative.value,
      baselineScenario: controls.baselineScenario.value, alternativeScenario: controls.alternativeScenario.value,
      sourceTitle: controls.sourceTitle.value, sourceUrl: controls.sourceUrl.value, scope: controls.scope.value,
    });
    commitConfig({ ...config, [material]: factors }, () => t("factorSaved"));
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    feedback("factor-error", () => errorText(error));
  }
});
byId("clear-factor", HTMLButtonElement).addEventListener("click", () => {
  if (controls.parameterSet.value !== "custom") {
    feedback("factor-error", () => t("customNeededToClear"));
    return;
  }
  const material = parameterMaterial();
  if (config === null || !isMaterial(material)) {
    showToast(() => t("factorUnavailableChange"), true);
    return;
  }
  openConfirmation(
    () => t("clearFactorTitle", { material: materialName(material) }),
    () => t("clearFactorDescription"),
    () => t("clearFactors"),
    () => {
      if (config === null) {
        showToast(() => t("factorUnavailableChange"), true);
        return;
      }
      if (commitConfig({ ...config, [material]: null }, () => t("factorCleared")) && returnToRecordReview) {
        controls.estimateEnabled.checked = false;
        updateEstimate();
        renderWorkflow();
      }
    },
  );
});
controls.search.addEventListener("input", renderRecords);
controls.status.addEventListener("change", renderRecords);
controls.material.addEventListener("change", renderRecords);
controls.historyInsightMissing.addEventListener("click", () => {
  controls.status.value = "missing";
  renderRecords();
  controls.status.focus();
});
byId("clear-filters", HTMLButtonElement).addEventListener("click", () => {
  controls.search.value = "";
  controls.status.value = "all";
  controls.material.value = "all";
  renderRecords();
});
byId("export-button", HTMLButtonElement).addEventListener("click", () => {
  if (state === null) { showToast(() => t("exportUnavailable"), true); return; }
  downloadCsv(exportManualCsv(state), "carbontrace-catatan");
  const count = state.records.length;
  showToast(() => t("exportStarted", { count }));
});
byId("export-archive", HTMLButtonElement).addEventListener("click", () => {
  if (state === null) { showToast(() => t("archiveUnavailable"), true); return; }
  downloadCsv(exportArchiveCsv(state.archive), "carbontrace-arsip-contoh");
  showToast(() => t("archiveExportStarted"));
});
byId("retry-storage", HTMLButtonElement).addEventListener("click", () => location.reload());
byId("dialog-cancel", HTMLButtonElement).addEventListener("click", () => controls.dialog.close());
byId("dialog-confirm", HTMLButtonElement).addEventListener("click", () => {
  const action = dialogAction;
  controls.dialog.close();
  action?.();
});
controls.dialog.addEventListener("close", () => { dialogAction = null; dialogText = null; });
window.addEventListener("hashchange", () => activateNavigation(true));
for (const link of document.querySelectorAll<HTMLAnchorElement>(".nav-link")) {
  link.addEventListener("click", (event) => {
    const view = viewFromHash(link.hash);
    if (view === null) throw new Error("Unknown navigation target.");
    event.preventDefault();
    if (view === "factor-settings") returnToRecordReview = false;
    navigateView(view);
  });
}
controls.predict.addEventListener("click", () => { void analyzeRecordPhoto(); });
controls.retryAi.addEventListener("click", () => { void initializeAi(); });
controls.guideRetryAi.addEventListener("click", () => { void initializeAi(); });
controls.testPhoto.addEventListener("change", () => {
  const file = controls.testPhoto.files?.[0];
  controls.testPhoto.value = "";
  if (file !== undefined) requestPhotoChange(() => { void acceptUploadedFile(file); });
});
byId("use-ai-suggestion", HTMLButtonElement).addEventListener("click", () => {
  if (currentAnalysis === null) {
    feedback("ai-error", () => t("analyzeFirst"));
    return;
  }
  controls.category.value = currentAnalysis.category;
  confirmRecordMaterial();
  goToRecordStep(2);
});
byId("clear-ai-result", HTMLButtonElement).addEventListener("click", () => {
  currentAnalysis = null;
  historicalAnalysis = false;
  markRecordChanged();
  renderAiResult();
  showToast(() => t("aiCleared"));
});

const initialParameterSet = config === null ? null : materialParameterSetId(config, parameterMaterial());
renderParameterOptions(initialParameterSet ?? DEFAULT_PARAMETER_SET_IDS[parameterMaterial()]);
document.documentElement.lang = getLanguage();
controls.language.value = getLanguage();
translateDocument(document);
byId("parameter-guide-link", HTMLAnchorElement).href = parameterGuideUrl;
byId("parameter-word-link", HTMLAnchorElement).href = parameterWordUrl;
byId("parameter-documentation", HTMLDetailsElement).open = selectedParameterSet() !== null;
renderAll();
renderFactorForm();
selectSample("CT-007");
activateNavigation();
void initializeAi();
