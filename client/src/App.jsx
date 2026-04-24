import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
/** Success toast: full visible time before fade; fade length (should match CSS transition) */
const PUBLISH_TOAST_DURATION_MS = 7500;
const PUBLISH_TOAST_FADE_MS = 350;

const buildEmptyQuestion = () => ({
  text: "",
  kind: "mcq",
  options: ["", "", "", ""],
  correctOptionIndex: 0,
});
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
const normalizeCountryValue = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase() === "pilipinas") return "Philippines";
  return trimmed;
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
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
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

const splitAddressParts = (address) => {
  const parts = String(address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 5) {
    const [addressApartment = "", addressCity = "", addressProvince = "", addressCountry = "", addressPostalCode = ""] = parts;
    return { addressApartment, addressCity, addressProvince, addressCountry, addressPostalCode };
  }
  // If users include extra commas in the first line, preserve stable tail mapping:
  // ... , city, province, country, postalCode
  const addressPostalCode = parts.at(-1) || "";
  const addressCountry = parts.at(-2) || "";
  const addressProvince = parts.at(-3) || "";
  const addressCity = parts.at(-4) || "";
  const addressApartment = parts.slice(0, -4).join(", ");
  return { addressApartment, addressCity, addressProvince, addressCountry, addressPostalCode };
};
const buildAddressValue = (draft) =>
  [draft.addressApartment, draft.addressCity, draft.addressProvince, draft.addressCountry, draft.addressPostalCode]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
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
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [profileJoinedAt, setProfileJoinedAt] = useState("");
  const [profileJoinedAtResolved, setProfileJoinedAtResolved] = useState(false);

  const [activeView, setActiveView] = useState(VIEWS.BROWSE);
  const isBrowseLikeView = useMemo(
    () => activeView === VIEWS.BROWSE || activeView === VIEWS.COMMUNITY_SHOP,
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
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState("");
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesList, setFavoritesList] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersRole, setOrdersRole] = useState("buyer");
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [sellerSummary, setSellerSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [expenseDraft, setExpenseDraft] = useState({ amountPesos: "", category: "supplies", note: "" });
  const [listingForm, setListingForm] = useState({
    title: "",
    description: "",
    pricePesos: "",
    quantity: "",
    verticalId: "",
    subId: "all",
    pickup: true,
    delivery: true,
  });
  const [listingSaving, setListingSaving] = useState(false);
  const [marketplaceMessage, setMarketplaceMessage] = useState("");
  const [communities, setCommunities] = useState([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [communitiesError, setCommunitiesError] = useState("");
  const [communityFormOpen, setCommunityFormOpen] = useState(false);
  const [communityImageFile, setCommunityImageFile] = useState(null);
  const communityImageInputRef = useRef(null);
  const [communitySaving, setCommunitySaving] = useState(false);
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
  /** First segment of saved profile `address` — Brgy/Community/Subdivision (see profile form). */
  const profileBrgyCommunitySubdivision = useMemo(() => {
    const raw = splitAddressParts(user?.address).addressApartment;
    return String(raw || "").trim();
  }, [user?.address]);
  /** City, province, postal code segments from the same comma-separated profile `address`. */
  const profileCityProvincePostal = useMemo(() => {
    const p = splitAddressParts(user?.address);
    return {
      city: String(p.addressCity || "").trim(),
      province: String(p.addressProvince || "").trim(),
      postalCode: String(p.addressPostalCode || "").trim(),
    };
  }, [user?.address]);
  /** Community row whose name matches profile Brgy and city/province when set — listings + “New community” visibility. */
  const listingCommunityFromProfile = useMemo(() => {
    const label = profileBrgyCommunitySubdivision.trim();
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
  }, [communities, profileBrgyCommunitySubdivision, profileCityProvincePostal]);
  /** Compact header “In [community] / All areas” — only on marketplace browse screens, not Orders/Delivery/Profile. */
  const showCommunityShopHeaderStrip = useMemo(
    () => Boolean(shopCommunityId) && isBrowseLikeView && activeView !== VIEWS.COMMUNITY_SHOP,
    [shopCommunityId, isBrowseLikeView, activeView],
  );
  const prevShopCommunityIdRef = useRef(null);
  const [expandedBidOrderId, setExpandedBidOrderId] = useState(null);
  const [bidsForOrder, setBidsForOrder] = useState([]);
  const [sellerTab, setSellerTab] = useState(SELLER_TABS.PRODUCTS);
  /** Inline notice by “Upload product” on Profile (not the global marketplace banner). */
  const [profileUploadProductNotice, setProfileUploadProductNotice] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);

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
    addressApartment: "",
    addressCity: "",
    addressProvince: "",
    addressCountry: "",
    addressPostalCode: "",
    addressUrl: "",
    facebookUrl: "",
    twitterUrl: "",
    instagramUrl: "",
    education: "",
    gender: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileAddressExpanded, setProfileAddressExpanded] = useState(false);
  const [profilePreferencesExpanded, setProfilePreferencesExpanded] = useState(false);
  const [profileSocialExpanded, setProfileSocialExpanded] = useState(false);
  /** Existing `communities.name` values matching the typed Brgy segment (profile edit): substring + fuzzy typos; scoped by city/province when both are set in the draft. */
  const profileBrgyCommunitySuggestions = useMemo(() => {
    const q = String(profileDraft.addressApartment || "").trim();
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
    profileDraft.addressApartment,
    profileDraft.addressCity,
    profileDraft.addressProvince,
    profileDraft.addressPostalCode,
  ]);
  const profileAvatarInputRef = useRef(null);
  /** Delay closing Brgy suggestions so mousedown on an option runs before blur. */
  const profileBrgySuggestBlurTimerRef = useRef(null);

  const googleBtnRef = useRef(null);

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("quiz_theme_v2", theme);
  }, [theme]);

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
    if (profileBrgyCommunitySubdivision.trim()) setProfileUploadProductNotice("");
  }, [profileBrgyCommunitySubdivision]);

  useEffect(() => {
    if (!token || activeView !== VIEWS.USERS) return undefined;
    let cancelled = false;
    setUsersLoading(true);
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
      setActiveView(shopCommunityId ? VIEWS.COMMUNITY_SHOP : VIEWS.BROWSE);
    },
    [navigate, shopCommunityId],
  );

  const goOrders = useCallback(() => {
    setActiveView(VIEWS.ORDERS);
  }, []);

  const goDelivery = useCallback(() => {
    setActiveView(VIEWS.DELIVERY);
  }, []);

  const leaveCommunityToGlobalMarketplace = useCallback(() => {
    setShopCommunityId(null);
    setBrowseVerticalId(null);
    setBrowseSubId(null);
    setBrowseQuickFilter("all");
    setSelectedListingId(null);
    navigate("/", { replace: true });
    setActiveView(VIEWS.BROWSE);
  }, [navigate]);

  const goBrowse = useCallback(() => {
    setShopCommunityId(null);
    setBrowseVerticalId(null);
    setBrowseSubId(null);
    setBrowseQuickFilter("all");
    setSelectedListingId(null);
    navigate("/", { replace: true });
    setActiveView(VIEWS.BROWSE);
  }, [navigate]);

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
    if (!user || !routeListingId) return undefined;
    setSelectedListingId(routeListingId);
    setActiveView(shopCommunityId ? VIEWS.COMMUNITY_SHOP : VIEWS.BROWSE);
    return undefined;
  }, [user, routeListingId, shopCommunityId]);

  useEffect(() => {
    if (!shopCommunityId) {
      prevShopCommunityIdRef.current = null;
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
    setListings([]);
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
        if (!cancelled) setListings(data.listings || []);
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
  }, [token, activeView, browseVerticalId, browseSubId, shopCommunityId, user?.address]);

  useEffect(() => {
    if (!token || activeView !== VIEWS.FAVORITES) return undefined;
    let cancelled = false;
    (async () => {
      setFavoritesLoading(true);
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
    if (!token || activeView !== VIEWS.ORDERS) return undefined;
    let cancelled = false;
    (async () => {
      setOrdersLoading(true);
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
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest("/me/listings", { token });
        if (!cancelled) setSellerListings(data.listings || []);
      } catch {
        if (!cancelled) setSellerListings([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeView, sellerTab]);

  useEffect(() => {
    if (!token || (!isBrowseLikeView && activeView !== VIEWS.MY_LISTINGS && activeView !== VIEWS.PROFILE)) return undefined;
    let cancelled = false;
    (async () => {
      setCommunitiesLoading(true);
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
    setCommunityImageFile(null);
    if (communityImageInputRef.current) communityImageInputRef.current.value = "";
  }, []);

  useEffect(() => {
    if (!communityFormOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeAddCommunityModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [communityFormOpen, closeAddCommunityModal]);

  const handleCreateCommunity = async (ev) => {
    ev.preventDefault();
    if (!token) {
      setMarketplaceMessage("Sign in again to add a community.");
      return;
    }
    const brgyFromProfile = String(splitAddressParts(user?.address).addressApartment || "").trim();
    if (!brgyFromProfile) {
      setMarketplaceMessage("Save your Brgy/Community/Subdivision in Profile (Address) before adding a community.");
      return;
    }
    const { city: cityFromProfile, province: provinceFromProfile, postalCode: postalFromProfile } =
      profileCityProvincePostal;
    if (!cityFromProfile || !provinceFromProfile || !postalFromProfile) {
      setMarketplaceMessage(
        "Save City, Province, and Postal code in Profile (Address) before creating a community.",
      );
      return;
    }
    if (brgyFromProfile.length < 2) {
      setMarketplaceMessage("Brgy/Community/Subdivision in Profile must be at least 2 characters.");
      return;
    }
    setCommunitySaving(true);
    setMarketplaceMessage("");
    try {
      const fd = new FormData();
      fd.append("name", brgyFromProfile);
      fd.append("city", cityFromProfile);
      fd.append("province", provinceFromProfile);
      fd.append("postalCode", postalFromProfile);
      if (communityImageFile) fd.append("image", communityImageFile);
      const createdRes = await apiRequest("/communities", { method: "POST", token, body: fd });
      const createdCommunity = createdRes?.community;
      closeAddCommunityModal();
      const res = await apiRequest("/communities", { token });
      let nextCommunities = res.communities || [];
      if (createdCommunity?.id && !nextCommunities.some((c) => c.id === createdCommunity.id)) {
        nextCommunities = [createdCommunity, ...nextCommunities];
      }
      setCommunities(nextCommunities);
      setMarketplaceMessage("Community added.");
    } catch (e) {
      setMarketplaceMessage(e.message || "Could not create new community.");
    } finally {
      setCommunitySaving(false);
    }
  };

  const toggleFavorite = async (listingId, makeFavorite) => {
    if (!token) return;
    setMarketplaceMessage("");
    try {
      if (makeFavorite) await apiRequest(`/me/favorites/${listingId}`, { method: "POST", token });
      else await apiRequest(`/me/favorites/${listingId}`, { method: "DELETE", token });
      await refreshFavorites();
    } catch (e) {
      setMarketplaceMessage(e.message || "Could not update favorites.");
    }
  };

  const openListing = (id) => {
    setSelectedListingId(id);
    setActiveView(VIEWS.BROWSE);
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

  const handleCreateListing = async (ev) => {
    ev.preventDefault();
    if (!token) return;
    if (!profileBrgyCommunitySubdivision.trim()) {
      setMarketplaceMessage("Save your Brgy/Community/Subdivision in Profile (Address) before publishing a listing.");
      return;
    }
    const catMissing = !String(listingForm.verticalId || "").trim();
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
      setMarketplaceMessage("Choose pickup and/or delivery.");
      return;
    }
    const effectiveCommunityId =
      shopCommunityId || String(listingCommunityFromProfile.id || "").trim();
    if (!effectiveCommunityId) {
      setMarketplaceMessage(
        profileBrgyCommunitySubdivision.trim()
          ? "No community matches your profile Brgy/Community/Subdivision. Add one from the marketplace with the same name."
          : "Save your Brgy/Community/Subdivision in Profile (Address), then add a community that uses that name.",
      );
      return;
    }
    setListingSaving(true);
    setMarketplaceMessage("");
    try {
      await apiRequest("/me/listings", {
        method: "POST",
        token,
        body: {
          title: listingForm.title.trim(),
          description: listingForm.description.trim(),
          priceCents: Math.round(pesos * 100),
          quantity: qtyNum,
          verticalId: String(listingForm.verticalId).trim(),
          ...(listingForm.subId && listingForm.subId !== "all" ? { subId: listingForm.subId } : {}),
          fulfillmentModes: modes,
          cityLabel: "",
          communityId: effectiveCommunityId,
        },
      });
      const [listRes, sumRes] = await Promise.all([
        apiRequest("/me/listings", { token }),
        apiRequest("/me/seller/summary", { token }),
      ]);
      setSellerListings(listRes.listings || []);
      setSellerSummary(sumRes);
      setListingForm({
        title: "",
        description: "",
        pricePesos: "",
        quantity: "",
        verticalId: "",
        subId: "all",
        pickup: true,
        delivery: true,
      });
      setMarketplaceMessage("Listing published.");
      setSellerTab(SELLER_TABS.PRODUCTS);
      setActiveView(VIEWS.PROFILE);
      navigate("/", { replace: true });
    } catch (e) {
      setMarketplaceMessage(e.message || "Could not publish listing.");
    } finally {
      setListingSaving(false);
    }
  };

  const openProfileEdit = () => {
    if (!user) return;
    const parsedAddress = splitAddressParts(user.address);
    setProfileDraft({
      avatarUrl: user.avatarUrl || "",
      username: user.username || user.name || "",
      firstName: user.firstName ?? "",
      middleName: user.middleName ?? "",
      lastName: user.lastName ?? "",
      email: user.email || "",
      phone: user.phone ?? "",
      birthday: user.birthday ?? "",
      age: user.age ? String(user.age) : "",
      addressApartment: parsedAddress.addressApartment,
      addressCity: parsedAddress.addressCity,
      addressProvince: parsedAddress.addressProvince,
      addressCountry: normalizeCountryValue(parsedAddress.addressCountry),
      addressPostalCode: parsedAddress.addressPostalCode,
      addressUrl: user.addressUrl ?? "",
      facebookUrl: user.facebookUrl ?? (user.socialPlatform === "facebook" ? user.socialUrl ?? user.url ?? "" : ""),
      twitterUrl: user.twitterUrl ?? (user.socialPlatform === "x_twitter" ? user.socialUrl ?? user.url ?? "" : ""),
      instagramUrl: user.instagramUrl ?? (user.socialPlatform === "instagram" ? user.socialUrl ?? user.url ?? "" : ""),
      education: user.education ?? "",
      gender: user.gender ?? "",
    });
    setProfileError("");
    setProfileAddressExpanded(false);
    setProfilePreferencesExpanded(false);
    setProfileSocialExpanded(false);
    setProfileEditing(true);
  };

  const cancelProfileEdit = () => {
    setProfileEditing(false);
    setProfileError("");
    setProfileAddressExpanded(false);
    setProfilePreferencesExpanded(false);
    setProfileSocialExpanded(false);
    setProfileBrgySuggestOpen(false);
    if (profileBrgySuggestBlurTimerRef.current) {
      clearTimeout(profileBrgySuggestBlurTimerRef.current);
      profileBrgySuggestBlurTimerRef.current = null;
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
    if (normalizedUsername.length < 3) {
      setProfileError("Username must be at least 3 characters.");
      return;
    }
    if (normalizedFirstName.length < 2) {
      setProfileError("First name must be at least 2 characters.");
      return;
    }
    const effectiveToken = token || localStorage.getItem("quiz_token") || "";
    if (!effectiveToken) {
      setProfileError("Your session expired. Please log in again.");
      return;
    }
    setProfileSaving(true);
    setProfileError("");
    try {
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
          phone: profileDraft.phone.trim(),
          birthday: profileDraft.birthday.trim() || null,
          address: buildAddressValue(profileDraft),
          addressUrl: profileDraft.addressUrl.trim(),
          country: normalizeCountryValue(profileDraft.addressCountry),
          facebookUrl: profileDraft.facebookUrl.trim(),
          twitterUrl: profileDraft.twitterUrl.trim(),
          instagramUrl: profileDraft.instagramUrl.trim(),
          socialPlatform: primarySocial.socialPlatform,
          socialUrl: primarySocial.socialUrl,
          age: profileDraft.age ? Number(profileDraft.age) : undefined,
          education: profileDraft.education.trim(),
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
        phone: profileDraft.phone.trim(),
        birthday: profileDraft.birthday.trim() || null,
        address: buildAddressValue(profileDraft),
        addressUrl: profileDraft.addressUrl.trim(),
        country: normalizeCountryValue(profileDraft.addressCountry),
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
        goDelivery={goDelivery}
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
        {marketplaceMessage ? (
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

        {isBrowseLikeView && (
          <section className="app-card space-y-4 md:space-y-6">
            <div className="space-y-4">
              {activeView === VIEWS.COMMUNITY_SHOP ? (
                <div className="space-y-3 border-b border-neutral-200/80 pb-4 dark:border-slate-700 sm:pb-6">
                  <button
                    type="button"
                    className="btn-secondary w-full text-sm sm:w-auto"
                    onClick={() => leaveCommunityToGlobalMarketplace()}
                  >
                    ← All communities
                  </button>
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-slate-100 sm:text-2xl md:text-3xl">
                      {toTitleCase(activeCommunity?.name?.trim()) || "Community"}
                    </h2>
                    {activeCommunityLocaleLine ? (
                      <p className="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-slate-400 sm:text-sm">
                        {activeCommunityLocaleLine}
                      </p>
                    ) : null}
                    <p className="mt-3 max-w-prose text-xs leading-relaxed text-neutral-600 dark:text-slate-400 sm:text-sm">
                      Listings in this shop are visible to this community only. Use the top navigation for orders, profile, and the rest of the app.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h2 className="whitespace-nowrap text-2xl font-semibold text-neutral-900 dark:text-slate-100">Marketplace</h2>
                  </div>
                  <div className="rounded-xl border border-neutral-200/90 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/80">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-brand-primary">Communities</p>
                    <p className="mt-1 max-w-prose text-sm text-neutral-600 dark:text-slate-400">
                      Local groups (CPR, CPP, barangays, sitios, phases) are saved in the database table <span className="font-mono text-neutral-800 dark:text-slate-200">communities</span> — not on your profile. Add one so neighbors can anchor listings to a place.
                    </p>
                  </div>
                  {!listingCommunityFromProfile.id ? (
                    <button
                      type="button"
                      className="btn-secondary shrink-0 text-sm"
                      onClick={() => {
                      setMarketplaceMessage("");
                      setCommunityFormOpen(true);
                      }}
                    >
                      New community
                    </button>
                  ) : null}
                </div>
                {communitiesError ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{communitiesError}</p> : null}
                {communitiesLoading ? <p className="mt-3 text-sm text-neutral-600 dark:text-slate-400">Loading communities…</p> : null}
                <ul
                  className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4"
                  aria-label="Communities"
                >
                  {!communitiesLoading && communities.length === 0 ? (
                    <li className="col-span-full min-w-0 text-sm text-neutral-600 dark:text-slate-400">
                      No communities yet. Use New community to create the first one.
                    </li>
                  ) : null}
                  {communities.map((c) => {
                    const g = gradientForId(c.id);
                    const initials = initialsFromName(c.name);
                    return (
                      <li key={c.id} className="min-w-0">
                        <div className="flex h-full flex-col gap-2 rounded-xl border border-neutral-200/90 bg-neutral-50/40 p-2.5 dark:border-slate-600 dark:bg-slate-800/50">
                          <button
                            type="button"
                            className="group flex w-full flex-col gap-2 text-left transition hover:opacity-95"
                            onClick={() => {
                              setShopCommunityId(c.id);
                              setActiveView(VIEWS.COMMUNITY_SHOP);
                              navigate("/", { replace: true });
                            }}
                          >
                            <div className="relative aspect-[4/3] overflow-hidden rounded-lg shadow-inner ring-1 ring-black/5 transition group-hover:ring-brand-primary/30 dark:ring-white/10">
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
                              <p className="truncate text-sm font-semibold text-neutral-900 dark:text-slate-100">
                                {toTitleCase(String(c.name || "").trim())}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600 dark:text-slate-400">
                                {formatCommunityMarketplaceSubtitle(c)}
                              </p>
                              <p className="mt-0.5 text-xs text-neutral-600 dark:text-slate-400">
                                Members:{" "}
                                <span className="font-medium text-neutral-800 dark:text-slate-200">
                                  {Number.isFinite(Number(c.memberCount)) ? Number(c.memberCount) : 0}
                                </span>
                              </p>
                            </div>
                          </button>
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
            {activeView === VIEWS.COMMUNITY_SHOP ? (
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
              <aside className="order-1 space-y-3 rounded-2xl border border-neutral-200/80 bg-neutral-50/40 p-3 shadow-sm dark:border-slate-600 dark:bg-slate-900/50 sm:space-y-4 sm:p-4 lg:sticky lg:top-24 lg:order-none lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
                  <div>
                    <p className="mb-1.5 px-0.5 text-xs font-semibold text-neutral-500 dark:text-slate-400 sm:mb-2">Browse</p>
                    <div className="grid grid-cols-3 gap-2 lg:flex lg:flex-col lg:gap-1.5">
                    {BROWSE_QUICK_FILTERS.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        className={`min-h-[2.75rem] w-full rounded-xl border px-2 py-2 text-center text-xs font-medium leading-tight transition sm:px-3 sm:py-2.5 sm:text-left sm:text-sm ${
                          browseQuickFilter === filter.id
                            ? "border-brand-primary/50 bg-white text-brand-primary shadow-sm ring-1 ring-brand-primary/15 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-brand-primary/20"
                            : "border-transparent bg-white/80 text-neutral-700 hover:border-neutral-200 hover:bg-white dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                        }`}
                        onClick={() => {
                          if (filter.id === "all") {
                            setBrowseVerticalId(null);
                            setBrowseSubId(null);
                            setBrowseQuickFilter("all");
                            setSelectedListingId(null);
                            navigate("/", { replace: true });
                            setActiveView(VIEWS.COMMUNITY_SHOP);
                            return;
                          }
                          setBrowseQuickFilter(filter.id);
                          setSelectedListingId(null);
                        }}
                      >
                        {filter.label}
                      </button>
                    ))}
                    </div>
                  </div>
                  <div className="border-t border-neutral-200/80 pt-3 dark:border-slate-700 sm:pt-4">
                    <p className="mb-1.5 px-0.5 text-xs font-semibold text-neutral-500 dark:text-slate-400 sm:mb-2">Categories</p>
                    <div className="flex max-h-[min(36vh,13rem)] flex-col gap-1 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch] sm:max-h-[min(42vh,17rem)] lg:max-h-[min(52vh,22rem)]">
                    {VERTICALS.map((v) => {
                      const allSub = v.subs.find((s) => s.id === "all") ?? v.subs[0];
                      const isActive = browseVerticalId === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          className={`min-h-[2.625rem] w-full rounded-xl border px-2.5 py-2 text-left text-xs font-medium leading-snug transition sm:px-3 sm:py-2.5 sm:text-sm ${
                            isActive
                              ? "border-brand-primary/50 bg-white text-brand-primary shadow-sm ring-1 ring-brand-primary/15 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-brand-primary/20"
                              : "border-transparent bg-white/80 text-neutral-800 hover:border-neutral-200 hover:bg-white dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                          }`}
                          onClick={() => pickBrowseScope(v.id, allSub?.id ?? null)}
                        >
                          {v.label}
                        </button>
                      );
                    })}
                    </div>
                  </div>
                  <div className="border-t border-neutral-200/80 pt-3 dark:border-slate-700 sm:pt-4">
                    <p className="mb-1.5 px-0.5 text-xs font-semibold text-neutral-500 dark:text-slate-400 sm:mb-2">Location</p>
                    <div className="rounded-xl border border-neutral-200/70 bg-white px-2.5 py-2 text-left text-xs font-medium leading-snug text-neutral-800 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 sm:px-3 sm:py-2.5 sm:text-sm">
                      {activeCommunity?.id
                        ? formatCommunityMarketplaceSubtitle(activeCommunity)
                        : toTitleCase(String(user?.city || "").trim()) || "Calamba, Laguna"}
                    </div>
                    {activeCommunity?.id ? (
                      <p className="mt-1.5 px-0.5 text-xs text-neutral-600 dark:text-slate-400">
                        Members:{" "}
                        <span className="font-medium text-neutral-800 dark:text-slate-200">
                          {Number.isFinite(Number(activeCommunity.memberCount))
                            ? Number(activeCommunity.memberCount)
                            : 0}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </aside>
              <div className="order-2 min-w-0 space-y-3 sm:space-y-4 lg:order-none">
                {shopCommunityId && browseVerticalId == null ? (
                  <div className="rounded-xl border border-neutral-200/80 bg-white/90 px-3 py-2.5 text-xs leading-relaxed text-neutral-700 shadow-sm dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200 sm:px-4 sm:py-3 sm:text-sm">
                    <span className="font-medium text-neutral-900 dark:text-slate-100">All categories</span>
                    <span className="text-neutral-600 dark:text-slate-400">
                      {" "}
                      — every listing in this community. Tap a category above to filter.
                    </span>
                  </div>
                ) : null}
                {listingDetail && selectedListingId ? (
                  <div className="space-y-4 rounded-xl border border-brand-primary/25 bg-brand-soft/20 p-4 dark:border-slate-600 dark:bg-slate-900/50">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-slate-100">{listingDetail.title}</h3>
                      <button type="button" className="btn-secondary text-xs" onClick={closeListingDetail}>
                        Close
                      </button>
                    </div>
                    <p className="text-xl font-bold text-brand-primary">{formatCents(listingDetail.priceCents)}</p>
                    <p className="text-sm text-neutral-600 dark:text-slate-400">
                      Qty available: <span className="font-medium text-neutral-800 dark:text-slate-200">{Number(listingDetail.quantity) || 0}</span>
                    </p>
                    {listingDetail.cityLabel ? (
                      <p className="text-sm text-neutral-600 dark:text-slate-400">{listingDetail.cityLabel}</p>
                    ) : null}
                    <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-slate-300">{listingDetail.description}</p>
                    <p className="min-w-0 break-words text-xs text-neutral-500 dark:text-slate-400">
                      Fulfillment: {(listingDetail.fulfillmentModes || []).join(" · ") || "pickup"}. Share this listing:{" "}
                      <span className="inline-block max-w-full break-all font-mono text-[11px]">
                        {typeof window !== "undefined" ? `${window.location.origin}/l/${listingDetail.id}` : ""}
                      </span>
                    </p>
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
                          goOrders();
                        }}
                        onError={(m) => setMarketplaceMessage(m)}
                      />
                    ) : (
                      <p className="text-sm text-neutral-600 dark:text-slate-400">This is your listing.</p>
                    )}
                  </div>
                ) : null}
                {listingsLoading ? (
                  <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-neutral-200/60 bg-neutral-50/50 dark:border-slate-700 dark:bg-slate-900/40">
                    <p className="text-sm font-medium text-neutral-600 dark:text-slate-400">Loading listings…</p>
                  </div>
                ) : null}
                {listingsError ? <p className="app-alert-error text-sm">{listingsError}</p> : null}
                {!listingsLoading && !listingsError && visibleBrowseListings.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleBrowseListings.map((l) => (
                      <div
                        key={l.id}
                        role="button"
                        tabIndex={0}
                        className="relative cursor-pointer rounded-xl border border-neutral-200/90 bg-white p-4 text-left shadow-sm transition hover:border-brand-primary/40 dark:border-slate-600 dark:bg-slate-900/80 dark:hover:border-slate-500"
                        onClick={() => openListing(l.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openListing(l.id);
                          }
                        }}
                      >
                        <button
                          type="button"
                          className="absolute right-3 top-3 z-10 rounded-full border border-neutral-200/90 bg-white/95 p-1.5 text-rose-500 shadow-sm hover:bg-rose-50 dark:border-slate-600 dark:bg-slate-900/95 dark:hover:bg-rose-950/30"
                          aria-label={favoriteIds.has(l.id) ? "Remove from favorites" : "Add to favorites"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(l.id, !favoriteIds.has(l.id));
                          }}
                        >
                          <span className="text-base leading-none">{favoriteIds.has(l.id) ? "♥" : "♡"}</span>
                        </button>
                        <p className="pr-10 text-xs font-semibold text-brand-primary">
                          {getVerticalById(l.verticalId)?.label ?? l.verticalId}
                        </p>
                        <h3 className="mt-1 font-semibold text-neutral-900 dark:text-slate-100">{l.title}</h3>
                        <p className="mt-1 text-sm font-medium text-brand-primary">{formatCents(l.priceCents)}</p>
                        <p className="mt-1 text-xs text-neutral-600 dark:text-slate-400">
                          Qty <span className="font-medium text-neutral-800 dark:text-slate-200">{Number(l.quantity) || 0}</span>
                        </p>
                        {l.cityLabel ? <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">{l.cityLabel}</p> : null}
                        <p className="mt-2 line-clamp-2 text-xs text-neutral-600 dark:text-slate-400">{l.description}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {!listingsLoading && !listingsError && visibleBrowseListings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200/90 bg-gradient-to-b from-neutral-50/80 to-white px-4 py-10 text-center dark:border-slate-600 dark:from-slate-900/50 dark:to-slate-900/20 sm:px-6 sm:py-14">
                    <p className="text-base font-semibold text-neutral-900 dark:text-slate-100 sm:text-lg">No listings to show</p>
                    <p className="mt-2 max-w-md text-xs leading-relaxed text-neutral-600 dark:text-slate-400 sm:text-sm">
                      {shopCommunityId
                        ? browseVerticalId == null
                          ? "Nothing has been posted in this community shop yet. Publish from Profile → My listings (with this community open in Marketplace, or your profile address matching this place)."
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
          <section className="app-card space-y-4 md:space-y-6">
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Messages</h2>
            <p className="text-sm text-neutral-600 dark:text-slate-400">
              Chat with buyers and sellers in one inbox. Threading, attachments, and read receipts will ship when messaging is connected to the backend.
            </p>
            <div className="rounded-xl border border-dashed border-neutral-200/90 bg-neutral-50/50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/40 md:p-10">
              <p className="text-sm font-medium text-neutral-700 dark:text-slate-300">Messaging — coming soon</p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">
                You will see conversations and new-message alerts here once the feature is live.
              </p>
            </div>
          </section>
        )}

        {activeView === VIEWS.NOTIFICATIONS && (
          <section className="app-card space-y-4 md:space-y-6">
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Notifications</h2>
            <p className="text-sm text-neutral-600 dark:text-slate-400">
              Order updates, delivery status, and marketplace alerts will appear here once notifications are wired to the backend.
            </p>
            <div className="rounded-xl border border-dashed border-neutral-200/90 bg-neutral-50/50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/40 md:p-10">
              <p className="text-sm font-medium text-neutral-700 dark:text-slate-300">No notifications yet</p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">You are all caught up for now.</p>
            </div>
          </section>
        )}

        {activeView === VIEWS.FAVORITES && (
          <section className="app-card space-y-4 md:space-y-6">
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">My Favorites</h2>
            <p className="text-sm text-neutral-600 dark:text-slate-400">
              Listings you heart in Browse appear here. Tap a card to open details and place a COD order. Unavailable items show as inactive.
            </p>
            {favoritesLoading ? <p className="text-sm text-neutral-600 dark:text-slate-400">Loading…</p> : null}
            {!favoritesLoading && favoritesList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200/90 bg-neutral-50/50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/40 md:p-10">
                <p className="text-sm font-medium text-neutral-700 dark:text-slate-300">No favorites yet</p>
                <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">Use the heart on Browse cards to save items.</p>
              </div>
            ) : null}
            {!favoritesLoading && favoritesList.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {favoritesList.map((l) => (
                  <div
                    key={l.id}
                    className="relative rounded-xl border border-neutral-200/90 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/80"
                  >
                    <button
                      type="button"
                      className="absolute right-3 top-3 rounded-full border border-neutral-200/90 bg-white/95 p-1.5 text-rose-500 dark:border-slate-600 dark:bg-slate-900/95"
                      aria-label="Remove from favorites"
                      onClick={() => toggleFavorite(l.id, false)}
                    >
                      <span className="text-base leading-none">♥</span>
                    </button>
                    <button type="button" className="w-full text-left" onClick={() => openListing(l.id)}>
                      <p className="pr-10 text-xs font-semibold text-brand-primary">
                        {getVerticalById(l.verticalId)?.label ?? l.verticalId}
                      </p>
                      <h3 className="mt-1 font-semibold text-neutral-900 dark:text-slate-100">{l.title}</h3>
                      <p className="mt-1 text-sm font-medium text-brand-primary">{formatCents(l.priceCents)}</p>
                      {l.status !== "active" ? (
                        <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                          Unavailable
                        </span>
                      ) : null}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        )}

        {activeView === VIEWS.MY_LISTINGS && (
          <section className="app-card space-y-6 md:space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">My listings</h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-slate-400">
                Publish items for your neighborhood. Prices are in PHP; buyers pay COD at pickup or delivery. No wallet in the app.
              </p>
            </div>
            <form onSubmit={handleCreateListing} className="grid gap-4 rounded-xl border border-neutral-200/90 bg-neutral-50/50 p-4 dark:border-slate-600 dark:bg-slate-900/40 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400">Product</label>
                <input
                  className="input-base w-full"
                  value={listingForm.title}
                  onChange={(e) => setListingForm((p) => ({ ...p, title: e.target.value }))}
                  required
                  minLength={2}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400">Description (optional)</label>
                <textarea
                  className="input-base min-h-[5rem] w-full"
                  value={listingForm.description}
                  onChange={(e) => setListingForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="md:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400">Price (PHP)</label>
                  <input
                    className="input-base w-full"
                    type="number"
                    min={0}
                    step="0.01"
                    value={listingForm.pricePesos}
                    onChange={(e) => setListingForm((p) => ({ ...p, pricePesos: e.target.value }))}
                    required
                  />
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400">Quantity</label>
                  <input
                    className="input-base w-full"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="e.g. 1"
                    value={listingForm.quantity}
                    onChange={(e) => setListingForm((p) => ({ ...p, quantity: e.target.value }))}
                  />
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400">Categories</label>
                  <select
                    className="input-base w-full"
                    value={listingForm.verticalId}
                    onChange={(e) => setListingForm((p) => ({ ...p, verticalId: e.target.value }))}
                  >
                    <option value="">Select a category</option>
                    {VERTICALS.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="md:col-span-2">
                {shopCommunityId ? (
                  <p className="text-sm text-neutral-700 dark:text-slate-300">
                    <span className="font-medium text-neutral-900 dark:text-slate-100">Community:</span>{" "}
                    {toTitleCase(activeCommunity?.name?.trim()) || "This community"} — listing will only show in this community shop.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-neutral-700 dark:text-slate-300">
                      <span className="font-medium text-neutral-900 dark:text-slate-100">Brgy/Community/Subdivision:</span>{" "}
                      {profileBrgyCommunitySubdivision.trim() || "—"}
                      {listingCommunityFromProfile.id ? (
                        <>
                          {" "}
                          — listings publish to{" "}
                          <span className="font-medium text-neutral-900 dark:text-slate-100">
                            {listingCommunityFromProfile.matchedName || "Community"}
                          </span>
                          .
                        </>
                      ) : profileBrgyCommunitySubdivision.trim() ? (
                        <span className="text-amber-900 dark:text-amber-100/90">
                          {" "}
                          — no community with this name yet. Add it from the marketplace, then publish.
                        </span>
                      ) : (
                        <span className="text-neutral-600 dark:text-slate-400">
                          {" "}
                          — set this under Profile → Address to link listings to your community shop.
                        </span>
                      )}
                    </p>
                    {!communitiesLoading && communities.length === 0 ? (
                      <p className="mt-2 text-sm text-amber-800 dark:text-amber-200/90">
                        No communities yet. Create one from the marketplace browse screen, then publish here.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 md:col-span-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={listingForm.pickup}
                    onChange={(e) => setListingForm((p) => ({ ...p, pickup: e.target.checked }))}
                  />
                  Pickup
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={listingForm.delivery}
                    onChange={(e) => setListingForm((p) => ({ ...p, delivery: e.target.checked }))}
                  />
                  Delivery (COD bids)
                </label>
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    listingSaving ||
                    !profileBrgyCommunitySubdivision.trim() ||
                    (!shopCommunityId && (communitiesLoading || !listingCommunityFromProfile.id))
                  }
                >
                  {listingSaving ? "Publishing…" : "Publish listing"}
                </button>
              </div>
            </form>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-slate-100">Your listings</h3>
              <ul className="mt-3 divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-slate-700 dark:border-slate-600">
                {sellerListings.length === 0 ? (
                  <li className="px-4 py-6 text-sm text-neutral-500 dark:text-slate-400">No listings yet.</li>
                ) : null}
                {sellerListings.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span className="font-medium text-neutral-900 dark:text-slate-100">{l.title}</span>
                    <span className="text-neutral-600 dark:text-slate-400">
                      {formatCents(l.priceCents)} · {l.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {activeView === VIEWS.DELIVERY && (
          <section className="app-card space-y-4 md:space-y-6">
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Local delivery</h2>
            <div className="rounded-xl border border-dashed border-neutral-200/90 bg-neutral-50/50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/40 md:p-10">
              <p className="text-sm text-neutral-600 dark:text-slate-400">Nothing here yet.</p>
            </div>
          </section>
        )}

        {activeView === VIEWS.ORDERS && (
          <section className="app-card space-y-4 md:space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Orders</h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-slate-400">
                  COD pickup or delivery. Goods total plus agreed delivery fee (if any) is paid in cash — LinkMart does not store balances.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${ordersRole === "buyer" ? "bg-brand-soft text-brand-primary" : "btn-secondary"}`}
                  onClick={() => setOrdersRole("buyer")}
                >
                  Buying
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${ordersRole === "seller" ? "bg-brand-soft text-brand-primary" : "btn-secondary"}`}
                  onClick={() => setOrdersRole("seller")}
                >
                  Selling
                </button>
              </div>
            </div>
            {ordersLoading ? <p className="text-sm text-neutral-600 dark:text-slate-400">Loading…</p> : null}
            <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-slate-700 dark:border-slate-600">
              {orders.length === 0 && !ordersLoading ? (
                <li className="px-4 py-6 text-sm text-neutral-500 dark:text-slate-400">No orders in this tab.</li>
              ) : null}
              {orders.map((o) => (
                <li key={o.id} className="space-y-2 px-4 py-4 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-mono text-xs text-neutral-500 dark:text-slate-400">{o.id}</span>
                    <span className="font-medium text-neutral-800 dark:text-slate-200">{o.status.replace(/_/g, " ")}</span>
                  </div>
                  <p className="text-neutral-700 dark:text-slate-300">
                    {o.fulfillmentType === "delivery" ? "Delivery" : "Pickup"} · goods {formatCents(o.codGoodsCents)}
                    {o.codDeliveryCents > 0 ? <span> · delivery {formatCents(o.codDeliveryCents)}</span> : null}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ordersRole === "seller" && o.status === "placed" ? (
                      <button type="button" className="btn-secondary text-xs" onClick={() => patchOrderTransition(o.id, "seller_accept")}>
                        Accept order
                      </button>
                    ) : null}
                    {o.status === "ready_for_pickup" ? (
                      <button type="button" className="btn-secondary text-xs" onClick={() => patchOrderTransition(o.id, "mark_pickup_done")}>
                        Mark pickup complete (COD)
                      </button>
                    ) : null}
                    {ordersRole === "seller" && o.status === "bid_accepted" ? (
                      <button type="button" className="btn-secondary text-xs" onClick={() => patchOrderTransition(o.id, "mark_out_for_delivery")}>
                        Mark out for delivery
                      </button>
                    ) : null}
                    {o.status === "out_for_delivery" ? (
                      <button type="button" className="btn-secondary text-xs" onClick={() => patchOrderTransition(o.id, "mark_delivered")}>
                        Mark delivered (COD)
                      </button>
                    ) : null}
                    {o.status !== "completed" && o.status !== "cancelled" ? (
                      <button type="button" className="text-xs text-rose-600 hover:underline dark:text-rose-400" onClick={() => patchOrderTransition(o.id, "cancel")}>
                        Cancel
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
                </li>
              ))}
            </ul>
          </section>
        )}

        {activeView === VIEWS.ABOUT && (
          <section className="app-card max-w-3xl space-y-4 md:space-y-6">
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
          <section className="app-card max-w-3xl space-y-6 text-sm leading-relaxed text-neutral-700 dark:text-slate-300">
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
          <section className="app-card space-y-4 md:space-y-6">
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
                  <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.25)] dark:border-slate-600 dark:bg-slate-900">
                <form onSubmit={handleProfileSubmit} noValidate className="space-y-6">
                  <div className="grid grid-cols-1 items-end gap-4 rounded-2xl border border-neutral-200/80 bg-gradient-to-br from-white to-neutral-50 p-5 shadow-sm ring-1 ring-neutral-100/80 dark:border-slate-700/80 dark:from-slate-900 dark:to-slate-900/70 dark:ring-slate-800/80 md:grid-cols-[auto_minmax(13rem,1fr)_minmax(16rem,1fr)]">
                    <div className="flex flex-col items-start gap-2">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-soft text-xl font-bold text-brand-primary ring-1 ring-brand-border">
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
                        className="btn-secondary !px-3 !py-1.5 text-xs"
                        onClick={() => profileAvatarInputRef.current?.click()}
                      >
                        Change photo
                      </button>
                    </div>
                    <div className="min-w-0">
                      <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-username-inline">
                        Username
                      </label>
                      <input
                        id="profile-username-inline"
                        name="username"
                        type="text"
                        className="input-base h-9 min-w-[13rem] text-sm font-semibold"
                        value={profileDraft.username}
                        onChange={(e) => setProfileDraft((prev) => ({ ...prev, username: e.target.value }))}
                        required
                        minLength={3}
                      />
                    </div>
                    <div className="min-w-0">
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
                  <div className="flex flex-col gap-y-2 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm ring-1 ring-neutral-100/80 dark:border-slate-700/80 dark:bg-slate-900/70 dark:ring-slate-800/80">
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-3 md:gap-x-4">
                      <span className="block text-sm font-semibold tracking-tight text-neutral-900 dark:text-slate-100">Name</span>
                      <div className="hidden min-w-0 md:block" aria-hidden="true" />
                      <div className="hidden min-w-0 md:block" aria-hidden="true" />
                    </div>
                    <div className="grid grid-cols-1 gap-y-3 md:grid-cols-3 md:gap-x-4 md:gap-y-0">
                      <div className="min-w-0">
                        <label
                          className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400"
                          htmlFor="profile-first-name"
                        >
                          First name
                        </label>
                        <input
                          id="profile-first-name"
                          name="firstName"
                          className="input-base mt-1"
                          autoComplete="given-name"
                          value={profileDraft.firstName}
                          onChange={(e) => setProfileDraft((prev) => ({ ...prev, firstName: e.target.value }))}
                          required
                          minLength={2}
                        />
                      </div>
                      <div className="min-w-0">
                        <label
                          className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400"
                          htmlFor="profile-middle-name"
                        >
                          Middle <span className="font-normal text-neutral-500 dark:text-slate-500">(optional)</span>
                        </label>
                        <input
                          id="profile-middle-name"
                          name="middleName"
                          className="input-base mt-1"
                          autoComplete="additional-name"
                          value={profileDraft.middleName}
                          onChange={(e) => setProfileDraft((prev) => ({ ...prev, middleName: e.target.value }))}
                        />
                      </div>
                      <div className="min-w-0">
                        <label
                          className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400"
                          htmlFor="profile-last-name"
                        >
                          Last name
                        </label>
                        <input
                          id="profile-last-name"
                          name="lastName"
                          className="input-base mt-1"
                          autoComplete="family-name"
                          value={profileDraft.lastName}
                          onChange={(e) => setProfileDraft((prev) => ({ ...prev, lastName: e.target.value }))}
                          minLength={0}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm ring-1 ring-neutral-100/80 dark:border-slate-700/80 dark:bg-slate-900/70 dark:ring-slate-800/80">
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                        profilePreferencesExpanded
                          ? "bg-transparent shadow-none"
                          : "bg-neutral-50 shadow-sm hover:bg-neutral-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                      }`}
                      onClick={() => setProfilePreferencesExpanded((prev) => !prev)}
                      aria-expanded={profilePreferencesExpanded}
                      aria-controls="profile-preferences-fields"
                    >
                      <span className="block text-sm font-semibold tracking-tight text-neutral-900 dark:text-slate-100">Preferences</span>
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 dark:text-slate-300 ${
                          profilePreferencesExpanded
                            ? "border border-neutral-200 bg-transparent dark:border-slate-600"
                            : "border border-transparent bg-neutral-50 dark:bg-slate-800/60"
                        }`}
                      >
                        <ChevronDownIcon className={`h-4 w-4 transition-transform ${profilePreferencesExpanded ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    {profilePreferencesExpanded ? (
                      <div id="profile-preferences-fields" className="space-y-4 border-t border-neutral-200/80 pt-3 dark:border-slate-700/80">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-4">
                        <div className="min-w-0">
                          <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-age">
                            Age
                          </label>
                          <input
                            id="profile-age"
                            name="age"
                            type="number"
                            min={13}
                            max={120}
                            className="input-base mt-1"
                            value={profileDraft.age}
                            onChange={(e) => setProfileDraft((prev) => ({ ...prev, age: e.target.value }))}
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-education">
                            Education
                          </label>
                          <input
                            id="profile-education"
                            name="education"
                            type="text"
                            autoComplete="off"
                            className="input-base mt-1"
                            placeholder="e.g. BS Computer Science"
                            value={profileDraft.education}
                            onChange={(e) => setProfileDraft((prev) => ({ ...prev, education: e.target.value }))}
                          />
                        </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-8 md:gap-x-4">
                    <div className="min-w-0 md:col-span-2">
                      <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-gender">
                        Gender
                      </label>
                      <select
                        id="profile-gender"
                        name="gender"
                        className="input-base mt-1"
                        value={profileDraft.gender}
                        onChange={(e) => setProfileDraft((prev) => ({ ...prev, gender: e.target.value }))}
                      >
                        <option value="">Not specified</option>
                        {PROFILE_GENDER_OPTIONS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0 md:col-span-2">
                      <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-birthday">
                        Birthday
                      </label>
                      <input
                        id="profile-birthday"
                        name="birthday"
                        type="date"
                        className="input-base mt-1"
                        value={profileDraft.birthday}
                        onChange={(e) => setProfileDraft((prev) => ({ ...prev, birthday: e.target.value }))}
                      />
                    </div>
                    <div className="min-w-0 md:col-span-4">
                      <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-phone">
                        Phone number
                      </label>
                      <input
                        id="profile-phone"
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        className="input-base mt-1"
                        value={profileDraft.phone}
                        onChange={(e) => setProfileDraft((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-3 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm ring-1 ring-neutral-100/80 dark:border-slate-700/80 dark:bg-slate-900/70 dark:ring-slate-800/80">
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                        profileAddressExpanded
                          ? "bg-transparent shadow-none"
                          : "bg-neutral-50 shadow-sm hover:bg-neutral-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                      }`}
                      onClick={() => setProfileAddressExpanded((prev) => !prev)}
                      aria-expanded={profileAddressExpanded}
                      aria-controls="profile-address-fields"
                    >
                      <span className="block text-sm font-semibold tracking-tight text-neutral-900 dark:text-slate-100">Address</span>
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 dark:text-slate-300 ${
                          profileAddressExpanded
                            ? "border border-neutral-200 bg-transparent dark:border-slate-600"
                            : "border border-transparent bg-neutral-50 dark:bg-slate-800/60"
                        }`}
                      >
                        <ChevronDownIcon className={`h-4 w-4 transition-transform ${profileAddressExpanded ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    {profileAddressExpanded ? (
                      <div id="profile-address-fields" className="mt-2 space-y-4 border-t border-neutral-200/80 pt-3 dark:border-slate-700/80">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-x-4">
                        <div className="min-w-0">
                        <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-address-apartment">
                          Brgy/Community/Subdivision
                        </label>
                        <div className="relative mt-1">
                          <input
                            id="profile-address-apartment"
                            name="addressApartment"
                            type="text"
                            autoComplete="address-line1"
                            role="combobox"
                            aria-autocomplete="list"
                            aria-expanded={profileBrgySuggestOpen && profileBrgyCommunitySuggestions.length > 0}
                            aria-controls="profile-brgy-suggestions-list"
                            className="input-base w-full"
                            value={profileDraft.addressApartment}
                            onChange={(e) => {
                              if (profileBrgySuggestBlurTimerRef.current) {
                                clearTimeout(profileBrgySuggestBlurTimerRef.current);
                                profileBrgySuggestBlurTimerRef.current = null;
                              }
                              setProfileDraft((prev) => ({ ...prev, addressApartment: e.target.value }));
                              setProfileBrgySuggestOpen(true);
                            }}
                            onFocus={() => {
                              if (profileBrgySuggestBlurTimerRef.current) {
                                clearTimeout(profileBrgySuggestBlurTimerRef.current);
                                profileBrgySuggestBlurTimerRef.current = null;
                              }
                              if (profileBrgyCommunitySuggestions.length > 0) setProfileBrgySuggestOpen(true);
                            }}
                            onBlur={() => {
                              profileBrgySuggestBlurTimerRef.current = window.setTimeout(() => {
                                setProfileBrgySuggestOpen(false);
                                profileBrgySuggestBlurTimerRef.current = null;
                              }, 180);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.stopPropagation();
                                if (profileBrgySuggestBlurTimerRef.current) {
                                  clearTimeout(profileBrgySuggestBlurTimerRef.current);
                                  profileBrgySuggestBlurTimerRef.current = null;
                                }
                                setProfileBrgySuggestOpen(false);
                              }
                            }}
                          />
                          {profileBrgySuggestOpen && profileBrgyCommunitySuggestions.length > 0 ? (
                            <ul
                              id="profile-brgy-suggestions-list"
                              role="listbox"
                              className="absolute left-0 right-0 z-[100] mt-1 max-h-48 overflow-auto rounded-lg border border-neutral-200/95 bg-white py-1 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-900"
                            >
                              {profileBrgyCommunitySuggestions.map((row) => (
                                <li key={row.name} role="presentation">
                                  <button
                                    type="button"
                                    role="option"
                                    className="w-full px-3 py-2 text-left hover:bg-brand-soft/50 dark:hover:bg-slate-800"
                                    onMouseDown={(ev) => {
                                      ev.preventDefault();
                                      if (profileBrgySuggestBlurTimerRef.current) {
                                        clearTimeout(profileBrgySuggestBlurTimerRef.current);
                                        profileBrgySuggestBlurTimerRef.current = null;
                                      }
                                      setProfileDraft((prev) => ({
                                        ...prev,
                                        addressApartment: row.name,
                                        addressCity: prev.addressCity.trim()
                                          ? prev.addressCity
                                          : row.city || prev.addressCity,
                                        addressProvince: prev.addressProvince.trim()
                                          ? prev.addressProvince
                                          : row.province || prev.addressProvince,
                                        addressPostalCode: prev.addressPostalCode.trim()
                                          ? prev.addressPostalCode
                                          : row.postalCode || prev.addressPostalCode,
                                      }));
                                      setProfileBrgySuggestOpen(false);
                                    }}
                                  >
                                    <span className="font-medium text-neutral-900 dark:text-slate-100">{row.name}</span>
                                    {row.city || row.province ? (
                                      <span className="mt-0.5 block text-xs text-neutral-500 dark:text-slate-400">
                                        {[row.city, row.province].filter(Boolean).join(" · ")}
                                      </span>
                                    ) : null}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </div>
                        <div className="min-w-0">
                        <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-address-city">
                          City
                        </label>
                        <input
                          id="profile-address-city"
                          name="addressCity"
                          type="text"
                          autoComplete="address-level2"
                          className="input-base mt-1"
                          value={profileDraft.addressCity}
                          onChange={(e) => setProfileDraft((prev) => ({ ...prev, addressCity: e.target.value }))}
                        />
                      </div>
                        <div className="min-w-0">
                        <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-address-province">
                          Province
                        </label>
                        <input
                          id="profile-address-province"
                          name="addressProvince"
                          type="text"
                          autoComplete="address-level1"
                          className="input-base mt-1"
                          value={profileDraft.addressProvince}
                          onChange={(e) => setProfileDraft((prev) => ({ ...prev, addressProvince: e.target.value }))}
                        />
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-4">
                        <div className="min-w-0">
                        <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-address-country">
                          Country
                        </label>
                        <select
                          id="profile-address-country"
                          name="addressCountry"
                          className="input-base mt-1"
                          value={profileDraft.addressCountry}
                          onChange={(e) => setProfileDraft((prev) => ({ ...prev, addressCountry: e.target.value }))}
                        >
                          {profileDraft.addressCountry && !COUNTRY_OPTIONS.includes(profileDraft.addressCountry) ? (
                            <option value={profileDraft.addressCountry}>{profileDraft.addressCountry}</option>
                          ) : null}
                          <option value="">Select country</option>
                          {COUNTRY_OPTIONS.map((countryName) => (
                            <option key={countryName} value={countryName}>
                              {countryName}
                            </option>
                          ))}
                        </select>
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
                          className="input-base mt-1"
                          value={profileDraft.addressPostalCode}
                          onChange={(e) => setProfileDraft((prev) => ({ ...prev, addressPostalCode: e.target.value }))}
                        />
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-address-url">
                          Address link (Google Maps URL)
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
                    ) : null}
                  </div>
                  <div className="space-y-3 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm ring-1 ring-neutral-100/80 dark:border-slate-700/80 dark:bg-slate-900/70 dark:ring-slate-800/80">
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
                  <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-200/80 pt-5 dark:border-slate-700/80">
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
                  <div className="flex flex-col items-center gap-4 rounded-2xl border border-neutral-200/80 bg-gradient-to-br from-white to-neutral-50 p-5 text-center shadow-sm dark:border-slate-700/80 dark:from-slate-900 dark:to-slate-900/70">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-soft text-2xl font-bold text-brand-primary ring-1 ring-brand-border">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
                      ) : (
                        (String(user?.username || "").trim().charAt(0) || "?").toUpperCase()
                      )}
                    </div>
                    <div className="w-full">
                      <p className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-slate-100">{getDisplayNameFromUser(user)}</p>
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
                  <div className="rounded-2xl border border-neutral-200/80 bg-white px-4 py-4 dark:border-slate-700/80 dark:bg-slate-900/70">
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
                          <span className="font-semibold">{user.phone}</span>
                        </li>
                      ) : null}
                      {user.country ? (
                        <li className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-neutral-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <circle cx="12" cy="12" r="10" />
                            <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
                          </svg>
                          <span>Country: </span>
                          <span className="font-semibold">{user.country}</span>
                        </li>
                      ) : null}
                      {user.address ? (
                        <li className="flex items-start gap-2">
                          <svg className="mt-0.5 h-4 w-4 text-neutral-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span>Address: </span>
                          {user.addressUrl ? (
                            <a
                              href={user.addressUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-brand-primary underline decoration-brand-primary/40 underline-offset-2 hover:text-brand-primary/80"
                            >
                              {user.address}
                            </a>
                          ) : (
                            <span className="font-semibold">{user.address}</span>
                          )}
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
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                        sellerTab === id
                          ? "bg-brand-soft text-brand-primary ring-2 ring-brand-primary/30 dark:bg-slate-800 dark:text-slate-100"
                          : "border border-neutral-200/90 text-neutral-700 hover:bg-neutral-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
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
                      <button
                        type="button"
                        className="btn-primary shrink-0 text-sm"
                        onClick={() => {
                          if (!profileBrgyCommunitySubdivision.trim()) {
                            setProfileUploadProductNotice("Add Brgy/Community/Subdivision under Edit profile → Address, then try again.");
                            return;
                          }
                          setProfileUploadProductNotice("");
                          setActiveView(VIEWS.MY_LISTINGS);
                        }}
                      >
                        Upload product
                      </button>
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
                    {sellerListings.length ? (
                      <ul className="mt-3 divide-y divide-neutral-200 dark:divide-slate-700">
                        {sellerListings.map((l) => (
                          <li key={l.id} className="flex flex-col gap-0.5 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                            <span className="font-medium text-neutral-800 dark:text-slate-200">{l.title}</span>
                            <span className="shrink-0 text-neutral-600 dark:text-slate-400">
                              {formatCents(l.priceCents)} · Qty {l.quantity} · {l.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">Publish listings to see them here.</p>
                    )}
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
          <section className="app-card space-y-4 md:space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Users</h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-slate-400">People registered on this app (names only).</p>
            </div>
            {usersLoading && <p className="text-sm text-neutral-600 dark:text-slate-400">Loading users...</p>}
            {usersError && <p className="app-alert-danger-text text-sm">{usersError}</p>}
            {!usersLoading && !usersError && (
              <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-slate-700 dark:border-slate-600">
                {usersList.length === 0 && <li className="px-4 py-6 text-sm text-neutral-500 dark:text-slate-400">No users yet.</li>}
                {usersList.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span className="font-medium text-neutral-900 dark:text-slate-100">{formatDisplayName(u.name)}</span>
                    {u.joinedAt && (
                      <span className="text-xs text-neutral-500 dark:text-slate-400">{new Date(u.joinedAt).toLocaleDateString()}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

      </main>

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
                  New community
                </h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-slate-400">
                  Anchor listings to your profile address: Brgy/Community/Subdivision, city, province, and postal code.
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
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="add-community-brgy">
                  Brgy/Community/Subdivision
                </label>
                <input
                  id="add-community-brgy"
                  type="text"
                  readOnly
                  aria-readonly="true"
                  className="input-base w-full cursor-default bg-neutral-100/90 dark:bg-slate-800/80"
                  value={toTitleCase(profileBrgyCommunitySubdivision)}
                  placeholder="— Not set in profile —"
                />
                {!profileBrgyCommunitySubdivision ? (
                  <p className="mt-1.5 text-xs text-neutral-600 dark:text-slate-400">
                    Add it under{" "}
                    <button
                      type="button"
                      className="font-medium text-brand-primary underline decoration-brand-primary/40 underline-offset-2 hover:decoration-brand-primary dark:text-brand-accent dark:decoration-brand-accent/40 dark:hover:decoration-brand-accent"
                      onClick={() => {
                        closeAddCommunityModal();
                        setActiveView(VIEWS.PROFILE);
                      }}
                    >
                      Profile
                    </button>{" "}
                    → Address → Brgy/Community/Subdivision, then open this form again.
                  </p>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="add-community-city">
                    City
                  </label>
                  <input
                    id="add-community-city"
                    type="text"
                    readOnly
                    className="input-base w-full cursor-default bg-neutral-100/90 dark:bg-slate-800/80"
                    value={toTitleCase(profileCityProvincePostal.city)}
                    placeholder="—"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label
                    className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400"
                    htmlFor="add-community-province"
                  >
                    Province
                  </label>
                  <input
                    id="add-community-province"
                    type="text"
                    readOnly
                    className="input-base w-full cursor-default bg-neutral-100/90 dark:bg-slate-800/80"
                    value={toTitleCase(profileCityProvincePostal.province)}
                    placeholder="—"
                  />
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
                    readOnly
                    className="input-base w-full cursor-default bg-neutral-100/90 dark:bg-slate-800/80"
                    value={toTitleCase(profileCityProvincePostal.postalCode)}
                    placeholder="—"
                  />
                </div>
              </div>
              {!profileBrgyCommunitySubdivision ? null : !profileCityProvincePostal.city ||
                !profileCityProvincePostal.province ||
                !profileCityProvincePostal.postalCode ? (
                <p className="text-xs text-neutral-600 dark:text-slate-400">
                  City, province, and postal code come from your saved address. Add them under{" "}
                  <button
                    type="button"
                    className="font-medium text-brand-primary underline decoration-brand-primary/40 underline-offset-2 hover:decoration-brand-primary dark:text-brand-accent dark:decoration-brand-accent/40 dark:hover:decoration-brand-accent"
                    onClick={() => {
                      closeAddCommunityModal();
                      setActiveView(VIEWS.PROFILE);
                    }}
                  >
                    Profile
                  </button>{" "}
                  → Address (City, Province, Postal code), then open this form again.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="btn-primary text-sm"
                  disabled={
                    communitySaving ||
                    !profileBrgyCommunitySubdivision ||
                    !profileCityProvincePostal.city ||
                    !profileCityProvincePostal.province ||
                    !profileCityProvincePostal.postalCode ||
                    profileBrgyCommunitySubdivision.trim().length < 2
                  }
                >
                  {communitySaving ? "Saving…" : "Save community"}
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
