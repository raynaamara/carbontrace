import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATALOG_SAMPLES, compareScenario, getSample, parseWeight } from "../src/model.ts";
import { PARAMETER_SETS } from "../src/parameter-sets.ts";
import {
  activeParameterSetId, createDocumentedFactors, createParameterSetConfig,
  deserializeFactorConfig, emptyFactorConfig, exportManualCsv, migrateLegacyData,
  saveManualRecord, serializeFactorConfig,
} from "../src/operational.ts";
import {
  LANGUAGE_KEY, createFormatters, errorText, errorTranslations, getLanguage,
  inputNumber, isLanguage, isMessageKey, messages, setLanguage, t,
} from "../src/i18n.ts";
import {
  coverageName, factorFormText, factorName, factorScenarios, factorScope, factorScopeParagraphs, factorSource,
  materialName, parameterView, sampleDescription, sampleName, sampleOptionLabel, sampleSearchText, uploadedPhotoSearchText,
} from "../src/localized-content.ts";

const NOW = "2026-10-24T09:00:00.000Z";
afterEach(() => setLanguage("id"));

test("history reference paragraphs retain documented assumptions and conversions in both languages without changing snapshots", () => {
  for (const definition of PARAMETER_SETS) {
    const config = createParameterSetConfig(definition.id, NOW);
    const serialized = serializeFactorConfig(config);
    const factors = Object.values(config).find((value) => value !== null);
    for (const language of ["id", "en"]) {
      setLanguage(language);
      const paragraphs = factorScopeParagraphs(factors);
      assert.equal(paragraphs.length, 2);
      assert.ok(paragraphs.every((paragraph) => paragraph.length > 0));
      const text = paragraphs.join(" ");
      if (definition.id.startsWith("warm16-")) {
        for (const phrase of ["20", language === "id" ? "mil" : "miles", "US short ton", "kg CO2e"]) assert.ok(text.includes(phrase), phrase);
        if (definition.id === "warm16-drywall-us-average-r1") {
          for (const phrase of ["E53/C53", "H2S", language === "id" ? "setengah inci" : "half-inch"]) assert.ok(text.includes(phrase), phrase);
        }
        if (definition.id === "warm16-no-lfg-r1") assert.ok(text.includes(language === "id" ? "tidak memiliki sistem" : "no gas collection"));
      } else {
        for (const phrase of ["Indonesia", "20 km", "95%", "Ecoinvent v3.9", language === "id" ? "1.000.000" : "1,000,000", "24", "2026"]) assert.ok(text.includes(phrase), phrase);
        assert.ok(text.includes(definition.id.includes("sanitary") ? "Sanitary Landfill" : "Open Dump"));
      }
      assert.equal(serializeFactorConfig(config), serialized);
    }
  }
});

test("custom and legacy reference context stays literal rather than being rewritten as a preset", () => {
  const scope = 'Custom <b>literal</b>; 0.022327 kg/kg.\n\nURL https://example.org/v1.2; user wording.';
  const factors = createDocumentedFactors("pet", {
    baseline: "1", alternative: "0", baselineScenario: "Initial", alternativeScenario: "Alternative",
    sourceTitle: "Custom source", sourceUrl: "", scope,
  }, NOW);
  const { parameterSetId, parameterSetName, ...legacy } = factors;
  for (const language of ["id", "en"]) {
    setLanguage(language);
    assert.deepEqual(factorScopeParagraphs(factors), [scope]);
    assert.deepEqual(factorScopeParagraphs(legacy), [scope]);
  }
  assert.equal(factors.scope, scope);
});

test("parameter copy explains missing-only defaults, per-material application and explicit estimate opt-out", () => {
  for (const language of ["id", "en"]) {
    setLanguage(language);
    assert.ok(t("factorIntro").includes(language === "id" ? "pilihan tersimpan tetap dipakai" : "saved choices are kept"));
    assert.ok(t("defaultReferenceScope").includes(language === "id" ? "asumsi Amerika Serikat" : "US assumptions"));
    assert.ok(t("estimateChoiceHint").includes(language === "id" ? "tanpa estimasi" : "without an estimate"));
    assert.ok(t("confirmedParameterMaterial", { material: "PET" }).includes(language === "id" ? "tidak perlu dipilih ulang" : "no need to select it again"));
    assert.ok(t("materialPresetApplied", { name: "test", material: "PET" }).includes(language === "id" ? "material lain" : "Other materials"));
  }
});

