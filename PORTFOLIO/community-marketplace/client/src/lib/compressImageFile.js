/** All client-compressed uploads target this cap (matches server multer + bucket: 5 MB). */
export const MAX_IMAGE_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_LISTING_COMMUNITY_IMAGE_BYTES = MAX_IMAGE_FILE_BYTES;
export const MAX_AVATAR_IMAGE_BYTES = MAX_IMAGE_FILE_BYTES;

function loadImageElementFromFile(file) {
  return new Promise((resolve, reject) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read image."));
      };
      img.src = url;
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * @param {File} file
 * @returns {Promise<ImageBitmap | HTMLImageElement>}
 */
async function loadDrawableImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through */
    }
  }
  return loadImageElementFromFile(file);
}

function getDrawableSize(src) {
  if (src instanceof ImageBitmap) {
    return { w: Math.max(1, src.width), h: Math.max(1, src.height) };
  }
  return { w: Math.max(1, src.naturalWidth || 1), h: Math.max(1, src.naturalHeight || 1) };
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image."))),
      "image/jpeg",
      quality,
    );
  });
}

function baseNameFromFile(file) {
  const n = String(file?.name || "image").replace(/\.[^.]+$/, "");
  return n || "image";
}

/**
 * If `file` is already at or under `maxBytes`, returns it unchanged.
 * Otherwise resizes and re-encodes as JPEG until the result fits (or throws).
 *
 * @param {File} file
 * @param {number} maxBytes
 * @param {{ maxLongEdge?: number, minLongEdge?: number }} [options]
 * @returns {Promise<File>}
 */
export async function ensureImageFileUnderMaxBytes(file, maxBytes, options = {}) {
  if (!file || typeof file.size !== "number") {
    throw new Error("Invalid file.");
  }
  if (!String(file.type || "").startsWith("image/")) {
    throw new Error("Not an image file.");
  }
  if (file.size <= maxBytes) return file;

  const maxLongEdge = options.maxLongEdge ?? 2560;
  const minLongEdge = options.minLongEdge ?? 400;

  const drawable = await loadDrawableImage(file);
  try {
    const { w: w0, h: h0 } = getDrawableSize(drawable);
    const initialLong = Math.max(w0, h0);
    let longEdge = Math.min(initialLong, maxLongEdge);
    let quality = 0.9;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available.");

    for (let round = 0; round < 28; round++) {
      const scale = longEdge / initialLong;
      const w = Math.max(1, Math.round(w0 * scale));
      const h = Math.max(1, Math.round(h0 * scale));
      canvas.width = w;
      canvas.height = h;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(drawable, 0, 0, w0, h0, 0, 0, w, h);

      let blob = await canvasToJpegBlob(canvas, quality);
      if (blob.size <= maxBytes) {
        const outName = `${baseNameFromFile(file)}.jpg`;
        return new File([blob], outName, { type: "image/jpeg", lastModified: Date.now() });
      }

      if (quality > 0.52) {
        quality -= 0.07;
      } else {
        longEdge = Math.floor(longEdge * 0.82);
        quality = 0.88;
      }

      if (longEdge < minLongEdge) {
        quality = 0.42;
        const scale2 = longEdge / initialLong;
        const w2 = Math.max(1, Math.round(w0 * scale2));
        const h2 = Math.max(1, Math.round(h0 * scale2));
        canvas.width = w2;
        canvas.height = h2;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w2, h2);
        ctx.drawImage(drawable, 0, 0, w0, h0, 0, 0, w2, h2);
        blob = await canvasToJpegBlob(canvas, quality);
        if (blob.size <= maxBytes) {
          const outName = `${baseNameFromFile(file)}.jpg`;
          return new File([blob], outName, { type: "image/jpeg", lastModified: Date.now() });
        }
        throw new Error("Image is still too large after compression.");
      }
    }
    throw new Error("Could not compress image enough.");
  } finally {
    if (drawable instanceof ImageBitmap) {
      try {
        drawable.close();
      } catch {
        /* ignore */
      }
    }
  }
}
