/**
 * Detect typo / near-duplicate community names (e.g. "Calama Park Place" vs "Calamba Park Place").
 * Same name in a different city/province is treated as a different community.
 */

/** Levenshtein distance between two strings (case-sensitive; normalize callers). */
export function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  /** @type {number[]} */
  let prev = new Array(n + 1);
  /** @type {number[]} */
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;
  for (let i = 1; i <= m; i += 1) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j += 1) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  return prev[n];
}

function normalizeForCompare(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizePlacePart(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Same city and province (after normalizing) — used with community rows. */
export function isSameCityAndProvince(cityA, provA, cityB, provB) {
  return normalizePlacePart(cityA) === normalizePlacePart(cityB) && normalizePlacePart(provA) === normalizePlacePart(provB);
}

/**
 * Same city + province; when both sides have a postal value, postal must match too.
 * @param {{ city: string, province: string, postalCode?: string }} a
 * @param {{ city?: string, province?: string, postal_code?: string, postalCode?: string }} b
 */
export function isSameCommunityLocale(a, b) {
  if (!normalizePlacePart(a.city) || !normalizePlacePart(a.province)) return false;
  if (!isSameCityAndProvince(a.city, a.province, b.city, b.province)) return false;
  const pz = normalizePlacePart(a.postalCode ?? "");
  const bz = normalizePlacePart(b.postal_code ?? b.postalCode ?? "");
  if (pz && bz) return pz === bz;
  return true;
}

/**
 * True if `a` and `b` are the same place label for dedupe purposes (substring or small edit distance).
 */
export function isLikelySameCommunityName(a, b) {
  const x = normalizeForCompare(a);
  const y = normalizeForCompare(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return true;
  const maxLen = Math.max(x.length, y.length);
  if (maxLen < 6) return false;
  const d = levenshteinDistance(x, y);
  if (maxLen <= 10) return d <= 2;
  return d <= Math.max(2, Math.floor(maxLen * 0.12));
}

/** Name-only duplicate check when `communities` has no city/province/postal columns (legacy DB). */
export function findConflictingCommunityNameOnly(proposedName, existingNames) {
  const p = String(proposedName || "").trim();
  if (!p) return null;
  for (const raw of existingNames) {
    const ex = String(raw || "").trim();
    if (!ex) continue;
    if (normalizeForCompare(ex) === normalizeForCompare(p) || isLikelySameCommunityName(p, ex)) return ex;
  }
  return null;
}

/**
 * @param {{ name: string, city: string, province: string, postalCode?: string }} proposed
 * @param {{ name: string, city?: string, province?: string, postal_code?: string }[]} existing
 * @returns {string | null} conflicting existing name for error message
 */
export function findConflictingCommunity(proposed, existing) {
  const pName = String(proposed.name || "").trim();
  const pCity = String(proposed.city || "").trim();
  const pProv = String(proposed.province || "").trim();
  const pPost = String(proposed.postalCode ?? proposed.postal_code ?? "").trim();
  if (!pName) return null;
  const locOk = Boolean(normalizePlacePart(pCity) && normalizePlacePart(pProv));

  for (const row of existing) {
    const n = String(row.name || "").trim();
    if (!n) continue;
    const nameMatch =
      normalizeForCompare(n) === normalizeForCompare(pName) || isLikelySameCommunityName(pName, n);
    if (!nameMatch) continue;
    if (locOk) {
      if (isSameCommunityLocale({ city: pCity, province: pProv, postalCode: pPost }, row)) return n;
      continue;
    }
    return n;
  }
  return null;
}
