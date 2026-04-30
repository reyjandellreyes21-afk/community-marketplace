import { apiRequest } from "./appApi.js";

function isRemoteHttpUrl(s) {
  return /^https?:\/\//i.test(String(s || "").trim());
}

async function urlToUploadFile(url, fallbackName) {
  const u = String(url || "").trim();
  if (!u) throw new Error("Missing image data.");
  const res = await fetch(u);
  if (!res.ok) throw new Error("Could not read image for upload.");
  const blob = await res.blob();
  const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  return new File([blob], fallbackName, { type });
}

/**
 * Builds ordered https URLs for listing create/update: uploads local files via POST /me/listings/images,
 * keeps existing remote URLs, and turns data:/blob: previews into uploads when needed.
 *
 * @param {string} token
 * @param {{ coverFile: File | null, coverPreviewUrl: string, extraItems: Array<{ file?: File | null, previewUrl?: string }> }} input
 * @param {(urls: string[]) => string[]} dedupeAndCap
 */
export async function resolveListingImagesForSave(token, input, dedupeAndCap) {
  const { coverFile, coverPreviewUrl, extraItems } = input;
  /** @type {Array<{ kind: "file"; file: File } | { kind: "url"; url: string }>} */
  const slots = [];

  if (coverFile) {
    slots.push({ kind: "file", file: coverFile });
  } else {
    const prev = String(coverPreviewUrl || "").trim();
    if (isRemoteHttpUrl(prev)) {
      slots.push({ kind: "url", url: prev });
    } else if (prev.startsWith("data:") || prev.startsWith("blob:")) {
      slots.push({ kind: "file", file: await urlToUploadFile(prev, "cover.jpg") });
    } else if (prev) {
      slots.push({ kind: "url", url: prev });
    }
  }

  for (const item of extraItems || []) {
    if (item?.file) {
      slots.push({ kind: "file", file: item.file });
    } else {
      const prev = String(item?.previewUrl || "").trim();
      if (isRemoteHttpUrl(prev)) {
        slots.push({ kind: "url", url: prev });
      } else if (prev.startsWith("data:") || prev.startsWith("blob:")) {
        slots.push({ kind: "file", file: await urlToUploadFile(prev, "extra.jpg") });
      } else if (prev) {
        slots.push({ kind: "url", url: prev });
      }
    }
  }

  const files = slots.filter((s) => s.kind === "file").map((s) => s.file);
  let uploaded = [];
  if (files.length > 0) {
    const fd = new FormData();
    for (const f of files) fd.append("images", f);
    const res = await apiRequest("/me/listings/images", { method: "POST", token, body: fd });
    uploaded = Array.isArray(res?.urls) ? res.urls : [];
    if (uploaded.length !== files.length) {
      throw new Error("Image upload returned an unexpected response. Try again.");
    }
  }

  let i = 0;
  const merged = slots.map((s) => (s.kind === "url" ? s.url : uploaded[i++]));
  return dedupeAndCap(merged.filter(Boolean));
}