test("drywall explanations distinguish lower modeled GHG from disposal advice in both languages", () => {
  for (const language of ["id", "en"]) {
    setLanguage(language);
    assert.ok(t("estimateDrywallAction").includes("H2S"));
    assert.ok(t("estimateDrywallAction").includes(language === "id" ? "bukan anjuran landfill" : "not landfill advice"));
    assert.ok(t("estimateNegativeExplanation").includes(language === "id" ? "penyimpanan karbon" : "carbon storage"));
    assert.ok(t("modelSummary", { train: 78, newCorrect: 14, newTotal: 14, oldCorrect: 28, oldTotal: 28, version: "test" }).includes("drywall"));
    assert.ok(t("methodModelBody").includes(language === "id" ? "hanya berisi drywall" : "only drywall"));
    assert.ok(t("factorDisclaimer").includes("H2S"));
    assert.equal(coverageName("warm16-drywall-us-average-r1"), language === "id" ? "papan gipsum saja" : "drywall only");
  }
});

test("language selection accepts only Indonesian or English and defaults to Indonesian", () => {
  assert.equal(getLanguage(), "id");
  assert.equal(LANGUAGE_KEY, "carbontrace.language.v1");
  for (const value of ["id", "en"]) assert.equal(isLanguage(value), true);
  for (const value of [null, "fr", "en-US", "", 1]) assert.equal(isLanguage(value), false);
  assert.throws(() => setLanguage("fr"), /Unsupported/);
  assert.equal(getLanguage(), "id");
});

test("every message has both languages with identical interpolation requirements", () => {
  assert.ok(Object.keys(messages).length > 200);
  for (const [key, pair] of Object.entries(messages)) {
    assert.equal(pair.length, 2, key);
    assert.ok(pair.every((value) => typeof value === "string" && value.trim() !== ""), key);
    const parameters = (text) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();
    assert.deepEqual(parameters(pair[0]), parameters(pair[1]), key);
    for (const language of ["id", "en"]) {
      setLanguage(language);
      const values = Object.fromEntries(parameters(pair[0]).map((name) => [name.slice(1, -1), "example"]));
      assert.ok(t(key, values).length > 0);
    }
  }
});

test("all HTML translation markers resolve, including placeholders, accessibility and templates", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const markers = [...html.matchAll(/data-i18n(?:-placeholder|-aria|-alt|-content|-html)?="([^"]+)"/g)];
  assert.ok(markers.length > 100);
  for (const [, key] of markers) assert.ok(isMessageKey(key), key);
  assert.ok(html.includes('id="language-select"'));
  assert.ok(html.includes('value="id">Bahasa Indonesia'));
  assert.ok(html.includes('value="en">English'));
  for (const [, key] of html.matchAll(/data-i18n-html="([^"]+)"/g)) {
    assert.equal(/\{\w+\}/.test(messages[key][0]), false, key);
  }
});

test("missing translation keys and interpolation values fail explicitly", () => {
  assert.equal(isMessageKey("unknown.key"), false);
  assert.throws(() => t("unknown.key"), /Unknown translation/);
  assert.throws(() => t("aiScore"), /Missing translation value/);
  setLanguage("en");
  assert.equal(t("aiScore", { score: "95.2%" }), "Photo score 95.2%");
  setLanguage("id");
  assert.equal(t("saveRecord"), "Simpan catatan");
});

