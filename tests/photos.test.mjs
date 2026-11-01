import test from "node:test";
import assert from "node:assert/strict";
import { ValidationError, CATALOG_SAMPLES } from "../src/model.ts";
import {
  MAX_UPLOAD_BYTES, isUploadedPhotoId, loadUploadedPhoto, sameUploadedPhoto,
  validateImageSignature, validateUploadFile, validateUploadedPhoto,
} from "../src/photos.ts";
import {
  createParameterSetConfig, deserializeOperationalState, emptyFactorConfig, exportManualCsv,
  filterManualRecords, manualRecordImpact, migrateLegacyData, saveManualRecord, serializeOperationalState,
  validateOperationalState,
} from "../src/operational.ts";
import { validateModelAnalysis } from "../src/ai-contract.ts";

const NOW = "2026-10-24T11:30:00.000Z";
const LATER = "2026-10-24T11:35:00.000Z";
const photo = {
  id: "UPL-15a4040a-6609-4f9b-954f-569c9b71a716", originalName: "Botol saya.png",
  type: "image/jpeg", width: 1024, height: 768, size: 123456,
  sha256: "a".repeat(64), uploadedAt: NOW,
};
const analysis = {
  category: "pet", score: 0.9, scores: { pet: 0.9, cardboard: 0.1 },
  modelVersion: "ct-mobilenet-b090d45c6b58", sampleId: photo.id,
  inputSha256: "b".repeat(64), analyzedAt: NOW, source: "trained-model",
};

test("uploaded photos have a separate UUID identity, never a training or catalog ID", () => {
  assert.equal(isUploadedPhotoId(photo.id), true);
  for (const id of ["CT-007", "SYN-PET-001", "UPL-test", photo.id.replace("-4f9b", "-5f9b"), "../photo.jpg"]) {
    assert.equal(isUploadedPhotoId(id), false);
  }
  assert.equal(CATALOG_SAMPLES.length, 132);
  assert.equal(CATALOG_SAMPLES.some(sample => sample.id === photo.id), false);
});

test("photo metadata validates dimensions, bytes, digest, timestamp and original filename", () => {
  validateUploadedPhoto(photo);
  for (const patch of [
    { id: "CT-007" }, { originalName: "" }, { originalName: "x".repeat(256) },
    { type: "image/png" }, { width: 0 }, { width: 1025 }, { width: 1.5 },
    { height: 1025 }, { size: 0 }, { size: MAX_UPLOAD_BYTES + 1 },
    { sha256: "bad" }, { uploadedAt: "invalid" },
  ]) assert.throws(() => validateUploadedPhoto({ ...photo, ...patch }), ValidationError);
  assert.equal(sameUploadedPhoto(photo, { ...photo }), true);
  assert.equal(sameUploadedPhoto(photo, { ...photo, sha256: "c".repeat(64) }), false);
});

test("upload validation accepts the exact 10 MB limit and only supported image files", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    validateUploadFile({ name: "foto.jpg", type, size: MAX_UPLOAD_BYTES });
  }
  for (const patch of [{ type: "image/svg+xml" }, { type: "" }, { size: 0 }, { size: MAX_UPLOAD_BYTES + 1 }, { name: " " }]) {
    assert.throws(() => validateUploadFile({ name: "foto.jpg", type: "image/jpeg", size: 100, ...patch }), ValidationError);
  }
});

test("image signatures reject renamed text, SVG and MIME mismatches", () => {
  const jpeg = new Uint8Array([255, 216, 255]);
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const webp = new TextEncoder().encode("RIFF1234WEBP");
  validateImageSignature(jpeg, "image/jpeg");
  validateImageSignature(png, "image/png");
  validateImageSignature(webp, "image/webp");
  for (const [bytes, type] of [[jpeg, "image/png"], [png, "image/jpeg"], [new TextEncoder().encode("<svg/>"), "image/png"], [new Uint8Array(), "image/webp"]]) {
    assert.throws(() => validateImageSignature(bytes, type), ValidationError);
  }
});

