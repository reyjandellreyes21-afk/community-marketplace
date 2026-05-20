import multer from "multer";
import { AppError } from "../errors/AppError.js";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 6;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Multipart `images` field: up to 6 listing photos (memory, same rules as community covers). */
export const listingImagesUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new AppError(400, "Only JPEG, PNG, WebP, or GIF images are allowed."));
  },
});
