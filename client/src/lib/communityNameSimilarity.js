/**
 * Detect typo / near-duplicate community names (keep in sync with server/src/lib/communityNameSimilarity.js).
 * Same name in a different city/province is a different community.
 */

/** Levenshtein distance between two strings (case-sensitive; normalize callers). */
export function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
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
 * @param {{ city: string, province: string, postalCode?: string }} profile
 * @param {{ city?: string, province?: string, postalCode?: string }} community
 */
export function isSameCommunityLocale(profile, community) {
  if (!normalizePlacePart(profile.city) || !normalizePlacePart(profile.province)) return false;
  if (!isSameCityAndProvince(profile.city, profile.province, community.city, community.province)) return false;
  const pz = normalizePlacePart(profile.postalCode ?? "");
  const cz = normalizePlacePart(community.postalCode ?? "");
  if (pz && cz) return pz === cz;
  return true;
}

/** True if `a` and `b` are the same place label for dedupe purposes (substring or small edit distance). */
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
