import { ValidationError, isIsoDate, isObject } from "./model.ts";

export const PHOTO_DATABASE = "carbontrace.photos.v1";
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const PHOTO_STORE = "photos";
const uploadIdPattern = /^UPL-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface UploadedPhoto {
  id: string;
  originalName: string;
  type: "image/jpeg";
  width: number;
  height: number;
  size: number;
  sha256: string;
  uploadedAt: string;
}

export interface PreparedPhoto {
  photo: UploadedPhoto;
  blob: Blob;
}

export function isUploadedPhotoId(value: string): boolean {
  return uploadIdPattern.test(value);
}

export function validateUploadedPhoto(value: unknown): asserts value is UploadedPhoto {
  if (!isObject(value) || typeof value.id !== "string" || !isUploadedPhotoId(value.id)
    || typeof value.originalName !== "string" || value.originalName.trim() === "" || value.originalName.length > 255
    || value.type !== "image/jpeg" || typeof value.width !== "number" || typeof value.height !== "number"
    || !Number.isInteger(value.width) || !Number.isInteger(value.height)
    || value.width < 1 || value.height < 1 || value.width > 1024 || value.height > 1024
    || typeof value.size !== "number" || !Number.isInteger(value.size) || value.size < 1 || value.size > MAX_UPLOAD_BYTES
    || typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256)
    || !isIsoDate(value.uploadedAt)) {
    throw new ValidationError("Metadata foto unggahan tidak valid.");
  }
}

export function sameUploadedPhoto(left: UploadedPhoto, right: UploadedPhoto): boolean {
  return (["id", "originalName", "type", "width", "height", "size", "sha256", "uploadedAt"] as const)
    .every((key) => left[key] === right[key]);
}

export function validateUploadFile(file: { type: string; size: number; name: string }): void {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)
    || !Number.isInteger(file.size) || file.size < 1 || file.size > MAX_UPLOAD_BYTES
    || file.name.trim() === "" || file.name.length > 255) {
    throw new ValidationError("Gunakan foto JPG, PNG, atau WebP dengan ukuran maksimal 10 MB dan nama file yang valid.");
  }
}

export function validateImageSignature(bytes: Uint8Array, type: string): void {
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  const webp = [82, 73, 70, 70].every((value, index) => bytes[index] === value)
    && [87, 69, 66, 80].every((value, index) => bytes[index + 8] === value);
  if (!(type === "image/jpeg" && jpeg || type === "image/png" && png || type === "image/webp" && webp)) {
    throw new ValidationError("Isi file tidak sesuai dengan format foto JPG, PNG, atau WebP.");
  }
}

async function photoDigest(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new ValidationError("Penyimpanan foto memerlukan HTTPS atau localhost.");
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function prepareUploadedPhoto(file: File): Promise<PreparedPhoto> {
  validateUploadFile(file);
  if (!globalThis.crypto?.subtle || typeof crypto.randomUUID !== "function") {
    throw new ValidationError("Penyimpanan foto memerlukan HTTPS atau localhost.");
  }
  validateImageSignature(new Uint8Array(await file.slice(0, 12).arrayBuffer()), file.type);
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new ValidationError("File tidak dapat dibaca sebagai gambar."));
      image.src = objectUrl;
    });
    if (image.naturalWidth * image.naturalHeight > 24_000_000) {
      throw new ValidationError("Resolusi foto melebihi 24 megapiksel.");
    }
    const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (context === null) throw new ValidationError("Browser tidak menyediakan pemrosesan gambar.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (result) => result === null ? reject(new ValidationError("Salinan foto untuk pencatatan gagal dibuat.")) : resolve(result),
      "image/jpeg", 0.9,
    ));
    const photo: UploadedPhoto = {
      id: `UPL-${crypto.randomUUID()}`, originalName: file.name, type: "image/jpeg",
      width: canvas.width, height: canvas.height, size: blob.size,
      sha256: await photoDigest(blob), uploadedAt: new Date().toISOString(),
    };
    validateUploadedPhoto(photo);
    return { photo, blob };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function openPhotoDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new ValidationError("Browser tidak menyediakan penyimpanan foto lokal."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PHOTO_DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore(PHOTO_STORE, { keyPath: "id" });
    request.onblocked = () => {
      blocked = true;
      reject(new ValidationError("Penyimpanan foto diblokir. Tutup tab CarbonTrace lain lalu coba lagi."));
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

async function photoRequest(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<unknown> {
  const database = await openPhotoDatabase();
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const transaction = database.transaction(PHOTO_STORE, mode);
      const request = action(transaction.objectStore(PHOTO_STORE));
      let result: unknown;
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(transaction.error ?? new DOMException("Photo transaction aborted.", "AbortError"));
    });
  } finally {
    database.close();
  }
}

async function validateStoredPhoto(value: unknown, expected: UploadedPhoto): Promise<PreparedPhoto> {
  if (!isObject(value) || !(value.blob instanceof Blob)) throw new ValidationError("Foto tersimpan tidak ditemukan atau tidak valid.");
  validateUploadedPhoto(value.photo);
  if (!sameUploadedPhoto(value.photo, expected) || value.blob.type !== expected.type || value.blob.size !== expected.size
    || await photoDigest(value.blob) !== expected.sha256) {
    throw new ValidationError("Isi foto tersimpan tidak cocok dengan metadata catatan.");
  }
  return { photo: { ...expected }, blob: value.blob };
}

export async function loadUploadedPhoto(photo: UploadedPhoto): Promise<PreparedPhoto> {
  validateUploadedPhoto(photo);
  return validateStoredPhoto(await photoRequest("readonly", (store) => store.get(photo.id)), photo);
}

export async function storeUploadedPhoto(prepared: PreparedPhoto): Promise<boolean> {
  validateUploadedPhoto(prepared.photo);
  await validateStoredPhoto(prepared, prepared.photo);
  const existing = await photoRequest("readonly", (store) => store.get(prepared.photo.id));
  if (existing !== undefined) {
    await validateStoredPhoto(existing, prepared.photo);
    return false;
  }
  await photoRequest("readwrite", (store) => store.add({ id: prepared.photo.id, photo: { ...prepared.photo }, blob: prepared.blob }));
  return true;
}

export async function deleteUploadedPhoto(id: string): Promise<void> {
  if (!isUploadedPhotoId(id)) throw new ValidationError("Identitas foto unggahan tidak valid.");
  await photoRequest("readwrite", (store) => store.delete(id));
}
