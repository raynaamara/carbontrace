import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  RECORD_STEPS, VIEW_IDS, isRecordStep, nextRecordStep, previousRecordStep, viewFromHash,
} from "../src/workflow.ts";

test("five distinct menu views retain existing deep-link routes", () => {
  assert.deepEqual(VIEW_IDS, ["overview", "workspace", "records", "factor-settings", "methodology"]);
  for (const view of VIEW_IDS) assert.equal(viewFromHash(`#${view}`), view);
  assert.equal(viewFromHash(""), "overview");
  assert.equal(viewFromHash("#"), "overview");
  assert.equal(viewFromHash("#main", "records"), "records");
  assert.equal(viewFromHash("#unknown"), null);
});

test("all material selectors and overview mass controls include drywall without changing the recording steps", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const id of ["category-confirmation", "factor-material", "material-filter"]) {
    const select = new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)</select>`).exec(html);
    assert.ok(select && select[1].includes('value="drywall" data-i18n="drywall"'));
  }
  for (const id of ["drywall-mass", "drywall-count", "drywall-bar"]) assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.indexOf('id="factor-material"') < html.indexOf('id="custom-factor-details"'));
  assert.match(html, /<meta name="description"[^>]*content="[^"]*papan gipsum/);
  const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
  assert.ok(app.includes('factors.material === "drywall" ? t("estimateDrywallAction")'));
  assert.ok(app.includes('groups.length > 1 ? t("summarySeparateBases"'));
});

test("parameter context follows confirmation and the record has an explicit estimate opt-out", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(html.includes('id="parameter-material-picker"'));
  assert.ok(html.includes('id="parameter-material-context"'));
  assert.ok(html.includes('id="estimate-enabled" type="checkbox" checked'));
  assert.ok(html.includes('data-i18n="estimateChoiceHint"'));
  const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
  assert.ok(app.includes('controls.category.addEventListener("change", confirmRecordMaterial)'));
  assert.ok(app.includes('byId("parameter-material-picker", HTMLDivElement).hidden = returnToRecordReview'));
  assert.ok(app.includes('parameterSetsForMaterial(material)'));
  assert.ok(app.includes('recordFactorConfig(config, category, controls.estimateEnabled.checked)'));
});

test("recording has exactly four guarded steps", () => {
  assert.deepEqual(RECORD_STEPS, [1, 2, 3, 4]);
  for (const step of RECORD_STEPS) assert.equal(isRecordStep(step), true);
  for (const invalid of [null, "1", 0, 5, 2.5, NaN]) assert.equal(isRecordStep(invalid), false);
});

test("forward and backward progression remain inside the supported steps", () => {
  assert.deepEqual(RECORD_STEPS.map(nextRecordStep), [2, 3, 4, 4]);
  assert.deepEqual(RECORD_STEPS.map(previousRecordStep), [1, 1, 2, 3]);
});

test("HTML declares one view per menu, four recording steps, and unique element IDs", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const views = [...html.matchAll(/<section id="([^"]+)"[^>]*\bdata-view\b/g)].map((match) => match[1]);
  assert.deepEqual([...views].sort(), [...VIEW_IDS].sort());
  const steps = [...html.matchAll(/\bdata-record-step="(\d)"/g)].map((match) => Number(match[1]));
  assert.deepEqual(steps, [...RECORD_STEPS]);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "Element IDs must remain unique when components move.");
  for (const id of ["workflow-next", "workflow-back", "workflow-success", "return-to-review", "guide-retry-ai", "test-photo", "model-summary", "export-button"]) {
    assert.ok(ids.includes(id), id);
  }
  assert.equal(ids.filter((id) => id === "sample-form").length, 1);
  assert.equal(ids.filter((id) => id === "factor-form").length, 1);
});

test("own-photo upload belongs to recording and the guide links to that same workflow", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const workspace = html.slice(html.indexOf('<section id="workspace"'), html.indexOf('<section id="factor-settings"'));
  const guide = html.slice(html.indexOf('<section id="methodology"'));
  assert.ok(workspace.includes('id="test-photo"'));
  assert.ok(workspace.includes('id="choose-upload-source"'));
  assert.ok(workspace.includes('id="choose-catalog-source"'));
  assert.equal(guide.includes('type="file"'), false);
  assert.ok(guide.includes('id="guide-upload-button"'));
});

test("estimate review and save share visible conclusions, next actions and a conditional negative-net explanation", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const [step, id] of [[3, "estimate-guidance"], [4, "review-estimate-guidance"]]) {
    const start = html.indexOf(`<section data-record-step="${step}"`);
    const end = step === 3 ? html.indexOf('<section data-record-step="4"', start) : html.indexOf("</form>", start);
    const section = html.slice(start, end);
    assert.ok(section.includes(`id="${id}" class="estimate-guidance" aria-live="polite"`));
    assert.ok(section.includes('data-estimate-conclusion'));
    assert.ok(section.includes('data-estimate-action'));
    assert.match(section, /<aside\b[^>]*\bdata-estimate-negative\b[^>]*\bhidden\b/);
    for (const key of ["estimateNegativeTitle", "estimateNegativeExplanation", "estimateConclusionTitle",
      "estimateActionLabel", "estimateModelScope"]) {
      assert.ok(section.includes(`data-i18n="${key}"`), `${step}: ${key}`);
    }
  }
});

test("overview explains the problem before statistics and links to existing recording and guide views", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const overview = html.slice(html.indexOf('<section id="overview"'), html.indexOf('<section id="workspace"'));
  const intro = /<section class="overview-intro"[^>]*>([\s\S]*?)<\/section>/.exec(overview);
  assert.ok(intro);
  assert.ok(intro[0].includes('aria-labelledby="overview-intro-title"'));
  assert.ok(intro[1].includes('id="overview-intro-title"'));
  for (const key of ["overviewIntroTitle", "overviewIntroProblem", "overviewIntroSolution",
    "overviewTryPhoto", "overviewSeeHow", "overviewPhotoHint"]) {
    assert.ok(intro[1].includes(`data-i18n="${key}"`), key);
  }
  const links = [...intro[1].matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(links, ["#workspace", "#methodology"]);
  assert.ok(overview.indexOf(intro[0]) < overview.indexOf('class="stats-grid"'));
  assert.equal([...overview.matchAll(/href="#workspace"/g)].length, 1, "Keep one primary invitation to try recording.");
  assert.ok(overview.includes('data-i18n-html="notice"'), "Keep the estimate and carbon-credit scope note.");
});

test("homepage flow shows the same four recording stages with decorative connectors and no validation shortcuts", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const overview = html.slice(html.indexOf('<section id="overview"'), html.indexOf('<section id="workspace"'));
  const flow = /<section id="usage-flow"[\s\S]*?<\/section>/.exec(overview)?.[0];
  assert.ok(flow);
  assert.ok(flow.includes('aria-labelledby="usage-flow-title"'));
  assert.ok(flow.includes('<ol class="usage-flow" role="list">'));
  assert.deepEqual([...flow.matchAll(/data-flow-step="(\d)"/g)].map((match) => Number(match[1])), [...RECORD_STEPS]);
  const titles = [...flow.matchAll(/<h3 data-i18n="(wizardPhoto|wizardDetails|wizardEstimate|wizardSave)"/g)].map((match) => match[1]);
  assert.deepEqual(titles, ["wizardPhoto", "wizardDetails", "wizardEstimate", "wizardSave"]);
  assert.equal([...flow.matchAll(/class="icon usage-flow-connector" aria-hidden="true"/g)].length, 3);
  assert.equal(/<(?:button|input|select|textarea)\b|data-workflow-step=/.test(flow), false);
  for (const key of ["flowPhotoDescription", "flowDetailsDescription", "flowEstimateDescription", "flowSaveDescription",
    "flowAiOptional", "fieldRequired", "flowEstimateOptional", "flowLocalStorage"]) {
    assert.ok(flow.includes(`data-i18n="${key}"`), key);
  }
  assert.ok(flow.includes('id="overview-parameter-note"'));
  assert.ok(flow.includes('href="#factor-settings"'));
  assert.ok(overview.indexOf(flow) < overview.indexOf('class="stats-grid"'));
  assert.equal(overview.includes('<ol class="journey-list">'), false, "Do not duplicate the flow with the old overview instructions.");
});

test("history insights are scoped below the filters and keep source details separate from the table and all-record export", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const history = html.slice(html.indexOf('<section id="records"'), html.indexOf('<section id="methodology"'));
  assert.ok(history.includes('aria-labelledby="history-insights-title"'));
  assert.ok(history.indexOf('id="history-insights"') > history.indexOf('class="record-filters"'));
  assert.ok(history.indexOf('id="history-insights"') < history.indexOf('class="table-scroll"'));
  for (const id of ["history-insight-scope", "history-insight-empty", "history-insight-error", "history-insight-content",
    "history-insight-takeaway", "history-insight-action", "history-insight-missing", "history-insight-details", "history-insight-groups"]) {
    assert.ok(history.includes(`id="${id}"`), id);
  }
  assert.ok(history.includes('id="history-insight-error" class="field-error" role="alert"'));
  assert.ok(history.includes('id="history-insight-details" class="history-insight-details" hidden'));
  assert.ok(!/<details id="history-insight-details"[^>]*\bopen\b/.test(history));
  assert.ok(html.includes('id="history-insight-group-template"'));
  assert.ok(history.includes('data-i18n="historyAiCaution"'));
  assert.ok(history.includes('data-i18n="historyStoredScope"'));
  assert.ok(history.includes('id="export-button"'));
});

test("stored-reference cards use one full-width column and separate readable sections", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const template = /<template id="history-insight-group-template">([\s\S]*?)<\/template>/.exec(html);
  assert.ok(template);
  for (const key of ["historyGroupResultLabel", "historyGroupActionLabel", "historyGroupScenariosLabel", "historyGroupSourceLabel"]) {
    assert.ok(template[1].includes(`data-i18n="${key}"`));
  }
  for (const name of ["history-group-reference", "history-group-baseline", "history-group-alternative", "history-group-scope"]) {
    assert.ok(template[1].includes(`class="${name}"`));
  }
  assert.ok(template[1].includes("<dl"));
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const layout = /\.history-insight-groups\s*\{([^}]+)\}/.exec(css);
  assert.ok(layout);
  assert.ok(layout[1].includes("display: grid"));
  assert.ok(layout[1].includes("grid-template-columns: minmax(0, 1fr)"));
  assert.equal(/flex-wrap|repeat\(2/.test(layout[1]), false);
});

test("guide cards separate their content from consistently spaced action groups", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const cards = [...html.matchAll(/<section class="guide-card(?: ai-test-tools)?">([\s\S]*?)<\/section>/g)];
  assert.equal(cards.length, 2);
  for (const [, card] of cards) {
    assert.ok(card.includes('class="guide-card-content"'));
    assert.ok(card.includes('class="guide-card-actions"'));
    assert.ok(card.indexOf('class="guide-card-content"') < card.indexOf('class="guide-card-actions"'));
    const actions = card.slice(card.indexOf('class="guide-card-actions"'));
    assert.ok(actions.includes('class="button button-primary"'));
    assert.equal(actions.includes('class="review-note"'), false);
  }
  const uploadActions = cards[1][1].slice(cards[1][1].indexOf('class="guide-card-actions"'));
  assert.ok(uploadActions.includes('id="guide-upload-button"'));
  assert.ok(uploadActions.includes('id="guide-retry-ai"'));
});

test("required, optional and automatic fields have visible text cues without adding native submit constraints", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const control = id => new RegExp(`<(?:input|select|textarea)\\b[^>]*\\bid="${id}"[^>]*>`).exec(html)?.[0];
  const label = id => new RegExp(`<label\\b[^>]*\\bfor="${id}"[^>]*>([\\s\\S]*?)<\\/label>`).exec(html)?.[1];
  for (const id of ["test-photo", "category-confirmation", "weight-input", "factor-baseline-scenario",
    "factor-alternative-scenario", "factor-baseline", "factor-alternative", "factor-source-title", "factor-scope"]) {
    assert.ok(control(id)?.includes('aria-required="true"'), id);
    assert.ok(label(id)?.includes('data-i18n="fieldRequired"'), id);
    assert.equal(/\srequired(?:\s|=|\/?>)/.test(control(id)), false, "Keep existing guided validation.");
  }
  assert.ok(control("sample-id").includes("readonly"));
  assert.ok(label("sample-id").includes('data-i18n="fieldAutomatic"'));
  assert.ok(label("factor-source-url").includes('data-i18n="fieldOptional"'));
  assert.ok(label("parameter-set").includes('data-i18n="optionalForRecording"'));
  assert.equal(control("parameter-set").includes("aria-required"), false);
});

test("parameter actions, history filters and expandable sections expose their interaction affordances", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(html.includes('aria-labelledby="parameter-action-title"'));
  assert.ok(html.includes('id="parameter-action-state"'));
  for (const id of ["record-search", "status-filter", "material-filter"]) {
    const label = new RegExp(`<label\\b[^>]*\\bfor="${id}"[^>]*>`).exec(html)?.[0];
    assert.ok(label?.includes('class="field-label"'), id);
    assert.equal(label?.includes("visually-hidden"), false, id);
  }
  const summaries = [...html.matchAll(/<summary\b[^>]*>([\s\S]*?)<\/summary>/g)];
  assert.equal(summaries.length, 6);
  assert.ok(summaries.every(([, content]) => content.includes('class="details-toggle" aria-hidden="true"')));
});
