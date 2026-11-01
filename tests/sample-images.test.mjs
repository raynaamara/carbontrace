import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import jpeg from "jpeg-js";
import { CATALOG_SAMPLES } from "../src/model.ts";

const sampleDirectory = new URL("../src/assets/samples/", import.meta.url);

test("all 132 catalog samples map to distinct original PNG files provided by the user", () => {
  assert.equal(CATALOG_SAMPLES.length, 132);
  assert.equal(new Set(CATALOG_SAMPLES.map((sample) => sample.imageFile)).size, 132);
  for (const sample of CATALOG_SAMPLES) {
    assert.equal(sample.imageFile, sample.role === "outside" ? `${sample.id}_01.png` : `${sample.id}.png`);
    const original = readFileSync(new URL(sample.imageFile, sampleDirectory));
    assert.deepEqual([...original.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], sample.id);
  }
});

test("every display JPEG is at most 1024px, smaller than its source and under 512 KiB", () => {
  let totalBytes = 0;
  for (const sample of CATALOG_SAMPLES) {
    const original = statSync(new URL(sample.imageFile, sampleDirectory));
    const optimized = readFileSync(new URL(`optimized/${sample.id}_01.jpg`, sampleDirectory));
    assert.deepEqual([...optimized.subarray(0, 3)], [255, 216, 255], sample.id);
    assert.deepEqual([...optimized.subarray(-2)], [255, 217], sample.id);
    assert.ok(optimized.length < original.size, `${sample.id}: display file must be lighter`);
    assert.ok(optimized.length < 512 * 1024, `${sample.id}: display file exceeds 512 KiB`);
    const decoded = jpeg.decode(optimized, { useTArray: true, formatAsRGBA: false });
    assert.ok(decoded.width > 0 && decoded.height > 0 && Math.max(decoded.width, decoded.height) <= 1024, sample.id);
    totalBytes += optimized.length;
  }
  assert.ok(totalBytes < 30 * 1024 * 1024, "All 132 display photos together must stay under 30 MiB");
});
