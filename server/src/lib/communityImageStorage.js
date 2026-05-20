import { createHash, randomUUID } from "node:crypto";
import { AppError } from "../errors/AppError.js";
import { config } from "../config/config.js";
import { supabaseAdmin } from "./supabase.js";

const bucketOptionsFull = {
  public: true,
  fileSizeLimit: "5MB",
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
};

let bucketEnsured = false;
let ensureInFlight = null;

const isLikelyMissingBucketMessage = (msg) =>
  /bucket|not found|does not exist|Bucket not found|not_found|No such bucket|unknown bucket|The specified bucket does not exist/i.test(
    String(msg || ""),
  );

/**
 * Tries createBucket with full options, then minimal `{ public: true }` (some projects reject extra fields).
 * @returns {null | { message?: string }} last error if all attempts fail
 */
async function tryCreateBucket(bucket) {
  const attempts = [bucketOptionsFull, { public: true }];
  let lastError = null;
  for (const opts of attempts) {
    const { error } = await supabaseAdmin.storage.createBucket(bucket, opts);
    if (!error) return null;
    lastError = error;
    const m = error.message || String(error);
    if (/already exists|duplicate|exists/i.test(m)) return null;
  }
  return lastError;
}

/**
 * Ensures the configured bucket exists (creates it with the service role if missing).
 * Concurrent callers share one in-flight attempt; success is cached for the process lifetime.
 */
async function ensureCommunityImagesBucket() {
  if (bucketEnsured) return;
  if (ensureInFlight) {
    await ensureInFlight;
    return;
  }

  const bucket = config.communityImagesBucket;
  ensureInFlight = (async () => {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (!listError && buckets?.some((b) => b.id === bucket || b.name === bucket)) {
      bucketEnsured = true;
      return;
    }

    const createError = await tryCreateBucket(bucket);
    if (!createError) {
      bucketEnsured = true;
      return;
    }

    const createMsg = createError.message || String(createError);
    const { data: again, error: list2 } = await supabaseAdmin.storage.listBuckets();
    if (!list2 && again?.some((b) => b.id === bucket || b.name === bucket)) {
      bucketEnsured = true;
      return;
    }

    throw new AppError(
      500,
      `Could not create or access storage bucket "${bucket}": ${createMsg}. In Supabase: Storage → New bucket → name "${bucket}", public, 5 MB max. Or run supabase/migrations/*storage*communities*.sql. Optional env: COMMUNITY_IMAGES_BUCKET=your-existing-public-bucket.`,
    );
  })();

  try {
    await ensureInFlight;
  } finally {
    ensureInFlight = null;
  }
}

/** Call after a failed upload so the next ensure re-checks Storage. */
function invalidateBucketCache() {
  bucketEnsured = false;
}

const extForMime = (mimetype) => {
  if (mimetype === "image/png") return "png";
  if (mimetype === "image/webp") return "webp";
  if (mimetype === "image/gif") return "gif";
  if (mimetype === "image/jpeg") return "jpg";
  return null;
};

/** Supabase object keys must not contain reserved URL characters; folder is usually auth UUID. */
const storageFolderForUser = (userId) => {
  const s = String(userId ?? "").trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return s;
  if (!s) return "anon";
  return createHash("sha256").update(s).digest("hex").slice(0, 40);
};

