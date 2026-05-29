import {
  isLikelySameCommunityName,
  isSameCityAndProvince,
  isSameCommunityLocale,
} from "./communityNameSimilarity.js";

/** Split comma-separated address while respecting escaped commas (`\,`). */
function splitEscapedAddressParts(address) {
  const input = String(address || "");
  const parts = [];
  let current = "";
  let escaping = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (escaping) {
      current += ch;
      escaping = false;
      continue;
    }
    if (ch === "\\") {
      escaping = true;
      continue;
    }
    if (ch === ",") {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current.trim());
  return parts;
}

/** Same comma-separated profile address model as the client `splitAddressParts`. */
export function parseCommaProfileAddress(address) {
  const parts = splitEscapedAddressParts(address);
  if (parts.length === 7) {
    const [
      _addressHouseStreet = "",
      _addressSubdivision = "",
      addressBarangay = "",
      addressCity = "",
      addressProvince = "",
      addressPostalCode = "",
      _addressCountry = "",
    ] = parts;
    return {
      brgy: addressBarangay,
      city: addressCity,
      province: addressProvince,
      postalCode: addressPostalCode,
    };
  }
  if (parts.length <= 5) {
    const [addressApartment = "", addressCity = "", addressProvince = "", _country = "", addressPostalCode = ""] = parts;
    return {
      brgy: addressApartment,
      city: addressCity,
      province: addressProvince,
      postalCode: addressPostalCode,
    };
  }
  // Flexible fallback aligned with client splitAddressParts():
  // preserve stable tail mapping and right-anchor barangay.
  const addressPostalCode = parts.at(-2) || "";
  const addressProvince = parts.at(-3) || "";
  const addressCity = parts.at(-4) || "";
  const leading = parts.slice(0, -4);
  const addressBarangay = leading.length > 0 ? leading[leading.length - 1] || "" : "";
  return {
    brgy: addressBarangay,
    city: addressCity,
    province: addressProvince,
    postalCode: addressPostalCode,
  };
}

/**
 * Same locale resolution as `effectiveCommunityLocale` in marketplaceController
 * (DB columns, else last segments of `address` / `area_description`).
 */
function effectiveLocaleFromCommunityRow(row) {
  const dbCity = String(row.city ?? "").trim();
  const dbProv = String(row.province ?? "").trim();
  const dbPost = String(row.postal_code ?? row.postalCode ?? "").trim();
  if (dbCity || dbProv || dbPost) {
    return { city: dbCity, province: dbProv, postalCode: dbPost };
  }
  const raw = String(row.address ?? row.area_description ?? "").trim();
  if (!raw) return { city: "", province: "", postalCode: "" };
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) return { city: "", province: "", postalCode: "" };
  const postalCode = parts[parts.length - 1] || "";
  const province = parts[parts.length - 2] || "";
  const city = parts.slice(0, -2).join(", ") || "";
  return { city, province, postalCode };
}

/** "Barangay 5" / "Brgy. 5" / "BRGY 5" → comparable core label */
function stripBrgyPrefixLabel(s) {
  return String(s || "")
    .trim()
    .replace(/^(barangay|brgy\.?|bgy\.?|bar\.?)\s+/i, "")
    .trim()
    .replace(/\s+/g, " ");
}

function pickCommunityIdFromPool(pool, label) {
  const trimmed = String(label || "").trim();
  if (!trimmed) return null;
  const exact = pool.find((c) => String(c.name || "").trim() === trimmed);
  if (exact?.id) return String(exact.id);

  const sl = stripBrgyPrefixLabel(trimmed).toLowerCase();
  const byStrip = pool.find((c) => stripBrgyPrefixLabel(String(c.name || "").trim()).toLowerCase() === sl);
  if (byStrip?.id) return String(byStrip.id);

  const lower = trimmed.toLowerCase();
  const ci = pool.find((c) => String(c.name || "").trim().toLowerCase() === lower);
  if (ci?.id) return String(ci.id);
  const fuzzy = pool.find((c) => isLikelySameCommunityName(trimmed, String(c.name || "").trim()));
  return fuzzy?.id ? String(fuzzy.id) : null;
}

/**
 * Resolve a community UUID from a free-text community *name* using the same
 * exact → strip-"Barangay" → case-insensitive → fuzzy rules the client uses to
 * decide which community shop to show. Name-only (no locale) match, so the
 * profile's `community_id` stays in sync with the community the user sees.
 * @param {Record<string, unknown>[]} communityRows from `communities` select *
 * @param {string} communityName saved profile `community` label
 * @returns {string | null} community UUID or null
 */
