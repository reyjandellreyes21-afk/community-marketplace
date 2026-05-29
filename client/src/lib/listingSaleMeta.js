import { formatCents } from "../marketplace/money.js";
import { formatBuyerCommentRequestedSlotsForDisplay } from "./serviceBookingSlot.js";

export const SALE_PERCENT_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 50, 70, 90];

/** Unit list price from `priceCents` — shows peso precision (e.g. ₱10.50), not floored to whole pesos. */
export const formatPesoWhole = (priceCents) => formatCents(priceCents);

export const parseSaleMetaFromDescription = (description) => {
  const text = String(description || "");
  const pctMatch = text.match(/Sale\s+(\d{1,2})%\s+off/i);
  const originalMatch = text.match(/Original\s+₱\s*(\d+(?:\.\d{1,2})?)/i);
  const originalPesos = originalMatch ? Number(originalMatch[1]) : null;
  const originalCents =
    originalMatch && Number.isFinite(originalPesos) && originalPesos > 0
      ? Math.round(originalPesos * 100)
      : null;
  return {
    percent: pctMatch ? Number(pctMatch[1]) : null,
    originalPesos: originalMatch && Number.isFinite(originalPesos) ? originalPesos : null,
    originalCents,
  };
};

export const removeSaleMetaLines = (description) =>
  String(description || "")
    .split("\n")
    .filter(
      (line) =>
        !/Sale\s+\d{1,2}%\s+off/i.test(line) && !/Original\s+₱\s*\d+(?:\.\d{1,2})?/i.test(line),
    )
    .join("\n")
    .trim();

/** COD fulfillment label for listing cards (pickup / delivery / both). */
export const listingCodAvailabilityLabel = (fulfillmentModes) => {
  const modes = Array.isArray(fulfillmentModes) ? fulfillmentModes : [];
  const supportsPickup = modes.includes("pickup");
  const supportsDelivery = modes.includes("delivery");
  return supportsPickup && supportsDelivery ? "COD pickup or delivery" : supportsDelivery ? "COD delivery" : "COD pickup";
};

/**
 * API / form may store variant choices as CSV or string[]; normalize for display.
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeListingOptionValues(raw) {
  if (Array.isArray(raw)) return raw.map((x) => String(x || "").trim()).filter(Boolean);
  return String(raw || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Normalize variant type labels for matching listing optionNameA/B to `Selected:` keys (case / space insensitive). */
export function normalizeVariantLabelKey(s) {
  return String(s || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Matches `Selected:` / `Selected :` at the start of a trimmed comment line (case-insensitive). */
const SELECTED_LINE_PREFIX = /^Selected\s*:\s*/i;

/** IME / pasted text often uses fullwidth `：` (U+FF1A) instead of ASCII `:`, which breaks prefix + pair parsing. */
function normalizeCommentForVariantParsing(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/\uFF1A/g, ":"); /* fullwidth colon → ASCII */
}

function parseSelectedSegmentRest(rest) {
  const normalizedRest = normalizeCommentForVariantParsing(rest);
  if (!normalizedRest) return null;
  /* Allow ASCII ·, bullet •, katakana middle dot ・ (U+30FB) between segments (IME / paste). */
  let segments = normalizedRest.split(/\s*[·•\u30FB]\s*/).map((s) => s.trim()).filter(Boolean);
  /* `Selected: Size: M, Color: Blue` — comma-separated pairs when no dot separator was used. */
  if (segments.length === 1) {
    const only = segments[0];
    if (only.includes(";") && only.includes(":")) {
      const semiParts = only.split(/\s*;\s*/).map((s) => s.trim()).filter(Boolean);
      if (
        semiParts.length > 1 &&
        semiParts.every((p) => /^[^:]+:\s*.+/.test(normalizeCommentForVariantParsing(p)))
      ) {
        segments = semiParts;
      }
    }
    if (segments.length === 1 && only.includes(",") && only.includes(":")) {
      const commaParts = only.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
      if (
        commaParts.length > 1 &&
        commaParts.every((p) => /^[^:]+:\s*.+/.test(normalizeCommentForVariantParsing(p)))
      ) {
        segments = commaParts;
      }
    }
  }
  const map = Object.create(null);
  for (const seg of segments) {
    const segN = normalizeCommentForVariantParsing(seg);
    const idx = segN.indexOf(":");
    if (idx <= 0) continue;
    const label = segN.slice(0, idx).trim();
    const value = segN.slice(idx + 1).trim();
    if (label && value) map[label] = value;
  }
  return Object.keys(map).length ? map : null;
}

function pickVariantFromParsedMap(map, listingLabel) {
  const want = normalizeVariantLabelKey(listingLabel);
  if (!want || !map) return undefined;
  for (const k of Object.keys(map)) {
    if (normalizeVariantLabelKey(k) === want) return map[k];
  }
  return undefined;
}

/**
 * Parses `Selected: Size: M · Color: Blue` metadata from buyer/order comments (quick-add / checkout).
 * Scans **any** line so a buyer note above `Selected:` still narrows variant chips.
 * @returns {Record<string, string>|null} Map variant label → chosen value
 */
export function parseBuyerSelectedVariantsFromComment(comment) {
  const text = normalizeCommentForVariantParsing(comment);
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!SELECTED_LINE_PREFIX.test(trimmed)) continue;
    const rest = trimmed.replace(SELECTED_LINE_PREFIX, "").trim();
    const map = parseSelectedSegmentRest(rest);
    if (map) return map;
  }
  return null;
}