/** Sanitized single path segment; returns "" if nothing usable remains (no default label). */
const sanitizeNameFolderSegmentStrict = (raw) =>
  String(raw ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/** First 8 hex chars of user id (or hash) so same display name → distinct folders. */
const shortIdFromUserId = (userId) => {
  const raw = String(userId ?? "").trim().replace(/-/g, "");
  if (/^[0-9a-f]{32}$/i.test(raw)) return raw.slice(0, 8).toLowerCase();
  return createHash("sha256").update(String(userId)).digest("hex").slice(0, 8);
};

/**
 * `SanitizedName-abc12345` when displayName resolves; otherwise stable id folder (UUID/hash).
 * @param {string} displayName
 * @param {string} userId
 */
const folderSegmentForNamedUpload = (displayName, userId) => {
  const fallbackFolder = storageFolderForUser(userId);
  const trimmed = String(displayName ?? "").trim();
  if (!trimmed) return fallbackFolder;
  const namePart = sanitizeNameFolderSegmentStrict(trimmed);
  if (!namePart) return fallbackFolder;
  const combined = `${namePart}-${shortIdFromUserId(userId)}`;
  return combined.slice(0, 100);
};

/**
 * Upload a community cover image to Supabase Storage (public bucket), under `communities/{user}/…`.
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @param {string} userId
 * @returns {Promise<string>} public URL
 */
export async function uploadCommunityCoverImage(buffer, mimetype, userId) {
  const bucket = config.communityImagesBucket;
  const ext = extForMime(mimetype);
  if (!ext) throw new AppError(400, "Only JPEG, PNG, WebP, or GIF images are allowed.");

  const folder = storageFolderForUser(userId);
  const runUpload = () =>
    supabaseAdmin.storage.from(bucket).upload(`communities/${folder}/${randomUUID()}.${ext}`, buffer, {
      contentType: mimetype,
      upsert: false,
    });

  await ensureCommunityImagesBucket();
  let { data, error } = await runUpload();

  if (error && isLikelyMissingBucketMessage(error.message)) {
    invalidateBucketCache();
    await ensureCommunityImagesBucket();
    ({ data, error } = await runUpload());
  }

  if (error) {
    const msg =
      typeof error === "string"
        ? error
        : error.message || (typeof error.error === "string" ? error.error : "") || String(error);
    if (/requested path is invalid/i.test(msg)) {
      throw new AppError(
        500,
        'Supabase Storage rejected the request URL ("requested path is invalid"). Set SUPABASE_URL to https://<project-ref>.supabase.co with no trailing slash and no extra path (see server .env.example). If you are opening a file URL in the browser, it must include /storage/v1/object/public/… per the Supabase Storage docs.',
      );
    }
    if (isLikelyMissingBucketMessage(msg)) {
      throw new AppError(
        500,
        `Storage bucket "${bucket}" is not usable after create/retry (${msg}). Confirm SUPABASE_SERVICE_ROLE_KEY, run the storage migration, or set COMMUNITY_IMAGES_BUCKET to an existing public bucket.`,
      );
    }
    throw new AppError(500, msg || "Image upload failed.");
  }
  const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(data.path);
  return pub.publicUrl;
}

/**
 * Upload a listing gallery image to the same public bucket, under `listings/{name-userid}/{uuid}.ext`.
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @param {string} userId
 * @param {string} [displayName]
 * @returns {Promise<string>} public URL
 */
export async function uploadListingImage(buffer, mimetype, userId, displayName = "") {
  const bucket = config.communityImagesBucket;
  const ext = extForMime(mimetype);
  if (!ext) throw new AppError(400, "Only JPEG, PNG, WebP, or GIF images are allowed.");

  const folder = folderSegmentForNamedUpload(displayName, userId);
  const objectPath = `listings/${folder}/${randomUUID()}.${ext}`;
  const runUpload = () =>
    supabaseAdmin.storage.from(bucket).upload(objectPath, buffer, {
      contentType: mimetype,
      upsert: false,
    });

  await ensureCommunityImagesBucket();
  let { data, error } = await runUpload();

  if (error && isLikelyMissingBucketMessage(error.message)) {
    invalidateBucketCache();
    await ensureCommunityImagesBucket();
    ({ data, error } = await runUpload());
  }

  if (error) {
    const msg =
      typeof error === "string"
        ? error
        : error.message || (typeof error.error === "string" ? error.error : "") || String(error);
    if (/requested path is invalid/i.test(msg)) {
      throw new AppError(
        500,
        'Supabase Storage rejected the request URL ("requested path is invalid"). Set SUPABASE_URL to https://<project-ref>.supabase.co with no trailing slash and no extra path (see server .env.example).',
      );
    }
    if (isLikelyMissingBucketMessage(msg)) {
      throw new AppError(
        500,
        `Storage bucket "${bucket}" is not usable after create/retry (${msg}). Confirm SUPABASE_SERVICE_ROLE_KEY, run the storage migration, or set COMMUNITY_IMAGES_BUCKET to an existing public bucket.`,
      );
    }
    throw new AppError(500, msg || "Image upload failed.");
  }
  const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(data.path);
  return pub.publicUrl;
}

/**
 * Upload a profile avatar to the same public bucket, under `avatar/{full-name-shortid}/{uuid}.ext`.
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @param {string} userId
 * @param {string} [displayName] Display/full name for folder (sanitized); falls back to a stable id segment if empty.
 * @returns {Promise<string>} public URL
 */
export async function uploadAvatarImage(buffer, mimetype, userId, displayName = "") {
  const bucket = config.communityImagesBucket;
  const ext = extForMime(mimetype);
  if (!ext) throw new AppError(400, "Only JPEG, PNG, WebP, or GIF images are allowed.");

  const folder = folderSegmentForNamedUpload(displayName, userId);
  const objectPath = `avatar/${folder}/${randomUUID()}.${ext}`;
  const runUpload = () =>
    supabaseAdmin.storage.from(bucket).upload(objectPath, buffer, {
      contentType: mimetype,
      upsert: false,
    });

  await ensureCommunityImagesBucket();
  let { data, error } = await runUpload();

  if (error && isLikelyMissingBucketMessage(error.message)) {
    invalidateBucketCache();
    await ensureCommunityImagesBucket();
    ({ data, error } = await runUpload());
  }

  if (error) {
    const msg =
      typeof error === "string"
        ? error
        : error.message || (typeof error.error === "string" ? error.error : "") || String(error);
    if (/requested path is invalid/i.test(msg)) {
      throw new AppError(
        500,
        'Supabase Storage rejected the request URL ("requested path is invalid"). Set SUPABASE_URL to https://<project-ref>.supabase.co with no trailing slash and no extra path (see server .env.example).',
      );
    }
    if (isLikelyMissingBucketMessage(msg)) {
      throw new AppError(
        500,
        `Storage bucket "${bucket}" is not usable after create/retry (${msg}). Confirm SUPABASE_SERVICE_ROLE_KEY, run the storage migration, or set COMMUNITY_IMAGES_BUCKET to an existing public bucket.`,
      );
    }
    throw new AppError(500, msg || "Image upload failed.");
  }
  const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(data.path);
  return pub.publicUrl;
}
