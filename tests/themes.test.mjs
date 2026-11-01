import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { THEME_IDS, THEME_KEY, getTheme, isTheme, setTheme } from "../src/themes.ts";
import { getLanguage, setLanguage, t } from "../src/i18n.ts";
import {
  createParameterSetConfig, exportManualCsv, migrateLegacyData, saveManualRecord, serializeFactorConfig,
} from "../src/operational.ts";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const NOW = "2026-10-24T10:00:00.000Z";
const tokenNames = [
  "--accent", "--accent-strong", "--theme-chrome",
  "--theme-page", "--theme-ink", "--theme-text", "--theme-muted", "--theme-subtle",
  "--theme-label", "--theme-secondary", "--theme-link", "--theme-focus",
  "--theme-soft", "--theme-faint", "--theme-emphasis", "--theme-line",
  "--border", "--theme-on-brand", "--theme-shadow", "--theme-modal-shadow", "--theme-backdrop",
];

afterEach(() => {
  setTheme("green");
  setLanguage("id");
});

function palette(theme) {
  const pattern = theme === "green" ? /:root\s*\{([^}]+)\}/
    : new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([^}]+)\\}`);
  const match = pattern.exec(css);
  assert.ok(match, theme);
  return Object.fromEntries([...match[1].matchAll(/(--[\w-]+):\s*(#[a-f0-9]{6}(?:[a-f0-9]{2})?);/gi)]
    .map(([, name, value]) => [name, value.toLowerCase()]));
}

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).slice(0, 3).map((pair) => parseInt(pair, 16) / 255);
  const linear = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("five guarded theme IDs retain green as the default", () => {
  assert.deepEqual(THEME_IDS, ["green", "blue", "purple", "teal", "orange"]);
  assert.equal(THEME_KEY, "carbontrace.theme.v1");
  assert.equal(getTheme(), "green");
  for (const theme of THEME_IDS) {
    assert.equal(isTheme(theme), true);
    setTheme(theme);
    assert.equal(getTheme(), theme);
  }
  for (const invalid of [null, "", "dark", "pink", 1]) {
    assert.equal(isTheme(invalid), false);
    assert.throws(() => setTheme(invalid), /Unsupported/);
  }
  assert.equal(getTheme(), "orange");
});

test("theme selection is bilingual and includes exactly the supported options", () => {
  const select = /<select id="theme-select">([\s\S]*?)<\/select>/.exec(html);
  assert.ok(select);
  assert.deepEqual([...select[1].matchAll(/value="([^"]+)"/g)].map((match) => match[1]), [...THEME_IDS]);
  assert.ok(html.includes('data-theme="green"'));
  assert.equal(t("themeLabel"), "Warna tema");
  assert.equal(t("themeBlue"), "Biru");
  setLanguage("en");
  assert.equal(t("themeLabel"), "Theme colour");
  assert.equal(t("themeBlue"), "Blue");
  for (const key of ["themeGreen", "themeBlue", "themePurple", "themeTeal", "themeOrange"]) {
    assert.ok(t(key).length > 0);
  }
});

test("every additional palette defines the same complete set of valid colour tokens", () => {
  for (const theme of THEME_IDS.filter((theme) => theme !== "green")) {
    const tokens = palette(theme);
    assert.deepEqual(Object.keys(tokens).sort(), [...tokenNames].sort(), theme);
    assert.ok(Object.values(tokens).every((value) => /^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/.test(value)), theme);
  }
  const green = palette("green");
  assert.equal(green["--accent"], "#265b46");
  assert.equal(green["--accent-strong"], "#1c4335");
  assert.equal(green["--theme-chrome"], "#214e3f");
  assert.ok(!css.includes("var(--green"));
});

test("primary buttons have at least 4.5:1 white-text contrast in every theme", () => {
  for (const theme of THEME_IDS) {
    const tokens = palette(theme);
    for (const name of ["--accent", "--accent-strong"]) {
      assert.ok(contrast(tokens[name], "#ffffff") >= 4.5, `${theme} ${name}`);
    }
  }
});

test("new palettes keep readable themed text, links, and focus indicators", () => {
  for (const theme of THEME_IDS.filter((theme) => theme !== "green")) {
    const tokens = palette(theme);
    assert.ok(contrast(tokens["--theme-ink"], tokens["--theme-page"]) >= 4.5, `${theme} heading`);
    assert.ok(contrast(tokens["--theme-text"], tokens["--theme-soft"]) >= 4.5, `${theme} body`);
    assert.ok(contrast(tokens["--theme-muted"], tokens["--theme-faint"]) >= 4.5, `${theme} muted`);
    assert.ok(contrast(tokens["--theme-subtle"], "#ffffff") >= 4.5, `${theme} secondary text`);
    assert.ok(contrast(tokens["--theme-link"], "#ffffff") >= 4.5, `${theme} link`);
    assert.ok(contrast(tokens["--theme-focus"], "#ffffff") >= 3, `${theme} focus`);
    assert.ok(contrast(tokens["--theme-on-brand"], tokens["--accent-strong"]) >= 4.5, `${theme} logo`);
  }
});

test("enabled control boundaries and keyboard focus have at least 3:1 contrast in all five themes", () => {
  const rule = /^input, select\s*\{([^}]+)\}/m.exec(css)?.[1];
  assert.ok(rule);
  const fallback = /border:\s*1\.5px solid var\(--theme-secondary,\s*(#[a-f0-9]{6})\)/i.exec(rule)?.[1];
  assert.ok(fallback);
  assert.ok(css.includes("outline: 3px solid var(--theme-focus, var(--accent))"));
  for (const theme of THEME_IDS) {
    const tokens = palette(theme);
    const border = tokens["--theme-secondary"] ?? fallback;
    const focus = tokens["--theme-focus"] ?? tokens["--accent"];
    for (const background of ["#ffffff", tokens["--theme-faint"] ?? "#f6f8f2"]) {
      assert.ok(contrast(border, background) >= 3, `${theme} input border`);
      assert.ok(contrast(focus, background) >= 3, `${theme} focus ring`);
    }
  }
});

test("language, scientific snapshots, and machine-readable exports are independent of theme", () => {
  const config = createParameterSetConfig("warm16-us-average-r1", NOW);
  const serialized = serializeFactorConfig(config);
  const state = saveManualRecord(migrateLegacyData(null), "CT-001", 24.5, "pet", config, NOW);
  const csv = exportManualCsv(state);
  setLanguage("en");
  for (const theme of THEME_IDS) {
    setTheme(theme);
    assert.equal(getLanguage(), "en");
    assert.equal(serializeFactorConfig(config), serialized);
    assert.equal(exportManualCsv(state), csv);
  }
  setLanguage("id");
  assert.equal(getTheme(), "orange");
});

test("semantic warnings and material legends are not recoloured by theme", () => {
  assert.ok(css.includes('.button-danger { background: #a34738; color: white; }'));
  assert.ok(css.includes('.badge-amber { background: #fbf4df; color: #b09749; }'));
  assert.ok(css.includes('.pet-dot { background: #96b273; }'));
  assert.ok(css.includes('.cardboard-dot { background: #cab17f; }'));
  assert.ok(css.includes('.ai-status-panel .field-error { color: #a14e3e; }'));
  assert.ok(css.includes('input:not([readonly]):not(:disabled):not([aria-invalid="true"]):hover'));
  assert.ok(css.includes('select:not(:disabled):not([aria-invalid="true"]):hover'));
});
