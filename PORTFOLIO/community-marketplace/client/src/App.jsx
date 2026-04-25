import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import navLogo from "./assets/LM-LIGHT.png";
import tabLogo from "./assets/logo-png.png";
import heroStudyImage from "./assets/hero.png";
import communityImage from "./assets/community-image.png";
import { createSupabaseClient } from "./lib/supabaseClient";
import {
  isLikelySameCommunityName,
  isSameCityAndProvince,
  isSameCommunityLocale,
  levenshteinDistance,
} from "./lib/communityNameSimilarity.js";
import { formatBrowseLabel, getVerticalById, VERTICALS } from "./categoryNav.js";
import { gradientForId, initialsFromName } from "./communityUi.js";
import { LoggedInHeader } from "./components/LoggedInHeader.jsx";
import { PublicListingPage } from "./components/PublicListingPage.jsx";
import { formatCents } from "./marketplace/money.js";
import { SELLER_TABS, VIEWS } from "./views.js";
import { getApiV1Base } from "./apiBase.js";

/**
 * Dev: call the API on its own origin. The Vite proxy (`/api` → 4000) can 404 some POST routes
 * even when GET works. `cors()` on the server allows the browser origin.
 */
const API_URL = getApiV1Base();
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const COMMUNITY_MEMBERSHIP_KEY_PREFIX = "community_membership_v1:";
/** Success toast: full visible time before fade; fade length (should match CSS transition) */
const PUBLISH_TOAST_DURATION_MS = 7500;
const PUBLISH_TOAST_FADE_MS = 350;