test("analysis copy separates a photo score from test accuracy and explains the supported materials", () => {
  setLanguage("en");
  assert.equal(t("aiScore", { score: "95%" }), "Photo score 95%");
  for (const phrase of ["PET bottles, cardboard", "paper-faced drywall", "for this photo", "high score can still be wrong", "other materials", "before saving", "cement board is not drywall"]) {
    assert.ok(t("aiCaution").includes(phrase), phrase);
  }
  assert.equal(/resin|out-of-scope|score is not accuracy/.test(t("aiCaution")), false);
  assert.ok(t("smallTestCaution").includes("percentage of test photos classified correctly"));
  setLanguage("id");
  assert.equal(t("aiScore", { score: "95%" }), "Skor foto 95%");
  for (const phrase of ["botol PET, kardus", "papan gipsum", "foto ini", "meskipun skornya tinggi", "bahan lain", "benda sebelum menyimpan"]) {
    assert.ok(t("aiCaution").includes(phrase), phrase);
  }
  assert.ok(t("smallTestCaution").includes("persentase foto uji yang diklasifikasikan dengan benar"));
});

test("overview invitation explains the data problem, checked weights and reference-based estimates in both languages", () => {
  const expectations = {
    id: { problem: ["material", "berat"], solution: ["AI", "botol PET", "kardus", "papan gipsum", "memeriksa", "hasil timbang", "estimasi emisi", "TPA", "daur ulang", "rujukan"], hint: ["katalog", "unggah"] },
    en: { problem: ["material", "weight"], solution: ["AI", "PET bottle", "cardboard", "Check", "measured weight", "emission estimates", "landfill", "recycling", "documented factors"], hint: ["catalog", "upload"] },
  };
  for (const [language, expected] of Object.entries(expectations)) {
    setLanguage(language);
    for (const phrase of expected.problem) assert.ok(t("overviewIntroProblem").includes(phrase), `${language}: ${phrase}`);
    for (const phrase of expected.solution) assert.ok(t("overviewIntroSolution").includes(phrase), `${language}: ${phrase}`);
    for (const phrase of expected.hint) assert.ok(t("overviewPhotoHint").includes(phrase), `${language}: ${phrase}`);
  }
});

test("usage flow descriptions stay brief and explain optional AI, required weighing and explicit local saving", () => {
  for (const language of ["id", "en"]) {
    setLanguage(language);
    for (const key of ["flowPhotoDescription", "flowDetailsDescription", "flowEstimateDescription", "flowSaveDescription"]) {
      assert.ok(t(key).trim().split(/\s+/).length <= 30, `${language}: ${key}`);
    }
    for (const phrase of language === "id" ? ["katalog", "unggah", "manual"] : ["catalog", "upload", "manually"]) {
      assert.ok(t("flowPhotoDescription").includes(phrase), phrase);
    }
    assert.ok(t("flowAiOptional").includes(language === "id" ? "opsional" : "optional"));
    assert.ok(t("flowDetailsDescription").includes(language === "id" ? "hasil timbang" : "measured weight"));
    assert.ok(t("flowDetailsDescription").includes(language === "id" ? "gram" : "grams"));
    assert.ok(t("flowEstimateDescription").includes(language === "id" ? "tanpa angka CO2e" : "without a CO2e estimate"));
    assert.ok(t("flowEstimateOptional").includes(language === "id" ? "opsional" : "optional"));
    assert.ok(t("flowSaveDescription").includes(language === "id" ? "Tekan Simpan" : "Press Save"));
    assert.ok(t("flowSaveDescription").includes("CSV"));
    assert.ok(t("flowLocalStorage").includes("browser"));
  }
});

test("emission conclusions explain negative net values and distinguish a rounded difference from an exact tie", () => {
  const result = compareScenario(22, { baseline: 0.022327, alternative: -1.141687 });
  for (const language of ["id", "en"]) {
    setLanguage(language);
    const formatter = createFormatters().factor;
    const scenario = 'A custom scenario <b>kept as text</b>';
    const amount = formatter.format(result.differenceKg);
    const conclusion = t("estimateAlternativeLower", { scenario, amount });
    assert.ok(conclusion.includes(scenario));
    assert.ok(conclusion.includes(amount));
    assert.ok(conclusion.includes(language === "id" ? "lebih rendah" : "lower than"));
    assert.ok(t("estimateNegativeExplanation").includes(language === "id" ? "bukan pengukuran CO2" : "not a measurement of CO2"));
    assert.ok(t("estimateModelScope").includes(language === "id" ? "bukan bukti" : "not evidence"));
    assert.ok(t("estimateModelScope").includes(language === "id" ? "kredit karbon" : "carbon credit"));
    for (const [baseline, alternative] of [[1e-8, 0], [0, 1e-8]]) {
      const tiny = compareScenario(1, { baseline, alternative });
      assert.notEqual(tiny.differenceKg, 0);
      assert.equal(formatter.format(Math.abs(tiny.differenceKg)), formatter.format(0));
    }
    assert.ok(t("estimateTinyDifference").includes(language === "id" ? "tidak nol" : "not zero"));
    assert.ok(t("estimateSame").includes(language === "id" ? "sama" : "same net"));
    assert.ok(t("estimateChooseFactors", { material: "Cardboard" }).includes(language === "id" ? "tidak dianggap nol" : "not treated as zero"));
  }
});