test("own-photo manual records round-trip with unknown emissions rather than zero", () => {
  const state = saveManualRecord(migrateLegacyData(null), photo.id, 34.5, "pet", emptyFactorConfig(), NOW, null, photo);
  assert.equal(state.records[0].method, "manual");
  assert.equal(manualRecordImpact(state.records[0]), null);
  assert.deepEqual(deserializeOperationalState(serializeOperationalState(state)), state);
  assert.notEqual(state.records[0].photo, photo);
  assert.equal(filterManualRecords(state.records, "botol saya", "missing", "pet").length, 1);
  assert.equal(filterManualRecords(state.records, "UPL-", "all", "all").length, 1);
});

test("AI-assisted own-photo records retain inference, human corrections and factor snapshots", () => {
  validateModelAnalysis(analysis);
  const config = createParameterSetConfig("warm16-us-average-r1", NOW);
  const initial = saveManualRecord(migrateLegacyData(null), photo.id, 100, "cardboard", config, NOW, analysis, photo);
  assert.equal(initial.records[0].analysis.category, "pet");
  assert.equal(initial.records[0].category, "cardboard");
  assert.equal(initial.records[0].method, "ai-assisted");
  const updated = saveManualRecord(initial, photo.id, 200, "pet", config, LATER, analysis, photo);
  assert.equal(updated.records.length, 1);
  assert.equal(updated.records[0].createdAt, NOW);
  assert.equal(updated.records[0].updatedAt, LATER);
  assert.equal(initial.records[0].factors.material, "cardboard");
});

test("uploaded records reject missing, mismatched or changed photo metadata", () => {
  const state = saveManualRecord(migrateLegacyData(null), photo.id, 34.5, "pet", emptyFactorConfig(), NOW, null, photo);
  assert.throws(() => saveManualRecord(migrateLegacyData(null), photo.id, 10, "pet", emptyFactorConfig(), NOW), ValidationError);
  assert.throws(() => saveManualRecord(migrateLegacyData(null), "CT-007", 10, "pet", emptyFactorConfig(), NOW, null, photo), ValidationError);
  assert.throws(() => saveManualRecord(state, photo.id, 10, "pet", emptyFactorConfig(), LATER, null, { ...photo, originalName: "other.jpg" }), ValidationError);
  assert.throws(() => saveManualRecord(state, photo.id, 10, "pet", emptyFactorConfig(), LATER), ValidationError);
  const { photo: omitted, ...record } = state.records[0];
  assert.throws(() => validateOperationalState({ ...state, records: [record] }), ValidationError);
  assert.throws(() => saveManualRecord(state, photo.id, 10, "pet", emptyFactorConfig(), LATER, { ...analysis, sampleId: "CT-007" }, photo), ValidationError);
});

test("mixed catalog/upload CSV retains 32 columns, original names and explicit image provenance", () => {
  const initial = saveManualRecord(migrateLegacyData(null), "CT-007", 20, "pet", emptyFactorConfig(), NOW);
  const state = saveManualRecord(initial, photo.id, 34.5, "pet", emptyFactorConfig(), NOW, analysis, photo);
  const csv = exportManualCsv(state);
  const rows = csv.trim().split("\r\n");
  assert.equal(rows.length, 3);
  assert.ok(rows.every(row => row.split(",").length === 32));
  assert.ok(csv.includes('"Botol saya.png"'));
  assert.ok(csv.includes(`"${photo.id}.jpg","USER_UPLOADED_UNVERIFIED","NO"`));
  assert.ok(csv.includes('"USER_PROVIDED_UNVERIFIED"'));
  assert.ok(!csv.includes("data:image/"));
});

test("unavailable photo storage fails explicitly instead of returning an empty or successful image", async () => {
  assert.equal(typeof indexedDB, "undefined");
  await assert.rejects(loadUploadedPhoto(photo), /penyimpanan foto lokal/);
});