/**
 * Removes `Selected: …` metadata lines from a buyer comment for display (chips already show variants).
 */
export function stripSelectedLinesFromComment(comment) {
  return String(comment || "")
    .split(/\r?\n/)
    .filter((line) => !SELECTED_LINE_PREFIX.test(normalizeCommentForVariantParsing(line).trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Order / purchase card: show free-text buyer note (with `Selected:` lines stripped for chip dedupe), or
 * a compact variant summary when the only stored data is `Selected:` / `variant_signature` (avoids a blank row).
 */
export function buyerCommentDisplayForOrderCard(rawComment, variantSignature = "") {
  const stripped = stripSelectedLinesFromComment(rawComment).trim();
  if (stripped && !/^n\/a$/i.test(stripped)) {
    return { show: true, label: "Comment", text: formatBuyerCommentRequestedSlotsForDisplay(stripped) };
  }
  const raw = String(rawComment || "").trim();
  const mapFromComment = parseBuyerSelectedVariantsFromComment(raw);
  const mapFromSig = variantMapFromPipeSignature(String(variantSignature || "").trim());
  const map = mapFromComment || mapFromSig;
  if (map && Object.keys(map).length) {
    const text = Object.keys(map)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => `${k}: ${map[k]}`)
      .join(" · ");
    return { show: true, label: "Selection", text };
  }
  if (raw && !/^n\/a$/i.test(raw)) {
    return { show: true, label: "Comment", text: formatBuyerCommentRequestedSlotsForDisplay(raw) };
  }
  return { show: false, label: "", text: "" };
}

/**
 * Parses canonical `Color:Blue|Size:M` stored on orders/cart as `variant_signature` (sorted keys in {@link variantSignatureFromBuyerComment}).
 */
export function variantMapFromPipeSignature(sig) {
  const s = String(sig || "").trim();
  if (!s) return null;
  const map = Object.create(null);
  for (const part of s.split("|")) {
    const seg = part.trim();
    const idx = seg.indexOf(":");
    if (idx <= 0) continue;
    const label = seg.slice(0, idx).trim();
    const value = seg.slice(idx + 1).trim();
    if (label && value) map[label] = value;
  }
  return Object.keys(map).length ? map : null;
}

/**
 * For cart/order rows backed by a full listing (all variant choices), narrow chips using `Selected:` in comment or persisted `variantSignature`.
 */
export function narrowListingOptionValuesForBuyerSelection(item) {
  const rawComment = item?.comment ?? item?.buyer_comment ?? item?.buyerComment;
  const rawSig = String(item?.variantSignature ?? item?.variant_signature ?? "").trim();
  const mapFromComment = parseBuyerSelectedVariantsFromComment(rawComment);
  const mapFromSig = variantMapFromPipeSignature(rawSig);
  const map = mapFromComment ?? mapFromSig;
  const nameA = String(item?.optionNameA || "").trim();
  const nameB = String(item?.optionNameB || "").trim();
  const rawA = normalizeListingOptionValues(item?.optionValuesA);
  const rawB = normalizeListingOptionValues(item?.optionValuesB);
  if (!map) {
    return { optionValuesA: rawA, optionValuesB: rawB };
  }
  const vA = pickVariantFromParsedMap(map, nameA);
  const vB = pickVariantFromParsedMap(map, nameB);
  /* When `Selected:` parsed: show only matched picks — never fall back to full listing CSV (case mismatch was hiding matches). */
  const outA = nameA && rawA.length ? (vA !== undefined ? [vA] : []) : rawA;
  const outB = nameB && rawB.length ? (vB !== undefined ? [vB] : []) : rawB;
  return { optionValuesA: outA, optionValuesB: outB };
}

/**
 * Stable key for merging cart lines / pending orders: sorted `Label:value` segments joined by `|`.
 * Empty when there is no `Selected:` line in the buyer comment.
 */
export function variantSignatureFromBuyerComment(comment) {
  const map = parseBuyerSelectedVariantsFromComment(comment);
  if (!map) return "";
  return Object.keys(map)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => `${k}:${map[k]}`)
    .join("|");
}

/**
 * Same canonical form as {@link variantSignatureFromBuyerComment} for live variant picks (quick-add / cart add).
 */
export function buildVariantSignatureFromSelections(listing, selA, selB) {
  const optLabelA = String(listing?.optionNameA || "").trim();
  const optLabelB = String(listing?.optionNameB || "").trim();
  const valsA = normalizeListingOptionValues(listing?.optionValuesA);
  const valsB = normalizeListingOptionValues(listing?.optionValuesB);
  const needsSelectA = Boolean(optLabelA && valsA.length > 0);
  const needsSelectB = Boolean(optLabelB && valsB.length > 0);
  const parts = [];
  if (needsSelectA && String(selA || "").trim()) parts.push(`${optLabelA}:${String(selA).trim()}`);
  if (needsSelectB && String(selB || "").trim()) parts.push(`${optLabelB}:${String(selB).trim()}`);
  parts.sort((a, b) => a.localeCompare(b));
  return parts.join("|");
}

const CART_LINE_SEP = "\u0001";

/**
 * Stable React key + selection id for a cart row.
 * Prefers `lineSignature` (variant + fulfillment + note) when present.
 */
export function cartLineKey(listingId, secondKey = "") {
  return `${String(listingId || "")}${CART_LINE_SEP}${String(secondKey ?? "")}`;
}

export function cartLineKeyFromItem(item) {
  const ls = String(item?.lineSignature ?? "").trim();
  if (ls) return cartLineKey(item?.listingId, ls);
  return cartLineKey(item?.listingId, item?.variantSignature);
}

/**
 * PATCH/DELETE `/me/cart/items/:listingId?lineSignature=` (or legacy variant-only suffix).
 * Pass the cart item object, or a bare 64-char hex lineSignature string.
 */
export function cartItemApiQuerySuffix(itemOrLineSignature) {
  if (itemOrLineSignature && typeof itemOrLineSignature === "object") {
    const ls = String(itemOrLineSignature.lineSignature ?? "").trim().toLowerCase();
    if (/^[a-f0-9]{64}$/.test(ls)) return `?lineSignature=${encodeURIComponent(ls)}`;
    const vs = String(itemOrLineSignature.variantSignature ?? "").trim();
    return vs ? `?variantSignature=${encodeURIComponent(vs)}` : "";
  }
  const raw = String(itemOrLineSignature ?? "").trim();
  const lower = raw.toLowerCase();
  if (/^[a-f0-9]{64}$/.test(lower)) return `?lineSignature=${encodeURIComponent(lower)}`;
  return raw ? `?variantSignature=${encodeURIComponent(raw)}` : "";
}