test("history insight copy scopes filters, saved references, missing factors and AI counts without verified-impact claims", () => {
  for (const language of ["id", "en"]) {
    setLanguage(language);
    assert.ok(t("historyInsightsScope", { shown: 1, total: 3 }).includes(language === "id" ? "sesuai filter" : "matching the filters"));
    assert.ok(t("historyStoredScope").includes(language === "id" ? "faktor tersimpan" : "stored factors"));
    assert.ok(t("historyStoredScope").includes(language === "id" ? "belum membuktikan" : "do not establish"));
    assert.ok(t("historyGroupPolicy").includes(language === "id" ? "tidak membuat satu total" : "does not create one emission total"));
    assert.ok(t("historyCompleteFactors", { count: 2 }).includes(language === "id" ? "simpan ulang" : "resave"));
    assert.ok(t("historyAiCaution").includes(language === "id" ? "bukan ukuran akurasi" : "not a measure of model accuracy"));
    assert.ok(t("historyNoComparison").includes(language === "id" ? "tidak dianggap nol" : "not treated as zero"));
  }
});

test("number, percentage and date presentation follows the selected locale without changing inputs", () => {
  const id = createFormatters();
  assert.equal(id.kg.format(1.2345), "1,235");
  assert.equal(id.grams.format(1234.5), "1.234,5");
  assert.equal(id.factor.format(-2.497533), "-2,497533");
  assert.equal(inputNumber(24.5), "24,5");
  const date = new Date("2026-10-24T09:00:00Z");
  const idDate = id.date.format(date);
  setLanguage("en");
  const en = createFormatters();
  assert.equal(en.kg.format(1.2345), "1.235");
  assert.equal(en.grams.format(1234.5), "1,234.5");
  assert.equal(en.factor.format(-2.497533), "-2.497533");
  assert.equal(en.score.format(0.975), "97.5%");
  assert.equal(inputNumber(24.5), "24.5");
  assert.notEqual(en.date.format(date), idDate);
  assert.equal(parseWeight("24,5"), 24.5);
  assert.equal(parseWeight("24.5"), 24.5);
});

test("all catalog names and descriptions keep stable IDs and status-free option labels in both languages", () => {
  const before = JSON.stringify(CATALOG_SAMPLES);
  for (const language of ["id", "en"]) {
    setLanguage(language);
    for (const sample of CATALOG_SAMPLES) {
      assert.ok(sampleName(sample).length > 0, sample.id);
      assert.ok(sampleDescription(sample).length > 0, sample.id);
      assert.equal(sampleName(sample), materialName(sample.material));
      assert.doesNotMatch(sampleName(sample), /\d/);
      assert.ok(sampleDescription(sample).startsWith(language === "id" ? "Foto referensi:" : "Reference photo:"));
      assert.ok(sampleDescription(sample).includes(t(sample.role === "outside" ? "roleDescriptionOutside"
        : sample.role === "train" ? "roleDescriptionTrain" : sample.testCohort === "previous-test" ? "roleDescriptionOld" : "roleDescriptionNew")));
      assert.equal(sampleOptionLabel(sample), `${sample.id} / ${sampleName(sample)}`);
      assert.doesNotMatch(sampleOptionLabel(sample), /\((?:exploratory|eksplorasi|recorded|tercatat)\)/i);
    }
    assert.equal(new Set(CATALOG_SAMPLES.map(sampleOptionLabel)).size, CATALOG_SAMPLES.length);
  }
  assert.equal(sampleName(getSample("CT-007")), "PET bottle");
  assert.equal(sampleOptionLabel(getSample("CT-007")), "CT-007 / PET bottle");
  assert.equal(sampleOptionLabel(getSample("SYN-CRD-009")), "SYN-CRD-009 / Cardboard");
  assert.equal(materialName("pet"), "PET bottle");
  assert.equal(materialName("cardboard"), "Cardboard");
  assert.equal(JSON.stringify(CATALOG_SAMPLES), before);
  setLanguage("id");
  assert.equal(sampleName(getSample("CT-007")), "Botol PET");
  assert.equal(sampleOptionLabel(getSample("CT-007")), "CT-007 / Botol PET");
});