const buildEmptyQuestion = () => ({
  text: "",
  kind: "mcq",
  options: ["", "", "", ""],
  correctOptionIndex: 0,
});
const quickFilterIcon = (id) => {
  const cls = "h-3.5 w-3.5 shrink-0";
  if (id === "new") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18" />
      </svg>
    );
  }
  if (id === "sale") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M17 17h.01M6 18 18 6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h5L6 11zM18 18h-5l5-5z" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
};
const categoryIcon = (id) => {
  const cls = "h-3.5 w-3.5 shrink-0";
  const key = String(id || "").toLowerCase();
  if (key.includes("grocer")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>🛒</span>;
  if (key.includes("food")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>🍽️</span>;
  if (key.includes("service")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>🛠️</span>;
  if (key.includes("property") || key.includes("home")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>🏠</span>;
  if (key.includes("electronic")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>💻</span>;
  if (key.includes("fashion")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>👕</span>;
  if (key.includes("vehicle")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>🚗</span>;
  if (key.includes("job")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>💼</span>;
  if (key.includes("pet")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>🐾</span>;
  if (key.includes("health") || key.includes("beauty")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>💊</span>;
  if (key.includes("baby") || key.includes("kids")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>🧸</span>;
  if (key.includes("sport")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>🏀</span>;
  if (key.includes("book") || key.includes("school")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>📚</span>;
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2" />
    </svg>
  );
};
/** Title-case each word: "rey jandell b reyes" → "Rey Jandell B Reyes". */
const formatDisplayName = (name) => {
  if (!name || typeof name !== "string") return "";
  return name
    .trim()
    .split(/\s+/)
    .map((segment) => {
      if (!segment) return "";
      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
    })
    .filter(Boolean)
    .join(" ");
};
/** Prefer structured name fields from the API; fall back to legacy `name` string. */
const getDisplayNameFromUser = (user) => {
  if (!user || typeof user !== "object") return "";
  const parts = [user.firstName, user.middleName, user.lastName].map((s) => String(s ?? "").trim()).filter(Boolean);
  if (parts.length > 0) return formatDisplayName(parts.join(" "));
  return formatDisplayName(user.name || "");
};

/** Read-only profile card: first + middle initial + last; edit form still uses full middle name. */
const getProfileCardDisplayNameFromUser = (user) => {
  if (!user || typeof user !== "object") return "";
  const first = String(user.firstName ?? "").trim();
  const middle = String(user.middleName ?? "").trim();
  const last = String(user.lastName ?? "").trim();
  if (first || middle || last) {
    const segments = [];
    if (first) segments.push(formatDisplayName(first));
    if (middle) segments.push(`${middle.charAt(0).toUpperCase()}.`);
    if (last) segments.push(formatDisplayName(last));
    return segments.join(" ");
  }
  return formatDisplayName(user.name || "");
};

const PROFILE_GENDER_OPTIONS = [
  ["female", "Female"],
  ["male", "Male"],
  ["non_binary", "Non-binary"],
  ["other", "Other"],
  ["prefer_not_to_say", "Prefer not to say"],
];
const COUNTRY_OPTIONS = (() => {
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
const PH_PROVINCE_OPTIONS = [
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
const normalizeCountryValue = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase() === "pilipinas") return "Philippines";
  return trimmed;
};
const normalizePhLocalityName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\bcity of\b/g, "")
    .replace(/\bmunicipality of\b/g, "")
    .replace(/\bcity\b/g, "")
    .replace(/\bmunicipality\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const toPhilippinesLocalPhone10 = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  let local = digits;
  if (local.startsWith("63") && local.length >= 12) local = local.slice(2);
  if (local.startsWith("0") && local.length >= 11) local = local.slice(1);
  if (local.length > 10) local = local.slice(-10);
  return local.slice(0, 10);
};
const toPhilippinesE164 = (local10) => {
  const local = toPhilippinesLocalPhone10(local10);
  return local ? `+63${local}` : "";
};
const toPhilippinesLocal11Display = (value) => {
  const local10 = toPhilippinesLocalPhone10(value);
  return local10 ? `0${local10}` : "";
};
const normalizePhPostalCode = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(0, 4);
  return "";
};
const normalizePhPsgcCode = (value) => String(value || "").replace(/\D/g, "").trim();
const formatPhCityMunicipalityName = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const cityOfMatch = raw.match(/^city of\s+(.+)$/i);
  if (cityOfMatch) return `${toTitleCase(cityOfMatch[1])} City`;
  const municipalityOfMatch = raw.match(/^municipality of\s+(.+)$/i);
  if (municipalityOfMatch) return `${toTitleCase(municipalityOfMatch[1])} Municipality`;
  return raw;
};

function formatBirthdayDisplay(iso) {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return iso;
  try {
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function computeAgeFromBirthday(iso) {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return "";
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return "";
  const birthDate = new Date(year, month - 1, day);
  if (Number.isNaN(birthDate.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - year;
  const hasBirthdayPassedThisYear =
    today.getMonth() > month - 1 || (today.getMonth() === month - 1 && today.getDate() >= day);
  if (!hasBirthdayPassedThisYear) age -= 1;
  if (age < 0 || age > 120) return "";
  return age;
}

function formatGenderDisplay(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  const found = PROFILE_GENDER_OPTIONS.find(([k]) => k === v);
  return found ? found[1] : v;
}
const toTitleCase = (value) =>
  String(value || "")
    .trim()
    .split(/\s+/)
    .map((segment) => (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase() : ""))
    .filter(Boolean)
    .join(" ");
/** City, province, postal line on marketplace community cards (structured fields or comma-separated `address`). */
const formatCommunityMarketplaceSubtitle = (c) => {
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
const stripBrgyPrefixLabel = (s) =>
  String(s || "")
    .trim()
    .replace(/^(barangay|brgy\.?|bgy\.?|bar\.?)\s+/i, "")
    .trim()
    .replace(/\s+/g, " ");

const splitEscapedAddressParts = (address) => {
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
const escapeAddressPart = (value) =>
  String(value || "")
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,");

const splitAddressParts = (address) => {
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
  // Flexible fallback: preserve stable tail mapping for city/province/postal/country.
  const addressCountry = parts.at(-1) || "";
  const addressPostalCode = parts.at(-2) || "";
  const addressProvince = parts.at(-3) || "";
  const addressCity = parts.at(-4) || "";
  const leading = parts.slice(0, -4);
  // Right-anchor Subdivision/Barangay so extra commas in house/street do not shift fields.
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
const buildAddressValue = (draft) =>
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
const getQuizListId = (quiz) => quiz?.id || quiz?._id;
const isQuizOwner = (quiz, currentUser) => {
  if (!currentUser?.id || quiz?.createdBy == null || quiz.createdBy === "") return false;
  return String(quiz.createdBy) === String(currentUser.id);
};
const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const getQuestionId = (question) => question?.id || question?._id;
const getQuestionKey = (question, index) => getQuestionId(question) || `idx-${index}`;
const normalizeQuestionKind = (value) => (value === "tf" ? "tf" : value === "fill" ? "fill" : "mcq");
const isQuestionInvalid = (q) => {
  if (!q.text?.trim() || q.text.trim().length < 5) return true;
  const kind = normalizeQuestionKind(q.kind);
  if (kind === "fill") return !(q.blankAnswer && String(q.blankAnswer).trim().length >= 1);
  return !Array.isArray(q.options) || q.options.some((o) => !String(o || "").trim()) || !q.options[q.correctOptionIndex]?.trim();
};
const buildQuestionPayload = (question) => {
  const kind = normalizeQuestionKind(question.kind);
  if (kind === "fill") {
    return {
      text: question.text.trim(),
      kind: "fill",
      options: [],
      correctAnswer: String(question.blankAnswer).trim(),
    };
  }
  return {
    text: question.text.trim(),
    kind,
    options: question.options.map((option) => option.trim()),
    correctAnswer: question.options[question.correctOptionIndex].trim(),
  };
};
const toEditableQuestion = (question) => {
  const kind = normalizeQuestionKind(question.kind);
  if (kind === "fill") {
    return {
      id: getQuestionId(question),
      text: question.text || "",
      kind: "fill",
      options: [],
      blankAnswer: question.correctAnswer || "",
      correctOptionIndex: 0,
    };
  }
  const options = Array.isArray(question.options) ? question.options : ["", ""];
  const matchedIndex = options.findIndex((opt) => String(opt).trim() === String(question.correctAnswer || "").trim());
  return {
    id: getQuestionId(question),
    text: question.text || "",
    kind,
    options,
    correctOptionIndex: matchedIndex >= 0 ? matchedIndex : 0,
    blankAnswer: "",
  };
};
const toCreateDraftQuestion = (question) => {
  const kind = normalizeQuestionKind(question.kind);
  if (kind === "fill") {
    return {
      text: question.text || "",
      kind: "fill",
      options: [],
      blankAnswer: question.correctAnswer || "",
      correctOptionIndex: 0,
    };
  }
  const options = Array.isArray(question.options) ? question.options : [];
  const safeOptions = kind === "tf" ? ["True", "False"] : options.length >= 2 ? options : ["", "", "", ""];
  const matchedIndex = safeOptions.findIndex((opt) => String(opt).trim() === String(question.correctAnswer || "").trim());
  return {
    text: question.text || "",
    kind,
    options: safeOptions,
    correctOptionIndex: matchedIndex >= 0 ? matchedIndex : 0,
    blankAnswer: "",
  };
};
const getApiErrorMessage = (payload, fallback) => {
  if (!payload || typeof payload !== "object") return fallback;
  const rawDetails = payload.error?.details;
  if (rawDetails && typeof rawDetails === "object" && !Array.isArray(rawDetails)) {
    const { method, url } = rawDetails;
    if (typeof method === "string" && typeof url === "string" && url) {
      return `Route not found (${method} ${url}).`;
    }
  }
  const detailed = Array.isArray(payload.error?.details)
    ? payload.error.details
        .map((entry) => {
          const msg = entry?.msg || entry?.message;
          if (!msg) return "";
          const field = entry?.path || entry?.param;
          return field ? `${field}: ${msg}` : msg;
        })
        .filter(Boolean)
        .join(" ")
    : "";
  const normalizedDetails = detailed.replace(/\s{2,}/g, " ").trim();
  if (/^firstName:\s*Invalid value$/i.test(normalizedDetails)) {
    return "Please enter a valid username.";
  }
  if (normalizedDetails) return normalizedDetails;
  const genericMessage = payload.error?.message || payload.message || fallback;
  return genericMessage === "Validation failed." ? "Please check your quiz fields and try again." : genericMessage;
};
const readApiPayload = async (response) => {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) {
    if (!response.ok) return { error: { message: `Request failed (${response.status})` } };
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    if (!response.ok) {
      return { error: { message: text.slice(0, 200) || `Request failed (${response.status})` } };
    }
    return { error: { message: "Invalid response from server." } };
  }
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read selected image."));
    reader.readAsDataURL(file);
  });

const apiRequest = async (path, { method = "GET", token, body, headers = {} } = {}) => {
  const requestHeaders = { ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  const hasBody = body !== undefined;
  if (hasBody && !(body instanceof FormData) && !requestHeaders["Content-Type"]) {
    requestHeaders["Content-Type"] = "application/json";
  }
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: hasBody ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    const proxiedDev = import.meta.env.DEV && API_URL.startsWith("/");
    let fallback = `Request failed (${response.status})`;
    if (response.status === 502 && proxiedDev) {
      fallback =
        "Request failed (502): Vite could not reach the API at http://127.0.0.1:4000. Start the backend (quiz-app/server → npm run dev) and wait for MongoDB to connect.";
    }
    const requestedUrl =
      typeof window !== "undefined"
        ? (() => {
            try {
              const base =
                API_URL.startsWith("http") ? API_URL : `${window.location.origin}${API_URL.startsWith("/") ? "" : "/"}${API_URL}`;
              return new URL(path.replace(/^\//, ""), `${base.replace(/\/+$/, "")}/`).href;
            } catch {
              return `${API_URL}${path}`;
            }
          })()
        : `${API_URL}${path}`;
    const error = new Error(
      `${getApiErrorMessage(payload, fallback)}${response.status === 404 ? `\nRequested: ${requestedUrl}` : ""}`,
    );
    error.status = response.status;
    throw error;
  }
  return payload;
};

/** Only treat 401 as invalid session — do not clear the token on network or server errors. */
const isUnauthorizedApiError = (error) => typeof error?.status === "number" && error.status === 401;

const getStreakDays = (attempts) => {
  if (!attempts.length) return 0;
  const uniqueDays = [...new Set(attempts.map((a) => new Date(a.submittedAt).toISOString().slice(0, 10)))].sort().reverse();
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (const day of uniqueDays) {
    if (day !== cursor.toISOString().slice(0, 10)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

const LANDING_TARGET_EXAMS = [
  {
    badge: "GRC",
    title: "Groceries and Essentials",
    description: "Find daily needs from trusted sellers in your neighborhood with quick local pickup options.",
  },
  {
    badge: "HOM",
    title: "Home and Living",
    description: "Browse furniture, appliances, and home upgrades posted by people in your area.",
  },
  {
    badge: "FAS",
    title: "Fashion and Personal",
    description: "Shop preloved and brand new fashion finds from nearby community sellers.",
  },
  {
    badge: "GAD",
    title: "Gadgets and Electronics",
    description: "Discover phones, accessories, and devices sold locally for safer meetups and faster deals.",
  },
  {
    badge: "SVS",
    title: "Local Services",
    description: "Connect with nearby service providers for repairs, errands, and home-based work.",
  },
  {
    badge: "COM",
    title: "Community Deals",
    description: "See curated listings and time-limited offers happening around your subdivision or barangay.",
  },
];

const LANDING_EXAM_SLIDE_SIZE = 3;
const LANDING_EXAM_SLIDES = Array.from({ length: Math.ceil(LANDING_TARGET_EXAMS.length / LANDING_EXAM_SLIDE_SIZE) }, (_, i) =>
  LANDING_TARGET_EXAMS.slice(i * LANDING_EXAM_SLIDE_SIZE, i * LANDING_EXAM_SLIDE_SIZE + LANDING_EXAM_SLIDE_SIZE),
);

const BROWSE_QUICK_FILTERS = [
  { id: "all", label: "All categories" },
  { id: "new", label: "New" },
  { id: "sale", label: "Sale" },
];
const SALE_PERCENT_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 50, 70, 90];
const formatPesoWhole = (priceCents) => `₱${Math.floor((Number(priceCents) || 0) / 100)}`;
const parseSaleMetaFromDescription = (description) => {
  const text = String(description || "");
  const pctMatch = text.match(/Sale\s+(\d{1,2})%\s+off/i);
  const originalMatch = text.match(/Original\s+₱\s*(\d+)/i);
  return {
    percent: pctMatch ? Number(pctMatch[1]) : null,
    originalPesos: originalMatch ? Number(originalMatch[1]) : null,
  };
};
const removeSaleMetaLines = (description) =>
  String(description || "")
    .split("\n")
    .filter((line) => !/Sale\s+\d{1,2}%\s+off/i.test(line) && !/Original\s+₱\s*\d+/i.test(line))
    .join("\n")
    .trim();

/** COD fulfillment label for listing cards (pickup / delivery / both). */
const listingCodAvailabilityLabel = (fulfillmentModes) => {
  const modes = Array.isArray(fulfillmentModes) ? fulfillmentModes : [];
  const supportsPickup = modes.includes("pickup");
  const supportsDelivery = modes.includes("delivery");
  return supportsPickup && supportsDelivery ? "COD pickup + delivery" : supportsDelivery ? "COD delivery" : "COD pickup";
};

/**
 * Same stack as community product cards: title, price (+ sale), quantity row, availability, description.
 * When `quantityAfterDescription` is true (cart / add modal), quantity renders after the description.
 * `quantityRow` is usually listing stock (browse) or an adjustable qty control (cart / add modal).
 */
function MarketplaceProductDetailStack({
  title,
  priceCents,
  description,
  fulfillmentModes,
  quantityRow,
  quantityAfterDescription = false,
  hideDescription = false,
}) {
  const saleMeta = parseSaleMetaFromDescription(description);
  const currentPesos = Math.floor((Number(priceCents) || 0) / 100);
  const originalPesos = Number.isFinite(Number(saleMeta.originalPesos)) ? Number(saleMeta.originalPesos) : null;
  const descriptionPreview = removeSaleMetaLines(description);
  const availabilityLabel = listingCodAvailabilityLabel(fulfillmentModes);

  const qtyBlock = quantityRow ? <div className="pt-0.5">{quantityRow}</div> : null;
  const availabilityBlock = <p className="text-xs text-neutral-600 dark:text-slate-400">Availability: {availabilityLabel}</p>;
  const descriptionBlock = !hideDescription && descriptionPreview ? (
    <p className="line-clamp-3 text-pretty text-xs leading-relaxed text-neutral-600 dark:text-slate-400">{descriptionPreview}</p>
  ) : null;

  return (
    <div className="min-w-0 flex-1 space-y-1">
      {title ? <p className="truncate text-sm font-semibold text-neutral-900 dark:text-slate-100">{title}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-neutral-800 dark:text-slate-200">{formatPesoWhole(priceCents)}</p>
        {originalPesos != null && originalPesos > currentPesos ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-neutral-500 line-through dark:text-slate-400">₱{originalPesos}</span>
            {saleMeta.percent ? (
              <span className="rounded-full border border-amber-300/90 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                -{saleMeta.percent}%
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {quantityAfterDescription ? (
        <>
          {availabilityBlock}
          {descriptionBlock}
          {qtyBlock}
        </>
      ) : (
        <>
          {qtyBlock}
          {availabilityBlock}
          {descriptionBlock}
        </>
      )}
    </div>
  );
}

/** Maps API `order.status` to Orders view tabs (Pending / Processing / Completed / Cancelled). */
const ORDERS_STATUS_TABS = [
  { id: "pending", label: "Pending" },
  { id: "processing", label: "Processing" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];
const orderMatchesOrdersStatusTab = (status, tabId) => {
  const s = String(status || "").toLowerCase();
  if (tabId === "pending") return s === "placed";
  if (tabId === "completed") return s === "completed";
  if (tabId === "cancelled") return s === "cancelled";
  if (tabId === "processing") return Boolean(s) && !["placed", "completed", "cancelled"].includes(s);
  return false;
};

const UI_KIT = {
  viewSection:
    "app-card rounded-2xl border border-brand-primary/15 bg-gradient-to-b from-white to-violet-50/30 shadow-sm ring-1 ring-brand-primary/5 dark:border-slate-700 dark:from-slate-900 dark:to-slate-900/70 dark:ring-slate-800/80",
  sectionTitle: "text-[1.65rem] font-semibold tracking-tight text-neutral-900 dark:text-slate-100",
  sectionSubtitle: "mt-1 text-sm leading-relaxed text-neutral-600 dark:text-slate-400",
  headerEyebrow: "text-[11px] font-semibold uppercase tracking-wide text-brand-primary dark:text-brand-accent",
  surfaceCard:
    "rounded-2xl border border-brand-primary/15 bg-white/95 shadow-sm ring-1 ring-brand-primary/5 dark:border-slate-700 dark:bg-slate-900/80 dark:ring-slate-800/70",
  surfaceRaised:
    "rounded-2xl border border-brand-primary/20 bg-gradient-to-b from-white to-brand-soft/20 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-900/70",
  surfaceFloating:
    "rounded-2xl border border-brand-primary/20 bg-white/95 shadow-[0_18px_45px_rgba(76,29,149,0.12)] dark:border-slate-700 dark:bg-slate-900/95",
  surfaceMuted: "rounded-xl border border-neutral-200/80 bg-neutral-50/60 dark:border-slate-700 dark:bg-slate-900/45",
  stateSuccess:
    "border-emerald-200/90 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  stateWarning:
    "border-amber-200/90 bg-amber-50/90 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  stateDanger: "border-rose-200/90 bg-rose-50/90 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
  chipActive:
    "inline-flex items-center rounded-full border border-brand-primary/30 bg-brand-soft/70 px-2.5 py-1 text-xs font-semibold text-brand-primary dark:border-brand-accent/35 dark:bg-slate-800 dark:text-slate-100",
  chipMuted:
    "inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  tabActive:
    "bg-brand-soft text-brand-primary ring-2 ring-brand-primary/30 dark:bg-slate-800 dark:text-slate-100 dark:ring-brand-accent/30",
  tabIdle: "border border-neutral-200/90 text-neutral-700 hover:bg-neutral-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800",
};

function SectionHeading({ title, subtitle, trailing = null }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className={UI_KIT.sectionTitle}>{title}</h2>
        {subtitle ? <p className={UI_KIT.sectionSubtitle}>{subtitle}</p> : null}
      </div>
      {trailing}
    </div>
  );
}

function FilterOptionButton({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      className={`min-h-[2.75rem] w-full rounded-xl border px-3 py-2.5 text-left text-sm font-medium leading-tight transition ${
        active
          ? "border-brand-primary/50 bg-white text-brand-primary shadow-sm ring-1 ring-brand-primary/15 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-brand-primary/20"
          : "border-transparent bg-white/80 text-neutral-700 hover:border-neutral-200 hover:bg-white dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
      }`}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1.5">
        {icon}
        <span>{label}</span>
      </span>
    </button>
  );
}

function MarketplaceListingCard({ listing, isFavorite, onOpen, onToggleFavorite }) {
  const saleMeta = parseSaleMetaFromDescription(listing.description);
  const currentPesos = Math.floor((Number(listing.priceCents) || 0) / 100);
  const originalPesos = Number.isFinite(Number(saleMeta.originalPesos)) ? Number(saleMeta.originalPesos) : null;
  const descriptionPreview = removeSaleMetaLines(listing.description);
  return (
    <div
      role="button"
      tabIndex={0}
      className="group relative cursor-pointer rounded-2xl border border-neutral-200/90 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-primary/35 hover:shadow-md dark:border-slate-600 dark:bg-slate-900/80 dark:hover:border-slate-500"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <p className="pr-10 text-xs font-semibold text-brand-primary">{getVerticalById(listing.verticalId)?.label ?? listing.verticalId}</p>
      <h3 className="mt-1 truncate text-base font-semibold text-neutral-900 dark:text-slate-100">{listing.title}</h3>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-sm font-semibold text-neutral-800 dark:text-slate-200">{formatPesoWhole(listing.priceCents)}</p>
        {originalPesos != null && originalPesos > currentPesos ? (
          <>
            <span className="text-xs font-medium text-neutral-500 line-through dark:text-slate-400">₱{originalPesos}</span>
            {saleMeta.percent ? (
              <span className="rounded-full border border-amber-300/90 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                -{saleMeta.percent}%
              </span>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-neutral-600 dark:text-slate-400">
          Qty <span className="font-semibold text-neutral-800 dark:text-slate-200">{Number(listing.quantity) || 0}</span>
        </p>
        {listing.cityLabel ? <span className={UI_KIT.chipMuted}>{listing.cityLabel}</span> : null}
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-neutral-600 dark:text-slate-400">{descriptionPreview}</p>
    </div>
  );
}

function SellerProductCard({ listing, gridMode, onSaleSelect, onEdit, onDelete }) {
  const [saleOpen, setSaleOpen] = useState(false);
  const normalizedStatus = String(listing.status || "").toLowerCase();
  const statusClass =
    normalizedStatus === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
      : "border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-300";
  const imageUrl = String(listing.imageUrl || "").trim();
  const availabilityLabel = listingCodAvailabilityLabel(listing.fulfillmentModes);
  const saleMeta = parseSaleMetaFromDescription(listing.description);
  const currentPesos = Math.floor((Number(listing.priceCents) || 0) / 100);
  const originalPesos = Number.isFinite(Number(saleMeta.originalPesos)) ? Number(saleMeta.originalPesos) : null;
  const descriptionPreview = removeSaleMetaLines(listing.description);

  return (
    <li className={`rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 ${gridMode ? "h-full" : ""}`}>
      <div className={`flex ${gridMode ? "flex-col gap-2.5" : "flex-row items-start gap-3"}`}>
        <div className={`shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-slate-700 dark:bg-slate-800 ${gridMode ? "h-48 w-full" : "h-32 w-32"}`}>
          {imageUrl ? (
            <img src={imageUrl} alt={listing.title || "Product"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-400">No image</div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-semibold text-neutral-900 dark:text-slate-100">{listing.title || "Untitled product"}</p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-neutral-800 dark:text-slate-200">{formatPesoWhole(listing.priceCents)}</p>
            {originalPesos != null && originalPesos > currentPesos ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-neutral-500 line-through dark:text-slate-400">₱{originalPesos}</span>
                {saleMeta.percent ? (
                  <span className="rounded-full border border-amber-300/90 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                    -{saleMeta.percent}%
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <p className="text-xs text-neutral-600 dark:text-slate-400">
            Quantity: {Number(listing.quantity) || 0}
          </p>
          <p className="text-xs text-neutral-600 dark:text-slate-400">Availability: {availabilityLabel}</p>
          {descriptionPreview ? (
            <p className="line-clamp-3 text-pretty text-xs leading-relaxed text-neutral-600 dark:text-slate-400">{descriptionPreview}</p>
          ) : null}
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${statusClass}`}>{normalizedStatus || "unknown"}</span>
        </div>
        <div className={`flex items-center gap-1.5 ${gridMode ? "self-start" : "shrink-0"}`}>
          <button
            type="button"
            className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-300 dark:hover:bg-amber-950/30"
            onClick={() => setSaleOpen((prev) => !prev)}
          >
            Sale
          </button>
          <button
            type="button"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={onEdit}
          >
            Edit
          </button>
          <button
            type="button"
            className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </div>
      {saleOpen ? (
        <div className="mt-3 overflow-x-auto">
          <div className="flex min-w-max items-center gap-1.5 rounded-xl border border-amber-200/80 bg-amber-50/80 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
            {SALE_PERCENT_OPTIONS.map((percent) => (
              <button
                key={percent}
                type="button"
                className="rounded-md border border-amber-300/90 bg-white px-2 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/50 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-900/30"
                onClick={() => {
                  onSaleSelect(percent);
                  setSaleOpen(false);
                }}
              >
                {percent}%
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function CommunityShopListingCard({
  listing,
  gridMode,
  isFavorite,
  onAdd,
  onBuy,
  onToggleFavorite,
  showActions = false,
  showFavoriteIcon = true,
  currentUserId = "",
  onSaleSelect,
  onEdit,
}) {
  const [saleOpen, setSaleOpen] = useState(false);
  const imageUrl = String(listing.imageUrl || "").trim();
  const isOwner = String(listing.sellerId || "") === String(currentUserId || "");

  return (
    <div
      className={`group relative rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-primary/35 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/75 ${gridMode ? "h-full" : ""}`}
    >
      {!isOwner && showFavoriteIcon ? (
        <button
          type="button"
          className="absolute right-3 top-3 z-10 rounded-full border border-neutral-200/90 bg-white/95 p-1.5 text-rose-500 shadow-sm transition hover:bg-rose-50 dark:border-slate-600 dark:bg-slate-900/95 dark:hover:bg-rose-950/30"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.();
          }}
        >
          <span className="text-base leading-none">{isFavorite ? "♥" : "♡"}</span>
        </button>
      ) : null}
      <div className={`flex ${gridMode ? "flex-col gap-2.5" : "flex-row items-start gap-3"}`}>
        <div className={`shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-slate-700 dark:bg-slate-800 ${gridMode ? "h-48 w-full" : "h-32 w-32"}`}>
          {imageUrl ? (
            <img src={imageUrl} alt={listing.title || "Product"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-400">No image</div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <MarketplaceProductDetailStack
            title={listing.title || "Untitled product"}
            priceCents={listing.priceCents}
            description={listing.description}
            fulfillmentModes={listing.fulfillmentModes}
            quantityRow={
              <p className="text-xs text-neutral-600 dark:text-slate-400">Quantity: {Number(listing.quantity) || 0}</p>
            }
          />
          {listing.cityLabel ? <span className={UI_KIT.chipMuted}>{listing.cityLabel}</span> : null}
        </div>
      </div>
      {showActions ? (
        <div className="mt-3 flex items-center gap-2">
          {isOwner ? (
            <>
              <button
                type="button"
                className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-300 dark:hover:bg-amber-950/30"
                onClick={(e) => {
                  e.stopPropagation();
                  setSaleOpen((prev) => !prev);
                }}
              >
                Sale
              </button>
              <button
                type="button"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                }}
              >
                Edit
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd?.();
                }}
              >
                Add to cart
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-primary/90 dark:bg-brand-accent dark:text-slate-900 dark:hover:bg-brand-accent/90"
                onClick={(e) => {
                  e.stopPropagation();
                  onBuy?.();
                }}
              >
                Buy
              </button>
            </>
          )}
        </div>
      ) : null}
      {showActions && isOwner && saleOpen ? (
        <div className="mt-2 overflow-x-auto">
          <div className="flex min-w-max items-center gap-1.5 rounded-xl border border-amber-200/80 bg-amber-50/80 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
            {SALE_PERCENT_OPTIONS.map((percent) => (
              <button
                key={percent}
                type="button"
                className="rounded-md border border-amber-300/90 bg-white px-2 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/50 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-900/30"
                onClick={(e) => {
                  e.stopPropagation();
                  onSaleSelect?.(percent);
                  setSaleOpen(false);
                }}
              >
                {percent}%
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LandingIllustration() {
  return (
    <div className="relative w-full overflow-hidden rounded-[1.75rem] border border-neutral-200/80 bg-gradient-to-br from-white to-violet-50/60 shadow-[0_18px_45px_-28px_rgba(67,56,202,0.45)] dark:border-slate-700 dark:from-slate-900 dark:to-slate-800/80">
      <div className="aspect-[16/10] w-full">
        <img
          src={communityImage}
          alt="Local community marketplace"
          className="h-full w-full object-cover object-[74%_center]"
        />
      </div>
    </div>
  );
}

function QuizAppLogo({ className = "h-7 w-auto max-w-[11rem] shrink-0 object-contain sm:h-8 sm:max-w-[13rem]" }) {
  return <img src={navLogo} alt="LinkMark logo" className={className} />;
}

function EyeShowPasswordIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeHidePasswordIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 01-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

function ChevronDownIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ChevronLeftIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function LandingFooterIconMail(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <path d="M22 6l-10 7L2 6" />
    </svg>
  );
}

function LandingFooterIconMapPin(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function LandingSiteFooter() {
  const accent = "text-teal-400 shrink-0";
  return (
    <footer className="landing-site-footer w-full" role="contentinfo">
      <svg className="block h-11 w-full shrink-0" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden>
        <path fill="#2d3748" d="M0 48V16Q720 0 1440 16V48H0z" />
      </svg>
      <div className="-mt-px bg-[#2d3748] px-6 pb-8 pt-0 sm:px-8 lg:px-12">
        <div className="app-container mx-auto grid max-w-7xl grid-cols-1 gap-12 pb-14 md:grid-cols-2 md:gap-10 lg:grid-cols-3 lg:gap-8 lg:pb-16">
          <div className="text-left">
            <h2 className="text-base font-bold tracking-tight text-white">Why LinkMart</h2>
            <p className="mt-4 text-sm leading-relaxed text-white/85">
              LinkMart is built for local communities where neighbors can buy and sell with people they trust.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/85">
              Discover nearby listings, support local sellers, and complete faster transactions inside your subdivision, barangay, or compound.
            </p>
          </div>
          <div className="text-left">
            <h2 className="text-base font-bold tracking-tight text-white">Contact</h2>
            <ul className="mt-4 flex flex-col gap-4 text-sm">
              <li className="flex gap-3">
                <LandingFooterIconMail className={`${accent} mt-0.5`} />
                <a href="mailto:reyjandellreyes21@gmail.com">reyjandellreyes21@gmail.com</a>
              </li>
              <li className="flex gap-3">
                <LandingFooterIconMapPin className={`${accent} mt-0.5 self-start`} />
                <span className="text-white/90">
                  CPR, Calamba City,
                  <br />
                  Laguna, Philippines
                </span>
              </li>
            </ul>
          </div>
          <div className="text-left">
            <h2 className="text-base font-bold tracking-tight text-white">Key stats</h2>
            <dl className="mt-4 flex flex-col gap-6">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-white/55">Active listings</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">8k+</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-white/55">Local sellers</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">1.2k+</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-white/55">Covered communities</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">50+</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="app-container mx-auto max-w-7xl border-t border-white/15 pt-10">
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col items-center gap-1 lg:items-start">
              <QuizAppLogo className="h-9 w-auto max-w-[12rem] shrink-0 object-contain brightness-0 invert sm:h-10 sm:max-w-[13rem]" />
              <p className="text-xs font-medium tracking-wide text-white/55">Local marketplace for every community</p>
            </div>
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/85" aria-label="Legal">
              <a href="#">Privacy Policy</a>
              <a href="#">Copyright</a>
              <a href="#">Terms of Service</a>
            </nav>
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <a href="#" className="landing-footer-social" aria-label="Facebook">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a href="#" className="landing-footer-social" aria-label="X / Twitter">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="#" className="landing-footer-social" aria-label="Instagram">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a href="#" className="landing-footer-social" aria-label="YouTube">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function LandingFeatureIconDiscussion(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  );
}

function LandingFeatureIconExchange(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <path d="M8 7h8M8 11h6" />
    </svg>
  );
}

function LandingFeatureIconBuddy(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function LandingFeatureRow({ Icon, eyebrow, title, body }) {
  return (
    <div className="flex gap-4 sm:gap-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-brand-accent shadow-sm dark:bg-slate-800 dark:text-brand-accent">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-accent">{eyebrow}</p>
        <h3 className="mt-1 text-base font-bold leading-snug text-neutral-900 dark:text-slate-100 sm:text-lg">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-slate-400">{body}</p>
      </div>
    </div>
  );
}

const LANDING_FEATURE_ROWS = [
  {
    Icon: LandingFeatureIconDiscussion,
    eyebrow: "Verified Local Sellers",
    title: "Buy with more confidence nearby",
    body: "Transact with sellers in your own community so pickups and communication are easier to manage.",
  },
  {
    Icon: LandingFeatureIconExchange,
    eyebrow: "Fast Local Listings",
    title: "Post and sell in minutes",
    body: "Create listings quickly and reach active buyers around your area without complex setup.",
  },
  {
    Icon: LandingFeatureIconBuddy,
    eyebrow: "Community Connections",
    title: "Build trust through repeat transactions",
    body: "Grow your reputation with neighbors and keep a reliable marketplace network close to home.",
  },
];

function OrderPlacementForm({ listing, token, onDone, onError }) {
  const modes = listing?.fulfillmentModes?.length ? listing.fulfillmentModes : ["pickup"];
  const [fulfillmentType, setFulfillmentType] = useState(() => (modes.includes("pickup") ? "pickup" : modes[0]));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const m = listing?.fulfillmentModes?.length ? listing.fulfillmentModes : ["pickup"];
    setFulfillmentType(m.includes("pickup") ? "pickup" : m[0]);
  }, [listing?.id, listing?.fulfillmentModes]);

  const place = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      await apiRequest("/orders", {
        method: "POST",
        token,
        body: { listingId: listing.id, fulfillmentType, quantity: 1 },
      });
      onDone("Order placed. Pay COD at pickup or when delivery is completed.");
    } catch (e) {
      onError(e.message || "Could not place order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-neutral-200/90 bg-white/80 p-4 dark:border-slate-600 dark:bg-slate-900/60">
      <p className="text-sm font-medium text-neutral-800 dark:text-slate-200">Place order (COD)</p>
      <div className="flex flex-wrap gap-3 text-sm">
        {modes.includes("pickup") ? (
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input type="radio" name="fulfillment" checked={fulfillmentType === "pickup"} onChange={() => setFulfillmentType("pickup")} />
            Pickup (pay seller in cash when you meet)
          </label>
        ) : null}
        {modes.includes("delivery") ? (
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input type="radio" name="fulfillment" checked={fulfillmentType === "delivery"} onChange={() => setFulfillmentType("delivery")} />
            Delivery (couriers bid; pay COD at handoff)
          </label>
        ) : null}
      </div>
      <button type="button" className="btn-primary" disabled={submitting} onClick={place}>
        {submitting ? "Placing…" : "Confirm order"}
      </button>
    </div>
  );
}

function CategoryDropdown({ value, onChange, categories, placeholder = "Pick or type a category" }) {
  const [open, setOpen] = useState(false);
  const query = String(value || "").toLowerCase();
  const options = categories.filter((category) => !query || category.toLowerCase().includes(query));

  return (
    <div className="relative">
      <input
        className="input-base pr-10"
        placeholder={placeholder}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        required
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-neutral-500 hover:text-neutral-700 dark:text-slate-400 dark:hover:text-slate-200"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Toggle category suggestions"
      >
        <ChevronDownIcon className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && options.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-900">
          {options.map((category) => (
            <button
              key={category}
              type="button"
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-slate-300 dark:hover:bg-slate-800"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(category);
                setOpen(false);
              }}
            >
              {category}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CartSellerSelectAllCheckbox({ allChecked, someSelected, onChange, ariaLabel }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(someSelected && !allChecked);
  }, [someSelected, allChecked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="h-4 w-4 shrink-0 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary/35 dark:border-slate-500"
      checked={allChecked}
      onChange={onChange}
      aria-label={ariaLabel}
    />
  );
}

function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authPanelVisible, setAuthPanelVisible] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
    country: "",
    age: "",
    acceptedTerms: false,
  });
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("quiz_token") || "");
  const navigate = useNavigate();
  const location = useLocation();
  const routeListingId = useMemo(() => /\/l\/([0-9a-f-]{36})/i.exec(location.pathname)?.[1] ?? null, [location.pathname]);
  useEffect(() => {
    const supabase = createSupabaseClient();
    if (!supabase) return undefined;
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      const accessToken = data?.session?.access_token;
      if (!mounted || !accessToken) return;
      setToken(accessToken);
      localStorage.setItem("quiz_token", accessToken);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const accessToken = session?.access_token || "";
      if (!accessToken) return;
      setToken(accessToken);
      localStorage.setItem("quiz_token", accessToken);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const [message, setMessage] = useState("");
  const [theme, setTheme] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem("quiz_theme_v2") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const [landingExamSlide, setLandingExamSlide] = useState(0);
  const [usersList, setUsersList] = useState([]);
  const usersListRef = useRef([]);
  usersListRef.current = usersList;
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [profileJoinedAt, setProfileJoinedAt] = useState("");
  const [profileJoinedAtResolved, setProfileJoinedAtResolved] = useState(false);

  const [activeView, setActiveView] = useState(VIEWS.BROWSE);
  const isBrowseLikeView = useMemo(
    () => activeView === VIEWS.BROWSE || activeView === VIEWS.COMMUNITY_SHOP || activeView === VIEWS.FAVORITES,
    [activeView],
  );
  /** @type {[string | null, import('react').Dispatch<import('react').SetStateAction<string | null>>]} */
  const [browseVerticalId, setBrowseVerticalId] = useState(null);
  const [browseSubId, setBrowseSubId] = useState(null);
  const [browseQuickFilter, setBrowseQuickFilter] = useState("all");
  const [selectedListingId, setSelectedListingId] = useState(null);
  const [listingDetail, setListingDetail] = useState(null);
  const [listings, setListings] = useState([]);
  const [sellerListings, setSellerListings] = useState([]);
  const sellerListingsRef = useRef([]);
  sellerListingsRef.current = sellerListings;
  const [sellerListingsLoading, setSellerListingsLoading] = useState(false);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState("");
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesList, setFavoritesList] = useState([]);
  const favoritesListRef = useRef([]);
  favoritesListRef.current = favoritesList;
  const [orders, setOrders] = useState([]);
  const ordersRef = useRef([]);
  ordersRef.current = orders;
  const [ordersRole, setOrdersRole] = useState("buyer");
  const [ordersStatusTab, setOrdersStatusTab] = useState("pending");
  const [ordersLoading, setOrdersLoading] = useState(false);
  /** `orderId` -> selected (orders screen only). */
  const [orderSelection, setOrderSelection] = useState({});
  const [ordersBulkActionSubmitting, setOrdersBulkActionSubmitting] = useState(false);
  const [orderListingsById, setOrderListingsById] = useState({});
  const [sellerSummary, setSellerSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [expenseDraft, setExpenseDraft] = useState({ amountPesos: "", category: "supplies", note: "" });
  const [listingForm, setListingForm] = useState({
    title: "",
    description: "",
    pricePesos: "",
    quantity: "",
    categories: "",
    subId: "all",
    pickup: false,
    delivery: false,
  });
  const [listingImageFile, setListingImageFile] = useState(null);
  const [listingImagePreviewUrl, setListingImagePreviewUrl] = useState("");
  const [editingListingId, setEditingListingId] = useState(null);
  const [listingImageDragActive, setListingImageDragActive] = useState(false);
  const listingImageInputRef = useRef(null);
  const [listingSaving, setListingSaving] = useState(false);
  const [listingFieldErrors, setListingFieldErrors] = useState({});
  const [marketplaceMessage, setMarketplaceMessage] = useState("");
  const [communities, setCommunities] = useState([]);
  const communitiesRef = useRef([]);
  communitiesRef.current = communities;
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [communitiesError, setCommunitiesError] = useState("");
  const [communityFormOpen, setCommunityFormOpen] = useState(false);
  const [communityEditingId, setCommunityEditingId] = useState(null);
  const [communityForm, setCommunityForm] = useState({
    name: "",
    city: "",
    province: "",
    postalCode: "",
  });
  const [communityImageFile, setCommunityImageFile] = useState(null);
  const communityImageInputRef = useRef(null);
  const [communitySaving, setCommunitySaving] = useState(false);
  const [communityProvinceSuggestOpen, setCommunityProvinceSuggestOpen] = useState(false);
  const communityProvinceSuggestBlurTimerRef = useRef(null);
  const [communityCitySuggestOpen, setCommunityCitySuggestOpen] = useState(false);
  const communityCitySuggestBlurTimerRef = useRef(null);
  /** Profile edit: Brgy field combobox dropdown for existing community names. */
  const [profileBrgySuggestOpen, setProfileBrgySuggestOpen] = useState(false);
  /** Community marketplace scope (same shell as global browse — not stored in the URL). */
  const [shopCommunityId, setShopCommunityId] = useState(null);
  const activeCommunity = useMemo(
    () => (shopCommunityId ? communities.find((x) => x.id === shopCommunityId) ?? null : null),
    [communities, shopCommunityId],
  );
  /** City · province · postal for the open community shop header (structured fields from API). */
  const activeCommunityLocaleLine = useMemo(() => {
    const ac = activeCommunity;
    if (!ac) return "";
    const cCity = String(ac.city || "").trim();
    const cProv = String(ac.province || "").trim();
    const cZip = String(ac.postalCode || "").trim();
    return [toTitleCase(cCity), toTitleCase(cProv), cZip].filter(Boolean).join(" · ");
  }, [activeCommunity]);
  /** Dedicated profile community label (separate from address barangay). */
  const profileCommunityName = useMemo(() => String(user?.community || "").trim(), [user?.community]);
  /** Barangay, city, province, postal code segments from profile `address`. */
  const profileCityProvincePostal = useMemo(() => {
    const p = splitAddressParts(user?.address);
    return {
      barangay: String(p.addressBarangay || "").trim(),
      city: String(p.addressCity || "").trim(),
      province: String(p.addressProvince || "").trim(),
      postalCode: String(p.addressPostalCode || "").trim(),
    };
  }, [user?.address]);
  const canUploadProductFromProfile = useMemo(() => {
    const parsedAddress = splitAddressParts(user?.address);
    const checks = [
      [String(user?.username || "").trim().length >= 3, "Username"],
      [toPhilippinesLocalPhone10(user?.phone).length === 10, "Phone number"],
      [String(user?.firstName || "").trim().length >= 2, "First name"],
      [String(user?.middleName || "").trim().length >= 2, "Middle name"],
      [String(user?.lastName || "").trim().length >= 2, "Last name"],
      [String(user?.gender || "").trim().length > 0, "Gender"],
      [String(user?.birthday || "").trim().length > 0, "Birthday"],
      [String(parsedAddress.addressHouseStreet || "").trim().length > 0, "House Number & Street"],
      [String(parsedAddress.addressSubdivision || "").trim().length > 0, "Subdivision"],
      [String(parsedAddress.addressBarangay || "").trim().length > 0, "Barangay"],
      [String(parsedAddress.addressCity || "").trim().length > 0, "City or Municipality"],
      [String(parsedAddress.addressProvince || "").trim().length > 0, "Province"],
    ];
    const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
    return { ready: missing.length === 0, missing };
  }, [user]);
  /** Community row whose name matches profile community and city/province when set. */
  const listingCommunityFromProfile = useMemo(() => {
    const label = String(profileCommunityName || "").trim();
    if (!label) return { id: null, matchedName: "" };
    const pc = profileCityProvincePostal;
    const hasLoc = Boolean(pc.city && pc.province);

    const pickFromPool = (pool) => {
      const exact = pool.find((c) => String(c.name || "").trim() === label);
      if (exact) return { id: exact.id, matchedName: String(exact.name || "").trim() };
      const sl = stripBrgyPrefixLabel(label).toLowerCase();
      const byStrip = pool.find((c) => stripBrgyPrefixLabel(String(c.name || "").trim()).toLowerCase() === sl);
      if (byStrip) return { id: byStrip.id, matchedName: String(byStrip.name || "").trim() };
      const lower = label.toLowerCase();
      const ci = pool.find((c) => String(c.name || "").trim().toLowerCase() === lower);
      if (ci) return { id: ci.id, matchedName: String(ci.name || "").trim() };
      const fuzzy = pool.find((c) => isLikelySameCommunityName(label, String(c.name || "").trim()));
      if (fuzzy) return { id: fuzzy.id, matchedName: String(fuzzy.name || "").trim() };
      return { id: null, matchedName: "" };
    };

    if (!hasLoc) {
      return pickFromPool(communities);
    }

    const strictPool = communities.filter((c) =>
      isSameCommunityLocale(
        { city: pc.city, province: pc.province, postalCode: pc.postalCode },
        { city: c.city, province: c.province, postalCode: c.postalCode },
      ),
    );
    const strict = pickFromPool(strictPool);
    if (strict.id) return strict;

    const cityPool = communities.filter((c) =>
      isSameCityAndProvince(pc.city, pc.province, c.city, c.province),
    );
    const byCity = pickFromPool(cityPool);
    if (byCity.id) return byCity;

    return pickFromPool(communities);
  }, [communities, profileCityProvincePostal, profileCommunityName]);
  /** Compact header “In [community] / All areas” — only on marketplace browse screens, not Orders/Cart/Profile. */
  const showCommunityShopHeaderStrip = useMemo(
    () =>
      Boolean(shopCommunityId) &&
      isBrowseLikeView &&
      activeView !== VIEWS.COMMUNITY_SHOP &&
      activeView !== VIEWS.FAVORITES,
    [shopCommunityId, isBrowseLikeView, activeView],
  );
  const isMemberOfOpenCommunity = useMemo(() => {
    if (!shopCommunityId) return false;
    return String(listingCommunityFromProfile.id || "") === String(shopCommunityId);
  }, [listingCommunityFromProfile.id, shopCommunityId]);
  const getDisplayedMemberCount = useCallback(
    (communityId, baseCount) => {
      const base = Number.isFinite(Number(baseCount)) ? Number(baseCount) : 0;
      const isJoinedHere = String(listingCommunityFromProfile.id || "") === String(communityId || "");
      return base + (isJoinedHere ? 1 : 0);
    },
    [listingCommunityFromProfile.id],
  );
  const prevShopCommunityIdRef = useRef(null);
  /** Avoid clearing listings + duplicate fetch when only `communities` hydration updates `activeCommunity`. */
  const communityShopListingsQueryKeyRef = useRef(null);
  /** Clear orders when `ordersRole` changes; keep rows when re-entering Orders with the same role. */
  const ordersDataQueryKeyRef = useRef(null);
  const communityListingsSyncedRef = useRef(null);
  const skipAutoCommunityBrowseRef = useRef(false);
  const [expandedBidOrderId, setExpandedBidOrderId] = useState(null);
  const [bidsForOrder, setBidsForOrder] = useState([]);
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
  const [quickAddListing, setQuickAddListing] = useState(null);
  const [quickAddQuantity, setQuickAddQuantity] = useState("1");
  const [quickAddComment, setQuickAddComment] = useState("");
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  /** `listingId` → selected (cart screen only). */
  const [cartItemSelection, setCartItemSelection] = useState({});
  /** Cart row whose quantity PATCH is in flight (logged-in only). */
  const [cartQtySavingId, setCartQtySavingId] = useState(null);
  /** Inline qty field: `listingId` being edited and its draft string (commit on blur). */
  const [cartQtyEdit, setCartQtyEdit] = useState({ id: null, str: "" });
  const [cartCheckoutSubmitting, setCartCheckoutSubmitting] = useState(false);
  /** Per-line debounce timers so typed qty applies without requiring blur. */
  const cartQtyCommitTimersRef = useRef({});
  const mergeCartItemsPreservingOrder = useCallback((prevItems, nextItems) => {
    if (!Array.isArray(nextItems)) return [];
    const nextById = new Map(nextItems.map((item) => [String(item?.listingId), item]));
    const merged = [];
    for (const prevItem of Array.isArray(prevItems) ? prevItems : []) {
      const key = String(prevItem?.listingId);
      if (!nextById.has(key)) continue;
      merged.push(nextById.get(key));
      nextById.delete(key);
    }
    for (const remaining of nextById.values()) merged.push(remaining);
    return merged;
  }, []);
  const moveSellerGroupToTop = useCallback((items, sellerId) => {
    const targetSellerId = String(sellerId || "");
    if (!targetSellerId) return Array.isArray(items) ? items : [];
    const sameSeller = [];
    const others = [];
    for (const item of Array.isArray(items) ? items : []) {
      if (String(item?.sellerId || "") === targetSellerId) sameSeller.push(item);
      else others.push(item);
    }
    if (sameSeller.length === 0) return Array.isArray(items) ? items : [];
    return [...sameSeller, ...others];
  }, []);
  const [sellerTab, setSellerTab] = useState(SELLER_TABS.PRODUCTS);
  const [sellerProductsView, setSellerProductsView] = useState("list");
  const [communityProductsView, setCommunityProductsView] = useState("grid");
  /** Inline notice by “Upload product” on Profile (not the global marketplace banner). */
  const [profileUploadProductNotice, setProfileUploadProductNotice] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);

  const applyJoinedCommunity = useCallback((communityName) => {
    const normalized = String(communityName || "").trim();
    setUser((prev) => {
      if (!prev) return prev;
      if (prev.community === normalized) return prev;
      return { ...prev, community: normalized };
    });
    setProfileDraft((prev) => ({ ...prev, community: normalized }));
    if (typeof window !== "undefined" && user?.id) {
      const key = `${COMMUNITY_MEMBERSHIP_KEY_PREFIX}${user.id}`;
      if (normalized) localStorage.setItem(key, normalized);
      else localStorage.removeItem(key);
    }
  }, [user?.id]);

  const joinCommunityAndAttachListings = useCallback(
    async (community) => {
      const joinedName = toTitleCase(String(community?.name || "").trim());
      applyJoinedCommunity(joinedName);
      if (!token || !community?.id) return;
      try {
        await apiRequest("/auth/me", {
          method: "PATCH",
          token,
          body: { community: joinedName },
        });
        const listData = await apiRequest("/me/listings", { token });
        const mine = Array.isArray(listData?.listings) ? listData.listings : [];
        const targetCommunityId = String(community.id);
        const toAttach = mine.filter((l) => String(l.communityId || "") !== targetCommunityId);
        if (toAttach.length) {
          await Promise.all(
            toAttach.map((listing) =>
              apiRequest(`/me/listings/${listing.id}`, {
                method: "PATCH",
                token,
                body: { communityId: targetCommunityId },
              }),
            ),
          );
        }
        const refreshed = await apiRequest("/me/listings", { token });
        setSellerListings(refreshed.listings || []);
        if (activeView === VIEWS.COMMUNITY_SHOP && String(shopCommunityId || "") === targetCommunityId) {
          const scoped = await apiRequest(`/listings?communityId=${encodeURIComponent(targetCommunityId)}`, { token });
          setListings(scoped.listings || []);
        }
      } catch (error) {
        setMarketplaceMessage(error?.message || "Joined, but we could not attach your listings yet. Try Join again.");
      }
    },
    [activeView, applyJoinedCommunity, shopCommunityId, token],
  );

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;
    const key = `${COMMUNITY_MEMBERSHIP_KEY_PREFIX}${user.id}`;
    const savedCommunity = String(localStorage.getItem(key) || "").trim();
    if (savedCommunity && savedCommunity !== String(user.community || "").trim()) {
      setUser((prev) => (prev && prev.id === user.id ? { ...prev, community: savedCommunity } : prev));
    }
  }, [user?.community, user?.id]);

  // Backfill persisted profile community from local membership cache.
  useEffect(() => {
    if (!token || !user?.id || typeof window === "undefined") return;
    const key = `${COMMUNITY_MEMBERSHIP_KEY_PREFIX}${user.id}`;
    const savedCommunity = String(localStorage.getItem(key) || "").trim();
    const currentCommunity = String(user?.community || "").trim();
    if (!savedCommunity || savedCommunity === currentCommunity) return;
    let cancelled = false;
    (async () => {
      try {
        await apiRequest("/auth/me", {
          method: "PATCH",
          token,
          body: { community: savedCommunity },
        });
        if (!cancelled) {
          setUser((prev) => (prev && prev.id === user.id ? { ...prev, community: savedCommunity } : prev));
        }
      } catch {
        // Non-blocking sync; keep local value even if server sync fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user?.id, user?.community]);

  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timedMode, setTimedMode] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState(null);

  const [attempts, setAttempts] = useState([]);
  const [dashboard, setDashboard] = useState({ totalAttempts: 0, averageScore: 0, bestScore: 0, recentAttempts: [] });
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState("");
  const [browseDeleteId, setBrowseDeleteId] = useState(null);
  const [mobileCommunityFiltersOpen, setMobileCommunityFiltersOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyClearLoading, setHistoryClearLoading] = useState(false);
  const [historyRefreshTick, setHistoryRefreshTick] = useState(0);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [quizLoading, setQuizLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [quizzesRefreshTick, setQuizzesRefreshTick] = useState(0);

  const [createState, setCreateState] = useState({
    title: "",
    category: "",
    description: "",
    generatorProvider: "manual",
    generatorQuestionCount: 5,
    questions: [buildEmptyQuestion()],
  });
  const [createMessage, setCreateMessage] = useState("");
  const [publishFlash, setPublishFlash] = useState("");
  const [publishFlashExiting, setPublishFlashExiting] = useState(false);
  const publishFlashTimersRef = useRef({ fade: null, remove: null });
  const [createGeneratorLoading, setCreateGeneratorLoading] = useState(false);
  const [editState, setEditState] = useState({ quizId: "", title: "", category: "", description: "", questions: [] });
  const [editRemovedQuestionIds, setEditRemovedQuestionIds] = useState([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [quizMessage, setQuizMessage] = useState("");
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (!mobileCommunityFiltersOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileCommunityFiltersOpen]);

  const [profileEditing, setProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    avatarUrl: "",
    username: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    birthday: "",
    age: "",
    community: "",
    addressHouseStreet: "",
    addressSubdivision: "",
    addressBarangay: "",
    addressCity: "",
    addressProvince: "",
    addressCountry: "",
    addressPostalCode: "",
    addressUrl: "",
    facebookUrl: "",
    twitterUrl: "",
    instagramUrl: "",
    gender: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileFieldErrors, setProfileFieldErrors] = useState({});
  const [profileSocialExpanded, setProfileSocialExpanded] = useState(false);
  const [phCityMunicipalityOptions, setPhCityMunicipalityOptions] = useState([]);
  const [phCityPostalOptions, setPhCityPostalOptions] = useState([]);
  const [phBarangayOptions, setPhBarangayOptions] = useState([]);
  /** Existing `communities.name` values matching the typed Brgy segment (profile edit): substring + fuzzy typos; scoped by city/province when both are set in the draft. */
  const profileBrgyCommunitySuggestions = useMemo(() => {
    const q = String(profileDraft.community || "").trim();
    if (q.length < 1 || !communities.length) return [];
    const draftCity = String(profileDraft.addressCity || "").trim();
    const draftProv = String(profileDraft.addressProvince || "").trim();
    const draftPostal = String(profileDraft.addressPostalCode || "").trim();
    const restrictLoc = Boolean(draftCity && draftProv);
    const ql = q.toLowerCase().replace(/\s+/g, " ");
    const seen = new Set();
    const rows = [];
    for (const c of communities) {
      if (
        restrictLoc &&
        !isSameCommunityLocale(
          { city: draftCity, province: draftProv, postalCode: draftPostal },
          { city: c.city, province: c.province, postalCode: c.postalCode },
        )
      )
        continue;
      const name = String(c.name || "").trim();
      if (!name) continue;
      const nl = name.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(nl)) continue;
      const substring = nl.includes(ql);
      const fuzzy = q.length >= 5 && isLikelySameCommunityName(q, name);
      if (!substring && !fuzzy) continue;
      seen.add(nl);
      rows.push({
        name,
        city: String(c.city || "").trim(),
        province: String(c.province || "").trim(),
        postalCode: String(c.postalCode || "").trim(),
        startsWith: nl.startsWith(ql),
        fuzzy: !substring && fuzzy,
        dist: substring ? 0 : levenshteinDistance(ql, nl),
      });
    }
    rows.sort((a, b) => {
      if (a.fuzzy !== b.fuzzy) return a.fuzzy ? 1 : -1;
      if (a.startsWith !== b.startsWith) return a.startsWith ? -1 : 1;
      if (a.dist !== b.dist) return a.dist - b.dist;
      return a.name.localeCompare(b.name);
    });
    return rows.slice(0, 10).map(({ name, city, province, postalCode, startsWith }) => ({
      name,
      city,
      province,
      postalCode,
      startsWith,
    }));
  }, [
    communities,
    profileDraft.community,
    profileDraft.addressCity,
    profileDraft.addressProvince,
    profileDraft.addressPostalCode,
  ]);
  const profileProvinceOptions = useMemo(() => PH_PROVINCE_OPTIONS, []);
  const profileProvinceFilteredOptions = useMemo(() => {
    const q = String(profileDraft.addressProvince || "").trim().toLowerCase();
    if (!q) return profileProvinceOptions;
    return profileProvinceOptions.filter((name) => name.toLowerCase().startsWith(q));
  }, [profileDraft.addressProvince, profileProvinceOptions]);
  const profileCityOptions = useMemo(() => {
    const selectedProvince = String(profileDraft.addressProvince || "").trim().toLowerCase();
    if (phCityMunicipalityOptions.length > 0) {
      if (!selectedProvince) return phCityMunicipalityOptions.map((row) => row.name);
      return Array.from(
        new Set(
          phCityMunicipalityOptions
        .filter((row) => String(row.provinceName || "").trim().toLowerCase() === selectedProvince)
            .map((row) => formatPhCityMunicipalityName(row.name)),
        ),
      ).sort((a, b) => a.localeCompare(b));
    }
    if (!selectedProvince) return [];
    const pool = communities.filter((c) => String(c.province || "").trim().toLowerCase() === selectedProvince);
    return Array.from(
      new Set(
        pool
          .map((c) => String(c.city || "").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [communities, phCityMunicipalityOptions, profileDraft.addressProvince]);
  const profileCityFilteredOptions = useMemo(() => {
    const q = String(profileDraft.addressCity || "").trim().toLowerCase();
    if (!q) return profileCityOptions;
    return profileCityOptions.filter((name) => name.toLowerCase().startsWith(q));
  }, [profileDraft.addressCity, profileCityOptions]);
  const communityProvinceFilteredOptions = useMemo(() => {
    const q = String(communityForm.province || "").trim().toLowerCase();
    if (!q) return profileProvinceOptions;
    return profileProvinceOptions.filter((name) => name.toLowerCase().startsWith(q));
  }, [communityForm.province, profileProvinceOptions]);
  const communityCityOptions = useMemo(() => {
    const selectedProvince = String(communityForm.province || "").trim().toLowerCase();
    if (phCityMunicipalityOptions.length > 0) {
      if (!selectedProvince) return phCityMunicipalityOptions.map((row) => formatPhCityMunicipalityName(row.name));
      return Array.from(
        new Set(
          phCityMunicipalityOptions
            .filter((row) => String(row.provinceName || "").trim().toLowerCase() === selectedProvince)
            .map((row) => formatPhCityMunicipalityName(row.name)),
        ),
      ).sort((a, b) => a.localeCompare(b));
    }
    if (!selectedProvince) return [];
    const pool = communities.filter((c) => String(c.province || "").trim().toLowerCase() === selectedProvince);
    return Array.from(new Set(pool.map((c) => String(c.city || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [communityForm.province, phCityMunicipalityOptions, communities]);
  const communityCityFilteredOptions = useMemo(() => {
    const q = String(communityForm.city || "").trim().toLowerCase();
    if (!q) return communityCityOptions;
    return communityCityOptions.filter((name) => name.toLowerCase().startsWith(q));
  }, [communityForm.city, communityCityOptions]);
  const communityAutoPostalCode = useMemo(() => {
    const province = String(communityForm.province || "").trim().toLowerCase();
    const city = String(communityForm.city || "").trim().toLowerCase();
    const provinceNormalized = normalizePhLocalityName(communityForm.province);
    const cityNormalized = normalizePhLocalityName(communityForm.city);
    if (!province || !city) return "";
    const cityMasterMatch = phCityMunicipalityOptions.find(
      (row) =>
        (String(row.provinceName || "").trim().toLowerCase() === province ||
          normalizePhLocalityName(row.provinceName) === provinceNormalized) &&
        (String(row.name || "").trim().toLowerCase() === city ||
          String(formatPhCityMunicipalityName(row.name) || "").trim().toLowerCase() === city ||
          normalizePhLocalityName(row.name) === cityNormalized ||
          normalizePhLocalityName(formatPhCityMunicipalityName(row.name)) === cityNormalized),
    );
    return normalizePhPostalCode(cityMasterMatch?.postalCode);
  }, [communityForm.city, communityForm.province, phCityMunicipalityOptions]);
  const profileBarangayOptions = useMemo(() => {
    const selectedProvince = String(profileDraft.addressProvince || "").trim().toLowerCase();
    const selectedCity = String(profileDraft.addressCity || "").trim().toLowerCase();
    const selectedCityNormalized = normalizePhLocalityName(profileDraft.addressCity);
    if (phBarangayOptions.length > 0) {
      if (!selectedCity) return [];
      return phBarangayOptions
        .filter((row) => {
          const provinceOk = selectedProvince ? String(row.provinceName || "").trim().toLowerCase() === selectedProvince : true;
          const rowCityLower = String(row.cityName || "").trim().toLowerCase();
          const rowCityNormalized = normalizePhLocalityName(row.cityName);
          const cityOk = rowCityLower === selectedCity || rowCityNormalized === selectedCityNormalized;
          return provinceOk && cityOk;
        })
        .map((row) => row.name);
    }
    const pool = communities.filter((c) => {
      const provinceOk = selectedProvince ? String(c.province || "").trim().toLowerCase() === selectedProvince : true;
      const cityOk = selectedCity ? String(c.city || "").trim().toLowerCase() === selectedCity : true;
      return provinceOk && cityOk;
    });
    return Array.from(
      new Set(
        pool
          .map((c) => String(c.name || "").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [communities, phBarangayOptions, profileDraft.addressProvince, profileDraft.addressCity]);
  const profileBarangayFilteredOptions = useMemo(() => {
    const q = String(profileDraft.addressBarangay || "").trim().toLowerCase();
    if (!q) return profileBarangayOptions;
    return profileBarangayOptions.filter((name) => name.toLowerCase().startsWith(q));
  }, [profileDraft.addressBarangay, profileBarangayOptions]);
  const profileAutoPostalCode = useMemo(() => {
    const province = String(profileDraft.addressProvince || "").trim().toLowerCase();
    const city = String(profileDraft.addressCity || "").trim().toLowerCase();
    const provinceNormalized = normalizePhLocalityName(profileDraft.addressProvince);
    const cityNormalized = normalizePhLocalityName(profileDraft.addressCity);
    if (!province || !city) return "";
    const cityMasterMatch = phCityMunicipalityOptions.find(
      (row) =>
        (String(row.provinceName || "").trim().toLowerCase() === province ||
          normalizePhLocalityName(row.provinceName) === provinceNormalized) &&
        (String(row.name || "").trim().toLowerCase() === city ||
          String(formatPhCityMunicipalityName(row.name) || "")
            .trim()
            .toLowerCase() === city ||
          normalizePhLocalityName(row.name) === cityNormalized ||
          normalizePhLocalityName(formatPhCityMunicipalityName(row.name)) === cityNormalized),
    );
    const fromCityMaster = normalizePhPostalCode(cityMasterMatch?.postalCode);
    if (fromCityMaster) return fromCityMaster;
    const cityMasterFallback = phCityMunicipalityOptions.find((row) => {
      const sameProvince =
        String(row.provinceName || "").trim().toLowerCase() === province ||
        normalizePhLocalityName(row.provinceName) === provinceNormalized;
      if (!sameProvince) return false;
      const rowCityRaw = normalizePhLocalityName(row.name);
      const rowCityFormatted = normalizePhLocalityName(formatPhCityMunicipalityName(row.name));
      return rowCityRaw === cityNormalized || rowCityFormatted === cityNormalized;
    });
    const fallbackPostal = normalizePhPostalCode(cityMasterFallback?.postalCode);
    if (fallbackPostal) return fallbackPostal;
    return "";
  }, [
    phCityMunicipalityOptions,
    profileDraft.addressProvince,
    profileDraft.addressCity,
  ]);
  const profileAvatarInputRef = useRef(null);
  /** Delay closing Brgy suggestions so mousedown on an option runs before blur. */
  const profileBrgySuggestBlurTimerRef = useRef(null);
  const [profileProvinceSuggestOpen, setProfileProvinceSuggestOpen] = useState(false);
  const profileProvinceSuggestBlurTimerRef = useRef(null);
  const [profileCitySuggestOpen, setProfileCitySuggestOpen] = useState(false);
  const profileCitySuggestBlurTimerRef = useRef(null);
  const [profileBarangaySuggestOpen, setProfileBarangaySuggestOpen] = useState(false);
  const profileBarangaySuggestBlurTimerRef = useRef(null);
  const profileBirthdayInputRef = useRef(null);
  const todayIsoDate = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const googleBtnRef = useRef(null);

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("quiz_theme_v2", theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    const loadPhCitiesMunicipalities = async () => {
      try {
        const [cityRes, provinceRes] = await Promise.all([
          fetch("https://psgc.gitlab.io/api/cities-municipalities/"),
          fetch("https://psgc.gitlab.io/api/provinces/"),
        ]);
        if (!cityRes.ok || !provinceRes.ok) return;
        const cityRows = await cityRes.json();
        const provinceRows = await provinceRes.json();
        if (!Array.isArray(cityRows) || !Array.isArray(provinceRows) || cancelled) return;
        const [cloudCitiesRes, cloudMunicipalitiesRes] = await Promise.all([
          fetch("https://psgc.cloud/api/cities"),
          fetch("https://psgc.cloud/api/municipalities"),
        ]);
        const cloudCities = cloudCitiesRes.ok ? await cloudCitiesRes.json() : [];
        const cloudMunicipalities = cloudMunicipalitiesRes.ok ? await cloudMunicipalitiesRes.json() : [];
        const cloudRows = Array.isArray(cloudCities) && Array.isArray(cloudMunicipalities) ? [...cloudCities, ...cloudMunicipalities] : [];
        const cityCodeToPostal = new Map(
          cloudRows.map((row) => [
            normalizePhPsgcCode(row?.code || row?.city_code || row?.municipality_code || ""),
            String(row?.zip_code || row?.postal_code || "").trim(),
          ]),
        );
        const cityPostalRows = cloudRows
          .map((row) => ({
            name: String(row?.name || "").trim(),
            postalCode: String(row?.zip_code || "").trim(),
          }))
          .filter((row) => row.name && row.postalCode);
        const dedupedCityPostal = Array.from(
          new Map(cityPostalRows.map((row) => [`${normalizePhLocalityName(row.name)}`, row])).values(),
        );
        if (!cancelled) setPhCityPostalOptions(dedupedCityPostal);
        const provinceCodeToName = new Map(
          provinceRows.map((row) => [String(row?.code || row?.province_code || ""), String(row?.name || "").trim()]),
        );
        const mapped = cityRows
          .map((row) => ({
            code: String(row?.code || row?.city_code || row?.municipality_code || ""),
            name: String(row?.name || "").trim(),
            provinceName:
              provinceCodeToName.get(String(row?.provinceCode || row?.province_code || "")) ||
              String(row?.provinceName || row?.province_name || "").trim(),
            postalCode:
              cityCodeToPostal.get(
                normalizePhPsgcCode(
                  row?.psgc10DigitCode || row?.psgc10digitCode || row?.code || row?.city_code || row?.municipality_code || "",
                ),
              ) || "",
          }))
          .filter((row) => row.name);
        const deduped = Array.from(new Map(mapped.map((row) => [`${row.provinceName}::${row.name}`, row])).values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        if (!cancelled) setPhCityMunicipalityOptions(deduped);

        const barangayRes = await fetch("https://psgc.gitlab.io/api/barangays/");
        if (!barangayRes.ok) return;
        const barangayRows = await barangayRes.json();
        if (!Array.isArray(barangayRows) || cancelled) return;
        const cityCodeToRow = new Map(mapped.map((row) => [row.code, row]));
        const mappedBarangays = barangayRows
          .map((row) => {
            const cityCode = String(row?.cityCode || row?.city_code || row?.municipalityCode || row?.municipality_code || "");
            const cityInfo = cityCodeToRow.get(cityCode);
            return {
              name: String(row?.name || "").trim(),
              cityName: cityInfo?.name || "",
              provinceName: cityInfo?.provinceName || "",
            };
          })
          .filter((row) => row.name && row.cityName);
        const dedupedBarangays = Array.from(
          new Map(mappedBarangays.map((row) => [`${row.provinceName}::${row.cityName}::${row.name}`, row])).values(),
        ).sort((a, b) => a.name.localeCompare(b.name));
        if (!cancelled) setPhBarangayOptions(dedupedBarangays);
      } catch {
        // Keep community-derived fallback options when master-list fetch fails.
      }
    };
    loadPhCitiesMunicipalities();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!profileEditing) return;
    const hasLocation = Boolean(String(profileDraft.addressProvince || "").trim() && String(profileDraft.addressCity || "").trim());
    if (profileAutoPostalCode) {
      setProfileDraft((prev) => (prev.addressPostalCode === profileAutoPostalCode ? prev : { ...prev, addressPostalCode: profileAutoPostalCode }));
      return;
    }
    if (!hasLocation) {
      setProfileDraft((prev) => (prev.addressPostalCode ? { ...prev, addressPostalCode: "" } : prev));
    }
  }, [profileAutoPostalCode, profileEditing, profileDraft.addressProvince, profileDraft.addressCity]);
  useEffect(() => {
    if (!communityFormOpen) return;
    const hasLocation = Boolean(String(communityForm.province || "").trim() && String(communityForm.city || "").trim());
    if (communityAutoPostalCode) {
      setCommunityForm((prev) => (prev.postalCode === communityAutoPostalCode ? prev : { ...prev, postalCode: communityAutoPostalCode }));
      return;
    }
    if (!hasLocation) {
      setCommunityForm((prev) => (prev.postalCode ? { ...prev, postalCode: "" } : prev));
    }
  }, [communityAutoPostalCode, communityForm.city, communityForm.province, communityFormOpen]);

  useEffect(() => {
    if (!publishFlash) return undefined;
    setPublishFlashExiting(false);
    const fadeAt = Math.max(0, PUBLISH_TOAST_DURATION_MS - PUBLISH_TOAST_FADE_MS);
    publishFlashTimersRef.current.fade = window.setTimeout(() => setPublishFlashExiting(true), fadeAt);
    publishFlashTimersRef.current.remove = window.setTimeout(() => {
      setPublishFlash("");
      setPublishFlashExiting(false);
    }, PUBLISH_TOAST_DURATION_MS);
    return () => {
      window.clearTimeout(publishFlashTimersRef.current.fade);
      window.clearTimeout(publishFlashTimersRef.current.remove);
    };
  }, [publishFlash]);

  const dismissPublishFlash = useCallback(() => {
    window.clearTimeout(publishFlashTimersRef.current.fade);
    window.clearTimeout(publishFlashTimersRef.current.remove);
    setPublishFlashExiting(true);
    publishFlashTimersRef.current.remove = window.setTimeout(() => {
      setPublishFlash("");
      setPublishFlashExiting(false);
    }, PUBLISH_TOAST_FADE_MS);
  }, []);

  useEffect(() => {
    const ensureIconLink = (selector, rel) => {
      let link = document.querySelector(selector);
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", rel);
        document.head.appendChild(link);
      }
      link.setAttribute("href", tabLogo);
      link.setAttribute("type", "image/png");
    };
    ensureIconLink('link[rel="icon"]', "icon");
    ensureIconLink('link[rel="apple-touch-icon"]', "apple-touch-icon");
  }, []);

  const submitQuiz = useCallback(async () => {
    if (!activeQuiz) return;
    setSubmitError("");
    setSubmitLoading(true);
    const submissionAnswers = activeQuiz.questions.reduce((acc, question, index) => {
      const questionId = getQuestionId(question);
      if (!questionId) return acc;
      const key = getQuestionKey(question, index);
      if (question.kind === "fill") {
        const typed = answers[key];
        if (typeof typed === "string" && typed.trim()) acc[questionId] = typed.trim();
        return acc;
      }
      const selectedOptionIndex = answers[key];
      if (typeof selectedOptionIndex === "number" && question.options[selectedOptionIndex] !== undefined) {
        acc[questionId] = question.options[selectedOptionIndex];
      }
      return acc;
    }, {});
    const activeQuizId = activeQuiz.id || activeQuiz._id;
    if (!activeQuizId) {
      setSubmitLoading(false);
      return;
    }
    try {
      const data = await apiRequest(`/quizzes/${activeQuizId}/submissions`, {
        method: "POST",
        token,
        body: { answers: submissionAnswers },
      });
      setResult(data);
      setActiveQuiz(null);
      setActiveView(VIEWS.BROWSE);
    } catch (error) {
      setSubmitError(error.message || "Unable to submit quiz.");
    } finally {
      setSubmitLoading(false);
    }
  }, [activeQuiz, token, answers]);

  useEffect(() => {
    if (!token || user) return;
    (async () => {
      try {
        const data = await apiRequest("/auth/me", { token });
        setUser((prev) => {
          const incoming = data.user || {};
          const preservedJoined =
            incoming.joinedAt || incoming.createdAt || incoming.created_at || prev?.joinedAt || prev?.createdAt || prev?.created_at || "";
          return { ...(prev || {}), ...incoming, joinedAt: preservedJoined };
        });
        const joined = data?.user?.joinedAt || data?.user?.createdAt || data?.user?.created_at || "";
        if (joined) setProfileJoinedAt(joined);
        setProfileJoinedAtResolved(true);
      } catch (error) {
        if (isUnauthorizedApiError(error)) {
          localStorage.removeItem("quiz_token");
          setToken("");
        }
        setProfileJoinedAtResolved(true);
      }
    })();
  }, [token, user]);

  useEffect(() => {
    if (!user) return;
    // Browse is intentionally disabled for now.
    setQuizzes([]);
    setCategories([]);
    setBrowseLoading(false);
    setBrowseError("");
    return;
    setBrowseLoading(true);
    setBrowseError("");
    const query = selectedCategory ? `?category=${encodeURIComponent(selectedCategory)}` : "";
    (async () => {
      try {
        const data = await apiRequest(`/quizzes${query}`);
        const playableQuizzes = data.filter((quiz) => (quiz.questionCount || 0) > 0);
        setQuizzes(playableQuizzes);
        setCategories([...new Set(playableQuizzes.map((q) => q.category))]);
      } catch (error) {
        setBrowseError(error.message || "Unable to load quizzes.");
      } finally {
        setBrowseLoading(false);
      }
    })();
  }, [user, selectedCategory, result, quizzesRefreshTick]);

  useEffect(() => {
    if (!user || !token) return;
    // History/dashboard data fetch is intentionally disabled for now.
    setAttempts([]);
    setDashboard({ totalAttempts: 0, averageScore: 0, bestScore: 0, recentAttempts: [] });
    setHistoryLoading(false);
    setDashboardLoading(false);
    setHistoryError("");
    setDashboardError("");
    return;
    setHistoryLoading(true);
    setDashboardLoading(true);
    setHistoryError("");
    setDashboardError("");
    (async () => {
      try {
        const [historyData, dashboardData] = await Promise.all([
          apiRequest("/users/me/history", { token }),
          apiRequest("/users/me/dashboard", { token }),
        ]);
        setAttempts(historyData);
        setDashboard(dashboardData);
      } catch (error) {
        const message = error.message || "Unable to load your data.";
        setHistoryError(message);
        setDashboardError(message);
      } finally {
        setHistoryLoading(false);
        setDashboardLoading(false);
      }
    })();
  }, [user, token, result, historyRefreshTick]);

  useEffect(() => {
    if (!activeQuiz || !timedMode || secondsLeft <= 0) return;
    const timer = setTimeout(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          submitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [activeQuiz, timedMode, secondsLeft, submitQuiz]);

  useEffect(() => {
    if (user || !GOOGLE_CLIENT_ID || !authPanelVisible || !googleBtnRef.current) return;
    const initGoogle = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            const data = await apiRequest("/auth/google", {
              method: "POST",
              body: { credential: response.credential },
            });
            setUser(data.user);
            setToken(data.token);
            localStorage.setItem("quiz_token", data.token);
            setMessage("");
            setActiveView(VIEWS.BROWSE);
            setAuthPanelVisible(false);
          } catch (error) {
            setMessage(error.message || "Google login failed.");
          }
        },
      });
      googleBtnRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleBtnRef.current, { theme: "outline", size: "large", shape: "pill", text: authMode === "signup" ? "signup_with" : "signin_with", width: 320 });
    };
    if (window.google?.accounts?.id) return initGoogle();
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.body.appendChild(script);
  }, [authMode, user, authPanelVisible]);

  const progress = useMemo(() => {
    if (!activeQuiz) return 0;
    return Math.round((Object.keys(answers).length / activeQuiz.questions.length) * 100);
  }, [activeQuiz, answers]);

  const streakDays = useMemo(() => getStreakDays(attempts), [attempts]);
  const currentQuestion = activeQuiz?.questions[currentQuestionIndex];

  const openAuthPanel = useCallback((mode) => {
    setAuthMode(mode);
    setMessage("");
    setAuthPanelVisible(true);
  }, []);

  const closeAuthPanel = useCallback(() => {
    setAuthPanelVisible(false);
    setMessage("");
    setShowAuthPassword(false);
    setShowConfirmPassword(false);
  }, []);

  useEffect(() => {
    if (!authPanelVisible || user) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeAuthPanel();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [authPanelVisible, user, closeAuthPanel]);

  useEffect(() => {
    if (!token || activeView !== VIEWS.PROFILE) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest("/auth/me", { token });
        if (!cancelled) {
          setUser((prev) => {
            const incoming = data.user || {};
            const preservedJoined =
              incoming.joinedAt || incoming.createdAt || incoming.created_at || prev?.joinedAt || prev?.createdAt || prev?.created_at || "";
            return { ...(prev || {}), ...incoming, joinedAt: preservedJoined };
          });
          const joined = data?.user?.joinedAt || data?.user?.createdAt || data?.user?.created_at || "";
          if (joined) setProfileJoinedAt(joined);
          setProfileJoinedAtResolved(true);
        }
      } catch (error) {
        if (!cancelled && isUnauthorizedApiError(error)) {
          localStorage.removeItem("quiz_token");
          setToken("");
          setUser(null);
        }
        if (!cancelled) setProfileJoinedAtResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeView]);

  useEffect(() => {
    if (activeView !== VIEWS.PROFILE) {
      setProfileEditing(false);
      setProfileError("");
      setProfileUploadProductNotice("");
    }
  }, [activeView]);

  useEffect(() => {
    if (!marketplaceMessage) return undefined;
    const timer = window.setTimeout(() => setMarketplaceMessage(""), 10000);
    return () => window.clearTimeout(timer);
  }, [marketplaceMessage]);

  useEffect(() => {
    if (profileCommunityName.trim()) setProfileUploadProductNotice("");
  }, [profileCommunityName]);

  useEffect(() => {
    if (!token || activeView !== VIEWS.USERS) return undefined;
    const hadUsers = usersListRef.current.length > 0;
    let cancelled = false;
    if (!hadUsers) setUsersLoading(true);
    setUsersError("");
    (async () => {
      try {
        const data = await apiRequest("/users", { token });
        if (!cancelled) setUsersList(data.users || []);
      } catch (error) {
        if (!cancelled) setUsersError(error.message || "Unable to load users.");
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeView]);

  useEffect(
    () => () => {
      if (listingImagePreviewUrl) URL.revokeObjectURL(listingImagePreviewUrl);
    },
    [listingImagePreviewUrl],
  );

  useEffect(() => {
    if (!token || activeView !== VIEWS.PROFILE || !user?.id) return undefined;
    setProfileJoinedAtResolved(false);
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest("/users", { token });
        if (cancelled) return;
        const me = (data.users || []).find((u) => String(u.id) === String(user.id));
        if (me?.joinedAt) setProfileJoinedAt(me.joinedAt);
        setProfileJoinedAtResolved(true);
      } catch {
        if (!cancelled) {
          setProfileJoinedAtResolved(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeView, user?.id]);

  useEffect(() => {
    if (!token || activeView !== VIEWS.PROFILE || profileJoinedAt) return undefined;
    const supabase = createSupabaseClient();
    if (!supabase) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser(token);
        const joined = data?.user?.created_at || "";
        if (!cancelled) {
          if (joined) setProfileJoinedAt(joined);
          setProfileJoinedAtResolved(true);
        }
      } catch {
        // Ignore: this is only a last-resort fallback for joined date.
        if (!cancelled) setProfileJoinedAtResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeView, profileJoinedAt]);

  const handleAuth = async (event) => {
    event.preventDefault();
    setMessage("");
    if (authMode === "signup") {
      if (form.password !== form.confirmPassword) {
        setMessage("Passwords do not match.");
        return;
      }
      if (!form.acceptedTerms) {
        setMessage("You must click the checkbox to accept the Terms of Use and Privacy Policy.");
        return;
      }
    }
    setAuthLoading(true);
    try {
      const endpoint = authMode === "signup" ? "/auth/register" : "/auth/login";
      const body =
        authMode === "signup"
          ? {
              acceptedTerms: form.acceptedTerms,
              email: form.email.trim(),
              password: form.password,
            }
          : { email: form.email.trim(), password: form.password };
      const data = await apiRequest(endpoint, { method: "POST", body });
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem("quiz_token", data.token);
      setActiveView(VIEWS.BROWSE);
      setAuthPanelVisible(false);
      setForm({
        email: "",
        password: "",
        confirmPassword: "",
        username: "",
        country: "",
        age: "",
        acceptedTerms: false,
      });
      setShowAuthPassword(false);
      setShowConfirmPassword(false);
    } catch (error) {
      setMessage(error.message || "Cannot reach server.");
    } finally {
      setAuthLoading(false);
    }
  };

  const startQuiz = async () => {
    if (!selectedQuiz) return;
    setQuizMessage("");
    if ((selectedQuiz.questionCount || 0) < 1) {
      setQuizMessage("This quiz has no questions yet. Add at least one question in Create before starting.");
      return;
    }
    setQuizLoading(true);
    try {
      const data = await apiRequest(`/quizzes/${selectedQuiz.id}`);
      if (!data.questions?.length) {
        setQuizMessage("This quiz has no playable questions yet.");
        return;
      }
      setActiveQuiz(data);
      setAnswers({});
      setCurrentQuestionIndex(0);
      setSecondsLeft(data.questions.length * 30);
      setActiveView(VIEWS.BROWSE);
    } catch (error) {
      setQuizMessage(error.message || "Unable to load quiz.");
    } finally {
      setQuizLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("quiz_token");
    setToken("");
    setUser(null);
    setAuthPanelVisible(false);
    setActiveQuiz(null);
    setResult(null);
    setSelectedQuiz(null);
    setShopCommunityId(null);
  };

  const pickBrowseScope = useCallback(
    (verticalId, subId) => {
      setBrowseVerticalId(verticalId);
      setBrowseSubId(subId);
      setBrowseQuickFilter("all");
      setSelectedListingId(null);
      navigate("/", { replace: true });
      setActiveView((prev) => {
        if (prev === VIEWS.FAVORITES) return VIEWS.FAVORITES;
        return shopCommunityId ? VIEWS.COMMUNITY_SHOP : VIEWS.BROWSE;
      });
    },
    [navigate, shopCommunityId],
  );

  const goOrders = useCallback(() => {
    setOrdersRole("seller");
    setOrdersStatusTab("pending");
    setActiveView(VIEWS.ORDERS);
  }, []);

  const goMyPurchases = useCallback(() => {
    setOrdersRole("buyer");
    setOrdersStatusTab("pending");
    setActiveView(VIEWS.MY_PURCHASES);
  }, []);

  const goCart = useCallback(() => {
    setActiveView(VIEWS.CART);
  }, []);

  const leaveCommunityToGlobalMarketplace = useCallback(() => {
    skipAutoCommunityBrowseRef.current = true;
    setShopCommunityId(null);
    setBrowseVerticalId(null);
    setBrowseSubId(null);
    setBrowseQuickFilter("all");
    setSelectedListingId(null);
    navigate("/", { replace: true });
    setActiveView(VIEWS.BROWSE);
  }, [navigate]);

  const goBrowse = useCallback(() => {
    setBrowseVerticalId(null);
    setBrowseSubId(null);
    setBrowseQuickFilter("all");
    setSelectedListingId(null);
    navigate("/", { replace: true });
    if (listingCommunityFromProfile.id) {
      setShopCommunityId(String(listingCommunityFromProfile.id));
      setActiveView(VIEWS.COMMUNITY_SHOP);
      return;
    }
    setShopCommunityId(null);
    setActiveView(VIEWS.BROWSE);
  }, [navigate, listingCommunityFromProfile.id]);

  const visibleBrowseListings = useMemo(() => {
    if (browseQuickFilter === "all") return listings;
    if (browseQuickFilter === "new") {
      return listings.filter((l) => {
        if (l?.createdAt) {
          const ageMs = Date.now() - new Date(l.createdAt).getTime();
          return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= 1000 * 60 * 60 * 24 * 14;
        }
        const text = `${l?.title || ""} ${l?.description || ""}`.toLowerCase();
        return /\bnew\b|brand new|sealed|unused/.test(text);
      });
    }
    if (browseQuickFilter === "sale") {
      return listings.filter((l) => {
        const text = `${l?.title || ""} ${l?.description || ""}`.toLowerCase();
        return /\bsale\b|discount|promo|markdown|clearance/.test(text);
      });
    }
    return listings;
  }, [browseQuickFilter, listings]);

  const strictFavoritesList = useMemo(() => {
    const favoriteIdStrings = new Set(Array.from(favoriteIds).map((id) => String(id)));
    return favoritesList.filter((listing) => favoriteIdStrings.has(String(listing?.id ?? "")));
  }, [favoriteIds, favoritesList]);

  const visibleFavoritesListings = useMemo(() => {
    let rows = strictFavoritesList;
    if (browseVerticalId) {
      rows = rows.filter((l) => String(l.verticalId || l.categories || "") === String(browseVerticalId));
      if (browseSubId && browseSubId !== "all") {
        rows = rows.filter((l) => String(l.subId || "") === String(browseSubId));
      }
    }
    if (browseQuickFilter === "all") return rows;
    if (browseQuickFilter === "new") {
      return rows.filter((l) => {
        if (l?.createdAt) {
          const ageMs = Date.now() - new Date(l.createdAt).getTime();
          return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= 1000 * 60 * 60 * 24 * 14;
        }
        const text = `${l?.title || ""} ${l?.description || ""}`.toLowerCase();
        return /\bnew\b|brand new|sealed|unused/.test(text);
      });
    }
    if (browseQuickFilter === "sale") {
      return rows.filter((l) => {
        const text = `${l?.title || ""} ${l?.description || ""}`.toLowerCase();
        return /\bsale\b|discount|promo|markdown|clearance/.test(text);
      });
    }
    return rows;
  }, [strictFavoritesList, browseQuickFilter, browseVerticalId, browseSubId]);

  const activeBrowseFilterSummary = useMemo(() => {
    const items = [];
    if (browseQuickFilter !== "all") {
      const quick = BROWSE_QUICK_FILTERS.find((f) => f.id === browseQuickFilter);
      items.push(`Filter: ${quick?.label || browseQuickFilter}`);
    }
    if (browseVerticalId) {
      const verticalLabel = getVerticalById(browseVerticalId)?.label ?? browseVerticalId;
      items.push(`Category: ${verticalLabel}`);
    }
    return items;
  }, [browseQuickFilter, browseVerticalId]);

  const ordersForStatusTab = useMemo(
    () => orders.filter((o) => orderMatchesOrdersStatusTab(o.status, ordersStatusTab)),
    [orders, ordersStatusTab],
  );

  const listingDescriptionCount = useMemo(() => String(listingForm.description || "").length, [listingForm.description]);
  const listingFormDirty = useMemo(() => {
    return Boolean(
      String(listingForm.title || "").trim() ||
        String(listingForm.description || "").trim() ||
        String(listingForm.pricePesos || "").trim() ||
        String(listingForm.quantity || "").trim() ||
        String(listingForm.categories || "").trim() ||
        listingForm.pickup ||
        listingForm.delivery ||
        listingImageFile ||
        listingImagePreviewUrl ||
        editingListingId,
    );
  }, [editingListingId, listingForm, listingImageFile, listingImagePreviewUrl]);
  const profileConnectedSocialCount = useMemo(() => {
    let count = 0;
    if (String(profileDraft.facebookUrl || "").trim()) count += 1;
    if (String(profileDraft.twitterUrl || "").trim()) count += 1;
    if (String(profileDraft.instagramUrl || "").trim()) count += 1;
    return count;
  }, [profileDraft.facebookUrl, profileDraft.instagramUrl, profileDraft.twitterUrl]);

  const refreshFavorites = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiRequest("/me/favorites", { token });
      setFavoritesList(d.favorites || []);
      setFavoriteIds(new Set((d.favorites || []).map((x) => x.id)));
    } catch {
      setFavoriteIds(new Set());
    }
  }, [token]);

  const refreshCart = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiRequest("/me/cart", { token });
      const incoming = Array.isArray(d.items) ? d.items : [];
      setCartItems((prev) => mergeCartItemsPreservingOrder(prev, incoming));
    } catch {
      setCartItems([]);
    }
  }, [token, mergeCartItemsPreservingOrder]);

  const setCartLineQuantity = useCallback(
    async (listingId, rawTarget) => {
      const id = String(listingId);
      const item = cartItems.find((i) => String(i.listingId) === id);
      if (!item) return;
      const maxStock = Number(item.listingQuantity);
      const maxQ =
        Number.isFinite(maxStock) && maxStock >= 1 ? maxStock : Math.max(1, Number(item.quantity) || 1);
      const n = Math.floor(Number(rawTarget));
      if (!Number.isFinite(n) || n < 0) return;
      if (n === 0) {
        if (token) {
          setCartQtySavingId(id);
          try {
            const d = await apiRequest(`/me/cart/items/${id}`, {
              method: "DELETE",
              token,
            });
            const incoming = Array.isArray(d.items) ? d.items : [];
            setCartItems((prev) => mergeCartItemsPreservingOrder(prev, incoming));
            setMarketplaceMessage("");
          } catch (e) {
            setMarketplaceMessage(e.message || "Could not remove item from cart.");
          } finally {
            setCartQtySavingId(null);
          }
        } else {
          setCartItems((prev) => prev.filter((it) => String(it.listingId) !== id));
        }
        return;
      }
      const clamped = Math.min(maxQ, Math.max(1, n));

      if (token) {
        setCartQtySavingId(id);
        try {
          const d = await apiRequest(`/me/cart/items/${id}`, {
            method: "PATCH",
            token,
            body: { quantity: clamped },
          });
          const incoming = Array.isArray(d.items) ? d.items : [];
          setCartItems((prev) => mergeCartItemsPreservingOrder(prev, incoming));
          setMarketplaceMessage("");
        } catch (e) {
          setMarketplaceMessage(e.message || "Could not update quantity.");
        } finally {
          setCartQtySavingId(null);
        }
      } else {
        setCartItems((prev) => prev.map((it) => (String(it.listingId) === id ? { ...it, quantity: clamped } : it)));
      }
    },
    [cartItems, token, mergeCartItemsPreservingOrder],
  );

  useEffect(() => {
    return () => {
      Object.values(cartQtyCommitTimersRef.current).forEach((timerId) => {
        clearTimeout(timerId);
      });
      cartQtyCommitTimersRef.current = {};
    };
  }, []);

  const toggleCartListingSelected = useCallback((listingId) => {
    const id = String(listingId);
    setCartItemSelection((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }, []);

  const toggleCartSellerSelectAll = useCallback((items) => {
    const ids = items.map((i) => String(i.listingId));
    setCartItemSelection((prev) => {
      const allOn = ids.length > 0 && ids.every((id) => prev[id]);
      const next = { ...prev };
      for (const id of ids) {
        if (allOn) delete next[id];
        else next[id] = true;
      }
      return next;
    });
  }, []);

  const toggleOrderSelected = useCallback((orderId) => {
    const id = String(orderId || "");
    if (!id) return;
    setOrderSelection((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }, []);

  const toggleOrderSellerSelectAll = useCallback((sellerOrders) => {
    const ids = sellerOrders.map((o) => String(o.id || "")).filter(Boolean);
    setOrderSelection((prev) => {
      const allOn = ids.length > 0 && ids.every((id) => prev[id]);
      const next = { ...prev };
      for (const id of ids) {
        if (allOn) delete next[id];
        else next[id] = true;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const valid = new Set(cartItems.map((i) => String(i.listingId)));
    setCartItemSelection((prev) => {
      const next = {};
      for (const id of valid) {
        if (prev[id]) next[id] = true;
      }
      if (Object.keys(prev).length === Object.keys(next).length) {
        const unchanged = Object.keys(prev).every((k) => Boolean(prev[k]) === Boolean(next[k]));
        if (unchanged) return prev;
      }
      return next;
    });
  }, [cartItems]);

  useEffect(() => {
    const valid = new Set(ordersForStatusTab.map((o) => String(o.id || "")));
    setOrderSelection((prev) => {
      const next = {};
      for (const id of valid) {
        if (prev[id]) next[id] = true;
      }
      if (Object.keys(prev).length === Object.keys(next).length) {
        const unchanged = Object.keys(prev).every((k) => Boolean(prev[k]) === Boolean(next[k]));
        if (unchanged) return prev;
      }
      return next;
    });
  }, [ordersForStatusTab]);

  const selectedCartItems = useMemo(
    () => cartItems.filter((item) => cartItemSelection[String(item.listingId)]),
    [cartItems, cartItemSelection],
  );
  const selectedOrders = useMemo(
    () => ordersForStatusTab.filter((order) => orderSelection[String(order.id || "")]),
    [ordersForStatusTab, orderSelection],
  );
  const ordersAcceptEnabled = useMemo(() => {
    if (!selectedOrders.length) return false;
    if (ordersRole !== "seller") return false;
    if (ordersStatusTab !== "pending") return false;
    return selectedOrders.every((o) => String(o.status || "").toLowerCase() === "placed");
  }, [selectedOrders, ordersRole, ordersStatusTab]);
  const ordersDeclineEnabled = useMemo(() => {
    if (!selectedOrders.length) return false;
    if (ordersStatusTab !== "pending") return false;
    return selectedOrders.every((o) => String(o.status || "").toLowerCase() === "placed");
  }, [selectedOrders, ordersStatusTab]);
  const selectedCartTotals = useMemo(() => {
    let currentTotalCents = 0;
    let originalTotalCents = 0;
    for (const item of selectedCartItems) {
      const qty = Math.max(1, Math.floor(Number(item?.quantity) || 1));
      const currentLineCents = Math.max(0, Number(item?.unitPriceCents) || 0) * qty;
      const meta = parseSaleMetaFromDescription(item?.description || "");
      const originalPesos = Number.isFinite(Number(meta?.originalPesos)) ? Number(meta.originalPesos) : null;
      const originalUnitCents = originalPesos != null && originalPesos > 0 ? Math.round(originalPesos * 100) : Math.max(0, Number(item?.unitPriceCents) || 0);
      const originalLineCents = originalUnitCents * qty;
      currentTotalCents += currentLineCents;
      originalTotalCents += Math.max(currentLineCents, originalLineCents);
    }
    const discountCents = Math.max(0, originalTotalCents - currentTotalCents);
    const discountPercent = originalTotalCents > 0 ? Math.round((discountCents / originalTotalCents) * 100) : 0;
    return { currentTotalCents, originalTotalCents, discountCents, discountPercent };
  }, [selectedCartItems]);

  const checkoutSelectedCartItems = useCallback(async () => {
    if (!selectedCartItems.length) {
      setMarketplaceMessage("Select at least one product to check out.");
      return;
    }
    if (!token) {
      setMarketplaceMessage("Please sign in to check out.");
      return;
    }
    setCartCheckoutSubmitting(true);
    let successCount = 0;
    let failedCount = 0;
    for (const item of selectedCartItems) {
      const listingId = String(item?.listingId || "");
      if (!listingId) continue;
      const qty = Math.max(1, Math.floor(Number(item?.quantity) || 1));
      const modes = Array.isArray(item?.fulfillmentModes) ? item.fulfillmentModes : [];
      const fulfillmentType = modes.includes("pickup") ? "pickup" : modes.includes("delivery") ? "delivery" : "pickup";
      try {
        await apiRequest("/orders", {
          method: "POST",
          token,
          body: { listingId, fulfillmentType, quantity: qty },
        });
        successCount += 1;
        try {
          const d = await apiRequest(`/me/cart/items/${listingId}`, {
            method: "DELETE",
            token,
          });
          const incoming = Array.isArray(d.items) ? d.items : [];
          setCartItems((prev) => mergeCartItemsPreservingOrder(prev, incoming));
        } catch {
          // Keep checkout success even if cart row deletion returns an error.
        }
      } catch {
        failedCount += 1;
      }
    }
    setCartCheckoutSubmitting(false);
    setCartItemSelection({});
    if (successCount > 0) {
      setMarketplaceMessage(
        failedCount === 0
          ? `Checked out ${successCount} item${successCount > 1 ? "s" : ""}.`
          : `Checked out ${successCount} item${successCount > 1 ? "s" : ""}. ${failedCount} failed.`,
      );
      setOrdersRole("buyer");
      setOrdersStatusTab("pending");
      goMyPurchases();
      return;
    }
    setMarketplaceMessage("Could not check out selected items.");
  }, [selectedCartItems, token, mergeCartItemsPreservingOrder, goMyPurchases]);

  const applyTransitionToSelectedOrders = useCallback(
    async (transition, label) => {
      if (!selectedOrders.length) {
        setMarketplaceMessage("Select at least one order first.");
        return;
      }
      if (!token) {
        setMarketplaceMessage("Please sign in to update orders.");
        return;
      }
      setMarketplaceMessage("");
      setOrdersBulkActionSubmitting(true);
      let successCount = 0;
      let failedCount = 0;
      for (const order of selectedOrders) {
        try {
          await apiRequest(`/orders/${order.id}`, { method: "PATCH", token, body: { transition } });
          successCount += 1;
        } catch {
          failedCount += 1;
        }
      }
      try {
        const data = await apiRequest(`/orders?role=${ordersRole}`, { token });
        setOrders(data.orders || []);
      } catch {
        // Keep prior rows if refresh fails; result banner still informs user.
      }
      setOrdersBulkActionSubmitting(false);
      setOrderSelection({});
      if (successCount > 0) {
        if (transition === "cancel") setOrdersStatusTab("cancelled");
        setMarketplaceMessage(
          failedCount === 0
            ? `${label} ${successCount} order${successCount > 1 ? "s" : ""}.`
            : `${label} ${successCount} order${successCount > 1 ? "s" : ""}. ${failedCount} failed.`,
        );
      } else {
        setMarketplaceMessage(`Could not ${label.toLowerCase()} selected orders.`);
      }
    },
    [selectedOrders, token, ordersRole],
  );

  useEffect(() => {
    if (!token) {
      setFavoriteIds(new Set());
      setFavoritesList([]);
      return undefined;
    }
    refreshFavorites();
    return undefined;
  }, [token, refreshFavorites]);

  useEffect(() => {
    if (!token) {
      setCartItems([]);
      return undefined;
    }
    refreshCart();
    return undefined;
  }, [token, refreshCart]);

  useEffect(() => {
    if (!user || !routeListingId) return undefined;
    setSelectedListingId(routeListingId);
    setActiveView(shopCommunityId ? VIEWS.COMMUNITY_SHOP : VIEWS.BROWSE);
    return undefined;
  }, [user, routeListingId, shopCommunityId]);

  useEffect(() => {
    if (!user || activeView !== VIEWS.BROWSE || shopCommunityId || !listingCommunityFromProfile.id) return undefined;
    if (skipAutoCommunityBrowseRef.current) {
      skipAutoCommunityBrowseRef.current = false;
      return undefined;
    }
    setShopCommunityId(String(listingCommunityFromProfile.id));
    setActiveView(VIEWS.COMMUNITY_SHOP);
    return undefined;
  }, [user, activeView, shopCommunityId, listingCommunityFromProfile.id]);

  useEffect(() => {
    if (!shopCommunityId) {
      prevShopCommunityIdRef.current = null;
      communityListingsSyncedRef.current = null;
      return undefined;
    }
    if (shopCommunityId !== prevShopCommunityIdRef.current) {
      prevShopCommunityIdRef.current = shopCommunityId;
      setBrowseVerticalId(null);
      setBrowseSubId(null);
      setBrowseQuickFilter("all");
      setSelectedListingId(null);
      setActiveView(VIEWS.COMMUNITY_SHOP);
    }
    return undefined;
  }, [shopCommunityId]);
  useEffect(() => {
    if (activeView !== VIEWS.COMMUNITY_SHOP && activeView !== VIEWS.FAVORITES) setMobileCommunityFiltersOpen(false);
  }, [activeView]);

  useEffect(() => {
    if (!token || activeView !== VIEWS.COMMUNITY_SHOP || !isMemberOfOpenCommunity || !activeCommunity?.id) return undefined;
    const key = `${user?.id || "anon"}:${activeCommunity.id}`;
    if (communityListingsSyncedRef.current === key) return undefined;
    communityListingsSyncedRef.current = key;
    void joinCommunityAndAttachListings(activeCommunity);
    return undefined;
  }, [token, activeView, isMemberOfOpenCommunity, activeCommunity, user?.id, joinCommunityAndAttachListings]);

  /** Old bookmarked `/c/:id` or `/c/:id/shop` URLs → same in-app state, then clean path. */
  useEffect(() => {
    if (!user) return undefined;
    const m = /^\/c\/([0-9a-f-]{36})(?:\/shop)?\/?$/i.exec(location.pathname);
    if (!m?.[1]) return undefined;
    setShopCommunityId(m[1]);
    navigate("/", { replace: true });
    return undefined;
  }, [user, location.pathname, navigate]);

  useEffect(() => {
    if (!selectedListingId) {
      setListingDetail(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const d = await apiRequest(`/listings/${selectedListingId}`, token ? { token } : {});
        if (!cancelled) setListingDetail(d.listing);
      } catch {
        if (!cancelled) setListingDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedListingId, token]);

  useEffect(() => {
    if (!token || activeView !== VIEWS.COMMUNITY_SHOP) return undefined;
    const inCommunity = !!shopCommunityId;
    const hasVertical = browseVerticalId != null;
    const queryKey = `${inCommunity ? shopCommunityId : "global"}|${browseVerticalId ?? ""}|${browseSubId ?? ""}|${isMemberOfOpenCommunity ? "m" : "v"}`;
    if (communityShopListingsQueryKeyRef.current !== queryKey) {
      communityShopListingsQueryKeyRef.current = queryKey;
      setListings([]);
    }
    setListingsError("");
    let cancelled = false;
    (async () => {
      setListingsLoading(true);
      setListingsError("");
      try {
        const qs = new URLSearchParams();
        if (inCommunity) qs.set("communityId", shopCommunityId);
        if (hasVertical) {
          qs.set("verticalId", browseVerticalId);
          if (browseSubId && browseSubId !== "all") qs.set("subId", browseSubId);
        }
        const data = await apiRequest(`/listings?${qs.toString()}`, { token });
        if (!cancelled) {
          const rows = Array.isArray(data.listings) ? data.listings : [];
          let nextRows =
            inCommunity && !isMemberOfOpenCommunity
              ? rows.filter((row) => String(row.sellerId || "") !== String(user?.id || ""))
              : rows;
          const communityRow =
            inCommunity && shopCommunityId
              ? communitiesRef.current.find((x) => String(x.id) === String(shopCommunityId))
              : null;
          if (inCommunity && isMemberOfOpenCommunity && nextRows.length === 0 && communityRow?.id) {
            await joinCommunityAndAttachListings(communityRow);
            const retry = await apiRequest(`/listings?communityId=${encodeURIComponent(String(shopCommunityId))}`, { token });
            const retriedRows = Array.isArray(retry?.listings) ? retry.listings : [];
            nextRows = retriedRows;
          }
          setListings(nextRows);
        }
      } catch (e) {
        if (!cancelled) {
          setListingsError(e.message || "Could not load listings.");
          setListings([]);
        }
      } finally {
        if (!cancelled) setListingsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    token,
    activeView,
    browseVerticalId,
    browseSubId,
    shopCommunityId,
    user?.id,
    isMemberOfOpenCommunity,
    joinCommunityAndAttachListings,
  ]);

  useEffect(() => {
    if (!token || activeView !== VIEWS.FAVORITES) return undefined;
    const hadFavorites = favoritesListRef.current.length > 0;
    let cancelled = false;
    (async () => {
      if (!hadFavorites) setFavoritesLoading(true);
      try {
        await refreshFavorites();
      } finally {
        if (!cancelled) setFavoritesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeView, refreshFavorites]);

  useEffect(() => {
    if (!token || (activeView !== VIEWS.ORDERS && activeView !== VIEWS.MY_PURCHASES)) return undefined;
    const roleKey = String(ordersRole);
    const roleScopeChanged = ordersDataQueryKeyRef.current !== roleKey;
    if (roleScopeChanged) {
      ordersDataQueryKeyRef.current = roleKey;
      setOrders([]);
    }
    let cancelled = false;
    (async () => {
      if (roleScopeChanged || ordersRef.current.length === 0) setOrdersLoading(true);
      try {
        const data = await apiRequest(`/orders?role=${ordersRole}`, { token });
        if (!cancelled) setOrders(data.orders || []);
      } catch {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeView, ordersRole]);

  useEffect(() => {
    if (!token || (activeView !== VIEWS.ORDERS && activeView !== VIEWS.MY_PURCHASES) || !orders.length) return undefined;
    const missingIds = Array.from(
      new Set(
        orders
          .map((o) => String(o.listingId || ""))
          .filter((id) => id && !orderListingsById[id]),
      ),
    );
    if (missingIds.length === 0) return undefined;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        missingIds.map(async (id) => {
          try {
            const data = await apiRequest(`/listings/${id}`, { token });
            return [id, data?.listing || null];
          } catch {
            return [id, null];
          }
        }),
      );
      if (cancelled) return;
      setOrderListingsById((prev) => {
        const next = { ...prev };
        for (const [id, listing] of entries) next[id] = listing;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeView, orders, orderListingsById]);

  useEffect(() => {
    if (!token || (activeView !== VIEWS.ORDERS && activeView !== VIEWS.MY_PURCHASES) || usersList.length > 0) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest("/users", { token });
        if (!cancelled) setUsersList(Array.isArray(data?.users) ? data.users : []);
      } catch {
        // Keep orders usable even if users lookup fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeView, usersList.length]);

  useEffect(() => {
    if (!token || activeView !== VIEWS.PROFILE) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [sum, exp] = await Promise.all([
          apiRequest("/me/seller/summary", { token }),
          apiRequest("/me/expenses", { token }),
        ]);
        if (!cancelled) {
          setSellerSummary(sum);
          setExpenses(exp.expenses || []);
        }
      } catch {
        if (!cancelled) {
          setSellerSummary(null);
          setExpenses([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeView, sellerTab]);

  useEffect(() => {
    if (!token) return undefined;
    const loadMyListings =
      activeView === VIEWS.MY_LISTINGS ||
      (activeView === VIEWS.PROFILE && sellerTab === SELLER_TABS.PRODUCTS);
    if (!loadMyListings) return undefined;
    const hadSellerListings = sellerListingsRef.current.length > 0;
    let cancelled = false;
    (async () => {
      if (!hadSellerListings) setSellerListingsLoading(true);
      try {
        const data = await apiRequest("/me/listings", { token });
        if (!cancelled) setSellerListings(data.listings || []);
      } catch {
        if (!cancelled) setSellerListings([]);
      } finally {
        if (!cancelled) setSellerListingsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeView, sellerTab]);

  useEffect(() => {
    if (!token || activeView !== VIEWS.CART) return undefined;
    void refreshCart();
    return undefined;
  }, [token, activeView, refreshCart]);

  useEffect(() => {
    if (!token || (!isBrowseLikeView && activeView !== VIEWS.MY_LISTINGS && activeView !== VIEWS.PROFILE)) return undefined;
    const hadCommunities = communitiesRef.current.length > 0;
    let cancelled = false;
    (async () => {
      if (!hadCommunities) setCommunitiesLoading(true);
      setCommunitiesError("");
      try {
        const res = await apiRequest("/communities", { token });
        if (!cancelled) setCommunities(res.communities || []);
      } catch (e) {
        if (!cancelled) {
          setCommunitiesError(e.message || "Could not load communities.");
          setCommunities([]);
        }
      } finally {
        if (!cancelled) setCommunitiesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isBrowseLikeView, activeView]);

  useEffect(() => {
    if (profileEditing) return undefined;
    setProfileBrgySuggestOpen(false);
    if (profileBrgySuggestBlurTimerRef.current) {
      clearTimeout(profileBrgySuggestBlurTimerRef.current);
      profileBrgySuggestBlurTimerRef.current = null;
    }
    return undefined;
  }, [profileEditing]);

  useEffect(() => {
    return () => {
      if (profileBrgySuggestBlurTimerRef.current) {
        clearTimeout(profileBrgySuggestBlurTimerRef.current);
        profileBrgySuggestBlurTimerRef.current = null;
      }
    };
  }, []);

  const closeAddCommunityModal = useCallback(() => {
    setCommunityFormOpen(false);
    setCommunityEditingId(null);
    setCommunityImageFile(null);
    setCommunityProvinceSuggestOpen(false);
    setCommunityCitySuggestOpen(false);
    if (communityProvinceSuggestBlurTimerRef.current) {
      clearTimeout(communityProvinceSuggestBlurTimerRef.current);
      communityProvinceSuggestBlurTimerRef.current = null;
    }
    if (communityCitySuggestBlurTimerRef.current) {
      clearTimeout(communityCitySuggestBlurTimerRef.current);
      communityCitySuggestBlurTimerRef.current = null;
    }
    if (communityImageInputRef.current) communityImageInputRef.current.value = "";
  }, []);

  const openAddCommunityModal = useCallback(() => {
    const fallbackName = String(profileCommunityName || "").trim();
    setCommunityEditingId(null);
    setCommunityForm({
      name: fallbackName,
      city: String(profileCityProvincePostal.city || "").trim(),
      province: String(profileCityProvincePostal.province || "").trim(),
      postalCode: String(profileCityProvincePostal.postalCode || "").trim(),
    });
    setCommunityProvinceSuggestOpen(false);
    setCommunityCitySuggestOpen(false);
    setMarketplaceMessage("");
    setCommunityFormOpen(true);
  }, [profileCityProvincePostal.city, profileCityProvincePostal.postalCode, profileCityProvincePostal.province, profileCommunityName]);

  const openEditCommunityModal = useCallback((community) => {
    if (!community?.id) return;
    setCommunityEditingId(String(community.id));
    setCommunityForm({
      name: String(community.name || "").trim(),
      city: String(community.city || "").trim(),
      province: String(community.province || "").trim(),
      postalCode: String(community.postalCode || "").trim(),
    });
    setCommunityProvinceSuggestOpen(false);
    setCommunityCitySuggestOpen(false);
    setCommunityImageFile(null);
    if (communityImageInputRef.current) communityImageInputRef.current.value = "";
    setMarketplaceMessage("");
    setCommunityFormOpen(true);
  }, []);

  useEffect(() => {
    if (!communityFormOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeAddCommunityModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [communityFormOpen, closeAddCommunityModal]);
  useEffect(
    () => () => {
      if (communityProvinceSuggestBlurTimerRef.current) {
        clearTimeout(communityProvinceSuggestBlurTimerRef.current);
        communityProvinceSuggestBlurTimerRef.current = null;
      }
      if (communityCitySuggestBlurTimerRef.current) {
        clearTimeout(communityCitySuggestBlurTimerRef.current);
        communityCitySuggestBlurTimerRef.current = null;
      }
    },
    [],
  );

  const handleCreateCommunity = async (ev) => {
    ev.preventDefault();
    if (!token) {
      setMarketplaceMessage("Sign in again to add a community.");
      return;
    }
    const nameDraft = String(communityForm.name || "").trim();
    const communityName = nameDraft || `Community ${new Date().toISOString().slice(0, 10)}`;
    const cityDraft = String(communityForm.city || "").trim();
    const provinceDraft = String(communityForm.province || "").trim();
    const postalDraft = String(communityForm.postalCode || "").trim();
    setCommunitySaving(true);
    setMarketplaceMessage("");
    try {
      const fd = new FormData();
      fd.append("name", communityName);
      if (cityDraft) fd.append("city", cityDraft);
      if (provinceDraft) fd.append("province", provinceDraft);
      if (postalDraft) fd.append("postalCode", postalDraft);
      if (communityImageFile) fd.append("image", communityImageFile);
      const endpoint = communityEditingId ? `/communities/${communityEditingId}` : "/communities";
      const method = communityEditingId ? "PATCH" : "POST";
      const createdRes = await apiRequest(endpoint, { method, token, body: fd });
      const createdCommunity = createdRes?.community;
      closeAddCommunityModal();
      const res = await apiRequest("/communities", { token });
      let nextCommunities = res.communities || [];
      if (createdCommunity?.id && !nextCommunities.some((c) => c.id === createdCommunity.id)) {
        nextCommunities = [createdCommunity, ...nextCommunities];
      }
      setCommunities(nextCommunities);
      setMarketplaceMessage(communityEditingId ? "Community updated." : "Community added.");
    } catch (e) {
      setMarketplaceMessage(e.message || "Could not create new community.");
    } finally {
      setCommunitySaving(false);
    }
  };

  const toggleFavorite = async (listingId, makeFavorite) => {
    if (!token) return;
    setMarketplaceMessage("");
    const id = String(listingId || "");
    const candidate =
      listings.find((x) => String(x.id) === id) ||
      favoritesList.find((x) => String(x.id) === id) ||
      (listingDetail && String(listingDetail.id) === id ? listingDetail : null) ||
      sellerListings.find((x) => String(x.id) === id) ||
      null;

    // Optimistic UI: favorites section updates immediately after click.
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (makeFavorite) next.add(id);
      else next.delete(id);
      return next;
    });
    setFavoritesList((prev) => {
      if (makeFavorite) {
        if (!candidate) return prev;
        if (prev.some((x) => String(x.id) === id)) return prev;
        return [candidate, ...prev];
      }
      return prev.filter((x) => String(x.id) !== id);
    });
    try {
      if (makeFavorite) await apiRequest(`/me/favorites/${listingId}`, { method: "POST", token });
      else await apiRequest(`/me/favorites/${listingId}`, { method: "DELETE", token });
      await refreshFavorites();
    } catch (e) {
      // Revert optimistic state if server update fails.
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (makeFavorite) next.delete(id);
        else next.add(id);
        return next;
      });
      setFavoritesList((prev) => {
        if (makeFavorite) return prev.filter((x) => String(x.id) !== id);
        if (!candidate) return prev;
        if (prev.some((x) => String(x.id) === id)) return prev;
        return [candidate, ...prev];
      });
      setMarketplaceMessage(e.message || "Could not update favorites.");
    }
  };

  const closeListingDetail = () => {
    setSelectedListingId(null);
    navigate("/", { replace: true });
  };

  const patchOrderTransition = async (orderId, transition) => {
    setMarketplaceMessage("");
    try {
      await apiRequest(`/orders/${orderId}`, { method: "PATCH", token, body: { transition } });
      const data = await apiRequest(`/orders?role=${ordersRole}`, { token });
      setOrders(data.orders || []);
      setMarketplaceMessage("Order updated.");
    } catch (e) {
      setMarketplaceMessage(e.message || "Could not update order.");
    }
  };

  const acceptOrderBid = async (orderId, bidId) => {
    setMarketplaceMessage("");
    try {
      await apiRequest(`/orders/${orderId}/bids/${bidId}/accept`, { method: "POST", token });
      const data = await apiRequest(`/orders?role=${ordersRole}`, { token });
      setOrders(data.orders || []);
      setExpandedBidOrderId(null);
      setBidsForOrder([]);
      setMarketplaceMessage("Bid accepted. Agreed delivery fee is stored for COD at handoff.");
    } catch (e) {
      setMarketplaceMessage(e.message || "Could not accept bid.");
    }
  };

  const loadBidsForOrder = async (orderId) => {
    setExpandedBidOrderId(orderId);
    try {
      const d = await apiRequest(`/orders/${orderId}/bids`, { token });
      setBidsForOrder(d.bids || []);
    } catch {
      setBidsForOrder([]);
    }
  };

  const handleAddExpense = async (ev) => {
    ev.preventDefault();
    const pesos = Number(expenseDraft.amountPesos);
    if (!Number.isFinite(pesos) || pesos < 0) {
      setMarketplaceMessage("Invalid expense amount.");
      return;
    }
    setMarketplaceMessage("");
    try {
      await apiRequest("/me/expenses", {
        method: "POST",
        token,
        body: {
          amountCents: Math.round(pesos * 100),
          category: expenseDraft.category,
          note: expenseDraft.note,
        },
      });
      setExpenseDraft({ amountPesos: "", category: "supplies", note: "" });
      const [sum, exp] = await Promise.all([apiRequest("/me/seller/summary", { token }), apiRequest("/me/expenses", { token })]);
      setSellerSummary(sum);
      setExpenses(exp.expenses || []);
      setMarketplaceMessage("Expense added.");
    } catch (e) {
      setMarketplaceMessage(e.message || "Could not add expense.");
    }
  };

  const deleteExpenseById = async (id) => {
    try {
      await apiRequest(`/me/expenses/${id}`, { method: "DELETE", token });
      const [sum, exp] = await Promise.all([apiRequest("/me/seller/summary", { token }), apiRequest("/me/expenses", { token })]);
      setSellerSummary(sum);
      setExpenses(exp.expenses || []);
    } catch (e) {
      setMarketplaceMessage(e.message || "Could not delete.");
    }
  };

  const deleteSellerListingById = async (id) => {
    if (!token || !id) return;
    const ok = typeof window === "undefined" ? true : window.confirm("Delete this listing?");
    if (!ok) return;
    try {
      await apiRequest(`/me/listings/${id}`, { method: "DELETE", token });
      const refreshed = await apiRequest("/me/listings", { token });
      setSellerListings(refreshed.listings || []);
      if (editingListingId && String(editingListingId) === String(id)) {
        setEditingListingId(null);
        setListingForm({
          title: "",
          description: "",
          pricePesos: "",
          quantity: "",
          categories: "",
          subId: "all",
          pickup: false,
          delivery: false,
        });
        setListingFieldErrors({});
        setListingImageFile(null);
        if (listingImagePreviewUrl) URL.revokeObjectURL(listingImagePreviewUrl);
        setListingImagePreviewUrl("");
      }
      setMarketplaceMessage("Listing deleted.");
    } catch (e) {
      setMarketplaceMessage(e.message || "Could not delete listing.");
    }
  };

  const applySellerListingDiscount = async (listing, percent) => {
    const id = String(listing?.id || "");
    if (!id) return;
    const pct = Number(percent);
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
      setMarketplaceMessage("Choose a valid discount percentage.");
      return;
    }
    const currentPriceCents = Math.max(0, Number(listing?.priceCents) || 0);
    const currentPesos = Math.floor(currentPriceCents / 100);
    const desc = String(listing?.description || "");
    const meta = parseSaleMetaFromDescription(desc);
    const basePesos = Number.isFinite(Number(meta.originalPesos)) && Number(meta.originalPesos) > 0 ? Number(meta.originalPesos) : currentPesos;
    const discountedPesos = Math.max(0, Math.floor(basePesos * (1 - pct / 100)));
    const discountedPriceCents = discountedPesos * 100;
    if (discountedPriceCents === currentPriceCents) {
      setMarketplaceMessage("Discount did not change the price.");
      return;
    }
    const baseDescription = removeSaleMetaLines(desc);
    const saleTag = `Sale ${pct}% off`;
    const originalTag = `Original ₱${basePesos}`;
    const patchedDescription = [baseDescription, `${saleTag} | ${originalTag}`].filter(Boolean).join("\n");
    try {
      await apiRequest(`/me/listings/${id}`, {
        method: "PATCH",
        token,
        body: {
          priceCents: discountedPriceCents,
          description: patchedDescription,
        },
      });
      const refreshed = await apiRequest("/me/listings", { token });
      setSellerListings(refreshed.listings || []);
      if (shopCommunityId) {
        const qs = new URLSearchParams({ communityId: String(shopCommunityId) });
        const shopData = await apiRequest(`/listings?${qs.toString()}`, { token });
        setListings(shopData.listings || []);
      }
      setMarketplaceMessage(`Applied ${pct}% discount.`);
    } catch (e) {
      setMarketplaceMessage(e.message || "Could not apply discount.");
    }
  };

  const openQuickAddModal = (listing) => {
    if (!listing?.id) return;
    const stock = Math.max(1, Number(listing.quantity) || 1);
    setQuickAddListing(listing);
    setQuickAddQuantity(String(stock >= 1 ? 1 : stock));
    setQuickAddComment("");
    setQuickAddModalOpen(true);
  };

  const closeQuickAddModal = () => {
    if (quickAddSubmitting) return;
    setQuickAddModalOpen(false);
    setQuickAddListing(null);
    setQuickAddQuantity("1");
    setQuickAddComment("");
  };

  const submitQuickAddOrder = async () => {
    if (!quickAddListing?.id || quickAddSubmitting) return;
    const parsedQty = Number(quickAddQuantity);
    const maxQty = Math.max(1, Number(quickAddListing.quantity) || 1);
    if (!Number.isFinite(parsedQty) || parsedQty < 1 || parsedQty > maxQty) {
      setMarketplaceMessage(`Quantity must be between 1 and ${maxQty}.`);
      return;
    }
    setQuickAddSubmitting(true);
    try {
      if (token) {
        try {
          const cartData = await apiRequest("/me/cart/items", {
            method: "POST",
            token,
            body: {
              listingId: String(quickAddListing.id),
              quantity: parsedQty,
              comment: String(quickAddComment || "").trim(),
            },
          });
          const incoming = Array.isArray(cartData?.items) ? cartData.items : [];
          setCartItems((prev) => {
            const merged = mergeCartItemsPreservingOrder(prev, incoming);
            return moveSellerGroupToTop(merged, quickAddListing?.sellerId);
          });
          setMarketplaceMessage("Added to your cart.");
        } catch (e) {
          setMarketplaceMessage(e.message || "Could not save to cart.");
          return;
        }
      } else {
        let sellerUsername = "";
        const sellerId = String(quickAddListing.sellerId || "unknown");
        const cachedSeller = usersList.find((u) => String(u.id || "") === sellerId);
        if (cachedSeller?.username) {
          sellerUsername = String(cachedSeller.username || "").trim();
        }
        setCartItems((prev) => {
          const listingId = String(quickAddListing.id);
          const idx = prev.findIndex((item) => String(item.listingId) === listingId);
          if (idx === -1) {
            const sellerLabel = sellerUsername
              ? `@${sellerUsername}`
              : sellerId && sellerId !== "unknown"
                ? `Seller ${sellerId.slice(0, 8)}`
                : "Unknown seller";
            return [
              ...prev,
              {
                listingId,
                sellerId,
                sellerLabel,
                title: String(quickAddListing.title || "Product"),
                description: String(quickAddListing.description || "").trim(),
                imageUrl: String(quickAddListing.imageUrl || "").trim(),
                unitPriceCents: Number(quickAddListing.priceCents) || 0,
                quantity: parsedQty,
                listingQuantity: maxQty,
                fulfillmentModes: Array.isArray(quickAddListing.fulfillmentModes) ? quickAddListing.fulfillmentModes : ["pickup"],
                comment: String(quickAddComment || "").trim(),
              },
            ];
          }
          const next = [...prev];
          const existing = next[idx];
          const desc = String(quickAddListing.description || "").trim() || String(existing.description || "").trim();
          const mergedQty = Math.min(maxQty, Number(existing.quantity || 0) + parsedQty);
          next[idx] = {
            ...existing,
            quantity: mergedQty,
            listingQuantity: maxQty,
            fulfillmentModes: Array.isArray(quickAddListing.fulfillmentModes) ? quickAddListing.fulfillmentModes : ["pickup"],
            comment: String(quickAddComment || "").trim() || existing.comment || "",
            ...(desc ? { description: desc } : {}),
          };
          return next;
        });
        setMarketplaceMessage("Added to your cart.");
      }
      setActiveView(VIEWS.CART);
      setQuickAddModalOpen(false);
      setQuickAddListing(null);
      setQuickAddQuantity("1");
      setQuickAddComment("");
    } finally {
      setQuickAddSubmitting(false);
    }
  };

  const beginEditSellerListing = (listing) => {
    if (!listing?.id) return;
    setEditingListingId(String(listing.id));
    setListingForm({
      title: String(listing.title || ""),
      description: String(listing.description || ""),
      pricePesos: Number.isFinite(Number(listing.priceCents)) ? String(Number(listing.priceCents) / 100) : "",
      quantity: Number.isFinite(Number(listing.quantity)) ? String(Number(listing.quantity)) : "",
      categories: String(listing.categories || listing.verticalId || ""),
      subId: String(listing.subId || "all"),
      pickup: Array.isArray(listing.fulfillmentModes) ? listing.fulfillmentModes.includes("pickup") : true,
      delivery: Array.isArray(listing.fulfillmentModes) ? listing.fulfillmentModes.includes("delivery") : true,
    });
    setListingFieldErrors({});
    setListingImageFile(null);
    if (listingImagePreviewUrl && listingImagePreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(listingImagePreviewUrl);
    }
    setListingImagePreviewUrl(String(listing.imageUrl || "").trim());
    setMarketplaceMessage("");
    setActiveView(VIEWS.MY_LISTINGS);
    navigate("/", { replace: true });
  };

  const handleCreateListing = async (ev) => {
    ev.preventDefault();
    if (!token) return;
    const nextErrors = {};
    if (!String(listingForm.title || "").trim()) nextErrors.title = "Product is required.";
    if (!String(listingForm.categories || "").trim()) nextErrors.categories = "Category is required.";
    if (String(listingForm.quantity ?? "").trim() === "") nextErrors.quantity = "Quantity is required.";
    if (String(listingForm.pricePesos ?? "").trim() === "") nextErrors.pricePesos = "Price is required.";
    if (!listingForm.pickup && !listingForm.delivery) nextErrors.fulfillment = "Choose at least one fulfillment method.";

    const hasImage = Boolean(String(listingImagePreviewUrl || "").trim() || listingImageFile);
    if (!hasImage) {
      nextErrors.image = "Image is required.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setListingFieldErrors(nextErrors);
      setMarketplaceMessage("");
      return;
    }
    setListingFieldErrors({});
    const catMissing = !String(listingForm.categories || "").trim();
    const qtyStr = String(listingForm.quantity ?? "").trim();
    const qtyMissing = qtyStr === "";
    if (catMissing && qtyMissing) {
      setMarketplaceMessage("Select a category and enter a quantity before publishing.");
      return;
    }
    if (catMissing) {
      setMarketplaceMessage("Select a category before publishing.");
      return;
    }
    if (qtyMissing) {
      setMarketplaceMessage("Enter a quantity before publishing.");
      return;
    }
    const qtyNum = Number(qtyStr);
    if (!Number.isFinite(qtyNum) || qtyNum < 0 || !Number.isInteger(qtyNum)) {
      setMarketplaceMessage("Enter a valid whole number for quantity (0 or more).");
      return;
    }

    const pesos = Number(listingForm.pricePesos);
    if (!Number.isFinite(pesos) || pesos < 0) {
      setMarketplaceMessage("Enter a valid price in pesos.");
      return;
    }
    const modes = [];
    if (listingForm.pickup) modes.push("pickup");
    if (listingForm.delivery) modes.push("delivery");
    if (modes.length === 0) {
      setListingFieldErrors((prev) => ({ ...prev, fulfillment: "Choose at least one fulfillment method." }));
      setMarketplaceMessage("");
      return;
    }
    setListingSaving(true);
    setMarketplaceMessage("");
    try {
      let imageUrl = "";
      if (listingImageFile) {
        imageUrl = await fileToDataUrl(listingImageFile);
      } else if (listingImagePreviewUrl) {
        imageUrl = String(listingImagePreviewUrl).trim();
      }
      const payload = {
        title: listingForm.title.trim(),
        description: listingForm.description.trim(),
        priceCents: Math.round(pesos * 100),
        quantity: qtyNum,
        categories: String(listingForm.categories).trim(),
        verticalId: String(listingForm.categories).trim(),
        ...(listingForm.subId && listingForm.subId !== "all" ? { subId: listingForm.subId } : {}),
        fulfillmentModes: modes,
        cityLabel: "",
        imageUrl,
        ...(shopCommunityId && isMemberOfOpenCommunity ? { communityId: String(shopCommunityId) } : {}),
      };
      const createRes = editingListingId
        ? await apiRequest(`/me/listings/${editingListingId}`, {
            method: "PATCH",
            token,
            body: payload,
          })
        : await apiRequest("/me/listings", {
            method: "POST",
            token,
            body: payload,
          });
      const [listRes, sumRes] = await Promise.all([
        apiRequest("/me/listings", { token }),
        apiRequest("/me/seller/summary", { token }),
      ]);
      const latestListings = listRes.listings || [];
      setSellerListings(latestListings.length ? latestListings : createRes?.listing ? [createRes.listing] : []);
      setSellerSummary(sumRes);
      setListingForm({
        title: "",
        description: "",
        pricePesos: "",
        quantity: "",
        categories: "",
        subId: "all",
        pickup: false,
        delivery: false,
      });
      setListingFieldErrors({});
      setListingImageFile(null);
      if (listingImagePreviewUrl && listingImagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(listingImagePreviewUrl);
      setListingImagePreviewUrl("");
      setEditingListingId(null);
      setMarketplaceMessage("");
      setPublishFlash("");
      setSellerTab(SELLER_TABS.PRODUCTS);
      setActiveView(VIEWS.PROFILE);
      navigate("/", { replace: true });
    } catch (e) {
      setMarketplaceMessage(e.message || "Could not publish listing.");
    } finally {
      setListingSaving(false);
    }
  };

  const setListingImage = (file) => {
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      setMarketplaceMessage("Please choose an image file.");
      return;
    }
    const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_LISTING_IMAGE_BYTES) {
      setMarketplaceMessage("Image is too large. Please choose one smaller than 5MB.");
      return;
    }
    if (listingImagePreviewUrl) URL.revokeObjectURL(listingImagePreviewUrl);
    setListingImageFile(file);
    setListingImagePreviewUrl(URL.createObjectURL(file));
    setMarketplaceMessage("");
  };

  const openProfileEdit = () => {
    if (!user) return;
    const parsedAddress = splitAddressParts(user.address);
    const draftBirthday = user.birthday ?? "";
    const computedAge = computeAgeFromBirthday(draftBirthday);
    setProfileDraft({
      avatarUrl: user.avatarUrl || "",
      username: user.username || user.name || "",
      firstName: user.firstName ?? "",
      middleName: user.middleName ?? "",
      lastName: user.lastName ?? "",
      email: user.email || "",
      phone: toPhilippinesLocalPhone10(user.phone),
      birthday: draftBirthday,
      age: computedAge === "" ? (user.age ? String(user.age) : "") : String(computedAge),
      community: String(user.community || "").trim(),
      addressHouseStreet: String(user.addressHouseStreet || "").trim() || parsedAddress.addressHouseStreet,
      addressSubdivision: parsedAddress.addressSubdivision,
      addressBarangay: parsedAddress.addressBarangay,
      addressCity: parsedAddress.addressCity,
      addressProvince: parsedAddress.addressProvince,
      addressCountry: "Philippines",
      addressPostalCode: parsedAddress.addressPostalCode,
      addressUrl: user.addressUrl ?? "",
      facebookUrl: user.facebookUrl ?? (user.socialPlatform === "facebook" ? user.socialUrl ?? user.url ?? "" : ""),
      twitterUrl: user.twitterUrl ?? (user.socialPlatform === "x_twitter" ? user.socialUrl ?? user.url ?? "" : ""),
      instagramUrl: user.instagramUrl ?? (user.socialPlatform === "instagram" ? user.socialUrl ?? user.url ?? "" : ""),
      gender: user.gender ?? "",
    });
    setProfileError("");
    setProfileFieldErrors({});
    setProfileSocialExpanded(false);
    setProfileEditing(true);
  };

  const cancelProfileEdit = () => {
    setProfileEditing(false);
    setProfileError("");
    setProfileFieldErrors({});
    setProfileSocialExpanded(false);
    setProfileBrgySuggestOpen(false);
    setProfileProvinceSuggestOpen(false);
    setProfileCitySuggestOpen(false);
    setProfileBarangaySuggestOpen(false);
    if (profileBrgySuggestBlurTimerRef.current) {
      clearTimeout(profileBrgySuggestBlurTimerRef.current);
      profileBrgySuggestBlurTimerRef.current = null;
    }
    if (profileProvinceSuggestBlurTimerRef.current) {
      clearTimeout(profileProvinceSuggestBlurTimerRef.current);
      profileProvinceSuggestBlurTimerRef.current = null;
    }
    if (profileCitySuggestBlurTimerRef.current) {
      clearTimeout(profileCitySuggestBlurTimerRef.current);
      profileCitySuggestBlurTimerRef.current = null;
    }
    if (profileBarangaySuggestBlurTimerRef.current) {
      clearTimeout(profileBarangaySuggestBlurTimerRef.current);
      profileBarangaySuggestBlurTimerRef.current = null;
    }
  };

  const handleProfileAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileError("Please choose an image file.");
      return;
    }
    const MAX_AVATAR_FILE_BYTES = 3 * 1024 * 1024;
    if (file.size > MAX_AVATAR_FILE_BYTES) {
      setProfileError("Image is too large. Please choose one smaller than 3MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfileDraft((prev) => ({ ...prev, avatarUrl: String(reader.result || "") }));
      setProfileError("");
    };
    reader.onerror = () => setProfileError("Could not read selected image.");
    reader.readAsDataURL(file);
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    const normalizedUsername = String(profileDraft.username || "").trim();
    const normalizedFirstName = String(profileDraft.firstName || "").trim();
    const normalizedMiddleName = String(profileDraft.middleName || "").trim();
    const normalizedLastName = String(profileDraft.lastName || "").trim();
    const normalizedGender = String(profileDraft.gender || "").trim();
    const normalizedBirthday = String(profileDraft.birthday || "").trim();
    const computedAge = computeAgeFromBirthday(normalizedBirthday);
    const normalizedHouseStreet = String(profileDraft.addressHouseStreet || "").trim();
    const normalizedSubdivision = String(profileDraft.addressSubdivision || "").trim();
    const normalizedBarangay = String(profileDraft.addressBarangay || "").trim();
    const normalizedCity = String(profileDraft.addressCity || "").trim();
    const normalizedProvince = String(profileDraft.addressProvince || "").trim();
    const normalizedPostalCode = String(profileDraft.addressPostalCode || "").trim();
    const normalizedCountry = String(profileDraft.addressCountry || "").trim();
    const nextFieldErrors = {};
    if (!normalizedUsername) {
      nextFieldErrors.username = "Username is required.";
    } else if (normalizedUsername.length < 3) {
      nextFieldErrors.username = "Username must be at least 3 characters.";
    }
    if (normalizedFirstName.length < 2) {
      nextFieldErrors.firstName = "First name must be at least 2 characters.";
    }
    if (normalizedMiddleName.length < 2) {
      nextFieldErrors.middleName = "Middle name is required.";
    }
    if (normalizedLastName.length < 2) {
      nextFieldErrors.lastName = "Last name is required.";
    }
    if (!normalizedGender) {
      nextFieldErrors.gender = "Gender is required.";
    }
    if (!normalizedBirthday) {
      nextFieldErrors.birthday = "Birthday is required.";
    } else if (normalizedBirthday > todayIsoDate) {
      nextFieldErrors.birthday = "Birthday cannot be in the future.";
    }
    if (!normalizedHouseStreet) nextFieldErrors.addressHouseStreet = "House Number & Street is required.";
    if (!normalizedSubdivision) nextFieldErrors.addressSubdivision = "Subdivision is required.";
    if (!normalizedProvince) nextFieldErrors.addressProvince = "Province is required.";
    if (!normalizedCity) nextFieldErrors.addressCity = "City or Municipality is required.";
    if (!normalizedBarangay) nextFieldErrors.addressBarangay = "Barangay is required.";
    if (Object.keys(nextFieldErrors).length > 0) {
      setProfileFieldErrors(nextFieldErrors);
      setProfileError("");
      return;
    }
    setProfileFieldErrors({});
    const effectiveToken = token || localStorage.getItem("quiz_token") || "";
    if (!effectiveToken) {
      setProfileError("Your session expired. Please log in again.");
      return;
    }
    const localPhone10 = toPhilippinesLocalPhone10(profileDraft.phone);
    if (!localPhone10) {
      setProfileFieldErrors((prev) => ({ ...prev, phone: "Phone number is required." }));
      setProfileError("");
      return;
    }
    if (localPhone10.length !== 10) {
      setProfileFieldErrors((prev) => ({ ...prev, phone: "Enter exactly 10 digits for mobile number." }));
      setProfileError("");
      return;
    }
    const resolvedPhone = toPhilippinesE164(profileDraft.phone);
    if (resolvedPhone) {
      try {
        const usersData = usersList.length > 0 ? { users: usersList } : await apiRequest("/users", { token: effectiveToken });
        const normalizedTarget = toPhilippinesE164(resolvedPhone);
        const myId = String(user?.id || user?._id || "");
        const duplicate = (usersData.users || []).some((u) => {
          const uid = String(u?.id || u?._id || "");
          if (myId && uid && uid === myId) return false;
          const existing = toPhilippinesE164(u?.phone || u?.mobileNumber || u?.mobile || "");
          return Boolean(existing) && existing === normalizedTarget;
        });
        if (duplicate) {
          setProfileFieldErrors((prev) => ({ ...prev, phone: "This mobile number is already in use." }));
          setProfileError("");
          return;
        }
      } catch {
        // If users lookup fails, proceed and let backend validation handle duplicates.
      }
    }
    setProfileSaving(true);
    setProfileError("");
    try {
      const resolvedAge = computedAge === "" ? (profileDraft.age ? Number(profileDraft.age) : undefined) : computedAge;
      const primarySocial = profileDraft.facebookUrl.trim()
        ? { socialPlatform: "facebook", socialUrl: profileDraft.facebookUrl.trim() }
        : profileDraft.twitterUrl.trim()
        ? { socialPlatform: "x_twitter", socialUrl: profileDraft.twitterUrl.trim() }
        : profileDraft.instagramUrl.trim()
        ? { socialPlatform: "instagram", socialUrl: profileDraft.instagramUrl.trim() }
        : { socialPlatform: "", socialUrl: "" };

      const data = await apiRequest("/auth/me", {
        method: "PATCH",
        token: effectiveToken,
        body: {
          avatarUrl: profileDraft.avatarUrl.trim(),
          username: normalizedUsername,
          firstName: normalizedFirstName,
          middleName: profileDraft.middleName.trim(),
          lastName: profileDraft.lastName.trim(),
          email: (user?.email || "").trim(),
          phone: resolvedPhone,
          birthday: profileDraft.birthday.trim() || null,
          community: profileDraft.community.trim(),
          address: buildAddressValue(profileDraft),
          addressUrl: profileDraft.addressUrl.trim(),
          facebookUrl: profileDraft.facebookUrl.trim(),
          twitterUrl: profileDraft.twitterUrl.trim(),
          instagramUrl: profileDraft.instagramUrl.trim(),
          socialPlatform: primarySocial.socialPlatform,
          socialUrl: primarySocial.socialUrl,
          age: resolvedAge,
          gender: profileDraft.gender.trim(),
        },
      });
      setUser((prev) => ({
        ...(prev || {}),
        ...(data.user || {}),
        avatarUrl: profileDraft.avatarUrl.trim(),
        username: normalizedUsername,
        firstName: normalizedFirstName,
        middleName: profileDraft.middleName.trim(),
        lastName: profileDraft.lastName.trim(),
        phone: resolvedPhone,
        birthday: profileDraft.birthday.trim() || null,
        community: profileDraft.community.trim(),
        address: buildAddressValue(profileDraft),
        addressUrl: profileDraft.addressUrl.trim(),
        facebookUrl: profileDraft.facebookUrl.trim(),
        twitterUrl: profileDraft.twitterUrl.trim(),
        instagramUrl: profileDraft.instagramUrl.trim(),
      }));
      setProfileJoinedAt(data?.user?.joinedAt || data?.user?.createdAt || data?.user?.created_at || profileJoinedAt || "");
      if (data.token) {
        setToken(data.token);
        localStorage.setItem("quiz_token", data.token);
      }
      const listToken = data.token || effectiveToken;
      try {
        const listData = await apiRequest("/me/listings", { token: listToken });
        setSellerListings(listData.listings || []);
      } catch {
        /* ignore — optional refresh after address-driven community sync */
      }
      if (activeView === VIEWS.COMMUNITY_SHOP && shopCommunityId) {
        try {
          const qs = new URLSearchParams();
          qs.set("communityId", shopCommunityId);
          if (browseVerticalId != null) {
            qs.set("verticalId", browseVerticalId);
            if (browseSubId && browseSubId !== "all") qs.set("subId", browseSubId);
          }
          const shopData = await apiRequest(`/listings?${qs.toString()}`, { token: listToken });
          setListings(shopData.listings || []);
        } catch {
          /* ignore */
        }
      }
      setProfileEditing(false);
    } catch (error) {
      setProfileError(error.message || "Could not update profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  if (!user && routeListingId) {
    return (
      <PublicListingPage
        listingId={routeListingId}
        onBack={() => navigate("/")}
        onOpenLogin={() => {
          navigate("/");
          openAuthPanel("login");
        }}
      />
    );
  }

  if (!user) {
    return (
      <div className="landing-shell">
        <header className="landing-nav">
          <div className="app-container flex h-[4.25rem] items-center justify-between gap-4 px-6 sm:px-8 lg:px-10">
            <div className="flex min-w-0 items-center">
              <QuizAppLogo />
            </div>
            <nav className="flex shrink-0 items-center gap-3 sm:gap-4" aria-label="Sign in">
              <button type="button" className="landing-btn-nav-text" onClick={() => openAuthPanel("login")}>
                Log in
              </button>
              <button type="button" className="landing-btn-nav-primary" onClick={() => openAuthPanel("signup")}>
                Sign up
              </button>
            </nav>
          </div>
        </header>

        <main>
          <div className="landing-hero-band">
            <div className="app-container px-6 sm:px-8 lg:px-12">
              <div className="relative mx-auto w-full max-w-6xl">
                <section className="relative grid min-h-[calc(100svh-5.5rem)] grid-cols-1 items-start gap-10 pb-28 pt-[200px] sm:min-h-[calc(100svh-4.25rem)] sm:gap-12 sm:pb-32 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-x-12 lg:gap-y-8 lg:pb-36 xl:gap-x-16">
              <div className="flex max-w-xl flex-col items-center gap-7 text-center sm:gap-8 lg:max-w-none lg:items-start lg:text-left">
                <div className="flex w-full flex-col gap-5 sm:gap-6">
                  <h1 className="text-balance text-[2rem] font-extrabold leading-[1.12] tracking-tight text-neutral-900 sm:text-5xl sm:leading-[1.08] dark:text-slate-50">
                    A marketplace built for <span className="text-brand-primary dark:text-brand-accent">your local community</span>
                  </h1>
                  <p className="mx-auto max-w-xl text-pretty text-lg leading-relaxed text-neutral-600 dark:text-slate-400 md:text-xl md:leading-relaxed lg:mx-0">
                    LinkMart connects neighbors for COD pickup or delivery: no in-app wallet, optional courier bids (walk, run, bike), and seller tools for stock and
                    profit.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 lg:justify-start">
                  <button type="button" className="landing-hero-cta px-10" onClick={() => openAuthPanel("signup")}>
                    Start selling locally
                  </button>
                  <button type="button" className="btn-secondary rounded-full px-8 py-3 text-sm" onClick={() => openAuthPanel("login")}>
                    Browse nearby listings
                  </button>
                </div>
                <div className="flex w-full max-w-md flex-wrap justify-center gap-x-10 gap-y-8 border-t border-neutral-200/80 pt-9 dark:border-slate-700/80 sm:max-w-lg sm:gap-x-12 lg:max-w-none lg:justify-start">
                  <div className="min-w-[5.5rem] text-center lg:text-left">
                    <span className="block text-2xl font-semibold tracking-tight text-neutral-900 dark:text-slate-100">8k+</span>
                    <span className="mt-1 block text-sm text-neutral-500 dark:text-slate-400">Local listings</span>
                  </div>
                  <div className="min-w-[5.5rem] text-center lg:text-left">
                    <span className="block text-2xl font-semibold tracking-tight text-neutral-900 dark:text-slate-100">1.2k+</span>
                    <span className="mt-1 block text-sm text-neutral-500 dark:text-slate-400">Neighborhood sellers</span>
                  </div>
                  <div className="min-w-[5.5rem] text-center lg:text-left">
                    <span className="block text-2xl font-semibold tracking-tight text-neutral-900 dark:text-slate-100">50+</span>
                    <span className="mt-1 block text-sm text-neutral-500 dark:text-slate-400">Active communities</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-center lg:justify-end lg:self-start">
                <div className="w-full max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl">
                  <LandingIllustration />
                </div>
              </div>
              <button
                type="button"
                className="absolute bottom-6 left-1/2 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-neutral-200/90 bg-white/95 text-neutral-600 shadow-md backdrop-blur-sm transition hover:border-neutral-300 hover:bg-white hover:text-neutral-900 dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white sm:bottom-8"
                aria-label="Scroll to content below"
                onClick={() => document.getElementById("landing-next-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                <ChevronDownIcon className="h-5 w-5" />
              </button>
                </section>
              </div>
            </div>
          </div>

          <div className="app-container px-6 pb-24 pt-12 sm:px-8 md:pb-32 md:pt-14 lg:px-12">
          <section
            id="landing-next-section"
            className="scroll-mt-24 px-4 py-10 sm:scroll-mt-28 sm:px-8 md:px-10 md:py-12"
          >
            <p className="mx-auto max-w-3xl text-center text-lg font-semibold leading-snug tracking-tight text-neutral-900 dark:text-slate-100 sm:text-xl">
              Everything you need to buy and sell locally in one place
            </p>
            <div className="relative mt-10">
              <button
                type="button"
                className="absolute left-0 top-[42%] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200/90 bg-white text-neutral-500 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-500 sm:left-1 md:left-2"
                aria-label="Previous categories"
                onClick={() =>
                  setLandingExamSlide((s) => (s - 1 + LANDING_EXAM_SLIDES.length) % LANDING_EXAM_SLIDES.length)
                }
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="absolute right-0 top-[42%] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200/90 bg-white text-neutral-500 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-500 sm:right-1 md:right-2"
                aria-label="Next categories"
                onClick={() => setLandingExamSlide((s) => (s + 1) % LANDING_EXAM_SLIDES.length)}
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
              <div className="mx-auto grid w-full max-w-5xl grid-cols-1 justify-items-center gap-12 px-4 sm:grid-cols-3 sm:gap-x-8 sm:gap-y-0 md:gap-x-12 md:px-6">
                {LANDING_EXAM_SLIDES[landingExamSlide].map((exam) => (
                  <div key={exam.title} className="flex w-full max-w-[20rem] flex-col items-center gap-3 text-center sm:max-w-none">
                    {exam.logo ? (
                      <div className="flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl p-2">
                        <img src={exam.logo} alt={`${exam.title} logo`} className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <div className="flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-sm font-bold tracking-tight text-brand-primary shadow-sm dark:bg-slate-800 dark:text-brand-accent sm:text-base">
                        {exam.badge}
                      </div>
                    )}
                    <h3 className="px-1 text-[15px] font-semibold leading-snug text-brand-accent sm:text-base md:whitespace-nowrap md:text-lg">{exam.title}</h3>
                    <p className="text-pretty text-sm leading-relaxed text-neutral-600 dark:text-slate-400">{exam.description}</p>
                  </div>
                ))}
              </div>
              <div className="mt-10 flex justify-center gap-2.5">
                {LANDING_EXAM_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`h-2 w-2 rounded-full transition ${i === landingExamSlide ? "bg-neutral-700 dark:bg-slate-200" : "bg-neutral-300 dark:bg-slate-600"}`}
                    aria-label={`Category slide ${i + 1}`}
                    aria-current={i === landingExamSlide}
                    onClick={() => setLandingExamSlide(i)}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="mt-16 lg:mt-24">
            <h2 className="mx-auto max-w-3xl text-center text-2xl font-bold tracking-tight text-neutral-900 dark:text-slate-100 md:text-3xl">
              The easiest way to trade inside your community
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-12 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-8 xl:gap-14">
              <div className="order-2 flex max-w-lg flex-col gap-12 justify-self-center lg:order-1 lg:justify-self-end">
                <LandingFeatureRow {...LANDING_FEATURE_ROWS[0]} />
                <LandingFeatureRow {...LANDING_FEATURE_ROWS[1]} />
              </div>
              <div className="order-1 flex justify-center px-4 lg:order-2 lg:px-2">
                <img
                  src={heroStudyImage}
                  alt="Marketplace platform features"
                  className="h-auto w-full max-w-[280px] object-contain drop-shadow-lg md:max-w-[320px] lg:max-w-[340px]"
                />
              </div>
              <div className="order-3 flex max-w-lg flex-col gap-12 justify-self-center lg:justify-self-start">
                <LandingFeatureRow {...LANDING_FEATURE_ROWS[2]} />
              </div>
            </div>
          </section>

          <section className="mt-16 border-t border-neutral-200/90 pt-16 text-center dark:border-slate-700 md:mt-24 md:pt-20">
            <h2 className="mx-auto max-w-2xl text-2xl font-bold tracking-tight text-neutral-900 dark:text-slate-100 md:text-3xl">Start buying and selling with people nearby</h2>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-neutral-600 dark:text-slate-400 md:mt-6">
              Discover trusted local deals, post your items, and connect with your community in just a few taps.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
              <button type="button" className="landing-hero-cta min-w-[12rem] px-10" onClick={() => openAuthPanel("signup")}>
                Create free account
              </button>
              <button type="button" className="btn-secondary min-w-[12rem] rounded-full px-8 py-3 text-sm" onClick={() => openAuthPanel("login")}>
                Log in
              </button>
            </div>
          </section>
          </div>

          <LandingSiteFooter />
        </main>

        {authPanelVisible && (
          <div
            className="landing-auth-modal-root fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
          >
            <button
              type="button"
              className="landing-auth-modal-backdrop absolute inset-0 bg-neutral-900/45 backdrop-blur-[3px] dark:bg-black/55"
              aria-label="Close sign-in dialog"
              onClick={closeAuthPanel}
            />
            <div className="landing-auth-panel relative z-10 w-full max-w-[26rem]" onClick={(event) => event.stopPropagation()}>
              <div className="landing-card relative">
                <button type="button" className="landing-auth-close" onClick={closeAuthPanel} aria-label="Close">
                  <span aria-hidden="true">×</span>
                </button>
                <div className="mb-8 pr-10">
                  <h2 id="auth-modal-title" className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-slate-100 md:text-[1.65rem]">
                    {authMode === "signup" ? "Create an account" : "Welcome back"}
                  </h2>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-600 dark:text-slate-400 md:text-[15px] md:leading-relaxed">
                    {authMode === "signup"
                      ? "Create your account to post items, manage listings, and connect with buyers in your community."
                      : "Sign in with email or Google to continue buying and selling in your local area."}
                  </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-5">
                <>
                  <div>
                    <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-slate-300">
                      Email
                    </label>
                    <input
                      id="auth-email"
                      name="email"
                      className="landing-input"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-slate-300">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="auth-password"
                        name="password"
                        className="landing-input pr-11"
                        type={showAuthPassword ? "text" : "password"}
                        placeholder="At least 8 characters"
                        minLength={8}
                        autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                        value={form.password}
                        onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus:ring-2 focus:ring-brand-primary/35 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                        onClick={() => setShowAuthPassword((prev) => !prev)}
                        aria-label={showAuthPassword ? "Hide password" : "Show password"}
                        aria-pressed={showAuthPassword}
                        tabIndex={0}
                      >
                        {showAuthPassword ? <EyeHidePasswordIcon /> : <EyeShowPasswordIcon />}
                      </button>
                    </div>
                  </div>
                  {authMode === "signup" && (
                    <>
                      <div>
                        <label htmlFor="auth-confirm-password" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-slate-300">
                          Confirm password
                        </label>
                        <div className="relative">
                          <input
                            id="auth-confirm-password"
                            name="confirmPassword"
                            className="landing-input pr-11"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Re-enter your password"
                            minLength={8}
                            autoComplete="new-password"
                            value={form.confirmPassword}
                            onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                            required
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus:ring-2 focus:ring-brand-primary/35 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            onClick={() => setShowConfirmPassword((prev) => !prev)}
                            aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                            aria-pressed={showConfirmPassword}
                            tabIndex={0}
                          >
                            {showConfirmPassword ? <EyeHidePasswordIcon /> : <EyeShowPasswordIcon />}
                          </button>
                        </div>
                      </div>
                      <label className="flex items-start gap-2.5 rounded-xl border border-neutral-200/80 bg-neutral-50/70 px-3 py-2.5 text-sm text-neutral-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                        <input
                          type="checkbox"
                          name="acceptedTerms"
                          className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary/35 dark:border-slate-500"
                          checked={form.acceptedTerms}
                          onChange={(e) => setForm((prev) => ({ ...prev, acceptedTerms: e.target.checked }))}
                          required
                        />
                        <span>
                          I accept the{" "}
                          <a href="#" className="font-semibold text-neutral-900 underline dark:text-slate-100">
                            Terms of Use
                          </a>{" "}
                          and{" "}
                          <a href="#" className="font-semibold text-neutral-900 underline dark:text-slate-100">
                            Privacy Policy
                          </a>
                          .
                        </span>
                      </label>
                    </>
                  )}
                </>
                {message && (
                  <p className="app-alert-error" role="alert">
                    {message}
                  </p>
                )}
                <button type="submit" className="landing-btn-primary" disabled={authLoading}>
                  {authLoading
                    ? authMode === "signup"
                      ? "Creating account…"
                      : "Signing in…"
                    : authMode === "signup"
                      ? "Create account"
                      : "Log in"}
                </button>
                </form>

                {authMode !== "signup" && (
                  <>
                    <div className="my-6 flex items-center gap-3">
                      <span className="h-px flex-1 bg-neutral-200 dark:bg-slate-600" />
                      <span className="text-xs font-medium uppercase tracking-wide text-neutral-600 dark:text-slate-400">or</span>
                      <span className="h-px flex-1 bg-neutral-200 dark:bg-slate-600" />
                    </div>

                    <div className="flex flex-col items-center gap-3">
                      {GOOGLE_CLIENT_ID ? (
                        <div
                          className="flex min-h-[44px] w-full max-w-[320px] justify-center [&>div]:w-full [&>div]:flex [&>div]:justify-center"
                          ref={googleBtnRef}
                        />
                      ) : (
                        <p className="text-center text-xs text-neutral-500 dark:text-slate-400">
                          Add{" "}
                          <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px] text-neutral-700 dark:bg-slate-800 dark:text-slate-200">VITE_GOOGLE_CLIENT_ID</code>{" "}
                          for Google sign-in.
                        </p>
                      )}
                    </div>
                  </>
                )}

                <p className="mt-8 text-center text-sm text-neutral-600 dark:text-slate-400">
                  {authMode === "signup" ? (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        className="landing-link"
                        onClick={() => {
                          setAuthMode("login");
                          setMessage("");
                          setShowAuthPassword(false);
                          setShowConfirmPassword(false);
                          setForm((prev) => ({ ...prev, confirmPassword: "" }));
                        }}
                      >
                        Log in
                      </button>
                    </>
                  ) : (
                    <>
                      New here?{" "}
                      <button
                        type="button"
                        className="landing-link"
                        onClick={() => {
                          setAuthMode("signup");
                          setMessage("");
                          setShowAuthPassword(false);
                          setShowConfirmPassword(false);
                        }}
                      >
                        Create account
                      </button>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app dark:bg-slate-950">
      {publishFlash ? (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-1/2 top-[4.75rem] z-[60] w-[min(100vw-2rem,26rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-emerald-200/80 bg-white/95 shadow-[0_22px_50px_-14px_rgba(5,150,105,0.35),0_8px_16px_-8px_rgba(15,23,42,0.12)] backdrop-blur-xl ring-1 ring-emerald-500/[0.08] transition-[opacity,transform] duration-[350ms] ease-out dark:border-emerald-500/25 dark:bg-slate-900/95 dark:shadow-[0_22px_50px_-14px_rgba(0,0,0,0.55),0_0_0_1px_rgba(16,185,129,0.12)] dark:ring-emerald-400/10 ${publishFlashExiting ? "pointer-events-none translate-y-[-6px] opacity-0" : "translate-y-0 opacity-100"}`}
        >
          <div className="relative flex items-start gap-3 px-4 pb-3 pt-4 sm:gap-3.5 sm:px-5 sm:pb-3.5 sm:pt-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-white/25 dark:ring-emerald-400/20">
              <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">Published</p>
              <p className="mt-1 text-[15px] font-medium leading-snug tracking-tight text-neutral-800 dark:text-slate-100">{publishFlash}</p>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-transparent text-neutral-400 transition hover:border-neutral-200 hover:bg-neutral-100 hover:text-neutral-700 dark:text-slate-500 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Dismiss notification"
              onClick={dismissPublishFlash}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="relative h-1 overflow-hidden bg-emerald-100/90 dark:bg-emerald-950/80">
            <div
              className="publish-toast-progress h-full w-full rounded-none bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-400 dark:to-teal-400"
              style={{ animationDuration: `${PUBLISH_TOAST_DURATION_MS}ms` }}
            />
          </div>
        </div>
      ) : null}
      <LoggedInHeader
        user={user}
        activeView={activeView}
        setActiveView={setActiveView}
        goBrowse={goBrowse}
        goOrders={goOrders}
        goMyPurchases={goMyPurchases}
        goCart={goCart}
        theme={theme}
        setTheme={setTheme}
        onLogout={logout}
        getDisplayNameFromUser={getDisplayNameFromUser}
        onNavigateHome={() => navigate("/")}
        communityShopName={
          showCommunityShopHeaderStrip ? toTitleCase(activeCommunity?.name?.trim()) || "Community" : null
        }
        onLeaveCommunityShop={
          showCommunityShopHeaderStrip ? leaveCommunityToGlobalMarketplace : undefined
        }
      />

      <main className="app-container space-y-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] max-sm:pt-4 md:space-y-6 md:py-8 md:pb-24 lg:pb-12">
        {marketplaceMessage && activeView !== VIEWS.MY_LISTINGS ? (
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
            role="status"
          >
            <span>{marketplaceMessage}</span>
            <button type="button" className="text-xs font-semibold text-amber-800 underline dark:text-amber-200" onClick={() => setMarketplaceMessage("")}>
              Dismiss
            </button>
          </div>
        ) : null}

        {isBrowseLikeView && activeView !== VIEWS.FAVORITES && (
          <section className={`${UI_KIT.viewSection} space-y-4 md:space-y-6`}>
            <div className="space-y-4">
              {activeView === VIEWS.COMMUNITY_SHOP ? (
                <div className={`${UI_KIT.surfaceRaised} p-4 sm:p-5`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-neutral-300/80 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                      onClick={() => leaveCommunityToGlobalMarketplace()}
                    >
                      ← All communities
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      {activeCommunity?.createdBy && String(activeCommunity.createdBy) === String(user?.id || "") ? (
                        <button
                          type="button"
                          className="inline-flex items-center rounded-full border border-neutral-300/80 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                          onClick={() => openEditCommunityModal(activeCommunity)}
                        >
                          Edit community
                        </button>
                      ) : null}
                      {!isMemberOfOpenCommunity ? (
                        <button
                          type="button"
                          className="inline-flex items-center rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary/90 dark:bg-brand-accent dark:text-slate-900 dark:hover:bg-brand-accent/90"
                          onClick={async () => {
                            await joinCommunityAndAttachListings(activeCommunity);
                            setMarketplaceMessage("");
                            setShopCommunityId(activeCommunity?.id || null);
                            setActiveView(VIEWS.COMMUNITY_SHOP);
                            navigate("/", { replace: true });
                          }}
                        >
                          Join community
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex items-center rounded-full border border-rose-300/80 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-400 hover:bg-rose-50 dark:border-rose-500/50 dark:bg-slate-900 dark:text-rose-300 dark:hover:border-rose-400 dark:hover:bg-rose-950/30"
                          onClick={() => {
                            applyJoinedCommunity("");
                            setMarketplaceMessage("");
                            leaveCommunityToGlobalMarketplace();
                          }}
                        >
                          Leave
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-slate-100 sm:text-2xl">
                      {toTitleCase(activeCommunity?.name?.trim()) || "Community"}
                    </h2>
                    {activeCommunityLocaleLine ? (
                      <p className="mt-1.5 text-sm text-neutral-600 dark:text-slate-400">
                        {activeCommunityLocaleLine}
                      </p>
                    ) : null}
                    <div className="mt-3">
                      {isMemberOfOpenCommunity ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/80 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                          ● Joined member
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-300/80 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                          ○ Not a member yet
                        </span>
                      )}
                    </div>
                    <p className="mt-3 max-w-prose text-sm leading-relaxed text-neutral-600 dark:text-slate-400">
                      Listings in this shop are visible to this community only. Use the top navigation for orders, profile, and the rest of the app.
                    </p>
                    {!isMemberOfOpenCommunity ? (
                      <p className="mt-3 max-w-prose rounded-xl border border-sky-200/90 bg-sky-50/80 px-3.5 py-2.5 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
                        Since you are not a member yet, your products will not appear in this community yet.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : activeView === VIEWS.FAVORITES ? null : (
                <>
                  <div>
                    <h2 className="whitespace-nowrap text-2xl font-semibold text-neutral-900 dark:text-slate-100">Marketplace</h2>
                  </div>
                  <div className={`${UI_KIT.surfaceCard} p-4`}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-brand-primary sm:text-base">Communities</p>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-slate-400 sm:text-base">
                      LinkMart is a neighborhood marketplace where members can discover local products, join community shops, and buy with COD pickup or delivery.
                    </p>
                  </div>
                </div>
                {communitiesError ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{communitiesError}</p> : null}
                {communitiesLoading && communities.length === 0 ? (
                  <p className="mt-3 text-sm text-neutral-600 dark:text-slate-400">Loading communities…</p>
                ) : null}
                <ul
                  className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-2"
                  aria-label="Communities"
                >
                  {!(communitiesLoading && communities.length === 0) && communities.length === 0 ? (
                    <li className="col-span-full min-w-0 text-sm text-neutral-600 dark:text-slate-400">
                      No communities available right now.
                    </li>
                  ) : null}
                  {communities.map((c) => {
                    const g = gradientForId(c.id);
                    const initials = initialsFromName(c.name);
                    return (
                      <li key={c.id} className="min-w-0">
                        <div className="flex h-full flex-col gap-2 rounded-xl border border-neutral-200/90 bg-neutral-50/40 p-2.5 dark:border-slate-600 dark:bg-slate-800/50 sm:p-3">
                          <button
                            type="button"
                            className="group flex w-full flex-col gap-2 text-left transition hover:opacity-95"
                            onClick={() => {
                              setShopCommunityId(c.id);
                              setActiveView(VIEWS.COMMUNITY_SHOP);
                              navigate("/", { replace: true });
                            }}
                          >
                            <div className="relative aspect-[4/3] overflow-hidden rounded-lg shadow-inner ring-1 ring-black/5 transition group-hover:ring-brand-primary/30 dark:ring-white/10 sm:aspect-[16/9]">
                              {c.imageUrl ? (
                                <img src={c.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                              ) : (
                                <div
                                  className="flex h-full w-full items-center justify-center text-lg font-bold tracking-tight text-white sm:text-2xl"
                                  style={{ backgroundImage: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                                  aria-hidden
                                >
                                  {initials}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 px-0.5">
                              <p className="truncate text-base font-semibold text-neutral-900 dark:text-slate-100 sm:text-lg">
                                {toTitleCase(String(c.name || "").trim())}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-sm text-neutral-600 dark:text-slate-400">
                                {formatCommunityMarketplaceSubtitle(c)}
                              </p>
                              <p className="mt-0.5 text-sm text-neutral-600 dark:text-slate-400">
                                Members:{" "}
                                <span className="font-medium text-neutral-800 dark:text-slate-200">
                                  {getDisplayedMemberCount(c.id, c.memberCount)}
                                </span>
                              </p>
                            </div>
                          </button>
                          <div className="mt-1 flex items-center gap-2 px-0.5">
                            {String(listingCommunityFromProfile.id || "") === String(c.id) ? (
                              <span className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                                Joined
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                onClick={async () => {
                                  await joinCommunityAndAttachListings(c);
                                  setMarketplaceMessage("");
                                  setShopCommunityId(c.id);
                                  setActiveView(VIEWS.COMMUNITY_SHOP);
                                  navigate("/", { replace: true });
                                }}
                              >
                                Join
                              </button>
                            )}
                            <button
                              type="button"
                              className="rounded-md bg-brand-primary px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-primary/90 dark:bg-brand-accent dark:text-slate-900 dark:hover:bg-brand-accent/90"
                              onClick={() => {
                                setShopCommunityId(c.id);
                                setActiveView(VIEWS.COMMUNITY_SHOP);
                                navigate("/", { replace: true });
                              }}
                            >
                              View
                            </button>
                          </div>
                          {c.googleUrl ? (
                            <a
                              href={c.googleUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-0.5 text-xs font-medium text-brand-primary underline decoration-brand-primary/35 underline-offset-2 hover:text-brand-primary/80"
                            >
                              Open in Google Maps
                            </a>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
                </>
              )}
            </div>
            {(activeView === VIEWS.COMMUNITY_SHOP || activeView === VIEWS.FAVORITES) ? (
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
              {mobileCommunityFiltersOpen ? (
                <button
                  type="button"
                  className="fixed inset-0 z-[90] bg-neutral-900/45 backdrop-blur-[1px] lg:hidden"
                  aria-label="Close filters"
                  onClick={() => setMobileCommunityFiltersOpen(false)}
                />
              ) : null}
              <aside
                className={`order-1 space-y-3 p-3 shadow-sm transition-transform duration-300 ease-out sm:space-y-4 sm:p-4 lg:order-none lg:sticky lg:top-24 lg:rounded-2xl lg:border lg:border-neutral-200/80 lg:bg-neutral-50/40 dark:lg:border-slate-600 dark:lg:bg-slate-900/50 ${
                  mobileCommunityFiltersOpen
                    ? "fixed inset-y-0 left-0 z-[95] w-[88vw] max-w-[21rem] overflow-y-auto rounded-r-2xl border-r border-neutral-200 bg-white/98 pt-[max(0.6rem,env(safe-area-inset-top))] shadow-[0_20px_60px_rgba(15,23,42,0.28)] translate-x-0 dark:border-slate-700 dark:bg-slate-900/98"
                    : "fixed inset-y-0 left-0 z-[95] w-[88vw] max-w-[21rem] overflow-y-auto rounded-r-2xl border-r border-neutral-200 bg-white/98 pt-[max(0.6rem,env(safe-area-inset-top))] shadow-[0_20px_60px_rgba(15,23,42,0.28)] -translate-x-full dark:border-slate-700 dark:bg-slate-900/98"
                } lg:static lg:z-auto lg:w-auto lg:max-w-none lg:translate-x-0 lg:overflow-visible`}
              >
                  <div className="sticky top-0 z-10 mb-2 flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white/95 px-3 py-2 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 lg:hidden">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-slate-100">Filters</p>
                      <p className="text-[11px] text-neutral-500 dark:text-slate-400">Browse and categories</p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                      aria-label="Close filters drawer"
                      onClick={() => setMobileCommunityFiltersOpen(false)}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 px-0.5 text-xs font-semibold text-neutral-500 dark:text-slate-400 sm:mb-2">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h7v6H3zM14 5h7v6h-7zM14 14h7v6h-7zM3 14h7v6H3z" />
                      </svg>
                      Browse
                    </p>
                    <div className="grid grid-cols-1 gap-2 lg:flex lg:flex-col lg:gap-1.5">
                    {BROWSE_QUICK_FILTERS.map((filter) => (
                      <FilterOptionButton
                        key={filter.id}
                        active={browseQuickFilter === filter.id}
                        icon={quickFilterIcon(filter.id)}
                        label={filter.label}
                        onClick={() => {
                          if (filter.id === "all") {
                            setBrowseVerticalId(null);
                            setBrowseSubId(null);
                            setBrowseQuickFilter("all");
                            setSelectedListingId(null);
                            navigate("/", { replace: true });
                            setActiveView((prev) => (prev === VIEWS.FAVORITES ? VIEWS.FAVORITES : VIEWS.COMMUNITY_SHOP));
                            setMobileCommunityFiltersOpen(false);
                            return;
                          }
                          setBrowseQuickFilter(filter.id);
                          setSelectedListingId(null);
                          setMobileCommunityFiltersOpen(false);
                        }}
                      />
                    ))}
                    </div>
                  </div>
                  <div className="border-t border-neutral-200/80 pt-3 dark:border-slate-700 sm:pt-4">
                    <p className="mb-1.5 flex items-center gap-1.5 px-0.5 text-xs font-semibold text-neutral-500 dark:text-slate-400 sm:mb-2">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      Categories
                    </p>
                    <div className="flex flex-col gap-1 pr-0.5">
                    {VERTICALS.map((v) => {
                      const allSub = v.subs.find((s) => s.id === "all") ?? v.subs[0];
                      const isActive = browseVerticalId === v.id;
                      return (
                        <FilterOptionButton
                          key={v.id}
                          active={isActive}
                          icon={categoryIcon(v.id || v.label)}
                          label={v.label}
                          onClick={() => {
                            pickBrowseScope(v.id, allSub?.id ?? null);
                            setMobileCommunityFiltersOpen(false);
                          }}
                        />
                      );
                    })}
                    </div>
                  </div>
                </aside>
              <div className="order-2 min-w-0 space-y-3 sm:space-y-4 lg:order-none">
                {activeView === VIEWS.FAVORITES ? (
                  <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">My Favorites</h2>
                ) : null}
                <div className="lg:hidden">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-neutral-300/90 bg-white px-3.5 py-2.5 text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    onClick={() => setMobileCommunityFiltersOpen(true)}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
                    </svg>
                    Browse & Categories
                  </button>
                </div>
                <div className={`${UI_KIT.surfaceMuted} flex flex-wrap items-center justify-between gap-2 px-3 py-2.5`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">Active</span>
                    {activeBrowseFilterSummary.length ? (
                      activeBrowseFilterSummary.map((item) => (
                        <span key={item} className={UI_KIT.chipActive}>
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className={UI_KIT.chipMuted}>No filters</span>
                    )}
                  </div>
                  {(browseQuickFilter !== "all" || browseVerticalId != null || browseSubId != null) && (
                    <button
                      type="button"
                      className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                      onClick={() => {
                        setBrowseVerticalId(null);
                        setBrowseSubId(null);
                        setBrowseQuickFilter("all");
                      }}
                    >
                      Reset filters
                    </button>
                  )}
                </div>
                {listingDetail && selectedListingId ? (
                  <div className="space-y-4 rounded-xl border border-brand-primary/25 bg-brand-soft/20 p-4 dark:border-slate-600 dark:bg-slate-900/50">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-slate-100">{listingDetail.title}</h3>
                      <button type="button" className="btn-secondary text-xs" onClick={closeListingDetail}>
                        Close
                      </button>
                    </div>
                    <p className="text-xl font-bold text-brand-primary">{formatCents(listingDetail.priceCents)}</p>
                    <div className="text-sm text-neutral-600 dark:text-slate-400">
                      <p>Quantity: {Number(listingDetail.quantity) || 0}</p>
                      <p className="mt-0.5">Availability: {listingCodAvailabilityLabel(listingDetail.fulfillmentModes)}</p>
                    </div>
                    {listingDetail.cityLabel ? (
                      <p className="text-sm text-neutral-600 dark:text-slate-400">{listingDetail.cityLabel}</p>
                    ) : null}
                    <p className="min-w-0 break-words text-xs text-neutral-500 dark:text-slate-400">
                      Share this listing:{" "}
                      <span className="inline-block max-w-full break-all font-mono text-[11px]">
                        {typeof window !== "undefined" ? `${window.location.origin}/l/${listingDetail.id}` : ""}
                      </span>
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-slate-300">{listingDetail.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium ${favoriteIds.has(listingDetail.id) ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200" : "border-neutral-200 dark:border-slate-600"}`}
                        onClick={() => toggleFavorite(listingDetail.id, !favoriteIds.has(listingDetail.id))}
                      >
                        {favoriteIds.has(listingDetail.id) ? "Saved" : "Save to favorites"}
                      </button>
                    </div>
                    {listingDetail.sellerId !== user?.id ? (
                      <OrderPlacementForm
                        listing={listingDetail}
                        token={token}
                        onDone={(msg) => {
                          setMarketplaceMessage(msg);
                          goMyPurchases();
                        }}
                        onError={(m) => setMarketplaceMessage(m)}
                      />
                    ) : (
                      <p className="text-sm text-neutral-600 dark:text-slate-400">This is your listing.</p>
                    )}
                  </div>
                ) : null}
                {activeView === VIEWS.FAVORITES ? (
                  favoritesLoading && strictFavoritesList.length === 0 ? (
                    <div className={`${UI_KIT.surfaceMuted} flex min-h-[12rem] items-center justify-center`}>
                      <p className="text-sm font-medium text-neutral-600 dark:text-slate-400">Loading…</p>
                    </div>
                  ) : null
                ) : listingsLoading && listings.length === 0 ? (
                  <div className={`${UI_KIT.surfaceMuted} flex min-h-[12rem] items-center justify-center`}>
                    <p className="text-sm font-medium text-neutral-600 dark:text-slate-400">Loading listings…</p>
                  </div>
                ) : null}
                {activeView === VIEWS.FAVORITES ? null : listingsError ? <p className="app-alert-error text-sm">{listingsError}</p> : null}
                {(activeView === VIEWS.FAVORITES
                  ? !(favoritesLoading && strictFavoritesList.length === 0)
                  : !listingsError && !(listingsLoading && listings.length === 0)) ? (
                  <div className="flex justify-end">
                    <div className="inline-flex items-center rounded-lg border border-neutral-200/90 bg-white p-1 dark:border-slate-600 dark:bg-slate-900">
                      <button
                        type="button"
                        className={`rounded-md p-1.5 transition ${communityProductsView === "list" ? "bg-brand-soft text-brand-primary dark:bg-slate-800 dark:text-slate-100" : "text-neutral-600 hover:bg-neutral-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
                        aria-label="List view"
                        onClick={() => setCommunityProductsView("list")}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`rounded-md p-1.5 transition ${communityProductsView === "grid" ? "bg-brand-soft text-brand-primary dark:bg-slate-800 dark:text-slate-100" : "text-neutral-600 hover:bg-neutral-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
                        aria-label="Grid view"
                        onClick={() => setCommunityProductsView("grid")}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <rect x="3" y="3" width="7" height="7" rx="1" />
                          <rect x="14" y="3" width="7" height="7" rx="1" />
                          <rect x="3" y="14" width="7" height="7" rx="1" />
                          <rect x="14" y="14" width="7" height="7" rx="1" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : null}
                {(activeView === VIEWS.FAVORITES
                  ? !(favoritesLoading && strictFavoritesList.length === 0) && visibleFavoritesListings.length > 0
                  : !listingsError && visibleBrowseListings.length > 0) ? (
                  <div className={communityProductsView === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3"}>
                    {(activeView === VIEWS.FAVORITES ? visibleFavoritesListings : visibleBrowseListings).map((l) => (
                      <CommunityShopListingCard
                        key={l.id}
                        listing={l}
                        gridMode={communityProductsView === "grid"}
                        isFavorite={favoriteIds.has(l.id)}
                        showActions
                        currentUserId={user?.id || ""}
                        onSaleSelect={(percent) => applySellerListingDiscount(l, percent)}
                        onEdit={() => beginEditSellerListing(l)}
                        onBuy={() => setSelectedListingId(l.id)}
                        onAdd={() => openQuickAddModal(l)}
                        onToggleFavorite={() => toggleFavorite(l.id, !favoriteIds.has(l.id))}
                      />
                    ))}
                  </div>
                ) : null}
                {(activeView === VIEWS.FAVORITES
                  ? !(favoritesLoading && strictFavoritesList.length === 0) && visibleFavoritesListings.length === 0
                  : !listingsError && !(listingsLoading && listings.length === 0) && visibleBrowseListings.length === 0) ? (
                  <div className={`${UI_KIT.surfaceRaised} flex flex-col items-center justify-center border-dashed px-4 py-10 text-center sm:px-6 sm:py-14`}>
                    <p className="text-base font-semibold text-neutral-900 dark:text-slate-100 sm:text-lg">No listings to show</p>
                    <p className="mt-2 max-w-md text-xs leading-relaxed text-neutral-600 dark:text-slate-400 sm:text-sm">
                      {activeView === VIEWS.FAVORITES
                        ? strictFavoritesList.length === 0
                          ? "No favorites yet. Use the heart on product cards to save items."
                          : browseVerticalId == null
                            ? "No saved items match this browse filter. Try All or another filter."
                            : "No favorites in this category yet. Try another category or reset filters."
                        : shopCommunityId
                          ? browseVerticalId == null
                            ? "Nothing has been posted in this community shop yet. Publish while this community is open, or match your profile address to this community."
                            : "No active listings in this category here yet. Try another category, or add a listing under My listings for this community."
                          : browseVerticalId == null
                            ? "No active listings yet."
                            : "No active listings in this category yet."}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            ) : null}
          </section>
        )}

        {activeView === VIEWS.MESSAGES && (
          <section className={`${UI_KIT.viewSection} space-y-4 md:space-y-6`}>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Messages</h2>
            <p className="text-sm text-neutral-600 dark:text-slate-400">
              Chat with buyers and sellers in one inbox. Threading, attachments, and read receipts will ship when messaging is connected to the backend.
            </p>
            <div className={`${UI_KIT.surfaceMuted} border-dashed p-8 text-center md:p-10`}>
              <p className="text-sm font-medium text-neutral-700 dark:text-slate-300">Messaging — coming soon</p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">
                You will see conversations and new-message alerts here once the feature is live.
              </p>
            </div>
          </section>
        )}

        {activeView === VIEWS.NOTIFICATIONS && (
          <section className={`${UI_KIT.viewSection} space-y-4 md:space-y-6`}>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Notifications</h2>
            <p className="text-sm text-neutral-600 dark:text-slate-400">
              Order updates, delivery status, and marketplace alerts will appear here once notifications are wired to the backend.
            </p>
            <div className={`${UI_KIT.surfaceMuted} border-dashed p-8 text-center md:p-10`}>
              <p className="text-sm font-medium text-neutral-700 dark:text-slate-300">No notifications yet</p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">You are all caught up for now.</p>
            </div>
          </section>
        )}

        {activeView === VIEWS.FAVORITES && (
          <section className={`${UI_KIT.viewSection} space-y-4 md:space-y-6`}>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">My Favorites</h2>
            {favoritesLoading && strictFavoritesList.length === 0 ? (
              <p className="text-sm text-neutral-600 dark:text-slate-400">Loading…</p>
            ) : null}
            {!(favoritesLoading && strictFavoritesList.length === 0) && strictFavoritesList.length === 0 ? (
              <div className={`${UI_KIT.surfaceMuted} border-dashed p-8 text-center md:p-10`}>
                <p className="text-sm font-medium text-neutral-700 dark:text-slate-300">No favorites yet</p>
                <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">Use the heart on Browse cards to save items.</p>
              </div>
            ) : null}
            {strictFavoritesList.length > 0 ? (
              <>
                <div className="flex justify-end">
                  <div className="inline-flex items-center rounded-lg border border-neutral-200/90 bg-white p-1 dark:border-slate-600 dark:bg-slate-900">
                    <button
                      type="button"
                      className={`rounded-md p-1.5 transition ${communityProductsView === "list" ? "bg-brand-soft text-brand-primary dark:bg-slate-800 dark:text-slate-100" : "text-neutral-600 hover:bg-neutral-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
                      aria-label="List view"
                      onClick={() => setCommunityProductsView("list")}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={`rounded-md p-1.5 transition ${communityProductsView === "grid" ? "bg-brand-soft text-brand-primary dark:bg-slate-800 dark:text-slate-100" : "text-neutral-600 hover:bg-neutral-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
                      aria-label="Grid view"
                      onClick={() => setCommunityProductsView("grid")}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <rect x="3" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" />
                        <rect x="14" y="14" width="7" height="7" rx="1" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className={communityProductsView === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3"}>
                  {strictFavoritesList.map((l) => (
                    <CommunityShopListingCard
                      key={l.id}
                      listing={l}
                      gridMode={communityProductsView === "grid"}
                      isFavorite={favoriteIds.has(l.id)}
                      showActions
                      currentUserId={user?.id || ""}
                      onSaleSelect={(percent) => applySellerListingDiscount(l, percent)}
                      onEdit={() => beginEditSellerListing(l)}
                      onBuy={() => setSelectedListingId(l.id)}
                      onAdd={() => openQuickAddModal(l)}
                      onToggleFavorite={() => toggleFavorite(l.id, !favoriteIds.has(l.id))}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </section>
        )}

        {activeView === VIEWS.MY_LISTINGS && (
          <section className={`${UI_KIT.viewSection} space-y-6 md:space-y-8`}>
            <SectionHeading
              title="My listings"
              subtitle="Sell to your local community. Buyers pay COD via pickup or delivery."
            />
            <form noValidate onSubmit={handleCreateListing} className={`grid gap-4 p-4 md:grid-cols-2 ${UI_KIT.surfaceMuted}`}>
              <div className="md:col-span-2">
                <div className="mb-2 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-primary dark:text-brand-accent">Photos *</p>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-slate-400">JPG/PNG/WebP up to 5MB</p>
                </div>
                <div
                  className={`flex min-h-[8.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-white/80 px-3 py-3 text-sm transition dark:bg-slate-900/60 ${
                    listingImageDragActive
                      ? "border-brand-primary text-brand-primary dark:border-brand-accent dark:text-brand-accent"
                      : listingFieldErrors.image
                        ? "border-rose-400 text-neutral-500 dark:border-rose-500 dark:text-slate-400"
                        : "border-neutral-300 text-neutral-500 dark:border-slate-600 dark:text-slate-400"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setListingImageDragActive(true);
                  }}
                  onDragLeave={() => setListingImageDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setListingImageDragActive(false);
                    const file = e.dataTransfer?.files?.[0];
                    if (file) setListingImage(file);
                  }}
                >
                  {listingImagePreviewUrl ? (
                    <>
                      <img src={listingImagePreviewUrl} alt="Selected listing" className="max-h-28 rounded-lg object-cover" />
                      <p className="text-xs text-neutral-600 dark:text-slate-400">{listingImageFile?.name || "Selected image"}</p>
                      <button
                        type="button"
                        className="rounded-lg border border-rose-300 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                        onClick={() => {
                          setListingImageFile(null);
                          if (listingImagePreviewUrl && listingImagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(listingImagePreviewUrl);
                          setListingImagePreviewUrl("");
                        }}
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <>
                      <p>Drag a photo here</p>
                      <p className="text-xs">Recommended ratio: 1:1 or 4:3</p>
                    </>
                  )}
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => listingImageInputRef.current?.click()}
                  >
                    Browse
                  </button>
                  <input
                    ref={listingImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setListingImage(file);
                    }}
                  />
                </div>
                {listingFieldErrors.image ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{listingFieldErrors.image}</p> : null}
              </div>
              <div className="md:col-span-2">
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-primary dark:text-brand-accent">Details *</p>
                <input
                  className={`input-base w-full ${listingFieldErrors.title ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-500/70 dark:focus:ring-rose-500/30" : ""}`}
                  value={listingForm.title}
                  placeholder="e.g. Preloved study table, iPhone 11 64GB, Rice cooker"
                  onChange={(e) => {
                    setListingForm((p) => ({ ...p, title: e.target.value }));
                    if (listingFieldErrors.title) setListingFieldErrors((prev) => ({ ...prev, title: "" }));
                  }}
                  minLength={2}
                />
                {listingFieldErrors.title ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{listingFieldErrors.title}</p> : null}
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-slate-300">Categories *</label>
                <select
                  className={`input-base w-full ${listingFieldErrors.categories ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-500/70 dark:focus:ring-rose-500/30" : ""}`}
                  value={listingForm.categories}
                  onChange={(e) => {
                    setListingForm((p) => ({ ...p, categories: e.target.value }));
                    if (listingFieldErrors.categories) setListingFieldErrors((prev) => ({ ...prev, categories: "" }));
                  }}
                >
                  <option value="">Select the best category for your item</option>
                  {VERTICALS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
                {listingFieldErrors.categories ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{listingFieldErrors.categories}</p> : null}
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400">Description (optional)</label>
                <textarea
                  className="input-base min-h-[5rem] w-full"
                  value={listingForm.description}
                  placeholder="Add key details buyers need: condition, size/specs, inclusions, issue disclosures, meetup area."
                  onChange={(e) => setListingForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  maxLength={500}
                />
                <p className="mt-1 text-right text-[11px] text-neutral-500 dark:text-slate-400">{listingDescriptionCount}/500</p>
              </div>
              <div className="md:col-span-2 grid grid-cols-1 gap-4 rounded-xl border border-neutral-200/80 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/65 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-primary dark:text-brand-accent">Pricing *</p>
                  <input
                    className={`input-base w-full ${listingFieldErrors.pricePesos ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-500/70 dark:focus:ring-rose-500/30" : ""}`}
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 499.00"
                    value={listingForm.pricePesos}
                    onChange={(e) => {
                      setListingForm((p) => ({ ...p, pricePesos: e.target.value }));
                      if (listingFieldErrors.pricePesos) setListingFieldErrors((prev) => ({ ...prev, pricePesos: "" }));
                    }}
                  />
                  {listingFieldErrors.pricePesos ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{listingFieldErrors.pricePesos}</p> : null}
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-slate-300">Quantity *</label>
                  <input
                    className={`input-base w-full ${listingFieldErrors.quantity ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-500/70 dark:focus:ring-rose-500/30" : ""}`}
                    type="number"
                    min={0}
                    step={1}
                    placeholder="e.g. 1, 3, 10"
                    value={listingForm.quantity}
                    onChange={(e) => {
                      setListingForm((p) => ({ ...p, quantity: e.target.value }));
                      if (listingFieldErrors.quantity) setListingFieldErrors((prev) => ({ ...prev, quantity: "" }));
                    }}
                  />
                  {listingFieldErrors.quantity ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{listingFieldErrors.quantity}</p> : null}
                </div>
              </div>
              <div className="md:col-span-2 rounded-xl border border-neutral-200/80 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/65">
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-primary dark:text-brand-accent">Fulfillment *</p>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    aria-pressed={listingForm.delivery}
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      listingForm.delivery
                        ? "border-brand-primary/45 bg-brand-soft text-brand-primary dark:border-brand-accent/45 dark:bg-slate-800 dark:text-slate-100"
                        : "border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                    onClick={() => {
                      setListingForm((p) => ({ ...p, delivery: !p.delivery }));
                      if (listingFieldErrors.fulfillment) setListingFieldErrors((prev) => ({ ...prev, fulfillment: "" }));
                    }}
                  >
                    COD Delivery
                  </button>
                  <button
                    type="button"
                    aria-pressed={listingForm.pickup}
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      listingForm.pickup
                        ? "border-brand-primary/45 bg-brand-soft text-brand-primary dark:border-brand-accent/45 dark:bg-slate-800 dark:text-slate-100"
                        : "border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                    onClick={() => {
                      setListingForm((p) => ({ ...p, pickup: !p.pickup }));
                      if (listingFieldErrors.fulfillment) setListingFieldErrors((prev) => ({ ...prev, fulfillment: "" }));
                    }}
                  >
                    Pick-up
                  </button>
                </div>
                <p className="mt-2 text-xs text-neutral-500 dark:text-slate-400">Choose how buyers can receive the item.</p>
                {listingFieldErrors.fulfillment ? <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">{listingFieldErrors.fulfillment}</p> : null}
              </div>
              <div className="md:col-span-2 sticky bottom-2 z-10 rounded-xl border border-neutral-200/80 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={listingSaving}
                  >
                    {listingSaving ? (editingListingId ? "Saving…" : "Publishing…") : editingListingId ? "Save changes" : "Publish listing"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={listingSaving}
                    onClick={() => {
                      if (listingFormDirty) {
                        const ok = typeof window === "undefined" ? true : window.confirm("Discard your unsaved listing changes?");
                        if (!ok) return;
                      }
                      setListingForm({
                        title: "",
                        description: "",
                        pricePesos: "",
                        quantity: "",
                        categories: "",
                        subId: "all",
                        pickup: false,
                        delivery: false,
                      });
                      setListingFieldErrors({});
                      setListingImageFile(null);
                      if (listingImagePreviewUrl && listingImagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(listingImagePreviewUrl);
                      setListingImagePreviewUrl("");
                      setEditingListingId(null);
                      setMarketplaceMessage("");
                      setSellerTab(SELLER_TABS.PRODUCTS);
                      setActiveView(VIEWS.PROFILE);
                      navigate("/", { replace: true });
                    }}
                  >
                    Cancel
                  </button>
                </div>
                {marketplaceMessage ? (
                  <div
                    className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
                    role="status"
                  >
                    <span>{marketplaceMessage}</span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-amber-800 underline dark:text-amber-200"
                      onClick={() => setMarketplaceMessage("")}
                    >
                      Dismiss
                    </button>
                  </div>
                ) : null}
              </div>
            </form>
          </section>
        )}

        {activeView === VIEWS.CART && (
          <section className={`${UI_KIT.viewSection} space-y-4 md:space-y-6`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Add to cart</h2>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {selectedCartItems.length > 0 ? (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-neutral-200/80 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900">
                    <span className="font-semibold text-neutral-800 dark:text-slate-200">
                      {formatCents(selectedCartTotals.currentTotalCents)}
                    </span>
                    {selectedCartTotals.originalTotalCents > selectedCartTotals.currentTotalCents ? (
                      <>
                        <span className="text-xs font-medium text-neutral-500 line-through dark:text-slate-400">
                          {formatCents(selectedCartTotals.originalTotalCents)}
                        </span>
                        {selectedCartTotals.discountPercent > 0 ? (
                          <span className="rounded-full border border-amber-300/90 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                            -{selectedCartTotals.discountPercent}%
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={cartCheckoutSubmitting || selectedCartItems.length === 0}
                  onClick={() => {
                    void checkoutSelectedCartItems();
                  }}
                >
                  {cartCheckoutSubmitting
                    ? "Checking out…"
                    : `Check out${selectedCartItems.length > 0 ? ` (${selectedCartItems.length})` : ""}`}
                </button>
              </div>
            </div>
            {cartItems.length === 0 ? (
              <div className={`${UI_KIT.surfaceMuted} border-dashed p-8 text-center md:p-10`}>
                <p className="text-sm text-neutral-600 dark:text-slate-400">Nothing here yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(
                  cartItems.reduce((acc, item) => {
                    const key = String(item.sellerId || "unknown");
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(item);
                    return acc;
                  }, {}),
                ).map(([sellerId, items]) => {
                  const rowIds = items.map((i) => String(i.listingId));
                  const selectedCount = rowIds.filter((id) => cartItemSelection[id]).length;
                  const allSelected = rowIds.length > 0 && selectedCount === rowIds.length;
                  const someSelected = selectedCount > 0 && !allSelected;
                  const sellerLabel = items[0]?.sellerLabel || "Unknown seller";
                  return (
                    <div key={sellerId} className={`${UI_KIT.surfaceCard} p-3.5`}>
                      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-neutral-200/80 pb-2 dark:border-slate-700/80">
                        <label className="inline-flex shrink-0 cursor-pointer items-center">
                          <CartSellerSelectAllCheckbox
                            allChecked={allSelected}
                            someSelected={someSelected}
                            onChange={() => toggleCartSellerSelectAll(items)}
                            ariaLabel={`Select all from ${sellerLabel}`}
                          />
                        </label>
                        <p className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-slate-300">{sellerLabel}</p>
                      </div>
                      <div className="divide-y divide-neutral-200/80 dark:divide-slate-700/80">
                        {items.map((item) => {
                          const lid = String(item.listingId);
                          return (
                            <div key={item.listingId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                              <input
                                type="checkbox"
                                className="h-4 w-4 shrink-0 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary/35 dark:border-slate-500"
                                checked={Boolean(cartItemSelection[lid])}
                                onChange={() => toggleCartListingSelected(item.listingId)}
                                aria-label={`Select ${item.title || "product"}`}
                              />
                              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-slate-700 dark:bg-slate-800">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.title || "Cart item"} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                                    No image
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <MarketplaceProductDetailStack
                                  title={item.title || "Product"}
                                  priceCents={item.unitPriceCents}
                                  description={item.description}
                                  hideDescription
                                  fulfillmentModes={item.fulfillmentModes}
                                />
                                <div className="mt-1 space-y-0.5 text-xs text-neutral-600 dark:text-slate-400">
                                  <p className="line-clamp-2 text-pretty">
                                    Description: {removeSaleMetaLines(item.description) || "No description"}
                                  </p>
                                  <p className="line-clamp-2 text-pretty">
                                    Comment: {String(item.comment || "").trim() || "N/a"}
                                  </p>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-neutral-600 dark:text-slate-400">Qty</span>
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 bg-white text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                      aria-label="Decrease quantity"
                                      disabled={cartQtySavingId === lid || (Number(item.quantity) || 0) <= 0}
                                      onClick={() => {
                                        setCartQtyEdit({ id: null, str: "" });
                                        void setCartLineQuantity(item.listingId, (Number(item.quantity) || 1) - 1);
                                      }}
                                    >
                                      −
                                    </button>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      className="input-base h-8 w-14 px-1 text-center text-xs"
                                      value={cartQtyEdit.id === lid ? cartQtyEdit.str : String(Number(item.quantity) || 1)}
                                      disabled={cartQtySavingId === lid}
                                      aria-label={`Quantity for ${item.title || "product"}`}
                                      onFocus={() => {
                                        setCartQtyEdit({
                                          id: lid,
                                          str: String(Number(item.quantity) || 1),
                                        });
                                      }}
                                      onChange={(e) => {
                                        const raw = String(e.target.value || "").replace(/\D/g, "");
                                        setCartQtyEdit({ id: lid, str: raw === "" ? "" : raw });
                                        if (!raw) return;
                                        const parsed = Number(raw);
                                        if (!Number.isFinite(parsed) || parsed < 0) return;
                                        const maxCap = Math.max(
                                          1,
                                          Number(item.listingQuantity) >= 1 ? Number(item.listingQuantity) : Number(item.quantity) || 1,
                                        );
                                        if (cartQtyCommitTimersRef.current[lid]) {
                                          clearTimeout(cartQtyCommitTimersRef.current[lid]);
                                        }
                                        cartQtyCommitTimersRef.current[lid] = setTimeout(() => {
                                          void setCartLineQuantity(item.listingId, Math.min(maxCap, parsed));
                                        }, 250);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key !== "Enter") return;
                                        e.preventDefault();
                                        const maxCap = Math.max(
                                          1,
                                          Number(item.listingQuantity) >= 1 ? Number(item.listingQuantity) : Number(item.quantity) || 1,
                                        );
                                        const str = cartQtyEdit.id === lid ? cartQtyEdit.str : String(Number(item.quantity) || 1);
                                        const parsed = Number(str);
                                        if (cartQtyCommitTimersRef.current[lid]) {
                                          clearTimeout(cartQtyCommitTimersRef.current[lid]);
                                          delete cartQtyCommitTimersRef.current[lid];
                                        }
                                        setCartQtyEdit({ id: null, str: "" });
                                        if (!Number.isFinite(parsed) || parsed < 0) {
                                          void setCartLineQuantity(item.listingId, Number(item.quantity) || 1);
                                          return;
                                        }
                                        void setCartLineQuantity(item.listingId, Math.min(maxCap, parsed));
                                      }}
                                      onBlur={() => {
                                        const maxCap = Math.max(
                                          1,
                                          Number(item.listingQuantity) >= 1 ? Number(item.listingQuantity) : Number(item.quantity) || 1,
                                        );
                                        const str = cartQtyEdit.id === lid ? cartQtyEdit.str : String(Number(item.quantity) || 1);
                                        const parsed = Number(str);
                                        if (cartQtyCommitTimersRef.current[lid]) {
                                          clearTimeout(cartQtyCommitTimersRef.current[lid]);
                                          delete cartQtyCommitTimersRef.current[lid];
                                        }
                                        setCartQtyEdit({ id: null, str: "" });
                                        if (!Number.isFinite(parsed) || parsed < 0) {
                                          void setCartLineQuantity(item.listingId, Number(item.quantity) || 1);
                                          return;
                                        }
                                        void setCartLineQuantity(item.listingId, Math.min(maxCap, parsed));
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 bg-white text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                      aria-label="Increase quantity"
                                      disabled={
                                        cartQtySavingId === lid ||
                                        (Number(item.quantity) || 0) >=
                                          Math.max(
                                            1,
                                            Number(item.listingQuantity) >= 1 ? Number(item.listingQuantity) : Number(item.quantity) || 1,
                                          )
                                      }
                                      onClick={() => {
                                        setCartQtyEdit({ id: null, str: "" });
                                        void setCartLineQuantity(item.listingId, (Number(item.quantity) || 0) + 1);
                                      }}
                                    >
                                      +
                                    </button>
                                  </div>
                                  <span className="text-[11px] text-neutral-500 dark:text-slate-500">
                                    In stock: {Number(item.listingQuantity) >= 1 ? Number(item.listingQuantity) : "—"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {(activeView === VIEWS.ORDERS || activeView === VIEWS.MY_PURCHASES) && (
          <section className={`${UI_KIT.viewSection} space-y-4 md:space-y-6`}>
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">
                {activeView === VIEWS.MY_PURCHASES ? "My purchases" : "Orders"}
              </h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-slate-400">
                {activeView === VIEWS.MY_PURCHASES
                  ? "COD only — LinkMart never holds your money. No refunds; cancel in Pending before the seller accepts, otherwise contact the seller."
                  : "Incoming buyer orders — COD at pickup or delivery. You collect payment; LinkMart never holds balances."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-2">
              <div className="flex min-w-0 flex-wrap gap-2" role="tablist" aria-label="Order status">
                {ORDERS_STATUS_TABS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={ordersStatusTab === id}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${ordersStatusTab === id ? UI_KIT.tabActive : UI_KIT.tabIdle}`}
                    onClick={() => setOrdersStatusTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {ordersStatusTab === "pending" ? (
                <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
                  <span className="inline-flex items-center rounded-lg border border-neutral-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    Selected: {selectedOrders.length}
                  </span>
                  {ordersRole === "seller" ? (
                    <button
                      type="button"
                      className="btn-secondary shrink-0 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={ordersBulkActionSubmitting || !ordersAcceptEnabled}
                      onClick={() => {
                        void applyTransitionToSelectedOrders("seller_accept", "Accepted");
                      }}
                    >
                      {ordersBulkActionSubmitting ? "Working…" : "Accept"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                    disabled={ordersBulkActionSubmitting || !ordersDeclineEnabled}
                    onClick={() => {
                      void applyTransitionToSelectedOrders("cancel", "Declined");
                    }}
                  >
                    {ordersBulkActionSubmitting ? "Working…" : "Decline"}
                  </button>
                </div>
              ) : null}
            </div>
            {ordersLoading && orders.length === 0 ? (
              <p className="text-sm text-neutral-600 dark:text-slate-400">Loading…</p>
            ) : null}
            {!(ordersLoading && orders.length === 0) && orders.length === 0 ? (
              <div className={`${UI_KIT.surfaceMuted} border-dashed p-8 text-sm text-neutral-500 dark:text-slate-400`}>You have no orders yet.</div>
            ) : null}
            {!(ordersLoading && orders.length === 0) && orders.length > 0 && ordersForStatusTab.length === 0 ? (
              <div className={`${UI_KIT.surfaceMuted} border-dashed p-8 text-sm text-neutral-500 dark:text-slate-400`}>
                No {ORDERS_STATUS_TABS.find((t) => t.id === ordersStatusTab)?.label?.toLowerCase() || ""} orders.
              </div>
            ) : null}
            {ordersForStatusTab.length > 0 ? (
              <div className="space-y-3">
                {Object.entries(
                  ordersForStatusTab.reduce((acc, order) => {
                    const sellerKey = String(order.sellerId || "unknown");
                    if (!acc[sellerKey]) acc[sellerKey] = [];
                    acc[sellerKey].push(order);
                    return acc;
                  }, {}),
                ).map(([sellerId, sellerOrders]) => {
                  const sellerUser = usersList.find((u) => String(u?.id || "") === String(sellerId || ""));
                  const usernameLabel = String(sellerUser?.username || "").trim()
                    ? `@${String(sellerUser.username).trim()}`
                    : "";
                  const orderUsernameLabel =
                    sellerOrders
                      .map((order) => {
                        const raw =
                          order?.sellerUsername ||
                          order?.seller?.username ||
                          order?.sellerName ||
                          "";
                        const normalized = String(raw || "").trim();
                        if (!normalized) return "";
                        return normalized.startsWith("@") ? normalized : `@${normalized}`;
                      })
                      .find((label) => String(label || "").trim().length > 0) || "";
                  const isCurrentUserSeller = String(sellerId || "") === String(user?.id || "");
                  const currentUserUsernameLabel = String(user?.username || "").trim()
                    ? `@${String(user.username).trim()}`
                    : "";
                  const listingSellerLabel =
                    sellerOrders
                      .map((order) => orderListingsById[String(order.listingId)]?.sellerLabel)
                      .find((label) => String(label || "").trim().length > 0) || "";
                  const looksLikeFallbackIdLabel = /^seller\s+[a-f0-9]{6,}$/i.test(String(listingSellerLabel || "").trim());
                  const sellerLabel = usernameLabel
                    ? usernameLabel
                    : orderUsernameLabel
                      ? orderUsernameLabel
                    : isCurrentUserSeller && currentUserUsernameLabel
                      ? currentUserUsernameLabel
                    : listingSellerLabel && !looksLikeFallbackIdLabel
                      ? listingSellerLabel
                      : sellerId && sellerId !== "unknown"
                        ? `Seller ${sellerId.slice(0, 8)}`
                        : "Unknown seller";
                  const sellerOrderIds = sellerOrders.map((order) => String(order.id || "")).filter(Boolean);
                  const sellerSelectedCount = sellerOrderIds.filter((id) => orderSelection[id]).length;
                  const sellerAllSelected = sellerOrderIds.length > 0 && sellerSelectedCount === sellerOrderIds.length;
                  const sellerSomeSelected = sellerSelectedCount > 0 && !sellerAllSelected;
                  return (
                    <div key={sellerId} className={`${UI_KIT.surfaceCard} p-3.5`}>
                      <div className="mb-2 flex items-center gap-2 border-b border-neutral-200/80 pb-2 dark:border-slate-700/80">
                        {ordersStatusTab === "pending" ? (
                          <CartSellerSelectAllCheckbox
                            allChecked={sellerAllSelected}
                            someSelected={sellerSomeSelected}
                            onChange={() => toggleOrderSellerSelectAll(sellerOrders)}
                            ariaLabel={`Select all orders from ${sellerLabel}`}
                          />
                        ) : null}
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-slate-300">{sellerLabel}</p>
                      </div>
                      <div className="space-y-3">
                        {sellerOrders.map((o) => {
                          const listing = orderListingsById[String(o.listingId)] || null;
                          const cardListing = listing || {
                            id: o.listingId,
                            title: `Order ${String(o.id).slice(0, 8)}`,
                            priceCents: o.codGoodsCents,
                            quantity: o.quantity,
                            fulfillmentModes: [o.fulfillmentType],
                            imageUrl: "",
                            description: "",
                            sellerId: o.sellerId,
                          };
                          const orderId = String(o.id || "");
                          return (
                            <div key={o.id} className="rounded-xl border border-neutral-200/80 bg-white/80 p-2.5 dark:border-slate-700 dark:bg-slate-900/50">
                              <div className="flex items-center gap-3">
                                {ordersStatusTab === "pending" ? (
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 shrink-0 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary/35 dark:border-slate-500"
                                    checked={Boolean(orderSelection[orderId])}
                                    onChange={() => toggleOrderSelected(orderId)}
                                    aria-label={`Select order ${orderId}`}
                                  />
                                ) : null}
                                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-slate-700 dark:bg-slate-800">
                                  {String(cardListing.imageUrl || "").trim() ? (
                                    <img src={cardListing.imageUrl} alt={cardListing.title || "Order item"} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                                      No image
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <MarketplaceProductDetailStack
                                    title={cardListing.title || "Product"}
                                    priceCents={cardListing.priceCents}
                                    description={cardListing.description}
                                    hideDescription
                                    fulfillmentModes={cardListing.fulfillmentModes}
                                  />
                                  <div className="mt-1 space-y-0.5 text-xs text-neutral-600 dark:text-slate-400">
                                    <p className="line-clamp-2 text-pretty">
                                      Description: {removeSaleMetaLines(cardListing.description) || "No description"}
                                    </p>
                                    <p className="line-clamp-2 text-pretty">Comment: N/a</p>
                                  </div>
                                  <p className="mt-1 text-xs text-neutral-600 dark:text-slate-400">
                                    Qty: <span className="font-semibold">{Number(cardListing.quantity) || 1}</span>
                                  </p>
                                </div>
                              </div>
                              <div className="mt-3 space-y-2 border-t border-neutral-200/80 pt-2 text-sm dark:border-slate-700/80">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] text-neutral-500 dark:text-slate-400">
                                    <span className="mr-1.5 font-medium text-neutral-600 dark:text-slate-300">Order ID</span>
                                    <span className="font-mono">{o.id}</span>
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-600 dark:text-slate-400">
                                  {o.fulfillmentType === "delivery" ? "Delivery" : "Pickup"} · goods {formatCents(o.codGoodsCents)}
                                  {o.codDeliveryCents > 0 ? <span> · delivery {formatCents(o.codDeliveryCents)}</span> : null}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  {ordersRole === "seller" && o.status === "placed" ? (
                                    <button type="button" className="btn-secondary text-xs" onClick={() => patchOrderTransition(o.id, "seller_accept")}>
                                      Accept order
                                    </button>
                                  ) : null}
                                  {o.status === "ready_for_pickup" ? (
                                    <button type="button" className="btn-secondary text-xs" onClick={() => patchOrderTransition(o.id, "mark_pickup_done")}>
                                      Mark pickup complete
                                    </button>
                                  ) : null}
                                  {ordersRole === "seller" && o.status === "bid_accepted" ? (
                                    <button type="button" className="btn-secondary text-xs" onClick={() => patchOrderTransition(o.id, "mark_out_for_delivery")}>
                                      Mark out for delivery
                                    </button>
                                  ) : null}
                                  {o.status === "out_for_delivery" ? (
                                    <button type="button" className="btn-secondary text-xs" onClick={() => patchOrderTransition(o.id, "mark_delivered")}>
                                      Mark delivered
                                    </button>
                                  ) : null}
                                  {o.status === "bidding_open" ? (
                                    <button type="button" className="btn-secondary text-xs" onClick={() => loadBidsForOrder(o.id)}>
                                      {expandedBidOrderId === o.id ? "Reload bids" : "View bids"}
                                    </button>
                                  ) : null}
                                </div>
                                {expandedBidOrderId === o.id && o.status === "bidding_open" ? (
                                  <ul className="mt-2 space-y-2 rounded-lg border border-neutral-200/80 bg-neutral-50/80 p-3 dark:border-slate-600 dark:bg-slate-900/50">
                                    {bidsForOrder.length === 0 ? <li className="text-xs text-neutral-500">No bids yet.</li> : null}
                                    {bidsForOrder.map((b) => (
                                      <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <span>
                                          {formatCents(b.amountCents)} · {b.mode} · {b.status}
                                        </span>
                                        {b.status === "pending" && (o.buyerId === user?.id || o.sellerId === user?.id) ? (
                                          <button type="button" className="text-brand-primary hover:underline" onClick={() => acceptOrderBid(o.id, b.id)}>
                                            Accept bid
                                          </button>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        )}

        {activeView === VIEWS.ABOUT && (
          <section className={`${UI_KIT.viewSection} max-w-3xl space-y-4 md:space-y-6`}>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">About LinkMart</h2>
            <p className="text-sm leading-relaxed text-neutral-600 dark:text-slate-400">
              LinkMart is a community marketplace for discovering what is available near you. Commerce is cash-on-delivery or cash at pickup — we do not operate
              an in-app wallet. Delivery can be fulfilled by neighbors who walk, run, or bike, with transparent bidding on the delivery fee. Sellers stay organized
              with stock, expenses, and profit views tied to real orders.
            </p>
            <p className="text-sm leading-relaxed text-neutral-600 dark:text-slate-400">
              For support or partnerships, use the contact options on the public landing page.
            </p>
          </section>
        )}

        {activeView === VIEWS.TERMS && (
          <section className={`${UI_KIT.viewSection} max-w-3xl space-y-6 text-sm leading-relaxed text-neutral-700 dark:text-slate-300`}>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Terms & conditions (summary)</h2>
            <p className="text-xs text-neutral-500 dark:text-slate-400">This is a plain-language outline, not legal advice. Have counsel review before production launch.</p>
            <div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">1. No wallet; COD</h3>
              <p className="mt-1 text-neutral-600 dark:text-slate-400">
                LinkMart does not hold buyer or seller funds. Payment for goods and any agreed delivery fee is settled directly between parties (typically cash on
                delivery or at pickup). You are responsible for confirming payment at handoff.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">2. Pickup and delivery</h3>
              <p className="mt-1 text-neutral-600 dark:text-slate-400">
                Listings may offer pickup, delivery, or both. Delivery fees proposed by couriers are offers only until a buyer or seller accepts a bid. The platform
                coordinates information; it does not guarantee delivery times or service quality.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">3. Couriers</h3>
              <p className="mt-1 text-neutral-600 dark:text-slate-400">
                Couriers using the marketplace are independent of LinkMart unless separately contracted. They must follow local laws and safe handoff practices.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">4. Disputes</h3>
              <p className="mt-1 text-neutral-600 dark:text-slate-400">
                Because the platform does not hold funds, disputes over quality, non-payment, or failed delivery should first be resolved between users. LinkMart may
                offer reporting tools but does not arbitrate cash transactions.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">5. Accounts</h3>
              <p className="mt-1 text-neutral-600 dark:text-slate-400">
                You agree to provide accurate profile information and to comply with these rules when using messaging, listings, and delivery features.
              </p>
            </div>
          </section>
        )}

        {activeView === VIEWS.PROFILE && (
          <section className={`${UI_KIT.viewSection} space-y-4 md:space-y-6`}>
            <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
              <div className="space-y-4 rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-sm md:space-y-6 dark:border-slate-600 dark:bg-slate-900/80">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">My profile</h2>
                  {user && !profileEditing ? (
                    <button type="button" className="btn-secondary shrink-0" onClick={openProfileEdit}>
                      Edit profile
                    </button>
                  ) : null}
                </div>
                {user ? (
              profileEditing ? (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
                  <div className={`max-h-[90vh] w-full max-w-5xl overflow-y-auto p-5 ${UI_KIT.surfaceFloating}`}>
                <form onSubmit={handleProfileSubmit} noValidate className="space-y-3">
                  <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 px-3 py-2 text-xs text-neutral-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                    <span className="font-semibold text-neutral-800 dark:text-slate-100">*</span> Required fields. Optional fields are labeled.
                  </div>
                  <div className={`grid grid-cols-1 items-end gap-4 p-5 md:grid-cols-[auto_minmax(12rem,1fr)_minmax(14rem,1fr)] ${UI_KIT.surfaceRaised}`}>
                    <div className="relative h-16 w-16 shrink-0 md:row-span-2 md:self-start">
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-brand-soft text-xl font-bold text-brand-primary ring-1 ring-brand-border">
                        {profileDraft.avatarUrl ? (
                          <img src={profileDraft.avatarUrl} alt="Profile avatar preview" className="h-full w-full object-cover" />
                        ) : (
                          (String(profileDraft.username || "").trim().charAt(0) || String(user?.username || "").trim().charAt(0) || "?").toUpperCase()
                        )}
                      </div>
                      <input
                        ref={profileAvatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleProfileAvatarChange}
                      />
                      <button
                        type="button"
                        aria-label="Change photo"
                        className="absolute -bottom-1 -right-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white bg-neutral-900 text-white shadow-md transition hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary dark:border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                        onClick={() => profileAvatarInputRef.current?.click()}
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                        </svg>
                      </button>
                    </div>
                    <div className="min-w-0 md:order-1">
                      <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-username-inline">
                        Username *
                      </label>
                      <input
                        id="profile-username-inline"
                        name="username"
                        type="text"
                        className="input-base h-9 min-w-[13rem] text-sm font-semibold"
                        value={profileDraft.username}
                        onChange={(e) => {
                          const value = e.target.value;
                          setProfileDraft((prev) => ({ ...prev, username: value }));
                          setProfileFieldErrors((prev) => ({ ...prev, username: "" }));
                        }}
                        required
                        minLength={3}
                      />
                      {profileFieldErrors.username ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{profileFieldErrors.username}</p> : null}
                    </div>
                    <div className="min-w-0 md:order-4">
                      <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-community-inline">
                        Community
                      </label>
                      <div className="relative">
                        <input
                          id="profile-community-inline"
                          name="community"
                          type="text"
                          autoComplete="address-line1"
                          role="combobox"
                          aria-autocomplete="list"
                          aria-expanded={profileBrgySuggestOpen && profileBrgyCommunitySuggestions.length > 0}
                          aria-controls="profile-brgy-suggestions-list"
                          className="input-base h-9 w-full cursor-default border-0 text-sm read-only:border-0 read-only:bg-neutral-50 read-only:text-neutral-700 dark:read-only:bg-slate-900/50 dark:read-only:text-slate-300"
                          value={profileDraft.community}
                          placeholder="No community yet. Join one from Communities."
                          readOnly
                          aria-readonly="true"
                        />
                      </div>
                    </div>
                    <div className="min-w-0 md:order-3">
                      <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-phone-inline">
                        Phone number *
                      </label>
                      <div className="input-base flex h-9 items-center gap-2 px-3 text-sm">
                        <span className="shrink-0 text-neutral-600 dark:text-slate-300">+63</span>
                        <input
                          id="profile-phone-inline"
                          name="phone"
                          type="text"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-neutral-400 dark:placeholder:text-slate-500"
                          value={profileDraft.phone}
                          placeholder="9XXXXXXXXX"
                          maxLength={10}
                          required
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                            setProfileDraft((prev) => ({ ...prev, phone: digits }));
                            setProfileFieldErrors((prev) => ({ ...prev, phone: "" }));
                          }}
                        />
                      </div>
                      {profileFieldErrors.phone ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{profileFieldErrors.phone}</p> : null}
                    </div>
                    <div className="min-w-0 md:order-2">
                      <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-email-inline">
                        Email
                      </label>
                      <input
                        id="profile-email-inline"
                        name="email"
                        type="email"
                        readOnly
                        aria-readonly="true"
                        className="input-base h-9 cursor-default border-0 read-only:border-0 read-only:bg-neutral-50 read-only:text-neutral-700 dark:read-only:bg-slate-900/50 dark:read-only:text-slate-300"
                        autoComplete="email"
                        value={profileDraft.email}
                      />
                    </div>
                  </div>
                  <div className={`flex flex-col gap-y-2 p-5 ${UI_KIT.surfaceCard}`}>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-3 md:gap-x-4">
                      <span className="block text-sm font-semibold tracking-tight text-neutral-900 dark:text-slate-100">Name</span>
                      <div className="hidden min-w-0 md:block" aria-hidden="true" />
                      <div className="hidden min-w-0 md:block" aria-hidden="true" />
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-slate-400">Used across your public profile and marketplace identity.</p>
                    <div className="grid grid-cols-1 gap-y-3 md:grid-cols-3 md:gap-x-4 md:gap-y-0">
                      <div className="min-w-0">
                        <label
                          className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400"
                          htmlFor="profile-first-name"
                        >
                          First name *
                        </label>
                        <input
                          id="profile-first-name"
                          name="firstName"
                          className="input-base mt-1"
                          autoComplete="given-name"
                          value={profileDraft.firstName}
                          onChange={(e) => {
                            const value = e.target.value;
                            setProfileDraft((prev) => ({ ...prev, firstName: value }));
                            setProfileFieldErrors((prev) => ({ ...prev, firstName: "" }));
                          }}
                          required
                          minLength={2}
                        />
                        {profileFieldErrors.firstName ? (
                          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{profileFieldErrors.firstName}</p>
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <label
                          className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400"
                          htmlFor="profile-middle-name"
                        >
                          Middle name *
                        </label>
                        <input
                          id="profile-middle-name"
                          name="middleName"
                          className="input-base mt-1"
                          autoComplete="additional-name"
                          value={profileDraft.middleName}
                          onChange={(e) => {
                            setProfileDraft((prev) => ({ ...prev, middleName: e.target.value }));
                            setProfileFieldErrors((prev) => ({ ...prev, middleName: "" }));
                          }}
                          required
                        />
                        {profileFieldErrors.middleName ? (
                          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{profileFieldErrors.middleName}</p>
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <label
                          className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400"
                          htmlFor="profile-last-name"
                        >
                          Last name *
                        </label>
                        <input
                          id="profile-last-name"
                          name="lastName"
                          className="input-base mt-1"
                          autoComplete="family-name"
                          value={profileDraft.lastName}
                          onChange={(e) => {
                            setProfileDraft((prev) => ({ ...prev, lastName: e.target.value }));
                            setProfileFieldErrors((prev) => ({ ...prev, lastName: "" }));
                          }}
                          required
                          minLength={0}
                        />
                        {profileFieldErrors.lastName ? (
                          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{profileFieldErrors.lastName}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 border-t border-neutral-200/80 pt-4 dark:border-slate-700/80">
                      <span className="block text-sm font-semibold tracking-tight text-neutral-900 dark:text-slate-100">Preferences</span>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">Set demographic details used for profile completeness.</p>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-8 md:items-end md:gap-x-3">
                        <div className="min-w-0 md:col-span-2">
                          <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-gender">
                            Gender *
                          </label>
                          <select
                            id="profile-gender"
                            name="gender"
                            className="input-base mt-1 w-full"
                            value={profileDraft.gender}
                            onChange={(e) => {
                              setProfileDraft((prev) => ({ ...prev, gender: e.target.value }));
                              setProfileFieldErrors((prev) => ({ ...prev, gender: "" }));
                            }}
                            required
                          >
                            <option value="">Select gender</option>
                            {PROFILE_GENDER_OPTIONS.map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          {profileFieldErrors.gender ? (
                            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{profileFieldErrors.gender}</p>
                          ) : null}
                        </div>
                        <div className="min-w-0 md:col-span-4">
                          <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-birthday">
                            Birthday *
                          </label>
                          <div
                            className="relative mt-1"
                            onClick={() => {
                              const input = profileBirthdayInputRef.current;
                              if (!input) return;
                              if (typeof input.showPicker === "function") input.showPicker();
                              else input.focus();
                            }}
                          >
                            <input
                              id="profile-birthday-display"
                              type="text"
                              className="input-base pointer-events-none w-full cursor-pointer pr-11"
                              value={profileDraft.birthday ? formatBirthdayDisplay(profileDraft.birthday) : ""}
                              placeholder="Select birthday"
                              readOnly
                              aria-readonly="true"
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-neutral-500 dark:text-slate-400">
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                            </span>
                            <input
                              ref={profileBirthdayInputRef}
                              id="profile-birthday"
                              name="birthday"
                              type="date"
                              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                              max={todayIsoDate}
                              value={profileDraft.birthday}
                              onChange={(e) => {
                                const birthday = e.target.value;
                                const computed = computeAgeFromBirthday(birthday);
                                setProfileDraft((prev) => ({ ...prev, birthday, age: computed === "" ? "" : String(computed) }));
                                setProfileFieldErrors((prev) => ({ ...prev, birthday: "", age: "" }));
                              }}
                              aria-label="Birthday date picker"
                              required
                            />
                          </div>
                          {profileFieldErrors.birthday ? (
                            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{profileFieldErrors.birthday}</p>
                          ) : null}
                        </div>
                        <div className="min-w-0 md:col-span-2">
                          <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-age">
                            Age
                          </label>
                          <input
                            id="profile-age"
                            name="age"
                            type="number"
                            min={13}
                            max={120}
                            className="input-base mt-1 w-full cursor-default bg-neutral-100/90 dark:bg-slate-800/80"
                            value={profileDraft.age}
                            placeholder="Auto-computed from birthday"
                            readOnly
                            aria-readonly="true"
                          />
                          {profileFieldErrors.age ? (
                            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{profileFieldErrors.age}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-4 border-t border-neutral-200/80 pt-4 dark:border-slate-700/80">
                      <span className="block text-sm font-semibold tracking-tight text-neutral-900 dark:text-slate-100">Address</span>
                      <p className="text-xs text-neutral-500 dark:text-slate-400">Order: Province to City/Municipality to Barangay. Postal code auto-fills.</p>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-x-4">
                        <div className="min-w-0">
                        <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-address-house-street">
                          House Number &amp; Street *
                        </label>
                        <input
                          id="profile-address-house-street"
                          name="addressHouseStreet"
                          type="text"
                          autoComplete="address-line1"
                          className="input-base mt-1"
                          value={profileDraft.addressHouseStreet}
                          onChange={(e) => {
                            setProfileDraft((prev) => ({ ...prev, addressHouseStreet: e.target.value }));
                            setProfileFieldErrors((prev) => ({ ...prev, addressHouseStreet: "" }));
                          }}
                          required
                        />
                        {profileFieldErrors.addressHouseStreet ? (
                          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{profileFieldErrors.addressHouseStreet}</p>
                        ) : null}
                      </div>
                        <div className="min-w-0">
                        <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-address-subdivision">
                          Subdivision *
                        </label>
                        <input
                          id="profile-address-subdivision"
                          name="addressSubdivision"
                          type="text"
                          autoComplete="off"
                          className="input-base mt-1"
                          value={profileDraft.addressSubdivision}
                          onChange={(e) => {
                            setProfileDraft((prev) => ({ ...prev, addressSubdivision: e.target.value }));
                            setProfileFieldErrors((prev) => ({ ...prev, addressSubdivision: "" }));
                          }}
                          required
                        />
                        {profileFieldErrors.addressSubdivision ? (
                          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{profileFieldErrors.addressSubdivision}</p>
                        ) : null}
                      </div>
                        <div className="min-w-0">
                        <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-address-province">
                          Province *
                        </label>
                        <div className="relative">
                          <input
                            id="profile-address-province"
                            name="addressProvince"
                            type="text"
                            autoComplete="off"
                            className="input-base mt-1"
                            value={profileDraft.addressProvince}
                            onChange={(e) => {
                              const typedProvince = e.target.value;
                              const normalized = typedProvince.trim().toLowerCase();
                              const exact = profileProvinceOptions.find(
                                (provinceName) => provinceName.toLowerCase() === normalized,
                              );
                              const province = exact || typedProvince;
                              setProfileDraft((prev) => ({
                                ...prev,
                                addressProvince: province,
                                addressCity: "",
                                addressBarangay: "",
                                addressPostalCode: "",
                              }));
                              setProfileFieldErrors((prev) => ({ ...prev, addressProvince: "", addressCity: "", addressBarangay: "", addressPostalCode: "" }));
                              setProfileProvinceSuggestOpen(true);
                            }}
                            onFocus={() => {
                              if (profileProvinceSuggestBlurTimerRef.current) {
                                clearTimeout(profileProvinceSuggestBlurTimerRef.current);
                                profileProvinceSuggestBlurTimerRef.current = null;
                              }
                              setProfileProvinceSuggestOpen(true);
                            }}
                            onBlur={(e) => {
                              profileProvinceSuggestBlurTimerRef.current = window.setTimeout(() => {
                                const raw = String(e.target.value || "").trim();
                                if (!raw) {
                                  setProfileProvinceSuggestOpen(false);
                                  return;
                                }
                                const lower = raw.toLowerCase();
                                const exact = PH_PROVINCE_OPTIONS.find((name) => name.toLowerCase() === lower);
                                const startsWithMatch = PH_PROVINCE_OPTIONS.find((name) =>
                                  name.toLowerCase().startsWith(lower),
                                );
                                const containsMatch = PH_PROVINCE_OPTIONS.find((name) =>
                                  name.toLowerCase().includes(lower),
                                );
                                const nearest =
                                  exact ||
                                  startsWithMatch ||
                                  containsMatch ||
                                  PH_PROVINCE_OPTIONS.reduce(
                                    (best, candidate) => {
                                      const dist = levenshteinDistance(lower, candidate.toLowerCase());
                                      if (!best || dist < best.dist) return { name: candidate, dist };
                                      return best;
                                    },
                                    null,
                                  )?.name ||
                                  "";
                                setProfileDraft((prev) => ({
                                  ...prev,
                                  addressProvince: nearest,
                                  addressCity: nearest ? prev.addressCity : "",
                                  addressBarangay: nearest ? prev.addressBarangay : "",
                                  addressPostalCode: nearest ? prev.addressPostalCode : "",
                                }));
                                setProfileProvinceSuggestOpen(false);
                                profileProvinceSuggestBlurTimerRef.current = null;
                              }, 150);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.stopPropagation();
                                if (profileProvinceSuggestBlurTimerRef.current) {
                                  clearTimeout(profileProvinceSuggestBlurTimerRef.current);
                                  profileProvinceSuggestBlurTimerRef.current = null;
                                }
                                setProfileProvinceSuggestOpen(false);
                              }
                            }}
                            placeholder="Type or select province"
                            required
                          />
                          {profileProvinceSuggestOpen && profileProvinceFilteredOptions.length > 0 ? (
                            <ul className="absolute left-0 right-0 z-[100] mt-1 max-h-56 overflow-auto rounded-lg border border-neutral-200/95 bg-white py-1 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-900">
                              {profileProvinceFilteredOptions.map((provinceName) => (
                                <li key={provinceName} role="presentation">
                                  <button
                                    type="button"
                                    className="w-full px-3 py-2 text-left hover:bg-brand-soft/50 dark:hover:bg-slate-800"
                                    onMouseDown={(ev) => {
                                      ev.preventDefault();
                                      if (profileProvinceSuggestBlurTimerRef.current) {
                                        clearTimeout(profileProvinceSuggestBlurTimerRef.current);
                                        profileProvinceSuggestBlurTimerRef.current = null;
                                      }
                                      setProfileDraft((prev) => ({
                                        ...prev,
                                        addressProvince: provinceName,
                                      }));
                                      setProfileProvinceSuggestOpen(false);
                                    }}
                                  >
                                    {provinceName}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                        {profileFieldErrors.addressProvince ? (
                          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{profileFieldErrors.addressProvince}</p>
                        ) : null}
                      </div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-x-4">
                        <div className="min-w-0">
                        <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-address-city">
                          City or Municipality *
                        </label>
                        <div className="relative">
                          <input
                            id="profile-address-city"
                            name="addressCity"
                            type="text"
                            autoComplete="off"
                            className="input-base mt-1"
                            value={profileDraft.addressCity}
                            onChange={(e) => {
                              const typedCity = e.target.value;
                              const normalized = typedCity.trim().toLowerCase();
                              const exact = profileCityOptions.find((cityName) => cityName.toLowerCase() === normalized);
                              const city = exact || typedCity;
                              setProfileDraft((prev) => ({
                                ...prev,
                                addressCity: city,
                                addressBarangay: "",
                                addressPostalCode: "",
                              }));
                              setProfileFieldErrors((prev) => ({ ...prev, addressCity: "", addressBarangay: "", addressPostalCode: "" }));
                              setProfileCitySuggestOpen(true);
                            }}
                            onFocus={() => {
                              if (profileCitySuggestBlurTimerRef.current) {
                                clearTimeout(profileCitySuggestBlurTimerRef.current);
                                profileCitySuggestBlurTimerRef.current = null;
                              }
                              setProfileCitySuggestOpen(true);
                            }}
                            onBlur={(e) => {
                              profileCitySuggestBlurTimerRef.current = window.setTimeout(() => {
                                const raw = String(e.target.value || "").trim();
                                if (!raw) {
                                  setProfileCitySuggestOpen(false);
                                  return;
                                }
                                const lower = raw.toLowerCase();
                                const exact = profileCityOptions.find((name) => name.toLowerCase() === lower);
                                const startsWithMatch = profileCityOptions.find((name) =>
                                  name.toLowerCase().startsWith(lower),
                                );
                                const containsMatch = profileCityOptions.find((name) =>
                                  name.toLowerCase().includes(lower),
                                );
                                const nearest =
                                  exact ||
                                  startsWithMatch ||
                                  containsMatch ||
                                  profileCityOptions.reduce(
                                    (best, candidate) => {
                                      const dist = levenshteinDistance(lower, candidate.toLowerCase());
                                      if (!best || dist < best.dist) return { name: candidate, dist };
                                      return best;
                                    },
                                    null,
                                  )?.name ||
                                  "";
                                setProfileDraft((prev) => ({
                                  ...prev,
                                  addressCity: nearest,
                                  addressBarangay: nearest ? prev.addressBarangay : "",
                                  addressPostalCode: nearest ? prev.addressPostalCode : "",
                                }));
                                setProfileCitySuggestOpen(false);
                                profileCitySuggestBlurTimerRef.current = null;
                              }, 150);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.stopPropagation();
                                if (profileCitySuggestBlurTimerRef.current) {
                                  clearTimeout(profileCitySuggestBlurTimerRef.current);
                                  profileCitySuggestBlurTimerRef.current = null;
                                }
                                setProfileCitySuggestOpen(false);
                              }
                            }}
                            placeholder="Type or select city/municipality"
                            required
                          />
                          {profileCitySuggestOpen && profileCityFilteredOptions.length > 0 ? (
                            <ul className="absolute left-0 right-0 z-[100] mt-1 max-h-56 overflow-auto rounded-lg border border-neutral-200/95 bg-white py-1 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-900">
                              {profileCityFilteredOptions.map((cityName) => (
                                <li key={cityName} role="presentation">
                                  <button
                                    type="button"
                                    className="w-full px-3 py-2 text-left hover:bg-brand-soft/50 dark:hover:bg-slate-800"
                                    onMouseDown={(ev) => {
                                      ev.preventDefault();
                                      if (profileCitySuggestBlurTimerRef.current) {
                                        clearTimeout(profileCitySuggestBlurTimerRef.current);
                                        profileCitySuggestBlurTimerRef.current = null;
                                      }
                                      setProfileDraft((prev) => ({
                                        ...prev,
                                        addressCity: cityName,
                                      }));
                                      setProfileCitySuggestOpen(false);
                                    }}
                                  >
                                    {cityName}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                        {profileFieldErrors.addressCity ? (
                          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{profileFieldErrors.addressCity}</p>
                        ) : null}
                      </div>
                        <div className="min-w-0">
                        <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-address-barangay">
                          Barangay *
                        </label>
                        <div className="relative">
                          <input
                            id="profile-address-barangay"
                            name="addressBarangay"
                            type="text"
                            autoComplete="off"
                            className="input-base mt-1"
                            value={profileDraft.addressBarangay}
                            onChange={(e) => {
                              const typedBarangay = e.target.value;
                              const normalized = typedBarangay.trim().toLowerCase();
                              const exact = profileBarangayOptions.find((name) => name.toLowerCase() === normalized);
                              setProfileDraft((prev) => ({ ...prev, addressBarangay: exact || typedBarangay }));
                              setProfileFieldErrors((prev) => ({ ...prev, addressBarangay: "" }));
                              setProfileBarangaySuggestOpen(true);
                            }}
                            onFocus={() => {
                              if (profileBarangaySuggestBlurTimerRef.current) {
                                clearTimeout(profileBarangaySuggestBlurTimerRef.current);
                                profileBarangaySuggestBlurTimerRef.current = null;
                              }
                              setProfileBarangaySuggestOpen(true);
                            }}
                            onBlur={(e) => {
                              profileBarangaySuggestBlurTimerRef.current = window.setTimeout(() => {
                                const raw = String(e.target.value || "").trim();
                                if (!raw) {
                                  setProfileBarangaySuggestOpen(false);
                                  return;
                                }
                                const lower = raw.toLowerCase();
                                const exact = profileBarangayOptions.find((name) => name.toLowerCase() === lower);
                                const startsWithMatch = profileBarangayOptions.find((name) =>
                                  name.toLowerCase().startsWith(lower),
                                );
                                const containsMatch = profileBarangayOptions.find((name) =>
                                  name.toLowerCase().includes(lower),
                                );
                                const nearest =
                                  exact ||
                                  startsWithMatch ||
                                  containsMatch ||
                                  profileBarangayOptions.reduce(
                                    (best, candidate) => {
                                      const dist = levenshteinDistance(lower, candidate.toLowerCase());
                                      if (!best || dist < best.dist) return { name: candidate, dist };
                                      return best;
                                    },
                                    null,
                                  )?.name ||
                                  "";
                                setProfileDraft((prev) => ({ ...prev, addressBarangay: nearest }));
                                setProfileBarangaySuggestOpen(false);
                                profileBarangaySuggestBlurTimerRef.current = null;
                              }, 150);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.stopPropagation();
                                if (profileBarangaySuggestBlurTimerRef.current) {
                                  clearTimeout(profileBarangaySuggestBlurTimerRef.current);
                                  profileBarangaySuggestBlurTimerRef.current = null;
                                }
                                setProfileBarangaySuggestOpen(false);
                              }
                            }}
                            placeholder="Type or select barangay"
                            required
                          />
                          {profileBarangaySuggestOpen && profileBarangayFilteredOptions.length > 0 ? (
                            <ul className="absolute left-0 right-0 z-[100] mt-1 max-h-56 overflow-auto rounded-lg border border-neutral-200/95 bg-white py-1 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-900">
                              {profileBarangayFilteredOptions.map((barangayName) => (
                                <li key={barangayName} role="presentation">
                                  <button
                                    type="button"
                                    className="w-full px-3 py-2 text-left hover:bg-brand-soft/50 dark:hover:bg-slate-800"
                                    onMouseDown={(ev) => {
                                      ev.preventDefault();
                                      if (profileBarangaySuggestBlurTimerRef.current) {
                                        clearTimeout(profileBarangaySuggestBlurTimerRef.current);
                                        profileBarangaySuggestBlurTimerRef.current = null;
                                      }
                                      setProfileDraft((prev) => ({ ...prev, addressBarangay: barangayName }));
                                      setProfileBarangaySuggestOpen(false);
                                    }}
                                  >
                                    {barangayName}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                        {profileFieldErrors.addressBarangay ? (
                          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{profileFieldErrors.addressBarangay}</p>
                        ) : null}
                        </div>
                        <div className="min-w-0">
                        <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-address-postal-code">
                          Postal Code
                        </label>
                        <input
                          id="profile-address-postal-code"
                          name="addressPostalCode"
                          type="text"
                          autoComplete="postal-code"
                          className="input-base mt-1 cursor-default border-0 read-only:border-0 read-only:bg-neutral-50 read-only:text-neutral-700 dark:read-only:bg-slate-900/50 dark:read-only:text-slate-300"
                          value={profileDraft.addressPostalCode}
                          placeholder="Auto-generated"
                          readOnly
                          aria-readonly="true"
                        />
                        {profileFieldErrors.addressPostalCode ? (
                          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{profileFieldErrors.addressPostalCode}</p>
                        ) : null}
                      </div>
                        <div className="min-w-0">
                        <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-address-country">
                          Country
                        </label>
                        <input
                          id="profile-address-country"
                          name="addressCountry"
                          type="text"
                          className="input-base mt-1 cursor-default border-0 read-only:border-0 read-only:bg-neutral-50 read-only:text-neutral-700 dark:read-only:bg-slate-900/50 dark:read-only:text-slate-300"
                          value={profileDraft.addressCountry}
                          readOnly
                          aria-readonly="true"
                        />
                        {profileFieldErrors.addressCountry ? (
                          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{profileFieldErrors.addressCountry}</p>
                        ) : null}
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-address-url">
                          Address link (Google Maps URL, optional)
                        </label>
                        <input
                          id="profile-address-url"
                          name="addressUrl"
                          type="url"
                          autoComplete="url"
                          className="input-base mt-1"
                          placeholder="https://maps.google.com/..."
                          value={profileDraft.addressUrl}
                          onChange={(e) => setProfileDraft((prev) => ({ ...prev, addressUrl: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                  <div className={`space-y-3 p-4 ${UI_KIT.surfaceCard}`}>
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                        profileSocialExpanded
                          ? "bg-transparent shadow-none"
                          : "bg-neutral-50 shadow-sm hover:bg-neutral-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                      }`}
                      onClick={() => setProfileSocialExpanded((prev) => !prev)}
                      aria-expanded={profileSocialExpanded}
                      aria-controls="profile-social-fields"
                    >
                      <span className="block text-sm font-semibold tracking-tight text-neutral-900 dark:text-slate-100">Social media</span>
                      <span className="text-xs font-medium text-neutral-500 dark:text-slate-400">{profileConnectedSocialCount}/3 connected</span>
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 dark:text-slate-300 ${
                          profileSocialExpanded
                            ? "border border-neutral-200 bg-transparent dark:border-slate-600"
                            : "border border-transparent bg-neutral-50 dark:bg-slate-800/60"
                        }`}
                      >
                        <ChevronDownIcon className={`h-4 w-4 transition-transform ${profileSocialExpanded ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    {profileSocialExpanded ? (
                      <div id="profile-social-fields" className="space-y-4 border-t border-neutral-200/80 pt-3 dark:border-slate-700/80">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-x-4">
                          <div className="min-w-0">
                            <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-facebook-url">
                              Facebook URL
                            </label>
                            <input
                              id="profile-facebook-url"
                              name="facebookUrl"
                              type="url"
                              autoComplete="url"
                              className="input-base mt-1"
                              placeholder="https://facebook.com/yourprofile"
                              value={profileDraft.facebookUrl}
                              onChange={(e) => setProfileDraft((prev) => ({ ...prev, facebookUrl: e.target.value }))}
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-twitter-url">
                              X / Twitter URL
                            </label>
                            <input
                              id="profile-twitter-url"
                              name="twitterUrl"
                              type="url"
                              autoComplete="url"
                              className="input-base mt-1"
                              placeholder="https://x.com/yourprofile"
                              value={profileDraft.twitterUrl}
                              onChange={(e) => setProfileDraft((prev) => ({ ...prev, twitterUrl: e.target.value }))}
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-instagram-url">
                              Instagram URL
                            </label>
                            <input
                              id="profile-instagram-url"
                              name="instagramUrl"
                              type="url"
                              autoComplete="url"
                              className="input-base mt-1"
                              placeholder="https://instagram.com/yourprofile"
                              value={profileDraft.instagramUrl}
                              onChange={(e) => setProfileDraft((prev) => ({ ...prev, instagramUrl: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {profileError ? (
                    <p className="app-alert-danger-text text-sm" role="alert">
                      {profileError}
                    </p>
                  ) : null}
                  <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t border-neutral-200/80 bg-white/95 pt-5 backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/95">
                    <button type="submit" className="btn-primary min-w-[7rem]" disabled={profileSaving}>
                      {profileSaving ? "Saving…" : "Save changes"}
                    </button>
                    <button type="button" className="btn-secondary min-w-[7rem]" disabled={profileSaving} onClick={cancelProfileEdit}>
                      Cancel
                    </button>
                  </div>
                </form>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className={`flex flex-col items-center gap-4 p-5 text-center ${UI_KIT.surfaceRaised}`}>
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-soft text-2xl font-bold text-brand-primary ring-1 ring-brand-border">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
                      ) : (
                        (String(user?.username || "").trim().charAt(0) || "?").toUpperCase()
                      )}
                    </div>
                    <div className="w-full">
                      <p className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-slate-100">{getProfileCardDisplayNameFromUser(user)}</p>
                      <div className="mt-2 flex items-center justify-center gap-3">
                        {(() => {
                          const facebookHref = user.facebookUrl || (user.socialPlatform === "facebook" ? user.socialUrl || user.url : "");
                          return facebookHref ? (
                            <a
                              href={facebookHref}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Facebook profile"
                              className="text-neutral-500 transition hover:text-brand-primary dark:text-slate-400 dark:hover:text-slate-100"
                            >
                              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                <path d="M24 12a12 12 0 1 0-13.88 11.86v-8.39H7.08V12h3.04V9.36c0-3 1.8-4.67 4.55-4.67 1.32 0 2.7.24 2.7.24v2.96h-1.52c-1.5 0-1.97.93-1.97 1.89V12h3.35l-.54 3.47h-2.81v8.39A12 12 0 0 0 24 12" />
                              </svg>
                            </a>
                          ) : (
                            <span aria-label="Facebook not linked" className="cursor-not-allowed text-neutral-300 dark:text-slate-700">
                              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                <path d="M24 12a12 12 0 1 0-13.88 11.86v-8.39H7.08V12h3.04V9.36c0-3 1.8-4.67 4.55-4.67 1.32 0 2.7.24 2.7.24v2.96h-1.52c-1.5 0-1.97.93-1.97 1.89V12h3.35l-.54 3.47h-2.81v8.39A12 12 0 0 0 24 12" />
                              </svg>
                            </span>
                          );
                        })()}
                        {(() => {
                          const twitterHref = user.twitterUrl || (user.socialPlatform === "x_twitter" ? user.socialUrl || user.url : "");
                          return twitterHref ? (
                            <a
                              href={twitterHref}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="X or Twitter profile"
                              className="text-neutral-500 transition hover:text-brand-primary dark:text-slate-400 dark:hover:text-slate-100"
                            >
                              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                <path d="M18.9 2H22l-6.8 7.77L23.2 22h-6.26l-4.9-6.4L6.5 22H3.4l7.3-8.35L.8 2h6.42l4.43 5.85L18.9 2Zm-1.1 18h1.73L6.3 3.9H4.45L17.8 20Z" />
                              </svg>
                            </a>
                          ) : (
                            <span aria-label="X or Twitter not linked" className="cursor-not-allowed text-neutral-300 dark:text-slate-700">
                              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                <path d="M18.9 2H22l-6.8 7.77L23.2 22h-6.26l-4.9-6.4L6.5 22H3.4l7.3-8.35L.8 2h6.42l4.43 5.85L18.9 2Zm-1.1 18h1.73L6.3 3.9H4.45L17.8 20Z" />
                              </svg>
                            </span>
                          );
                        })()}
                        {(() => {
                          const instagramHref = user.instagramUrl || (user.socialPlatform === "instagram" ? user.socialUrl || user.url : "");
                          return instagramHref ? (
                            <a
                              href={instagramHref}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Instagram profile"
                              className="text-neutral-500 transition hover:text-brand-primary dark:text-slate-400 dark:hover:text-slate-100"
                            >
                              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                                <path d="M16 11.37a4 4 0 1 1-3.37-3.37 4 4 0 0 1 3.37 3.37z" />
                                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                              </svg>
                            </a>
                          ) : (
                            <span aria-label="Instagram not linked" className="cursor-not-allowed text-neutral-300 dark:text-slate-700">
                              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                                <path d="M16 11.37a4 4 0 1 1-3.37-3.37 4 4 0 0 1 3.37 3.37z" />
                                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                              </svg>
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className={`${UI_KIT.surfaceCard} px-4 py-4`}>
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-slate-100">About</h3>
                    <div className="mt-3 border-t border-neutral-200/80 dark:border-slate-700/80" />
                    <ul className="mt-3 space-y-3 text-sm text-neutral-800 dark:text-slate-200">
                      <li className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-neutral-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                        <span>Joined </span>
                        <span className="font-semibold">
                          {user.joinedAt || user.createdAt || user.created_at || profileJoinedAt
                            ? new Date(user.joinedAt || user.createdAt || user.created_at || profileJoinedAt).toLocaleDateString(undefined, {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })
                            : ""}
                        </span>
                      </li>
                      {user.phone ? (
                        <li className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-neutral-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.62a2 2 0 0 1-.45 2.11L8 9.71a16 16 0 0 0 6.29 6.29l1.26-1.28a2 2 0 0 1 2.11-.45c.84.29 1.72.5 2.62.62A2 2 0 0 1 22 16.92z" />
                          </svg>
                          <span>Phone: </span>
                          <span className="font-semibold">{toPhilippinesLocal11Display(user.phone)}</span>
                        </li>
                      ) : null}
                      {profileCommunityName ? (
                        <li className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-neutral-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span>Community: </span>
                          <span className="font-semibold">{profileCommunityName}</span>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                </div>
              )
            ) : (
              <p className="app-alert-danger-text text-sm">Could not load your profile. Try signing in again.</p>
            )}
              </div>
              <aside className="space-y-4 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-900/80">
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Seller hub sections">
                  {[
                    { id: SELLER_TABS.PRODUCTS, label: "Products" },
                    { id: SELLER_TABS.REVIEW, label: "Review" },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={sellerTab === id}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${sellerTab === id ? UI_KIT.tabActive : UI_KIT.tabIdle}`}
                      onClick={() => setSellerTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {sellerTab === SELLER_TABS.PRODUCTS && (
                  <div className="rounded-xl border border-neutral-200/90 bg-neutral-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="text-sm font-medium text-neutral-800 dark:text-slate-200">Listings & quantity</p>
                      <div className="flex items-center gap-2">
                        <div className="inline-flex items-center rounded-lg border border-neutral-200/90 bg-white p-1 dark:border-slate-600 dark:bg-slate-900">
                          <button
                            type="button"
                            className={`rounded-md p-1.5 transition ${
                              sellerProductsView === "list"
                                ? "bg-brand-soft text-brand-primary dark:bg-slate-800 dark:text-slate-100"
                                : "text-neutral-600 hover:bg-neutral-100 dark:text-slate-400 dark:hover:bg-slate-800"
                            }`}
                            aria-label="List view"
                            onClick={() => setSellerProductsView("list")}
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className={`rounded-md p-1.5 transition ${
                              sellerProductsView === "grid"
                                ? "bg-brand-soft text-brand-primary dark:bg-slate-800 dark:text-slate-100"
                                : "text-neutral-600 hover:bg-neutral-100 dark:text-slate-400 dark:hover:bg-slate-800"
                            }`}
                            aria-label="Grid view"
                            onClick={() => setSellerProductsView("grid")}
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                              <rect x="3" y="3" width="7" height="7" rx="1" />
                              <rect x="14" y="3" width="7" height="7" rx="1" />
                              <rect x="3" y="14" width="7" height="7" rx="1" />
                              <rect x="14" y="14" width="7" height="7" rx="1" />
                            </svg>
                          </button>
                        </div>
                        <button
                          type="button"
                          className="btn-primary shrink-0 text-sm"
                          onClick={() => {
                            if (!canUploadProductFromProfile.ready) {
                              setProfileUploadProductNotice(
                                `Complete required Edit Profile fields first: ${canUploadProductFromProfile.missing.join(", ")}.`,
                              );
                              return;
                            }
                            setProfileUploadProductNotice("");
                            setActiveView(VIEWS.MY_LISTINGS);
                          }}
                        >
                          Upload product
                        </button>
                      </div>
                    </div>
                    {profileUploadProductNotice ? (
                      <div
                        className="mt-3 flex flex-wrap items-start justify-between gap-2 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
                        role="status"
                      >
                        <span className="min-w-0 flex-1">{profileUploadProductNotice}</span>
                        <button
                          type="button"
                          className="shrink-0 text-xs font-semibold text-amber-800 underline dark:text-amber-200"
                          onClick={() => setProfileUploadProductNotice("")}
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : null}
                    {sellerListingsLoading && sellerListings.length === 0 ? (
                      <p className="mt-3 text-sm text-neutral-600 dark:text-slate-400">Loading your listings…</p>
                    ) : null}
                    {sellerListings.length ? (
                      <ul className={sellerProductsView === "grid" ? "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" : "mt-3 space-y-3"}>
                        {sellerListings.map((l) => {
                          return (
                            <SellerProductCard
                              key={l.id}
                              listing={l}
                              gridMode={sellerProductsView === "grid"}
                              onSaleSelect={(percent) => applySellerListingDiscount(l, percent)}
                              onEdit={() => beginEditSellerListing(l)}
                              onDelete={() => deleteSellerListingById(l.id)}
                            />
                          );
                        })}
                      </ul>
                    ) : !(sellerListingsLoading && sellerListings.length === 0) ? (
                      <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">Publish listings to see them here.</p>
                    ) : null}
                  </div>
                )}
                {sellerTab === SELLER_TABS.REVIEW && (
                  <div className="rounded-xl border border-neutral-200/90 bg-neutral-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                    <p className="text-sm font-medium text-neutral-800 dark:text-slate-200">COD review snapshot</p>
                    {sellerSummary ? (
                      <dl className="mt-4 grid gap-3">
                        <div className="rounded-lg bg-white p-3 dark:bg-slate-900/80">
                          <dt className="text-xs uppercase text-neutral-500 dark:text-slate-400">Revenue (completed)</dt>
                          <dd className="text-lg font-semibold text-neutral-900 dark:text-slate-100">{formatCents(sellerSummary.revenueCents)}</dd>
                        </div>
                        <div className="rounded-lg bg-white p-3 dark:bg-slate-900/80">
                          <dt className="text-xs uppercase text-neutral-500 dark:text-slate-400">Expenses</dt>
                          <dd className="text-lg font-semibold text-neutral-900 dark:text-slate-100">{formatCents(sellerSummary.expenseCents)}</dd>
                        </div>
                        <div className="rounded-lg bg-white p-3 dark:bg-slate-900/80">
                          <dt className="text-xs uppercase text-neutral-500 dark:text-slate-400">Profit</dt>
                          <dd className="text-lg font-semibold text-brand-primary">{formatCents(sellerSummary.profitCents)}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">Load data by opening this tab when logged in.</p>
                    )}
                  </div>
                )}
              </aside>
            </div>
          </section>
        )}

        {activeView === VIEWS.USERS && (
          <section className={`${UI_KIT.viewSection} space-y-4 md:space-y-6`}>
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Users</h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-slate-400">People registered on this app (names only).</p>
            </div>
            {usersLoading && usersList.length === 0 ? (
              <p className="text-sm text-neutral-600 dark:text-slate-400">Loading users…</p>
            ) : null}
            {usersError ? <p className="app-alert-danger-text text-sm">{usersError}</p> : null}
            {!usersError ? (
              <ul className="divide-y divide-neutral-200 rounded-xl border border-brand-primary/20 bg-white/85 shadow-sm dark:divide-slate-700 dark:border-slate-600 dark:bg-slate-900/70">
                {!(usersLoading && usersList.length === 0) && usersList.length === 0 ? (
                  <li className="px-4 py-6 text-sm text-neutral-500 dark:text-slate-400">No users yet.</li>
                ) : null}
                {usersList.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span className="font-medium text-neutral-900 dark:text-slate-100">{formatDisplayName(u.name)}</span>
                    {u.joinedAt && (
                      <span className="text-xs text-neutral-500 dark:text-slate-400">{new Date(u.joinedAt).toLocaleDateString()}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        )}

      </main>

      {quickAddModalOpen && quickAddListing ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="quick-add-modal-title">
          <button
            type="button"
            className="absolute inset-0 bg-neutral-900/45 backdrop-blur-[2px] dark:bg-black/55"
            aria-label="Close add to cart dialog"
            onClick={closeQuickAddModal}
          />
          <div
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.22)] dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="quick-add-modal-title" className="text-lg font-semibold text-neutral-900 dark:text-slate-100">
                  Add to cart
                </h2>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200/90 text-lg leading-none text-neutral-500 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Close"
                onClick={closeQuickAddModal}
              >
                <span aria-hidden>×</span>
              </button>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-neutral-200/90 bg-neutral-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="h-36 w-full shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-white sm:h-32 sm:w-32 dark:border-slate-600 dark:bg-slate-900">
                    {String(quickAddListing.imageUrl || "").trim() ? (
                      <img src={quickAddListing.imageUrl} alt={quickAddListing.title || "Product"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                        No image
                      </div>
                    )}
                  </div>
                  <MarketplaceProductDetailStack
                    title={quickAddListing.title || "Product"}
                    priceCents={quickAddListing.priceCents}
                    description={quickAddListing.description}
                    fulfillmentModes={quickAddListing.fulfillmentModes}
                    quantityAfterDescription
                    quantityRow={
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-neutral-600 dark:text-slate-400">Qty</span>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 bg-white text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            aria-label="Decrease quantity"
                            disabled={Number(quickAddQuantity) <= 1 || quickAddSubmitting}
                            onClick={() =>
                              setQuickAddQuantity((prev) => {
                                const current = Number(prev);
                                const safeCurrent = Number.isFinite(current) && current > 0 ? current : 1;
                                return String(Math.max(1, safeCurrent - 1));
                              })
                            }
                          >
                            −
                          </button>
                          <input
                            id="quick-add-qty"
                            type="number"
                            min={1}
                            max={Math.max(1, Number(quickAddListing.quantity) || 1)}
                            className="input-base h-8 w-14 px-1 text-center text-xs"
                            value={quickAddQuantity}
                            disabled={quickAddSubmitting}
                            onChange={(e) => {
                              const maxQty = Math.max(1, Number(quickAddListing.quantity) || 1);
                              const digitsOnly = String(e.target.value || "").replace(/\D/g, "");
                              if (!digitsOnly) {
                                setQuickAddQuantity("1");
                                return;
                              }
                              const next = Math.min(maxQty, Math.max(1, Number(digitsOnly)));
                              setQuickAddQuantity(String(next));
                            }}
                            onBlur={() => {
                              const maxQty = Math.max(1, Number(quickAddListing.quantity) || 1);
                              const parsed = Number(quickAddQuantity);
                              if (!Number.isFinite(parsed) || parsed < 1) {
                                setQuickAddQuantity("1");
                                return;
                              }
                              if (parsed > maxQty) {
                                setQuickAddQuantity(String(maxQty));
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 bg-white text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            aria-label="Increase quantity"
                            disabled={
                              Number(quickAddQuantity) >= Math.max(1, Number(quickAddListing.quantity) || 1) || quickAddSubmitting
                            }
                            onClick={() =>
                              setQuickAddQuantity((prev) => {
                                const current = Number(prev);
                                const safeCurrent = Number.isFinite(current) && current > 0 ? current : 1;
                                const maxQty = Math.max(1, Number(quickAddListing.quantity) || 1);
                                return String(Math.min(maxQty, safeCurrent + 1));
                              })
                            }
                          >
                            +
                          </button>
                        </div>
                        <span className="text-[11px] text-neutral-500 dark:text-slate-500">
                          In stock: {Math.max(1, Number(quickAddListing.quantity) || 1)}
                        </span>
                      </div>
                    }
                  />
                </div>
              </div>
              <div className="border-t border-neutral-200/90 pt-3 dark:border-slate-600/90">
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="quick-add-comment">
                  Comment
                </label>
                <textarea
                  id="quick-add-comment"
                  rows={3}
                  maxLength={250}
                  className="input-base w-full resize-none"
                  placeholder="Optional note for your order"
                  value={quickAddComment}
                  onChange={(e) => setQuickAddComment(e.target.value)}
                />
              </div>
              <button type="button" className="btn-primary w-full" disabled={quickAddSubmitting} onClick={submitQuickAddOrder}>
                {quickAddSubmitting ? "Confirming…" : "Confirm action"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {communityFormOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-community-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-neutral-900/45 backdrop-blur-[2px] dark:bg-black/55"
            aria-label="Close new community dialog"
            onClick={closeAddCommunityModal}
          />
          <div
            className="relative z-10 max-h-[min(90vh,36rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.22)] dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="add-community-modal-title" className="text-lg font-semibold text-neutral-900 dark:text-slate-100">
                  {communityEditingId ? "Edit community" : "New community"}
                </h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-slate-400">
                  {communityEditingId
                    ? "Update your community details. Name is required."
                    : "Create a community anytime. Fields are optional except name."}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200/90 text-lg leading-none text-neutral-500 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Close"
                onClick={closeAddCommunityModal}
              >
                <span aria-hidden>×</span>
              </button>
            </div>
            <form onSubmit={handleCreateCommunity} className="space-y-3 rounded-lg border border-neutral-200/90 bg-neutral-50/60 p-3 dark:border-slate-600 dark:bg-slate-800/50">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400">Add image</label>
                <input
                  ref={communityImageInputRef}
                  className="block w-full max-w-lg cursor-pointer text-sm text-neutral-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-primary dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => setCommunityImageFile(e.target.files?.[0] ?? null)}
                />
                <p className="mt-1 text-[11px] text-neutral-500 dark:text-slate-500">
                  JPEG, PNG, WebP, or GIF — up to 5 MB. Optional; communities without a photo use a color placeholder.
                </p>
                {communityImageFile ? (
                  <p className="mt-1 text-xs text-neutral-600 dark:text-slate-400">Selected: {communityImageFile.name}</p>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="add-community-name">
                    Community name
                  </label>
                  <input
                    id="add-community-name"
                    type="text"
                    className="input-base w-full"
                    value={communityForm.name}
                    onChange={(e) => setCommunityForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter community name"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label
                    className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400"
                    htmlFor="add-community-province"
                  >
                    Province
                  </label>
                  <div className="relative">
                    <input
                      id="add-community-province"
                      type="text"
                      autoComplete="off"
                      className="input-base w-full"
                      value={communityForm.province}
                      onChange={(e) => {
                        const typedProvince = e.target.value;
                        const normalized = typedProvince.trim().toLowerCase();
                        const exact = profileProvinceOptions.find((provinceName) => provinceName.toLowerCase() === normalized);
                        const province = exact || typedProvince;
                        setCommunityForm((prev) => ({ ...prev, province, city: "", postalCode: "" }));
                        setCommunityProvinceSuggestOpen(true);
                      }}
                      onFocus={() => {
                        if (communityProvinceSuggestBlurTimerRef.current) {
                          clearTimeout(communityProvinceSuggestBlurTimerRef.current);
                          communityProvinceSuggestBlurTimerRef.current = null;
                        }
                        setCommunityProvinceSuggestOpen(true);
                      }}
                      onBlur={(e) => {
                        communityProvinceSuggestBlurTimerRef.current = window.setTimeout(() => {
                          const raw = String(e.target.value || "").trim();
                          if (!raw) {
                            setCommunityProvinceSuggestOpen(false);
                            return;
                          }
                          const lower = raw.toLowerCase();
                          const exact = PH_PROVINCE_OPTIONS.find((name) => name.toLowerCase() === lower);
                          const startsWithMatch = PH_PROVINCE_OPTIONS.find((name) => name.toLowerCase().startsWith(lower));
                          const containsMatch = PH_PROVINCE_OPTIONS.find((name) => name.toLowerCase().includes(lower));
                          const nearest =
                            exact ||
                            startsWithMatch ||
                            containsMatch ||
                            PH_PROVINCE_OPTIONS.reduce((best, candidate) => {
                              const dist = levenshteinDistance(lower, candidate.toLowerCase());
                              if (!best || dist < best.dist) return { name: candidate, dist };
                              return best;
                            }, null)?.name ||
                            "";
                          setCommunityForm((prev) => ({
                            ...prev,
                            province: nearest,
                            city: nearest ? prev.city : "",
                            postalCode: nearest ? prev.postalCode : "",
                          }));
                          setCommunityProvinceSuggestOpen(false);
                          communityProvinceSuggestBlurTimerRef.current = null;
                        }, 150);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          if (communityProvinceSuggestBlurTimerRef.current) {
                            clearTimeout(communityProvinceSuggestBlurTimerRef.current);
                            communityProvinceSuggestBlurTimerRef.current = null;
                          }
                          setCommunityProvinceSuggestOpen(false);
                        }
                      }}
                      placeholder="Type or select province"
                    />
                    {communityProvinceSuggestOpen && communityProvinceFilteredOptions.length > 0 ? (
                      <ul className="absolute left-0 right-0 z-[100] mt-1 max-h-56 overflow-auto rounded-lg border border-neutral-200/95 bg-white py-1 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-900">
                        {communityProvinceFilteredOptions.map((provinceName) => (
                          <li key={provinceName} role="presentation">
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left hover:bg-brand-soft/50 dark:hover:bg-slate-800"
                              onMouseDown={(ev) => {
                                ev.preventDefault();
                                if (communityProvinceSuggestBlurTimerRef.current) {
                                  clearTimeout(communityProvinceSuggestBlurTimerRef.current);
                                  communityProvinceSuggestBlurTimerRef.current = null;
                                }
                                setCommunityForm((prev) => ({ ...prev, province: provinceName }));
                                setCommunityProvinceSuggestOpen(false);
                              }}
                            >
                              {provinceName}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
                <div className="sm:col-span-1">
                  <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="add-community-city">
                    City or Municipality
                  </label>
                  <div className="relative">
                    <input
                      id="add-community-city"
                      type="text"
                      autoComplete="off"
                      className="input-base w-full"
                      value={communityForm.city}
                      onChange={(e) => {
                        const typedCity = e.target.value;
                        const normalized = typedCity.trim().toLowerCase();
                        const exact = communityCityOptions.find((cityName) => cityName.toLowerCase() === normalized);
                        const city = exact || typedCity;
                        setCommunityForm((prev) => ({ ...prev, city, postalCode: "" }));
                        setCommunityCitySuggestOpen(true);
                      }}
                      onFocus={() => {
                        if (communityCitySuggestBlurTimerRef.current) {
                          clearTimeout(communityCitySuggestBlurTimerRef.current);
                          communityCitySuggestBlurTimerRef.current = null;
                        }
                        setCommunityCitySuggestOpen(true);
                      }}
                      onBlur={(e) => {
                        communityCitySuggestBlurTimerRef.current = window.setTimeout(() => {
                          const raw = String(e.target.value || "").trim();
                          if (!raw) {
                            setCommunityCitySuggestOpen(false);
                            return;
                          }
                          const lower = raw.toLowerCase();
                          const exact = communityCityOptions.find((name) => name.toLowerCase() === lower);
                          const startsWithMatch = communityCityOptions.find((name) => name.toLowerCase().startsWith(lower));
                          const containsMatch = communityCityOptions.find((name) => name.toLowerCase().includes(lower));
                          const nearest =
                            exact ||
                            startsWithMatch ||
                            containsMatch ||
                            communityCityOptions.reduce((best, candidate) => {
                              const dist = levenshteinDistance(lower, candidate.toLowerCase());
                              if (!best || dist < best.dist) return { name: candidate, dist };
                              return best;
                            }, null)?.name ||
                            "";
                          setCommunityForm((prev) => ({
                            ...prev,
                            city: nearest,
                            postalCode: nearest ? prev.postalCode : "",
                          }));
                          setCommunityCitySuggestOpen(false);
                          communityCitySuggestBlurTimerRef.current = null;
                        }, 150);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          if (communityCitySuggestBlurTimerRef.current) {
                            clearTimeout(communityCitySuggestBlurTimerRef.current);
                            communityCitySuggestBlurTimerRef.current = null;
                          }
                          setCommunityCitySuggestOpen(false);
                        }
                      }}
                      placeholder="Type or select city"
                    />
                    {communityCitySuggestOpen && communityCityFilteredOptions.length > 0 ? (
                      <ul className="absolute left-0 right-0 z-[100] mt-1 max-h-56 overflow-auto rounded-lg border border-neutral-200/95 bg-white py-1 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-900">
                        {communityCityFilteredOptions.map((cityName) => (
                          <li key={cityName} role="presentation">
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left hover:bg-brand-soft/50 dark:hover:bg-slate-800"
                              onMouseDown={(ev) => {
                                ev.preventDefault();
                                if (communityCitySuggestBlurTimerRef.current) {
                                  clearTimeout(communityCitySuggestBlurTimerRef.current);
                                  communityCitySuggestBlurTimerRef.current = null;
                                }
                                setCommunityForm((prev) => ({ ...prev, city: cityName }));
                                setCommunityCitySuggestOpen(false);
                              }}
                            >
                              {cityName}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
                <div className="sm:col-span-1">
                  <label
                    className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400"
                    htmlFor="add-community-postal"
                  >
                    Postal code
                  </label>
                  <input
                    id="add-community-postal"
                    type="text"
                    className="input-base w-full cursor-default bg-neutral-100/90 dark:bg-slate-800/80"
                    value={communityForm.postalCode}
                    readOnly
                    aria-readonly="true"
                    placeholder="—"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="btn-primary text-sm"
                  disabled={communitySaving}
                >
                  {communitySaving ? "Saving…" : communityEditingId ? "Save changes" : "Save community"}
                </button>
                <button type="button" className="btn-secondary text-sm" disabled={communitySaving} onClick={closeAddCommunityModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
