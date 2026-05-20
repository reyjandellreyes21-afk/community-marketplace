const SELECTED_LINE_PREFIX = /^Selected\s*:\s*/i;

function normalizeCommentForVariantParsing(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/\uFF1A/g, ":");
}

function parseSelectedSegmentRest(rest) {
  const normalizedRest = normalizeCommentForVariantParsing(rest);
  if (!normalizedRest) return null;
  let segments = normalizedRest.split(/\s*[·•\u30FB]\s*/).map((s) => s.trim()).filter(Boolean);
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

/**
 * Mirrors client `parseBuyerSelectedVariantsFromComment` — scans any line for `Selected:`.
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

export function variantSignatureFromBuyerComment(comment) {
  const map = parseBuyerSelectedVariantsFromComment(comment);
  if (!map) return "";
  return Object.keys(map)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => `${k}:${map[k]}`)
    .join("|");
}