test("search aliases retain Indonesian and English names across language changes", () => {
  const sample = getSample("CT-003");
  const id = sampleSearchText(sample, "pet");
  assert.ok(id.includes("Kotak pengiriman kecil"));
  assert.ok(id.includes("Small shipping box"));
  assert.ok(id.includes("Kardus 003"));
  assert.ok(id.includes("Cardboard 003"));
  assert.ok(id.includes("PET bottle"));
  setLanguage("en");
  assert.equal(sampleSearchText(sample, "pet"), id);
  const photo = { id: "UPL-example", originalName: "My Original Photo.png" };
  const uploaded = uploadedPhotoSearchText(photo, "pet");
  assert.ok(uploaded.includes(photo.originalName));
  assert.ok(uploaded.includes("Botol PET"));
  assert.ok(uploaded.includes("PET bottle"));
  setLanguage("id");
  assert.equal(uploadedPhotoSearchText(photo, "pet"), uploaded);
});

test("all preset views translate text but retain source URLs, numeric factors and canonical snapshots", () => {
  for (const definition of PARAMETER_SETS) {
    setLanguage("id");
    const config = createParameterSetConfig(definition.id, NOW);
    const primary = config.pet ?? config.drywall;
    const serialized = serializeFactorConfig(config);
    const originalView = parameterView(definition.id);
    assert.equal(originalView.name, definition.name);
    assert.equal(factorSource(primary), primary.sourceTitle);
    assert.equal(factorScope(primary), primary.scope);
    setLanguage("en");
    const view = parameterView(definition.id);
    assert.notEqual(view.name, definition.name);
    assert.equal(view.links.length, 3);
    assert.deepEqual(view.links.map((link) => link.url), definition.reference.links.map((link) => link.url));
    assert.ok(factorName(primary).includes("Set"));
    assert.ok(factorSource(primary).includes(view.referenceTitle));
    assert.equal(factorScenarios(primary).baseline, view.baselineScenario);
    assert.equal(activeParameterSetId(config), definition.id);
    assert.equal(serializeFactorConfig(config), serialized);
    assert.deepEqual(createParameterSetConfig(definition.id, NOW), config);
    assert.deepEqual(deserializeFactorConfig(serialized), config);
    assert.equal(coverageName(definition.id), definition.factors.drywall ? "drywall only" : definition.factors.cardboard ? "PET and cardboard" : "PET only");
  }
});

test("user-authored scenario names and source wording are not machine-translated", () => {
  const factors = createDocumentedFactors("pet", {
    baseline: "1", alternative: "0.5", baselineScenario: "Skenario saya",
    alternativeScenario: "Pilihan saya", sourceTitle: "Dokumen asli saya",
    sourceUrl: "https://example.com", scope: "Batas dan wilayah pilihan saya",
  }, NOW);
  setLanguage("en");
  assert.equal(factorName(factors), "Custom parameters");
  assert.equal(factorSource(factors), "Dokumen asli saya");
  assert.equal(factorScope(factors), "Batas dan wilayah pilihan saya");
  assert.deepEqual(factorScenarios(factors), { baseline: "Skenario saya", alternative: "Pilihan saya" });
  assert.equal(factorName(null), "Not configured");
});