export function findCommunityIdByName(communityRows, communityName) {
  return pickCommunityIdFromPool(communityRows || [], communityName);
}

/** Profile Brgy segment vs community `name` — same rules as `pickCommunityIdFromPool` for a single row. */
function labelMatchesCommunityName(profileBrgyLabel, commName) {
  const pool = [{ name: commName, id: "x" }];
  const hit = pickCommunityIdFromPool(pool, profileBrgyLabel);
  return Boolean(hit);
}

/**
 * True when the saved profile `address` string matches this community’s name + city/province/postal
 * (strict locale + name rules used for listing sync — no name-only fallback).
 */
export function doesProfileAddressMatchCommunity(communityRow, profileAddress) {
  const { brgy, city, province, postalCode } = parseCommaProfileAddress(profileAddress);
  const label = String(brgy || "").trim();
  if (!label) return false;
  if (!labelMatchesCommunityName(label, String(communityRow.name || "").trim())) return false;
  const hasLoc = Boolean(String(city || "").trim() && String(province || "").trim());
  if (!hasLoc) return false;
  const profileLoc = { city, province, postalCode };
  return isSameCommunityLocale(profileLoc, effectiveLocaleFromCommunityRow(communityRow));
}

/**
 * @param {Record<string, unknown>[]} communityRows from `communities` select *
 * @param {string} profileAddress saved profile `address` string
 * @returns {string | null} community UUID or null
 */
export function findCommunityIdForSellerAddress(communityRows, profileAddress) {
  const { brgy, city, province, postalCode } = parseCommaProfileAddress(profileAddress);
  const label = String(brgy || "").trim();
  if (!label) return null;
  const hasLoc = Boolean(String(city || "").trim() && String(province || "").trim());
  const profileLoc = { city, province, postalCode };

  if (!hasLoc) {
    return pickCommunityIdFromPool(communityRows, label);
  }

  const strictPool = communityRows.filter((c) =>
    isSameCommunityLocale(profileLoc, effectiveLocaleFromCommunityRow(c)),
  );
  const strictId = pickCommunityIdFromPool(strictPool, label);
  if (strictId) return strictId;

  const cityPool = communityRows.filter((c) => {
    const loc = effectiveLocaleFromCommunityRow(c);
    return isSameCityAndProvince(city, province, loc.city, loc.province);
  });
  const cityId = pickCommunityIdFromPool(cityPool, label);
  if (cityId) return cityId;

  return pickCommunityIdFromPool(communityRows, label);
}

function isFinitePinCoord(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln) && la >= -90 && la <= 90 && ln >= -180 && ln <= 180;
}

/**
 * Persist the seller's profile pin onto every product (non-service) listing they own, so the
 * product "Meet-up location" map matches the seller's profile pin even without the read-time overlay.
 * Services keep their own per-listing pin and are left untouched. A null/invalid pin is a no-op
 * (we never wipe stored coordinates from here).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 */
export async function syncSellerListingsLocationPin(supabase, sellerId, { lat, lng } = {}) {
  if (!sellerId || !isFinitePinCoord(lat, lng)) return;
  try {
    const { error } = await supabase
      .from("listings")
      .update({ lat: Number(lat), lng: Number(lng) })
      .eq("seller_id", sellerId)
      .neq("vertical_id", "services")
      .neq("status", "deleted");
    if (error) {
      // Missing lat/lng columns, RLS, or schema cache — profile save must still succeed.
    }
  } catch {
    /* ignore — pin persistence is best-effort */
  }
}

/**
 * Point all of the seller’s listings at the community that matches their profile address Brgy + locale.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 */
export async function syncSellerListingsCommunityId(supabase, sellerId, profileAddress) {
  try {
    const { data: rows, error: cerr } = await supabase.from("communities").select("*");
    if (cerr) return;
    const communityId = findCommunityIdForSellerAddress(rows || [], profileAddress);
    // Never wipe an existing attachment from an address edit: only (re)assign when the
    // address resolves to a community. A null result leaves listings on their current
    // community (e.g. one set explicitly when the seller joined or published).
    if (!communityId) return;
    const { error: uerr } = await supabase.from("listings").update({ community_id: communityId }).eq("seller_id", sellerId);
    if (uerr) {
      // Missing `community_id` column, RLS, or schema cache — profile save must still succeed
    }
  } catch {
    /* ignore */
  }
}
