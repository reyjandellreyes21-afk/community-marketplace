export const COUNTRY_OPTIONS = (() => {
  try {
    if (typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function" && typeof Intl.supportedValuesOf === "function") {
      const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
      const generated = Intl.supportedValuesOf("region")
        .map((code) => regionNames.of(code))
        .filter((name) => typeof name === "string" && name.trim().length > 0)
        .sort((a, b) => a.localeCompare(b));
      return Array.from(new Set(generated));
    }
  } catch {
    // Ignore and use fallback.
  }
  return ["Philippines", "United States", "Canada", "United Kingdom", "Australia", "Japan", "Singapore"];
})();

export const PH_PROVINCE_OPTIONS = [
  "Abra",
  "Agusan del Norte",
  "Agusan del Sur",
  "Aklan",
  "Albay",
  "Antique",
  "Apayao",
  "Aurora",
  "Basilan",
  "Bataan",
  "Batanes",
  "Batangas",
  "Benguet",
  "Biliran",
  "Bohol",
  "Bukidnon",
  "Bulacan",
  "Cagayan",
  "Camarines Norte",
  "Camarines Sur",
  "Camiguin",
  "Capiz",
  "Catanduanes",
  "Cavite",
  "Cebu",
  "Cotabato",
  "Davao de Oro",
  "Davao del Norte",
  "Davao del Sur",
  "Davao Occidental",
  "Davao Oriental",
  "Dinagat Islands",
  "Eastern Samar",
  "Guimaras",
  "Ifugao",
  "Ilocos Norte",
  "Ilocos Sur",
  "Iloilo",
  "Isabela",
  "Kalinga",
  "La Union",
  "Laguna",
  "Lanao del Norte",
  "Lanao del Sur",
  "Leyte",
  "Maguindanao del Norte",
  "Maguindanao del Sur",
  "Marinduque",
  "Masbate",
  "Misamis Occidental",
  "Misamis Oriental",
  "Mountain Province",
  "Negros Occidental",
  "Negros Oriental",
  "Northern Samar",
  "Nueva Ecija",
  "Nueva Vizcaya",
  "Occidental Mindoro",
  "Oriental Mindoro",
  "Palawan",
  "Pampanga",
  "Pangasinan",
  "Quezon",
  "Quirino",
  "Rizal",
  "Romblon",
  "Samar",
  "Sarangani",
  "Siquijor",
  "Sorsogon",
  "South Cotabato",
  "Southern Leyte",
  "Sultan Kudarat",
  "Sulu",
  "Surigao del Norte",
  "Surigao del Sur",
  "Tarlac",
  "Tawi-Tawi",
  "Zambales",
  "Zamboanga del Norte",
  "Zamboanga del Sur",
  "Zamboanga Sibugay",
];

export const normalizeCountryValue = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase() === "pilipinas") return "Philippines";
  return trimmed;
};

export const normalizePhLocalityName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\bcity of\b/g, "")
    .replace(/\bmunicipality of\b/g, "")
    .replace(/\bcity\b/g, "")
    .replace(/\bmunicipality\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const toPhilippinesLocalPhone10 = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  let local = digits;
  if (local.startsWith("63") && local.length >= 12) local = local.slice(2);
  if (local.startsWith("0") && local.length >= 11) local = local.slice(1);
  if (local.length > 10) local = local.slice(-10);
  return local.slice(0, 10);
};

export const toPhilippinesE164 = (local10) => {
  const local = toPhilippinesLocalPhone10(local10);
  return local ? `+63${local}` : "";
};

export const toPhilippinesLocal11Display = (value) => {
  const local10 = toPhilippinesLocalPhone10(value);
  return local10 ? `0${local10}` : "";
};

export const normalizePhPostalCode = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(0, 4);
  return "";
};

export const normalizePhPsgcCode = (value) => String(value || "").replace(/\D/g, "").trim();

export const toTitleCase = (value) =>
  String(value || "")
    .trim()
    .split(/\s+/)
    .map((segment) => (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase() : ""))
    .filter(Boolean)
    .join(" ");

export const formatPhCityMunicipalityName = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const cityOfMatch = raw.match(/^city of\s+(.+)$/i);
  if (cityOfMatch) return `${toTitleCase(cityOfMatch[1])} City`;
  const municipalityOfMatch = raw.match(/^municipality of\s+(.+)$/i);
  if (municipalityOfMatch) return `${toTitleCase(municipalityOfMatch[1])} Municipality`;
  return raw;
};

/** City, province, postal line on marketplace community cards (structured fields or comma-separated `address`). */
export const formatCommunityMarketplaceSubtitle = (c) => {
  const city = String(c.city || "").trim();
  const prov = String(c.province || "").trim();
  const zip = String(c.postalCode || "").trim();
  if (city || prov || zip) return [toTitleCase(city), toTitleCase(prov), zip].filter(Boolean).join(", ");
  return String(c.address || "")
    .split(",")
    .map((part) => toTitleCase(part.trim()))
    .filter(Boolean)
    .join(", ");
};

/** Align with server `profileListingCommunity.js` — "Barangay 5" vs "Brgy. 5" */
export const stripBrgyPrefixLabel = (s) =>
  String(s || "")
    .trim()
    .replace(/^(barangay|brgy\.?|bgy\.?|bar\.?)\s+/i, "")
    .trim()
    .replace(/\s+/g, " ");

export const splitEscapedAddressParts = (address) => {
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
};

export const escapeAddressPart = (value) =>
  String(value || "")
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,");

export const splitAddressParts = (address) => {
  const parts = splitEscapedAddressParts(address);
  if (parts.length === 7) {
    const [addressHouseStreet = "", addressSubdivision = "", addressBarangay = "", addressCity = "", addressProvince = "", addressPostalCode = "", addressCountry = ""] = parts;
    return {
      addressHouseStreet,
      addressSubdivision,
      addressBarangay,
      addressCity,
      addressProvince,
      addressCountry,
      addressPostalCode,
      completeAddress: addressHouseStreet,
    };
  }
  if (parts.length <= 5) {
    const [completeAddress = "", addressCity = "", addressProvince = "", addressCountry = "", addressPostalCode = ""] = parts;
    return {
      addressHouseStreet: completeAddress,
      addressSubdivision: "",
      addressBarangay: "",
      addressCity,
      addressProvince,
      addressCountry,
      addressPostalCode,
      completeAddress,
    };
  }
  const addressCountry = parts.at(-1) || "";
  const addressPostalCode = parts.at(-2) || "";
  const addressProvince = parts.at(-3) || "";
  const addressCity = parts.at(-4) || "";
  const leading = parts.slice(0, -4);
  const addressBarangay = leading.length > 0 ? leading[leading.length - 1] || "" : "";
  const addressSubdivision = leading.length > 1 ? leading[leading.length - 2] || "" : "";
  const addressHouseStreet =
    leading.length > 2 ? leading.slice(0, -2).filter(Boolean).join(", ") : leading[0] || "";
  const completeAddress = [addressHouseStreet, addressSubdivision, addressBarangay].filter(Boolean).join(", ");
  return {
    addressHouseStreet,
    addressSubdivision,
    addressBarangay,
    addressCity,
    addressProvince,
    addressCountry,
    addressPostalCode,
    completeAddress,
  };
};

export const buildAddressValue = (draft) =>
  [
    draft.addressHouseStreet,
    draft.addressSubdivision,
    draft.addressBarangay,
    draft.addressCity,
    draft.addressProvince,
    draft.addressPostalCode,
    draft.addressCountry,
  ]
    .map((part) => escapeAddressPart(part))
    .join(", ");