test("editable reference defaults use the selected language for every supported material without changing canonical factors", () => {
  for (const definition of PARAMETER_SETS) {
    const config = createParameterSetConfig(definition.id, NOW);
    const canonical = serializeFactorConfig(config);
    for (const factors of [config.pet, config.cardboard, config.drywall]) {
      if (factors === null) continue;
      setLanguage("id");
      assert.deepEqual(factorFormText(factors), {
        baselineScenario: factors.baselineScenario, alternativeScenario: factors.alternativeScenario,
        sourceTitle: factors.sourceTitle, scope: factors.scope,
      });
      setLanguage("en");
      const fields = factorFormText(factors);
      assert.equal(fields.baselineScenario, parameterView(definition.id).baselineScenario);
      assert.equal(fields.alternativeScenario, parameterView(definition.id).alternativeScenario);
      assert.equal(fields.sourceTitle, factorSource(factors));
      assert.equal(fields.scope, factorScope(factors));
      for (const key of ["baselineScenario", "alternativeScenario", "sourceTitle", "scope"]) {
        assert.notEqual(fields[key], factors[key], `${definition.id}/${factors.material}/${key}`);
      }
    }
    assert.equal(serializeFactorConfig(config), canonical);
  }
});

test("custom defaults retain original text even when copied verbatim from a reference", () => {
  const reference = createParameterSetConfig("warm16-us-average-r1", NOW).pet;
  const custom = createDocumentedFactors("pet", {
    baseline: String(reference.baseline), alternative: String(reference.alternative),
    baselineScenario: reference.baselineScenario, alternativeScenario: reference.alternativeScenario,
    sourceTitle: reference.sourceTitle, sourceUrl: reference.sourceUrl, scope: reference.scope,
  }, NOW);
  setLanguage("id");
  const original = factorFormText(custom);
  setLanguage("en");
  assert.deepEqual(factorFormText(custom), original);
  assert.deepEqual(factorFormText(null), { baselineScenario: "", alternativeScenario: "", sourceTitle: "", scope: "" });
});

test("CSV research data remains byte-identical across interface languages", () => {
  const config = createParameterSetConfig("warm16-us-average-r1", NOW);
  const state = saveManualRecord(migrateLegacyData(null), "CT-001", 24.5, "pet", config, NOW);
  const original = exportManualCsv(state);
  setLanguage("en");
  assert.equal(exportManualCsv(state), original);
  assert.equal(original.trim().split("\r\n")[0].split(",").length, 32);
  assert.equal(emptyFactorConfig().pet, null);
});

test("repository validation and classifier errors have an English translation", () => {
  const files = ["model.ts", "operational.ts", "photos.ts", "ai-contract.ts", "parameter-sets.ts", "app.ts"];
  for (const file of files) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    for (const [, message] of source.matchAll(/new ValidationError\("([^"]+)"\)/g)) {
      assert.ok(Object.hasOwn(errorTranslations, message), `${file}: ${message}`);
    }
  }
  const source = readFileSync(new URL("../src/classifier.ts", import.meta.url), "utf8");
  for (const [, message] of source.matchAll(/new Error\("([^"]+)"\)/g)) {
    assert.ok(Object.hasOwn(errorTranslations, message), message);
  }
  setLanguage("en");
  assert.equal(errorText(new Error("Berat harus berupa angka lebih dari 0 gram.")), "Weight must be a number greater than 0 grams.");
  assert.equal(errorText(new Error("Metadata model gagal dimuat (HTTP 503).")), "Model metadata could not be loaded (HTTP 503).");
  assert.equal(errorText(new Error("Native browser diagnostic")), "Native browser diagnostic");
  for (const field of ["baselineScenario", "alternativeScenario", "sourceTitle", "scope"]) {
    const input = { baseline: "1", alternative: "0", baselineScenario: "Awal", alternativeScenario: "Alternatif", sourceTitle: "Sumber", sourceUrl: "", scope: "Lingkup", [field]: "" };
    assert.throws(() => createDocumentedFactors("pet", input, NOW), (error) => {
      assert.ok(Object.hasOwn(errorTranslations, error.message), error.message);
      assert.notEqual(errorText(error), error.message);
      return true;
    });
  }
});
