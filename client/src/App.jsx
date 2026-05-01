import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import tabLogo from "./assets/new-icon-only.png";
import landingFeaturesPicture from "./assets/new-auth-landing.png?w=360;480;640;768&format=avif;webp;png&quality=80&as=picture";
import { createSupabaseClient } from "./lib/supabaseClient";
import {
  isLikelySameCommunityName,
  isSameCityAndProvince,
  isSameCommunityLocale,
  levenshteinDistance,
} from "./lib/communityNameSimilarity.js";
import { formatBrowseLabel, getListingCategoryShortLabel, getVerticalById, VERTICALS } from "./categoryNav.js";
import { gradientForId, initialsFromName } from "./communityUi.js";
import { LoggedInHeader } from "./components/LoggedInHeader.jsx";
import {
  LazyPublicListingPage,
  LazyLandingIllustration,
  LazyCommunityShopListingCard,
  DeferredProductDetailStack,
  LazyProductInspectModal,
  LazyOrderBuyerReviewForm,
  LazySellerBuyerFeedbackList,
} from "./appCodeSplit.jsx";
import { ImagetoolsPicture } from "./components/media/ImagetoolsPicture.jsx";
import { StableMediaImage, StableAvatar } from "./components/media/StableMediaImage.jsx";
import { ProductListingMedia } from "./components/media/ProductListingMedia.jsx";
import {
  enrichListingSnapshotForOrderCard,
  LISTING_MAX_IMAGES,
  resolveListingCoverImageUrl,
  resolveListingGalleryUrls,
} from "./lib/listingImageUrl.js";
import { formatCents } from "./marketplace/money.js";
import { COURIER_TABS, SELLER_TABS, VIEWS } from "./views.js";
import {
  clearActiveView,
  readActiveView,
  readAuthToken,
  readThemeMode,
  writeActiveView,
  writeAuthToken,
  writeThemeMode,
} from "./lib/appSession.js";
import { apiRequest, isUnauthorizedApiError } from "./lib/appApi.js";
import {
  migrateLegacyNotificationInboxStorage,
  mergeNotificationInboxLists,
  readLocalSessionNotificationsFromStorage,
  writeLocalSessionNotificationsToStorage,
  NOTIFICATION_INBOX_MAX_ITEMS,
  NOTIFICATION_REALTIME_DEBOUNCE_MS,
  NOTIFICATION_POLL_FALLBACK_MS,
  NOTIFICATION_LOCAL_SESSION_STORAGE_KEY,
  createLocalNotificationId,
  classifyNotificationType,
  fetchNotificationsFromApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  deleteNotificationRemote,
  deleteAllNotificationsRemote,
} from "./lib/marketplaceNotifications.js";
import { UI_KIT } from "./lib/appUiKit.js";
import {
  formatDisplayName,
  getDisplayNameFromUser,
  getProfileCardDisplayNameFromUser,
  PROFILE_GENDER_OPTIONS,
  computeAgeFromBirthday,
} from "./lib/userProfileFormat.js";
import {
  PH_PROVINCE_OPTIONS,
  normalizePhLocalityName,
  toPhilippinesLocalPhone10,
  toPhilippinesE164,
  toPhilippinesLocal11Display,
  normalizePhPostalCode,
  normalizePhPsgcCode,
  formatPhCityMunicipalityName,
  formatCommunityMarketplaceSubtitle,
  stripBrgyPrefixLabel,
  splitAddressParts,
  buildAddressValue,
  toTitleCase,
} from "./lib/philippinesAddress.js";
import {
  formatPesoWhole,
  parseSaleMetaFromDescription,
  removeSaleMetaLines,
  listingCodAvailabilityLabel,
  normalizeListingOptionValues,
  narrowListingOptionValuesForBuyerSelection,
  parseBuyerSelectedVariantsFromComment,
  buildVariantSignatureFromSelections,
  cartLineKey,
  cartLineKeyFromItem,
  cartItemApiQuerySuffix,
  variantSignatureFromBuyerComment,
  buyerCommentDisplayForOrderCard,
} from "./lib/listingSaleMeta.js";
import {
  cartSeenListingIdsStorageKey,
  favoritesSeenListingIdsStorageKey,
  buyerOrderDismissedStorageKey,
  sellerOrderDismissedStorageKey,
  readStoredStringArray,
  readStoredRecentIdsByTab,
  readQuickOrderFulfillmentPref,
  writeQuickOrderFulfillmentPref,
  emptyOrderAttentionByTab,
  RECENT_ORDER_TAB_KEYS,
  ORDERS_STATUS_TABS,
  orderMatchesOrdersStatusTab,
} from "./lib/orderAttentionStorage.js";
import {
  isDeliveryCourierAssigned,
  isDeliveryInTransit,
  isDeliverySellerPreparing,
  orderFulfillmentBannerText,
} from "./lib/orderFulfillmentUi.js";
import { ORDER_CANCELLATION_REASON_OPTIONS } from "./lib/orderCancellationReasons.js";
import { computeMarketplaceFeedbackForText } from "./lib/marketplaceFeedbackToast.js";
import {
  ensureImageFileUnderMaxBytes,
  MAX_AVATAR_IMAGE_BYTES,
  MAX_LISTING_COMMUNITY_IMAGE_BYTES,
} from "./lib/compressImageFile.js";
import { resolveListingImagesForSave } from "./lib/resolveListingImagesForSave.js";
import { LANDING_DISCOVERY_SLIDES, BROWSE_QUICK_FILTERS } from "./lib/landingDiscoveryData.js";
import { quickFilterIcon, categoryIcon } from "./components/browse/BrowseFilterIcons.jsx";
import { SectionHeading } from "./components/marketplace/SectionHeading.jsx";
import { FilterOptionButton } from "./components/marketplace/FilterOptionButton.jsx";
import { CommunityCourierPanel } from "./components/marketplace/CommunityCourierPanel.jsx";
import { CourierPresenceControls } from "./components/marketplace/CourierPresenceControls.jsx";
import { ListingCategoryPicker } from "./components/marketplace/ListingCategoryPicker.jsx";
import { CartSellerSelectAllCheckbox } from "./components/marketplace/CartSellerSelectAllCheckbox.jsx";
import { LandingFeatureRow, LANDING_FEATURE_ROWS } from "./components/landing/LandingFeatureRows.jsx";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeHidePasswordIcon,
  EyeShowPasswordIcon,
  LandingSiteFooter,
  LinkMartLogo,
} from "./components/landing/LandingMarketing.jsx";
import { ScreenLoading, ScreenEmpty, ScreenError } from "./components/ui/ScreenState.jsx";
import { BrowseGridSkeleton } from "./components/marketplace/MobileBrowseSkeleton.jsx";
import { Button } from "./components/ui/Button.jsx";
import { MobileFormActions } from "./components/ui/MobileFormActions.jsx";
import { validateConfirmPassword, validateEmail, validatePasswordClient } from "./lib/formValidation.js";
import { MobileAppShell } from "./layouts/MobileAppShell.jsx";
import { useBodyScrollLock } from "./hooks/useBodyScrollLock.js";
import { useMobileViewport } from "./hooks/useMobileViewport.js";
import { useMobilePullToRefresh } from "./hooks/useMobilePullToRefresh.js";
import {
  communityBrowseGridClass,
  favoritesGridClass,
  commerceFlowLineItemsClass,
  lmBrowseViewShellClass,
} from "./lib/lmViewLayouts.js";

/** Corner pills on status segmented control — same inset system as `mobileNavBadgeBase`. Rose when tab has unseen attention; muted when badge is queue depth only (all rows dismissed). */
const ORDER_STATUS_TAB_BADGE_BASE =
  "pointer-events-none absolute right-1 top-1 z-[1] inline-flex min-h-[1rem] min-w-[1rem] max-w-[min(2.75rem,calc(100%-0.35rem))] items-center justify-center rounded-full px-[3px] py-px text-[10px] font-bold leading-none shadow-sm";
const ORDER_STATUS_TAB_BADGE_MUTED = `${ORDER_STATUS_TAB_BADGE_BASE} bg-slate-500 text-white dark:bg-slate-600`;
const ORDER_STATUS_TAB_BADGE_ROSE = `${ORDER_STATUS_TAB_BADGE_BASE} bg-rose-600 text-white dark:bg-rose-500`;

/** Best-effort recency for ordering “unseen” pending rows (API field names vary). */
function orderRowSortMs(o) {
  const raw = o?.updatedAt ?? o?.updated_at ?? o?.createdAt ?? o?.created_at ?? 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const COMMUNITY_MEMBERSHIP_KEY_PREFIX = "community_membership_v1:";
/** Set when the user taps Join on a shop; profile+address matching alone misses sparse profiles. */
const COMMUNITY_JOINED_SHOP_ID_KEY_PREFIX = "community_joined_shop_id_v1:";

function readJoinedShopCommunityId(userId) {
  if (typeof window === "undefined" || !userId) return "";
  try {
    return String(localStorage.getItem(`${COMMUNITY_JOINED_SHOP_ID_KEY_PREFIX}${userId}`) || "").trim();
  } catch {
    return "";
  }
}

function writeJoinedShopCommunityId(userId, communityId) {
  if (typeof window === "undefined" || !userId) return;
  try {
    const cid = String(communityId || "").trim();
    if (cid) localStorage.setItem(`${COMMUNITY_JOINED_SHOP_ID_KEY_PREFIX}${userId}`, cid);
    else localStorage.removeItem(`${COMMUNITY_JOINED_SHOP_ID_KEY_PREFIX}${userId}`);
  } catch {
    /* ignore */
  }
}

function listingPriceCents(l) {
  if (Number.isFinite(Number(l?.priceCents))) return Math.max(0, Number(l.priceCents));
  const pesos = Number(l?.pricePesos);
  if (Number.isFinite(pesos)) return Math.max(0, Math.round(pesos * 100));
  return 0;
}

/** Success toast: full visible time before fade; fade length (should match CSS transition) */
const PUBLISH_TOAST_DURATION_MS = 7500;
const PUBLISH_TOAST_FADE_MS = 350;
const LISTING_SORT_OPTIONS = [
  { id: "newest", label: "Sort: Newest" },
  { id: "oldest", label: "Sort: Oldest" },
  { id: "price_asc", label: "Sort: Price low-high" },
  { id: "price_desc", label: "Sort: Price high-low" },
  { id: "name_asc", label: "Sort: Name A-Z" },
  { id: "name_desc", label: "Sort: Name Z-A" },
];
/** Seller snapshot polling while away from Sales inbox — complements Supabase Realtime for nav badge latency. */
const SELLER_ORDERS_POLL_MS = 28_000;
/** Coalesce bursty `orders` row events without delaying badge updates too much. */
const ORDERS_REALTIME_DEBOUNCE_MS = 200;
/** Coalesce bursty chat events for immediate but efficient conversation updates. */
const CHAT_REALTIME_DEBOUNCE_MS = 220;
/** Preset variant types (first and second group use the same list; Custom allows free text). */
const LISTING_VARIANT_TYPES = [
  "Size",
  "Color",
  "Flavor",
  "Material",
  "Style",
  "Weight",
  "Volume",
  "Pack size",
  "Custom",
];
const LISTING_VARIANT_SELECT_CUSTOM = "__custom__";
const LISTING_OPTION_VALUE_SUGGESTIONS = {
  size: ["Small", "Medium", "Large"],
  color: ["Red", "Blue", "Black"],
  flavor: ["Vanilla", "Chocolate"],
  material: ["Cotton", "Wood", "Metal", "Plastic"],
  style: ["Classic", "Modern", "Sport"],
  weight: ["250g", "500g", "1kg"],
  volume: ["250ml", "500ml", "1L"],
  "pack size": ["Single", "3-pack", "6-pack"],
  condition: ["Brand New", "Like New", "Used - Good", "Used - Fair"],
};
const LISTING_PROCESSING_TIME_PRESETS = ["1 day", "2-3 days", "5-7 days", "2 weeks"];
/** Shortcut presets for in-stock “Ready in” (estimated ready time). */
const LISTING_READY_IN_PRESETS = ["Same day", "2 hours", "Tomorrow", "1–2 days"];
/** Upload form: one-tap quantity quick picks — low counts + common stock levels. */
const LISTING_QUANTITY_PRESETS = [1, 2, 5, 10, 25, 50, 100];

function normalizeListingImageUrlKey(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  try {
    return new URL(s).href;
  } catch {
    return s;
  }
}

/** Preserve order; drop duplicate image URLs (same resource after normalization). */
function dedupeListingImageUrlsOrdered(urls) {
  const seen = new Set();
  const out = [];
  for (const raw of urls || []) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) continue;
    const key = normalizeListingImageUrlKey(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/** Stable identity for uploaded / cropped image bytes (same file → same hash). */
async function sha256HexFromBlob(blob) {
  if (!blob || typeof blob.arrayBuffer !== "function") return "";
  try {
    const buf = await blob.arrayBuffer();
    const hashBuf = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}

function splitOptionValuesCsv(raw) {
  return String(raw || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function getListingOptionValueSuggestions(optionName) {
  const key = String(optionName || "").trim().toLowerCase();
  return LISTING_OPTION_VALUE_SUGGESTIONS[key] || [];
}

function listingVariantTypeSelectValue(optionName) {
  const n = String(optionName || "").trim();
  if (!n) return "";
  if (LISTING_VARIANT_TYPES.includes(n)) return n;
  return LISTING_VARIANT_SELECT_CUSTOM;
}

function filterVariantTypesExcluding(excludeTrimmed) {
  const ex = String(excludeTrimmed || "").trim().toLowerCase();
  if (!ex) return LISTING_VARIANT_TYPES;
  return LISTING_VARIANT_TYPES.filter((t) => t.toLowerCase() !== ex);
}

/** On blur: normalize casing or snap typos to the closest preset (within edit distance). */
function resolveVariantTypeOnBlur(raw, candidates) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  const exact = candidates.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;

  let best = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    const cl = c.toLowerCase();
    let score = levenshteinDistance(lower, cl);
    for (const part of cl.split(/\s+/)) {
      if (part.length) score = Math.min(score, levenshteinDistance(lower, part));
    }
    if (cl.startsWith(lower) && lower.length > 0) {
      score = Math.min(score, 0.02 + (cl.length - lower.length) * 0.001);
    }
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  if (best != null && bestScore <= 3) return best;
  return trimmed;
}

/** Single nearest preset for inline hint; null if empty, exact match, or no close match. */
function nearestVariantTypeSuggestion(typed, candidates) {
  const q = String(typed || "").trim();
  if (!q) return null;
  const ql = q.toLowerCase();
  if (candidates.some((c) => c.toLowerCase() === ql)) return null;

  let best = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    const cl = c.toLowerCase();
    let score = levenshteinDistance(ql, cl);
    for (const part of cl.split(/\s+/)) {
      if (part.length) score = Math.min(score, levenshteinDistance(ql, part));
    }
    if (cl.startsWith(ql)) {
      score = Math.min(score, 0.02 + (cl.length - ql.length) * 0.001);
    }
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  if (best == null || bestScore > 3) return null;
  return best;
}

function findDuplicateChoiceCaseInsensitive(parts) {
  const seen = new Set();
  for (const p of parts) {
    const s = String(p || "").trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) return s;
    seen.add(k);
  }
  return null;
}

function loadImageElementFromFile(file) {
  return new Promise((resolve, reject) => {
    try {
      const src = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(src);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(src);
        reject(new Error("Could not read image."));
      };
      img.src = src;
    } catch (e) {
      reject(e);
    }
  });
}

function clampNumber(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

async function cropImageFileToSquareByRect(file, cropLeft = 0.1, cropTop = 0.1, cropSize = 1, outputSize = 1080) {
  const img = await loadImageElementFromFile(file);
  const w = Math.max(1, Number(img.naturalWidth || 1));
  const h = Math.max(1, Number(img.naturalHeight || 1));
  const shortest = Math.max(1, Math.min(w, h));
  const normalizedSize = clampNumber(Number(cropSize) || 1, 0.2, 1);
  const side = Math.max(1, Math.floor(shortest * normalizedSize));
  const leftMax = Math.max(0, w - side);
  const topMax = Math.max(0, h - side);
  const sx = clampNumber(Math.round((clampNumber(Number(cropLeft) || 0, 0, 1) * w)), 0, leftMax);
  const sy = clampNumber(Math.round((clampNumber(Number(cropTop) || 0, 0, 1) * h)), 0, topMax);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  ctx.drawImage(img, sx, sy, side, side, 0, 0, outputSize, outputSize);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed."))), "image/jpeg", 0.92);
  });
  const baseName = String(file?.name || "listing-image").replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}-square.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

/** Mobile: honor list + grid; map legacy dense (compact) to grid. Desktop compact unchanged. */
function normalizeMobileProductBrowseView(view) {
  if (view === "list" || view === "grid") return view;
  if (view === "compact") return "grid";
  return "grid";
}

function ProductViewDensityToggle({
  value,
  onChange,
  /** When false (e.g. mobile), Dense is hidden; compact preference maps to Grid for display. */
  allowCompact = true,
  /** Minimal: low-contrast chrome for phones (icon-first; active uses teal ring). */
  variant = "default",
  groupAriaLabel = "Product layout",
  gridTitle = "Grid — columns fit your screen (comfortable cards)",
  compactTitle = "Compact — more tiles per row, shorter cards",
}) {
  const displayValue = !allowCompact && value === "compact" ? "grid" : value;
  const isMinimal = variant === "minimal";
  const wrapClass = isMinimal ? "lm-view-toggle lm-view-toggle--minimal" : "lm-view-toggle lm-view-toggle--default";
  const btn = (isActive) => {
    const base = "lm-view-toggle-button lm-btn-segment";
    if (isActive) {
      if (isMinimal) return `${base} lm-view-toggle-button-active lm-btn-segment-active-muted`;
      return `${base} lm-view-toggle-button-active lm-btn-segment-active`;
    }
    return isMinimal ? `${base} lm-btn-segment-idle-minimal` : `${base} lm-btn-segment-idle`;
  };
  const labelClass = isMinimal ? "sr-only" : "hidden pl-1 md:inline";
  const iconCls = "h-4 w-4 shrink-0";
  return (
    <div className={wrapClass} role="group" aria-label={groupAriaLabel}>
      <button
        type="button"
        className={btn(displayValue === "list")}
        aria-label="List view"
        title="List — full-width rows"
        onClick={() => onChange("list")}
      >
        <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
        <span className={labelClass}>List</span>
      </button>
      <button
        type="button"
        className={btn(displayValue === "grid")}
        aria-label="Grid view"
        title={gridTitle}
        onClick={() => onChange("grid")}
      >
        <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <span className={labelClass}>Grid</span>
      </button>
      {allowCompact ? (
        <button
          type="button"
          className={btn(value === "compact")}
          aria-label="Compact grid"
          title={compactTitle}
          onClick={() => onChange("compact")}
        >
          <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="2" y="2" width="5" height="5" rx="0.5" />
            <rect x="9.5" y="2" width="5" height="5" rx="0.5" />
            <rect x="17" y="2" width="5" height="5" rx="0.5" />
            <rect x="2" y="9.5" width="5" height="5" rx="0.5" />
            <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
            <rect x="17" y="9.5" width="5" height="5" rx="0.5" />
            <rect x="2" y="17" width="5" height="5" rx="0.5" />
            <rect x="9.5" y="17" width="5" height="5" rx="0.5" />
            <rect x="17" y="17" width="5" height="5" rx="0.5" />
          </svg>
          <span className="hidden pl-1 md:inline">Dense</span>
        </button>
      ) : null}
    </div>
  );
}

const COMMERCE_FLOW_BUYER_STORAGE_KEY = "linkmart_commerce_flow_buyer_v1";
const COMMERCE_FLOW_SELLER_STORAGE_KEY = "linkmart_commerce_flow_seller_v1";
/** Legacy single key — migrated once into buyer/seller keys. */
const COMMERCE_FLOW_VIEW_STORAGE_KEY_LEGACY = "linkmart_commerce_flow_view_v1";
const CHAT_THREADS_STORAGE_KEY = "linkmart_chat_threads_v1";
const CHAT_MESSAGES_MAX_PER_THREAD = 250;
const chatStorageKeyForUser = (userId) => `${CHAT_THREADS_STORAGE_KEY}:${String(userId || "").trim()}`;

function createChatMessageId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `chat-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function readChatThreadsFromStorage(userId) {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = window.localStorage.getItem(chatStorageKeyForUser(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((thread) => ({
        conversationId: String(thread?.conversationId || "").trim(),
        participantId: String(thread?.participantId || "").trim(),
        unread: Math.max(0, Number(thread?.unread || 0)),
        messagesLoaded: !!thread?.messagesLoaded,
        messages: Array.isArray(thread?.messages)
          ? thread.messages
              .map((m) => ({
                id: String(m?.id || "").trim(),
                senderId: String(m?.senderId || "").trim(),
                text: String(m?.text || "").trim(),
                createdAt: Number(m?.createdAt || 0),
              }))
              .filter((m) => m.id && m.senderId && m.text && Number.isFinite(m.createdAt))
          : [],
      }))
      .filter((thread) => thread.participantId);
  } catch {
    return [];
  }
}

function toChatMessageFromApi(msg) {
  const createdAtMs = new Date(msg?.createdAt || msg?.created_at || 0).getTime();
  return {
    id: String(msg?.id || "").trim(),
    senderId: String(msg?.senderId || msg?.sender_id || "").trim(),
    text: String(msg?.body || msg?.text || "").trim(),
    createdAt: Number.isFinite(createdAtMs) ? createdAtMs : Date.now(),
  };
}

function toChatThreadFromConversation(conversation, currentUserId) {
  const me = String(currentUserId || "").trim();
  const participants = Array.isArray(conversation?.participants) ? conversation.participants : [];
  const other = participants.find((p) => String(p?.userId || "") !== me) || null;
  const participantId = String(other?.userId || "").trim();
  const lastMessage = conversation?.lastMessage ? toChatMessageFromApi(conversation.lastMessage) : null;
  const lastReadMessageId = String(conversation?.readState?.lastReadMessageId || "").trim();
  const unread = lastMessage && lastMessage.senderId !== me && lastReadMessageId !== lastMessage.id ? 1 : 0;
  return {
    conversationId: String(conversation?.id || "").trim(),
    participantId,
    unread,
    messages: lastMessage ? [lastMessage] : [],
    messagesLoaded: false,
  };
}

function normalizeCommerceFlowView(v) {
  if (v === "list" || v === "grid" || v === "compact") return v;
  return "list";
}

function readCommerceFlowFromStorage(primaryKey) {
  if (typeof window === "undefined") return "list";
  try {
    const direct = window.localStorage.getItem(primaryKey);
    if (direct != null && String(direct).trim() !== "") return normalizeCommerceFlowView(direct);
    const legacy = window.localStorage.getItem(COMMERCE_FLOW_VIEW_STORAGE_KEY_LEGACY);
    if (legacy != null && String(legacy).trim() !== "") return normalizeCommerceFlowView(legacy);
  } catch {
    /* ignore */
  }
  return "list";
}

migrateLegacyNotificationInboxStorage();

/** Buyer note on orders — API usually maps DB `buyer_comment` → `comment`; accept both + camelCase. */
function orderBuyerCommentRaw(o) {
  return String(o?.comment ?? o?.buyer_comment ?? o?.buyerComment ?? "").trim();
}

/**
 * Merged order cards may bundle several DB rows under one `representativeOrder`.
 * Prefer any sibling row whose comment parses `Selected:` so variant chips narrow like cart lines.
 */
function pickMergedOrderCommentForVariantChips(entry, ordersList) {
  const ids = Array.isArray(entry?.orderIds) ? entry.orderIds : [];
  let best = "";
  let bestRank = -1;
  for (const id of ids) {
    const ord = ordersList.find((x) => String(x?.id ?? "") === String(id || ""));
    if (!ord) continue;
    const c = orderBuyerCommentRaw(ord);
    const parsed = parseBuyerSelectedVariantsFromComment(c);
    const rank = parsed ? 2 : c.length > 0 ? 1 : 0;
    if (rank > bestRank || (rank === bestRank && c.length > best.length)) {
      bestRank = rank;
      best = c;
    }
  }
  if (bestRank >= 0) return best;
  return orderBuyerCommentRaw(entry?.representativeOrder);
}

/**
 * Pending (buyer) row identity: same as cart `cartLineKey(listingId, variantSignature)`.
 * Parsed `Selected:` → canonical sig; otherwise stable `__order__:id` so different DB rows never fold
 * when comments are missing or unparsed (cart never merges unknown variant lines).
 */
/** Persists line total on the order row — use for display instead of live `listing.priceCents`. */
function orderLineUnitPriceCents(order) {
  const q = Math.max(1, Math.floor(Number(order?.quantity) || 1));
  const goods = Math.max(0, Number(order?.codGoodsCents ?? order?.cod_goods_cents) || 0);
  return Math.round(goods / q);
}

function buyerPendingOrderMergeKey(order) {
  const listingId = String(order?.listingId || "");
  const fromApi = String(order?.variantSignature ?? order?.variant_signature ?? "").trim();
  const fromComment = variantSignatureFromBuyerComment(orderBuyerCommentRaw(order));
  const canonical = fromApi || fromComment;
  const variantSig = canonical || `__order__:${String(order?.id || "").trim() || "unknown"}`;
  return cartLineKey(listingId, variantSig);
}

/** When folding duplicate buyer orders, keep the row with persisted variantSignature or best `Selected:` comment. */
function betterRepresentativeOrderForVariants(prevOrder, nextOrder) {
  const sigP = String(prevOrder?.variantSignature ?? prevOrder?.variant_signature ?? "").trim();
  const sigN = String(nextOrder?.variantSignature ?? nextOrder?.variant_signature ?? "").trim();
  if (sigN && !sigP) return nextOrder;
  if (sigP && !sigN) return prevOrder;
  const a = orderBuyerCommentRaw(prevOrder);
  const b = orderBuyerCommentRaw(nextOrder);
  const mapA = parseBuyerSelectedVariantsFromComment(a);
  const mapB = parseBuyerSelectedVariantsFromComment(b);
  if (mapB && !mapA) return nextOrder;
  if (mapA && !mapB) return prevOrder;
  if (b.length > a.length) return nextOrder;
  return prevOrder;
}

function pickMergedOrderVariantSignature(entry, ordersList) {
  const ids = Array.isArray(entry?.orderIds) ? entry.orderIds : [];
  for (const id of ids) {
    const ord = ordersList.find((x) => String(x?.id ?? "") === String(id || ""));
    if (!ord) continue;
    const s = String(ord?.variantSignature ?? ord?.variant_signature ?? "").trim();
    if (s) return s;
  }
  return "";
}

function buildQuickAddMergedComment(listing, userComment, selA, selB, maxLen) {
  const parts = [];
  const nA = String(listing?.optionNameA || "").trim();
  const nB = String(listing?.optionNameB || "").trim();
  const va = normalizeListingOptionValues(listing?.optionValuesA);
  const vb = normalizeListingOptionValues(listing?.optionValuesB);
  const trimmedA = String(selA || "").trim();
  const trimmedB = String(selB || "").trim();
  if (nA && va.length && trimmedA) parts.push(`${nA}: ${trimmedA}`);
  if (nB && vb.length && trimmedB) parts.push(`${nB}: ${trimmedB}`);
  const variantLine = parts.length ? `Selected: ${parts.join(" · ")}\n\n` : "";
  const user = String(userComment || "").trim();
  let full = `${variantLine}${user}`.trim();
  if (typeof maxLen === "number" && maxLen > 0 && full.length > maxLen) {
    full = full.slice(0, maxLen);
  }
  return full;
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
  const [token, setToken] = useState(() => readAuthToken());
  const authTokenRef = useRef("");
  authTokenRef.current = token;
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
      writeAuthToken(accessToken);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const accessToken = session?.access_token || "";
      if (!accessToken) return;
      setToken(accessToken);
      writeAuthToken(accessToken);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const [message, setMessage] = useState("");
  const [authInlineErrors, setAuthInlineErrors] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    terms: "",
  });
  const [theme, setTheme] = useState(() => {
    try {
      return typeof window !== "undefined" && readThemeMode() === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const [landingDiscoverySlide, setLandingDiscoverySlide] = useState(0);
  const [usersList, setUsersList] = useState([]);
  const usersListRef = useRef([]);
  usersListRef.current = usersList;
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [chatThreads, setChatThreads] = useState([]);
  const [activeChatUserId, setActiveChatUserId] = useState("");
  const [chatComposer, setChatComposer] = useState("");
  const [chatSendPending, setChatSendPending] = useState(false);
  const [chatDraftByUserId, setChatDraftByUserId] = useState({});
  const [messagesMobilePane, setMessagesMobilePane] = useState("list");
  const [messagesMobileListTab, setMessagesMobileListTab] = useState("conversations");
  const chatThreadViewportRef = useRef(null);
  const chatComposerInputRef = useRef(null);
  const [messagePeopleSearch, setMessagePeopleSearch] = useState("");
  const lastReadSyncKeyRef = useRef("");
  const [messagePeopleCommunityFilter, setMessagePeopleCommunityFilter] = useState("all");
  const [messagePeopleSort, setMessagePeopleSort] = useState("name_asc");
  const [profileJoinedAt, setProfileJoinedAt] = useState("");
  const [profileJoinedAtResolved, setProfileJoinedAtResolved] = useState(false);

  const [activeView, setActiveView] = useState(() => {
    const savedView = readActiveView();
    if (savedView && Object.values(VIEWS).includes(savedView)) {
      if (savedView === VIEWS.SELLER) return VIEWS.PROFILE;
      return savedView;
    }
    return VIEWS.BROWSE;
  });
  const isBrowseLikeView = useMemo(
    () => activeView === VIEWS.BROWSE || activeView === VIEWS.COMMUNITY_SHOP || activeView === VIEWS.FAVORITES,
    [activeView],
  );
  const secondaryMobileNavOrder = useMemo(
    () => [VIEWS.BROWSE, VIEWS.CART, VIEWS.MY_PURCHASES, VIEWS.ORDERS, VIEWS.NOTIFICATIONS, VIEWS.PROFILE],
    [],
  );
  const secondarySwipeNavView = useMemo(() => {
    if ([VIEWS.BROWSE, VIEWS.COMMUNITY_SHOP, VIEWS.FAVORITES].includes(activeView)) return VIEWS.BROWSE;
    return activeView;
  }, [activeView]);
  const previousActiveViewRef = useRef(activeView);
  const secondarySwipeRef = useRef({
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    t: 0,
    width: 0,
    tracking: false,
    horizontal: false,
    baseView: VIEWS.BROWSE,
  });
  const secondaryDragRafRef = useRef(0);
  const secondaryDragPendingXRef = useRef(0);
  const swipeSettleTimerRef = useRef(0);
  const [mobileSecondarySlideClass, setMobileSecondarySlideClass] = useState("");
  const [mobileSecondaryDragX, setMobileSecondaryDragX] = useState(0);
  const [mobileSecondaryDragging, setMobileSecondaryDragging] = useState(false);
  /** True while `<main>` animates transform back to 0 after a cancelled swipe. */
  const [mobileSecondarySwipeSettling, setMobileSecondarySwipeSettling] = useState(false);
  const previousViewForMarketplaceScrollResetRef = useRef(activeView);
  useEffect(() => {
    const prev = previousActiveViewRef.current;
    const next = secondarySwipeNavView;
    previousActiveViewRef.current = next;
    const isMobileNow =
      typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false;
    if (!isMobileNow) {
      setMobileSecondarySlideClass("");
      return undefined;
    }
    const prevIndex = secondaryMobileNavOrder.indexOf(prev);
    const nextIndex = secondaryMobileNavOrder.indexOf(next);
    if (prevIndex === -1 || nextIndex === -1 || prevIndex === nextIndex) return undefined;
    setMobileSecondarySlideClass(nextIndex > prevIndex ? "lm-view-slide-left" : "lm-view-slide-right");
    const timerId = window.setTimeout(() => setMobileSecondarySlideClass(""), 240);
    return () => window.clearTimeout(timerId);
  }, [secondarySwipeNavView, secondaryMobileNavOrder]);

  useEffect(() => {
    const saved = readActiveView();
    if (saved === VIEWS.SELLER) setSellerTab(SELLER_TABS.PRODUCTS);
  }, []);
  useEffect(() => {
    const prev = previousViewForMarketplaceScrollResetRef.current;
    previousViewForMarketplaceScrollResetRef.current = activeView;
    const enteredMarketplaceFeed =
      (activeView === VIEWS.BROWSE || activeView === VIEWS.COMMUNITY_SHOP) &&
      prev !== VIEWS.BROWSE &&
      prev !== VIEWS.COMMUNITY_SHOP;
    if (!enteredMarketplaceFeed) return;
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      const main = document.getElementById("main-content");
      if (main) main.scrollTop = 0;
      window.scrollTo(0, 0);
    });
  }, [activeView]);
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
  const [sellerListingsFetchError, setSellerListingsFetchError] = useState("");
  const [listingsLoading, setListingsLoading] = useState(false);
  /** True while refetching listings when we already show rows (manual refresh / pull-to-refresh). */
  const [listingsRefreshing, setListingsRefreshing] = useState(false);
  const listingsLengthRef = useRef(0);
  const listingsBusyRef = useRef(false);
  const [listingsError, setListingsError] = useState("");
  useEffect(() => {
    listingsLengthRef.current = listings.length;
  }, [listings.length]);
  useEffect(() => {
    listingsBusyRef.current = listingsLoading || listingsRefreshing;
  }, [listingsLoading, listingsRefreshing]);
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesFetchError, setFavoritesFetchError] = useState("");
  const [favoritesList, setFavoritesList] = useState([]);
  const favoritesListRef = useRef([]);
  favoritesListRef.current = favoritesList;
  const [orders, setOrders] = useState([]);
  const ordersRef = useRef([]);
  ordersRef.current = orders;
  const [ordersRole, setOrdersRole] = useState("buyer");
  const [ordersStatusTab, setOrdersStatusTab] = useState("pending");
  const activeViewRef = useRef(activeView);
  const ordersRoleRef = useRef(ordersRole);
  useEffect(() => {
    activeViewRef.current = activeView;
    ordersRoleRef.current = ordersRole;
  }, [activeView, ordersRole]);
  useEffect(() => {
    if (activeView === VIEWS.PRODUCT_DETAIL) return;
    writeActiveView(activeView);
  }, [activeView]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersFetchError, setOrdersFetchError] = useState("");
  /** `orderId` -> selected (orders screen only). */
  const [orderSelection, setOrderSelection] = useState({});
  /** Which bulk order transition is in flight (`seller_accept` | `cancel`) — only that action shows loading on its button. */
  const [ordersBulkActionLoadingTransition, setOrdersBulkActionLoadingTransition] = useState(/** @type {string | null} */ (null));
  /** Seller orders loaded for the Courier hub view (separate from `orders` + ORDERS tab). */
  const [courierHubOrders, setCourierHubOrders] = useState([]);
  /** Buyer orders for Courier hub “Your purchases” tab. */
  const [courierHubBuyerOrders, setCourierHubBuyerOrders] = useState([]);
  const [courierHubLoading, setCourierHubLoading] = useState(false);
  /** Open delivery jobs in the member’s community (tab badge on Deliver). */
  const [courierOpenDeliveryCount, setCourierOpenDeliveryCount] = useState(0);
  const [orderCancelReasonModalOpen, setOrderCancelReasonModalOpen] = useState(false);
  const [orderCancelReasonId, setOrderCancelReasonId] = useState("");
  const [orderCancelNote, setOrderCancelNote] = useState("");
  const [leaveCommunityConfirmOpen, setLeaveCommunityConfirmOpen] = useState(false);
  /** Order ids the user has marked “seen” per status tab (localStorage per user). Unseen rows drive badges + highlights. */
  const [buyerOrderDismissedIdsByTab, setBuyerOrderDismissedIdsByTab] = useState(() => emptyOrderAttentionByTab());
  const [sellerOrderDismissedIdsByTab, setSellerOrderDismissedIdsByTab] = useState(() => emptyOrderAttentionByTab());

  useEffect(() => {
    if (!user?.id) {
      setBuyerOrderDismissedIdsByTab(emptyOrderAttentionByTab());
      setSellerOrderDismissedIdsByTab(emptyOrderAttentionByTab());
      return;
    }
    setBuyerOrderDismissedIdsByTab(readStoredRecentIdsByTab(buyerOrderDismissedStorageKey(user.id)));
    setSellerOrderDismissedIdsByTab(readStoredRecentIdsByTab(sellerOrderDismissedStorageKey(user.id)));
  }, [user?.id]);

  useEffect(() => {
    try {
      if (typeof window === "undefined" || !user?.id) return;
      window.localStorage.setItem(buyerOrderDismissedStorageKey(user.id), JSON.stringify(buyerOrderDismissedIdsByTab));
    } catch {
      // ignore
    }
  }, [user?.id, buyerOrderDismissedIdsByTab]);

  useEffect(() => {
    try {
      if (typeof window === "undefined" || !user?.id) return;
      window.localStorage.setItem(sellerOrderDismissedStorageKey(user.id), JSON.stringify(sellerOrderDismissedIdsByTab));
    } catch {
      // ignore
    }
  }, [user?.id, sellerOrderDismissedIdsByTab]);

  /** Seller orders from `/orders?role=seller` while not on the seller Orders screen — Selling nav badges. */
  const [polledSellerOrders, setPolledSellerOrders] = useState(null);
  /** Buyer orders while in seller mode — Buying nav badges. */
  const [polledBuyerOrders, setPolledBuyerOrders] = useState(null);
  const polledSellerOrdersRef = useRef(null);
  const polledBuyerOrdersRef = useRef(null);
  polledSellerOrdersRef.current = polledSellerOrders;
  polledBuyerOrdersRef.current = polledBuyerOrders;

  const sellerOrdersForBadges = useMemo(() => {
    if (ordersRole === "seller" && activeView === VIEWS.ORDERS) return orders;
    if (polledSellerOrders === null) return null;
    return polledSellerOrders;
  }, [ordersRole, activeView, orders, polledSellerOrders]);

  const buyerOrdersForBadges = useMemo(() => {
    if (ordersRole === "buyer") return orders;
    if (polledBuyerOrders === null) return null;
    return polledBuyerOrders;
  }, [ordersRole, orders, polledBuyerOrders]);
  const buyerOrdersForBadgesRef = useRef(buyerOrdersForBadges);
  const sellerOrdersForBadgesRef = useRef(sellerOrdersForBadges);
  useEffect(() => {
    buyerOrdersForBadgesRef.current = buyerOrdersForBadges;
  }, [buyerOrdersForBadges]);
  useEffect(() => {
    sellerOrdersForBadgesRef.current = sellerOrdersForBadges;
  }, [sellerOrdersForBadges]);

  const dismissBuyerOrdersForTab = useCallback((tabId, list) => {
    const ids = (list || [])
      .filter((o) => orderMatchesOrdersStatusTab(o.status, tabId))
      .map((o) => String(o.id || ""))
      .filter(Boolean);
    if (!ids.length) return;
    setBuyerOrderDismissedIdsByTab((prev) => {
      const set = new Set(prev[tabId] ?? []);
      ids.forEach((id) => set.add(id));
      return { ...prev, [tabId]: Array.from(set) };
    });
  }, []);

  const dismissSellerOrdersForTab = useCallback((tabId, list) => {
    const ids = (list || [])
      .filter((o) => orderMatchesOrdersStatusTab(o.status, tabId))
      .map((o) => String(o.id || ""))
      .filter(Boolean);
    if (!ids.length) return;
    setSellerOrderDismissedIdsByTab((prev) => {
      const set = new Set(prev[tabId] ?? []);
      ids.forEach((id) => set.add(id));
      return { ...prev, [tabId]: Array.from(set) };
    });
  }, []);
  const markBuyerOrderAsUnseenInTab = useCallback((tabId, orderId) => {
    const id = String(orderId || "");
    if (!id) return;
    setBuyerOrderDismissedIdsByTab((prev) => {
      const current = Array.isArray(prev?.[tabId]) ? prev[tabId] : [];
      if (!current.includes(id)) return prev;
      return {
        ...prev,
        [tabId]: current.filter((x) => String(x) !== id),
      };
    });
  }, []);

  const [orderListingsById, setOrderListingsById] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [expenseDraft, setExpenseDraft] = useState({ amountPesos: "", category: "supplies", note: "" });
  const [listingForm, setListingForm] = useState({
    title: "",
    description: "",
    pricePesos: "",
    quantity: "",
    categories: "",
    subId: "all",
    optionNameA: "",
    optionValuesA: "",
    optionNameB: "",
    optionValuesB: "",
    orderType: "in_stock",
    processingTime: "",
    pickup: false,
    delivery: false,
  });
  const [listingImageFile, setListingImageFile] = useState(null);
  const [listingImagePreviewUrl, setListingImagePreviewUrl] = useState("");
  const [listingCoverContentHash, setListingCoverContentHash] = useState("");
  const [listingExtraImages, setListingExtraImages] = useState([]);
  const [listingCropQueue, setListingCropQueue] = useState([]);
  const [listingCropEditor, setListingCropEditor] = useState({
    open: false,
    mode: "new",
    targetId: "",
    sourceFile: null,
    sourcePreviewUrl: "",
    sourcePreviewOwned: false,
    sourceWidth: 1,
    sourceHeight: 1,
    cropLeft: 0.1,
    cropTop: 0.1,
    cropSize: 1,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartLeft: 0.1,
    dragStartTop: 0.1,
  });
  const listingCropViewportRef = useRef(null);
  const [listingCropApplyError, setListingCropApplyError] = useState("");
  /** Upload: tap thumbnail → actions (crop, set as cover, replace cover). */
  const [listingPhotoActionModal, setListingPhotoActionModal] = useState({ open: false, variant: "cover", extraId: "" });
  const [editingListingId, setEditingListingId] = useState(null);
  const [listingImageDragActive, setListingImageDragActive] = useState(false);
  const listingImageInputRef = useRef(null);
  const [listingAdvancedOpen, setListingAdvancedOpen] = useState(false);
  const [listingOptionValueDraftA, setListingOptionValueDraftA] = useState("");
  const [listingOptionValueDraftB, setListingOptionValueDraftB] = useState("");
  const [listingSecondOptionOpen, setListingSecondOptionOpen] = useState(false);
  const [listingSaving, setListingSaving] = useState(false);
  const [listingEditOverlayOpen, setListingEditOverlayOpen] = useState(false);
  /** Inline banner when publish/save listing fails (toast still fires). */
  const [listingPublishError, setListingPublishError] = useState("");
  const [listingFieldErrors, setListingFieldErrors] = useState({});
  /** Stacked marketplace toasts (e.g. multiple “Order placed” while prior toasts are still visible). */
  const [marketplaceToasts, setMarketplaceToasts] = useState([]);
  const [notificationInbox, setNotificationInbox] = useState(() =>
    mergeNotificationInboxLists([], readLocalSessionNotificationsFromStorage()),
  );
  const [notificationsSyncError, setNotificationsSyncError] = useState("");
  const marketplaceToastTimeoutsRef = useRef({});
  const notificationsRealtimeTimerRef = useRef(null);

  const unreadNotificationCount = useMemo(
    () => notificationInbox.reduce((sum, item) => sum + (item.read ? 0 : 1), 0),
    [notificationInbox],
  );

  const refreshNotificationsFromApi = useCallback(async () => {
    if (!token) return;
    try {
      setNotificationsSyncError("");
      const result = await fetchNotificationsFromApi(token);
      if (result.schemaMissing) return;
      setNotificationInbox((prev) => {
        const locals = prev.filter((i) => i.source === "local");
        return mergeNotificationInboxLists(result.notifications || [], locals);
      });
    } catch (e) {
      if (!isUnauthorizedApiError(e)) {
        setNotificationsSyncError("Could not refresh notifications.");
      }
    }
  }, [token]);

  const addNotification = useCallback((raw, { markRead = false } = {}) => {
    const text = String(raw ?? "").trim();
    if (!text) return;
    const item = {
      id: createLocalNotificationId(),
      source: /** @type {const} */ ("local"),
      text,
      title: null,
      createdAt: Date.now(),
      read: !!markRead,
      type: classifyNotificationType(text),
    };
    setNotificationInbox((prev) => {
      const without = prev.filter((p) => p.id !== item.id);
      return [item, ...without].slice(0, NOTIFICATION_INBOX_MAX_ITEMS);
    });
  }, []);

  const markNotificationRead = useCallback(
    async (id) => {
      const sid = String(id || "");
      setNotificationInbox((prev) => prev.map((item) => (item.id === sid ? { ...item, read: true } : item)));
      if (!sid.startsWith("lm-local-") && token) {
        try {
          await markNotificationReadApi(token, sid);
        } catch {
          /* optimistic UI kept */
        }
      }
    },
    [token],
  );

  const markAllNotificationsRead = useCallback(async () => {
    setNotificationInbox((prev) => prev.map((item) => (item.read ? item : { ...item, read: true })));
    if (token) {
      try {
        await markAllNotificationsReadApi(token);
      } catch {
        /* ignore */
      }
    }
  }, [token]);

  const dismissNotification = useCallback(
    async (id) => {
      const sid = String(id || "");
      setNotificationInbox((prev) => prev.filter((item) => item.id !== sid));
      if (!sid.startsWith("lm-local-")) {
        const supabase = createSupabaseClient();
        if (supabase) await deleteNotificationRemote(supabase, sid);
      }
    },
    [],
  );

  const clearNotificationInbox = useCallback(async () => {
    const supabase = createSupabaseClient();
    if (user?.id && supabase) {
      await deleteAllNotificationsRemote(supabase, user.id);
    }
    setNotificationInbox([]);
    try {
      window.localStorage.removeItem(NOTIFICATION_LOCAL_SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  const dismissMarketplaceToast = useCallback((id) => {
    const tid = marketplaceToastTimeoutsRef.current[id];
    if (tid) window.clearTimeout(tid);
    delete marketplaceToastTimeoutsRef.current[id];
    setMarketplaceToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  const clearMarketplaceToasts = useCallback(() => {
    Object.values(marketplaceToastTimeoutsRef.current).forEach((tid) => window.clearTimeout(tid));
    marketplaceToastTimeoutsRef.current = {};
    setMarketplaceToasts([]);
  }, []);
  const pushMarketplaceToast = useCallback((raw) => {
    const text = String(raw ?? "").trim();
    if (!text) return;
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setMarketplaceToasts((prev) => [...prev, { id, text }]);
    addNotification(text);
    const tid = window.setTimeout(() => {
      delete marketplaceToastTimeoutsRef.current[id];
      setMarketplaceToasts((prev) => prev.filter((t) => t.id !== id));
    }, 10000);
    marketplaceToastTimeoutsRef.current[id] = tid;
  }, [addNotification]);

  useEffect(() => {
    writeLocalSessionNotificationsToStorage(notificationInbox);
  }, [notificationInbox]);

  useEffect(() => {
    if (!token || !user?.id) return undefined;

    const debouncedPull = () => {
      if (notificationsRealtimeTimerRef.current) window.clearTimeout(notificationsRealtimeTimerRef.current);
      notificationsRealtimeTimerRef.current = window.setTimeout(() => {
        notificationsRealtimeTimerRef.current = null;
        void refreshNotificationsFromApi();
      }, NOTIFICATION_REALTIME_DEBOUNCE_MS);
    };

    void refreshNotificationsFromApi();

    const supabase = createSupabaseClient();
    let channel = null;
    if (supabase) {
      const uid = String(user.id);
      channel = supabase
        .channel(`lm-notifications-rt:${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
          () => debouncedPull(),
        )
        .subscribe();
    }

    const pollId = window.setInterval(() => void refreshNotificationsFromApi(), NOTIFICATION_POLL_FALLBACK_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshNotificationsFromApi();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(pollId);
      if (notificationsRealtimeTimerRef.current) window.clearTimeout(notificationsRealtimeTimerRef.current);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [token, user?.id, refreshNotificationsFromApi]);

  useEffect(() => {
    if (activeView === VIEWS.NOTIFICATIONS && unreadNotificationCount > 0) {
      void markAllNotificationsRead();
    }
  }, [activeView, unreadNotificationCount, markAllNotificationsRead]);

  useEffect(
    () => () => {
      Object.values(marketplaceToastTimeoutsRef.current).forEach((t) => window.clearTimeout(t));
      marketplaceToastTimeoutsRef.current = {};
    },
    [],
  );
  const [communities, setCommunities] = useState([]);
  const communitiesRef = useRef([]);
  communitiesRef.current = communities;
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [communitiesError, setCommunitiesError] = useState("");
  /** Global Marketplace → Communities directory: filter / sort as the list grows. */
  const [communityDirectoryQuery, setCommunityDirectoryQuery] = useState("");
  const [communityDirectorySort, setCommunityDirectorySort] = useState("name");
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
  /** Join button / explicit membership (UUID); keeps buyer flows working when profile locale is incomplete. */
  const [joinedShopCommunityId, setJoinedShopCommunityId] = useState("");
  useEffect(() => {
    setJoinedShopCommunityId(readJoinedShopCommunityId(user?.id));
  }, [user?.id]);
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
  /** Marketplace “Buy now” requires core contact + location details (lighter than seller upload checklist). */
  const buyNowFromProfile = useMemo(() => {
    const parsedAddress = splitAddressParts(user?.address);
    const checks = [
      [String(user?.username || "").trim().length >= 3, "Username"],
      [toPhilippinesLocalPhone10(user?.phone).length === 10, "Phone number"],
      [String(user?.firstName || "").trim().length >= 2, "First name"],
      [String(user?.lastName || "").trim().length >= 2, "Last name"],
      [String(parsedAddress.addressBarangay || "").trim().length > 0, "Barangay"],
      [String(parsedAddress.addressCity || "").trim().length > 0, "City or Municipality"],
      [String(parsedAddress.addressProvince || "").trim().length > 0, "Province"],
    ];
    const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
    return { ready: missing.length === 0, missing };
  }, [user]);
  const buyNowBlocked = !token || !buyNowFromProfile.ready;
  const buyNowBlockedReason = useMemo(() => {
    if (!token) return "Sign in to buy.";
    if (!buyNowFromProfile.ready) return "Complete your profile to buy.";
    return "";
  }, [token, buyNowFromProfile]);
  useEffect(() => {
    if (buyNowFromProfile.ready) setProfileFinishBannerDismissed(false);
  }, [buyNowFromProfile.ready]);
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
  /** Same membership signals as server counts: `profiles.community_id`, plus text/name fallback + explicit join + creator. */
  const isMemberOfOpenCommunity = useMemo(() => {
    if (!shopCommunityId) return false;
    const sid = String(shopCommunityId);
    if (String(user?.communityId || "").trim() === sid) return true;
    if (String(listingCommunityFromProfile.id || "") === sid) return true;
    if (String(joinedShopCommunityId || "") === sid) return true;
    const openCommunity = communities.find((c) => String(c.id || "") === sid);
    if (openCommunity?.createdBy && String(openCommunity.createdBy) === String(user?.id || "")) return true;
    return false;
  }, [
    communities,
    joinedShopCommunityId,
    listingCommunityFromProfile.id,
    shopCommunityId,
    user?.communityId,
    user?.id,
  ]);
  const getDisplayedMemberCount = useCallback((community) => {
    const raw = community?.memberCount ?? community?.member_count ?? 0;
    const count = Number(raw);
    return Number.isFinite(count) && count >= 0 ? count : 0;
  }, []);
  const directoryCommunities = useMemo(() => {
    let rows = communities.slice();
    const q = communityDirectoryQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter((c) => {
        const name = String(c.name || "").toLowerCase();
        const sub = String(formatCommunityMarketplaceSubtitle(c) || "").toLowerCase();
        const city = String(c.city || "").toLowerCase();
        const prov = String(c.province || "").toLowerCase();
        return name.includes(q) || sub.includes(q) || city.includes(q) || prov.includes(q);
      });
    }
    const countFor = (c) => getDisplayedMemberCount(c);
    if (communityDirectorySort === "members") {
      rows.sort((a, b) => countFor(b) - countFor(a) || String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }));
    } else {
      rows.sort((a, b) =>
        toTitleCase(String(a.name || "").trim()).localeCompare(toTitleCase(String(b.name || "").trim()), undefined, { sensitivity: "base" }),
      );
    }
    return rows;
  }, [communities, communityDirectoryQuery, communityDirectorySort, getDisplayedMemberCount]);
  const prevShopCommunityIdRef = useRef(null);
  /** Avoid clearing listings + duplicate fetch when only `communities` hydration updates `activeCommunity`. */
  const communityShopListingsQueryKeyRef = useRef(null);
  /** Clear orders when `ordersRole` changes; keep rows when re-entering Orders with the same role. */
  const ordersDataQueryKeyRef = useRef(null);
  const communityListingsSyncedRef = useRef(null);
  const skipAutoCommunityBrowseRef = useRef(false);
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
  const [quickAddListing, setQuickAddListing] = useState(null);
  const [quickAddImagePreviewOpen, setQuickAddImagePreviewOpen] = useState(false);
  const [quickAddLightboxImageFailed, setQuickAddLightboxImageFailed] = useState(false);
  const [quickActionType, setQuickActionType] = useState("cart");
  const [quickAddQuantity, setQuickAddQuantity] = useState("1");
  const [quickAddSelectedVariantA, setQuickAddSelectedVariantA] = useState("");
  const [quickAddSelectedVariantB, setQuickAddSelectedVariantB] = useState("");
  const [quickAddComment, setQuickAddComment] = useState("");
  const [quickOrderFulfillmentType, setQuickOrderFulfillmentType] = useState("pickup");
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);
  const [quickAddInlineError, setQuickAddInlineError] = useState("");
  const productFlowOriginRef = useRef({ listingId: "", view: VIEWS.BROWSE, shopCommunityId: null });
  const productInspectReturnRef = useRef({ view: VIEWS.BROWSE, shopCommunityId: null, scrollTop: 0, listingId: "" });
  /** Read-only modal: full listing text + cart/order buyer note. */
  const [productInspect, setProductInspect] = useState(null);
  /** Listing IDs considered “seen” after leaving Cart — mirrors order-tab dismissal (`buyerOrderDismissedIdsByTab`). */
  const [cartSeenListingIds, setCartSeenListingIds] = useState([]);
  /** Favorite listing IDs considered “seen” after leaving Favorites. */
  const [favoriteSeenListingIds, setFavoriteSeenListingIds] = useState([]);
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
  /** Listing ids currently fading out before removal from cart UI. */
  const cartRemovingListingIdsRef = useRef({});
  const [cartRemovingListingIds, setCartRemovingListingIds] = useState([]);
  const cartItemsRef = useRef([]);
  cartItemsRef.current = cartItems;
  useEffect(() => {
    if (!user?.id) {
      setCartSeenListingIds([]);
      setFavoriteSeenListingIds([]);
      return;
    }
    setCartSeenListingIds(readStoredStringArray(cartSeenListingIdsStorageKey(user.id)));
    setFavoriteSeenListingIds(readStoredStringArray(favoritesSeenListingIdsStorageKey(user.id)));
  }, [user?.id]);
  const mergeCartItemsPreservingOrder = useCallback((prevItems, nextItems) => {
    if (!Array.isArray(nextItems)) return [];
    const nextByKey = new Map(nextItems.map((item) => [cartLineKeyFromItem(item), item]));
    const merged = [];
    for (const prevItem of Array.isArray(prevItems) ? prevItems : []) {
      const key = cartLineKeyFromItem(prevItem);
      if (!nextByKey.has(key)) continue;
      merged.push(nextByKey.get(key));
      nextByKey.delete(key);
    }
    for (const remaining of nextByKey.values()) merged.push(remaining);
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
  const startCartItemFadeOut = useCallback((lineKey) => {
    const key = String(lineKey || "");
    if (!key) return;
    setCartRemovingListingIds((prev) => (prev.includes(key) ? prev : [...prev, key]));
    if (cartRemovingListingIdsRef.current[key]) {
      clearTimeout(cartRemovingListingIdsRef.current[key]);
    }
    cartRemovingListingIdsRef.current[key] = window.setTimeout(() => {
      setCartItems((prev) => prev.filter((it) => cartLineKeyFromItem(it) !== key));
      setCartRemovingListingIds((prev) => prev.filter((x) => x !== key));
      delete cartRemovingListingIdsRef.current[key];
    }, 2000);
  }, []);
  const cancelCartItemFadeOut = useCallback((lineKey) => {
    const key = String(lineKey || "");
    if (!key) return;
    if (cartRemovingListingIdsRef.current[key]) {
      clearTimeout(cartRemovingListingIdsRef.current[key]);
      delete cartRemovingListingIdsRef.current[key];
    }
    setCartRemovingListingIds((prev) => prev.filter((x) => x !== key));
  }, []);
  /** Leave Cart → mark current line listing IDs as seen (clears nav badge + row highlights on return). */
  const cartScreenPrevRef = useRef(false);
  useEffect(() => {
    const inCart = activeView === VIEWS.CART;
    if (cartScreenPrevRef.current && !inCart) {
      const ids = (cartItemsRef.current || []).map((it) => String(it?.listingId || "")).filter(Boolean);
      if (ids.length) {
        setCartSeenListingIds((prev) => Array.from(new Set([...prev.map(String), ...ids])));
      }
    }
    cartScreenPrevRef.current = inCart;
  }, [activeView]);

  const favoriteIdsRef = useRef(favoriteIds);
  favoriteIdsRef.current = favoriteIds;
  /** Leave Favorites → mark current favorite IDs as seen (same dismissal model as Cart / order tabs). */
  const favoritesScreenPrevRef = useRef(false);
  useEffect(() => {
    const inFav = activeView === VIEWS.FAVORITES;
    if (favoritesScreenPrevRef.current && !inFav) {
      const ids = Array.from(favoriteIdsRef.current || []).map(String).filter(Boolean);
      if (ids.length) {
        setFavoriteSeenListingIds((prev) => Array.from(new Set([...prev.map(String), ...ids])));
      }
    }
    favoritesScreenPrevRef.current = inFav;
  }, [activeView]);

  useEffect(() => {
    try {
      if (typeof window === "undefined" || !user?.id) return;
      window.localStorage.setItem(cartSeenListingIdsStorageKey(user.id), JSON.stringify(cartSeenListingIds));
    } catch {
      // ignore
    }
  }, [user?.id, cartSeenListingIds]);

  useEffect(() => {
    try {
      if (typeof window === "undefined" || !user?.id) return;
      window.localStorage.setItem(favoritesSeenListingIdsStorageKey(user.id), JSON.stringify(favoriteSeenListingIds));
    } catch {
      // ignore
    }
  }, [user?.id, favoriteSeenListingIds]);

  /** Dismiss a status tab only after user leaves that exact status context. */
  const ordersNavPrevRef = useRef({
    key:
      ordersRole === "buyer" && activeView === VIEWS.MY_PURCHASES
        ? "buyer-mp"
        : ordersRole === "seller" && activeView === VIEWS.ORDERS
          ? "seller-ord"
          : "other",
    tab: ordersStatusTab,
  });
  useEffect(() => {
    const prev = ordersNavPrevRef.current;
    const currentKey =
      ordersRole === "buyer" && activeView === VIEWS.MY_PURCHASES
        ? "buyer-mp"
        : ordersRole === "seller" && activeView === VIEWS.ORDERS
          ? "seller-ord"
          : "other";
    const currentTab = ordersStatusTab;
    const changedContext = prev.key !== currentKey || prev.tab !== currentTab;
    if (!changedContext) return;

    if (prev.key === "buyer-mp" && RECENT_ORDER_TAB_KEYS.includes(prev.tab)) {
      dismissBuyerOrdersForTab(prev.tab, buyerOrdersForBadgesRef.current ?? []);
    }
    if (prev.key === "seller-ord" && RECENT_ORDER_TAB_KEYS.includes(prev.tab)) {
      dismissSellerOrdersForTab(prev.tab, sellerOrdersForBadgesRef.current ?? []);
    }
    ordersNavPrevRef.current = { key: currentKey, tab: currentTab };
  }, [activeView, ordersRole, ordersStatusTab, dismissBuyerOrdersForTab, dismissSellerOrdersForTab]);

  useEffect(() => {
    if (!token) {
      setPolledSellerOrders(null);
      setPolledBuyerOrders(null);
    }
  }, [token]);
  /** Drop “seen” IDs that are no longer in the cart (keeps storage small). */
  useEffect(() => {
    const inCart = new Set(cartItems.map((it) => String(it?.listingId || "")));
    setCartSeenListingIds((prev) => {
      const next = prev.filter((id) => inCart.has(String(id)));
      return next.length === prev.length ? prev : next;
    });
  }, [cartItems]);

  /** Drop seen favorites that were unfavorited. */
  useEffect(() => {
    const fav = new Set(Array.from(favoriteIds).map((id) => String(id)));
    setFavoriteSeenListingIds((prev) => {
      const next = prev.filter((id) => fav.has(String(id)));
      return next.length === prev.length ? prev : next;
    });
  }, [favoriteIds]);
  const [sellerTab, setSellerTab] = useState(SELLER_TABS.PRODUCTS);
  const [courierTab, setCourierTab] = useState(COURIER_TABS.DELIVER);
  const [sellerProductsView, setSellerProductsView] = useState("list");
  const [communityProductsView, setCommunityProductsView] = useState("grid");
  const [communityListingsQuery, setCommunityListingsQuery] = useState("");
  const [listingSort, setListingSort] = useState("newest");
  const [favoriteProductsView, setFavoriteProductsView] = useState("grid");
  /** Migrate legacy layout keys (2 / 4 / 8) to list | grid | compact. */
  useEffect(() => {
    setCommunityProductsView((v) => {
      if (v === "list" || v === "grid" || v === "compact") return v;
      if (v === "8") return "compact";
      return "grid";
    });
    setSellerProductsView((v) => {
      if (v === "list" || v === "grid" || v === "compact") return v;
      if (v === "8") return "compact";
      if (v === "2" || v === "4") return "grid";
      return "list";
    });
    setFavoriteProductsView((v) => {
      if (v === "list" || v === "grid" || v === "compact") return v;
      if (v === "8") return "compact";
      if (v === "2" || v === "4") return "grid";
      return "grid";
    });
  }, []);
  const [commerceFlowViewBuyer, setCommerceFlowViewBuyer] = useState(() => readCommerceFlowFromStorage(COMMERCE_FLOW_BUYER_STORAGE_KEY));
  const [commerceFlowViewSeller, setCommerceFlowViewSeller] = useState(() => readCommerceFlowFromStorage(COMMERCE_FLOW_SELLER_STORAGE_KEY));
  useEffect(() => {
    try {
      window.localStorage.setItem(COMMERCE_FLOW_BUYER_STORAGE_KEY, commerceFlowViewBuyer);
    } catch {
      /* ignore */
    }
  }, [commerceFlowViewBuyer]);
  useEffect(() => {
    try {
      window.localStorage.setItem(COMMERCE_FLOW_SELLER_STORAGE_KEY, commerceFlowViewSeller);
    } catch {
      /* ignore */
    }
  }, [commerceFlowViewSeller]);
  /** Inline notice by Upload on Profile (not the global marketplace banner). */
  const [profileUploadProductNotice, setProfileUploadProductNotice] = useState("");

  const mergeIncomingUserWithMembership = useCallback((incomingUser, prevUser) => {
    const incoming = incomingUser && typeof incomingUser === "object" ? incomingUser : {};
    const prev = prevUser && typeof prevUser === "object" ? prevUser : {};
    const merged = { ...prev, ...incoming };
    const incomingId = String(incoming?.id || prev?.id || "").trim();
    const incomingCommunity = String(incoming?.community || "").trim();
    const prevCommunity = String(prev?.community || "").trim();
    const incomingCommunityId = String(incoming?.communityId || "").trim();
    const preservedJoined =
      incoming.joinedAt || incoming.createdAt || incoming.created_at || prev.joinedAt || prev.createdAt || prev.created_at || "";
    merged.joinedAt = preservedJoined;
    if (typeof window !== "undefined" && incomingId) {
      const membershipKey = `${COMMUNITY_MEMBERSHIP_KEY_PREFIX}${incomingId}`;
      const savedCommunity = String(localStorage.getItem(membershipKey) || "").trim();
      const savedJoinedId = readJoinedShopCommunityId(incomingId);
      if (incomingCommunity) {
        localStorage.setItem(membershipKey, incomingCommunity);
      } else if (savedCommunity) {
        merged.community = savedCommunity;
      } else if (savedJoinedId && prevCommunity) {
        // Keep local joined state stable if backend payload is stale/blank.
        merged.community = prevCommunity;
      }
      if (incomingCommunityId) {
        writeJoinedShopCommunityId(incomingId, incomingCommunityId);
        setJoinedShopCommunityId((prevJoined) => (prevJoined === incomingCommunityId ? prevJoined : incomingCommunityId));
      }
    }
    return merged;
  }, []);

  const applyJoinedCommunity = useCallback((communityName) => {
    const normalized = String(communityName || "").trim();
    setUser((prev) => {
      if (!prev) return prev;
      if (!normalized) {
        if (!prev.community && !prev.communityId) return prev;
        return { ...prev, community: "", communityId: "" };
      }
      if (prev.community === normalized) return prev;
      return { ...prev, community: normalized };
    });
    setProfileDraft((prev) => ({ ...prev, community: normalized }));
    if (typeof window !== "undefined" && user?.id) {
      const key = `${COMMUNITY_MEMBERSHIP_KEY_PREFIX}${user.id}`;
      if (normalized) localStorage.setItem(key, normalized);
      else localStorage.removeItem(key);
      if (!normalized) {
        writeJoinedShopCommunityId(user.id, "");
        setJoinedShopCommunityId("");
      }
    }
  }, [user?.id]);

  /** Syncs membership locally first; server sync + listing patches run in the background (instant UI). Returns a promise for callers that must wait (e.g. empty-shop retry). */
  const joinCommunityAndAttachListings = useCallback(
    (community, { notifySuccess = false } = {}) => {
      const joinedName = toTitleCase(String(community?.name || "").trim());
      applyJoinedCommunity(joinedName);
      const joinedId = community?.id ? String(community.id) : "";
      if (joinedId && user?.id) {
        writeJoinedShopCommunityId(user.id, joinedId);
        setJoinedShopCommunityId(joinedId);
      }
      if (!token || !community?.id) return Promise.resolve();

      return (async () => {
        try {
          const patchData = await apiRequest("/auth/me", {
            method: "PATCH",
            token,
            body: { community: joinedName, communityId: joinedId || null },
          });
          setUser((prev) => mergeIncomingUserWithMembership(patchData.user || {}, prev));
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
          const communitiesRes = await apiRequest("/communities", { token });
          setCommunities(communitiesRes?.communities || []);
          if (notifySuccess) {
            pushMarketplaceToast(`You joined ${joinedName || "the community"} successfully.`);
          }
        } catch (error) {
          pushMarketplaceToast(error?.message || "Joined, but we could not attach your listings yet. Try Join again.");
        }
      })();
    },
    [applyJoinedCommunity, mergeIncomingUserWithMembership, token, user?.id],
  );

  const loadCommunityShopListings = useCallback(
    async ({ preserveExistingRows = false, cancelledRef, force = false } = {}) => {
      if (!token || (!force && activeView !== VIEWS.COMMUNITY_SHOP)) return;
      const inCommunity = !!shopCommunityId;
      const hasVertical = browseVerticalId != null;
      setListingsError("");
      const soft = preserveExistingRows && listingsLengthRef.current > 0;
      if (soft) setListingsRefreshing(true);
      else setListingsLoading(true);
      try {
        const qs = new URLSearchParams();
        if (inCommunity) qs.set("communityId", shopCommunityId);
        if (hasVertical) {
          qs.set("verticalId", browseVerticalId);
          if (browseSubId && browseSubId !== "all") qs.set("subId", browseSubId);
        }
        const data = await apiRequest(`/listings?${qs.toString()}`, { token });
        if (cancelledRef?.()) return;
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
          if (cancelledRef?.()) return;
          const retry = await apiRequest(`/listings?communityId=${encodeURIComponent(String(shopCommunityId))}`, { token });
          if (cancelledRef?.()) return;
          const retriedRows = Array.isArray(retry?.listings) ? retry.listings : [];
          nextRows = retriedRows;
        }
        setListings(nextRows);
      } catch (e) {
        if (cancelledRef?.()) return;
        if (!soft) {
          setListingsError(e.message || "Could not load listings.");
          setListings([]);
        } else {
          setListingsError(e.message || "Could not refresh listings.");
        }
      } finally {
        setListingsLoading(false);
        setListingsRefreshing(false);
      }
    },
    [
      token,
      activeView,
      browseVerticalId,
      browseSubId,
      shopCommunityId,
      user?.id,
      isMemberOfOpenCommunity,
      joinCommunityAndAttachListings,
    ],
  );

  const refreshCommunityShopListings = useCallback(() => {
    void loadCommunityShopListings({ preserveExistingRows: true });
  }, [loadCommunityShopListings]);

  /** Remove this seller's listings from a community shop when they leave (runs in background — do not await before navigation). */
  const detachSellerListingsFromCommunity = useCallback(
    async (communityId) => {
      const cid = String(communityId || "").trim();
      if (!token || !cid) return;
      try {
        const listData = await apiRequest("/me/listings", { token });
        const mine = Array.isArray(listData?.listings) ? listData.listings : [];
        const toDetach = mine.filter((l) => String(l.communityId || "") === cid);
        if (!toDetach.length) return;
        await Promise.all(
          toDetach.map((listing) =>
            apiRequest(`/me/listings/${listing.id}`, {
              method: "PATCH",
              token,
              body: { communityId: null },
            }),
          ),
        );
        const refreshed = await apiRequest("/me/listings", { token });
        setSellerListings(refreshed.listings || []);
      } catch (e) {
        pushMarketplaceToast(e?.message || "Could not remove your products from this community.");
      }
    },
    [token],
  );

  const leaveCommunityAndDetachListings = useCallback(
    (community, { notifySuccess = false } = {}) => {
      const leftName = toTitleCase(String(community?.name || "").trim());
      const leavingId = community?.id ? String(community.id) : "";
      if (leavingId) void detachSellerListingsFromCommunity(leavingId);
      applyJoinedCommunity("");
      if (!token) {
        if (notifySuccess) pushMarketplaceToast(`You left ${leftName || "the community"} successfully.`);
        return Promise.resolve();
      }
      return (async () => {
        try {
          const patchData = await apiRequest("/auth/me", {
            method: "PATCH",
            token,
            body: { community: "", communityId: null },
          });
          setUser((prev) => mergeIncomingUserWithMembership(patchData.user || {}, prev));
          const communitiesRes = await apiRequest("/communities", { token });
          setCommunities(communitiesRes?.communities || []);
          if (notifySuccess) pushMarketplaceToast(`You left ${leftName || "the community"} successfully.`);
        } catch (error) {
          pushMarketplaceToast(error?.message || "Left locally, but we could not sync your membership yet.");
        }
      })();
    },
    [applyJoinedCommunity, detachSellerListingsFromCommunity, mergeIncomingUserWithMembership, token],
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

  const [mobileCommunityFiltersOpen, setMobileCommunityFiltersOpen] = useState(false);
  const [mobileTopChromeCollapsed, setMobileTopChromeCollapsed] = useState(false);
  const [mobileBrowseCategoryQuery, setMobileBrowseCategoryQuery] = useState("");
  const browseVerticalsForMobileDrawer = useMemo(() => {
    const q = mobileBrowseCategoryQuery.trim().toLowerCase();
    if (!q) return VERTICALS;
    return VERTICALS.filter(
      (v) => v.label.toLowerCase().includes(q) || String(v.id).toLowerCase().includes(q)
    );
  }, [mobileBrowseCategoryQuery]);
  const [publishFlash, setPublishFlash] = useState("");
  const [publishFlashExiting, setPublishFlashExiting] = useState(false);
  const publishFlashTimersRef = useRef({ fade: null, remove: null });
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (!mobileCommunityFiltersOpen) {
      setMobileBrowseCategoryQuery("");
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileCommunityFiltersOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || !mobileCommunityFiltersOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMobileCommunityFiltersOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileCommunityFiltersOpen]);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileViewUserId, setProfileViewUserId] = useState("");
  const [profileViewReturnView, setProfileViewReturnView] = useState("");
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
  /** Hide “Finish your profile” strip until next session / profile becomes complete. */
  const [profileFinishBannerDismissed, setProfileFinishBannerDismissed] = useState(false);
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
  const [profileAvatarCropEditor, setProfileAvatarCropEditor] = useState({
    open: false,
    sourceFile: null,
    sourcePreviewUrl: "",
    sourcePreviewOwned: false,
    sourceWidth: 1,
    sourceHeight: 1,
    cropLeft: 0.1,
    cropTop: 0.1,
    cropSize: 1,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartLeft: 0.1,
    dragStartTop: 0.1,
  });
  const profileAvatarCropViewportRef = useRef(null);
  const [profileAvatarCropApplyError, setProfileAvatarCropApplyError] = useState("");
  const [profileAvatarCropUploading, setProfileAvatarCropUploading] = useState(false);
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
    writeThemeMode(theme);
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

  useEffect(() => {
    if (!token || user) return;
    (async () => {
      try {
        const data = await apiRequest("/auth/me", { token });
        setUser((prev) => mergeIncomingUserWithMembership(data.user || {}, prev));
        const joined = data?.user?.joinedAt || data?.user?.createdAt || data?.user?.created_at || "";
        if (joined) setProfileJoinedAt(joined);
        setProfileJoinedAtResolved(true);
      } catch (error) {
        if (isUnauthorizedApiError(error)) {
          writeAuthToken("");
          setToken("");
        }
        setProfileJoinedAtResolved(true);
      }
    })();
  }, [token, user]);

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
            writeAuthToken(data.token);
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

  const openAuthPanel = useCallback((mode) => {
    setAuthMode(mode);
    setMessage("");
    setAuthInlineErrors({ email: "", password: "", confirmPassword: "", terms: "" });
    setAuthPanelVisible(true);
  }, []);

  const closeAuthPanel = useCallback(() => {
    setAuthPanelVisible(false);
    setMessage("");
    setAuthInlineErrors({ email: "", password: "", confirmPassword: "", terms: "" });
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
          setUser((prev) => mergeIncomingUserWithMembership(data.user || {}, prev));
          const joined = data?.user?.joinedAt || data?.user?.createdAt || data?.user?.created_at || "";
          if (joined) setProfileJoinedAt(joined);
          setProfileJoinedAtResolved(true);
        }
      } catch (error) {
        if (!cancelled && isUnauthorizedApiError(error)) {
          writeAuthToken("");
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
    if (!token || user?.id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest("/auth/me", { token });
        if (cancelled) return;
        const incoming = data?.user || null;
        if (!incoming) return;
        setUser((prev) => mergeIncomingUserWithMembership(incoming, prev));
      } catch (error) {
        if (cancelled) return;
        if (isUnauthorizedApiError(error)) {
          writeAuthToken("");
          setToken("");
          setUser(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user?.id]);

  useEffect(() => {
    if (activeView !== VIEWS.PROFILE) {
      setProfileEditing(false);
      setProfileError("");
      setProfileUploadProductNotice("");
    }
  }, [activeView]);

  useEffect(() => {
    if (profileCommunityName.trim()) setProfileUploadProductNotice("");
  }, [profileCommunityName]);

  const reloadUsersList = useCallback(async () => {
    if (!token) return;
    setUsersError("");
    setUsersLoading(true);
    try {
      const data = await apiRequest("/users", { token });
      setUsersList(data.users || []);
    } catch (error) {
      setUsersError(error.message || "Unable to load users.");
    } finally {
      setUsersLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const shouldLoadUsers =
      activeView === VIEWS.MESSAGES ||
      activeView === VIEWS.ORDERS ||
      activeView === VIEWS.MY_PURCHASES;
    if (!token || !shouldLoadUsers) return undefined;
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

  const refreshConversationsSnapshot = useCallback(
    async ({ fallbackToLocal = false } = {}) => {
      if (!token || !user?.id) return;
      const data = await apiRequest("/conversations", { token });
      const incoming = Array.isArray(data?.conversations) ? data.conversations : [];
      const mapped = incoming
        .map((conv) => toChatThreadFromConversation(conv, user.id))
        .filter((thread) => thread.participantId);
      setChatThreads((prev) => {
        const prevByConversationId = new Map(
          (Array.isArray(prev) ? prev : [])
            .filter((thread) => String(thread?.conversationId || "").trim())
            .map((thread) => [String(thread.conversationId), thread]),
        );
        const prevByParticipantId = new Map(
          (Array.isArray(prev) ? prev : [])
            .filter((thread) => String(thread?.participantId || "").trim())
            .map((thread) => [String(thread.participantId), thread]),
        );
        const mappedThreads = mapped.map((thread) => {
          const prevThread =
            prevByConversationId.get(String(thread.conversationId || "")) ||
            prevByParticipantId.get(String(thread.participantId || "")) ||
            null;
          if (!prevThread?.messagesLoaded) return thread;
          const prevMessages = Array.isArray(prevThread.messages) ? prevThread.messages : [];
          if (prevMessages.length === 0) return { ...thread, messagesLoaded: true, messages: [] };
          const latestMapped = Array.isArray(thread.messages) && thread.messages.length > 0 ? thread.messages[thread.messages.length - 1] : null;
          const hasLatest =
            latestMapped && prevMessages.some((m) => String(m?.id || "") === String(latestMapped?.id || ""));
          const mergedMessages = hasLatest
            ? prevMessages
            : [...prevMessages, latestMapped].filter(Boolean).slice(-CHAT_MESSAGES_MAX_PER_THREAD);
          return {
            ...thread,
            messagesLoaded: true,
            messages: mergedMessages,
          };
        });
        const mappedParticipants = new Set(mappedThreads.map((thread) => String(thread?.participantId || "").trim()).filter(Boolean));
        const optimisticOnlyThreads = (Array.isArray(prev) ? prev : []).filter((thread) => {
          const participantId = String(thread?.participantId || "").trim();
          if (!participantId || mappedParticipants.has(participantId)) return false;
          return Array.isArray(thread?.messages) && thread.messages.length > 0;
        });
        return [...mappedThreads, ...optimisticOnlyThreads];
      });

      // Ensure message participants appear in users index for display names.
      const conversationUsers = incoming
        .flatMap((conv) => (Array.isArray(conv?.participants) ? conv.participants : []))
        .map((participant) => {
          const profile = participant?.profile || {};
          const userId = String(participant?.userId || "").trim();
          if (!userId || userId === String(user.id)) return null;
          const fallbackName = String(profile?.displayName || profile?.username || "").trim();
          return {
            id: userId,
            username: String(profile?.username || "").trim(),
            name: fallbackName || "Member",
            community: "",
            joinedAt: participant?.joinedAt || null,
          };
        })
        .filter(Boolean);
      if (conversationUsers.length > 0) {
        setUsersList((prev) => {
          const byId = new Map((Array.isArray(prev) ? prev : []).map((u) => [String(u?.id || "").trim(), u]));
          for (const u of conversationUsers) {
            const id = String(u.id || "").trim();
            if (!id) continue;
            const existing = byId.get(id);
            byId.set(id, existing ? { ...u, ...existing, id } : u);
          }
          return Array.from(byId.values());
        });
      }
      return mapped;
    },
    [token, user?.id],
  );

  useEffect(() => {
    if (!user?.id) {
      setChatThreads([]);
      setActiveChatUserId("");
      setChatComposer("");
      return;
    }
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        await refreshConversationsSnapshot();
      } catch {
        if (cancelled) return;
        // Backward fallback: keep local cache readable if API is unavailable.
        setChatThreads(readChatThreadsFromStorage(user.id));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user?.id, refreshConversationsSnapshot]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(chatStorageKeyForUser(user.id), JSON.stringify(chatThreads));
    } catch {
      // ignore
    }
  }, [chatThreads, user?.id]);

  useEffect(() => {
    const supabase = createSupabaseClient();
    if (!supabase || !token || !user?.id) return undefined;
    let cancelled = false;
    let debounceTimer = null;
    const flush = () => {
      debounceTimer = null;
      if (cancelled) return;
      void refreshConversationsSnapshot().catch(() => {});
      // Force active thread message refetch on next render cycle.
      setChatThreads((prev) =>
        prev.map((thread) =>
          String(thread.participantId) === String(activeChatUserId || "")
            ? { ...thread, messagesLoaded: false }
            : thread,
        ),
      );
    };
    const onChatChange = () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(flush, CHAT_REALTIME_DEBOUNCE_MS);
    };
    const channel = supabase
      .channel(`lm-chat-rt:${String(user.id)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_messages" }, onChatChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, onChatChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_reads" }, onChatChange)
      .subscribe();

    // Socket-independent safety net so users still get near-realtime updates.
    const pollId = window.setInterval(() => {
      void refreshConversationsSnapshot().catch(() => {});
    }, 6000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshConversationsSnapshot().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (debounceTimer) window.clearTimeout(debounceTimer);
      window.clearInterval(pollId);
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [token, user?.id, activeChatUserId, refreshConversationsSnapshot]);

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
    setAuthInlineErrors({ email: "", password: "", confirmPassword: "", terms: "" });

    const emailErr = validateEmail(form.email);
    if (emailErr) {
      setAuthInlineErrors((prev) => ({ ...prev, email: emailErr }));
      return;
    }
    const passErr = validatePasswordClient(form.password, { signup: authMode === "signup" });
    if (passErr) {
      setAuthInlineErrors((prev) => ({ ...prev, password: passErr }));
      return;
    }
    if (authMode === "signup") {
      const confirmErr = validateConfirmPassword(form.password, form.confirmPassword);
      if (confirmErr) {
        setAuthInlineErrors((prev) => ({ ...prev, confirmPassword: confirmErr }));
        return;
      }
      if (!form.acceptedTerms) {
        setAuthInlineErrors((prev) => ({
          ...prev,
          terms: "Check the box to accept the Terms of Use and Privacy Policy.",
        }));
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
      writeAuthToken(data.token);
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

  const logout = () => {
    writeAuthToken("");
    clearActiveView();
    setToken("");
    setUser(null);
    setAuthPanelVisible(false);
    setShopCommunityId(null);
    setActiveView(VIEWS.BROWSE);
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
    setSelectedListingId(null);
    setActiveView(VIEWS.ORDERS);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    }
  }, []);

  const goMyPurchases = useCallback(() => {
    setOrdersRole("buyer");
    setOrdersStatusTab("pending");
    setActiveView(VIEWS.MY_PURCHASES);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    }
  }, []);


  const goCart = useCallback(() => {
    setActiveView(VIEWS.CART);
  }, []);
  const goOwnProfile = useCallback(() => {
    setProfileViewUserId("");
    setProfileViewReturnView("");
    setActiveView(VIEWS.PROFILE);
  }, []);
  const goBackFromSellerProfile = useCallback(() => {
    const nextView = Object.values(VIEWS).includes(String(profileViewReturnView || ""))
      ? profileViewReturnView
      : VIEWS.BROWSE;
    setProfileViewUserId("");
    setProfileViewReturnView("");
    setActiveView(nextView);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    }
  }, [profileViewReturnView]);

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

  const requestLeaveCommunityConfirmation = useCallback(() => {
    setLeaveCommunityConfirmOpen(true);
  }, []);

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

  const goMobileHome = useCallback(() => {
    setMobileCommunityFiltersOpen(false);
    goBrowse();
  }, [goBrowse]);

  const goMobileSearch = useCallback(() => {
    goBrowse();
    setMobileCommunityFiltersOpen(true);
  }, [goBrowse]);

  const goCreateSell = useCallback(() => {
    setMobileCommunityFiltersOpen(false);
    setSellerTab(SELLER_TABS.PRODUCTS);
    setActiveView(VIEWS.PROFILE);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    }
  }, []);
  const openUploadAtTop = useCallback(() => {
    setActiveView(VIEWS.MY_LISTINGS);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const main = document.getElementById("main-content");
        if (main) main.scrollTop = 0;
        window.scrollTo(0, 0);
      });
    }
  }, []);

  const goInbox = useCallback(() => {
    setMobileCommunityFiltersOpen(false);
    setActiveView(VIEWS.MESSAGES);
    setMessagesMobilePane("list");
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    }
  }, []);
  const goNotifications = useCallback(() => {
    setActiveView(VIEWS.NOTIFICATIONS);
  }, []);
  const goSecondaryMobileNavView = useCallback(
    (view) => {
      switch (view) {
        case VIEWS.BROWSE:
          goBrowse();
          break;
        case VIEWS.CART:
          goCart();
          break;
        case VIEWS.MY_PURCHASES:
          goMyPurchases();
          break;
        case VIEWS.ORDERS:
          goOrders();
          break;
        case VIEWS.MESSAGES:
          goInbox();
          break;
        case VIEWS.NOTIFICATIONS:
          goNotifications();
          break;
        case VIEWS.PROFILE:
          goOwnProfile();
          break;
        default:
          setActiveView(view);
          break;
      }
    },
    [goBrowse, goCart, goInbox, goMyPurchases, goNotifications, goOrders, goOwnProfile],
  );

  const scrollToListingSection = useCallback((sectionId, { openAdvanced = false } = {}) => {
    if (openAdvanced) setListingAdvancedOpen(true);
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      const el = document.getElementById(sectionId);
      if (!el) return;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  }, []);

  const usersById = useMemo(() => {
    const map = new Map();
    for (const entry of usersList) {
      const id = String(entry?.id || "").trim();
      if (!id) continue;
      map.set(id, entry);
    }
    return map;
  }, [usersList]);
  const viewedProfileUser = useMemo(
    () => (profileViewUserId ? usersById.get(String(profileViewUserId || "").trim()) || null : null),
    [usersById, profileViewUserId],
  );
  const isViewingSellerProfile =
    Boolean(viewedProfileUser) && String(viewedProfileUser?.id || "") !== String(user?.id || "");
  const profileRenderUser = useMemo(() => {
    if (!isViewingSellerProfile) return user;
    const v = viewedProfileUser || {};
    return {
      id: v.id || "",
      username: String(v.username || "").trim(),
      name: String(v.name || "").trim(),
      firstName: String(v.firstName || "").trim(),
      middleName: String(v.middleName || "").trim(),
      lastName: String(v.lastName || "").trim(),
      avatarUrl: String(v.avatarUrl || "").trim(),
      phone: String(v.phone || "").trim(),
      address: String(v.address || "").trim(),
      community: String(v.community || "").trim(),
      joinedAt: v.joinedAt || null,
      createdAt: v.createdAt || null,
      email: "",
      facebookUrl: "",
      twitterUrl: "",
      instagramUrl: "",
      socialPlatform: "",
      socialUrl: "",
      url: "",
    };
  }, [isViewingSellerProfile, user, viewedProfileUser]);

  useEffect(() => {
    if (activeView !== VIEWS.PROFILE && profileViewUserId) setProfileViewUserId("");
  }, [activeView, profileViewUserId]);

  useEffect(() => {
    if (isViewingSellerProfile && profileEditing) setProfileEditing(false);
  }, [isViewingSellerProfile, profileEditing]);

  const ensureDirectConversation = useCallback(
    async (targetId) => {
      if (!token || !user?.id) return null;
      const targetUserId = String(targetId || "").trim();
      if (!targetUserId || targetUserId === String(user.id)) return null;
      const existing = chatThreads.find((thread) => String(thread.participantId) === targetUserId);
      if (existing?.conversationId) return existing.conversationId;
      const created = await apiRequest("/conversations", {
        method: "POST",
        token,
        body: { type: "direct", targetUserId },
      });
      const conversationId = String(created?.conversation?.id || "").trim();
      if (!conversationId) return null;
      setChatThreads((prev) => {
        const hit = prev.find((thread) => String(thread.participantId) === targetUserId);
        if (hit) {
          return prev.map((thread) =>
            String(thread.participantId) === targetUserId ? { ...thread, conversationId } : thread,
          );
        }
        return [{ conversationId, participantId: targetUserId, unread: 0, messages: [], messagesLoaded: false }, ...prev];
      });
      return conversationId;
    },
    [chatThreads, token, user?.id],
  );

  const openChatThread = useCallback((participantId) => {
    const targetId = String(participantId || "").trim();
    if (!targetId) return;
    setActiveChatUserId(targetId);
    setMessagesMobilePane("thread");
    setActiveView(VIEWS.MESSAGES);
  }, []);

  const openChatWithUser = useCallback(
    async (userId) => {
      const targetId = String(userId || "").trim();
      if (!targetId || !user?.id || targetId === String(user.id)) return;
      try {
        await ensureDirectConversation(targetId);
      } catch {
        // Keep UI navigable even if conversation creation fails.
      }
      openChatThread(targetId);
    },
    [ensureDirectConversation, openChatThread, user?.id],
  );

  const sortedChatThreads = useMemo(() => {
    return [...chatThreads].sort((a, b) => {
      const aLast = Array.isArray(a?.messages) && a.messages.length > 0 ? Number(a.messages[a.messages.length - 1].createdAt || 0) : 0;
      const bLast = Array.isArray(b?.messages) && b.messages.length > 0 ? Number(b.messages[b.messages.length - 1].createdAt || 0) : 0;
      return bLast - aLast;
    });
  }, [chatThreads]);

  useEffect(() => {
    if (activeChatUserId) return;
    if (sortedChatThreads.length < 1) return;
    setActiveChatUserId(String(sortedChatThreads[0].participantId || ""));
  }, [activeChatUserId, sortedChatThreads]);

  useEffect(() => {
    if (activeView !== VIEWS.MESSAGES) {
      setMessagesMobilePane("list");
      setMessagesMobileListTab("conversations");
    }
  }, [activeView]);

  const { isMobile: isMobileViewport } = useMobileViewport();
  useBodyScrollLock(activeView === VIEWS.MESSAGES && messagesMobilePane === "thread" && isMobileViewport);
  useEffect(() => {
    if (!isMobileViewport) return undefined;
    if (!secondaryMobileNavOrder.includes(secondarySwipeNavView)) return undefined;
    const main = document.getElementById("main-content");
    if (!main) return undefined;
    const flushDragFrame = () => {
      if (secondaryDragRafRef.current) {
        window.cancelAnimationFrame(secondaryDragRafRef.current);
        secondaryDragRafRef.current = 0;
      }
    };
    const scheduleDragUpdate = (nextX) => {
      secondaryDragPendingXRef.current = nextX;
      if (secondaryDragRafRef.current) return;
      secondaryDragRafRef.current = window.requestAnimationFrame(() => {
        secondaryDragRafRef.current = 0;
        setMobileSecondaryDragX(secondaryDragPendingXRef.current);
      });
    };

    const settleSwipeRelease = (fromX) => {
      if (swipeSettleTimerRef.current) {
        window.clearTimeout(swipeSettleTimerRef.current);
        swipeSettleTimerRef.current = 0;
      }
      if (Math.abs(fromX) < 1) {
        setMobileSecondaryDragX(0);
        setMobileSecondarySwipeSettling(false);
        return;
      }
      setMobileSecondarySwipeSettling(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setMobileSecondaryDragX(0);
          swipeSettleTimerRef.current = window.setTimeout(() => {
            setMobileSecondarySwipeSettling(false);
            swipeSettleTimerRef.current = 0;
          }, 280);
        });
      });
    };

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX < 22) {
        secondarySwipeRef.current = {
          x: 0, y: 0, dx: 0, dy: 0, t: 0, width: 0, tracking: false, horizontal: false, baseView: secondarySwipeNavView,
        };
        return;
      }
      const target = e.target;
      if (target instanceof Element && target.closest("button,a,input,textarea,select,[role='button'],[data-no-swipe-nav]")) {
        secondarySwipeRef.current = {
          x: 0, y: 0, dx: 0, dy: 0, t: 0, width: 0, tracking: false, horizontal: false, baseView: secondarySwipeNavView,
        };
        return;
      }
      if (swipeSettleTimerRef.current) {
        window.clearTimeout(swipeSettleTimerRef.current);
        swipeSettleTimerRef.current = 0;
      }
      setMobileSecondarySwipeSettling(false);
      secondarySwipeRef.current = {
        x: t.clientX,
        y: t.clientY,
        dx: 0,
        dy: 0,
        t: Date.now(),
        width: main.clientWidth || window.innerWidth || 360,
        tracking: true,
        horizontal: false,
        baseView: secondarySwipeNavView,
      };
    };

    const onTouchMove = (e) => {
      if (!secondarySwipeRef.current.tracking || e.touches.length !== 1) return;
      const t = e.touches[0];
      const state = secondarySwipeRef.current;
      const dx = t.clientX - state.x;
      const dy = t.clientY - state.y;
      state.dx = dx;
      state.dy = dy;
      if (!state.horizontal && Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx) * 1.15) {
        state.tracking = false;
        return;
      }
      if (!state.horizontal && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        state.horizontal = true;
        setMobileSecondaryDragging(true);
      }
      if (!state.horizontal) return;
      if (e.cancelable) e.preventDefault();
      const baseIndex = secondaryMobileNavOrder.indexOf(state.baseView);
      const index = baseIndex === -1 ? secondaryMobileNavOrder.indexOf(secondarySwipeNavView) : baseIndex;
      const atFirst = index <= 0;
      const atLast = index >= secondaryMobileNavOrder.length - 1;
      const edgeResistance = (atFirst && dx > 0) || (atLast && dx < 0) ? 0.82 : 1;
      const maxDrag = Math.max(120, Math.floor((state.width || window.innerWidth || 360) * 0.92));
      const effectiveDx = Math.max(-maxDrag, Math.min(maxDrag, dx * edgeResistance));
      scheduleDragUpdate(effectiveDx);
    };

    const onTouchEnd = () => {
      const snap = secondarySwipeRef.current;
      const pending = secondaryDragPendingXRef.current;
      secondarySwipeRef.current = {
        x: 0, y: 0, dx: 0, dy: 0, t: 0, width: 0, tracking: false, horizontal: false, baseView: secondarySwipeNavView,
      };
      flushDragFrame();
      setMobileSecondaryDragX(pending);
      setMobileSecondaryDragging(false);

      if (!snap.tracking || !snap.horizontal) {
        settleSwipeRelease(pending);
        return;
      }
      const { dx, dy, t, width, baseView } = snap;
      const elapsed = Math.max(1, Date.now() - Number(t || Date.now()));
      const velocityX = dx / elapsed;
      const index = secondaryMobileNavOrder.indexOf(baseView || secondarySwipeNavView);
      if (index === -1) {
        settleSwipeRelease(pending);
        return;
      }
      const shouldCommitByDistance =
        Math.abs(dx) > Math.max(36, Number(width || 0) * 0.12) && Math.abs(dx) > Math.abs(dy) * 1.15;
      const shouldCommitByVelocity = Math.abs(velocityX) > 0.22 && Math.abs(dx) > 12;
      if (!shouldCommitByDistance && !shouldCommitByVelocity) {
        settleSwipeRelease(pending);
        return;
      }
      const nextIndex = dx < 0 || velocityX < 0 ? index + 1 : index - 1;
      if (nextIndex < 0 || nextIndex >= secondaryMobileNavOrder.length) {
        settleSwipeRelease(pending);
        return;
      }
      const nextView = secondaryMobileNavOrder[nextIndex];
      if (nextView !== secondarySwipeNavView) {
        if (swipeSettleTimerRef.current) {
          window.clearTimeout(swipeSettleTimerRef.current);
          swipeSettleTimerRef.current = 0;
        }
        setMobileSecondarySwipeSettling(false);
        setMobileSecondaryDragX(0);
        goSecondaryMobileNavView(nextView);
      } else {
        settleSwipeRelease(pending);
      }
    };

    const onTouchCancel = () => {
      const pending = secondaryDragPendingXRef.current;
      flushDragFrame();
      secondarySwipeRef.current = {
        x: 0, y: 0, dx: 0, dy: 0, t: 0, width: 0, tracking: false, horizontal: false, baseView: secondarySwipeNavView,
      };
      setMobileSecondaryDragging(false);
      setMobileSecondaryDragX(pending);
      settleSwipeRelease(pending);
    };

    main.addEventListener("touchstart", onTouchStart, { passive: true });
    main.addEventListener("touchmove", onTouchMove, { passive: false });
    main.addEventListener("touchend", onTouchEnd, { passive: true });
    main.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      flushDragFrame();
      if (swipeSettleTimerRef.current) {
        window.clearTimeout(swipeSettleTimerRef.current);
        swipeSettleTimerRef.current = 0;
      }
      main.removeEventListener("touchstart", onTouchStart);
      main.removeEventListener("touchmove", onTouchMove);
      main.removeEventListener("touchend", onTouchEnd);
      main.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [goSecondaryMobileNavView, isMobileViewport, secondaryMobileNavOrder, secondarySwipeNavView, activeView]);

  /** Mobile browse: list or 2-col grid; dense hidden — map compact → grid. Cart/orders/seller: same mapping. */
  const effectiveCommunityBrowseView = isMobileViewport
    ? normalizeMobileProductBrowseView(communityProductsView)
    : communityProductsView;
  const effectiveFavoriteBrowseView = isMobileViewport
    ? normalizeMobileProductBrowseView(favoriteProductsView)
    : favoriteProductsView;
  const effectiveSellerProductsView =
    isMobileViewport && sellerProductsView === "compact" ? "grid" : sellerProductsView;
  const effectiveCommerceFlowViewBuyer =
    isMobileViewport && commerceFlowViewBuyer === "compact" ? "grid" : commerceFlowViewBuyer;
  const effectiveCommerceFlowViewSeller =
    isMobileViewport && commerceFlowViewSeller === "compact" ? "grid" : commerceFlowViewSeller;

  /** Use a single active scroll surface while overlays are open (product detail on mobile, or edit overlay on any viewport). */
  const lockMainScrollForOverlay =
    (isMobileViewport && activeView === VIEWS.PRODUCT_DETAIL && Boolean(productInspect)) ||
    listingEditOverlayOpen;

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (!quickAddModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [quickAddModalOpen]);

  const activeChatThread = useMemo(
    () => sortedChatThreads.find((thread) => String(thread.participantId) === String(activeChatUserId)) || null,
    [sortedChatThreads, activeChatUserId],
  );

  const activeChatUser = useMemo(() => usersById.get(String(activeChatUserId || "")) || null, [usersById, activeChatUserId]);

  useEffect(() => {
    const viewport = chatThreadViewportRef.current;
    if (!viewport || activeView !== VIEWS.MESSAGES || !activeChatThread) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [activeView, activeChatUserId, activeChatThread?.messages?.length]);

  useEffect(() => {
    const key = String(activeChatUserId || "").trim();
    setChatComposer(key ? String(chatDraftByUserId[key] || "") : "");
  }, [activeChatUserId, chatDraftByUserId]);

  const messageCommunityFilterOptions = useMemo(() => {
    const set = new Set();
    for (const c of communities) {
      const community = String(c?.name || "").trim();
      if (community) set.add(community);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [communities]);

  const resolveUserCommunity = useCallback(
    (u) => {
      const directCandidates = [
        u?.community,
        u?.communityName,
        u?.community_name,
        u?.barangay,
        u?.brgy,
        u?.user_metadata?.community,
      ];
      for (const candidate of directCandidates) {
        const value = String(candidate || "").trim();
        if (value) return value;
      }
      const address = String(u?.address || u?.user_metadata?.address || "").trim();
      if (!address) return "";
      const addressLower = address.toLowerCase();
      const byAddress = communities.find((c) => {
        const name = String(c?.name || "").trim();
        if (!name) return false;
        return addressLower.includes(name.toLowerCase()) || isLikelySameCommunityName(name, address);
      });
      return String(byAddress?.name || "").trim();
    },
    [communities],
  );

  const filteredMessagePeople = useMemo(() => {
    const q = String(messagePeopleSearch || "").trim().toLowerCase();
    const existingConversationUserIds = new Set(
      sortedChatThreads.map((thread) => String(thread?.participantId || "").trim()).filter(Boolean),
    );
    const rows = usersList.filter((u) => String(u?.id || "") !== String(user?.id || ""));
    const filtered = rows.filter((u) => {
      if (existingConversationUserIds.has(String(u?.id || "").trim())) return false;
      const community = resolveUserCommunity(u);
      if (messagePeopleCommunityFilter !== "all") {
        if (messagePeopleCommunityFilter === "none") {
          if (community) return false;
        } else if (community !== messagePeopleCommunityFilter) {
          return false;
        }
      }
      if (!q) return true;
      const hay = [u?.name, u?.username, community].map((v) => String(v || "").toLowerCase()).join(" ");
      return hay.includes(q);
    });
    if (messagePeopleSort === "joined_desc") {
      return [...filtered].sort((a, b) => new Date(b?.joinedAt || 0).getTime() - new Date(a?.joinedAt || 0).getTime());
    }
    if (messagePeopleSort === "joined_asc") {
      return [...filtered].sort((a, b) => new Date(a?.joinedAt || 0).getTime() - new Date(b?.joinedAt || 0).getTime());
    }
    if (messagePeopleSort === "name_desc") {
      return [...filtered].sort((a, b) => formatDisplayName(b?.name || b?.username || "").localeCompare(formatDisplayName(a?.name || a?.username || "")));
    }
    return [...filtered].sort((a, b) => formatDisplayName(a?.name || a?.username || "").localeCompare(formatDisplayName(b?.name || b?.username || "")));
  }, [usersList, user?.id, sortedChatThreads, messagePeopleCommunityFilter, messagePeopleSearch, messagePeopleSort, resolveUserCommunity]);

  const communityLabelForUser = useCallback((u) => {
    const community = resolveUserCommunity(u);
    return community || "No community set";
  }, [resolveUserCommunity]);

  const totalChatUnreadCount = useMemo(
    () => chatThreads.reduce((sum, thread) => sum + Math.max(0, Number(thread?.unread || 0)), 0),
    [chatThreads],
  );
  const favoriteSeenSet = useMemo(
    () => new Set(favoriteSeenListingIds.map(String)),
    [favoriteSeenListingIds],
  );
  /** Count favorited listings not yet “seen” after leaving Favorites — mirrors Buying/Selling nav badges. */
  const favoritesNavBadgeCount = useMemo(() => {
    let n = 0;
    for (const id of favoriteIds) {
      if (!favoriteSeenSet.has(String(id))) n += 1;
    }
    return Math.min(99, Math.max(0, n));
  }, [favoriteIds, favoriteSeenSet]);

  useEffect(() => {
    if (activeView !== VIEWS.MESSAGES || !activeChatUserId) return;
    setChatThreads((prev) => {
      let changed = false;
      const next = prev.map((thread) => {
        if (String(thread.participantId) !== String(activeChatUserId)) return thread;
        if (Number(thread?.unread || 0) <= 0) return thread;
        changed = true;
        return { ...thread, unread: 0 };
      });
      return changed ? next : prev;
    });
    const currentThread = chatThreads.find((thread) => String(thread.participantId) === String(activeChatUserId));
    const conversationId = String(currentThread?.conversationId || "").trim();
    const latest = Array.isArray(currentThread?.messages) && currentThread.messages.length > 0
      ? currentThread.messages[currentThread.messages.length - 1]
      : null;
    if (!token || !conversationId || !latest?.id) return;
    const syncKey = `${conversationId}:${String(latest.id)}`;
    if (lastReadSyncKeyRef.current === syncKey) return;
    lastReadSyncKeyRef.current = syncKey;
    void apiRequest(`/conversations/${conversationId}/read`, {
      method: "PATCH",
      token,
      body: { lastReadMessageId: latest.id },
    }).catch(() => {
      // Allow retry only if this exact key failed.
      if (lastReadSyncKeyRef.current === syncKey) lastReadSyncKeyRef.current = "";
    });
  }, [activeView, activeChatUserId, chatThreads, token]);

  useEffect(() => {
    if (activeView !== VIEWS.MESSAGES || !activeChatUserId || !token) return;
    const thread = chatThreads.find((t) => String(t.participantId) === String(activeChatUserId));
    if (!thread?.conversationId || thread?.messagesLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest(`/conversations/${thread.conversationId}/messages?limit=200`, { token });
        if (cancelled) return;
        const messages = Array.isArray(data?.messages) ? data.messages.map(toChatMessageFromApi).filter((m) => m.id && m.text) : [];
        setChatThreads((prev) =>
          prev.map((t) =>
            String(t.participantId) === String(activeChatUserId)
              ? { ...t, messages: messages.slice(-CHAT_MESSAGES_MAX_PER_THREAD), messagesLoaded: true }
              : t,
          ),
        );
      } catch {
        if (!cancelled) {
          setChatThreads((prev) =>
            prev.map((t) =>
              String(t.participantId) === String(activeChatUserId) ? { ...t, messagesLoaded: true } : t,
            ),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeView, activeChatUserId, chatThreads, token]);

  const sendChatMessage = useCallback(async () => {
    const senderId = String(user?.id || "").trim();
    const participantId = String(activeChatUserId || "").trim();
    const text = String(chatComposer || "").trim();
    if (!senderId || !participantId || !token) return;
    if (!text) {
      if (chatComposerInputRef.current) chatComposerInputRef.current.focus();
      return;
    }
    setChatSendPending(true);
    try {
      const conversationId = await ensureDirectConversation(participantId);
      if (!conversationId) return;
      const data = await apiRequest(`/conversations/${conversationId}/messages`, {
        method: "POST",
        token,
        body: { body: text },
      });
      const outgoing = toChatMessageFromApi(data?.message || {});
      if (!outgoing?.id) return;
      setChatThreads((prev) => {
        let matched = false;
        const next = prev.map((thread) => {
          if (String(thread.participantId) !== participantId) return thread;
          matched = true;
          const merged = [...(Array.isArray(thread.messages) ? thread.messages : []), outgoing].slice(-CHAT_MESSAGES_MAX_PER_THREAD);
          return { ...thread, conversationId, unread: 0, messages: merged, messagesLoaded: true };
        });
        if (!matched) {
          next.unshift({
            conversationId,
            participantId,
            unread: 0,
            messages: [outgoing],
            messagesLoaded: true,
          });
        }
        return next;
      });
      setChatComposer("");
      setChatDraftByUserId((prev) => ({ ...prev, [participantId]: "" }));
      if (chatComposerInputRef.current) chatComposerInputRef.current.focus();
    } catch {
      // Keep composer text so user can retry if request fails.
    } finally {
      setChatSendPending(false);
    }
  }, [user?.id, activeChatUserId, chatComposer, token, ensureDirectConversation]);

  /** My purchases vs Sales inbox use separate saved list/grid/dense preferences. */
  const commerceFlowOrdersView =
    activeView === VIEWS.MY_PURCHASES ? effectiveCommerceFlowViewBuyer : effectiveCommerceFlowViewSeller;
  const setCommerceFlowOrdersView =
    activeView === VIEWS.MY_PURCHASES ? setCommerceFlowViewBuyer : setCommerceFlowViewSeller;

  const visibleBrowseListings = useMemo(() => {
    let rows = listings;
    if (activeView === VIEWS.COMMUNITY_SHOP) {
      const q = String(communityListingsQuery || "").trim().toLowerCase();
      if (q) {
        rows = rows.filter((l) => {
          const title = String(l?.title || "").toLowerCase();
          const description = String(l?.description || "").toLowerCase();
          const category = String(l?.categories || "").toLowerCase();
          const sub = String(l?.subId || "").toLowerCase();
          return title.includes(q) || description.includes(q) || category.includes(q) || sub.includes(q);
        });
      }
    }
    if (browseQuickFilter === "new") {
      rows = rows.filter((l) => {
        if (l?.createdAt) {
          const ageMs = Date.now() - new Date(l.createdAt).getTime();
          return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= 1000 * 60 * 60 * 24 * 14;
        }
        const text = `${l?.title || ""} ${l?.description || ""}`.toLowerCase();
        return /\bnew\b|brand new|sealed|unused/.test(text);
      });
    }
    if (browseQuickFilter === "sale") {
      rows = rows.filter((l) => {
        const text = `${l?.title || ""} ${l?.description || ""}`.toLowerCase();
        return /\bsale\b|discount|promo|markdown|clearance/.test(text);
      });
    }
    rows = [...rows];
    rows.sort((a, b) => {
      if (listingSort === "oldest") return orderRowSortMs(a) - orderRowSortMs(b);
      if (listingSort === "price_asc") return listingPriceCents(a) - listingPriceCents(b);
      if (listingSort === "price_desc") return listingPriceCents(b) - listingPriceCents(a);
      if (listingSort === "name_asc") {
        return String(a?.title || "").localeCompare(String(b?.title || ""), undefined, { sensitivity: "base" });
      }
      if (listingSort === "name_desc") {
        return String(b?.title || "").localeCompare(String(a?.title || ""), undefined, { sensitivity: "base" });
      }
      return orderRowSortMs(b) - orderRowSortMs(a);
    });
    return rows;
  }, [browseQuickFilter, listings, activeView, communityListingsQuery, listingSort]);

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
    if (browseQuickFilter === "new") {
      rows = rows.filter((l) => {
        if (l?.createdAt) {
          const ageMs = Date.now() - new Date(l.createdAt).getTime();
          return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= 1000 * 60 * 60 * 24 * 14;
        }
        const text = `${l?.title || ""} ${l?.description || ""}`.toLowerCase();
        return /\bnew\b|brand new|sealed|unused/.test(text);
      });
    }
    if (browseQuickFilter === "sale") {
      rows = rows.filter((l) => {
        const text = `${l?.title || ""} ${l?.description || ""}`.toLowerCase();
        return /\bsale\b|discount|promo|markdown|clearance/.test(text);
      });
    }
    rows = [...rows];
    rows.sort((a, b) => {
      if (listingSort === "oldest") return orderRowSortMs(a) - orderRowSortMs(b);
      if (listingSort === "price_asc") return listingPriceCents(a) - listingPriceCents(b);
      if (listingSort === "price_desc") return listingPriceCents(b) - listingPriceCents(a);
      if (listingSort === "name_asc") {
        return String(a?.title || "").localeCompare(String(b?.title || ""), undefined, { sensitivity: "base" });
      }
      if (listingSort === "name_desc") {
        return String(b?.title || "").localeCompare(String(a?.title || ""), undefined, { sensitivity: "base" });
      }
      return orderRowSortMs(b) - orderRowSortMs(a);
    });
    return rows;
  }, [strictFavoritesList, browseQuickFilter, browseVerticalId, browseSubId, listingSort]);

  const activeBrowseFilterSummary = useMemo(() => {
    const items = [];
    const activeSortLabel = LISTING_SORT_OPTIONS.find((o) => o.id === listingSort)?.label || "Sort: Newest";
    if (browseQuickFilter !== "all") {
      const quick = BROWSE_QUICK_FILTERS.find((f) => f.id === browseQuickFilter);
      items.push(`Filter: ${quick?.label || browseQuickFilter}`);
    }
    if (browseVerticalId) {
      const verticalLabel = getVerticalById(browseVerticalId)?.label ?? browseVerticalId;
      items.push(`Category: ${verticalLabel}`);
    }
    if (activeView === VIEWS.COMMUNITY_SHOP && communityListingsQuery.trim()) {
      items.push(`Search: ${communityListingsQuery.trim()}`);
    }
    if (listingSort !== "newest") items.push(activeSortLabel);
    return items;
  }, [browseQuickFilter, browseVerticalId, activeView, communityListingsQuery, listingSort]);

  const ordersForStatusTab = useMemo(
    () => orders.filter((o) => orderMatchesOrdersStatusTab(o.status, ordersStatusTab)),
    [orders, ordersStatusTab],
  );

  const buyerUnseenIdsByTab = useMemo(() => {
    const list = buyerOrdersForBadges ?? [];
    const out = emptyOrderAttentionByTab();
    for (const tab of RECENT_ORDER_TAB_KEYS) {
      const dismissed = new Set((buyerOrderDismissedIdsByTab[tab] || []).map(String));
      const rows = list.filter(
        (o) => orderMatchesOrdersStatusTab(o.status, tab) && !dismissed.has(String(o.id || "")),
      );
      rows.sort((a, b) => orderRowSortMs(b) - orderRowSortMs(a));
      out[tab] = rows.map((o) => String(o.id || "")).filter(Boolean);
    }
    return out;
  }, [buyerOrdersForBadges, buyerOrderDismissedIdsByTab]);

  const sellerUnseenIdsByTab = useMemo(() => {
    const list = sellerOrdersForBadges ?? [];
    const out = emptyOrderAttentionByTab();
    for (const tab of RECENT_ORDER_TAB_KEYS) {
      const dismissed = new Set((sellerOrderDismissedIdsByTab[tab] || []).map(String));
      const rows = list.filter(
        (o) => orderMatchesOrdersStatusTab(o.status, tab) && !dismissed.has(String(o.id || "")),
      );
      rows.sort((a, b) => orderRowSortMs(b) - orderRowSortMs(a));
      out[tab] = rows.map((o) => String(o.id || "")).filter(Boolean);
    }
    return out;
  }, [sellerOrdersForBadges, sellerOrderDismissedIdsByTab]);

  /** Buying nav: count orders not yet dismissed (works while Selling — uses `polledBuyerOrders`). */
  const purchaseNavBadgeCount = useMemo(
    () => RECENT_ORDER_TAB_KEYS.reduce((sum, tab) => sum + (buyerUnseenIdsByTab[tab]?.length || 0), 0),
    [buyerUnseenIdsByTab],
  );

  const sellerNavBadgeCount = useMemo(
    () => RECENT_ORDER_TAB_KEYS.reduce((sum, tab) => sum + (sellerUnseenIdsByTab[tab]?.length || 0), 0),
    [sellerUnseenIdsByTab],
  );

  /** When true, mobile/desktop Purchases & Orders nav badges use slate for the *unseen* count. False = rose for any unseen tab (matches status tab pills, including Pending/Processing). */
  const purchasesNavAttentionMuted = false;
  const ordersNavAttentionMuted = false;

  const cartSeenSet = useMemo(() => new Set(cartSeenListingIds.map(String)), [cartSeenListingIds]);
  /** Cart lines not yet “seen” after leaving Cart — mirrors order-tab dismissal counts. */
  const cartNavBadgeCount = useMemo(() => {
    let n = 0;
    for (const it of cartItems) {
      const lid = String(it?.listingId || "");
      if (lid && !cartSeenSet.has(lid)) n += 1;
    }
    return Math.min(99, Math.max(0, n));
  }, [cartItems, cartSeenSet]);

  /** Cart + pipeline order counts for LoggedInHeader muted badges (rose = unseen attention; slate = total only). */
  const headerTotalCartCount = useMemo(() => cartItems.length, [cartItems]);
  /** Purchases/Orders: muted count excludes Completed/Cancelled — only Pending + Processing. */
  const headerTotalPurchasesCount = useMemo(() => {
    const list = buyerOrdersForBadges ?? [];
    return list.filter(
      (o) =>
        orderMatchesOrdersStatusTab(o.status, "pending") ||
        orderMatchesOrdersStatusTab(o.status, "processing"),
    ).length;
  }, [buyerOrdersForBadges]);
  const headerTotalOrdersCount = useMemo(() => {
    const list = sellerOrdersForBadges ?? [];
    return list.filter(
      (o) =>
        orderMatchesOrdersStatusTab(o.status, "pending") ||
        orderMatchesOrdersStatusTab(o.status, "processing"),
    ).length;
  }, [sellerOrdersForBadges]);

  /** Mobile bottom “Inbox” tab badge: chats + buyer/seller attention + unread notifications. */
  const inboxNavBadgeCount = useMemo(() => {
    const raw =
      totalChatUnreadCount +
      purchaseNavBadgeCount +
      sellerNavBadgeCount +
      unreadNotificationCount;
    return Math.min(99, Math.max(0, raw));
  }, [
    totalChatUnreadCount,
    purchaseNavBadgeCount,
    sellerNavBadgeCount,
    unreadNotificationCount,
  ]);

  const profileDashboardStats = useMemo(
    () => [
      {
        key: "cart",
        label: "Cart",
        value: cartNavBadgeCount,
      },
      { key: "buying", label: "Buying", value: purchaseNavBadgeCount },
      { key: "selling", label: "Selling", value: sellerNavBadgeCount },
      { key: "favorites", label: "Favorites", value: favoritesNavBadgeCount },
    ],
    [cartNavBadgeCount, purchaseNavBadgeCount, sellerNavBadgeCount, favoritesNavBadgeCount],
  );

  const ordersTabBadgeIdsByTab = ordersRole === "seller" ? sellerUnseenIdsByTab : buyerUnseenIdsByTab;
  const ordersTabRecentPendingIds = ordersTabBadgeIdsByTab.pending;

  const pendingTabPillCount = useMemo(() => {
    const placedIds = new Set(
      orders
        .filter((o) => orderMatchesOrdersStatusTab(o.status, "pending"))
        .map((o) => String(o?.id || ""))
        .filter(Boolean),
    );
    let n = 0;
    for (const id of ordersTabBadgeIdsByTab.pending || []) {
      if (placedIds.has(String(id))) n += 1;
    }
    return n;
  }, [orders, ordersTabBadgeIdsByTab.pending]);

  /** Pending/Processing tab pills: prefer unseen count; if dismissed but rows remain, show tab total (muted badge always visible when queue non-empty). */
  const pendingTabBadgeDisplayCount = useMemo(() => {
    const totalInTab = orders.filter((o) => orderMatchesOrdersStatusTab(o.status, "pending")).length;
    if (pendingTabPillCount > 0) return pendingTabPillCount;
    if (totalInTab > 0) return totalInTab;
    return 0;
  }, [orders, pendingTabPillCount]);

  const processingTabBadgeDisplayCount = useMemo(() => {
    const unseenLen = ordersTabBadgeIdsByTab.processing?.length || 0;
    const totalInTab = orders.filter((o) => orderMatchesOrdersStatusTab(o.status, "processing")).length;
    if (unseenLen > 0) return unseenLen;
    if (totalInTab > 0) return totalInTab;
    return 0;
  }, [orders, ordersTabBadgeIdsByTab.processing]);

  const listingDescriptionCount = useMemo(() => String(listingForm.description || "").length, [listingForm.description]);
  const listingRequiredCompletedCount = useMemo(() => {
    let done = 0;
    if (String(listingForm.title || "").trim()) done += 1;
    if (String(listingForm.categories || "").trim()) done += 1;
    if (String(listingForm.pricePesos || "").trim()) done += 1;
    if (String(listingForm.quantity || "").trim()) done += 1;
    return done;
  }, [listingForm.title, listingForm.categories, listingForm.pricePesos, listingForm.quantity]);
  const listingRequiredTotalCount = 4;
  const listingFormDirty = useMemo(() => {
    return Boolean(
      String(listingForm.title || "").trim() ||
        String(listingForm.description || "").trim() ||
        String(listingForm.pricePesos || "").trim() ||
        String(listingForm.quantity || "").trim() ||
        String(listingForm.categories || "").trim() ||
      String(listingForm.optionNameA || "").trim() ||
      String(listingForm.optionValuesA || "").trim() ||
      String(listingForm.optionNameB || "").trim() ||
      String(listingForm.optionValuesB || "").trim() ||
      String(listingForm.processingTime || "").trim() ||
      String(listingForm.orderType || "in_stock") !== "in_stock" ||
        listingForm.pickup ||
        listingForm.delivery ||
        listingImageFile ||
        listingImagePreviewUrl ||
        listingExtraImages.length > 0 ||
        editingListingId,
    );
  }, [editingListingId, listingExtraImages.length, listingForm, listingImageFile, listingImagePreviewUrl]);
  const profileConnectedSocialCount = useMemo(() => {
    let count = 0;
    if (String(profileDraft.facebookUrl || "").trim()) count += 1;
    if (String(profileDraft.twitterUrl || "").trim()) count += 1;
    if (String(profileDraft.instagramUrl || "").trim()) count += 1;
    return count;
  }, [profileDraft.facebookUrl, profileDraft.instagramUrl, profileDraft.twitterUrl]);

  const refreshFavorites = useCallback(async () => {
    if (!token) return;
    setFavoritesFetchError("");
    try {
      const d = await apiRequest("/me/favorites", { token });
      setFavoritesList(d.favorites || []);
      setFavoriteIds(new Set((d.favorites || []).map((x) => x.id)));
    } catch (e) {
      setFavoritesFetchError(e?.message || "Could not load favorites.");
      setFavoriteIds(new Set());
    }
  }, [token]);

  const refreshCart = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiRequest("/me/cart", { token });
      const incoming = Array.isArray(d?.items) ? d.items : [];
      setCartItems((prev) => mergeCartItemsPreservingOrder(prev, incoming));
    } catch {
      setCartItems([]);
    }
  }, [token, mergeCartItemsPreservingOrder]);

  const refreshCurrentUserProfile = useCallback(async () => {
    if (!token) return;
    const data = await apiRequest("/auth/me", { token });
    const incoming = data?.user || {};
    setUser((prev) => mergeIncomingUserWithMembership(incoming, prev));
    const joined = incoming.joinedAt || incoming.createdAt || incoming.created_at || "";
    if (joined) setProfileJoinedAt(joined);
    setProfileJoinedAtResolved(true);
  }, [token, mergeIncomingUserWithMembership]);

  const setCartLineQuantity = useCallback(
    async (listingId, rawTarget, variantSignature = "") => {
      const id = String(listingId);
      const sig = String(variantSignature ?? "");
      const lineKey = cartLineKeyFromItem({ listingId: id, variantSignature: sig });
      const item = cartItems.find(
        (i) => String(i.listingId) === id && String(i.variantSignature ?? "") === sig,
      );
      if (!item) return;
      const maxStock = Number(item.listingQuantity);
      const maxQ =
        Number.isFinite(maxStock) && maxStock >= 1 ? maxStock : Math.max(1, Number(item.quantity) || 1);
      const n = Math.floor(Number(rawTarget));
      if (!Number.isFinite(n) || n < 0) return;
      if (n === 0) {
        if (token) {
          setCartQtySavingId(lineKey);
          startCartItemFadeOut(lineKey);
          try {
            await apiRequest(`/me/cart/items/${id}${cartItemApiQuerySuffix(sig)}`, {
              method: "DELETE",
              token,
            });
            clearMarketplaceToasts();
          } catch (e) {
            cancelCartItemFadeOut(lineKey);
            pushMarketplaceToast(e.message || "Could not remove item from cart.");
          } finally {
            setCartQtySavingId(null);
          }
        } else {
          startCartItemFadeOut(lineKey);
        }
        return;
      }
      const clamped = Math.min(maxQ, Math.max(1, n));

      if (token) {
        setCartQtySavingId(lineKey);
        try {
          const d = await apiRequest(`/me/cart/items/${id}${cartItemApiQuerySuffix(sig)}`, {
            method: "PATCH",
            token,
            body: { quantity: clamped },
          });
          const incoming = Array.isArray(d?.items) ? d.items : [];
          setCartItems((prev) => mergeCartItemsPreservingOrder(prev, incoming));
          clearMarketplaceToasts();
        } catch (e) {
          pushMarketplaceToast(e.message || "Could not update quantity.");
        } finally {
          setCartQtySavingId(null);
        }
      } else {
        setCartItems((prev) =>
          prev.map((it) => (cartLineKeyFromItem(it) === lineKey ? { ...it, quantity: clamped } : it)),
        );
      }
    },
    [cancelCartItemFadeOut, cartItems, mergeCartItemsPreservingOrder, startCartItemFadeOut, token],
  );

  useEffect(() => {
    return () => {
      Object.values(cartQtyCommitTimersRef.current).forEach((timerId) => {
        clearTimeout(timerId);
      });
      Object.values(cartRemovingListingIdsRef.current).forEach((timerId) => {
        clearTimeout(timerId);
      });
      cartQtyCommitTimersRef.current = {};
      cartRemovingListingIdsRef.current = {};
    };
  }, []);

  const toggleCartListingSelected = useCallback((lineKey) => {
    const key = String(lineKey || "");
    if (!key) return;
    setCartItemSelection((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  }, []);

  const toggleCartSellerSelectAll = useCallback((items) => {
    const keys = items.map((i) => cartLineKeyFromItem(i));
    setCartItemSelection((prev) => {
      const allOn = keys.length > 0 && keys.every((k) => prev[k]);
      const next = { ...prev };
      for (const k of keys) {
        if (allOn) delete next[k];
        else next[k] = true;
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
    const valid = new Set(cartItems.map((i) => cartLineKeyFromItem(i)));
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
    () => cartItems.filter((item) => cartItemSelection[cartLineKeyFromItem(item)]),
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
      pushMarketplaceToast("Select at least one product to check out.");
      return;
    }
    if (!token) {
      pushMarketplaceToast("Please sign in to check out.");
      return;
    }
    if (!buyNowFromProfile.ready) {
      pushMarketplaceToast("Complete your profile to buy.");
      return;
    }
    setCartCheckoutSubmitting(true);
    let successCount = 0;
    let failedCount = 0;
    for (const item of selectedCartItems) {
      const listingId = String(item?.listingId || "");
      if (!listingId) continue;
      const variantSig = String(item?.variantSignature ?? "");
      const lineKey = cartLineKeyFromItem(item);
      const qty = Math.max(1, Math.floor(Number(item?.quantity) || 1));
      const modes = Array.isArray(item?.fulfillmentModes) ? item.fulfillmentModes.map(String) : [];
      const storedFt = String(item?.fulfillmentType || "").trim();
      const fulfillmentType =
        storedFt === "pickup" || storedFt === "delivery"
          ? modes.includes(storedFt)
            ? storedFt
            : modes.includes("pickup")
              ? "pickup"
              : modes.includes("delivery")
                ? "delivery"
                : "pickup"
          : modes.includes("pickup")
            ? "pickup"
            : modes.includes("delivery")
              ? "delivery"
              : "pickup";
      try {
        await apiRequest("/orders", {
          method: "POST",
          token,
          body: {
            listingId,
            fulfillmentType,
            quantity: qty,
            comment: String(item?.comment || "").trim().slice(0, 2000),
            variantSignature: String(item?.variantSignature ?? "").trim().slice(0, 512),
          },
        });
        successCount += 1;
        startCartItemFadeOut(lineKey);
        try {
          await apiRequest(`/me/cart/items/${listingId}${cartItemApiQuerySuffix(variantSig)}`, {
            method: "DELETE",
            token,
          });
        } catch {
          // Keep checkout success even if cart row deletion returns an error.
          cancelCartItemFadeOut(lineKey);
        }
      } catch {
        failedCount += 1;
      }
    }
    setCartCheckoutSubmitting(false);
    setCartItemSelection({});
    if (successCount > 0) {
      pushMarketplaceToast(
        failedCount === 0
          ? `Checked out ${successCount} item${successCount > 1 ? "s" : ""}.`
          : `Checked out ${successCount} item${successCount > 1 ? "s" : ""}. ${failedCount} failed.`,
      );
      goMyPurchases();
      return;
    }
    pushMarketplaceToast("Could not check out selected items.");
  }, [buyNowFromProfile.ready, cancelCartItemFadeOut, goMyPurchases, mergeCartItemsPreservingOrder, selectedCartItems, startCartItemFadeOut, token]);

  const applyTransitionToSelectedOrders = useCallback(
    async (transition, label, cancelPayload = null) => {
      const transitionNorm = String(transition ?? "").trim();
      if (!selectedOrders.length) {
        pushMarketplaceToast("Select at least one order first.");
        return;
      }
      if (!token) {
        pushMarketplaceToast("Please sign in to update orders.");
        return;
      }
      clearMarketplaceToasts();
      setOrdersBulkActionLoadingTransition(transitionNorm);
      try {
        let successCount = 0;
        let failedCount = 0;
        let firstFailureMessage = "";
        for (const order of selectedOrders) {
          const oid = String(order?.id ?? "").trim();
          if (!oid) {
            failedCount += 1;
            if (!firstFailureMessage) firstFailureMessage = "Missing order id.";
            continue;
          }
          try {
            const body = { transition: transitionNorm };
            if (transitionNorm === "cancel" && cancelPayload && typeof cancelPayload === "object") {
              const cr = String(cancelPayload.cancellationReason || "").trim();
              if (cr) body.cancellationReason = cr;
              const cn = String(cancelPayload.cancellationNote || "").trim();
              if (cn) body.cancellationNote = cn;
            }
            await apiRequest(`/orders/${oid}`, { method: "PATCH", token, body });
            successCount += 1;
          } catch (e) {
            failedCount += 1;
            const msg = typeof e?.message === "string" ? e.message.trim() : "";
            if (!firstFailureMessage && msg) firstFailureMessage = msg;
          }
        }
        try {
          const data = await apiRequest(`/orders?role=${ordersRole}`, { token });
          setOrders(data.orders || []);
        } catch {
          // Keep prior rows if refresh fails; result banner still informs user.
        }
        setOrderSelection({});
        if (successCount > 0) {
          pushMarketplaceToast(
            failedCount === 0
              ? `${label} ${successCount} order${successCount > 1 ? "s" : ""}.`
              : `${label} ${successCount} order${successCount > 1 ? "s" : ""}. ${failedCount} failed.`,
          );
        } else {
          const verb =
            transitionNorm === "cancel"
              ? "decline"
              : transitionNorm === "seller_accept"
                ? "accept"
                : "update";
          pushMarketplaceToast(
            firstFailureMessage || `Could not ${verb} selected orders.`,
          );
        }
      } finally {
        setOrdersBulkActionLoadingTransition(null);
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
    if (!user || shopCommunityId || !joinedShopCommunityId) return undefined;
    if (skipAutoCommunityBrowseRef.current) return undefined;
    setShopCommunityId(String(joinedShopCommunityId));
    if (activeView === VIEWS.BROWSE) setActiveView(VIEWS.COMMUNITY_SHOP);
    return undefined;
  }, [user, shopCommunityId, joinedShopCommunityId, activeView]);

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

  /** If user opened the global directory (`leaveCommunityToGlobalMarketplace`) but there is no profile listing community, the skip ref is only cleared by the effect above when `listingCommunityFromProfile.id` is set — reset here so it does not stick forever. */
  useEffect(() => {
    if (!skipAutoCommunityBrowseRef.current) return undefined;
    if (activeView !== VIEWS.BROWSE || shopCommunityId) return undefined;
    if (!listingCommunityFromProfile.id) skipAutoCommunityBrowseRef.current = false;
    return undefined;
  }, [activeView, shopCommunityId, listingCommunityFromProfile.id]);

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
      // Keep user intent on non-browse screens (e.g., post-buy redirect to My purchases).
      if ([VIEWS.BROWSE, VIEWS.COMMUNITY_SHOP, VIEWS.FAVORITES].includes(activeView)) {
        setActiveView(VIEWS.COMMUNITY_SHOP);
      }
    }
    return undefined;
  }, [shopCommunityId, activeView]);
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
    let cancelled = false;
    void loadCommunityShopListings({ cancelledRef: () => cancelled, preserveExistingRows: false });
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
    loadCommunityShopListings,
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

  const refetchOrders = useCallback(async () => {
    if (!token) return;
    setOrdersFetchError("");
    setOrdersLoading(true);
    try {
      const data = await apiRequest(`/orders?role=${ordersRole}`, { token });
      setOrders(data.orders || []);
    } catch (e) {
      setOrdersFetchError(e?.message || "Could not load orders.");
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [token, ordersRole]);

  const refetchSellerListings = useCallback(async () => {
    if (!token) return;
    setSellerListingsFetchError("");
    setSellerListingsLoading(true);
    try {
      const data = await apiRequest("/me/listings", { token });
      setSellerListings(data.listings || []);
    } catch (e) {
      setSellerListingsFetchError(e?.message || "Could not load your listings.");
      setSellerListings([]);
    } finally {
      setSellerListingsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    if (ordersRole === "seller") {
      if (activeView !== VIEWS.ORDERS) return undefined;
    } else if (ordersRole !== "buyer") {
      return undefined;
    }
    const roleKey = String(ordersRole);
    const roleScopeChanged = ordersDataQueryKeyRef.current !== roleKey;
    if (roleScopeChanged) {
      ordersDataQueryKeyRef.current = roleKey;
      setOrders([]);
      setOrdersLoading(true);
    }
    let cancelled = false;
    (async () => {
      if (!roleScopeChanged && ordersRef.current.length === 0) setOrdersLoading(true);
      try {
        setOrdersFetchError("");
        const data = await apiRequest(`/orders?role=${ordersRole}`, { token });
        if (!cancelled) setOrders(data.orders || []);
      } catch (e) {
        if (!cancelled) {
          setOrders([]);
          setOrdersFetchError(e?.message || "Could not load orders.");
        }
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeView, ordersRole]);

  /** Keep buyer `orders` fresh on any screen so Processing/Cancelled tab badges update when the seller accepts or declines. */
  useEffect(() => {
    if (!token) return undefined;
    if (ordersRole !== "buyer") return undefined;
    let cancelled = false;
    const run = async () => {
      try {
        const data = await apiRequest("/orders?role=buyer", { token });
        if (!cancelled) setOrders(data.orders || []);
      } catch {
        // Keep existing rows on transient errors; initial load still clears via the main orders effect on role change.
      }
    };
    void run();
    const id = window.setInterval(run, 90000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token, ordersRole]);

  /** Refetch seller-side order list for Sales inbox rows or off-screen nav badges (same API as HTTP polling). */
  const refreshSellerOrdersSnapshot = useCallback(async (isCancelled) => {
    const cancelledFn = typeof isCancelled === "function" ? isCancelled : () => false;
    const t = authTokenRef.current;
    if (!t || cancelledFn()) return;
    try {
      const data = await apiRequest("/orders?role=seller", { token: t });
      if (cancelledFn()) return;
      const list = data.orders || [];
      const onSellerOrdersScreen = ordersRoleRef.current === "seller" && activeViewRef.current === VIEWS.ORDERS;
      if (onSellerOrdersScreen) setOrders(list);
      else setPolledSellerOrders(list);
    } catch {
      if (cancelledFn()) return;
      const onSellerOrdersScreen = ordersRoleRef.current === "seller" && activeViewRef.current === VIEWS.ORDERS;
      if (!onSellerOrdersScreen) setPolledSellerOrders([]);
    }
  }, []);

  /** Refetch buyer orders when Supabase Realtime reports a row change (RLS ensures only your parties). */
  const refreshBuyerOrdersSnapshot = useCallback(async (isCancelled) => {
    const cancelledFn = typeof isCancelled === "function" ? isCancelled : () => false;
    const t = authTokenRef.current;
    if (!t || cancelledFn()) return;
    try {
      const data = await apiRequest("/orders?role=buyer", { token: t });
      if (cancelledFn()) return;
      const list = data.orders || [];
      if (ordersRoleRef.current === "buyer") setOrders(list);
      else setPolledBuyerOrders(list);
    } catch {
      if (cancelledFn()) return;
      if (ordersRoleRef.current !== "buyer") setPolledBuyerOrders([]);
    }
  }, []);

  /** Keep seller `orders` fresh on the Orders screen (off-screen seller poll skips this view). */
  useEffect(() => {
    if (!token) return undefined;
    if (ordersRole !== "seller") return undefined;
    if (activeView !== VIEWS.ORDERS) return undefined;
    let cancelled = false;
    const isCancelled = () => cancelled;
    void refreshSellerOrdersSnapshot(isCancelled);
    const id = window.setInterval(() => void refreshSellerOrdersSnapshot(isCancelled), SELLER_ORDERS_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshSellerOrdersSnapshot(isCancelled);
    };
    const onFocus = () => void refreshSellerOrdersSnapshot(isCancelled);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [token, activeView, ordersRole, refreshSellerOrdersSnapshot]);

  useEffect(() => {
    if (!token) return undefined;
    const onSellerOrdersScreen = ordersRole === "seller" && activeView === VIEWS.ORDERS;
    if (onSellerOrdersScreen) return undefined;
    let cancelled = false;
    const isCancelled = () => cancelled;
    void refreshSellerOrdersSnapshot(isCancelled);
    const id = window.setInterval(() => void refreshSellerOrdersSnapshot(isCancelled), SELLER_ORDERS_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshSellerOrdersSnapshot(isCancelled);
    };
    const onFocus = () => void refreshSellerOrdersSnapshot(isCancelled);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [token, activeView, ordersRole, refreshSellerOrdersSnapshot]);

  /** While Selling, keep a buyer order snapshot for Buying nav badges (mirrors off-screen seller poll). */
  useEffect(() => {
    if (!token) return undefined;
    if (ordersRole !== "seller") return undefined;
    let cancelled = false;
    const isCancelled = () => cancelled;
    void refreshBuyerOrdersSnapshot(isCancelled);
    const id = window.setInterval(() => void refreshBuyerOrdersSnapshot(isCancelled), SELLER_ORDERS_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshBuyerOrdersSnapshot(isCancelled);
    };
    const onFocus = () => void refreshBuyerOrdersSnapshot(isCancelled);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [token, ordersRole, refreshBuyerOrdersSnapshot]);

  /**
   * Supabase Realtime: refetch order lists when `public.orders` rows you are party to change (RLS filters events).
   * Debounced to coalesce bursts; HTTP polling above is a slow fallback if the socket is down.
   */
  useEffect(() => {
    const supabase = createSupabaseClient();
    if (!supabase || !token || !user?.id) return undefined;
    let debounceTimer = null;
    const flush = () => {
      debounceTimer = null;
      void refreshSellerOrdersSnapshot(() => false);
      void refreshBuyerOrdersSnapshot(() => false);
    };
    const onOrdersChange = () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(flush, ORDERS_REALTIME_DEBOUNCE_MS);
    };
    const channel = supabase
      .channel(`lm-orders-rt:${String(user.id)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, onOrdersChange)
      .subscribe();
    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [token, user?.id, refreshSellerOrdersSnapshot, refreshBuyerOrdersSnapshot]);

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
    if (!token || !isBrowseLikeView || usersList.length > 0) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest("/users", { token });
        if (!cancelled) setUsersList(Array.isArray(data?.users) ? data.users : []);
      } catch {
        // Seller details in product modal can still fall back to listing payload.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isBrowseLikeView, usersList.length]);

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
        setSellerListingsFetchError("");
        const data = await apiRequest("/me/listings", { token });
        if (!cancelled) setSellerListings(data.listings || []);
      } catch (e) {
        if (!cancelled) {
          setSellerListings([]);
          setSellerListingsFetchError(e?.message || "Could not load your listings.");
        }
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

  const refreshMobileNavigationState = useCallback(
    async ({ skip = {} } = {}) => {
      const tasks = [];
      if (!skip.messages) tasks.push(refreshConversationsSnapshot());
      if (!skip.cart) tasks.push(refreshCart());
      if (!skip.favorites) tasks.push(refreshFavorites());
      if (!skip.listings) tasks.push(refetchSellerListings());
      if (!skip.sellerOrders) tasks.push(refreshSellerOrdersSnapshot(() => false));
      if (!skip.buyerOrders) tasks.push(refreshBuyerOrdersSnapshot(() => false));
      if (!skip.profile) tasks.push(refreshCurrentUserProfile());
      const results = await Promise.allSettled(tasks);
      const failed = results.find((r) => r.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
    },
    [
      refreshConversationsSnapshot,
      refreshCart,
      refreshFavorites,
      refetchSellerListings,
      refreshSellerOrdersSnapshot,
      refreshBuyerOrdersSnapshot,
      refreshCurrentUserProfile,
    ],
  );

  const refreshMobileViewAndNavigation = useCallback(async () => {
    if (!token) return;
    let viewRefresh;
    let skip = {};
    switch (activeView) {
      case VIEWS.BROWSE:
      case VIEWS.COMMUNITY_SHOP:
        viewRefresh = () => loadCommunityShopListings({ preserveExistingRows: true });
        break;
      case VIEWS.FAVORITES:
        viewRefresh = () => refreshFavorites();
        skip = { favorites: true };
        break;
      case VIEWS.MESSAGES:
        viewRefresh = () => refreshConversationsSnapshot();
        skip = { messages: true };
        break;
      case VIEWS.NOTIFICATIONS:
        viewRefresh = () => Promise.resolve();
        break;
      case VIEWS.PROFILE:
        viewRefresh = () => refreshCurrentUserProfile();
        skip = { profile: true };
        break;
      default:
        viewRefresh = () => Promise.resolve();
        break;
    }
    const [viewResult, navResult] = await Promise.allSettled([viewRefresh(), refreshMobileNavigationState({ skip })]);
    const failed = [viewResult, navResult].find((r) => r.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  }, [
    token,
    activeView,
    loadCommunityShopListings,
    refreshFavorites,
    refreshConversationsSnapshot,
    refreshCurrentUserProfile,
    refreshMobileNavigationState,
  ]);

  const { isPullRefreshing: mobilePullRefreshing } = useMobilePullToRefresh({
    enabled:
      Boolean(token) &&
      isMobileViewport &&
      (activeView === VIEWS.BROWSE ||
        activeView === VIEWS.COMMUNITY_SHOP ||
        activeView === VIEWS.FAVORITES ||
        activeView === VIEWS.MESSAGES ||
        activeView === VIEWS.NOTIFICATIONS ||
        activeView === VIEWS.PROFILE),
    isBusy: listingsBusyRef.current || favoritesLoading || ordersLoading || sellerListingsLoading || cartCheckoutSubmitting,
    onRefresh: refreshMobileViewAndNavigation,
    onError: (error) => {
      pushMarketplaceToast(error?.message || "Could not refresh right now. Please try again.");
    },
  });

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
    clearMarketplaceToasts();
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
    clearMarketplaceToasts();
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
      pushMarketplaceToast("Sign in again to add a community.");
      return;
    }
    const nameDraft = String(communityForm.name || "").trim();
    const communityName = nameDraft || `Community ${new Date().toISOString().slice(0, 10)}`;
    const cityDraft = String(communityForm.city || "").trim();
    const provinceDraft = String(communityForm.province || "").trim();
    const postalDraft = String(communityForm.postalCode || "").trim();
    setCommunitySaving(true);
    clearMarketplaceToasts();
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
      if (!communityEditingId && createdCommunity?.id) {
        setShopCommunityId(String(createdCommunity.id));
        setActiveView(VIEWS.COMMUNITY_SHOP);
        void joinCommunityAndAttachListings(createdCommunity);
      }
      pushMarketplaceToast(communityEditingId ? "Community updated." : "Community added.");
    } catch (e) {
      pushMarketplaceToast(e.message || "Could not create new community.");
    } finally {
      setCommunitySaving(false);
    }
  };

  const toggleFavorite = async (listingId, makeFavorite) => {
    if (!token) return;
    clearMarketplaceToasts();
    const id = String(listingId || "");
    const candidate =
      listings.find((x) => String(x.id) === id) ||
      favoritesList.find((x) => String(x.id) === id) ||
      (quickAddListing && String(quickAddListing.id) === id ? quickAddListing : null) ||
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
      setFavoriteSeenListingIds((prev) => prev.filter((x) => String(x) !== id));
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
      if (isUnauthorizedApiError(e)) {
        writeAuthToken("");
        setToken("");
        setUser(null);
        setMessage("Session expired. Please sign in again to update favorites.");
        setAuthMode("login");
        setAuthPanelVisible(true);
        pushMarketplaceToast("Session expired. Please sign in again.");
        return;
      }
      pushMarketplaceToast(e.message || "Could not update favorites.");
    }
  };

  const refreshOrdersList = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest(`/orders?role=${ordersRole}`, { token });
      setOrders(data.orders || []);
    } catch {
      /* ignore */
    }
  }, [token, ordersRole]);

  const refreshCourierHub = useCallback(async () => {
    if (!token) return;
    setCourierHubLoading(true);
    try {
      const [sellerData, buyerData, openData] = await Promise.all([
        apiRequest(`/orders?role=seller`, { token }),
        apiRequest(`/orders?role=buyer`, { token }),
        apiRequest(`/delivery/open`, { token }).catch(() => ({ orders: [] })),
      ]);
      setCourierHubOrders(sellerData.orders || []);
      setCourierHubBuyerOrders(buyerData.orders || []);
      const open = Array.isArray(openData?.orders) ? openData.orders : [];
      setCourierOpenDeliveryCount(open.length);
    } catch {
      setCourierHubOrders([]);
      setCourierHubBuyerOrders([]);
      setCourierOpenDeliveryCount(0);
    } finally {
      setCourierHubLoading(false);
    }
  }, [token]);

  const refreshCourierAndOrders = useCallback(async () => {
    await refreshOrdersList();
    await refreshCourierHub();
  }, [refreshOrdersList, refreshCourierHub]);

  const courierSellerAssignOrders = useMemo(
    () =>
      courierHubOrders.filter(
        (o) => String(o.fulfillmentType || "") === "delivery" && isDeliverySellerPreparing(o),
      ),
    [courierHubOrders],
  );

  const courierBuyerAssignOrders = useMemo(
    () =>
      courierHubBuyerOrders.filter(
        (o) => String(o.fulfillmentType || "") === "delivery" && isDeliverySellerPreparing(o),
      ),
    [courierHubBuyerOrders],
  );

  useEffect(() => {
    if (activeView !== VIEWS.COURIER || !token) return undefined;
    void refreshCourierHub();
    return undefined;
  }, [activeView, token, refreshCourierHub]);

  const patchOrderTransition = async (orderId, transition, options = {}) => {
    const { orderIds, successMessage } = options;
    const transitionNorm = String(transition ?? "").trim();
    clearMarketplaceToasts();
    try {
      const batchTransitions = new Set(["buyer_ack_receipt", "mark_ready_for_pickup"]);
      const ids =
        batchTransitions.has(transitionNorm) && Array.isArray(orderIds) && orderIds.length > 0
          ? [...new Set(orderIds.map((x) => String(x || "")).filter(Boolean))]
          : [String(orderId || "")].filter(Boolean);
      for (const id of ids) {
        await apiRequest(`/orders/${id}`, { method: "PATCH", token, body: { transition: transitionNorm } });
      }
      const data = await apiRequest(`/orders?role=${ordersRole}`, { token });
      setOrders(data.orders || []);
      void refreshCourierHub();
      pushMarketplaceToast(successMessage || "Order updated.");
    } catch (e) {
      pushMarketplaceToast(e.message || "Could not update order.");
    }
  };

  const submitOrderReview = async (orderId, rating, reviewText) => {
    clearMarketplaceToasts();
    try {
      await apiRequest(`/orders/${orderId}/review`, { method: "PUT", token, body: { rating, reviewText } });
      const data = await apiRequest(`/orders?role=${ordersRole}`, { token });
      setOrders(data.orders || []);
      pushMarketplaceToast("Thanks for your feedback.");
    } catch (e) {
      pushMarketplaceToast(e.message || "Could not save review.");
    }
  };

  const handleAddExpense = async (ev) => {
    ev.preventDefault();
    const pesos = Number(expenseDraft.amountPesos);
    if (!Number.isFinite(pesos) || pesos < 0) {
      pushMarketplaceToast("Invalid expense amount.");
      return;
    }
    clearMarketplaceToasts();
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
      const exp = await apiRequest("/me/expenses", { token });
      setExpenses(exp.expenses || []);
      pushMarketplaceToast("Expense added.");
    } catch (e) {
      pushMarketplaceToast(e.message || "Could not add expense.");
    }
  };

  const deleteExpenseById = async (id) => {
    try {
      await apiRequest(`/me/expenses/${id}`, { method: "DELETE", token });
      const exp = await apiRequest("/me/expenses", { token });
      setExpenses(exp.expenses || []);
    } catch (e) {
      pushMarketplaceToast(e.message || "Could not delete.");
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
          optionNameA: "",
          optionValuesA: "",
          optionNameB: "",
          optionValuesB: "",
          orderType: "in_stock",
          processingTime: "",
          pickup: false,
          delivery: false,
        });
        setListingFieldErrors({});
        setListingImageFile(null);
        setListingCoverContentHash("");
        if (listingImagePreviewUrl && listingImagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(listingImagePreviewUrl);
        setListingImagePreviewUrl("");
        clearListingExtraImages();
        setListingCropQueue([]);
        closeListingCropEditor();
        closeListingPhotoActionModal();
        setListingAdvancedOpen(false);
        setListingOptionValueDraftA("");
        setListingOptionValueDraftB("");
        setListingSecondOptionOpen(false);
      }
      pushMarketplaceToast("Listing deleted.");
    } catch (e) {
      pushMarketplaceToast(e.message || "Could not delete listing.");
    }
  };

  const applySellerListingDiscount = async (listing, percent) => {
    const id = String(listing?.id || "");
    if (!id) return;
    const pct = Number(percent);
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
      pushMarketplaceToast("Choose a valid discount percentage.");
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
      pushMarketplaceToast("Discount did not change the price.");
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
      pushMarketplaceToast(`Applied ${pct}% discount.`);
    } catch (e) {
      pushMarketplaceToast(e.message || "Could not apply discount.");
    }
  };

  const openQuickAddModal = (listing, actionType = "cart") => {
    if (!listing?.id) return;
    const stock = Math.max(0, Number(listing.quantity) || 0);
    if (stock <= 0) {
      pushMarketplaceToast("This item is currently out of stock.");
      return;
    }
    const mode = actionType === "buy" ? "buy" : "cart";
    if (mode === "buy") {
      if (!token) {
        pushMarketplaceToast("Sign in to buy.");
        return;
      }
      if (!buyNowFromProfile.ready) {
        pushMarketplaceToast("Complete your profile to buy.");
        return;
      }
    }
    const listingModes = Array.isArray(listing.fulfillmentModes) && listing.fulfillmentModes.length ? listing.fulfillmentModes : ["pickup"];
    const defaultFulfillment = listingModes.includes("pickup") ? "pickup" : listingModes[0];
    const savedPref = readQuickOrderFulfillmentPref();
    const initialFulfillment =
      savedPref && listingModes.includes(savedPref) ? savedPref : defaultFulfillment;
    const sourceView =
      activeView === VIEWS.PRODUCT_DETAIL
        ? String(productInspectReturnRef.current?.view || VIEWS.BROWSE)
        : activeView;
    const sourceCommunityId =
      activeView === VIEWS.PRODUCT_DETAIL
        ? (productInspectReturnRef.current?.shopCommunityId ? String(productInspectReturnRef.current.shopCommunityId) : null)
        : (shopCommunityId || null);
    productFlowOriginRef.current = {
      listingId: String(listing.id || ""),
      view: sourceView,
      shopCommunityId: sourceCommunityId,
    };
    if (activeView === VIEWS.PRODUCT_DETAIL && productInspect) {
      closeProductInspect();
    }
    const valsA = normalizeListingOptionValues(listing.optionValuesA);
    const valsB = normalizeListingOptionValues(listing.optionValuesB);
    const optNameA = String(listing.optionNameA || "").trim();
    const optNameB = String(listing.optionNameB || "").trim();
    setQuickAddListing(listing);
    setQuickActionType(mode);
    setQuickOrderFulfillmentType(initialFulfillment);
    setQuickAddQuantity("1");
    setQuickAddSelectedVariantA(optNameA && valsA.length ? valsA[0] : "");
    setQuickAddSelectedVariantB(optNameB && valsB.length ? valsB[0] : "");
    setQuickAddComment("");
    setQuickAddInlineError("");
    setQuickAddModalOpen(true);
  };

  const openListingFromPurchasedOrder = (listing) => {
    if (!listing?.id) {
      pushMarketplaceToast("Listing details are not available.");
      return;
    }
    const stock = Math.max(0, Number(listing.quantity) || 0);
    const hasPrice = Number.isFinite(Number(listing.priceCents));
    if (stock > 0 && hasPrice) {
      openQuickAddModal(listing, "buy");
      return;
    }
    if (stock <= 0) {
      pushMarketplaceToast("This listing is out of stock.");
      return;
    }
    setSelectedListingId(String(listing.id));
  };

  /** Deep link `/l/:id` or fetch fallback: open the standard listing modal instead of the legacy inline panel. */
  useEffect(() => {
    if (!listingDetail?.id || !selectedListingId) return undefined;
    if (String(listingDetail.id) !== String(selectedListingId)) return undefined;
    if (quickAddModalOpen) return undefined;
    const stock = Math.max(0, Number(listingDetail.quantity) || 0);
    const fromListingShareLink = Boolean(routeListingId && String(routeListingId) === String(listingDetail.id));
    if (stock <= 0) {
      pushMarketplaceToast("This listing is out of stock.");
      setSelectedListingId(null);
      if (fromListingShareLink) navigate("/", { replace: true });
      return undefined;
    }
    openQuickAddModal(listingDetail, "buy");
    setSelectedListingId(null);
    if (fromListingShareLink) navigate("/", { replace: true });
    return undefined;
  }, [listingDetail, selectedListingId, quickAddModalOpen, navigate, routeListingId]);

  useEffect(() => {
    if (quickAddImagePreviewOpen) setQuickAddLightboxImageFailed(false);
  }, [quickAddImagePreviewOpen, quickAddListing]);

  const closeQuickAddModal = () => {
    if (quickAddSubmitting) return;
    setQuickAddImagePreviewOpen(false);
    setQuickAddLightboxImageFailed(false);
    setQuickAddModalOpen(false);
    setQuickAddListing(null);
    setQuickActionType("cart");
    setQuickOrderFulfillmentType("pickup");
    setQuickAddQuantity("1");
    setQuickAddSelectedVariantA("");
    setQuickAddSelectedVariantB("");
    setQuickAddComment("");
    setQuickAddInlineError("");
    const originListingId = String(productFlowOriginRef.current?.listingId || "");
    if (originListingId && typeof document !== "undefined") {
      window.requestAnimationFrame(() => {
        const anchor = document.getElementById(`listing-card-${originListingId}`);
        if (anchor) anchor.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }
  };

  const closeProductInspect = useCallback(() => {
    const returnCtx = productInspectReturnRef.current || {};
    setProductInspect(null);
    if (activeView !== VIEWS.PRODUCT_DETAIL) return;
    const restoreView = String(returnCtx.view || VIEWS.BROWSE);
    const restoreCommunityId = returnCtx.shopCommunityId ? String(returnCtx.shopCommunityId) : null;
    const restoreScrollTop = Math.max(0, Number(returnCtx.scrollTop) || 0);
    setShopCommunityId(restoreCommunityId);
    setActiveView(restoreView);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const main = document.getElementById("main-content");
        if (main) {
          main.scrollTop = restoreScrollTop;
        }
        const anchorId = String(returnCtx.listingId || "").trim();
        if (anchorId && main && restoreScrollTop <= 0) {
          const anchor = document.getElementById(`listing-card-${anchorId}`);
          if (anchor) anchor.scrollIntoView({ block: "center", behavior: "auto" });
        }
      });
    }
  }, [activeView]);

  const openProductInspect = useCallback((listingLike, extra = {}) => {
    if (!listingLike) return;
    const sourceView = activeView === VIEWS.PRODUCT_DETAIL
      ? String(productInspectReturnRef.current?.view || VIEWS.BROWSE)
      : activeView;
    const sourceCommunityId = activeView === VIEWS.PRODUCT_DETAIL
      ? (productInspectReturnRef.current?.shopCommunityId ? String(productInspectReturnRef.current.shopCommunityId) : null)
      : (shopCommunityId ? String(shopCommunityId) : null);
    const sourceScrollTop =
      typeof document === "undefined"
        ? 0
        : Math.max(0, Number(document.getElementById("main-content")?.scrollTop || 0));
    productInspectReturnRef.current = {
      view: sourceView,
      shopCommunityId: sourceCommunityId,
      scrollTop: sourceScrollTop,
      listingId: String(listingLike.id || ""),
    };
    const priceCents = Number(listingLike.priceCents ?? listingLike.unitPriceCents) || 0;
    const sellerId = String(
      extra.sellerId ??
        listingLike.sellerId ??
        listingLike.seller?.id ??
        ""
    ).trim();
    const sellerFromDirectory = sellerId ? usersById.get(sellerId) : null;
    const sellerUsername = String(
      extra.sellerUsername ??
        listingLike.sellerUsername ??
        sellerFromDirectory?.username ??
        listingLike.seller?.username ??
        ""
    ).trim();
    const sellerAddressRaw = String(
      extra.sellerAddress ??
        listingLike.sellerAddress ??
        sellerFromDirectory?.address ??
        listingLike.seller?.address ??
        ""
    ).trim();
    const sellerAddressParts = splitAddressParts(sellerAddressRaw);
    const sellerBarangay = stripBrgyPrefixLabel(sellerAddressParts.addressBarangay);
    const sellerCityMunicipality = formatPhCityMunicipalityName(sellerAddressParts.addressCity);
    const sellerProvince = toTitleCase(sellerAddressParts.addressProvince);
    const sellerAddressLine = [sellerBarangay, sellerCityMunicipality, sellerProvince]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(", ");
    const sellerAddressFallback = String(
      extra.sellerAddressLine ??
        listingLike.cityLabel ??
        ""
    ).trim();
    const openGallery = resolveListingGalleryUrls(listingLike);
    setProductInspect({
      listingId: String(listingLike.id || ""),
      title: String(listingLike.title || "Product"),
      imageUrl: openGallery[0] ?? listingLike.imageUrl ?? listingLike.image_url,
      imageUrls: [...openGallery],
      priceCents,
      categoryLabel: getListingCategoryShortLabel(listingLike.verticalId, listingLike.subId),
      description: String(listingLike.description || ""),
      sellerUsername,
      sellerAddressLine: sellerAddressLine || sellerAddressFallback,
      onViewSellerProfile:
        sellerId && String(sellerId) !== String(user?.id || "")
          ? () => {
              closeProductInspect();
              setProfileViewReturnView(activeView);
              setProfileViewUserId(sellerId);
              setActiveView(VIEWS.PROFILE);
              if (typeof window !== "undefined") {
                window.requestAnimationFrame(() => {
                  window.scrollTo(0, 0);
                });
              }
            }
          : undefined,
      comment: String(extra.comment ?? "").trim(),
      commentSectionRequired: Boolean(extra.commentSectionRequired),
      commentHeading: extra.commentHeading || "Your note to the seller",
      fulfillmentModes: listingLike.fulfillmentModes,
      orderType: listingLike.orderType,
      processingTime: listingLike.processingTime,
      optionNameA: listingLike.optionNameA,
      optionValuesA: listingLike.optionValuesA,
      optionNameB: listingLike.optionNameB,
      optionValuesB: listingLike.optionValuesB,
      quantity:
        extra.quantity != null && Number.isFinite(Number(extra.quantity)) ? Number(extra.quantity) : null,
      quantityLabel: extra.quantityLabel || "Quantity",
      subtitle: extra.subtitle || "",
      listingStockQty:
        extra.listingStockQty != null && Number.isFinite(Number(extra.listingStockQty))
          ? Number(extra.listingStockQty)
          : null,
      listingSoldQty:
        extra.listingSoldQty != null && Number.isFinite(Number(extra.listingSoldQty))
          ? Number(extra.listingSoldQty)
          : Number.isFinite(Number(listingLike.soldCount))
          ? Number(listingLike.soldCount)
          : null,
      showBuyerCommerceActions: Boolean(extra.showBuyerCommerceActions),
      showSellerCommerceActions: Boolean(extra.showSellerCommerceActions),
      onAddToCart: typeof extra.onAddToCart === "function" ? extra.onAddToCart : undefined,
      onBuyNow: typeof extra.onBuyNow === "function" ? extra.onBuyNow : undefined,
      onEditListing: typeof extra.onEditListing === "function" ? extra.onEditListing : undefined,
      onSaleSelect: typeof extra.onSaleSelect === "function" ? extra.onSaleSelect : undefined,
      buyNowDisabled: Boolean(extra.buyNowDisabled),
      buyNowDisabledReason: String(extra.buyNowDisabledReason || ""),
      orderTimelineOrder: extra.orderTimelineOrder ?? undefined,
      orderTimelineContextTab: extra.orderTimelineContextTab ?? undefined,
      orderTimelineViewerRole: extra.orderTimelineViewerRole ?? undefined,
      orderTimelineOrderIds: Array.isArray(extra.orderTimelineOrderIds)
        ? extra.orderTimelineOrderIds.map((x) => String(x || "").trim()).filter(Boolean)
        : undefined,
      isFavorite: favoriteIds.has(String(listingLike.id || "")),
      onToggleFavorite:
        listingLike?.id
          ? () => {
              const id = String(listingLike.id || "");
              setProductInspect((prev) => {
                if (!prev) return prev;
                const nextFavorite = !Boolean(prev.isFavorite);
                void toggleFavorite(id, nextFavorite);
                return { ...prev, isFavorite: nextFavorite };
              });
            }
          : undefined,
    });
    setActiveView(VIEWS.PRODUCT_DETAIL);

    const listingIdForFetch = String(listingLike.id || "").trim();
    if (listingIdForFetch) {
      void (async () => {
        try {
          const data = await apiRequest(`/listings/${encodeURIComponent(listingIdForFetch)}`, {
            token: token || undefined,
            cache: "no-store",
          });
          const fresh = data?.listing;
          if (!fresh) return;
          const publicUrls = Array.isArray(fresh.imageUrls) ? fresh.imageUrls : [];
          const sellerMatch =
            Boolean(token) &&
            String(user?.id || "").length > 0 &&
            String(fresh.sellerId ?? listingLike?.sellerId ?? "") === String(user?.id || "");
          let effective = fresh;
          if (sellerMatch) {
            try {
              const mineData = await apiRequest("/me/listings", { token, cache: "no-store" });
              const row = (mineData.listings || []).find((l) => String(l.id) === listingIdForFetch);
              const mineUrls = Array.isArray(row?.imageUrls) ? row.imageUrls : [];
              if (row && mineUrls.length > publicUrls.length) {
                effective = {
                  ...fresh,
                  imageUrl: row.imageUrl != null ? row.imageUrl : fresh.imageUrl,
                  imageUrls: mineUrls,
                };
              }
            } catch {
              /* ignore seller gallery fallback */
            }
          }
          setProductInspect((prev) => {
            if (!prev || String(prev.listingId) !== listingIdForFetch) return prev;
            const qtyFresh =
              fresh.quantity != null && Number.isFinite(Number(fresh.quantity)) ? Math.max(0, Number(fresh.quantity)) : null;
            const soldFresh =
              fresh.soldCount != null && Number.isFinite(Number(fresh.soldCount)) ? Math.max(0, Number(fresh.soldCount)) : null;
            const apiRow = effective !== fresh ? effective : fresh;
            const apiGallery = resolveListingGalleryUrls(apiRow);
            const urlsPrev = Array.isArray(prev.imageUrls) ? prev.imageUrls : [];
            const coverHint =
              String(
                (effective !== fresh ? effective.imageUrl : fresh.imageUrl) ?? prev.imageUrl ?? "",
              ).trim() || String(prev.imageUrl || "").trim();
            const unifiedGallery = resolveListingGalleryUrls({
              imageUrl: coverHint,
              imageUrls: [...apiGallery, ...urlsPrev],
            });
            const nextImageUrl = unifiedGallery[0] ?? prev.imageUrl;
            const nextImageUrls = [...unifiedGallery];
            return {
              ...prev,
              title: String(fresh.title || prev.title),
              imageUrl: nextImageUrl,
              imageUrls: nextImageUrls,
              priceCents: Number(fresh.priceCents ?? prev.priceCents) || 0,
              description: String(fresh.description ?? prev.description),
              categoryLabel: getListingCategoryShortLabel(fresh.verticalId, fresh.subId),
              fulfillmentModes: fresh.fulfillmentModes ?? prev.fulfillmentModes,
              orderType: fresh.orderType ?? prev.orderType,
              processingTime: fresh.processingTime ?? prev.processingTime,
              optionNameA: fresh.optionNameA ?? prev.optionNameA,
              optionValuesA: fresh.optionValuesA ?? prev.optionValuesA,
              optionNameB: fresh.optionNameB ?? prev.optionNameB,
              optionValuesB: fresh.optionValuesB ?? prev.optionValuesB,
              listingStockQty: qtyFresh != null ? qtyFresh : prev.listingStockQty,
              listingSoldQty: soldFresh != null ? soldFresh : prev.listingSoldQty,
              quantity:
                String(prev.quantityLabel || "")
                  .trim()
                  .toLowerCase() === "stock listed" && qtyFresh != null
                  ? qtyFresh
                  : prev.quantity,
            };
          });
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn("[openProductInspect] listing detail refresh failed:", err?.message || err);
          }
        }
      })();
    }
  }, [activeView, closeProductInspect, user?.id, usersById, favoriteIds, toggleFavorite, shopCommunityId, token]);

  useEffect(() => {
    if (!productInspect) return;
    if (activeView === VIEWS.PRODUCT_DETAIL) return;
    setActiveView(VIEWS.PRODUCT_DETAIL);
  }, [productInspect, activeView]);

  useEffect(() => {
    if (activeView !== VIEWS.PRODUCT_DETAIL || productInspect) return;
    const returnCtx = productInspectReturnRef.current || {};
    const restoreView = String(returnCtx.view || VIEWS.BROWSE);
    const restoreCommunityId = returnCtx.shopCommunityId ? String(returnCtx.shopCommunityId) : null;
    const restoreScrollTop = Math.max(0, Number(returnCtx.scrollTop) || 0);
    setShopCommunityId(restoreCommunityId);
    setActiveView(restoreView);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const main = document.getElementById("main-content");
        if (main) main.scrollTop = restoreScrollTop;
      });
    }
  }, [activeView, productInspect]);

  const submitQuickAddOrder = async () => {
    if (!quickAddListing?.id || quickAddSubmitting) return;
    const showQuickAddError = (message) => {
      const nextMessage = String(message || "").trim();
      if (!nextMessage) return;
      setQuickAddInlineError(nextMessage);
    };
    setQuickAddInlineError("");
    const parsedQty = Number(quickAddQuantity);
    const maxQty = Math.max(1, Number(quickAddListing.quantity) || 1);
    if (!Number.isFinite(parsedQty) || parsedQty < 1 || parsedQty > maxQty) {
      showQuickAddError(`Quantity must be between 1 and ${maxQty}.`);
      return;
    }
    const valsA = normalizeListingOptionValues(quickAddListing.optionValuesA);
    const valsB = normalizeListingOptionValues(quickAddListing.optionValuesB);
    const optLabelA = String(quickAddListing.optionNameA || "").trim();
    const optLabelB = String(quickAddListing.optionNameB || "").trim();
    const needsSelectA = Boolean(optLabelA && valsA.length > 0);
    const needsSelectB = Boolean(optLabelB && valsB.length > 0);
    const selA = String(quickAddSelectedVariantA || "").trim();
    const selB = String(quickAddSelectedVariantB || "").trim();
    if (needsSelectA && !selA) {
      showQuickAddError(`Choose ${optLabelA}.`);
      return;
    }
    if (needsSelectB && !selB) {
      showQuickAddError(`Choose ${optLabelB}.`);
      return;
    }
    if (needsSelectA && !valsA.includes(selA)) {
      showQuickAddError(`${optLabelA} is not valid for this listing.`);
      return;
    }
    if (needsSelectB && !valsB.includes(selB)) {
      showQuickAddError(`${optLabelB} is not valid for this listing.`);
      return;
    }
    const maxCommentLen = quickActionType === "buy" ? 2000 : 250;
    const mergedComment = buildQuickAddMergedComment(
      quickAddListing,
      quickAddComment,
      selA,
      selB,
      maxCommentLen,
    );
    const variantSig = buildVariantSignatureFromSelections(quickAddListing, selA, selB);
    setQuickAddSubmitting(true);
    try {
      if (quickActionType === "buy") {
        if (!token) {
          showQuickAddError("Sign in to buy.");
          return;
        }
        if (!buyNowFromProfile.ready) {
          showQuickAddError("Complete your profile to buy.");
          return;
        }
        try {
          const created = await apiRequest("/orders", {
            method: "POST",
            token,
            body: {
              listingId: String(quickAddListing.id),
              quantity: parsedQty,
              fulfillmentType: quickOrderFulfillmentType,
              comment: mergedComment,
              variantSignature: variantSig,
            },
          });
          markBuyerOrderAsUnseenInTab("pending", created?.order?.id);
        } catch (e) {
          showQuickAddError(e.message || "Could not place order.");
          return;
        }
        setQuickAddModalOpen(false);
        setQuickAddListing(null);
        setQuickActionType("cart");
        setQuickOrderFulfillmentType("pickup");
        setQuickAddQuantity("1");
        setQuickAddSelectedVariantA("");
        setQuickAddSelectedVariantB("");
        setQuickAddComment("");
        setQuickAddInlineError("");
        // Keep user in current marketplace/community view after successful buy.
        setOrdersRole("buyer");
        setOrdersStatusTab("pending");
        writeQuickOrderFulfillmentPref(quickOrderFulfillmentType);
        {
          const titleForToast = String(quickAddListing.title || "Item").trim();
          const shortTitle = titleForToast.length > 52 ? `${titleForToast.slice(0, 52)}…` : titleForToast;
          pushMarketplaceToast(
            `Order placed: ${shortTitle} ×${parsedQty}. Pay COD at pickup or when delivery is completed.`,
          );
        }
        return;
      }
      const addedListingId = String(quickAddListing.id);
      if (token) {
        try {
          const cartData = await apiRequest("/me/cart/items", {
            method: "POST",
            token,
            body: {
              listingId: addedListingId,
              quantity: parsedQty,
              comment: mergedComment,
              variantSignature: variantSig,
              fulfillmentType: quickOrderFulfillmentType,
            },
          });
          const incoming = Array.isArray(cartData?.items) ? cartData.items : [];
          setCartItems((prev) => {
            const merged = mergeCartItemsPreservingOrder(prev, incoming);
            return moveSellerGroupToTop(merged, quickAddListing?.sellerId);
          });
          setCartSeenListingIds((prev) => prev.filter((x) => String(x) !== addedListingId));
          {
            const titleForToast = String(quickAddListing.title || "Item").trim();
            const shortTitle = titleForToast.length > 52 ? `${titleForToast.slice(0, 52)}…` : titleForToast;
            pushMarketplaceToast(`Added to cart: ${shortTitle} ×${parsedQty}.`);
          }
        } catch (e) {
          showQuickAddError(e.message || "Could not save to cart.");
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
          const idx = prev.findIndex(
            (item) =>
              String(item.listingId) === listingId && String(item.variantSignature ?? "") === variantSig,
          );
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
                variantSignature: variantSig,
                sellerId,
                sellerLabel,
                title: String(quickAddListing.title || "Product"),
                description: String(quickAddListing.description || "").trim(),
                imageUrl: String(quickAddListing.imageUrl || "").trim(),
                unitPriceCents: Number(quickAddListing.priceCents) || 0,
                quantity: parsedQty,
                listingQuantity: maxQty,
                fulfillmentModes: Array.isArray(quickAddListing.fulfillmentModes) ? quickAddListing.fulfillmentModes : ["pickup"],
                fulfillmentType: quickOrderFulfillmentType,
                comment: mergedComment,
                optionNameA: optLabelA,
                optionNameB: optLabelB,
                optionValuesA: needsSelectA ? [selA] : [],
                optionValuesB: needsSelectB ? [selB] : [],
              },
            ];
          }
          const next = [...prev];
          const existing = next[idx];
          const desc = String(quickAddListing.description || "").trim() || String(existing.description || "").trim();
          const mergedQty = Math.min(maxQty, Number(existing.quantity || 0) + parsedQty);
          next[idx] = {
            ...existing,
            variantSignature: variantSig,
            quantity: mergedQty,
            listingQuantity: maxQty,
            fulfillmentModes: Array.isArray(quickAddListing.fulfillmentModes) ? quickAddListing.fulfillmentModes : ["pickup"],
            fulfillmentType: quickOrderFulfillmentType,
            comment: mergedComment || existing.comment || "",
            optionNameA: optLabelA || existing.optionNameA,
            optionNameB: optLabelB || existing.optionNameB,
            optionValuesA: needsSelectA ? [selA] : normalizeListingOptionValues(existing.optionValuesA),
            optionValuesB: needsSelectB ? [selB] : normalizeListingOptionValues(existing.optionValuesB),
            ...(desc ? { description: desc } : {}),
          };
          return next;
        });
        setCartSeenListingIds((prev) => prev.filter((x) => String(x) !== addedListingId));
        {
          const titleForToast = String(quickAddListing.title || "Item").trim();
          const shortTitle = titleForToast.length > 52 ? `${titleForToast.slice(0, 52)}…` : titleForToast;
          pushMarketplaceToast(`Added to cart: ${shortTitle} ×${parsedQty}.`);
        }
      }
      const originView = String(productFlowOriginRef.current?.view || "");
      if ([VIEWS.BROWSE, VIEWS.COMMUNITY_SHOP, VIEWS.FAVORITES].includes(originView)) {
        setActiveView(originView);
      } else {
        setActiveView(shopCommunityId ? VIEWS.COMMUNITY_SHOP : VIEWS.BROWSE);
      }
      setQuickAddModalOpen(false);
      setQuickAddListing(null);
      setQuickAddQuantity("1");
      setQuickAddSelectedVariantA("");
      setQuickAddSelectedVariantB("");
      setQuickAddComment("");
      setQuickAddInlineError("");
      const originListingId = String(productFlowOriginRef.current?.listingId || "");
      if (originListingId && typeof document !== "undefined") {
        window.requestAnimationFrame(() => {
          const anchor = document.getElementById(`listing-card-${originListingId}`);
          if (anchor) anchor.scrollIntoView({ block: "center", behavior: "smooth" });
        });
      }
    } finally {
      setQuickAddSubmitting(false);
    }
  };

  const beginEditSellerListing = (listing) => {
    if (!listing?.id) return;
    const sourceView =
      activeView === VIEWS.PRODUCT_DETAIL
        ? String(productInspectReturnRef.current?.view || VIEWS.BROWSE)
        : activeView;
    const sourceCommunityId =
      activeView === VIEWS.PRODUCT_DETAIL
        ? (productInspectReturnRef.current?.shopCommunityId ? String(productInspectReturnRef.current.shopCommunityId) : null)
        : (shopCommunityId || null);
    const launchedFromProductFlow = [VIEWS.BROWSE, VIEWS.COMMUNITY_SHOP, VIEWS.FAVORITES].includes(sourceView);
    productFlowOriginRef.current = {
      listingId: String(listing.id || ""),
      view: sourceView,
      shopCommunityId: sourceCommunityId,
    };
    const normalizedImageUrls = dedupeListingImageUrlsOrdered(
      Array.isArray(listing.imageUrls) ? listing.imageUrls.map((url) => String(url || "").trim()).filter(Boolean) : [],
    ).slice(0, LISTING_MAX_IMAGES);
    setEditingListingId(String(listing.id));
    setListingForm({
      title: String(listing.title || ""),
      description: String(listing.description || ""),
      pricePesos: Number.isFinite(Number(listing.priceCents)) ? String(Number(listing.priceCents) / 100) : "",
      quantity: Number.isFinite(Number(listing.quantity)) ? String(Number(listing.quantity)) : "",
      categories: String(listing.categories || listing.verticalId || ""),
      subId: String(listing.subId || "all"),
      optionNameA: String(listing.optionNameA || "").trim(),
      optionValuesA: Array.isArray(listing.optionValuesA) ? listing.optionValuesA.map((v) => String(v || "").trim()).filter(Boolean).join(", ") : "",
      optionNameB: String(listing.optionNameB || "").trim(),
      optionValuesB: Array.isArray(listing.optionValuesB) ? listing.optionValuesB.map((v) => String(v || "").trim()).filter(Boolean).join(", ") : "",
      orderType: String(listing.orderType || "in_stock").trim() === "pre_order" ? "pre_order" : "in_stock",
      processingTime: String(listing.processingTime || "").trim(),
      pickup: Array.isArray(listing.fulfillmentModes) ? listing.fulfillmentModes.includes("pickup") : true,
      delivery: Array.isArray(listing.fulfillmentModes) ? listing.fulfillmentModes.includes("delivery") : true,
    });
    setListingFieldErrors({});
    setListingImageFile(null);
    setListingCoverContentHash("");
    if (listingImagePreviewUrl && listingImagePreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(listingImagePreviewUrl);
    }
    setListingImagePreviewUrl(String(normalizedImageUrls[0] || listing.imageUrl || "").trim());
    clearListingExtraImages();
    setListingCropQueue([]);
    closeListingCropEditor();
    closeListingPhotoActionModal();
    if (normalizedImageUrls.length > 1) {
      setListingExtraImages(
        normalizedImageUrls.slice(1, LISTING_MAX_IMAGES).map((url, idx) => ({
          id: `existing-${String(listing.id)}-${idx}`,
          file: null,
          previewUrl: url,
          name: `Image ${idx + 2}`,
        })),
      );
    }
    setListingOptionValueDraftA("");
    setListingOptionValueDraftB("");
    setListingSecondOptionOpen(
      Boolean(String(listing.optionNameB || "").trim()) ||
      (Array.isArray(listing.optionValuesB) && listing.optionValuesB.length > 0),
    );
    setListingAdvancedOpen(
      String(listing.orderType || "in_stock").trim() === "pre_order" ||
        Boolean(String(listing.processingTime || "").trim()),
    );
    clearMarketplaceToasts();
    if (launchedFromProductFlow) {
      if (activeView === VIEWS.PRODUCT_DETAIL && productInspect) {
        closeProductInspect();
      }
      setListingEditOverlayOpen(true);
    } else {
      setListingEditOverlayOpen(false);
      openUploadAtTop();
      navigate("/", { replace: true });
    }
  };

  const handleCreateListing = async (ev) => {
    ev.preventDefault();
    if (!token) return;
    setListingPublishError("");
    const nextErrors = {};
    const draftOptA = String(listingOptionValueDraftA || "").trim();
    const draftOptB = String(listingOptionValueDraftB || "").trim();
    const optValsABase = splitOptionValuesCsv(listingForm.optionValuesA);
    const optValsBBase = listingSecondOptionOpen ? splitOptionValuesCsv(listingForm.optionValuesB) : [];
    const optValsA = draftOptA ? [...optValsABase, draftOptA] : optValsABase;
    const optValsB = listingSecondOptionOpen ? (draftOptB ? [...optValsBBase, draftOptB] : optValsBBase) : [];
    const nameATrim = String(listingForm.optionNameA || "").trim();
    const nameBTrim = listingSecondOptionOpen ? String(listingForm.optionNameB || "").trim() : "";
    const dupA = findDuplicateChoiceCaseInsensitive(optValsA);
    const dupB = findDuplicateChoiceCaseInsensitive(optValsB);
    if (dupA) {
      nextErrors.optionValuesA = `Duplicate choice: "${dupA}". Remove duplicates.`;
    }
    if (dupB) {
      nextErrors.optionValuesB = `Duplicate choice: "${dupB}". Remove duplicates.`;
    }
    if (optValsA.length > 0 && !nameATrim) {
      nextErrors.optionNameA = "Add a variant type (for example: Size) or remove variant choices.";
    }
    if (listingSecondOptionOpen && optValsB.length > 0 && !nameBTrim) {
      nextErrors.optionNameB = "Add a second variant type or remove those choices.";
    }
    if (nameATrim && optValsA.length === 0) {
      nextErrors.optionValuesA = "Add at least one choice, or clear the variant type.";
    }
    if (listingSecondOptionOpen && nameBTrim && optValsB.length === 0) {
      nextErrors.optionValuesB = "Add at least one choice, or clear the second variant type.";
    }
    if (nameATrim && nameBTrim && nameATrim.toLowerCase() === nameBTrim.toLowerCase()) {
      nextErrors.optionNameB = "Choose a different variant type than the first group.";
    }
    if (!String(listingForm.title || "").trim()) {
      nextErrors.title = "Add a short title so buyers recognize your listing.";
    }
    if (!String(listingForm.categories || "").trim()) {
      nextErrors.categories = "Choose a category so shoppers can find your item.";
    }
    if (String(listingForm.quantity ?? "").trim() === "") {
      nextErrors.quantity = "Enter how many you have in stock (use 0 if none).";
    }
    if (String(listingForm.pricePesos ?? "").trim() === "") {
      nextErrors.pricePesos = "Enter the price in pesos using numbers and a decimal if needed.";
    }
    if (String(listingForm.orderType || "in_stock") === "pre_order" && !String(listingForm.processingTime || "").trim()) {
      nextErrors.processingTime = "Add how long pre-orders take (for example: 7 days or 2 weeks).";
    }
    if (!listingForm.pickup && !listingForm.delivery) {
      nextErrors.fulfillment = "Turn on Pick-up and/or COD Delivery so buyers know how to receive the item.";
    }

    const hasImage = Boolean(String(listingImagePreviewUrl || "").trim() || listingImageFile);
    if (!hasImage) {
      nextErrors.image = "Add at least one clear photo of what you are selling.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setListingFieldErrors(nextErrors);
      clearMarketplaceToasts();
      return;
    }
    setListingFieldErrors({});
    const catMissing = !String(listingForm.categories || "").trim();
    const qtyStr = String(listingForm.quantity ?? "").trim();
    const qtyMissing = qtyStr === "";
    if (catMissing && qtyMissing) {
      pushMarketplaceToast("Select a category and enter a quantity before publishing.");
      return;
    }
    if (catMissing) {
      pushMarketplaceToast("Select a category before publishing.");
      return;
    }
    if (qtyMissing) {
      pushMarketplaceToast("Enter a quantity before publishing.");
      return;
    }
    const qtyNum = Number(qtyStr);
    if (!Number.isFinite(qtyNum) || qtyNum < 0 || !Number.isInteger(qtyNum)) {
      pushMarketplaceToast("Enter a valid whole number for quantity (0 or more).");
      return;
    }

    const pesos = Number(listingForm.pricePesos);
    if (!Number.isFinite(pesos) || pesos < 0) {
      pushMarketplaceToast("Enter a valid price in pesos.");
      return;
    }
    const modes = [];
    if (listingForm.pickup) modes.push("pickup");
    if (listingForm.delivery) modes.push("delivery");
    if (modes.length === 0) {
      setListingFieldErrors((prev) => ({
        ...prev,
        fulfillment: "Turn on Pick-up and/or COD Delivery so buyers know how to receive the item.",
      }));
      clearMarketplaceToasts();
      return;
    }
    setListingSaving(true);
    clearMarketplaceToasts();
    try {
      const imageUrls = await resolveListingImagesForSave(
        token,
        {
          coverFile: listingImageFile,
          coverPreviewUrl: listingImagePreviewUrl,
          extraItems: listingExtraImages,
        },
        (urls) => dedupeListingImageUrlsOrdered(urls).slice(0, LISTING_MAX_IMAGES),
      );
      const primaryImageUrl = imageUrls[0] || "";
      const optionNameA = String(listingForm.optionNameA || "").trim();
      const optionNameB = listingSecondOptionOpen ? String(listingForm.optionNameB || "").trim() : "";
      const optionValuesA = optValsA.slice(0, 30);
      const optionValuesB = listingSecondOptionOpen ? optValsB.slice(0, 30) : [];
      const variantsPayload = [];
      if (optionNameA && optionValuesA.length) variantsPayload.push({ type: optionNameA, choices: optionValuesA });
      if (listingSecondOptionOpen && optionNameB && optionValuesB.length) {
        variantsPayload.push({ type: optionNameB, choices: optionValuesB });
      }
      const orderType = String(listingForm.orderType || "in_stock").trim() === "pre_order" ? "pre_order" : "in_stock";
      const processingTime = String(listingForm.processingTime || "")
        .trim()
        .slice(0, 120);
      const subIdNormalized =
        listingForm.subId && String(listingForm.subId).trim() !== "" && listingForm.subId !== "all"
          ? String(listingForm.subId).trim()
          : null;
      const payload = {
        title: listingForm.title.trim(),
        description: listingForm.description.trim(),
        priceCents: Math.round(pesos * 100),
        quantity: qtyNum,
        categories: String(listingForm.categories).trim(),
        verticalId: String(listingForm.categories).trim(),
        subId: subIdNormalized,
        fulfillmentModes: modes,
        cityLabel: "",
        imageUrl: primaryImageUrl,
        imageUrls,
        optionNameA,
        optionValuesA,
        optionNameB,
        optionValuesB,
        variants: variantsPayload,
        orderType,
        processingTime,
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
      const listRes = await apiRequest("/me/listings", { token });
      const latestListings = listRes.listings || [];
      setSellerListings(latestListings.length ? latestListings : createRes?.listing ? [createRes.listing] : []);
      setListingForm({
        title: "",
        description: "",
        pricePesos: "",
        quantity: "",
        categories: "",
        subId: "all",
        optionNameA: "",
        optionValuesA: "",
        optionNameB: "",
        optionValuesB: "",
        orderType: "in_stock",
        processingTime: "",
        pickup: false,
        delivery: false,
      });
      setListingFieldErrors({});
      setListingImageFile(null);
      setListingCoverContentHash("");
      if (listingImagePreviewUrl && listingImagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(listingImagePreviewUrl);
      setListingImagePreviewUrl("");
      clearListingExtraImages();
      setListingCropQueue([]);
      closeListingCropEditor();
      closeListingPhotoActionModal();
      setListingAdvancedOpen(false);
      setListingOptionValueDraftA("");
      setListingOptionValueDraftB("");
      setListingSecondOptionOpen(false);
      setEditingListingId(null);
      setListingEditOverlayOpen(false);
      clearMarketplaceToasts();
      setPublishFlash("");
      setSellerTab(SELLER_TABS.PRODUCTS);
      const origin = productFlowOriginRef.current || {};
      const originView = String(origin.view || "");
      const shouldReturnToProductFlow =
        Boolean(editingListingId) && [VIEWS.BROWSE, VIEWS.COMMUNITY_SHOP, VIEWS.FAVORITES].includes(originView);
      if (shouldReturnToProductFlow) {
        const originCommunityId = origin.shopCommunityId ? String(origin.shopCommunityId) : null;
        setShopCommunityId(originCommunityId);
        setActiveView(originView);
        navigate("/", { replace: true });
        const originListingId = String(origin.listingId || "");
        if (originListingId && typeof document !== "undefined") {
          window.requestAnimationFrame(() => {
            const anchor = document.getElementById(`listing-card-${originListingId}`);
            if (anchor) anchor.scrollIntoView({ block: "center", behavior: "smooth" });
          });
        }
        if (token) {
          if (originView === VIEWS.COMMUNITY_SHOP) {
            void loadCommunityShopListings({ preserveExistingRows: false, force: true });
          }
          if (originView === VIEWS.FAVORITES) {
            void refreshFavorites();
          }
        }
      } else {
        goOwnProfile();
        navigate("/", { replace: true });
      }
    } catch (e) {
      const msg = String(e?.message || "Could not publish listing.");
      setListingPublishError(
        msg.length > 160 ? `${msg.slice(0, 157)}…` : msg,
      );
      const nextErrors = {};
      if (/processing time/i.test(msg)) nextErrors.processingTime = msg;
      if (/category|categories/i.test(msg)) nextErrors.categories = msg;
      if (/first variant choice/i.test(msg)) nextErrors.optionValuesA = msg;
      if (/second variant choice/i.test(msg)) nextErrors.optionValuesB = msg;
      if (/two variant types must be different/i.test(msg)) nextErrors.optionNameB = msg;
      if (/variant type is required when first/i.test(msg)) nextErrors.optionNameA = msg;
      if (/second variant type is required when second/i.test(msg)) nextErrors.optionNameB = msg;
      if (/Add at least one choice for the first variant/i.test(msg)) nextErrors.optionValuesA = msg;
      if (/Add at least one choice for the second variant/i.test(msg)) nextErrors.optionValuesB = msg;
      if (Object.keys(nextErrors).length > 0) {
        setListingFieldErrors((prev) => ({ ...prev, ...nextErrors }));
      }
      pushMarketplaceToast(msg);
    } finally {
      setListingSaving(false);
    }
  };

  const setListingImage = async (file) => {
    if (!file) return;
    await addListingImages([file]);
  };

  const clearListingExtraImages = useCallback(() => {
    setListingExtraImages((prev) => {
      for (const item of prev) {
        if (String(item?.previewUrl || "").startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
      }
      return [];
    });
  }, []);

  const closeListingCropEditor = useCallback(() => {
    setListingCropApplyError("");
    setListingCropEditor((prev) => {
      if (prev.sourcePreviewOwned && String(prev.sourcePreviewUrl || "").startsWith("blob:")) {
        URL.revokeObjectURL(prev.sourcePreviewUrl);
      }
      return {
        open: false,
        mode: "new",
        targetId: "",
        sourceFile: null,
        sourcePreviewUrl: "",
        sourcePreviewOwned: false,
        sourceWidth: 1,
        sourceHeight: 1,
        cropLeft: 0.1,
        cropTop: 0.1,
        cropSize: 1,
        dragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragStartLeft: 0.1,
        dragStartTop: 0.1,
      };
    });
  }, []);

  const openListingCropEditor = useCallback(async (mode, sourceFile, sourcePreviewUrl, { targetId = "", sourcePreviewOwned = false } = {}) => {
    if (!sourceFile || !sourcePreviewUrl) return;
    let sourceWidth = 1;
    let sourceHeight = 1;
    try {
      const img = await loadImageElementFromFile(sourceFile);
      sourceWidth = Math.max(1, Number(img.naturalWidth || 1));
      sourceHeight = Math.max(1, Number(img.naturalHeight || 1));
    } catch {
      // keep safe defaults
    }
    const minSide = Math.min(sourceWidth, sourceHeight);
    const sidePx = Math.max(1, Math.floor(minSide * 1));
    setListingCropApplyError("");
    setListingCropEditor({
      open: true,
      mode,
      targetId,
      sourceFile,
      sourcePreviewUrl,
      sourcePreviewOwned,
      sourceWidth,
      sourceHeight,
      cropLeft: (sourceWidth - sidePx) / (2 * sourceWidth),
      cropTop: (sourceHeight - sidePx) / (2 * sourceHeight),
      cropSize: 1,
      dragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragStartLeft: 0.1,
      dragStartTop: 0.1,
    });
  }, []);

  const openListingCropEditorForCover = useCallback(async () => {
    if (listingImageFile && listingImagePreviewUrl) {
      void openListingCropEditor("cover", listingImageFile, listingImagePreviewUrl, { sourcePreviewOwned: false });
      return;
    }
    const remoteUrl = String(listingImagePreviewUrl || "").trim();
    if (!remoteUrl || remoteUrl.startsWith("blob:")) return;
    try {
      const res = await fetch(remoteUrl);
      const blob = await res.blob();
      const file = new File([blob], `cover-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });
      const localPreview = URL.createObjectURL(file);
      void openListingCropEditor("cover", file, localPreview, { sourcePreviewOwned: true });
    } catch {
      pushMarketplaceToast("Could not open crop editor for this image.");
    }
  }, [listingImageFile, listingImagePreviewUrl, openListingCropEditor, pushMarketplaceToast]);

  const closeListingPhotoActionModal = useCallback(() => {
    setListingPhotoActionModal({ open: false, variant: "cover", extraId: "" });
  }, []);

  const promoteListingExtraToCover = useCallback(
    (extraId) => {
      const id = String(extraId || "");
      const item = listingExtraImages.find((x) => String(x.id || "") === id);
      if (!item) return;
      const trimmedCoverPreview = String(listingImagePreviewUrl || "").trim();
      const prevCover =
        listingImageFile || trimmedCoverPreview
          ? {
              id: `cover-${Date.now()}`,
              file: listingImageFile || null,
              previewUrl: listingImagePreviewUrl,
              name: listingImageFile?.name || "Cover",
              ...(listingCoverContentHash ? { contentHash: listingCoverContentHash } : {}),
            }
          : null;
      setListingImageFile(item.file || null);
      setListingImagePreviewUrl(item.previewUrl);
      setListingCoverContentHash(String(item.contentHash || ""));
      setListingExtraImages((prev) => {
        const next = prev.filter((x) => x.id !== item.id);
        if (prevCover) next.unshift(prevCover);
        return next;
      });
      closeListingPhotoActionModal();
    },
    [closeListingPhotoActionModal, listingCoverContentHash, listingExtraImages, listingImageFile, listingImagePreviewUrl],
  );

  const openListingCropEditorForExtra = useCallback(async (extraId) => {
    const id = String(extraId || "");
    const item = listingExtraImages.find((x) => String(x.id || "") === id);
    if (!item) return;
    if (item.file && item.previewUrl) {
      void openListingCropEditor("extra", item.file, item.previewUrl, { targetId: id, sourcePreviewOwned: false });
      return;
    }
    const remoteUrl = String(item.previewUrl || "").trim();
    if (!remoteUrl || remoteUrl.startsWith("blob:")) return;
    try {
      const res = await fetch(remoteUrl);
      const blob = await res.blob();
      const file = new File([blob], `extra-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });
      const localPreview = URL.createObjectURL(file);
      void openListingCropEditor("extra", file, localPreview, { targetId: id, sourcePreviewOwned: true });
    } catch {
      pushMarketplaceToast("Could not open crop editor for this image.");
    }
  }, [listingExtraImages, openListingCropEditor, pushMarketplaceToast]);

  const applyListingCropEditor = useCallback(async () => {
    if (!listingCropEditor.open || !listingCropEditor.sourceFile) return;
    try {
      const cropped = await cropImageFileToSquareByRect(
        listingCropEditor.sourceFile,
        listingCropEditor.cropLeft,
        listingCropEditor.cropTop,
        listingCropEditor.cropSize,
      );
      const contentHash = await sha256HexFromBlob(cropped);
      const hashExtraRow = async (x, excludeId) => {
        if (excludeId && String(x?.id || "") === String(excludeId)) return null;
        if (x?.contentHash) return x.contentHash;
        if (x?.file) return sha256HexFromBlob(x.file);
        return null;
      };
      const occupied = new Set();
      if (listingCropEditor.mode === "new") {
        if (String(listingCoverContentHash || "").trim()) occupied.add(listingCoverContentHash);
        else if (listingImageFile) {
          const ch = await sha256HexFromBlob(listingImageFile);
          if (ch) occupied.add(ch);
        }
        for (const x of listingExtraImages) {
          const h = await hashExtraRow(x, "");
          if (h) occupied.add(h);
        }
      } else if (listingCropEditor.mode === "cover") {
        for (const x of listingExtraImages) {
          const h = await hashExtraRow(x, "");
          if (h) occupied.add(h);
        }
      } else if (listingCropEditor.mode === "extra") {
        const targetId = String(listingCropEditor.targetId || "");
        if (String(listingCoverContentHash || "").trim()) occupied.add(listingCoverContentHash);
        else if (listingImageFile) {
          const ch = await sha256HexFromBlob(listingImageFile);
          if (ch) occupied.add(ch);
        }
        for (const x of listingExtraImages) {
          const h = await hashExtraRow(x, targetId);
          if (h) occupied.add(h);
        }
      }
      if (contentHash && occupied.has(contentHash)) {
        setListingCropApplyError("This image is already in your listing.");
        return;
      }
      setListingCropApplyError("");
      const previewUrl = URL.createObjectURL(cropped);
      if (listingCropEditor.mode === "new") {
        if (!listingImageFile && !listingImagePreviewUrl) {
          setListingImageFile(cropped);
          setListingImagePreviewUrl(previewUrl);
          setListingCoverContentHash(contentHash);
        } else {
          setListingExtraImages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              file: cropped,
              previewUrl,
              name: cropped.name || "Image",
              contentHash,
            },
          ]);
        }
      } else if (listingCropEditor.mode === "cover") {
        if (listingImagePreviewUrl && listingImagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(listingImagePreviewUrl);
        setListingImageFile(cropped);
        setListingImagePreviewUrl(previewUrl);
        setListingCoverContentHash(contentHash);
      } else if (listingCropEditor.mode === "extra") {
        const targetId = String(listingCropEditor.targetId || "");
        setListingExtraImages((prev) =>
          prev.map((item) => {
            if (String(item.id || "") !== targetId) return item;
            if (String(item.previewUrl || "").startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
            return { ...item, file: cropped, previewUrl, name: cropped.name || item.name, contentHash };
          }),
        );
      }
      closeListingCropEditor();
    } catch {
      pushMarketplaceToast("Could not apply crop. Please try again.");
    }
  }, [
    closeListingCropEditor,
    listingCoverContentHash,
    listingCropEditor,
    listingExtraImages,
    listingImageFile,
    listingImagePreviewUrl,
    pushMarketplaceToast,
  ]);

  const addListingImages = useCallback(
    (filesLike) => {
      const incoming = Array.from(filesLike || []);
      if (!incoming.length) return;
      const remaining = Math.max(0, LISTING_MAX_IMAGES - ((listingImageFile ? 1 : 0) + listingExtraImages.length));
      if (!remaining) {
        pushMarketplaceToast(`You can upload up to ${LISTING_MAX_IMAGES} images.`);
        return;
      }
      void (async () => {
        const processed = [];
        for (const f of incoming.slice(0, remaining)) {
          if (!String(f?.type || "").startsWith("image/")) continue;
          try {
            processed.push(
              await ensureImageFileUnderMaxBytes(f, MAX_LISTING_COMMUNITY_IMAGE_BYTES, { maxLongEdge: 2560 }),
            );
          } catch {
            pushMarketplaceToast("Could not process an image. Try a different file.");
            return;
          }
        }
        const candidates = processed;
        if (!candidates.length) {
          pushMarketplaceToast("Please choose valid image files (JPEG, PNG, WebP, or GIF).");
          return;
        }
        const usedHashes = new Set();
        if (String(listingCoverContentHash || "").trim()) usedHashes.add(listingCoverContentHash);
        else if (listingImageFile) {
          const coverH = await sha256HexFromBlob(listingImageFile);
          if (coverH) usedHashes.add(coverH);
        }
        for (const item of listingExtraImages) {
          if (item?.contentHash) usedHashes.add(item.contentHash);
          else if (item?.file) {
            const eh = await sha256HexFromBlob(item.file);
            if (eh) usedHashes.add(eh);
          }
        }
        for (const q of listingCropQueue) {
          if (!q) continue;
          const qh = await sha256HexFromBlob(q);
          if (qh) usedHashes.add(qh);
        }
        const accepted = [];
        let skippedDup = 0;
        const batchSeen = new Set();
        for (const f of candidates) {
          const h = await sha256HexFromBlob(f);
          if (!h || usedHashes.has(h) || batchSeen.has(h)) {
            skippedDup++;
            continue;
          }
          usedHashes.add(h);
          batchSeen.add(h);
          accepted.push(f);
        }
        if (!accepted.length) {
          if (skippedDup > 0) pushMarketplaceToast("Each photo must be unique. Duplicate images were skipped.");
          return;
        }
        if (skippedDup === 0) clearMarketplaceToasts();
        else pushMarketplaceToast("Each photo must be unique. Duplicate images were skipped.");
        setListingCropQueue((prev) => [...prev, ...accepted]);
      })();
    },
    [
      clearMarketplaceToasts,
      listingCoverContentHash,
      listingCropQueue,
      listingExtraImages,
      listingImageFile,
      pushMarketplaceToast,
    ],
  );

  useEffect(() => {
    if (listingCropEditor.open) return;
    if (!listingCropQueue.length) return;
    const [nextFile, ...rest] = listingCropQueue;
    const localPreview = URL.createObjectURL(nextFile);
    setListingCropQueue(rest);
    void openListingCropEditor("new", nextFile, localPreview, { sourcePreviewOwned: true });
  }, [listingCropEditor.open, listingCropQueue, openListingCropEditor]);

  const addListingOptionValue = useCallback((key, rawValue) => {
    const value = String(rawValue || "").trim();
    if (!value) return;
    if (key === "A") {
      const current = splitOptionValuesCsv(listingForm.optionValuesA);
      if (current.some((c) => c.toLowerCase() === value.toLowerCase())) {
        setListingFieldErrors((prev) => ({
          ...prev,
          optionValuesA: `You already added "${value}".`,
        }));
        return;
      }
      setListingFieldErrors((prev) => ({ ...prev, optionValuesA: "" }));
      const next = [...current, value];
      setListingForm((p) => ({ ...p, optionValuesA: next.join(", ") }));
      setListingOptionValueDraftA("");
    } else {
      const current = splitOptionValuesCsv(listingForm.optionValuesB);
      if (current.some((c) => c.toLowerCase() === value.toLowerCase())) {
        setListingFieldErrors((prev) => ({
          ...prev,
          optionValuesB: `You already added "${value}".`,
        }));
        return;
      }
      setListingFieldErrors((prev) => ({ ...prev, optionValuesB: "" }));
      const next = [...current, value];
      setListingForm((p) => ({ ...p, optionValuesB: next.join(", ") }));
      setListingOptionValueDraftB("");
    }
  }, [listingForm.optionValuesA, listingForm.optionValuesB]);

  const removeListingOptionValue = useCallback((key, valueToRemove) => {
    setListingFieldErrors((prev) => ({
      ...prev,
      ...(key === "A" ? { optionValuesA: "" } : { optionValuesB: "" }),
    }));
    if (key === "A") {
      const next = splitOptionValuesCsv(listingForm.optionValuesA).filter((v) => v !== valueToRemove);
      setListingForm((p) => ({ ...p, optionValuesA: next.join(", ") }));
    } else {
      const next = splitOptionValuesCsv(listingForm.optionValuesB).filter((v) => v !== valueToRemove);
      setListingForm((p) => ({ ...p, optionValuesB: next.join(", ") }));
    }
  }, [listingForm.optionValuesA, listingForm.optionValuesB]);

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
    setProfileAvatarCropApplyError("");
    setProfileAvatarCropEditor((prev) => {
      if (prev.sourcePreviewOwned && String(prev.sourcePreviewUrl || "").startsWith("blob:")) {
        URL.revokeObjectURL(prev.sourcePreviewUrl);
      }
      return {
        open: false,
        sourceFile: null,
        sourcePreviewUrl: "",
        sourcePreviewOwned: false,
        sourceWidth: 1,
        sourceHeight: 1,
        cropLeft: 0.1,
        cropTop: 0.1,
        cropSize: 1,
        dragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragStartLeft: 0.1,
        dragStartTop: 0.1,
      };
    });
  };

  const closeProfileAvatarCropEditor = useCallback(() => {
    setProfileAvatarCropApplyError("");
    setProfileAvatarCropUploading(false);
    setProfileAvatarCropEditor((prev) => {
      if (prev.sourcePreviewOwned && String(prev.sourcePreviewUrl || "").startsWith("blob:")) {
        URL.revokeObjectURL(prev.sourcePreviewUrl);
      }
      return {
        open: false,
        sourceFile: null,
        sourcePreviewUrl: "",
        sourcePreviewOwned: false,
        sourceWidth: 1,
        sourceHeight: 1,
        cropLeft: 0.1,
        cropTop: 0.1,
        cropSize: 1,
        dragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragStartLeft: 0.1,
        dragStartTop: 0.1,
      };
    });
  }, []);

  const openProfileAvatarCropEditor = useCallback(async (sourceFile, sourcePreviewUrl, { sourcePreviewOwned = false } = {}) => {
    if (!sourceFile || !sourcePreviewUrl) return;
    let sourceWidth = 1;
    let sourceHeight = 1;
    try {
      const img = await loadImageElementFromFile(sourceFile);
      sourceWidth = Math.max(1, Number(img.naturalWidth || 1));
      sourceHeight = Math.max(1, Number(img.naturalHeight || 1));
    } catch {
      // keep safe defaults
    }
    const minSide = Math.min(sourceWidth, sourceHeight);
    const sidePx = Math.max(1, Math.floor(minSide * 1));
    setProfileAvatarCropApplyError("");
    setProfileAvatarCropEditor({
      open: true,
      sourceFile,
      sourcePreviewUrl,
      sourcePreviewOwned,
      sourceWidth,
      sourceHeight,
      cropLeft: (sourceWidth - sidePx) / (2 * sourceWidth),
      cropTop: (sourceHeight - sidePx) / (2 * sourceHeight),
      cropSize: 1,
      dragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragStartLeft: 0.1,
      dragStartTop: 0.1,
    });
  }, []);

  const handleProfileAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileError("Please choose an image file.");
      return;
    }
    try {
      const ready = await ensureImageFileUnderMaxBytes(file, MAX_AVATAR_IMAGE_BYTES, { maxLongEdge: 2048 });
      const previewUrl = URL.createObjectURL(ready);
      void openProfileAvatarCropEditor(ready, previewUrl, { sourcePreviewOwned: true });
      setProfileError("");
    } catch {
      setProfileError("Could not process that image. Try a different file.");
    }
  };

  const applyProfileAvatarCropEditor = useCallback(async () => {
    if (!profileAvatarCropEditor.open || !profileAvatarCropEditor.sourceFile) return;
    const effectiveToken = token || readAuthToken() || "";
    if (!effectiveToken) {
      setProfileAvatarCropApplyError("Your session expired. Please log in again.");
      return;
    }
    setProfileAvatarCropApplyError("");
    setProfileAvatarCropUploading(true);
    try {
      const cropped = await cropImageFileToSquareByRect(
        profileAvatarCropEditor.sourceFile,
        profileAvatarCropEditor.cropLeft,
        profileAvatarCropEditor.cropTop,
        profileAvatarCropEditor.cropSize,
      );
      const fd = new FormData();
      fd.append("avatar", cropped, cropped.name || "avatar.jpg");
      const data = await apiRequest("/auth/me/avatar", { method: "POST", token: effectiveToken, body: fd });
      const nextUrl = String(data?.user?.avatarUrl || "").trim();
      if (nextUrl) {
        setProfileDraft((prev) => ({ ...prev, avatarUrl: nextUrl }));
        setUser((prev) => ({ ...(prev || {}), ...(data.user || {}), avatarUrl: nextUrl }));
      }
      closeProfileAvatarCropEditor();
      setProfileError("");
    } catch (e) {
      const msg = e && typeof e.message === "string" ? e.message.trim() : "";
      setProfileAvatarCropApplyError(
        msg && msg.length < 220 ? msg : "Could not save avatar. Please try again.",
      );
    } finally {
      setProfileAvatarCropUploading(false);
    }
  }, [closeProfileAvatarCropEditor, profileAvatarCropEditor, token, setUser]);

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
      nextFieldErrors.username = "Enter a username (3–20 characters).";
    } else if (normalizedUsername.length < 3 || normalizedUsername.length > 20) {
      nextFieldErrors.username = "Use 3 to 20 characters for your username.";
    } else if (!/^[A-Za-z]/.test(normalizedUsername)) {
      nextFieldErrors.username = "Start the username with a letter (a–z).";
    } else if (/\s/.test(normalizedUsername)) {
      nextFieldErrors.username = "Remove spaces — use letters, numbers, dots, or underscores only.";
    } else if (!/^[A-Za-z0-9._]+$/.test(normalizedUsername)) {
      nextFieldErrors.username = "Use only letters, numbers, single dots, and single underscores.";
    } else if (/[A-Z]/.test(normalizedUsername)) {
      nextFieldErrors.username = "Use lowercase letters only (a–z).";
    } else if (/(\.\.|__)/.test(normalizedUsername)) {
      nextFieldErrors.username = "Do not use two dots (..) or two underscores (__) in a row.";
    }
    const namePattern = /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/;
    if (!normalizedFirstName) {
      nextFieldErrors.firstName = "Enter your first name as it should appear on your profile.";
    } else if (normalizedFirstName.length < 3 || normalizedFirstName.length > 50) {
      nextFieldErrors.firstName = "First name should be 3–50 letters (spaces or hyphens allowed between parts).";
    } else if (!namePattern.test(normalizedFirstName)) {
      nextFieldErrors.firstName = "Use letters only; separate parts with a space or hyphen.";
    }
    if (normalizedMiddleName && !namePattern.test(normalizedMiddleName)) {
      nextFieldErrors.middleName = "Use letters only; separate parts with a space or hyphen.";
    }
    if (!normalizedLastName) {
      nextFieldErrors.lastName = "Enter your last name as it should appear on your profile.";
    } else if (normalizedLastName.length < 3 || normalizedLastName.length > 50) {
      nextFieldErrors.lastName = "Last name should be 3–50 letters (spaces or hyphens allowed between parts).";
    } else if (!namePattern.test(normalizedLastName)) {
      nextFieldErrors.lastName = "Use letters only; separate parts with a space or hyphen.";
    }
    if (!normalizedGender) {
      nextFieldErrors.gender = "Choose an option from the list.";
    }
    if (!normalizedBirthday) {
      nextFieldErrors.birthday = "Enter your birthday (YYYY-MM-DD) or use the date picker.";
    } else if (normalizedBirthday > todayIsoDate) {
      nextFieldErrors.birthday = "Pick a date that is not in the future.";
    }
    if (!normalizedProvince) nextFieldErrors.addressProvince = "Select or type your province, then pick from suggestions.";
    if (!normalizedCity) nextFieldErrors.addressCity = "Select or type your city or municipality.";
    if (!normalizedBarangay) nextFieldErrors.addressBarangay = "Select or type your barangay.";
    if (Object.keys(nextFieldErrors).length > 0) {
      setProfileFieldErrors(nextFieldErrors);
      setProfileError("");
      return;
    }
    setProfileFieldErrors({});
    const effectiveToken = token || readAuthToken() || "";
    if (!effectiveToken) {
      setProfileError("Your session expired. Please log in again.");
      return;
    }
    const localPhone10 = toPhilippinesLocalPhone10(profileDraft.phone);
    if (!localPhone10) {
      setProfileFieldErrors((prev) => ({ ...prev, phone: "Enter your 10-digit mobile number after +63." }));
      setProfileError("");
      return;
    }
    if (localPhone10.length !== 10) {
      setProfileFieldErrors((prev) => ({
        ...prev,
        phone: "Enter exactly 10 digits (Philippine mobile, without a leading 0).",
      }));
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
          setProfileFieldErrors((prev) => ({
            ...prev,
            phone: "That number is already on another account — use a different mobile number.",
          }));
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
        writeAuthToken(data.token);
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
      const message = String(error?.message || "Could not update profile.");
      if (/phone number already in use|mobile number is already in use|phone.*already/i.test(message)) {
        setProfileFieldErrors((prev) => ({
          ...prev,
          phone: "That number is already on another account — use a different mobile number.",
        }));
        setProfileError("");
      } else {
        setProfileError(message);
      }
    } finally {
      setProfileSaving(false);
    }
  };

  if (!user && routeListingId) {
    return (
      <Suspense fallback={<ScreenLoading message="Loading listing…" spacious />}>
        <LazyPublicListingPage
          listingId={routeListingId}
          onBack={() => navigate("/")}
          onOpenLogin={() => {
            navigate("/");
            openAuthPanel("login");
          }}
        />
      </Suspense>
    );
  }

  if (!user) {
    return (
      <div className="landing-shell">
        <header className="landing-nav">
          <div className="app-container flex h-[4.25rem] max-w-full items-center justify-between gap-4 pl-[max(1.5rem,env(safe-area-inset-left,0px))] pr-[max(1.5rem,env(safe-area-inset-right,0px))] md:pl-[max(2rem,env(safe-area-inset-left,0px))] md:pr-[max(2rem,env(safe-area-inset-right,0px))] lg:pl-[max(2.5rem,env(safe-area-inset-left,0px))] lg:pr-[max(2.5rem,env(safe-area-inset-right,0px))]">
            <div className="flex min-w-0 items-center">
              <LinkMartLogo className="h-10 w-auto max-w-full shrink-0 object-contain md:h-11 md:max-w-[min(14rem,100%)]" />
            </div>
            <nav className="flex shrink-0 items-center gap-3 md:gap-4" aria-label="Sign in">
              <button type="button" className="landing-btn-nav-text" onClick={() => openAuthPanel("login")}>
                Log in
              </button>
              <button type="button" className="landing-btn-nav-primary" onClick={() => openAuthPanel("signup")}>
                Sign up
              </button>
            </nav>
          </div>
        </header>

        <main id="main-content">
          <div className="landing-hero-band">
            <div className="app-container px-6 md:px-8 lg:px-12">
              <div className="relative mx-auto w-full max-w-6xl">
                <section className="relative grid min-h-[calc(100svh-4.25rem-env(safe-area-inset-top,0px))] grid-cols-1 items-start gap-10 pb-28 pt-[200px] md:min-h-[calc(100svh-4.25rem-env(safe-area-inset-top,0px))] md:gap-12 md:pb-32 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-x-12 lg:gap-y-8 lg:pb-36 xl:gap-x-16">
              <div className="flex max-w-xl flex-col items-center gap-7 text-center md:gap-8 lg:max-w-none lg:items-start lg:text-left">
                <div className="flex w-full flex-col gap-5 md:gap-6">
                  <h1 className="text-balance text-[2rem] font-extrabold leading-[1.12] tracking-tight text-neutral-900 md:text-5xl md:leading-[1.08] dark:text-slate-50">
                    A marketplace built for <span className="text-brand-primary dark:text-brand-accent">your local community</span>
                  </h1>
                  <p className="mx-auto max-w-xl text-pretty text-lg leading-relaxed text-neutral-600 dark:text-slate-400 md:text-xl md:leading-relaxed lg:mx-0">
                    LinkMart connects neighbors for COD pickup or delivery: no in-app wallet, optional neighbor couriers (walk, run, bike), and seller tools for stock
                    and profit.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 lg:justify-start">
                  <button type="button" className="landing-hero-cta px-10" onClick={() => openAuthPanel("signup")}>
                    Start selling locally
                  </button>
                  <button type="button" className="btn-secondary rounded-full px-8 py-3 text-sm" onClick={() => openAuthPanel("login")}>
                    Browse nearby listings
                  </button>
                </div>
                <div className="grid w-full max-w-mobile-baseline grid-cols-3 gap-x-6 gap-y-6 border-t border-neutral-200/80 pt-9 dark:border-slate-700/80 md:max-w-lg md:gap-x-10 lg:max-w-none lg:flex lg:flex-wrap lg:justify-start lg:gap-x-12">
                  <div className="min-w-0 text-center lg:text-left">
                    <span className="block text-2xl font-semibold tracking-tight text-neutral-900 dark:text-slate-100">8k+</span>
                    <span className="mt-1 block text-sm text-neutral-500 dark:text-slate-400">Local listings</span>
                  </div>
                  <div className="min-w-0 text-center lg:text-left">
                    <span className="block text-2xl font-semibold tracking-tight text-neutral-900 dark:text-slate-100">1.2k+</span>
                    <span className="mt-1 block text-sm text-neutral-500 dark:text-slate-400">Neighborhood sellers</span>
                  </div>
                  <div className="min-w-0 text-center lg:text-left">
                    <span className="block text-2xl font-semibold tracking-tight text-neutral-900 dark:text-slate-100">50+</span>
                    <span className="mt-1 block text-sm text-neutral-500 dark:text-slate-400">Active communities</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-center lg:justify-end lg:self-start">
                <div className="w-full max-w-mobile-baseline md:max-w-lg lg:max-w-xl xl:max-w-2xl">
                  <Suspense
                    fallback={
                      <div
                        className="aspect-[16/10] w-full animate-pulse rounded-[1.75rem] bg-neutral-200/60 dark:bg-slate-700/60"
                        aria-hidden
                      />
                    }
                  >
                    <LazyLandingIllustration />
                  </Suspense>
                </div>
              </div>
              <div className="col-span-full flex justify-center pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-8 md:pb-[calc(2rem+env(safe-area-inset-bottom,0px))] md:pt-10">
                <button
                  type="button"
                  className="a11y-focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-200/90 bg-white/95 text-neutral-600 shadow-md backdrop-blur-sm transition motion-reduce:transition-none hover:border-neutral-300 hover:bg-white hover:text-neutral-900 dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white"
                  aria-label="Scroll to content below"
                  onClick={() => {
                    const el = document.getElementById("landing-next-section");
                    if (!el) return;
                    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
                    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
                  }}
                >
                  <ChevronDownIcon className="h-5 w-5" />
                </button>
              </div>
                </section>
              </div>
            </div>
          </div>

          <div className="app-container px-6 pb-24 pt-12 md:px-8 md:pb-32 md:pt-14 lg:px-12">
          <section
            id="landing-next-section"
            className="scroll-mt-24 px-4 py-10 md:scroll-mt-28 md:px-8 md:px-10 md:py-12"
          >
            <p className="mx-auto max-w-3xl text-center text-lg font-semibold leading-snug tracking-tight text-neutral-900 dark:text-slate-100 md:text-xl">
              Everything you need to buy and sell locally in one place
            </p>
            <div className="relative mt-10">
              <div className="flex items-center gap-2 md:px-6 lg:px-8">
                <button
                  type="button"
                  className="a11y-focus-ring relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200/90 bg-white text-neutral-600 shadow-sm transition motion-reduce:transition-none hover:border-neutral-300 hover:text-neutral-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-500 md:absolute md:left-1 md:top-[42%] md:z-10 md:-translate-y-1/2 lg:left-2"
                  aria-label="Previous categories"
                  onClick={() =>
                    setLandingDiscoverySlide((s) => (s - 1 + LANDING_DISCOVERY_SLIDES.length) % LANDING_DISCOVERY_SLIDES.length)
                  }
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <div className="mx-auto grid min-w-0 flex-1 grid-cols-1 justify-items-center gap-12 px-2 md:grid-cols-3 md:gap-x-8 md:gap-y-0 md:gap-x-12 md:px-4 lg:px-6">
                  {LANDING_DISCOVERY_SLIDES[landingDiscoverySlide].map((card) => (
                    <div key={card.title} className="flex w-full max-w-xs flex-col items-center gap-3 text-center md:max-w-none">
                      {card.logo ? (
                        <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl p-2 md:size-[4.25rem]">
                          <StableMediaImage
                            src={card.logo}
                            alt={`${card.title} logo`}
                            className="absolute inset-0 h-full w-full"
                            objectFit="contain"
                            loading="lazy"
                            decoding="async"
                            sizes="64px"
                          />
                        </div>
                      ) : (
                        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-sm font-bold tracking-tight text-brand-primary shadow-sm dark:bg-slate-800 dark:text-brand-accent md:size-[4.25rem] md:text-base">
                          {card.badge}
                        </div>
                      )}
                      <h3 className="px-1 text-[15px] font-semibold leading-snug text-brand-accent md:text-base md:whitespace-nowrap md:text-lg">{card.title}</h3>
                      <p className="text-pretty text-sm leading-relaxed text-neutral-600 dark:text-slate-400">{card.description}</p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="a11y-focus-ring relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200/90 bg-white text-neutral-600 shadow-sm transition motion-reduce:transition-none hover:border-neutral-300 hover:text-neutral-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-500 md:absolute md:right-1 md:top-[42%] md:z-10 md:-translate-y-1/2 lg:right-2"
                  aria-label="Next categories"
                  onClick={() => setLandingDiscoverySlide((s) => (s + 1) % LANDING_DISCOVERY_SLIDES.length)}
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-10 flex justify-center gap-2.5">
                {LANDING_DISCOVERY_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`h-2 w-2 rounded-full transition motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-brand-accent dark:focus-visible:ring-offset-slate-900 ${i === landingDiscoverySlide ? "bg-neutral-700 dark:bg-slate-200" : "bg-neutral-300 dark:bg-slate-600"}`}
                    aria-label={`Category slide ${i + 1}`}
                    aria-current={i === landingDiscoverySlide}
                    onClick={() => setLandingDiscoverySlide(i)}
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
                <ImagetoolsPicture
                  picture={landingFeaturesPicture}
                  alt="Marketplace platform features"
                  className="h-auto w-full max-w-xs object-contain drop-shadow-lg md:max-w-sm lg:max-w-md"
                  pictureClassName="block w-full max-w-xs md:max-w-sm lg:max-w-md"
                  sizes="(max-width: 768px) min(100vw - 2rem, 20rem), (max-width: 1024px) 24rem, 28rem"
                  loading="lazy"
                  decoding="async"
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
            <div className="mx-auto mt-10 flex w-full max-w-md flex-col items-stretch justify-center gap-4 md:mx-0 md:max-w-none md:flex-row md:items-center md:justify-center md:gap-5">
              <button type="button" className="landing-hero-cta w-full px-10 md:w-auto md:min-w-[12rem]" onClick={() => openAuthPanel("signup")}>
                Create free account
              </button>
              <button type="button" className="btn-secondary w-full rounded-full px-8 py-3 text-sm md:w-auto md:min-w-[12rem]" onClick={() => openAuthPanel("login")}>
                Log in
              </button>
            </div>
          </section>
          </div>

          <LandingSiteFooter />
        </main>

        {authPanelVisible && (
          <div
            className="landing-auth-modal-root fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-10"
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
            <div className="landing-auth-panel relative z-10 w-full max-w-md" onClick={(event) => event.stopPropagation()}>
              <div className="landing-card relative max-h-[min(90dvh,44rem)] overflow-y-auto overflow-x-hidden overscroll-contain">
                <button type="button" className="landing-auth-close" onClick={closeAuthPanel} aria-label="Close">
                  <span aria-hidden="true">×</span>
                </button>
                <div className="mb-8 pr-10">
                  <h2 id="auth-modal-title" className="mobile-page-title text-neutral-900 dark:text-slate-100">
                    {authMode === "signup" ? "Create an account" : "Welcome back"}
                  </h2>
                  <p className="mt-4 max-w-mobile-baseline text-sm leading-relaxed text-neutral-600 dark:text-slate-400 md:max-w-md md:text-[15px] md:leading-relaxed">
                    {authMode === "signup"
                      ? "Create your account to post items, manage listings, and connect with buyers in your community."
                      : "Sign in with email or Google to continue buying and selling in your local area."}
                  </p>
                </div>

                <form noValidate onSubmit={handleAuth} className="space-y-5">
                <>
                  <div>
                    <label htmlFor="auth-email" className="label-base">
                      Email
                    </label>
                    <input
                      id="auth-email"
                      name="email"
                      className="landing-input"
                      type="email"
                      inputMode="email"
                      enterKeyHint="next"
                      placeholder="you@example.com"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-invalid={authInlineErrors.email ? true : undefined}
                      aria-describedby={authInlineErrors.email ? "auth-email-error" : undefined}
                      value={form.email}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, email: e.target.value }));
                        setAuthInlineErrors((prev) => ({ ...prev, email: "" }));
                      }}
                      onBlur={() => {
                        const err = validateEmail(form.email);
                        setAuthInlineErrors((prev) => ({ ...prev, email: err }));
                      }}
                    />
                    {authInlineErrors.email ? (
                      <p id="auth-email-error" className="field-error-text mt-1.5" role="alert">
                        {authInlineErrors.email}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="auth-password" className="label-base">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="auth-password"
                        name="password"
                        className="landing-input pr-11"
                        type={showAuthPassword ? "text" : "password"}
                        placeholder={authMode === "signup" ? "At least 8 characters" : "Your password"}
                        minLength={authMode === "signup" ? 8 : undefined}
                        enterKeyHint={authMode === "signup" ? "next" : "go"}
                        autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                        aria-invalid={authInlineErrors.password ? true : undefined}
                        aria-describedby={authInlineErrors.password ? "auth-password-error" : undefined}
                        value={form.password}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, password: e.target.value }));
                          setAuthInlineErrors((prev) => ({ ...prev, password: "" }));
                        }}
                        onBlur={() => {
                          const err = validatePasswordClient(form.password, { signup: authMode === "signup" });
                          setAuthInlineErrors((prev) => ({ ...prev, password: err }));
                        }}
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
                    {authInlineErrors.password ? (
                      <p id="auth-password-error" className="field-error-text mt-1.5" role="alert">
                        {authInlineErrors.password}
                      </p>
                    ) : null}
                  </div>
                  {authMode === "signup" && (
                    <>
                      <div>
                        <label htmlFor="auth-confirm-password" className="label-base">
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
                            enterKeyHint="go"
                            autoComplete="new-password"
                            aria-invalid={authInlineErrors.confirmPassword ? true : undefined}
                            aria-describedby={authInlineErrors.confirmPassword ? "auth-confirm-password-error" : undefined}
                            value={form.confirmPassword}
                            onChange={(e) => {
                              setForm((prev) => ({ ...prev, confirmPassword: e.target.value }));
                              setAuthInlineErrors((prev) => ({ ...prev, confirmPassword: "" }));
                            }}
                            onBlur={() => {
                              const err = validateConfirmPassword(form.password, form.confirmPassword);
                              setAuthInlineErrors((prev) => ({ ...prev, confirmPassword: err }));
                            }}
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
                        {authInlineErrors.confirmPassword ? (
                          <p id="auth-confirm-password-error" className="field-error-text mt-1.5" role="alert">
                            {authInlineErrors.confirmPassword}
                          </p>
                        ) : null}
                      </div>
                      <label className="flex items-start gap-2.5 rounded-xl border border-neutral-200/80 bg-neutral-50/70 px-3 py-2.5 text-sm text-neutral-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                        <input
                          type="checkbox"
                          name="acceptedTerms"
                          className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary/35 dark:border-slate-500"
                          checked={form.acceptedTerms}
                          onChange={(e) => {
                            setForm((prev) => ({ ...prev, acceptedTerms: e.target.checked }));
                            setAuthInlineErrors((prev) => ({ ...prev, terms: "" }));
                          }}
                          aria-invalid={authInlineErrors.terms ? true : undefined}
                          aria-describedby={authInlineErrors.terms ? "auth-terms-error" : undefined}
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
                      {authInlineErrors.terms ? (
                        <p id="auth-terms-error" className="field-error-text mt-2 px-0.5" role="alert">
                          {authInlineErrors.terms}
                        </p>
                      ) : null}
                    </>
                  )}
                </>
                {message ? (
                  <p className="app-alert-error" role="alert">
                    {message}
                  </p>
                ) : null}
                <MobileFormActions className="rounded-b-xl">
                  <button
                    type="submit"
                    className="landing-btn-primary w-full"
                    disabled={authLoading}
                    aria-busy={authLoading || undefined}
                  >
                    {authLoading ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <span
                          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent motion-reduce:animate-none"
                          aria-hidden
                        />
                        {authMode === "signup" ? "Creating account…" : "Signing in…"}
                      </span>
                    ) : authMode === "signup" ? (
                      "Create account"
                    ) : (
                      "Log in"
                    )}
                  </button>
                </MobileFormActions>
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
                          className="flex min-h-[44px] w-full max-w-xs justify-center [&>div]:w-full [&>div]:flex [&>div]:justify-center"
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
                          setAuthInlineErrors({ email: "", password: "", confirmPassword: "", terms: "" });
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
                          setAuthInlineErrors({ email: "", password: "", confirmPassword: "", terms: "" });
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
    <div className="min-h-screen min-h-[100dvh] w-full bg-neutral-200/90 dark:bg-black md:bg-app md:dark:bg-slate-950">
      {publishFlash ? (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-1/2 top-[max(0.5rem,calc(4.25rem+env(safe-area-inset-top,0px)+0.5rem))] z-[60] w-[calc(100vw-env(safe-area-inset-left,0px)-env(safe-area-inset-right,0px)-2rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-emerald-200/80 bg-white/95 shadow-[0_22px_50px_-14px_rgba(5,150,105,0.35),0_8px_16px_-8px_rgba(15,23,42,0.12)] backdrop-blur-xl ring-1 ring-emerald-500/[0.08] transition-[opacity,transform] duration-[350ms] ease-out md:max-w-lg dark:border-emerald-500/25 dark:bg-slate-900/95 dark:shadow-[0_22px_50px_-14px_rgba(0,0,0,0.55),0_0_0_1px_rgba(16,185,129,0.12)] dark:ring-emerald-400/10 ${publishFlashExiting ? "pointer-events-none translate-y-[-6px] opacity-0" : "translate-y-0 opacity-100"}`}
        >
          <div className="relative flex items-start gap-3 px-4 pb-3 pt-4 md:gap-3.5 md:px-5 md:pb-3.5 md:pt-4">
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
              className="btn-icon-only inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent text-neutral-400 transition hover:border-neutral-200 hover:bg-neutral-100 hover:text-neutral-700 dark:text-slate-500 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:!h-9 md:!min-h-9 md:!w-9 md:!max-w-9"
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
      <MobileAppShell>
      {marketplaceToasts.length > 0 ? (
        <div
          className="pointer-events-none fixed safe-fixed-x bottom-[max(1rem,calc(env(safe-area-inset-bottom,0px)+0.75rem))] z-[70] flex max-h-[min(70vh,calc(100dvh-10rem))] flex-col gap-2 overflow-y-auto md:left-auto md:right-6 md:bottom-6 md:w-[24rem]"
          role="region"
          aria-label="Notifications"
          aria-live="polite"
        >
          {marketplaceToasts.map((t) => {
            const fb = computeMarketplaceFeedbackForText(t.text);
            return (
              <div
                key={t.id}
                className={`pointer-events-auto flex items-start justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-sm shadow-lg backdrop-blur ${fb.className}`}
                role={fb.role}
                aria-live={fb.live}
              >
                <span className="inline-flex min-w-0 items-start gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current/30 text-[11px] font-bold">
                    {fb.icon}
                  </span>
                  <span className="leading-relaxed">{fb.text}</span>
                </span>
                <button
                  type="button"
                  className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg px-2 text-base leading-none transition hover:bg-black/5 dark:hover:bg-white/10 md:min-h-0 md:min-w-0 md:rounded-md md:px-1.5 md:py-0.5 ${fb.dismissClass}`}
                  aria-label="Dismiss notification"
                  onClick={() => dismissMarketplaceToast(t.id)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <LoggedInHeader
        user={user}
        activeView={activeView}
        setActiveView={setActiveView}
        goOwnProfile={goOwnProfile}
        goBrowse={goBrowse}
        goOrders={goOrders}
        goMyPurchases={goMyPurchases}
        goCart={goCart}
        inboxBadgeCount={inboxNavBadgeCount}
        messagesUnreadCount={totalChatUnreadCount}
        cartItemCount={cartNavBadgeCount}
        totalCartCount={headerTotalCartCount}
        purchasesItemCount={purchaseNavBadgeCount}
        purchasesAttentionMuted={purchasesNavAttentionMuted}
        totalPurchasesCount={headerTotalPurchasesCount}
        ordersItemCount={sellerNavBadgeCount}
        ordersAttentionMuted={ordersNavAttentionMuted}
        totalOrdersCount={headerTotalOrdersCount}
        notificationUnreadCount={unreadNotificationCount}
        favoritesBadgeCount={favoritesNavBadgeCount}
        favoriteCount={favoriteIds.size}
        theme={theme}
        setTheme={setTheme}
        onLogout={logout}
        getDisplayNameFromUser={getDisplayNameFromUser}
        onNavigateHome={() => navigate("/")}
        onMobileBrowseNavCollapsedChange={setMobileTopChromeCollapsed}
        mobileSecondaryDragX={mobileSecondaryDragX}
        hideNavigationChrome={activeView === VIEWS.PRODUCT_DETAIL || listingEditOverlayOpen}
        liftChromeAboveOverlay={quickAddModalOpen}
      >
      {isMobileViewport && mobilePullRefreshing ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 top-[max(0.5rem,calc(4.25rem+env(safe-area-inset-top,0px)+0.5rem))] z-[65] -translate-x-1/2 rounded-full border border-neutral-200/80 bg-white/95 px-3 py-1 text-xs font-semibold text-brand-primary shadow-sm dark:border-slate-700 dark:bg-slate-900/95 dark:text-brand-accent"
        >
          Refreshing…
        </div>
      ) : null}
      <main
        id="main-content"
        className={`${UI_KIT.mobileMainScroll} app-container scroll-pt-2 scroll-pb-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+0.25rem))] space-y-5 bg-white pt-4 pb-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+0.25rem))] dark:bg-slate-950 md:scroll-pb-0 md:scroll-pt-0 md:space-y-6 md:bg-transparent md:py-8 md:pb-12 md:dark:bg-transparent ${
          lockMainScrollForOverlay
            ? "!overflow-y-hidden !space-y-0 !pt-0 !pb-0 !scroll-pt-0 !scroll-pb-0 flex flex-col min-h-0"
            : ""
        } ${
          isMobileViewport && !mobileSecondaryDragging ? mobileSecondarySlideClass : ""
        }`}
        style={
          isMobileViewport &&
          secondaryMobileNavOrder.includes(secondarySwipeNavView) &&
          (mobileSecondaryDragging || mobileSecondaryDragX !== 0 || mobileSecondarySwipeSettling)
            ? {
                transform: `translate3d(${mobileSecondaryDragX}px, 0, 0)`,
                transition: mobileSecondaryDragging
                  ? "none"
                  : mobileSecondarySwipeSettling
                    ? "transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)"
                    : undefined,
                willChange: mobileSecondaryDragging || mobileSecondarySwipeSettling ? "transform" : undefined,
              }
            : undefined
        }
      >
        {activeView === VIEWS.PRODUCT_DETAIL && productInspect && !listingEditOverlayOpen ? (
          <section
            className={`w-full min-w-0 ${lockMainScrollForOverlay ? "flex min-h-0 flex-1 flex-col" : ""}`}
          >
            <Suspense
              fallback={
                <div className={lockMainScrollForOverlay ? "flex min-h-0 flex-1 flex-col" : ""}>
                  <ScreenLoading message="Loading product…" minHeight={false} className="min-h-[10rem]" />
                </div>
              }
            >
              <LazyProductInspectModal open fullScreen onClose={closeProductInspect} {...productInspect} />
            </Suspense>
          </section>
        ) : null}
        {isBrowseLikeView && activeView !== VIEWS.FAVORITES && (
          <section className={`${UI_KIT.viewSection} space-y-4 md:space-y-6`}>
            <div className="space-y-4">
              {activeView === VIEWS.COMMUNITY_SHOP ? (
                <>
                <div
                  className={`relative overflow-hidden border transition-opacity duration-200 max-lg:rounded-xl max-lg:border-neutral-200/70 max-lg:bg-white max-lg:p-2.5 max-lg:shadow-sm max-lg:dark:border-slate-700 max-lg:dark:bg-slate-900 border-[#7cded9]/60 bg-gradient-to-r from-[#e6fbfb] via-[#edf8ff] to-[#eaf2ff] p-3 md:p-4 lg:p-5 dark:border-[#1f3c56] dark:bg-gradient-to-r dark:from-[#0f2234] dark:via-[#11283d] dark:to-[#16324a] max-lg:bg-none ${
                    mobileCommunityFiltersOpen ? "pointer-events-none opacity-40 lg:pointer-events-auto lg:opacity-100" : ""
                  }`}
                >
                  <div className="relative z-10 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                    <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-start md:gap-4 lg:gap-5">
                      <div className="min-w-0 flex-1 space-y-2 border-neutral-200 md:space-y-2 lg:border-l lg:pl-5 dark:lg:border-slate-600">
                        <div className="flex items-start justify-between gap-2 lg:flex-col lg:items-stretch lg:justify-start lg:gap-2">
                          <div className="min-w-0 flex-1 space-y-1.5 lg:flex-none lg:space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h2 className="line-clamp-3 break-words text-pretty text-lg font-semibold tracking-tight text-neutral-900 max-lg:leading-snug dark:text-slate-100 lg:line-clamp-none lg:text-xl lg:text-[#123a5f] lg:dark:text-[#e9f7ff] lg:text-2xl">
                                {toTitleCase(activeCommunity?.name?.trim()) || "Community"}
                              </h2>
                              <div className="lg:hidden">
                                {isMemberOfOpenCommunity ? (
                                  <span className="inline-flex items-center rounded-md border border-emerald-200/90 bg-emerald-50/90 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-300">
                                    Joined
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200/80 bg-neutral-50/80 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">
                                    Visitor
                                  </span>
                                )}
                              </div>
                            </div>
                            {activeCommunityLocaleLine ? (
                              <p className="line-clamp-2 text-xs text-neutral-500 dark:text-slate-400 lg:line-clamp-none lg:text-sm lg:text-[#2a597f] lg:dark:text-[#9fc3d9]">
                                {activeCommunityLocaleLine}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 self-start pt-0.5 max-lg:justify-start lg:w-full lg:justify-start lg:gap-2 lg:self-auto lg:pt-0">
                            <button
                              type="button"
                              className="hidden lg:inline-flex items-center rounded-md border border-sky-200/90 bg-sky-50/90 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 transition hover:border-sky-300 hover:bg-sky-100 dark:border-sky-500/35 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:border-sky-400/45 dark:hover:bg-sky-500/20"
                              onClick={() => leaveCommunityToGlobalMarketplace()}
                            >
                              Communities
                            </button>
                            {isMemberOfOpenCommunity ? (
                              <span className="hidden lg:inline-flex items-center rounded-md border border-emerald-200/90 bg-emerald-50/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 max-lg:normal-case max-lg:tracking-normal dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-300 lg:gap-1 lg:rounded-full lg:border-emerald-300/80 lg:px-2.5 lg:py-1 lg:text-xs lg:normal-case lg:tracking-normal">
                                <span className="max-lg:hidden">● Joined member</span>
                                <span className="lg:hidden">Joined</span>
                              </span>
                            ) : (
                              <span className="hidden lg:inline-flex items-center gap-1 rounded-md border border-neutral-200/80 bg-neutral-50/80 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 max-lg:normal-case dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400 lg:rounded-full lg:border-neutral-300/80 lg:bg-white lg:px-2.5 lg:py-1 lg:text-xs lg:text-neutral-700 dark:lg:text-slate-300">
                                <span className="max-lg:hidden">○ Not a member yet</span>
                                <span className="lg:hidden">Visitor</span>
                              </span>
                            )}
                            {activeCommunity?.createdBy &&
                            String(activeCommunity.createdBy) === String(user?.id || "") &&
                            !activeCommunity?.imageUrl ? (
                              <button
                                type="button"
                                className="inline-flex min-h-8 items-center justify-center rounded-full border border-neutral-300/80 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                                onClick={() => openEditCommunityModal(activeCommunity)}
                              >
                                Add image
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {/* Mobile: compact actions below "How this shop works" */}
                        <div className="flex flex-col gap-1.5 lg:hidden">
                          <div className="flex flex-row items-center gap-2">
                            {!isMemberOfOpenCommunity ? (
                              <button
                                type="button"
                                title="Join community"
                                className="inline-flex min-h-9 min-w-0 flex-1 shrink-0 items-center justify-center truncate whitespace-nowrap rounded-full bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-primary/90 dark:bg-brand-accent dark:text-slate-900 dark:hover:bg-brand-accent/90"
                                onClick={() => {
                                  void joinCommunityAndAttachListings(activeCommunity, { notifySuccess: true });
                                  setShopCommunityId(activeCommunity?.id || null);
                                  setActiveView(VIEWS.COMMUNITY_SHOP);
                                  navigate("/", { replace: true });
                                }}
                              >
                                Join community
                              </button>
                            ) : null}
                          </div>
                          {isMemberOfOpenCommunity && activeCommunity?.createdBy && String(activeCommunity.createdBy) === String(user?.id || "") ? (
                            <div className="grid grid-cols-1 gap-1.5">
                              <button
                                type="button"
                                className="inline-flex min-h-9 items-center justify-center rounded-full border border-neutral-300/80 bg-white px-2 py-1.5 text-[11px] font-medium leading-tight text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                                onClick={() => openEditCommunityModal(activeCommunity)}
                              >
                                Edit community
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="hidden w-full flex-wrap items-center gap-2 lg:mt-0.5 lg:flex lg:w-auto lg:max-w-[20rem] lg:shrink-0 lg:justify-end">
                      <span className="w-full text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                        Community actions
                      </span>
                      {activeCommunity?.createdBy && String(activeCommunity.createdBy) === String(user?.id || "") ? (
                        <button
                          type="button"
                          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-neutral-300/80 bg-white px-3 py-2.5 text-xs font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 md:min-h-0 md:flex-none md:px-4 md:py-2 md:text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                          onClick={() => openEditCommunityModal(activeCommunity)}
                        >
                          Edit community
                        </button>
                      ) : null}
                      {!isMemberOfOpenCommunity ? (
                        <button
                          type="button"
                          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary/90 md:min-h-0 md:flex-none md:py-2 dark:bg-brand-accent dark:text-slate-900 dark:hover:bg-brand-accent/90"
                          onClick={() => {
                            void joinCommunityAndAttachListings(activeCommunity, { notifySuccess: true });
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
                          className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-rose-200/85 bg-transparent px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50/90 md:flex-none dark:border-rose-500/35 dark:text-rose-300 dark:hover:border-rose-400/45 dark:hover:bg-rose-500/10"
                          onClick={requestLeaveCommunityConfirmation}
                        >
                          Leave community
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-end justify-between gap-2 border-t border-neutral-200/70 pt-2.5 dark:border-slate-700/70 lg:hidden">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                    Community actions
                  </span>
                  <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="inline-flex min-h-[32px] items-center justify-center rounded-md border border-sky-200/90 bg-sky-50/90 px-2.5 py-1 text-[10px] font-semibold text-sky-800 transition hover:border-sky-300 hover:bg-sky-100 dark:border-sky-500/35 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:border-sky-400/45 dark:hover:bg-sky-500/20"
                    onClick={() => leaveCommunityToGlobalMarketplace()}
                  >
                    Communities
                  </button>
                  {isMemberOfOpenCommunity ? (
                    <button
                      type="button"
                      aria-label="Leave this community"
                      className="inline-flex min-h-[32px] items-center justify-center rounded-md border border-rose-200/85 bg-transparent px-2.5 py-1 text-[10px] font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50/90 dark:border-rose-500/35 dark:text-rose-300 dark:hover:border-rose-400/45 dark:hover:bg-rose-500/10"
                      onClick={requestLeaveCommunityConfirmation}
                    >
                      Leave community
                    </button>
                  ) : null}
                  </div>
                </div>
                </>
              ) : activeView === VIEWS.FAVORITES ? null : (
                <>
                  <div>
                    <h2 className="min-w-0 text-2xl font-semibold text-neutral-900 dark:text-slate-100 md:whitespace-nowrap">Marketplace</h2>
                  </div>
                  <div className={`${UI_KIT.viewSection} p-3 md:p-4`}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-500 md:text-sm md:normal-case md:tracking-normal md:text-brand-primary">
                      Communities
                    </p>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-slate-400 md:text-base">
                      LinkMart is a neighborhood marketplace where members can discover local products, join community shops, and buy with COD pickup or delivery.
                    </p>
                  </div>
                </div>
                {communitiesError ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{communitiesError}</p> : null}
                {communitiesLoading && communities.length === 0 ? (
                  <p className="mt-3 text-sm text-neutral-600 dark:text-slate-400">Loading communities…</p>
                ) : null}
                {!(communitiesLoading && communities.length === 0) && communities.length > 0 ? (
                  <div className="mt-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-1 md:max-w-md">
                      <label htmlFor="community-directory-search" className="sr-only">
                        Search communities
                      </label>
                      <div className="input-base flex min-h-0 min-w-0 items-center gap-1 py-2 pl-3 pr-2 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/25 dark:focus-within:border-brand-primary">
                        <input
                          id="community-directory-search"
                          type="search"
                          autoComplete="off"
                          placeholder="Search by name or location…"
                          value={communityDirectoryQuery}
                          onChange={(e) => setCommunityDirectoryQuery(e.target.value)}
                          className="min-h-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-neutral-900 outline-none ring-0 placeholder:text-neutral-400 focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                        />
                        {communityDirectoryQuery.trim() ? (
                          <button
                            type="button"
                            className="inline-flex shrink-0 items-center justify-center rounded-md px-2 py-1.5 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            aria-label="Clear search"
                            onClick={() => setCommunityDirectoryQuery("")}
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-2 md:justify-end">
                      <p className="min-w-0 text-xs text-neutral-500 dark:text-slate-400" aria-live="polite">
                        {directoryCommunities.length === communities.length
                          ? `${communities.length} ${communities.length === 1 ? "community" : "communities"}`
                          : `${directoryCommunities.length} of ${communities.length} shown`}
                      </p>
                      <label htmlFor="community-directory-sort" className="sr-only">
                        Sort communities
                      </label>
                      <select
                        id="community-directory-sort"
                        value={communityDirectorySort}
                        onChange={(e) => setCommunityDirectorySort(e.target.value)}
                        className="input-base w-full min-w-0 py-2 pl-3 pr-8 text-sm md:w-auto md:min-w-[10.5rem]"
                      >
                        <option value="name">Name (A–Z)</option>
                        <option value="members">Most members</option>
                      </select>
                    </div>
                  </div>
                ) : null}
                <ul
                  className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  aria-label="Communities"
                >
                  {!(communitiesLoading && communities.length === 0) && communities.length === 0 ? (
                    <li className="col-span-full min-w-0 text-sm text-neutral-600 dark:text-slate-400">
                      No communities available right now.
                    </li>
                  ) : null}
                  {!(communitiesLoading && communities.length === 0) &&
                  communities.length > 0 &&
                  directoryCommunities.length === 0 ? (
                    <li className="col-span-full min-w-0 rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60 px-4 py-6 text-center text-sm text-neutral-600 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
                      No communities match “{communityDirectoryQuery.trim()}”.{" "}
                      <button
                        type="button"
                        className="font-medium text-brand-primary underline decoration-brand-primary/35 underline-offset-2 hover:text-brand-primary/80"
                        onClick={() => setCommunityDirectoryQuery("")}
                      >
                        Clear search
                      </button>
                    </li>
                  ) : null}
                  {directoryCommunities.map((c) => {
                    const g = gradientForId(c.id);
                    const initials = initialsFromName(c.name);
                    return (
                      <li key={c.id} className="min-w-0">
                        <div className="flex h-full min-h-0 flex-col rounded-xl border border-neutral-200/90 bg-neutral-50/40 p-2.5 dark:border-slate-600 dark:bg-slate-800/50 md:p-3">
                          <button
                            type="button"
                            className="group flex min-h-0 flex-1 flex-col gap-2 text-left transition hover:opacity-95"
                            onClick={() => {
                              setShopCommunityId(c.id);
                              setActiveView(VIEWS.COMMUNITY_SHOP);
                              navigate("/", { replace: true });
                            }}
                          >
                            <div className="relative aspect-[16/9] max-h-[9.5rem] w-full shrink-0 overflow-hidden rounded-lg shadow-inner ring-1 ring-black/5 transition group-hover:ring-brand-primary/30 dark:ring-white/10 md:max-h-[10rem]">
                              {c.imageUrl ? (
                                <StableMediaImage
                                  src={c.imageUrl}
                                  alt=""
                                  className="absolute inset-0 h-full w-full"
                                  loading="lazy"
                                  decoding="async"
                                  sizes="(max-width: 768px) 28vw, 120px"
                                />
                              ) : (
                                <div
                                  className="flex h-full w-full items-center justify-center text-base font-bold tracking-tight text-white md:text-xl"
                                  style={{ backgroundImage: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                                  aria-hidden
                                >
                                  {initials}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 px-0.5">
                              <p className="line-clamp-2 break-words text-sm font-semibold text-neutral-900 dark:text-slate-100 md:text-base">
                                {toTitleCase(String(c.name || "").trim())}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600 dark:text-slate-400 md:text-sm">
                                {formatCommunityMarketplaceSubtitle(c)}
                              </p>
                              <p className="mt-0.5 text-xs text-neutral-600 dark:text-slate-400 md:text-sm">
                                Members:{" "}
                                <span className="font-medium text-neutral-800 dark:text-slate-200">
                                  {getDisplayedMemberCount(c)}
                                </span>
                              </p>
                            </div>
                          </button>
                          <div className="mt-auto flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-neutral-200/80 pt-2 dark:border-slate-600/80">
                            {String(listingCommunityFromProfile.id || "") === String(c.id) ? (
                              <span className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                                Joined
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                onClick={() => {
                                  void joinCommunityAndAttachListings(c, { notifySuccess: true });
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
                              className="mt-1 px-0.5 text-right text-xs font-medium text-brand-primary underline decoration-brand-primary/35 underline-offset-2 hover:text-brand-primary/80"
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
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
              {mobileCommunityFiltersOpen ? (
                <button
                  type="button"
                  className="fixed inset-0 z-[100] bg-neutral-950/60 backdrop-blur-[3px] motion-reduce:backdrop-blur-none lg:hidden"
                  aria-label="Close filters"
                  onClick={() => setMobileCommunityFiltersOpen(false)}
                />
              ) : null}
              <aside
                className={`order-1 shadow-sm transition-[opacity,transform] duration-300 ease-out fixed inset-0 z-[110] flex flex-col items-stretch justify-center bg-transparent p-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none space-y-3 md:space-y-4 lg:sticky lg:inset-auto lg:top-24 lg:order-none lg:z-auto lg:flex lg:block lg:max-h-[calc(100dvh-6rem)] lg:w-auto lg:max-w-none lg:translate-x-0 lg:translate-y-0 lg:flex-col lg:items-stretch lg:justify-start lg:rounded-2xl lg:border lg:border-neutral-200/80 lg:bg-neutral-50/40 lg:p-3 lg:shadow-sm lg:transition-none lg:overflow-y-auto lg:overflow-x-visible lg:overscroll-y-contain lg:pr-0.5 lg:pointer-events-auto drawer-scroll dark:lg:border-slate-600 dark:lg:bg-slate-900/50 ${
                  mobileCommunityFiltersOpen
                    ? "visible scale-100 opacity-100"
                    : "invisible scale-[0.98] opacity-0"
                } lg:visible lg:scale-100 lg:opacity-100`}
              >
                <div className="flex min-h-0 min-w-0 flex-1 max-h-full items-center justify-center lg:contents lg:max-h-none">
                  <div className="flex min-h-0 w-full max-w-mobile-baseline flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_24px_64px_-12px_rgba(15,23,42,0.45)] ring-1 ring-black/[0.04] pointer-events-auto max-h-[min(88dvh,40rem)] dark:border-slate-600 dark:bg-slate-900 dark:ring-white/[0.06] md:max-w-md lg:contents lg:max-h-none lg:max-w-none lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none lg:ring-0">
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:contents">
                  <div className="shrink-0 border-b border-neutral-100 bg-neutral-50/80 px-3 pb-3 pt-2.5 dark:border-slate-700/80 dark:bg-slate-800/40 lg:hidden lg:border-0 lg:bg-transparent lg:p-0">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0 pt-0.5">
                        <p className="text-base font-bold tracking-tight text-neutral-900 dark:text-slate-50">Filters</p>
                        <p className="mt-0.5 text-[12px] leading-snug text-neutral-500 dark:text-slate-400">
                          Browse, quick picks, categories
                        </p>
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-11 w-11 max-md:min-h-[44px] max-md:min-w-[44px] shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:bg-neutral-50 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 md:h-10 md:w-10 md:min-h-0 md:min-w-0"
                        aria-label="Close filters"
                        onClick={() => setMobileCommunityFiltersOpen(false)}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <label htmlFor="mobile-browse-category-search" className="sr-only">
                      Search categories
                    </label>
                    <input
                      id="mobile-browse-category-search"
                      type="search"
                      enterKeyHint="search"
                      autoComplete="off"
                      placeholder="Search categories…"
                      value={mobileBrowseCategoryQuery}
                      onChange={(e) => setMobileBrowseCategoryQuery(e.target.value)}
                      className="input-base border-neutral-200/90 bg-white py-2.5 pl-3 pr-9 text-sm shadow-sm dark:border-slate-600 dark:bg-slate-950"
                    />
                  </div>
                  <div className="drawer-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-3 py-3 md:space-y-5 lg:max-h-none lg:flex-none lg:space-y-3 lg:overflow-visible lg:px-0 lg:py-0">
                  <div className="rounded-xl bg-neutral-50/90 p-2.5 ring-1 ring-neutral-200/60 dark:bg-slate-800/35 dark:ring-slate-600/50 lg:bg-transparent lg:p-0 lg:ring-0">
                    <p className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-400 dark:text-slate-500">
                      <svg className="h-3.5 w-3.5 text-brand-primary dark:text-brand-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h7" />
                      </svg>
                      Sort
                    </p>
                    <select
                      value={listingSort}
                      onChange={(e) => setListingSort(e.target.value)}
                      className="input-base w-full py-2 pl-3 pr-8 text-sm"
                      aria-label="Sort listings"
                    >
                      {LISTING_SORT_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-xl bg-neutral-50/90 p-2.5 ring-1 ring-neutral-200/60 dark:bg-slate-800/35 dark:ring-slate-600/50 lg:bg-transparent lg:p-0 lg:ring-0">
                    <p className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-400 dark:text-slate-500">
                      <svg className="h-3.5 w-3.5 text-brand-primary dark:text-brand-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h7v6H3zM14 5h7v6h-7zM14 14h7v6h-7zM3 14h7v6H3z" />
                      </svg>
                      Quick picks
                    </p>
                    <div className="grid grid-cols-1 gap-2 lg:flex lg:flex-col lg:gap-1.5">
                    {BROWSE_QUICK_FILTERS.map((filter) => (
                      <FilterOptionButton
                        key={filter.id}
                        active={browseQuickFilter === filter.id}
                        sheet={mobileCommunityFiltersOpen}
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
                  <div className="border-t border-neutral-200/90 pt-4 dark:border-slate-700">
                    <p className="mb-2.5 flex items-center gap-2 px-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-400 dark:text-slate-500">
                      <svg className="h-3.5 w-3.5 text-brand-primary dark:text-brand-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      Categories
                    </p>
                    <div className="flex flex-col gap-2 lg:gap-1">
                    {browseVerticalsForMobileDrawer.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-3 text-center text-sm text-neutral-600 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
                        No categories match your search.
                      </p>
                    ) : null}
                    {browseVerticalsForMobileDrawer.map((v) => {
                      const allSub = v.subs.find((s) => s.id === "all") ?? v.subs[0];
                      const isActive = browseVerticalId === v.id;
                      return (
                        <FilterOptionButton
                          key={v.id}
                          active={isActive}
                          sheet={mobileCommunityFiltersOpen}
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
                  </div>
                  </div>
                  </div>
                  </div>
                </aside>
              <div className="order-2 min-w-0 space-y-3 md:space-y-4 lg:order-none">
                {activeView === VIEWS.FAVORITES ? (
                  <h2 className="break-words text-2xl font-semibold text-neutral-900 dark:text-slate-100">Favorites</h2>
                ) : null}
                <div
                  className={
                    activeView === VIEWS.COMMUNITY_SHOP && isMobileViewport ? "hidden" : "lg:hidden"
                  }
                >
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-neutral-300/90 bg-white px-3.5 py-2.5 text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-50 active:scale-[0.98] motion-reduce:active:scale-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    onClick={() => setMobileCommunityFiltersOpen(true)}
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
                    </svg>
                    <span className="md:hidden">{"Browse & filter"}</span>
                    <span className="hidden md:inline">{"Browse & Categories"}</span>
                  </button>
                </div>
                {activeBrowseFilterSummary.length > 0 ? (
                  <div className={`${UI_KIT.surfaceMuted} flex flex-wrap items-center justify-between gap-2 px-3 py-2`}>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">Filters</span>
                      {activeBrowseFilterSummary.map((item) => (
                        <span key={item} className={UI_KIT.chipActive}>
                          {item}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                      onClick={() => {
                        setBrowseVerticalId(null);
                        setBrowseSubId(null);
                        setBrowseQuickFilter("all");
                        setCommunityListingsQuery("");
                        setListingSort("newest");
                      }}
                    >
                      Reset
                    </button>
                  </div>
                ) : null}
                {activeView === VIEWS.FAVORITES ? (
                  favoritesLoading && strictFavoritesList.length === 0 ? (
                    isMobileViewport ? (
                      <BrowseGridSkeleton
                        gridClassName={favoritesGridClass(effectiveFavoriteBrowseView)}
                        variant={effectiveFavoriteBrowseView === "compact" ? "compact" : effectiveFavoriteBrowseView === "list" ? "list" : "grid"}
                        count={effectiveFavoriteBrowseView === "compact" ? 8 : 6}
                        ariaLabel="Loading favorites"
                      />
                    ) : (
                      <ScreenLoading message="Loading favorites…" />
                    )
                  ) : null
                ) : listingsLoading && listings.length === 0 ? (
                  isMobileViewport ? (
                    <BrowseGridSkeleton
                      gridClassName={communityBrowseGridClass(effectiveCommunityBrowseView, isMobileViewport)}
                      variant={
                        effectiveCommunityBrowseView === "compact"
                          ? "compact"
                          : effectiveCommunityBrowseView === "list"
                            ? "list"
                            : "grid"
                      }
                      softBrowseChrome={
                        activeView === VIEWS.COMMUNITY_SHOP && effectiveCommunityBrowseView !== "list"
                      }
                      count={effectiveCommunityBrowseView === "compact" ? 8 : 6}
                      ariaLabel={activeView === VIEWS.COMMUNITY_SHOP ? "Loading listings" : "Loading"}
                    />
                  ) : (
                    <ScreenLoading
                      message={
                        activeView === VIEWS.COMMUNITY_SHOP ? "Loading community listings…" : "Loading…"
                      }
                    />
                  )
                ) : null}
                {activeView === VIEWS.FAVORITES && favoritesFetchError ? (
                  <ScreenError
                    title="Couldn’t load favorites"
                    message={favoritesFetchError}
                    onRetry={() => void refreshFavorites()}
                    secondaryAction={{ label: "Browse marketplace", onClick: goBrowse }}
                    spacious
                  />
                ) : null}
                {activeView !== VIEWS.FAVORITES && listingsError ? (
                  <ScreenError
                    title="Couldn’t load listings"
                    message={listingsError}
                    onRetry={
                      activeView === VIEWS.COMMUNITY_SHOP
                        ? () => void loadCommunityShopListings({ preserveExistingRows: false })
                        : undefined
                    }
                    secondaryAction={{ label: "Browse marketplace", onClick: goBrowse }}
                    spacious
                  />
                ) : null}
                {(activeView === VIEWS.FAVORITES
                  ? !(favoritesLoading && strictFavoritesList.length === 0) && !favoritesFetchError
                  : !listingsError && !(listingsLoading && listings.length === 0)) ? (
                  <div
                    className={
                      activeView === VIEWS.COMMUNITY_SHOP
                        ? `flex flex-wrap items-end justify-between border-b border-neutral-200/80 dark:border-slate-700/80 ${
                            "gap-3 pb-3"
                          } ${
                            isMobileViewport
                              ? "z-20 bg-white shadow-sm dark:bg-slate-950"
                              : ""
                          }`
                        : "flex justify-end"
                    }
                  >
                    {activeView === VIEWS.COMMUNITY_SHOP ? (
                      <div className="min-w-0 flex-1 pr-2">
                        {listingsRefreshing ? (
                          <p className="mt-1 text-xs font-medium text-brand-primary dark:text-brand-accent" aria-live="polite">
                            Updating listings…
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {activeView === VIEWS.COMMUNITY_SHOP ? (
                        <div className="input-base flex min-h-[44px] min-w-[12rem] flex-1 items-center gap-1.5 rounded-xl border-neutral-200/90 bg-white px-2.5 dark:border-slate-600 dark:bg-slate-900 sm:max-w-xs md:min-h-0 md:h-9">
                          <input
                            id="community-listings-search"
                            type="search"
                            inputMode="search"
                            enterKeyHint="search"
                            autoComplete="off"
                            value={communityListingsQuery}
                            onChange={(e) => setCommunityListingsQuery(e.target.value)}
                            placeholder="Search listings…"
                            className="min-h-0 w-full border-0 bg-transparent p-0 text-xs text-neutral-900 outline-none ring-0 placeholder:text-neutral-400 focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                            aria-label="Search community listings"
                          />
                          {communityListingsQuery.trim() ? (
                            <button
                              type="button"
                              className="inline-flex min-h-[30px] min-w-[30px] items-center justify-center rounded-md px-1.5 text-[11px] font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                              onClick={() => setCommunityListingsQuery("")}
                              aria-label="Clear listings search"
                            >
                              Clear
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {isMobileViewport ? null : (
                        <select
                          value={listingSort}
                          onChange={(e) => setListingSort(e.target.value)}
                          className="input-base min-h-[44px] min-w-[9.5rem] rounded-xl py-2 pl-3 pr-8 text-xs md:h-9 md:min-h-0 md:text-sm"
                          aria-label="Sort listings"
                        >
                          {LISTING_SORT_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}
                      {activeView === VIEWS.COMMUNITY_SHOP && isMobileViewport ? (
                        <button
                          type="button"
                          className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center gap-1.5 rounded-xl border border-neutral-200/90 bg-white px-3 text-xs font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                          onClick={() => setMobileCommunityFiltersOpen(true)}
                          aria-label="Browse and filter listings"
                        >
                          <svg className="h-4 w-4 shrink-0 text-brand-primary dark:text-brand-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
                          </svg>
                          <span className="max-[380px]:sr-only">Filters</span>
                          {activeBrowseFilterSummary.length > 0 ? (
                            <span className="inline-flex min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 py-[2px] text-[10px] font-bold leading-none text-white dark:bg-rose-500">
                              {activeBrowseFilterSummary.length > 99 ? "99+" : activeBrowseFilterSummary.length}
                            </span>
                          ) : null}
                        </button>
                      ) : null}
                      <ProductViewDensityToggle
                        value={activeView === VIEWS.FAVORITES ? favoriteProductsView : communityProductsView}
                        onChange={activeView === VIEWS.FAVORITES ? setFavoriteProductsView : setCommunityProductsView}
                        allowCompact={!isMobileViewport}
                        variant={isMobileViewport ? "minimal" : "default"}
                      />
                    </div>
                  </div>
                ) : null}
                {(activeView === VIEWS.FAVORITES
                  ? !(favoritesLoading && strictFavoritesList.length === 0) && !favoritesFetchError && visibleFavoritesListings.length > 0
                  : !listingsError && visibleBrowseListings.length > 0) ? (
                  <Suspense
                    fallback={
                      isMobileViewport ? (
                        <BrowseGridSkeleton
                          gridClassName={
                            activeView === VIEWS.FAVORITES
                              ? favoritesGridClass(effectiveFavoriteBrowseView)
                              : communityBrowseGridClass(effectiveCommunityBrowseView, isMobileViewport)
                          }
                          variant={
                            (activeView === VIEWS.FAVORITES ? effectiveFavoriteBrowseView : effectiveCommunityBrowseView) ===
                            "compact"
                              ? "compact"
                              : (activeView === VIEWS.FAVORITES ? effectiveFavoriteBrowseView : effectiveCommunityBrowseView) ===
                                  "list"
                                ? "list"
                                : "grid"
                          }
                          softBrowseChrome={
                            activeView === VIEWS.COMMUNITY_SHOP &&
                            effectiveCommunityBrowseView !== "list"
                          }
                          count={4}
                          className="min-h-[10rem] w-full min-w-0"
                          ariaLabel="Loading products"
                        />
                      ) : (
                        <ScreenLoading message="Loading products…" minHeight={false} className="min-h-[10rem]" />
                      )
                    }
                  >
                  <div
                    className={`${
                      activeView === VIEWS.FAVORITES
                        ? favoritesGridClass(effectiveFavoriteBrowseView)
                        : communityBrowseGridClass(effectiveCommunityBrowseView, isMobileViewport)
                    } w-full min-w-0 ${lmBrowseViewShellClass(
                      activeView === VIEWS.FAVORITES ? effectiveFavoriteBrowseView : effectiveCommunityBrowseView,
                    )}`}
                  >
                    {(activeView === VIEWS.FAVORITES ? visibleFavoritesListings : visibleBrowseListings).map((l) => (
                      <LazyCommunityShopListingCard
                        key={l.id}
                        listing={l}
                        gridMode={
                          (activeView === VIEWS.FAVORITES ? effectiveFavoriteBrowseView : effectiveCommunityBrowseView) !==
                          "list"
                        }
                        compactGrid={
                          (activeView === VIEWS.FAVORITES ? effectiveFavoriteBrowseView : effectiveCommunityBrowseView) ===
                          "compact"
                        }
                        mobileOwnerActionsInMenu={
                          isMobileViewport &&
                          activeView === VIEWS.COMMUNITY_SHOP &&
                          effectiveCommunityBrowseView !== "list"
                        }
                        disableGallerySwipe={activeView === VIEWS.COMMUNITY_SHOP}
                        softBrowseChrome={isMobileViewport && activeView === VIEWS.COMMUNITY_SHOP}
                        browseSummaryGrid={
                          isMobileViewport &&
                          (activeView === VIEWS.FAVORITES
                            ? effectiveFavoriteBrowseView === "grid"
                            : effectiveCommunityBrowseView === "grid")
                        }
                        mobileCardUx={isMobileViewport}
                        isFavorite={favoriteIds.has(l.id)}
                        showActions
                        currentUserId={user?.id || ""}
                        buyNowDisabled={buyNowBlocked}
                        buyNowDisabledReason={buyNowBlockedReason}
                        onSaleSelect={(percent) => applySellerListingDiscount(l, percent)}
                        onEdit={() => beginEditSellerListing(l)}
                        onBuy={() => openQuickAddModal(l, "buy")}
                        onAdd={() => openQuickAddModal(l, "cart")}
                        onToggleFavorite={() => toggleFavorite(l.id, !favoriteIds.has(l.id))}
                        onInspect={() => {
                          const isOwn = String(l.sellerId || "") === String(user?.id || "");
                          const stockListed = Math.max(0, Number(l.quantity) || 0);
                          openProductInspect(l, {
                            quantity: stockListed,
                            quantityLabel: "Stock listed",
                            subtitle: activeView === VIEWS.FAVORITES ? "Saved listing" : "",
                            listingStockQty: stockListed,
                            showBuyerCommerceActions: !isOwn,
                            showSellerCommerceActions: isOwn,
                            onAddToCart: isOwn
                              ? undefined
                              : () => {
                                  openQuickAddModal(l, "cart");
                                },
                            onBuyNow: isOwn
                              ? undefined
                              : () => {
                                  openQuickAddModal(l, "buy");
                                },
                            buyNowDisabled: !isOwn && buyNowBlocked,
                            buyNowDisabledReason: !isOwn ? buyNowBlockedReason : "",
                            onEditListing: isOwn
                              ? () => {
                                  beginEditSellerListing(l);
                                }
                              : undefined,
                            onSaleSelect: isOwn
                              ? (pct) => {
                                  closeProductInspect();
                                  void applySellerListingDiscount(l, pct);
                                }
                              : undefined,
                          });
                        }}
                      />
                    ))}
                  </div>
                  </Suspense>
                ) : null}
                {(activeView === VIEWS.FAVORITES
                  ? !(favoritesLoading && strictFavoritesList.length === 0) && !favoritesFetchError && visibleFavoritesListings.length === 0
                  : !listingsError && !(listingsLoading && listings.length === 0) && visibleBrowseListings.length === 0) ? (
                  <ScreenEmpty
                    title={
                      activeView === VIEWS.FAVORITES
                        ? strictFavoritesList.length === 0
                          ? "No saved listings yet"
                          : browseVerticalId == null
                            ? "No favorites match this filter"
                            : "Nothing saved in this category"
                        : shopCommunityId
                          ? browseVerticalId == null
                            ? "This community shop is empty"
                            : "No listings in this category"
                          : browseVerticalId == null
                            ? "Nothing listed yet"
                            : "No listings in this category"
                    }
                    description={
                      activeView === VIEWS.FAVORITES
                        ? strictFavoritesList.length === 0
                          ? "Tap the heart on any product to save it here for later."
                          : browseVerticalId == null
                            ? "Try switching back to All categories, or pick another filter from the shop header."
                            : "Try another category from the filter strip, or reset filters to see everything you saved."
                        : shopCommunityId
                          ? browseVerticalId == null
                            ? "Be the first to list something for neighbors, or pull to refresh if you just published."
                            : "Try another category, reset filters, or list an item that fits this community."
                          : browseVerticalId == null
                            ? "Check back soon, or open another community from Browse."
                            : "Try All categories or pick a different filter — new items appear throughout the day."
                    }
                    primaryAction={
                      activeView === VIEWS.FAVORITES && strictFavoritesList.length === 0
                        ? { label: "Browse marketplace", onClick: goBrowse }
                        : activeView === VIEWS.COMMUNITY_SHOP
                          ? { label: "Refresh listings", onClick: () => void refreshCommunityShopListings() }
                          : { label: "Browse marketplace", onClick: goBrowse }
                    }
                    secondaryAction={
                      browseVerticalId != null || browseQuickFilter !== "all"
                        ? {
                            label: "Reset filters",
                            onClick: () => {
                              setBrowseVerticalId(null);
                              setBrowseSubId(null);
                              setBrowseQuickFilter("all");
                            },
                          }
                        : activeView === VIEWS.COMMUNITY_SHOP && shopCommunityId
                          ? { label: "Browse all communities", onClick: goBrowse }
                          : undefined
                    }
                  />
                ) : null}
              </div>
            </div>
            ) : null}
          </section>
        )}

        {activeView === VIEWS.MESSAGES && (
          <section
            className={`flex min-h-[calc(100dvh-8.5rem-env(safe-area-inset-bottom,0px))] flex-col ${
              messagesMobilePane === "thread"
                ? "-mx-3 h-[calc(100dvh-8.5rem-env(safe-area-inset-bottom,0px))] space-y-0 overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none ring-0"
                : `${UI_KIT.viewSection} space-y-4`
            } md:mx-0 md:min-h-0 md:space-y-6`}
          >
            {messagesMobilePane !== "thread" ? (
              <div>
                <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Messages</h2>
              </div>
            ) : null}
            <div
              className={`grid md:h-auto md:min-h-0 md:grid-cols-[minmax(14rem,20rem)_1fr] ${
                messagesMobilePane === "thread"
                  ? "h-full min-h-0 gap-0 overflow-hidden"
                  : "h-[calc(100dvh-15rem-env(safe-area-inset-bottom,0px))] min-h-[28rem] gap-3"
              }`}
            >
              <aside
                className={`${UI_KIT.surfaceRaised} no-scrollbar h-full space-y-3 overflow-y-auto p-2 md:max-h-[70vh] ${
                  messagesMobilePane === "thread" ? "hidden md:block" : ""
                }`}
              >
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1 md:hidden dark:border-slate-700 dark:bg-slate-900/70">
                  <button
                    type="button"
                    className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                      messagesMobileListTab === "conversations"
                        ? "bg-white text-neutral-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                        : "text-neutral-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800/70"
                    }`}
                    onClick={() => setMessagesMobileListTab("conversations")}
                  >
                    Conversations
                  </button>
                  <button
                    type="button"
                    className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                      messagesMobileListTab === "people"
                        ? "bg-white text-neutral-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                        : "text-neutral-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800/70"
                    }`}
                    onClick={() => setMessagesMobileListTab("people")}
                  >
                    People
                  </button>
                </div>
                <div>
                  <p
                    className={`px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400 ${
                      messagesMobileListTab === "people" ? "hidden md:block" : ""
                    }`}
                  >
                    Conversations
                  </p>
                  <div className={messagesMobileListTab === "people" ? "hidden md:block" : ""}>
                  {sortedChatThreads.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-neutral-600 dark:text-slate-400">No chats yet. Start one from People below.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {sortedChatThreads.map((thread) => {
                        const participant = usersById.get(String(thread.participantId || ""));
                        const latest = Array.isArray(thread.messages) && thread.messages.length > 0 ? thread.messages[thread.messages.length - 1] : null;
                        const selected = String(activeChatUserId) === String(thread.participantId);
                        return (
                          <li key={thread.participantId}>
                            <button
                              type="button"
                              className={`flex w-full min-w-0 items-center justify-between rounded-lg px-3 py-2 text-left transition ${
                                selected
                                  ? "bg-brand-soft text-brand-primary dark:bg-slate-800/80 dark:text-slate-100"
                                  : "hover:bg-neutral-100 dark:hover:bg-slate-800"
                              }`}
                              aria-current={selected ? "true" : undefined}
                              onClick={() => openChatThread(thread.participantId)}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-neutral-900 dark:text-slate-100">
                                  {formatDisplayName(participant?.name || participant?.username || "Member")}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-neutral-500 dark:text-slate-400">
                                  {communityLabelForUser(participant)}
                                  {latest?.text ? ` · ${latest.text}` : " · No messages yet"}
                                </span>
                              </span>
                              {thread.unread > 0 ? (
                                <span className="ml-2 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-brand-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  {thread.unread > 99 ? "99+" : thread.unread}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  </div>
                </div>
                <div
                  className={`border-t border-neutral-200/90 pt-2 dark:border-slate-700/80 ${
                    messagesMobileListTab === "conversations" ? "hidden md:block" : ""
                  }`}
                >
                  <div className="space-y-2 px-2 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">People</p>
                      <span className="text-[11px] text-neutral-500 dark:text-slate-400">
                        {filteredMessagePeople.length} result{filteredMessagePeople.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <input
                      type="search"
                      inputMode="search"
                      enterKeyHint="search"
                      autoComplete="off"
                      value={messagePeopleSearch}
                      onChange={(e) => setMessagePeopleSearch(e.target.value)}
                      className="input-base h-9 w-full text-xs"
                      placeholder="Search name, username, or community"
                      aria-label="Search people"
                    />
                    <div className="grid grid-cols-1 gap-1.5">
                      <select
                        value={messagePeopleCommunityFilter}
                        onChange={(e) => setMessagePeopleCommunityFilter(e.target.value)}
                        className="input-base h-9 w-full text-xs"
                        aria-label="Filter by community"
                      >
                        <option value="all">All communities</option>
                        <option value="none">No community set</option>
                        {messageCommunityFilterOptions.map((name) => (
                          <option key={`community-filter-${name}`} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={messagePeopleSort}
                        onChange={(e) => setMessagePeopleSort(e.target.value)}
                        className="input-base h-9 w-full text-xs"
                        aria-label="Sort people"
                      >
                        <option value="name_asc">Sort: Name A-Z</option>
                        <option value="name_desc">Sort: Name Z-A</option>
                        <option value="joined_desc">Sort: Newest joined</option>
                        <option value="joined_asc">Sort: Oldest joined</option>
                      </select>
                    </div>
                  </div>
                  {usersLoading && usersList.length === 0 ? (
                    <div className="px-2 py-2">
                      <ScreenLoading message="Loading people…" minHeight={false} className="min-h-[7rem] py-6" />
                    </div>
                  ) : null}
                  {usersError ? (
                    <div className="px-2 pb-2">
                      <ScreenError
                        title="Couldn’t load people"
                        message={usersError}
                        onRetry={() => void reloadUsersList()}
                        secondaryAction={{ label: "Dismiss", onClick: () => setUsersError("") }}
                        spacious
                      />
                    </div>
                  ) : null}
                  {!usersError ? (
                    <ul className="space-y-1">
                      {filteredMessagePeople.map((u) => (
                          <li key={`messages-user-${u.id}`}>
                            <button
                              type="button"
                              className="flex w-full min-w-0 items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-neutral-100 dark:hover:bg-slate-800"
                              onClick={() => openChatWithUser(u.id)}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-neutral-900 dark:text-slate-100">
                                  {formatDisplayName(u.name || u.username || "Member")}
                                </span>
                                <span className="block truncate text-[11px] text-neutral-500 dark:text-slate-400">
                                  {communityLabelForUser(u)}
                                  {u.joinedAt ? ` · Joined ${new Date(u.joinedAt).toLocaleDateString()}` : ""}
                                </span>
                              </span>
                              <span className="shrink-0 rounded-md border border-brand-primary/35 px-2 py-1 text-[11px] font-semibold text-brand-primary dark:border-brand-primary/45">
                                Chat
                              </span>
                            </button>
                          </li>
                        ))}
                      {!(usersLoading && usersList.length === 0) && filteredMessagePeople.length === 0 ? (
                        <li className="px-2 py-2 text-xs text-neutral-500 dark:text-slate-400">
                          No people match your search/filter.
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
              </aside>
              <div
                className={`${UI_KIT.surfaceRaised} min-h-[24rem] flex-col ${
                  messagesMobilePane === "list"
                    ? "hidden md:flex"
                    : "grid h-[calc(100dvh-8.5rem-env(safe-area-inset-bottom,0px))] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-none border-x-0 border-b-0 shadow-none ring-0 md:flex md:h-full md:rounded-2xl md:border md:shadow-sm md:ring-1"
                } h-full`}
              >
                {!activeChatThread ? (
                  <div className="flex flex-1 items-center justify-center p-4 md:p-6">
                    <ScreenEmpty
                      title="No conversation selected"
                      description="Choose someone under Conversations or People to start messaging."
                      primaryAction={
                        messagesMobilePane === "thread"
                          ? { label: "Back to list", onClick: () => setMessagesMobilePane("list") }
                          : undefined
                      }
                    />
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 border-b border-neutral-200 px-4 py-2 dark:border-slate-700 md:py-3">
                      <button
                        type="button"
                        className="inline-flex max-w-full items-center gap-1 text-xs font-semibold text-brand-primary md:hidden"
                        onClick={() => setMessagesMobilePane("list")}
                      >
                        <span aria-hidden>←</span>
                        <span className="truncate">Back to chats</span>
                      </button>
                      <p className="break-words text-sm font-semibold text-neutral-900 dark:text-slate-100">
                        {formatDisplayName(activeChatUser?.name || activeChatUser?.username || "Member")}
                      </p>
                      <p className="mt-0.5 line-clamp-2 break-words text-xs text-neutral-500 dark:text-slate-400">
                        {communityLabelForUser(activeChatUser)}
                      </p>
                    </div>
                    <div
                      ref={chatThreadViewportRef}
                      className="min-h-0 overflow-x-hidden overflow-y-auto p-4 md:flex-1"
                    >
                      {activeChatThread.messages.length === 0 ? (
                        <p className="text-sm text-neutral-500 dark:text-slate-400">No messages yet. Send the first one.</p>
                      ) : (
                        activeChatThread.messages.map((m) => {
                          const mine = String(m.senderId) === String(user?.id || "");
                          return (
                            <div key={m.id} className={`mt-2 flex ${mine ? "justify-end" : "justify-start"}`}>
                              <div
                                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                                  mine
                                    ? "bg-brand-primary text-white"
                                    : "bg-neutral-100 text-neutral-900 dark:bg-slate-800 dark:text-slate-100"
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                                <p className={`mt-1 text-[10px] ${mine ? "text-white/80" : "text-neutral-500 dark:text-slate-400"}`}>
                                  {new Date(m.createdAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div
                      className={`border-t border-neutral-200 p-3 dark:border-slate-700 ${
                        messagesMobilePane === "thread"
                          ? "mb-4 bg-white/95 backdrop-blur md:mb-0 md:bg-transparent md:backdrop-blur-0"
                          : ""
                      }`}
                    >
                      <div className="flex min-w-0 gap-2">
                        <input
                          ref={chatComposerInputRef}
                          type="text"
                          value={chatComposer}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            const key = String(activeChatUserId || "").trim();
                            setChatComposer(nextValue);
                            if (key) {
                              setChatDraftByUserId((prev) => ({ ...prev, [key]: nextValue }));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              sendChatMessage();
                            }
                          }}
                          placeholder={`Message ${formatDisplayName(activeChatUser?.name || activeChatUser?.username || "member")}...`}
                          className="input-base h-11 min-w-0 flex-1"
                        />
                        <Button
                          type="button"
                          variant="primary"
                          className="h-11 min-h-11 shrink-0 px-4"
                          onClick={sendChatMessage}
                          loading={chatSendPending}
                          loadingLabel="Sending…"
                        >
                          Send
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {activeView === VIEWS.NOTIFICATIONS && (
          <section className={`${UI_KIT.viewSection} space-y-4 md:space-y-6`}>
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-2xl font-semibold text-neutral-900 dark:text-slate-100">Notifications</h2>
                {notificationsSyncError ? (
                  <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400/90" role="status">
                    {notificationsSyncError}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-neutral-300/80 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => void markAllNotificationsRead()}
                  disabled={unreadNotificationCount === 0}
                >
                  Mark all read
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-neutral-300/80 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => void clearNotificationInbox()}
                  disabled={notificationInbox.length === 0}
                >
                  Clear all
                </button>
              </div>
            </div>
            {notificationInbox.length === 0 ? (
              <ScreenEmpty
                title="You’re all caught up"
                description="Order updates, delivery status, and marketplace alerts from your session will land here."
                primaryAction={{ label: "Browse marketplace", onClick: goBrowse }}
              />
            ) : (
              <div className="space-y-2.5">
                {notificationInbox.map((item) => {
                  const createdLabel = new Date(item.createdAt).toLocaleString();
                  return (
                    <article
                      key={item.id}
                      className={`${UI_KIT.surfaceRaised} flex items-start justify-between gap-3 p-3 md:p-3.5 ${
                        item.read ? "opacity-80" : ""
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium leading-relaxed text-neutral-800 dark:text-slate-100">{item.text}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500 dark:text-slate-400">
                          <span className="rounded-full border border-neutral-300/80 px-2 py-0.5 uppercase tracking-wide dark:border-slate-600">
                            {item.type}
                          </span>
                          <span>{createdLabel}</span>
                          {!item.read ? (
                            <span className="rounded-full bg-brand-primary/15 px-2 py-0.5 font-semibold text-brand-primary">Unread</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {!item.read ? (
                          <button
                            type="button"
                            className="rounded-md border border-neutral-300/80 px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                            onClick={() => markNotificationRead(item.id)}
                          >
                            Mark read
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded-md border border-neutral-300/80 px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                          onClick={() => dismissNotification(item.id)}
                        >
                          Dismiss
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeView === VIEWS.FAVORITES && (
          <section className={`${UI_KIT.viewSection} space-y-4 md:space-y-6`}>
            {!(favoritesLoading && strictFavoritesList.length === 0) &&
            !favoritesFetchError &&
            strictFavoritesList.length === 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Favorites</h2>
                </div>
                <div className="w-full min-w-0">
                  <div
                    className={`${UI_KIT.surfaceRaised} flex w-full min-w-0 flex-col items-center border border-dashed px-4 py-10 text-center md:px-6 md:py-12`}
                  >
                    <p className="w-full min-w-0 text-balance text-lg font-semibold text-neutral-900 dark:text-slate-100 min-[400px]:text-xl md:text-xl">
                      No favorites yet
                    </p>
                    <p className="mt-2 w-full min-w-0 text-pretty text-sm leading-relaxed text-neutral-600 dark:text-slate-400 min-[400px]:text-[15px]">
                      Use the heart on Browse cards to save items.
                    </p>
                    <button
                      type="button"
                      className="btn-primary mt-6 w-full touch-manipulation min-h-[44px] text-sm md:mt-8 md:min-h-12 md:w-auto md:min-w-[10rem]"
                      onClick={() => goBrowse()}
                    >
                      Browse marketplace
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Favorites</h2>
                {favoritesLoading && strictFavoritesList.length === 0 ? (
                  isMobileViewport ? (
                    <BrowseGridSkeleton
                      gridClassName={favoritesGridClass(effectiveFavoriteBrowseView)}
                      variant={
                        effectiveFavoriteBrowseView === "compact"
                          ? "compact"
                          : effectiveFavoriteBrowseView === "list"
                            ? "list"
                            : "grid"
                      }
                      count={effectiveFavoriteBrowseView === "compact" ? 8 : 6}
                      className="min-h-[8rem]"
                      ariaLabel="Loading favorites"
                    />
                  ) : (
                    <ScreenLoading message="Loading favorites…" minHeight={false} className="min-h-[8rem]" />
                  )
                ) : null}
                {favoritesFetchError ? (
                  <ScreenError
                    title="Couldn’t load favorites"
                    message={favoritesFetchError}
                    onRetry={() => void refreshFavorites()}
                    secondaryAction={{ label: "Browse marketplace", onClick: goBrowse }}
                    spacious
                  />
                ) : null}
            {strictFavoritesList.length > 0 ? (
              <>
                <div className="flex justify-end">
                  <ProductViewDensityToggle
                    value={favoriteProductsView}
                    onChange={setFavoriteProductsView}
                    allowCompact={!isMobileViewport}
                    variant={isMobileViewport ? "minimal" : "default"}
                  />
                </div>
                <Suspense
                  fallback={
                    isMobileViewport ? (
                      <BrowseGridSkeleton
                        gridClassName={favoritesGridClass(effectiveFavoriteBrowseView)}
                        variant={
                          effectiveFavoriteBrowseView === "compact"
                            ? "compact"
                            : effectiveFavoriteBrowseView === "list"
                              ? "list"
                              : "grid"
                        }
                        count={4}
                        className="min-h-[10rem]"
                        ariaLabel="Loading favorites"
                      />
                    ) : (
                      <ScreenLoading message="Loading favorites…" minHeight={false} className="min-h-[10rem]" />
                    )
                  }
                >
                <div
                  className={`${favoritesGridClass(effectiveFavoriteBrowseView)} ${lmBrowseViewShellClass(effectiveFavoriteBrowseView)}`}
                >
                  {strictFavoritesList.map((l) => (
                    <LazyCommunityShopListingCard
                      key={l.id}
                      listing={l}
                      unseenAttention={!favoriteSeenSet.has(String(l.id))}
                      gridMode={effectiveFavoriteBrowseView !== "list"}
                      compactGrid={effectiveFavoriteBrowseView === "compact"}
                      browseSummaryGrid={isMobileViewport && effectiveFavoriteBrowseView === "grid"}
                      mobileCardUx={isMobileViewport}
                      isFavorite={favoriteIds.has(l.id)}
                      showActions
                      currentUserId={user?.id || ""}
                      buyNowDisabled={buyNowBlocked}
                      buyNowDisabledReason={buyNowBlockedReason}
                      onSaleSelect={(percent) => applySellerListingDiscount(l, percent)}
                      onEdit={() => beginEditSellerListing(l)}
                      onBuy={() => openQuickAddModal(l, "buy")}
                      onAdd={() => openQuickAddModal(l, "cart")}
                      onToggleFavorite={() => toggleFavorite(l.id, !favoriteIds.has(l.id))}
                      onInspect={() => {
                        const isOwn = String(l.sellerId || "") === String(user?.id || "");
                        const stockListed = Math.max(0, Number(l.quantity) || 0);
                        openProductInspect(l, {
                          quantity: stockListed,
                          quantityLabel: "Stock listed",
                          subtitle: "Saved listing",
                          listingStockQty: stockListed,
                          showBuyerCommerceActions: !isOwn,
                          showSellerCommerceActions: isOwn,
                          onAddToCart: isOwn
                            ? undefined
                            : () => {
                                openQuickAddModal(l, "cart");
                              },
                          onBuyNow: isOwn
                            ? undefined
                            : () => {
                                openQuickAddModal(l, "buy");
                              },
                          buyNowDisabled: !isOwn && buyNowBlocked,
                          buyNowDisabledReason: !isOwn ? buyNowBlockedReason : "",
                          onEditListing: isOwn
                            ? () => {
                                beginEditSellerListing(l);
                              }
                            : undefined,
                          onSaleSelect: isOwn
                            ? (pct) => {
                                closeProductInspect();
                                void applySellerListingDiscount(l, pct);
                              }
                            : undefined,
                        });
                      }}
                    />
                  ))}
                </div>
                </Suspense>
              </>
            ) : null}
              </>
            )}
          </section>
        )}

        {(activeView === VIEWS.MY_LISTINGS || listingEditOverlayOpen) && (
          <section
            className={
              listingEditOverlayOpen
                ? "fixed inset-0 z-[130] h-[100dvh] overflow-y-auto bg-white px-4 pt-0 pb-[max(1rem,env(safe-area-inset-bottom))] dark:bg-slate-950 md:px-4 md:pb-[max(1rem,env(safe-area-inset-bottom))]"
                : "w-full min-w-0 max-w-none space-y-6 md:space-y-8"
            }
          >
            {listingEditOverlayOpen ? (
              <div className="sticky top-0 z-[40] -mx-4 mb-0 flex items-center gap-2.5 border-b border-neutral-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-950">
                <button
                  type="button"
                  className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-neutral-700 transition hover:text-neutral-900 dark:text-slate-200 dark:hover:text-slate-50 md:h-9 md:min-h-0 md:min-w-0 md:w-9"
                  aria-label="Back"
                  onClick={() => {
                    if (listingSaving) return;
                    setListingEditOverlayOpen(false);
                    const origin = productFlowOriginRef.current || {};
                    const originView = String(origin.view || "");
                    if ([VIEWS.BROWSE, VIEWS.COMMUNITY_SHOP, VIEWS.FAVORITES].includes(originView)) {
                      setActiveView(originView);
                    }
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-7 w-7"
                    aria-hidden
                  >
                    <path d="M19 12H5" />
                    <path d="M11 6l-6 6 6 6" />
                  </svg>
                </button>
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
                  Edit
                </h2>
              </div>
            ) : null}
            <div className={listingEditOverlayOpen ? "w-full bg-white dark:bg-slate-950" : ""}>
            {listingPublishError ? (
              <ScreenError
                title="Couldn’t save your listing"
                message={listingPublishError}
                onRetry={() => {
                  setListingPublishError("");
                  const form = document.getElementById("listing-upload-form");
                  if (form && typeof form.requestSubmit === "function") form.requestSubmit();
                }}
                retryLabel="Try again"
                secondaryAction={{
                  label: "Dismiss",
                  onClick: () => setListingPublishError(""),
                }}
                spacious={false}
              />
            ) : null}
            <form
              id="listing-upload-form"
              noValidate
              onSubmit={handleCreateListing}
              aria-busy={listingSaving || undefined}
              className="grid w-full min-w-0 max-w-none gap-5 md:grid-cols-2 md:gap-4"
            >
              <div id="listing-section-photos" className="md:col-span-2">
                <div className="mb-2">
                  {!listingEditOverlayOpen ? (
                    <button
                      type="button"
                      className="z-10 inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center text-neutral-700 transition hover:text-neutral-900 dark:text-slate-200 dark:hover:text-slate-50 md:h-9 md:min-h-0 md:min-w-0 md:w-9"
                      aria-label="Back"
                      onClick={() => {
                        if (listingSaving) return;
                        setActiveView(VIEWS.PROFILE);
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-7 w-7"
                        aria-hidden
                      >
                        <path d="M19 12H5" />
                        <path d="M11 6l-6 6 6 6" />
                      </svg>
                    </button>
                  ) : null}
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-primary dark:text-brand-accent">
                    Photos *
                  </p>
                </div>
                <div
                  className={`rounded-xl border border-dashed bg-white/80 transition dark:bg-slate-900/60 ${
                    listingImageDragActive
                      ? "border-brand-primary text-brand-primary dark:border-brand-accent dark:text-brand-accent"
                      : listingFieldErrors.image
                        ? "border-rose-400 text-neutral-500 dark:border-rose-500 dark:text-slate-400"
                        : "border-neutral-300 text-neutral-500 dark:border-slate-600 dark:text-slate-400"
                  } ${listingImagePreviewUrl ? "p-3 md:p-4" : "flex min-h-[9.5rem] cursor-pointer items-center justify-center px-4 py-5 text-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-offset-2 dark:focus-visible:ring-brand-accent/40 dark:focus-visible:ring-offset-slate-900"}`}
                  role={listingImagePreviewUrl ? undefined : "button"}
                  tabIndex={listingImagePreviewUrl ? undefined : 0}
                  aria-label={listingImagePreviewUrl ? undefined : "Upload listing photo"}
                  onClick={
                    listingImagePreviewUrl
                      ? undefined
                      : () => {
                          listingImageInputRef.current?.click();
                        }
                  }
                  onKeyDown={
                    listingImagePreviewUrl
                      ? undefined
                      : (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            listingImageInputRef.current?.click();
                          }
                        }
                  }
                  onDragOver={(e) => {
                    e.preventDefault();
                    setListingImageDragActive(true);
                  }}
                  onDragLeave={() => setListingImageDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setListingImageDragActive(false);
                    const files = Array.from(e.dataTransfer?.files || []);
                    if (files.length) addListingImages(files);
                  }}
                >
                  <input
                    ref={listingImageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length) addListingImages(files);
                      e.target.value = "";
                    }}
                  />
                  {listingImagePreviewUrl ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="flex flex-col items-start gap-1.5">
                          <div className="group relative h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-neutral-200/85 transition hover:border-primary/45 md:h-36 md:w-36 dark:border-slate-600 dark:hover:border-brand-accent/45">
                            <button
                              type="button"
                              className="absolute inset-0 block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/45 dark:focus-visible:ring-brand-accent/45"
                              aria-label="Cover photo options"
                              onClick={() => setListingPhotoActionModal({ open: true, variant: "cover", extraId: "" })}
                            >
                              <StableMediaImage
                                src={listingImagePreviewUrl}
                                alt=""
                                className="absolute inset-0 h-full w-full"
                                decoding="async"
                                sizes="144px"
                                loading="eager"
                              />
                              <span className="pointer-events-none absolute left-2 top-2 z-[4] rounded-full bg-brand-primary/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-brand-accent/80">Cover photo</span>
                            </button>
                            <button
                              type="button"
                              className="absolute right-1.5 top-1.5 z-[5] inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-xs font-semibold text-white transition hover:bg-rose-600"
                              aria-label="Remove cover image"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (listingExtraImages.length > 0) {
                                  const [nextCover, ...rest] = listingExtraImages;
                                  setListingImageFile(nextCover.file || null);
                                  setListingImagePreviewUrl(nextCover.previewUrl);
                                  setListingCoverContentHash(String(nextCover.contentHash || ""));
                                  setListingExtraImages(rest);
                                  return;
                                }
                                setListingImageFile(null);
                                setListingCoverContentHash("");
                                if (listingImagePreviewUrl && listingImagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(listingImagePreviewUrl);
                                setListingImagePreviewUrl("");
                                if (listingImageInputRef.current) listingImageInputRef.current.value = "";
                              }}
                            >
                              ×
                            </button>
                          </div>
                          <p className="text-xs font-medium text-neutral-600 dark:text-slate-300">
                            {(listingImageFile ? 1 : 0) + listingExtraImages.length}/{LISTING_MAX_IMAGES} images
                          </p>
                        </div>
                        {listingExtraImages.map((item) => (
                          <div key={item.id} className="group relative h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-neutral-200/85 transition hover:border-primary/45 md:h-36 md:w-36 dark:border-slate-600 dark:hover:border-brand-accent/45">
                            <button
                              type="button"
                              className="absolute inset-0 block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/45 dark:focus-visible:ring-brand-accent/45"
                              aria-label="Photo options"
                              onClick={() => setListingPhotoActionModal({ open: true, variant: "extra", extraId: item.id })}
                            >
                              <StableMediaImage
                                src={item.previewUrl}
                                alt=""
                                className="absolute inset-0 h-full w-full"
                                decoding="async"
                                sizes="144px"
                                loading="eager"
                              />
                            </button>
                            <button
                              type="button"
                              className="absolute right-1.5 top-1.5 z-[5] inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-xs font-semibold text-white transition hover:bg-rose-600"
                              aria-label="Remove image"
                              onClick={(e) => {
                                e.stopPropagation();
                                setListingExtraImages((prev) => {
                                  const target = prev.find((x) => x.id === item.id);
                                  if (target?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(target.previewUrl);
                                  return prev.filter((x) => x.id !== item.id);
                                });
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {(listingImageFile ? 1 : 0) + listingExtraImages.length < LISTING_MAX_IMAGES ? (
                          <button
                            type="button"
                            className="group relative inline-flex h-32 w-32 shrink-0 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white/60 text-center text-xs font-semibold text-neutral-500 transition hover:border-brand-primary/50 hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-brand-accent/45 dark:hover:text-slate-100 dark:focus-visible:ring-brand-accent/50 md:h-36 md:w-36"
                            onClick={() => listingImageInputRef.current?.click()}
                          >
                            <span className="pointer-events-none flex flex-col items-center gap-1">
                              <span aria-hidden className="text-base leading-none">+</span>
                              <span>Add image</span>
                            </span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="flex w-full max-w-lg flex-col items-center px-2 text-center md:max-w-xl">
                      <button
                        type="button"
                        className="group relative inline-flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white/60 text-center text-xs font-semibold text-neutral-500 transition hover:border-brand-primary/50 hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-brand-accent/45 dark:hover:text-slate-100 dark:focus-visible:ring-brand-accent/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          listingImageInputRef.current?.click();
                        }}
                      >
                        <span className="pointer-events-none flex flex-col items-center gap-1">
                          <span aria-hidden className="text-base leading-none">+</span>
                          <span>Add image</span>
                        </span>
                      </button>
                    </div>
                  )}
                </div>
                {listingFieldErrors.image ? (
                  <p className="field-error-text mt-1" role="alert">
                    {listingFieldErrors.image}
                  </p>
                ) : null}
                {listingPhotoActionModal.open ? (
                  <div className="fixed inset-0 z-[119] flex items-center justify-center p-4">
                    <button
                      type="button"
                      className="absolute inset-0 bg-black/50"
                      aria-label="Close photo options"
                      onClick={() => closeListingPhotoActionModal()}
                    />
                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="listing-photo-options-title"
                      className="relative z-10 w-full max-w-mobile-baseline rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:max-w-md md:p-6"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 pr-2">
                          <h2
                            id="listing-photo-options-title"
                            className="text-base font-semibold leading-snug text-neutral-900 dark:text-slate-100"
                          >
                            Photo options
                          </h2>
                          <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-slate-400">
                            {listingPhotoActionModal.variant === "extra"
                              ? "Crop, use as cover, or pick a new file from your device."
                              : "Crop the cover image or replace it with a new photo."}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn-icon-only inline-flex shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 md:!h-9 md:!min-h-9 md:!w-9 md:!max-w-9"
                          aria-label="Close photo options"
                          onClick={() => closeListingPhotoActionModal()}
                        >
                          <span aria-hidden className="text-lg leading-none">
                            ×
                          </span>
                        </button>
                      </div>
                      <div className="-mx-5 mt-5 md:-mx-6">
                        <div className="relative aspect-video w-full overflow-hidden bg-neutral-100 ring-1 ring-inset ring-neutral-200/90 dark:bg-slate-800/80 dark:ring-slate-600">
                          <StableMediaImage
                            src={
                              listingPhotoActionModal.variant === "cover"
                                ? listingImagePreviewUrl
                                : String(
                                    listingExtraImages.find((x) => String(x.id) === String(listingPhotoActionModal.extraId))?.previewUrl || "",
                                  ).trim()
                            }
                            alt=""
                            className="absolute inset-0 h-full w-full"
                            loading="eager"
                            sizes="100vw"
                          />
                        </div>
                      </div>
                      <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-slate-700">
                        <div className="flex flex-col gap-2 md:flex-row md:justify-end md:gap-2">
                          <button
                            type="button"
                            className="btn-primary w-full md:min-w-[10.5rem] md:flex-initial md:order-2"
                            onClick={() => {
                              const variant = listingPhotoActionModal.variant;
                              const extraId = listingPhotoActionModal.extraId;
                              closeListingPhotoActionModal();
                              if (variant === "cover") void openListingCropEditorForCover();
                              else void openListingCropEditorForExtra(extraId);
                            }}
                          >
                            Crop
                          </button>
                          {listingPhotoActionModal.variant === "extra" ? (
                            <button
                              type="button"
                              className="btn-secondary w-full md:min-w-[10.5rem] md:flex-initial md:order-1"
                              onClick={() => promoteListingExtraToCover(listingPhotoActionModal.extraId)}
                            >
                              Set as cover
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-secondary w-full md:min-w-[10.5rem] md:flex-initial md:order-1"
                              onClick={() => {
                                closeListingPhotoActionModal();
                                listingImageInputRef.current?.click();
                              }}
                            >
                              Replace photo
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                {listingCropEditor.open ? (
                  <div className="fixed inset-0 z-[118] flex items-center justify-center p-4">
                    <button
                      type="button"
                      className="absolute inset-0 bg-black/50"
                      aria-label="Close crop editor"
                      onClick={() => closeListingCropEditor()}
                    />
                    <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary dark:text-brand-accent">Crop image</p>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">Move and resize the square crop before uploading.</p>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 text-sm text-neutral-600 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                          aria-label="Close crop editor"
                          onClick={() => closeListingCropEditor()}
                        >
                          ×
                        </button>
                      </div>
                      <div className="mt-4">
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-primary dark:text-brand-accent">Adjust crop</p>
                          <div
                            ref={listingCropViewportRef}
                            className="relative aspect-square w-full overflow-hidden rounded-xl border border-neutral-200 bg-black/90 touch-none dark:border-slate-700"
                            onPointerDown={(e) => {
                              if (!listingCropEditor.open) return;
                              setListingCropApplyError("");
                              e.currentTarget.setPointerCapture(e.pointerId);
                              setListingCropEditor((prev) => ({
                                ...prev,
                                dragging: true,
                                dragStartX: e.clientX,
                                dragStartY: e.clientY,
                                dragStartLeft: prev.cropLeft,
                                dragStartTop: prev.cropTop,
                              }));
                            }}
                            onPointerMove={(e) => {
                              if (!listingCropEditor.dragging) return;
                              const viewportSize = Number(listingCropViewportRef.current?.clientWidth || 1);
                              const dx = e.clientX - listingCropEditor.dragStartX;
                              const dy = e.clientY - listingCropEditor.dragStartY;
                              setListingCropEditor((prev) => ({
                                ...prev,
                                cropLeft: (() => {
                                  const w = Math.max(1, Number(prev.sourceWidth || 1));
                                  const h = Math.max(1, Number(prev.sourceHeight || 1));
                                  const renderedWidthFactor = w >= h ? 1 : w / h;
                                  const side = Math.max(1, Math.floor(Math.min(w, h) * clampNumber(prev.cropSize, 0.2, 1)));
                                  const maxLeft = Math.max(0, (w - side) / w);
                                  const next = prev.dragStartLeft + (dx / viewportSize) / renderedWidthFactor;
                                  return clampNumber(next, 0, maxLeft);
                                })(),
                                cropTop: (() => {
                                  const w = Math.max(1, Number(prev.sourceWidth || 1));
                                  const h = Math.max(1, Number(prev.sourceHeight || 1));
                                  const renderedHeightFactor = h >= w ? 1 : h / w;
                                  const side = Math.max(1, Math.floor(Math.min(w, h) * clampNumber(prev.cropSize, 0.2, 1)));
                                  const maxTop = Math.max(0, (h - side) / h);
                                  const next = prev.dragStartTop + (dy / viewportSize) / renderedHeightFactor;
                                  return clampNumber(next, 0, maxTop);
                                })(),
                              }));
                            }}
                            onPointerUp={(e) => {
                              if (listingCropEditor.dragging) {
                                try {
                                  e.currentTarget.releasePointerCapture(e.pointerId);
                                } catch {
                                  // noop
                                }
                              }
                              setListingCropEditor((prev) => ({ ...prev, dragging: false }));
                            }}
                            onPointerCancel={() => setListingCropEditor((prev) => ({ ...prev, dragging: false }))}
                          >
                            {listingCropEditor.sourcePreviewUrl ? (
                              <img
                                src={listingCropEditor.sourcePreviewUrl}
                                alt=""
                                className="h-full w-full object-contain"
                                draggable={false}
                              />
                            ) : null}
                            {(() => {
                              const w = Math.max(1, Number(listingCropEditor.sourceWidth || 1));
                              const h = Math.max(1, Number(listingCropEditor.sourceHeight || 1));
                              const renderW = w >= h ? 100 : (w / h) * 100;
                              const renderH = h >= w ? 100 : (h / w) * 100;
                              const offsetX = (100 - renderW) / 2;
                              const offsetY = (100 - renderH) / 2;
                              const side = Math.max(1, Math.floor(Math.min(w, h) * clampNumber(listingCropEditor.cropSize, 0.2, 1)));
                              const cropWPercent = (side / w) * renderW;
                              const cropHPercent = (side / h) * renderH;
                              const leftPercent = offsetX + clampNumber(listingCropEditor.cropLeft, 0, 1) * renderW;
                              const topPercent = offsetY + clampNumber(listingCropEditor.cropTop, 0, 1) * renderH;
                              return (
                                <div
                                  className="pointer-events-none absolute border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                                  style={{
                                    left: `${leftPercent}%`,
                                    top: `${topPercent}%`,
                                    width: `${cropWPercent}%`,
                                    height: `${cropHPercent}%`,
                                  }}
                                />
                              );
                            })()}
                          </div>
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-[11px] font-medium text-neutral-600 dark:text-slate-400">
                              <span>Crop size</span>
                              <span>{Math.round(clampNumber(Number(listingCropEditor.cropSize) || 1, 0.2, 1) * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min={20}
                              max={100}
                              step={1}
                              className="mt-1 w-full"
                              value={Math.round(clampNumber(Number(listingCropEditor.cropSize) || 1, 0.2, 1) * 100)}
                              onChange={(e) => {
                                setListingCropApplyError("");
                                setListingCropEditor((prev) => {
                                  const w = Math.max(1, Number(prev.sourceWidth || 1));
                                  const h = Math.max(1, Number(prev.sourceHeight || 1));
                                  const nextCropSize = clampNumber((Number(e.target.value) || 80) / 100, 0.2, 1);
                                  const side = Math.max(1, Math.floor(Math.min(w, h) * nextCropSize));
                                  const maxLeft = Math.max(0, (w - side) / w);
                                  const maxTop = Math.max(0, (h - side) / h);
                                  return {
                                    ...prev,
                                    cropSize: nextCropSize,
                                    cropLeft: clampNumber(prev.cropLeft, 0, maxLeft),
                                    cropTop: clampNumber(prev.cropTop, 0, maxTop),
                                  };
                                });
                              }}
                            />
                            <p className="mt-1 text-[11px] text-neutral-500 dark:text-slate-400">Drag the square to reposition the crop area.</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col items-stretch gap-2">
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" className="btn-secondary" onClick={() => closeListingCropEditor()}>
                            Cancel
                          </button>
                          <button type="button" className="btn-primary" onClick={() => void applyListingCropEditor()}>
                            Apply crop
                          </button>
                        </div>
                        {listingCropApplyError ? (
                          <p className="field-error-text text-right" role="alert">
                            {listingCropApplyError}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div id="listing-section-details" className="md:col-span-2">
                <label htmlFor="listing-title" className="label-base">
                  Listing title *
                </label>
                <input
                  id="listing-title"
                  name="title"
                  className={`input-base w-full ${listingFieldErrors.title ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-500/70 dark:focus:ring-rose-500/30" : ""}`}
                  type="text"
                  enterKeyHint="next"
                  autoComplete="off"
                  value={listingForm.title}
                  placeholder="Item name"
                  onChange={(e) => {
                    setListingForm((p) => ({ ...p, title: e.target.value }));
                    if (listingFieldErrors.title) setListingFieldErrors((prev) => ({ ...prev, title: "" }));
                  }}
                  minLength={2}
                  aria-invalid={listingFieldErrors.title ? true : undefined}
                  aria-describedby={listingFieldErrors.title ? "listing-title-error" : undefined}
                />
                {listingFieldErrors.title ? (
                  <p id="listing-title-error" className="field-error-text mt-1" role="alert">
                    {listingFieldErrors.title}
                  </p>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <ListingCategoryPicker
                  value={listingForm.categories}
                  invalid={Boolean(listingFieldErrors.categories)}
                  onChange={(id) => {
                    setListingForm((p) => ({ ...p, categories: id, subId: "all" }));
                    if (listingFieldErrors.categories) setListingFieldErrors((prev) => ({ ...prev, categories: "" }));
                  }}
                />
                {listingFieldErrors.categories ? (
                  <p className="field-error-text mt-1" role="alert">
                    {listingFieldErrors.categories}
                  </p>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <label htmlFor="listing-description" className="label-base">
                  Description (optional)
                </label>
                <textarea
                  id="listing-description"
                  name="description"
                  className="input-base min-h-[5rem] w-full"
                  enterKeyHint="done"
                  value={listingForm.description}
                  placeholder="Details"
                  onChange={(e) => setListingForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  maxLength={2000}
                />
                <p className="mt-1 text-right text-[11px] text-neutral-500 dark:text-slate-400">{listingDescriptionCount}/2000</p>
              </div>
              <div className="md:col-span-2 mt-2 border-t border-neutral-200/65 pt-4 divide-y divide-neutral-200/65 dark:border-slate-700 dark:divide-slate-700">
                <div id="listing-section-pricing" className="grid grid-cols-1 gap-4 py-5 md:grid-cols-2 md:py-4">
                  <div className="min-w-0">
                  <label htmlFor="listing-price-pesos" className="label-base">
                    Price (PHP) *
                  </label>
                  <div
                    className={`flex min-w-0 overflow-hidden rounded-xl border bg-white transition dark:bg-slate-950 ${
                      listingFieldErrors.pricePesos
                        ? "border-rose-400 focus-within:border-rose-500 focus-within:ring-1 focus-within:ring-rose-200 dark:border-rose-500/70 dark:focus-within:ring-rose-500/30"
                        : "border-neutral-200/95 focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary/30 dark:border-slate-600 dark:focus-within:border-brand-primary dark:focus-within:ring-brand-primary/28"
                    }`}
                  >
                    <span
                      className="flex shrink-0 select-none items-center border-r border-neutral-200 bg-neutral-50 px-3 text-xs font-semibold tracking-wide text-neutral-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                      aria-hidden
                    >
                      PHP
                    </span>
                    <input
                      id="listing-price-pesos"
                      className="min-h-[44px] min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-base text-neutral-900 outline-none ring-0 placeholder:text-neutral-400 focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500 md:min-h-0 md:text-sm"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="e.g. 499.00"
                      aria-label="Price in Philippine pesos"
                      inputMode="decimal"
                      enterKeyHint="next"
                      value={listingForm.pricePesos}
                      onChange={(e) => {
                        setListingForm((p) => ({ ...p, pricePesos: e.target.value }));
                        if (listingFieldErrors.pricePesos) setListingFieldErrors((prev) => ({ ...prev, pricePesos: "" }));
                      }}
                    />
                  </div>
                  {listingFieldErrors.pricePesos ? (
                    <p className="field-error-text mt-1" role="alert">
                      {listingFieldErrors.pricePesos}
                    </p>
                  ) : null}
                  </div>
                <div className="min-w-0">
                    <label htmlFor="listing-quantity" className="label-base">
                      Quantity *
                    </label>
                    <input
                      id="listing-quantity"
                      className={`input-base mt-1.5 min-h-[44px] w-full rounded-xl text-left tabular-nums md:min-h-0 ${listingFieldErrors.quantity ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-500/70 dark:focus:ring-rose-500/30" : ""}`}
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min={0}
                      step={1}
                      placeholder="Type a quantity, or tap below"
                      enterKeyHint="next"
                      value={listingForm.quantity}
                      onChange={(e) => {
                        setListingForm((p) => ({ ...p, quantity: e.target.value }));
                        if (listingFieldErrors.quantity) setListingFieldErrors((prev) => ({ ...prev, quantity: "" }));
                      }}
                      onBlur={(e) => {
                        const parsed = Number.parseInt(String(e.target.value || "").trim(), 10);
                        const normalized = Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "";
                        setListingForm((p) => ({ ...p, quantity: normalized }));
                      }}
                    />
                    {String(listingForm.quantity || "").trim() === "" ? (
                      <div
                        className="mt-2 flex flex-wrap gap-2"
                        role="group"
                        aria-label="Quantity presets"
                      >
                        {LISTING_QUANTITY_PRESETS.map((qty) => (
                          <button
                            key={`qty-${qty}`}
                            type="button"
                            className="min-h-10 min-w-[2.5rem] touch-manipulation rounded-full border border-brand-primary/35 px-2.5 py-1.5 text-xs font-medium tabular-nums text-brand-primary transition hover:bg-brand-soft/50 active:scale-[0.98] dark:border-brand-accent/35 dark:text-slate-200 dark:hover:bg-slate-800"
                            onClick={() => {
                              setListingForm((p) => ({ ...p, quantity: String(qty) }));
                              if (listingFieldErrors.quantity) setListingFieldErrors((prev) => ({ ...prev, quantity: "" }));
                            }}
                          >
                            {qty}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  {listingFieldErrors.quantity ? (
                    <p className="field-error-text mt-1" role="alert">
                      {listingFieldErrors.quantity}
                    </p>
                  ) : null}
                </div>
              </div>
              <div id="listing-section-fulfillment" className="py-5 md:py-4">
                <p className="label-base">Fulfillment *</p>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    aria-pressed={listingForm.delivery}
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      listingForm.delivery
                        ? "border-brand-primary bg-brand-primary text-white hover:brightness-95 dark:border-brand-accent dark:bg-brand-accent dark:text-slate-900"
                        : "border-brand-primary/35 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 dark:border-brand-accent/40 dark:bg-brand-accent/15 dark:text-slate-100 dark:hover:bg-brand-accent/25"
                    }`}
                    onClick={() => {
                      setListingForm((p) => ({ ...p, delivery: !p.delivery }));
                      if (listingFieldErrors.fulfillment) setListingFieldErrors((prev) => ({ ...prev, fulfillment: "" }));
                    }}
                  >
                    <span className="mr-1" aria-hidden>🚚</span> COD Delivery
                  </button>
                  <button
                    type="button"
                    aria-pressed={listingForm.pickup}
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      listingForm.pickup
                        ? "border-brand-primary bg-brand-primary text-white hover:brightness-95 dark:border-brand-accent dark:bg-brand-accent dark:text-slate-900"
                        : "border-brand-primary/35 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 dark:border-brand-accent/40 dark:bg-brand-accent/15 dark:text-slate-100 dark:hover:bg-brand-accent/25"
                    }`}
                    onClick={() => {
                      setListingForm((p) => ({ ...p, pickup: !p.pickup }));
                      if (listingFieldErrors.fulfillment) setListingFieldErrors((prev) => ({ ...prev, fulfillment: "" }));
                    }}
                  >
                    <span className="mr-1" aria-hidden>📍</span> Pick-up
                  </button>
                </div>
                <p className="mt-2 text-xs text-neutral-500 dark:text-slate-400">Choose how buyers can receive the item.</p>
                {listingFieldErrors.fulfillment ? (
                  <p className="field-error-text mt-2" role="alert">
                    {listingFieldErrors.fulfillment}
                  </p>
                ) : null}
              </div>
              <div id="listing-section-advanced" className="md:col-span-2 py-1">
                <div
                  role="button"
                  tabIndex={0}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-0 py-1"
                  onClick={() => setListingAdvancedOpen((prev) => !prev)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setListingAdvancedOpen((prev) => !prev);
                    }
                  }}
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-primary dark:text-brand-accent">Advanced settings</p>
                  <span className={`inline-flex items-center text-neutral-700 transition-transform dark:text-slate-200 ${listingAdvancedOpen ? "rotate-180" : "rotate-0"}`} aria-hidden>
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
                {listingAdvancedOpen ? (
                  <div className="mt-3 border-t border-neutral-200/65 pt-4 dark:border-slate-700" />
                ) : null}
              </div>
              <div
                id="listing-section-variants"
                className={`md:col-span-2 border-t border-neutral-200/65 pt-4 dark:border-slate-700 ${listingAdvancedOpen ? "block" : "hidden"}`}
              >
                <h3 className="text-sm font-bold text-neutral-900 dark:text-slate-100">Product variants</h3>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                  <div className="min-w-0 space-y-2">
                    <label htmlFor="listing-variant-type-a" className="label-base">
                      Variant type
                    </label>
                    <input
                      id="listing-variant-type-a"
                      type="text"
                      autoComplete="off"
                      className={`input-base min-h-[44px] w-full ${listingFieldErrors.optionNameA ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-500/70 dark:focus:ring-rose-500/30" : ""}`}
                      placeholder="Add variant type"
                      aria-label="Variant type"
                      value={listingForm.optionNameA}
                      onChange={(e) => {
                        setListingForm((p) => ({ ...p, optionNameA: e.target.value }));
                        if (listingFieldErrors.optionNameA) setListingFieldErrors((prev) => ({ ...prev, optionNameA: "" }));
                      }}
                      onBlur={(e) => {
                        const candidates = filterVariantTypesExcluding(listingSecondOptionOpen ? listingForm.optionNameB : "");
                        const resolved = resolveVariantTypeOnBlur(e.target.value, candidates);
                        setListingForm((p) =>
                          resolved === p.optionNameA ? p : { ...p, optionNameA: resolved },
                        );
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const candidates = filterVariantTypesExcluding(listingSecondOptionOpen ? listingForm.optionNameB : "");
                        const resolved = resolveVariantTypeOnBlur(e.currentTarget.value, candidates);
                        setListingForm((p) => ({ ...p, optionNameA: resolved }));
                        if (listingFieldErrors.optionNameA) setListingFieldErrors((prev) => ({ ...prev, optionNameA: "" }));
                      }}
                    />
                    {(() => {
                      const candidates = filterVariantTypesExcluding(listingSecondOptionOpen ? listingForm.optionNameB : "");
                      const sug = nearestVariantTypeSuggestion(listingForm.optionNameA, candidates);
                      return sug ? (
                        <button
                          type="button"
                          className="mt-1.5 w-full rounded-xl border border-brand-primary/35 bg-brand-soft/35 px-3 py-2 text-left text-xs font-medium text-brand-primary transition hover:bg-brand-soft/50 dark:border-brand-accent/35 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800"
                          onClick={() => {
                            setListingForm((p) => ({ ...p, optionNameA: sug }));
                            if (listingFieldErrors.optionNameA) setListingFieldErrors((prev) => ({ ...prev, optionNameA: "" }));
                          }}
                        >
                          Use “{sug}”
                        </button>
                      ) : null;
                    })()}
                    {listingFieldErrors.optionNameA ? (
                      <p className="field-error-text" role="alert">
                        {listingFieldErrors.optionNameA}
                      </p>
                    ) : null}
                    {listingVariantTypeSelectValue(listingForm.optionNameA) === "" ? (
                      <div className="flex flex-wrap gap-2">
                        {filterVariantTypesExcluding(listingSecondOptionOpen ? listingForm.optionNameB : "").map((name) => (
                          <button
                            key={`qa-${name}`}
                            type="button"
                            className="min-h-10 rounded-full border border-brand-primary/35 px-2.5 py-1.5 text-xs font-medium text-brand-primary transition hover:bg-brand-soft/50 dark:border-brand-accent/35 dark:text-slate-200 dark:hover:bg-slate-800"
                            onClick={() => setListingForm((p) => ({ ...p, optionNameA: name }))}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="min-w-0 space-y-2">
                    <label className="label-base" htmlFor="listing-variant-choice-draft-a">
                      Variant choices
                    </label>
                    <div className="input-base flex min-h-[44px] w-full min-w-0 flex-wrap items-center gap-1.5 px-2 py-1.5">
                      {splitOptionValuesCsv(listingForm.optionValuesA).map((value) => (
                        <button
                          key={`a-tag-${value}`}
                          type="button"
                          className="inline-flex min-h-8 items-center gap-1 rounded-full border border-brand-primary bg-brand-primary px-2.5 py-0.5 text-xs text-white transition hover:brightness-95 dark:border-brand-accent dark:bg-brand-accent dark:text-slate-900"
                          onClick={() => removeListingOptionValue("A", value)}
                        >
                          {value}
                          <span aria-hidden>×</span>
                        </button>
                      ))}
                      <input
                        id="listing-variant-choice-draft-a"
                        className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm text-neutral-900 outline-none ring-0 placeholder:text-neutral-400 focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                        placeholder={splitOptionValuesCsv(listingForm.optionValuesA).length > 0 ? "" : "Add choice"}
                        value={listingOptionValueDraftA}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            addListingOptionValue("A", listingOptionValueDraftA);
                          }
                        }}
                        onChange={(e) => setListingOptionValueDraftA(e.target.value)}
                        aria-label="Add variant choice"
                      />
                    </div>
                    {listingFieldErrors.optionValuesA ? (
                      <p className="field-error-text" role="alert">
                        {listingFieldErrors.optionValuesA}
                      </p>
                    ) : null}
                    {getListingOptionValueSuggestions(listingForm.optionNameA).filter(
                      (value) =>
                        !splitOptionValuesCsv(listingForm.optionValuesA).some((c) => c.toLowerCase() === value.toLowerCase()),
                    ).length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {getListingOptionValueSuggestions(listingForm.optionNameA)
                          .filter(
                            (value) =>
                              !splitOptionValuesCsv(listingForm.optionValuesA).some(
                                (c) => c.toLowerCase() === value.toLowerCase(),
                              ),
                          )
                          .map((value) => (
                            <button
                              key={`a-preset-${value}`}
                              type="button"
                              className="min-h-9 rounded-full border border-brand-primary/30 px-2 py-0.5 text-xs text-brand-primary transition hover:bg-brand-soft/45 dark:border-brand-accent/30 dark:text-slate-200 dark:hover:bg-slate-800"
                              onClick={() => addListingOptionValue("A", value)}
                            >
                              {value}
                            </button>
                          ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                {listingSecondOptionOpen ? (
                  <div className="mt-6 grid grid-cols-1 gap-4 border-t border-neutral-200/65 pt-6 md:grid-cols-2 md:gap-6 dark:border-slate-700">
                    <div className="min-w-0 space-y-2">
                      <label htmlFor="listing-variant-type-b" className="label-base">
                        Second variant type
                      </label>
                      <input
                        id="listing-variant-type-b"
                        type="text"
                        autoComplete="off"
                        className={`input-base min-h-[44px] w-full ${listingFieldErrors.optionNameB ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-500/70 dark:focus:ring-rose-500/30" : ""}`}
                        placeholder="Add variant type"
                        aria-label="Second variant type"
                        value={listingForm.optionNameB}
                        onChange={(e) => {
                          setListingForm((p) => ({ ...p, optionNameB: e.target.value }));
                          if (listingFieldErrors.optionNameB) setListingFieldErrors((prev) => ({ ...prev, optionNameB: "" }));
                        }}
                        onBlur={(e) => {
                          const candidates = filterVariantTypesExcluding(listingForm.optionNameA);
                          const resolved = resolveVariantTypeOnBlur(e.target.value, candidates);
                          setListingForm((p) =>
                            resolved === p.optionNameB ? p : { ...p, optionNameB: resolved },
                          );
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          const candidates = filterVariantTypesExcluding(listingForm.optionNameA);
                          const resolved = resolveVariantTypeOnBlur(e.currentTarget.value, candidates);
                          setListingForm((p) => ({ ...p, optionNameB: resolved }));
                          if (listingFieldErrors.optionNameB) setListingFieldErrors((prev) => ({ ...prev, optionNameB: "" }));
                        }}
                      />
                      {(() => {
                        const candidates = filterVariantTypesExcluding(listingForm.optionNameA);
                        const sug = nearestVariantTypeSuggestion(listingForm.optionNameB, candidates);
                        return sug ? (
                          <button
                            type="button"
                            className="mt-1.5 w-full rounded-xl border border-brand-primary/35 bg-brand-soft/35 px-3 py-2 text-left text-xs font-medium text-brand-primary transition hover:bg-brand-soft/50 dark:border-brand-accent/35 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800"
                            onClick={() => {
                              setListingForm((p) => ({ ...p, optionNameB: sug }));
                              if (listingFieldErrors.optionNameB) setListingFieldErrors((prev) => ({ ...prev, optionNameB: "" }));
                            }}
                          >
                            Use “{sug}”
                          </button>
                        ) : null;
                      })()}
                      {listingFieldErrors.optionNameB ? (
                        <p className="field-error-text" role="alert">
                          {listingFieldErrors.optionNameB}
                        </p>
                      ) : null}
                      {listingVariantTypeSelectValue(listingForm.optionNameB) === "" ? (
                        <div className="flex flex-wrap gap-2">
                          {filterVariantTypesExcluding(listingForm.optionNameA).map((name) => (
                            <button
                              key={`qb-${name}`}
                              type="button"
                              className="min-h-10 rounded-full border border-brand-primary/35 px-2.5 py-1.5 text-xs font-medium text-brand-primary transition hover:bg-brand-soft/50 dark:border-brand-accent/35 dark:text-slate-200 dark:hover:bg-slate-800"
                              onClick={() => setListingForm((p) => ({ ...p, optionNameB: name }))}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="min-w-0 space-y-2">
                      <label className="label-base" htmlFor="listing-variant-choice-draft-b">
                        Second variant choices
                      </label>
                      <div className="input-base flex min-h-[44px] w-full min-w-0 flex-wrap items-center gap-1.5 px-2 py-1.5">
                        {splitOptionValuesCsv(listingForm.optionValuesB).map((value) => (
                          <button
                            key={`b-tag-${value}`}
                            type="button"
                            className="inline-flex min-h-8 items-center gap-1 rounded-full border border-brand-primary bg-brand-primary px-2.5 py-0.5 text-xs text-white transition hover:brightness-95 dark:border-brand-accent dark:bg-brand-accent dark:text-slate-900"
                            onClick={() => removeListingOptionValue("B", value)}
                          >
                            {value}
                            <span aria-hidden>×</span>
                          </button>
                        ))}
                        <input
                          id="listing-variant-choice-draft-b"
                          className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm text-neutral-900 outline-none ring-0 placeholder:text-neutral-400 focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                          placeholder={splitOptionValuesCsv(listingForm.optionValuesB).length > 0 ? "" : "Add choice"}
                          value={listingOptionValueDraftB}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                              e.preventDefault();
                              addListingOptionValue("B", listingOptionValueDraftB);
                            }
                          }}
                          onChange={(e) => setListingOptionValueDraftB(e.target.value)}
                          aria-label="Add second variant choice"
                        />
                      </div>
                      {listingFieldErrors.optionValuesB ? (
                        <p className="field-error-text" role="alert">
                          {listingFieldErrors.optionValuesB}
                        </p>
                      ) : null}
                      {getListingOptionValueSuggestions(listingForm.optionNameB).filter(
                        (value) =>
                          !splitOptionValuesCsv(listingForm.optionValuesB).some((c) => c.toLowerCase() === value.toLowerCase()),
                      ).length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {getListingOptionValueSuggestions(listingForm.optionNameB)
                            .filter(
                              (value) =>
                                !splitOptionValuesCsv(listingForm.optionValuesB).some(
                                  (c) => c.toLowerCase() === value.toLowerCase(),
                                ),
                            )
                            .map((value) => (
                              <button
                                key={`b-preset-${value}`}
                                type="button"
                                className="min-h-9 rounded-full border border-brand-primary/30 px-2 py-0.5 text-xs text-brand-primary transition hover:bg-brand-soft/45 dark:border-brand-accent/30 dark:text-slate-200 dark:hover:bg-slate-800"
                                onClick={() => addListingOptionValue("B", value)}
                              >
                                {value}
                              </button>
                            ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        className="mt-1 text-sm font-semibold text-rose-600 underline decoration-rose-300 underline-offset-2 transition hover:text-rose-700 dark:text-rose-400 dark:decoration-rose-500/60 dark:hover:text-rose-300"
                        onClick={() => {
                          setListingForm((p) => ({ ...p, optionNameB: "", optionValuesB: "" }));
                          setListingOptionValueDraftB("");
                          setListingSecondOptionOpen(false);
                          setListingFieldErrors((prev) => ({ ...prev, optionNameB: "", optionValuesB: "" }));
                        }}
                      >
                        Remove second variant
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <button
                      type="button"
                      className="btn-secondary min-h-[44px] w-full text-sm sm:w-auto"
                      onClick={() => setListingSecondOptionOpen(true)}
                    >
                      Add second variant
                    </button>
                    <div
                      className="mt-4 h-px w-full bg-neutral-200/80 dark:bg-slate-600"
                      aria-hidden
                    />
                  </div>
                )}
              </div>
              <div
                id="listing-section-processing"
                className={`md:col-span-2 py-1 ${listingAdvancedOpen ? "block" : "hidden"}`}
              >
                <p className="label-base">Processing (order type)</p>
                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        ["in_stock", "In stock"],
                        ["pre_order", "Pre-order"],
                      ].map(([value, label]) => (
                        <button key={value} type="button" className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition ${listingForm.orderType === value ? "border-brand-primary bg-brand-primary text-white hover:brightness-95 dark:border-brand-accent dark:bg-brand-accent dark:text-slate-900" : "border-brand-primary/35 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 dark:border-brand-accent/40 dark:bg-brand-accent/15 dark:text-slate-100 dark:hover:bg-brand-accent/25"}`} onClick={() => setListingForm((p) => ({ ...p, orderType: value }))}>{label}</button>
                      ))}
                    </div>
                  </div>
                  {listingForm.orderType === "in_stock" ? (
                    <div className="min-w-0">
                      <label htmlFor="listing-ready-in" className="label-base">
                        Estimated ready time{" "}
                        <span className="font-normal text-neutral-500 dark:text-slate-400">(optional)</span>
                      </label>
                      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                        <span className="shrink-0 text-sm font-semibold text-neutral-800 dark:text-slate-100">Ready in:</span>
                        <input
                          id="listing-ready-in"
                          type="text"
                          enterKeyHint="done"
                          autoComplete="off"
                          className="input-base min-w-[10rem] flex-1"
                          placeholder="e.g. 2 hours, same day"
                          value={listingForm.processingTime}
                          onChange={(e) => setListingForm((p) => ({ ...p, processingTime: e.target.value }))}
                        />
                      </div>
                      {String(listingForm.processingTime || "").trim() === "" ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {LISTING_READY_IN_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              className="rounded-full border border-brand-primary/30 px-2 py-0.5 text-xs text-brand-primary transition hover:bg-brand-soft/45 dark:border-brand-accent/30 dark:text-slate-200 dark:hover:bg-slate-800"
                              onClick={() => setListingForm((p) => ({ ...p, processingTime: preset }))}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <label htmlFor="listing-processing-time" className="label-base">
                        Lead / processing time *
                      </label>
                      <input
                        id="listing-processing-time"
                        type="text"
                        enterKeyHint="done"
                        autoComplete="off"
                        aria-invalid={listingFieldErrors.processingTime ? true : undefined}
                        aria-describedby={
                          listingFieldErrors.processingTime ? "listing-processing-time-error" : undefined
                        }
                        className={`input-base w-full ${listingFieldErrors.processingTime ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-500/70 dark:focus:ring-rose-500/30" : ""}`}
                        placeholder="e.g. 7 days"
                        value={listingForm.processingTime}
                        onChange={(e) => setListingForm((p) => ({ ...p, processingTime: e.target.value }))}
                      />
                      {String(listingForm.processingTime || "").trim() === "" ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {LISTING_PROCESSING_TIME_PRESETS.map((preset) => (
                            <button key={preset} type="button" className="rounded-full border border-brand-primary/30 px-2 py-0.5 text-xs text-brand-primary transition hover:bg-brand-soft/45 dark:border-brand-accent/30 dark:text-slate-200 dark:hover:bg-slate-800" onClick={() => setListingForm((p) => ({ ...p, processingTime: preset }))}>{preset}</button>
                          ))}
                        </div>
                      ) : null}
                      {listingFieldErrors.processingTime ? (
                        <p id="listing-processing-time-error" className="field-error-text mt-1" role="alert">
                          {listingFieldErrors.processingTime}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              </div>
              <div id="listing-section-publish" className="md:col-span-2">
                <MobileFormActions className="border-t border-neutral-200/65 px-0 dark:border-slate-700">
                <div className="flex w-full min-w-0 flex-col gap-2 md:flex-row md:w-auto md:items-center md:justify-start">
                  <button
                    type="submit"
                    className="btn-primary w-full whitespace-normal text-balance md:w-auto"
                    disabled={listingSaving}
                    aria-busy={listingSaving || undefined}
                  >
                    {listingSaving ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <span
                          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent motion-reduce:animate-none"
                          aria-hidden
                        />
                        {editingListingId ? "Saving…" : "Publishing…"}
                      </span>
                    ) : editingListingId ? (
                      "Save changes"
                    ) : (
                      "Publish listing"
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary w-full md:w-auto"
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
                        optionNameA: "",
                        optionValuesA: "",
                        optionNameB: "",
                        optionValuesB: "",
                        orderType: "in_stock",
                        processingTime: "",
                        pickup: false,
                        delivery: false,
                      });
                      setListingFieldErrors({});
                      setListingImageFile(null);
                      setListingCoverContentHash("");
                      if (listingImagePreviewUrl && listingImagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(listingImagePreviewUrl);
                      setListingImagePreviewUrl("");
                      clearListingExtraImages();
                      setListingCropQueue([]);
                      closeListingCropEditor();
                      closeListingPhotoActionModal();
                      setListingAdvancedOpen(false);
                      setListingOptionValueDraftA("");
                      setListingOptionValueDraftB("");
                      setListingSecondOptionOpen(false);
                      setEditingListingId(null);
                      setListingEditOverlayOpen(false);
                      clearMarketplaceToasts();
                      setSellerTab(SELLER_TABS.PRODUCTS);
                      if (listingEditOverlayOpen) {
                        const origin = productFlowOriginRef.current || {};
                        const originView = String(origin.view || "");
                        if ([VIEWS.BROWSE, VIEWS.COMMUNITY_SHOP, VIEWS.FAVORITES].includes(originView)) {
                          setActiveView(originView);
                        }
                      } else {
                        goOwnProfile();
                        navigate("/", { replace: true });
                      }
                    }}
                  >
                    Cancel
                  </button>
                </div>
                <p className="mt-2 text-left text-xs text-neutral-600 dark:text-slate-300">
                  Required complete: <span className="font-semibold text-neutral-800 dark:text-slate-100">{listingRequiredCompletedCount}/{listingRequiredTotalCount}</span>
                </p>
                </MobileFormActions>
              </div>
            </form>
            </div>
          </section>
        )}

        {activeView === VIEWS.CART && (
          <section className={`${UI_KIT.viewSection} space-y-4 md:space-y-6`}>
            {cartItems.length === 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Cart</h2>
                </div>
                <div className="w-full min-w-0">
                  <div
                    className={`${UI_KIT.surfaceRaised} flex w-full min-w-0 flex-col items-center border border-dashed px-4 py-10 text-center md:px-6 md:py-12`}
                  >
                    <p className="w-full min-w-0 text-balance text-lg font-semibold text-neutral-900 dark:text-slate-100 min-[400px]:text-xl md:text-xl">
                      Your cart is empty
                    </p>
                    <p className="mt-2 w-full min-w-0 text-pretty text-sm leading-relaxed text-neutral-600 dark:text-slate-400 min-[400px]:text-[15px]">
                      Add items from Shop or your community, pick quantities, then select lines and check out for COD pickup or delivery.
                    </p>
                    <button
                      type="button"
                      className="btn-primary mt-6 w-full touch-manipulation min-h-[44px] text-sm md:mt-8 md:min-h-12 md:w-auto md:min-w-[10rem]"
                      onClick={() => goBrowse()}
                    >
                      Browse marketplace
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Cart</h2>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <ProductViewDensityToggle
                      value={commerceFlowViewBuyer}
                      onChange={setCommerceFlowViewBuyer}
                      allowCompact={!isMobileViewport}
                      groupAriaLabel="Cart line layout"
                      gridTitle="Grid — two columns for readable cart cards"
                      compactTitle="Dense — three columns for a compact overview"
                    />
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
                    <Button
                      type="button"
                      variant="primary"
                      className="text-sm"
                      disabled={selectedCartItems.length === 0}
                      loading={cartCheckoutSubmitting}
                      loadingLabel="Checking out…"
                      onClick={() => {
                        void checkoutSelectedCartItems();
                      }}
                    >
                      {`Check out${selectedCartItems.length > 0 ? ` (${selectedCartItems.length})` : ""}`}
                    </Button>
                  </div>
                </div>
              <div className="space-y-3">
                {Object.entries(
                  cartItems.reduce((acc, item) => {
                    const key = String(item.sellerId || "unknown");
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(item);
                    return acc;
                  }, {}),
                ).map(([sellerId, items]) => {
                  const orderedItems = [...items].sort((a, b) => {
                    const aId = String(a?.listingId || "");
                    const bId = String(b?.listingId || "");
                    const aUnseen = aId && !cartSeenSet.has(aId);
                    const bUnseen = bId && !cartSeenSet.has(bId);
                    if (aUnseen && !bUnseen) return -1;
                    if (!aUnseen && bUnseen) return 1;
                    return 0;
                  });
                  const rowIds = orderedItems.map((i) => cartLineKeyFromItem(i));
                  const selectedCount = rowIds.filter((id) => cartItemSelection[id]).length;
                  const allSelected = rowIds.length > 0 && selectedCount === rowIds.length;
                  const someSelected = selectedCount > 0 && !allSelected;
                  const sellerLabel = orderedItems[0]?.sellerLabel || "Unknown seller";
                  return (
                    <div key={sellerId} className="space-y-2">
                      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-neutral-200/80 pb-2 dark:border-slate-700/80">
                        <label className="inline-flex shrink-0 cursor-pointer items-center">
                          <CartSellerSelectAllCheckbox
                            allChecked={allSelected}
                            someSelected={someSelected}
                            onChange={() => toggleCartSellerSelectAll(orderedItems)}
                            ariaLabel={`Select all from ${sellerLabel}`}
                          />
                        </label>
                        <p className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-slate-300">{sellerLabel}</p>
                      </div>
                      <div
                        className={`${commerceFlowLineItemsClass(effectiveCommerceFlowViewBuyer, { variant: "cart" })} ${lmBrowseViewShellClass(
                          effectiveCommerceFlowViewBuyer === "list" ? "list" : "grid",
                        )} ${effectiveCommerceFlowViewBuyer === "list" ? "" : "grid-cols-2"}`}
                      >
                        {orderedItems.map((item) => {
                          const lid = String(item.listingId);
                          const lineKey = cartLineKeyFromItem(item);
                          const vSig = String(item.variantSignature ?? "");
                          const isCartLineUnseen = Boolean(lid && !cartSeenSet.has(lid));
                          const isRemoving = cartRemovingListingIds.includes(lineKey);
                          const cfList = effectiveCommerceFlowViewBuyer === "list";
                          const cfCompact = effectiveCommerceFlowViewBuyer === "compact";
                          const maxAvailableQty = Math.max(
                            1,
                            Number(item.listingQuantity) >= 1 ? Number(item.listingQuantity) : Number(item.quantity) || 1,
                          );
                          const openCartItemInspect = () => {
                            const listingForQuick = {
                              ...item,
                              id: item.listingId,
                              priceCents: item.unitPriceCents,
                            };
                            const stockAvail =
                              Number(item.listingQuantity) >= 0
                                ? Math.max(0, Number(item.listingQuantity))
                                : Math.max(0, Number(item.quantity) || 0);
                            openProductInspect(listingForQuick, {
                              quantity: Number(item.quantity) || 1,
                              comment: String(item.comment || "").trim(),
                              commentSectionRequired: true,
                              commentHeading: "Your note to the seller",
                              subtitle: "Cart",
                              listingStockQty: stockAvail,
                              showBuyerCommerceActions: true,
                              onAddToCart: () => {
                                openQuickAddModal(listingForQuick, "cart");
                              },
                              onBuyNow: () => {
                                openQuickAddModal(listingForQuick, "buy");
                              },
                            });
                          };
                          const thumbClass = cfList
                            ? "aspect-[4/3] w-[6.5rem] min-[400px]:aspect-square min-[400px]:h-[7.5rem] min-[400px]:w-[7.5rem] min-[400px]:max-h-[7.5rem] min-[400px]:max-w-[7.5rem] min-[400px]:shrink-0"
                            : "lm-product-card-media aspect-square w-full min-h-0";
                          const cartLineVariantPick = narrowListingOptionValuesForBuyerSelection(item);
                          const cartModesList = Array.isArray(item.fulfillmentModes) ? item.fulfillmentModes.map(String) : [];
                          const cartFtResolved =
                            item.fulfillmentType === "pickup" || item.fulfillmentType === "delivery"
                              ? item.fulfillmentType
                              : cartModesList.includes("pickup")
                                ? "pickup"
                                : cartModesList[0] || "pickup";
                          const cartFulfillmentModesForLabel = [cartFtResolved];
                          return (
                            <div
                              key={lineKey}
                              className={`transition-opacity duration-[2000ms] ${
                                cfList
                                  ? "relative lm-card lm-list-card lm-product-card-list flex items-start gap-3 p-3 md:gap-3.5"
                                  : "relative lm-card lm-grid-card lm-product-card lm-product-card--feed h-full min-h-0 flex-1 p-0"
                              } ${
                                isCartLineUnseen ? "bg-primary-soft dark:bg-primary/15" : ""
                              } ${
                                isRemoving ? "pointer-events-none opacity-0" : "opacity-100"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className={`h-4 w-4 shrink-0 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary/35 dark:border-slate-500 ${
                                  cfList
                                    ? "absolute left-4 top-4 z-10 bg-white/90 dark:bg-slate-900/90"
                                    : "absolute left-2 top-2 z-10 bg-white/90 dark:bg-slate-900/90"
                                }`}
                                checked={Boolean(cartItemSelection[lineKey])}
                                onChange={() => toggleCartListingSelected(lineKey)}
                                aria-label={`Select ${item.title || "product"}`}
                              />
                              <button
                                type="button"
                                className={
                                  cfList
                                    ? `lm-product-media lm-product-media--soft relative ${thumbClass} shrink-0 overflow-hidden cursor-pointer`
                                    : `${thumbClass} lm-product-card--tap`
                                }
                                aria-label={`View details: ${item.title || "product"}`}
                                onClick={openCartItemInspect}
                              >
                                <ProductListingMedia
                                  listing={item}
                                  variant={cfList ? "list" : "grid"}
                                  className="absolute inset-0 min-h-0"
                                  loading="lazy"
                                  sizes="(max-width: 768px) 22vw, min(112px, 10vw)"
                                />
                              </button>
                              <div
                                className={
                                  cfList
                                    ? "flex w-full min-w-0 flex-col gap-1 min-[400px]:min-w-0 min-[400px]:flex-1"
                                    : "lm-product-card-body"
                                }
                              >
                                <div
                                  className="w-full min-w-0 text-left touch-manipulation"
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`View details: ${item.title || "product"}`}
                                  onClick={openCartItemInspect}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      openCartItemInspect();
                                    }
                                  }}
                                >
                                  {isCartLineUnseen ? (
                                    <span className="mb-1 inline-flex w-fit max-w-full shrink-0 self-start items-center rounded-full border border-emerald-400/90 bg-emerald-200/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900 dark:border-emerald-400/60 dark:bg-emerald-500/25 dark:text-emerald-200">
                                      Recently updated
                                    </span>
                                  ) : null}
                                  <DeferredProductDetailStack
                                    variant="card"
                                    title={item.title || "Product"}
                                    titleEnd={
                                      cfList ? (
                                        <div className="flex items-center gap-0.5">
                                          <button
                                            type="button"
                                            className="inline-flex h-7 w-7 touch-manipulation items-center justify-center rounded-md bg-transparent text-base font-semibold text-primary transition duration-200 ease-in-out hover:bg-primary-soft/60 focus:outline-none focus-visible:ring-0 active:bg-primary-soft/70 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800/60 dark:active:bg-slate-800/75"
                                            aria-label="Decrease quantity"
                                            disabled={cartQtySavingId === lineKey || (Number(item.quantity) || 0) <= 0}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setCartQtyEdit({ id: null, str: "" });
                                              void setCartLineQuantity(item.listingId, (Number(item.quantity) || 1) - 1, vSig);
                                            }}
                                          >
                                            −
                                          </button>
                                          <span
                                            className="inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-md border border-neutral-200/90 bg-white px-2 text-center text-xs font-semibold tabular-nums text-text-primary dark:border-slate-600/80 dark:bg-slate-900 dark:text-slate-100"
                                            aria-label={`Quantity for ${item.title || "product"}`}
                                          >
                                            {cartQtyEdit.id === lineKey ? cartQtyEdit.str || "0" : String(Number(item.quantity) || 1)}
                                          </span>
                                          <button
                                            type="button"
                                            className="inline-flex h-7 w-7 touch-manipulation items-center justify-center rounded-md bg-transparent text-base font-semibold text-primary transition duration-200 ease-in-out hover:bg-primary-soft/60 focus:outline-none focus-visible:ring-0 active:bg-primary-soft/70 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800/60 dark:active:bg-slate-800/75"
                                            aria-label="Increase quantity"
                                            disabled={cartQtySavingId === lineKey || (Number(item.quantity) || 0) >= maxAvailableQty}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setCartQtyEdit({ id: null, str: "" });
                                              void setCartLineQuantity(item.listingId, (Number(item.quantity) || 0) + 1, vSig);
                                            }}
                                          >
                                            +
                                          </button>
                                        </div>
                                      ) : null
                                    }
                                    priceCents={item.unitPriceCents}
                                    description={item.description}
                                    hideDescription
                                    fulfillmentModes={cartFulfillmentModesForLabel}
                                    orderType={item.orderType}
                                    processingTime={item.processingTime}
                                    optionNameA={item.optionNameA}
                                    optionValuesA={cartLineVariantPick.optionValuesA}
                                    optionNameB={item.optionNameB}
                                    optionValuesB={cartLineVariantPick.optionValuesB}
                                    browseStackMode={cfList ? "listMobile" : null}
                                    compactListMeta={cfList}
                                    quantityRow={
                                      cfList ? (
                                        <p className="text-[12px] font-medium leading-snug text-text-secondary dark:text-slate-300">
                                          <span className="font-semibold uppercase tracking-wide text-[10px] text-text-secondary/80 dark:text-slate-400">
                                            Stock
                                          </span>
                                          <span className="mx-1 text-text-secondary/65 dark:text-slate-500">:</span>
                                          <span className="tabular-nums font-semibold text-text-primary dark:text-slate-100">
                                            {Number(item.listingQuantity) >= 1 ? Number(item.listingQuantity) : "—"}
                                          </span>
                                        </p>
                                      ) : null
                                    }
                                    listingMetaDensity="compact"
                                  />
                                </div>
                                <div className={`mt-1.5 ${cfList ? "hidden" : "flex items-center justify-between gap-2"}`}>
                                  <span className="text-[11px] font-medium text-text-secondary dark:text-slate-400">
                                    Quantity
                                  </span>
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-md bg-transparent text-base font-semibold text-primary transition duration-200 ease-in-out hover:bg-primary-soft/60 focus:outline-none focus-visible:ring-0 active:bg-primary-soft/70 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800/60 dark:active:bg-slate-800/75"
                                      aria-label="Decrease quantity"
                                      disabled={cartQtySavingId === lineKey || (Number(item.quantity) || 0) <= 0}
                                      onClick={() => {
                                        setCartQtyEdit({ id: null, str: "" });
                                        void setCartLineQuantity(item.listingId, (Number(item.quantity) || 1) - 1, vSig);
                                      }}
                                    >
                                      −
                                    </button>
                                    <span
                                      className="inline-flex h-8 min-w-[2.5rem] items-center justify-center rounded-md border border-neutral-200/90 bg-white px-2 text-center text-[13px] font-semibold tabular-nums text-text-primary dark:border-slate-600/80 dark:bg-slate-900 dark:text-slate-100"
                                      aria-label={`Quantity for ${item.title || "product"}`}
                                    >
                                      {cartQtyEdit.id === lineKey ? cartQtyEdit.str || "0" : String(Number(item.quantity) || 1)}
                                    </span>
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-md bg-transparent text-base font-semibold text-primary transition duration-200 ease-in-out hover:bg-primary-soft/60 focus:outline-none focus-visible:ring-0 active:bg-primary-soft/70 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800/60 dark:active:bg-slate-800/75"
                                      aria-label="Increase quantity"
                                      disabled={
                                        cartQtySavingId === lineKey ||
                                        (Number(item.quantity) || 0) >= maxAvailableQty
                                      }
                                      onClick={() => {
                                        setCartQtyEdit({ id: null, str: "" });
                                        void setCartLineQuantity(item.listingId, (Number(item.quantity) || 0) + 1, vSig);
                                      }}
                                    >
                                      +
                                    </button>
                                  </div>
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
              </>
            )}
          </section>
        )}

        {(activeView === VIEWS.ORDERS || activeView === VIEWS.MY_PURCHASES) && (
          <section className={`${UI_KIT.viewSection} space-y-4 md:space-y-6`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="min-w-0 text-xl font-semibold tracking-tight text-neutral-900 md:text-2xl dark:text-slate-100">
                {activeView === VIEWS.MY_PURCHASES ? "Purchases" : "Orders"}
              </h2>
              {orders.length > 0 ? (
                <div className="flex shrink-0 items-center justify-end">
                  <ProductViewDensityToggle
                    value={activeView === VIEWS.MY_PURCHASES ? commerceFlowViewBuyer : commerceFlowViewSeller}
                    onChange={setCommerceFlowOrdersView}
                    allowCompact={!isMobileViewport}
                    groupAriaLabel={
                      activeView === VIEWS.MY_PURCHASES ? "Purchases line layout" : "Orders line layout"
                    }
                    gridTitle="Grid — two columns for readable order cards"
                    compactTitle="Dense — three columns for a compact overview"
                  />
                </div>
              ) : null}
            </div>
            {ordersFetchError ? (
              <ScreenError
                title="Couldn’t load orders"
                message={ordersFetchError}
                onRetry={() => void refetchOrders()}
                secondaryAction={{ label: "Go home", onClick: goMobileHome }}
                spacious
              />
            ) : null}
            {orders.length > 0 ? (
              <>
                <div className="border-b border-neutral-200/70 pb-2 dark:border-slate-700/70 md:border-0 md:pb-0">
                  <div
                    className="grid w-full min-w-0 grid-cols-4 gap-0 overflow-hidden rounded-2xl border border-neutral-200/90 bg-neutral-100/95 p-0 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] dark:border-slate-600 dark:bg-slate-900/85 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]"
                      role="tablist"
                      aria-label={activeView === VIEWS.MY_PURCHASES ? "Purchase status" : "Order status"}
                      onKeyDown={(e) => {
                        const tabs = ORDERS_STATUS_TABS;
                        const { key } = e;
                        if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End") return;
                        e.preventDefault();
                        const idx = tabs.findIndex((t) => t.id === ordersStatusTab);
                        let next = idx;
                        if (key === "ArrowRight") next = Math.min(tabs.length - 1, idx + 1);
                        else if (key === "ArrowLeft") next = Math.max(0, idx - 1);
                        else if (key === "Home") next = 0;
                        else if (key === "End") next = tabs.length - 1;
                        if (next !== idx) {
                          const nextId = tabs[next].id;
                          setOrdersStatusTab(nextId);
                          queueMicrotask(() => {
                            document.getElementById(`commerce-flow-status-tab-${nextId}`)?.focus();
                          });
                        }
                      }}
                    >
                      {ORDERS_STATUS_TABS.map(({ id, label }) => {
                        const selected = ordersStatusTab === id;
                        const tabBadgeCount =
                          id === "pending"
                            ? pendingTabBadgeDisplayCount
                            : id === "processing"
                              ? processingTabBadgeDisplayCount
                              : id === "completed" || id === "cancelled"
                                ? ordersTabBadgeIdsByTab[id]?.length ?? 0
                                : 0;
                        const showTabBadge = tabBadgeCount > 0;
                        const unseenForStatusTab =
                          id === "pending"
                            ? ordersTabBadgeIdsByTab.pending?.length ?? 0
                            : id === "processing"
                              ? ordersTabBadgeIdsByTab.processing?.length ?? 0
                              : id === "completed"
                                ? ordersTabBadgeIdsByTab.completed?.length ?? 0
                                : id === "cancelled"
                                  ? ordersTabBadgeIdsByTab.cancelled?.length ?? 0
                                  : 0;
                        const badgeIsRose = unseenForStatusTab > 0;
                        const badgeCountDisplay = tabBadgeCount > 99 ? "99+" : tabBadgeCount;
                        return (
                        <button
                          key={id}
                          id={`commerce-flow-status-tab-${id}`}
                          type="button"
                          role="tab"
                          tabIndex={selected ? 0 : -1}
                          aria-selected={selected}
                          aria-controls="commerce-flow-status-panel"
                          aria-label={
                            showTabBadge
                              ? `${label}, ${String(badgeCountDisplay).replace("+", " plus ")}`
                              : label
                          }
                          className={`relative flex min-h-[44px] min-w-0 flex-col items-center justify-center rounded-none px-0.5 pb-1.5 text-center text-[10px] font-semibold leading-snug transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-100 dark:focus-visible:ring-brand-accent/45 dark:focus-visible:ring-offset-slate-900 min-[380px]:px-1.5 min-[380px]:text-xs md:text-[13px] ${
                            showTabBadge ? "pt-3.5" : "pt-1.5"
                          } ${
                            selected
                              ? "bg-white text-primary shadow-sm ring-1 ring-inset ring-neutral-200/90 dark:bg-slate-950 dark:text-brand-accent dark:ring-slate-600/90"
                              : "text-neutral-600 hover:bg-white/70 hover:text-neutral-900 dark:text-slate-400 dark:hover:bg-slate-800/90 dark:hover:text-slate-100"
                          }`}
                          onClick={() => setOrdersStatusTab(id)}
                        >
                          {showTabBadge ? (
                            <span
                              className={badgeIsRose ? ORDER_STATUS_TAB_BADGE_ROSE : ORDER_STATUS_TAB_BADGE_MUTED}
                              aria-hidden
                            >
                              {badgeCountDisplay}
                            </span>
                          ) : null}
                          <span
                            className={`line-clamp-2 min-w-0 max-w-full px-0.5 ${showTabBadge ? "pr-4 md:pr-0.5" : ""}`}
                          >
                            {label}
                          </span>
                        </button>
                        );
                      })}
                    </div>
                </div>
                <div
                  id="commerce-flow-status-panel"
                  role="tabpanel"
                  aria-labelledby={`commerce-flow-status-tab-${ordersStatusTab}`}
                  className="flex flex-col gap-3"
                >
                  {ordersStatusTab === "pending" && ordersForStatusTab.length > 0 && selectedOrders.length > 0 ? (
                    <div className="flex w-full min-w-0 items-stretch overflow-hidden rounded-xl border border-neutral-200/90 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900/85 dark:shadow-none">
                      <div className="flex min-w-0 flex-1 items-center px-3 py-2.5 sm:px-4">
                        <span
                          className="min-w-0 truncate text-xs font-medium leading-snug text-neutral-700 dark:text-slate-200"
                          title={
                            selectedOrders.length === 1
                              ? "1 order selected"
                              : `${selectedOrders.length} orders selected`
                          }
                          aria-live="polite"
                          aria-atomic="true"
                        >
                          {selectedOrders.length === 1
                            ? "1 order selected"
                            : `${selectedOrders.length} orders selected`}
                        </span>
                      </div>
                      <div className="flex min-w-0 shrink-0 divide-x divide-neutral-200/90 border-l border-neutral-200/90 dark:divide-slate-600 dark:border-slate-600 [&_button]:!rounded-none [&_button]:!shadow-none [&_button]:min-h-11 [&_button]:shrink-0 [&_button]:border-0 [&_button]:gap-1.5 [&_button]:px-3 [&_button]:text-sm sm:[&_button]:min-h-10 sm:[&_button]:gap-2 sm:[&_button]:px-4">
                        {ordersRole === "seller" ? (
                          <Button
                            type="button"
                            variant="primary"
                            disabled={!ordersAcceptEnabled}
                            loading={ordersBulkActionLoadingTransition === "seller_accept"}
                            loadingLabel="Working…"
                            onClick={() => {
                              void applyTransitionToSelectedOrders("seller_accept", "Accepted");
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-4 w-4 shrink-0 opacity-95"
                              aria-hidden
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                            Accept
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="danger"
                          disabled={!ordersDeclineEnabled}
                          loading={ordersBulkActionLoadingTransition === "cancel"}
                          loadingLabel="Working…"
                          onClick={() => {
                            setOrderCancelReasonId("");
                            setOrderCancelNote("");
                            setOrderCancelReasonModalOpen(true);
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4 shrink-0 opacity-95"
                            aria-hidden
                          >
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {!ordersFetchError && !(ordersLoading && orders.length === 0) && orders.length > 0 && ordersForStatusTab.length === 0 ? (
              <ScreenEmpty
                spacious={false}
                className="!py-8"
                title={
                  activeView === VIEWS.MY_PURCHASES
                    ? `No ${ORDERS_STATUS_TABS.find((t) => t.id === ordersStatusTab)?.label || ""} purchases`
                    : `No ${ORDERS_STATUS_TABS.find((t) => t.id === ordersStatusTab)?.label || ""} orders`
                }
                description={
                  activeView === VIEWS.MY_PURCHASES
                    ? "Pick another status tab above - your orders move as sellers accept and you complete pickup or delivery."
                    : "Pick another tab - new orders start in Pending, then move when you accept or complete them."
                }
                primaryAction={{ label: "Browse marketplace", onClick: goBrowse }}
                secondaryAction={
                  activeView === VIEWS.MY_PURCHASES
                    ? { label: "View cart", onClick: goCart }
                    : { label: "Upload", onClick: openUploadAtTop }
                }
              />
            ) : null}
            {ordersRole === "seller" &&
            ordersStatusTab === "pending" &&
            !ordersFetchError &&
            !(ordersLoading && orders.length === 0) &&
            orders.length > 0 &&
            ordersForStatusTab.length === 0 &&
            orders.some((o) => orderMatchesOrdersStatusTab(o.status, "processing")) ? (
              <p className="mt-2 text-center text-xs leading-relaxed text-neutral-600 dark:text-slate-400">
                You may have orders in{" "}
                <button
                  type="button"
                  className="font-semibold text-brand-primary underline decoration-brand-primary/40 underline-offset-2 dark:text-brand-accent"
                  onClick={() => setOrdersStatusTab("processing")}
                >
                  Processing
                </button>{" "}
              
              </p>
            ) : null}
            {!ordersFetchError && ordersForStatusTab.length > 0 ? (
              <div className="space-y-3">
                {Object.entries(
                  ordersForStatusTab.reduce((acc, order) => {
                    const groupKey =
                      ordersRole === "seller"
                        ? String(order.buyerId || "unknown")
                        : String(order.sellerId || "unknown");
                    if (!acc[groupKey]) acc[groupKey] = [];
                    acc[groupKey].push(order);
                    return acc;
                  }, {}),
                ).map(([groupPartyId, groupedOrders]) => {
                  const partyRoleLabel = ordersRole === "seller" ? "Buyer" : "Seller";
                  const groupUser = usersList.find((u) => String(u?.id || "") === String(groupPartyId || ""));
                  const orderedSellerOrders = [...groupedOrders].sort((a, b) => {
                    const aId = String(a?.id || "");
                    const bId = String(b?.id || "");
                    const aIdx = ordersTabRecentPendingIds.indexOf(aId);
                    const bIdx = ordersTabRecentPendingIds.indexOf(bId);
                    const aRecent = aIdx >= 0;
                    const bRecent = bIdx >= 0;
                    if (aRecent && bRecent) return bIdx - aIdx; // latest bought first
                    if (aRecent) return -1;
                    if (bRecent) return 1;
                    return 0;
                  });
                  const usernameLabel = String(groupUser?.username || "").trim()
                    ? `@${String(groupUser.username).trim()}`
                    : "";
                  const orderUsernameLabel =
                    groupedOrders
                      .map((order) => {
                        const raw =
                          ordersRole === "seller"
                            ? order?.buyerUsername || order?.buyer?.username || order?.buyerName || ""
                            : order?.sellerUsername || order?.seller?.username || order?.sellerName || "";
                        const normalized = String(raw || "").trim();
                        if (!normalized) return "";
                        return normalized.startsWith("@") ? normalized : `@${normalized}`;
                      })
                      .find((label) => String(label || "").trim().length > 0) || "";
                  const isCurrentUserParty = String(groupPartyId || "") === String(user?.id || "");
                  const currentUserUsernameLabel = String(user?.username || "").trim()
                    ? `@${String(user.username).trim()}`
                    : "";
                  const listingPartyLabel =
                    groupedOrders
                      .map((order) =>
                        ordersRole === "seller"
                          ? orderListingsById[String(order.listingId)]?.buyerLabel
                          : orderListingsById[String(order.listingId)]?.sellerLabel,
                      )
                      .find((label) => String(label || "").trim().length > 0) || "";
                  const looksLikeFallbackIdLabel = /^(seller|buyer)\s+[a-f0-9]{6,}$/i.test(String(listingPartyLabel || "").trim());
                  const sellerLabel = usernameLabel
                    ? usernameLabel
                    : orderUsernameLabel
                      ? orderUsernameLabel
                    : isCurrentUserParty && currentUserUsernameLabel
                      ? currentUserUsernameLabel
                    : listingPartyLabel && !looksLikeFallbackIdLabel
                      ? listingPartyLabel
                      : groupPartyId && groupPartyId !== "unknown"
                        ? `${partyRoleLabel} ${groupPartyId.slice(0, 8)}`
                        : `Unknown ${partyRoleLabel.toLowerCase()}`;
                  const shouldMergeBuyerRows =
                    ordersRole === "buyer" && !["completed", "cancelled"].includes(String(ordersStatusTab || ""));
                  const mergedSellerOrders =
                    shouldMergeBuyerRows
                      ? orderedSellerOrders.reduce((acc, o) => {
                          const listing = orderListingsById[String(o.listingId)] || null;
                          const orderedQty = Math.max(1, Number(o.quantity) || 1);
                          const enriched = enrichListingSnapshotForOrderCard(o, listing);
                          const unitAtOrder = orderLineUnitPriceCents(o);
                          const cardListing = listing
                            ? { ...listing, ...enriched, priceCents: unitAtOrder, quantity: orderedQty }
                            : {
                                id: o.listingId,
                                title: enriched.title,
                                priceCents: unitAtOrder,
                                quantity: orderedQty,
                                fulfillmentModes: [o.fulfillmentType],
                                imageUrl: enriched.imageUrl,
                                imageUrls: enriched.imageUrls,
                                description: "",
                                sellerId: o.sellerId,
                              };
                          const mergeKey = buyerPendingOrderMergeKey(o);
                          const existing = acc.find((entry) => entry.mergeKey === mergeKey);
                          if (!existing) {
                            const maxAvailableQty = Number.isFinite(Number(listing?.quantity))
                              ? Math.max(1, Number(listing.quantity))
                              : orderedQty;
                            const clampedQty = Math.min(orderedQty, maxAvailableQty);
                            const unitPriceCents = Math.max(0, Number(cardListing.priceCents) || 0);
                            acc.push({
                              mergeKey,
                              representativeOrder: o,
                              orderIds: [String(o.id || "")],
                              rawTotalQty: orderedQty,
                              maxAvailableQty,
                              cardListing: { ...cardListing, quantity: clampedQty },
                              mergedGoodsCents: unitPriceCents * clampedQty,
                              mergedDeliveryCents: Math.max(0, Number(o.codDeliveryCents) || 0),
                            });
                            return acc;
                          }
                          existing.orderIds.push(String(o.id || ""));
                          existing.representativeOrder = betterRepresentativeOrderForVariants(
                            existing.representativeOrder,
                            o,
                          );
                          existing.rawTotalQty += orderedQty;
                          existing.maxAvailableQty = Number.isFinite(Number(listing?.quantity))
                            ? Math.max(1, Number(listing.quantity))
                            : existing.maxAvailableQty;
                          const clampedQty = Math.min(existing.rawTotalQty, existing.maxAvailableQty);
                          const unitPriceCents = Math.max(0, Number(existing.cardListing.priceCents) || 0);
                          existing.cardListing = { ...existing.cardListing, quantity: clampedQty };
                          existing.mergedGoodsCents = unitPriceCents * clampedQty;
                          existing.mergedDeliveryCents += Math.max(0, Number(o.codDeliveryCents) || 0);
                          return acc;
                        }, [])
                      : orderedSellerOrders.map((o) => {
                          const listing = orderListingsById[String(o.listingId)] || null;
                          const orderedQty = Math.max(1, Number(o.quantity) || 1);
                          const enriched = enrichListingSnapshotForOrderCard(o, listing);
                          const unitAtOrder = orderLineUnitPriceCents(o);
                          const cardListing = listing
                            ? { ...listing, ...enriched, priceCents: unitAtOrder, quantity: orderedQty }
                            : {
                                id: o.listingId,
                                title: enriched.title,
                                priceCents: unitAtOrder,
                                quantity: orderedQty,
                                fulfillmentModes: [o.fulfillmentType],
                                imageUrl: enriched.imageUrl,
                                imageUrls: enriched.imageUrls,
                                description: "",
                                sellerId: o.sellerId,
                              };
                          return {
                            mergeKey: String(o.id || ""),
                            representativeOrder: o,
                            orderIds: [String(o.id || "")],
                            cardListing,
                          };
                        });
                  const sellerOrderIds = mergedSellerOrders.flatMap((entry) => entry.orderIds).filter(Boolean);
                  const sellerSelectedCount = sellerOrderIds.filter((id) => orderSelection[id]).length;
                  const sellerAllSelected = sellerOrderIds.length > 0 && sellerSelectedCount === sellerOrderIds.length;
                  const sellerSomeSelected = sellerSelectedCount > 0 && !sellerAllSelected;
                  return (
                    <div key={groupPartyId} className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        {ordersStatusTab === "pending" ? (
                          <CartSellerSelectAllCheckbox
                            allChecked={sellerAllSelected}
                            someSelected={sellerSomeSelected}
                            onChange={() => toggleOrderSellerSelectAll(orderedSellerOrders)}
                            ariaLabel={`Select all orders for ${sellerLabel}`}
                          />
                        ) : null}
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600 md:text-xs dark:text-slate-300">
                          {sellerLabel}
                        </p>
                      </div>
                      <div
                        className={`${commerceFlowLineItemsClass(commerceFlowOrdersView, {
                          variant: "orders",
                        })} ${lmBrowseViewShellClass(commerceFlowOrdersView === "list" ? "list" : "grid")} ${
                          commerceFlowOrdersView === "list" ? "" : "grid-cols-2"
                        }`}
                      >
                        {mergedSellerOrders.map((entry) => {
                          const o = entry.representativeOrder;
                          const cardListing = entry.cardListing;
                          const cfList = commerceFlowOrdersView === "list";
                          const cfCompact = commerceFlowOrdersView === "compact";
                          const multicolOrderCard = !cfList;
                          /** Match cart line items + community feed card (`LazyCommunityShopListingCard` mobile grid). */
                          const orderThumbList =
                            "aspect-[4/3] w-[6.5rem] min-[400px]:aspect-square min-[400px]:h-[7.5rem] min-[400px]:w-[7.5rem] min-[400px]:max-h-[7.5rem] min-[400px]:max-w-[7.5rem] min-[400px]:shrink-0";
                          const orderThumbGrid = "lm-product-card-media aspect-square w-full min-h-0";
                          const mergedVariantSig = pickMergedOrderVariantSignature(entry, orders);
                          const buyerCommentRaw = pickMergedOrderCommentForVariantChips(entry, orders);
                          const orderCommentRow = buyerCommentDisplayForOrderCard(buyerCommentRaw, mergedVariantSig);
                          const orderVariantPick = narrowListingOptionValuesForBuyerSelection({
                            comment: buyerCommentRaw,
                            variantSignature: mergedVariantSig,
                            optionNameA: cardListing.optionNameA,
                            optionValuesA: cardListing.optionValuesA,
                            optionNameB: cardListing.optionNameB,
                            optionValuesB: cardListing.optionValuesB,
                          });
                          const orderId = String(o.id || "");
                          const pickupBuyerAckOrderIds = entry.orderIds.filter((id) => {
                            const ord = orders.find((x) => String(x.id) === id);
                            return (
                              ord &&
                              String(ord.status || "") === "ready_for_pickup" &&
                              !ord.buyerReceiptAcknowledgedAt
                            );
                          });
                          const sellerReadyPickupOrderIds = entry.orderIds.filter((id) => {
                            const ord = orders.find((x) => String(x.id) === id);
                            return (
                              ord &&
                              String(ord.status || "") === "seller_accepted" &&
                              ord.fulfillmentType === "pickup"
                            );
                          });
                          const fulfillmentBanner = orderFulfillmentBannerText(o, ordersRole);
                          const unseenIdsForTab = ordersTabBadgeIdsByTab[ordersStatusTab] || [];
                          const orderIdNeedsAttention = (oid) => {
                            const sid = String(oid || "");
                            return Boolean(sid && unseenIdsForTab.some((x) => String(x) === sid));
                          };
                          const shouldHighlightRecent =
                            RECENT_ORDER_TAB_KEYS.includes(String(ordersStatusTab)) &&
                            entry.orderIds.some(orderIdNeedsAttention);
                          const rowAllSelected = entry.orderIds.length > 0 && entry.orderIds.every((id) => Boolean(orderSelection[id]));
                          const completedHistoryRow =
                            ordersStatusTab === "completed" && String(o.status || "") === "completed";
                          /** Avoid an empty footer shell in list view (stacked `gap` + `mt`/`pt` looked like a large dead zone). */
                          const orderCardFooterHasChrome =
                            Boolean(completedHistoryRow) ||
                            (ordersRole === "buyer" &&
                              ordersStatusTab === "completed" &&
                              String(o.status || "") === "completed") ||
                            (ordersRole === "seller" &&
                              ordersStatusTab === "completed" &&
                              Boolean(o.buyerReview?.rating)) ||
                            (ordersRole === "buyer" &&
                              String(o.status || "") === "ready_for_pickup" &&
                              o.fulfillmentType === "pickup") ||
                            (ordersRole === "seller" && String(o.status || "") === "ready_for_pickup") ||
                            (ordersRole === "seller" && isDeliverySellerPreparing(o)) ||
                            (ordersRole === "buyer" && isDeliverySellerPreparing(o)) ||
                            (ordersRole === "seller" && isDeliveryCourierAssigned(o)) ||
                            (ordersRole === "buyer" && isDeliveryCourierAssigned(o)) ||
                            (ordersRole === "seller" &&
                              String(o.status || "") === "seller_accepted" &&
                              o.fulfillmentType === "pickup") ||
                            (ordersRole === "buyer" &&
                              String(o.status || "") === "seller_accepted" &&
                              o.fulfillmentType === "pickup") ||
                            isDeliveryInTransit(o);
                          const orderCardHighlight = shouldHighlightRecent ? "bg-primary-soft dark:bg-primary/15" : "";
                          const orderListingForProductOpen =
                            orderListingsById[String(o.listingId)] ||
                            (cardListing?.id ? cardListing : null);
                          const openOrderProductInspect = () => {
                            const L = orderListingForProductOpen;
                            if (!L?.id) {
                              pushMarketplaceToast("Listing details are not available.");
                              return;
                            }
                            const listingForInspect = {
                              ...L,
                              id: String(L.id),
                              priceCents: orderLineUnitPriceCents(o),
                            };
                            const stockAvail =
                              L.quantity != null && Number(L.quantity) >= 0
                                ? Math.max(0, Number(L.quantity))
                                : 0;
                            const isBuyer = ordersRole === "buyer";
                            openProductInspect(listingForInspect, {
                              quantity: Math.max(1, Number(cardListing.quantity) || Number(o.quantity) || 1),
                              comment: buyerCommentRaw,
                              commentSectionRequired: false,
                              commentHeading: isBuyer ? "Your note to the seller" : "Buyer note",
                              subtitle: activeView === VIEWS.MY_PURCHASES ? "Purchase" : "Order",
                              listingStockQty: stockAvail,
                              showBuyerCommerceActions: isBuyer,
                              orderTimelineOrder: o,
                              orderTimelineOrderIds: entry.orderIds,
                              orderTimelineContextTab: ordersStatusTab,
                              orderTimelineViewerRole: ordersRole,
                              ...(isBuyer
                                ? {
                                    onAddToCart: () => openQuickAddModal(listingForInspect, "cart"),
                                    onBuyNow: () => openQuickAddModal(listingForInspect, "buy"),
                                  }
                                : {}),
                            });
                          };
                          const orderCardBody = (
                            <div className="flex min-w-0 flex-col gap-1.5">
                              {shouldHighlightRecent ? (
                                <span className="inline-flex w-fit max-w-full shrink-0 self-start items-center rounded-full border border-emerald-400/90 bg-emerald-200/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900 dark:border-emerald-400/60 dark:bg-emerald-500/25 dark:text-emerald-200">
                                  Recently updated
                                </span>
                              ) : null}
                              <DeferredProductDetailStack
                                variant="card"
                                browseStackMode={cfList ? "listMobile" : null}
                                compactListMeta={cfList}
                                title={cardListing.title || "Product"}
                                priceCents={cardListing.priceCents}
                                description={cardListing.description}
                                hideDescription
                                hideAvailability
                                fulfillmentModes={cardListing.fulfillmentModes}
                                orderType={cardListing.orderType}
                                processingTime={cardListing.processingTime}
                                optionNameA={cardListing.optionNameA}
                                optionValuesA={orderVariantPick.optionValuesA}
                                optionNameB={cardListing.optionNameB}
                                optionValuesB={orderVariantPick.optionValuesB}
                                listingMetaDensity="compact"
                              />
                              <div
                                className={`space-y-1 leading-tight text-neutral-600 dark:text-slate-400 ${
                                  cfCompact ? "text-[10px] md:text-[11px]" : "text-[11px] md:text-xs md:leading-snug"
                                }`}
                              >
                                <p className="text-pretty">
                                  <span className="font-medium text-neutral-700 dark:text-slate-300">Quantity</span>{" "}
                                  <span className="font-semibold tabular-nums text-neutral-600 dark:text-slate-400">
                                    {Number(cardListing.quantity) || 1}
                                  </span>
                                </p>
                                <div className="space-y-0.5 text-pretty text-neutral-600 dark:text-slate-400">
                                  <p>
                                    <span className="font-medium text-neutral-600 dark:text-slate-300">Fulfillment</span>
                                    <span className="text-neutral-500 dark:text-slate-500">: </span>
                                    <span className="text-neutral-800 dark:text-slate-200">
                                      {o.fulfillmentType === "delivery" ? "Delivery" : "Pickup"}
                                    </span>
                                  </p>
                                  <p>
                                    <span className="font-medium text-neutral-600 dark:text-slate-300">Total</span>
                                    <span className="text-neutral-500 dark:text-slate-500">: </span>
                                    <span className="tabular-nums font-semibold text-neutral-700 dark:text-slate-300">
                                      {formatCents(
                                        Math.max(0, Number(entry.mergedGoodsCents ?? o.codGoodsCents) || 0) +
                                          Math.max(0, Number(entry.mergedDeliveryCents ?? o.codDeliveryCents) || 0),
                                      )}
                                    </span>
                                  </p>
                                </div>
                                {orderCommentRow.show ? (
                                  <p className="line-clamp-2 text-pretty">
                                    <span className="font-medium text-neutral-700 dark:text-slate-300">
                                      {orderCommentRow.label === "Comment" ? "Buyer comment" : orderCommentRow.label}
                                    </span>
                                    : {orderCommentRow.text}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          );
                          return (
                            <div
                              key={`${groupPartyId}:${entry.mergeKey}`}
                              className={`transition duration-200 ease-in-out ${
                                cfList
                                  ? `relative lm-card lm-list-card lm-product-card-list flex cursor-pointer flex-col gap-3 p-3 hover:bg-neutral-50/70 md:gap-3.5 dark:hover:bg-slate-800/35 ${orderCardHighlight}`
                                  : `relative lm-card lm-grid-card lm-product-card lm-product-card--feed lm-commerce-order-card flex h-full min-h-0 flex-1 cursor-pointer flex-col overflow-hidden p-0 hover:bg-neutral-50/50 dark:hover:bg-slate-800/30 ${orderCardHighlight}`
                              }`}
                              onClick={openOrderProductInspect}
                            >
                              {ordersStatusTab === "pending" ? (
                                <input
                                  type="checkbox"
                                  className={`h-4 w-4 shrink-0 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary/35 dark:border-slate-500 ${
                                    cfList
                                      ? "absolute left-4 top-4 z-10 bg-white/90 dark:bg-slate-900/90"
                                      : "absolute left-2 top-2 z-10 bg-white/90 dark:bg-slate-900/90"
                                  }`}
                                  checked={rowAllSelected}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() => {
                                    const nextChecked = !rowAllSelected;
                                    setOrderSelection((prev) => {
                                      const next = { ...prev };
                                      for (const id of entry.orderIds) {
                                        if (!id) continue;
                                        if (nextChecked) next[id] = true;
                                        else delete next[id];
                                      }
                                      return next;
                                    });
                                  }}
                                  aria-label={`Select order ${orderId}${entry.orderIds.length > 1 ? " group" : ""}`}
                                />
                              ) : null}
                              {cfList ? (
                                <div className="flex w-full min-w-0 items-start gap-3">
                                  <div
                                    className={`lm-product-media lm-product-media--soft relative ${orderThumbList} shrink-0 overflow-hidden rounded-md transition hover:opacity-95`}
                                  >
                                    <ProductListingMedia
                                      listing={cardListing}
                                      variant="list"
                                      className="absolute inset-0 min-h-0"
                                      loading="lazy"
                                      sizes="(max-width: 768px) 22vw, min(112px, 10vw)"
                                    />
                                  </div>
                                  <div className="flex w-full min-w-0 flex-1 flex-col gap-1 rounded-lg text-left min-[400px]:min-w-0">
                                    {orderCardBody}
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div
                                    className={`${orderThumbGrid} lm-product-card--tap relative block w-full overflow-hidden rounded-none border-0 bg-transparent p-0`}
                                  >
                                    <ProductListingMedia
                                      listing={cardListing}
                                      variant="grid"
                                      className="absolute inset-0 min-h-0"
                                      loading="lazy"
                                      sizes="(max-width: 768px) 45vw, min(240px, 22vw)"
                                    />
                                  </div>
                                  <div className="lm-product-card-body flex w-full flex-col border-0 bg-transparent text-left">
                                    {orderCardBody}
                                  </div>
                                </>
                              )}
                              {orderCardFooterHasChrome ? (
                              <div
                                className={`text-sm ${
                                  multicolOrderCard
                                    ? "mt-1.5 space-y-1 pt-1.5 md:mt-2 md:space-y-1.5 md:pt-2"
                                    : cfList
                                      ? "space-y-1.5 md:space-y-2"
                                      : "mt-2 space-y-1.5 pt-1.5 md:mt-3 md:space-y-2 md:pt-2"
                                } ${cfList ? "" : "px-2 pb-2 min-[400px]:px-2.5 min-[400px]:pb-2.5"}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {completedHistoryRow ? (
                                  <p className="text-pretty text-[11px] leading-snug text-neutral-600 dark:text-slate-400">
                                    <span className="font-medium text-neutral-800 dark:text-slate-200">Completed</span>
                                  </p>
                                ) : null}
                                {ordersRole === "buyer" && ordersStatusTab === "completed" && String(o.status || "") === "completed" ? (
                                  <div
                                    className={`flex flex-col rounded-lg border border-neutral-200/70 bg-white/50 dark:border-slate-600/80 dark:bg-slate-900/30 ${
                                      multicolOrderCard
                                        ? "gap-1.5 p-2 md:gap-2 md:p-2.5"
                                        : "gap-2 p-2.5 md:gap-3 md:p-3"
                                    }`}
                                  >
                                    <div className="min-w-0 space-y-1">
                                      {o.buyerReceiptAcknowledgedAt ? (
                                        <p className="text-pretty text-[11px] leading-snug text-neutral-500 dark:text-slate-500">
                                          You marked this pickup order as picked up.
                                        </p>
                                      ) : null}
                                    </div>
                                    <div
                                      className={
                                        multicolOrderCard
                                          ? "flex flex-col gap-1 md:flex-row md:flex-wrap md:justify-end md:gap-1.5"
                                          : "-mx-0.5 flex gap-2 overflow-x-auto pb-0.5 md:mx-0 md:flex-wrap md:justify-end md:overflow-visible md:pb-0"
                                      }
                                    >
                                      <button
                                        type="button"
                                        className={`btn-secondary w-full touch-manipulation whitespace-nowrap md:w-auto ${
                                          multicolOrderCard
                                            ? "min-h-9 shrink-0 px-2.5 py-1.5 text-[11px] md:min-h-0"
                                            : "min-h-10 shrink-0 px-3 text-xs md:min-h-0"
                                        }`}
                                        onClick={() => {
                                          const L = orderListingsById[String(o.listingId)];
                                          if (!L?.id) {
                                            pushMarketplaceToast("Listing is unavailable — it may have been removed.");
                                            return;
                                          }
                                          openListingFromPurchasedOrder(L);
                                        }}
                                      >
                                        View listing
                                      </button>
                                      <button
                                        type="button"
                                        className={`btn-secondary w-full touch-manipulation whitespace-nowrap md:w-auto ${
                                          multicolOrderCard
                                            ? "min-h-9 shrink-0 px-2.5 py-1.5 text-[11px] md:min-h-0"
                                            : "min-h-10 shrink-0 px-3 text-xs md:min-h-0"
                                        }`}
                                        onClick={() => {
                                          const L = orderListingsById[String(o.listingId)];
                                          if (!L?.id) {
                                            pushMarketplaceToast("Listing is unavailable — it may have been removed.");
                                            return;
                                          }
                                          openQuickAddModal(L, "cart");
                                        }}
                                      >
                                        Buy again
                                      </button>
                                      <button
                                        type="button"
                                        className={`btn-secondary w-full touch-manipulation whitespace-nowrap md:w-auto ${
                                          multicolOrderCard
                                            ? "min-h-9 shrink-0 px-2.5 py-1.5 text-[11px] md:min-h-0"
                                            : "min-h-10 shrink-0 px-3 text-xs md:min-h-0"
                                        }`}
                                        onClick={() => {
                                          setActiveView(VIEWS.MESSAGES);
                                          pushMarketplaceToast("Messaging is coming soon — you will reach the seller from here.");
                                        }}
                                      >
                                        Message seller
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                                {ordersRole === "buyer" && ordersStatusTab === "completed" && String(o.status || "") === "completed" ? (
                                  <Suspense fallback={null}>
                                    <LazyOrderBuyerReviewForm
                                      orderId={o.id}
                                      initialReview={o.buyerReview}
                                      onSubmit={submitOrderReview}
                                      disabled={!token}
                                      compact={multicolOrderCard}
                                    />
                                  </Suspense>
                                ) : null}
                                {ordersRole === "seller" && ordersStatusTab === "completed" && o.buyerReview?.rating ? (
                                  <div
                                    className={`rounded-lg border border-neutral-200/80 bg-neutral-50/60 dark:border-slate-600 dark:bg-slate-900/40 ${
                                      multicolOrderCard ? "px-2 py-1.5 text-[11px]" : "px-3 py-2 text-xs"
                                    }`}
                                  >
                                    <p className="font-medium text-neutral-800 dark:text-slate-200">
                                      Buyer rated this order {o.buyerReview.rating} / 5
                                    </p>
                                    {o.buyerReview.reviewText ? (
                                      <p className="mt-1 whitespace-pre-wrap break-words text-pretty text-neutral-600 dark:text-slate-400">
                                        {o.buyerReview.reviewText}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : null}
                                <div className={`flex flex-col ${multicolOrderCard ? "gap-1.5" : "gap-2"}`}>
                                  {fulfillmentBanner ? (
                                    <p
                                      className={`text-pretty text-[11px] leading-snug md:text-xs ${
                                        ordersRole === "buyer" &&
                                        (String(o.status || "") === "seller_accepted" ||
                                          String(o.status || "") === "courier_assigned")
                                          ? "text-neutral-600 dark:text-slate-400"
                                          : "font-medium text-neutral-800 dark:text-slate-200"
                                      }`}
                                    >
                                      {fulfillmentBanner}
                                    </p>
                                  ) : null}
                                  <div
                                    className={`flex w-full flex-col md:flex-row md:flex-wrap md:items-center ${
                                      multicolOrderCard ? "gap-1.5" : "gap-2"
                                    }`}
                                  >
                                  {ordersRole === "seller" &&
                                  String(o.status || "") === "seller_accepted" &&
                                  o.fulfillmentType === "pickup" &&
                                  sellerReadyPickupOrderIds.length > 0 ? (
                                    <button
                                      type="button"
                                      className="btn-secondary min-h-11 w-full touch-manipulation text-xs md:w-auto md:min-h-0"
                                      onClick={() =>
                                        patchOrderTransition(sellerReadyPickupOrderIds[0], "mark_ready_for_pickup", {
                                          orderIds: sellerReadyPickupOrderIds,
                                          successMessage: "Marked ready for pickup.",
                                        })
                                      }
                                    >
                                      Ready for Pickup
                                    </button>
                                  ) : null}
                                  {ordersRole === "seller" && String(o.status || "") === "ready_for_pickup" ? (
                                    <button
                                      type="button"
                                      className={`btn-secondary min-h-11 w-full touch-manipulation text-xs md:w-auto md:min-h-0 ${
                                        multicolOrderCard ? "min-h-9 px-2.5 py-1.5 text-[11px]" : ""
                                      }`}
                                      onClick={() => {
                                        setActiveView(VIEWS.MESSAGES);
                                        pushMarketplaceToast("Messaging is coming soon — you will reach the buyer from here.");
                                      }}
                                    >
                                      Message buyer
                                    </button>
                                  ) : null}
                                  {ordersRole === "buyer" &&
                                  String(o.status || "") === "ready_for_pickup" &&
                                  o.fulfillmentType === "pickup" &&
                                  pickupBuyerAckOrderIds.length > 0 ? (
                                    <button
                                      type="button"
                                      className={`btn-secondary w-full touch-manipulation whitespace-nowrap md:w-auto md:min-h-0 ${
                                        multicolOrderCard
                                          ? "min-h-9 shrink-0 px-2.5 py-1.5 text-[11px] md:min-h-0"
                                          : "min-h-10 shrink-0 px-3 text-xs md:min-h-0"
                                      }`}
                                      onClick={() =>
                                        patchOrderTransition(pickupBuyerAckOrderIds[0], "buyer_ack_receipt", {
                                          orderIds: pickupBuyerAckOrderIds,
                                          successMessage: "Marked as picked up. Order completed.",
                                        })
                                      }
                                    >
                                      Mark as Picked Up
                                    </button>
                                  ) : null}
                                  {ordersRole === "seller" && isDeliverySellerPreparing(o) ? (
                                    <button
                                      type="button"
                                      className="btn-secondary min-h-11 w-full touch-manipulation text-xs md:w-auto md:min-h-0"
                                      onClick={() =>
                                        patchOrderTransition(o.id, "seller_self_out_for_delivery", {
                                          successMessage: "Marked out for delivery.",
                                        })
                                      }
                                    >
                                      I&apos;ll deliver myself
                                    </button>
                                  ) : null}
                                  {ordersRole === "seller" && isDeliveryCourierAssigned(o) ? (
                                    <button
                                      type="button"
                                      className="btn-secondary min-h-11 w-full touch-manipulation text-xs md:w-auto md:min-h-0"
                                      onClick={() =>
                                        patchOrderTransition(o.id, "mark_out_for_delivery", {
                                          successMessage: "Marked out for delivery.",
                                        })
                                      }
                                    >
                                      Out for Delivery
                                    </button>
                                  ) : null}
                                  {ordersRole === "buyer" && isDeliveryInTransit(o) ? (
                                    <button
                                      type="button"
                                      className="btn-secondary min-h-11 w-full touch-manipulation text-xs md:w-auto md:min-h-0"
                                      onClick={() =>
                                        patchOrderTransition(o.id, "mark_delivered", {
                                          successMessage: "Marked as received. Enjoy your order!",
                                        })
                                      }
                                    >
                                      Mark as Received
                                    </button>
                                  ) : null}
                                  </div>
                                </div>
                              </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
            {!ordersFetchError && ordersLoading && orders.length === 0 ? (
              <ScreenLoading message="Loading orders…" />
            ) : null}
            {!ordersFetchError && !(ordersLoading && orders.length === 0) && orders.length === 0 ? (
              <ScreenEmpty
                title={activeView === VIEWS.MY_PURCHASES ? "No purchases yet" : "No orders yet"}
                description={
                  activeView === VIEWS.MY_PURCHASES
                    ? "Orders you place with sellers show up here with status updates for pickup or delivery."
                    : "When buyers order your listings, you’ll accept or decline here and track each stage."
                }
                primaryAction={{ label: "Browse marketplace", onClick: goBrowse }}
                secondaryAction={
                  activeView === VIEWS.MY_PURCHASES
                    ? { label: "View cart", onClick: goCart }
                    : { label: "Upload", onClick: openUploadAtTop }
                }
              />
            ) : null}
          </section>
        )}

        {activeView === VIEWS.COURIER && (
          <section className={`${UI_KIT.viewSection} max-w-3xl space-y-6 md:space-y-8`}>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Courier hub</h2>
              <p className="text-sm leading-relaxed text-neutral-600 dark:text-slate-400">
                Claim open runs, set your availability, assign couriers from your sales or purchases — separate from the main Orders list. Coordinate meetups in chat; cash on delivery at handoff.
              </p>
            </div>
            {!token ? (
              <ScreenEmpty
                title="Sign in to use Courier"
                description="Open the menu to sign in, then return here for availability, open deliveries, and assigning community couriers."
                primaryAction={{
                  label: "Sign in",
                  onClick: () => {
                    setAuthMode("login");
                    setAuthPanelVisible(true);
                  },
                }}
              />
            ) : (
              <>
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Courier hub">
                  {[
                    { id: COURIER_TABS.DELIVER, label: "Deliver", count: courierOpenDeliveryCount },
                    { id: COURIER_TABS.SELL, label: "Your sales", count: courierSellerAssignOrders.length },
                    { id: COURIER_TABS.BUY, label: "Your purchases", count: courierBuyerAssignOrders.length },
                  ].map(({ id, label, count }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={courierTab === id}
                      className={`inline-flex min-h-[44px] items-center rounded-full px-4 py-2 text-sm font-medium transition md:min-h-0 md:px-3 md:py-1.5 ${
                        courierTab === id
                          ? UI_KIT.tabActive
                          : "border-0 bg-neutral-100/55 text-neutral-600 hover:bg-neutral-100 dark:bg-slate-800/55 dark:text-slate-400 dark:hover:bg-slate-800 md:border md:border-neutral-200/85 md:bg-transparent md:hover:bg-neutral-50 dark:md:border-slate-600"
                      }`}
                      onClick={() => setCourierTab(id)}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span>{label}</span>
                        {count > 0 ? (
                          <span className="inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-neutral-900/10 px-1.5 text-[10px] font-semibold tabular-nums text-neutral-800 dark:bg-slate-100/15 dark:text-slate-100">
                            {count > 99 ? "99+" : count}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
                {courierTab === COURIER_TABS.DELIVER ? (
                  <CourierPresenceControls
                    token={token}
                    communityId={String(user?.communityId || joinedShopCommunityId || "").trim()}
                    onOrdersRefresh={refreshCourierAndOrders}
                  />
                ) : null}
                {courierTab === COURIER_TABS.SELL ? (
                  <div className="space-y-3 rounded-xl border border-neutral-200/80 bg-white/60 p-4 dark:border-slate-600/70 dark:bg-slate-900/40 md:p-5">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">Assign from your sales</h3>
                      <p className="text-sm text-neutral-600 dark:text-slate-400">
                        Pick a neighbor courier or mark yourself out for delivery. Same orders appear under Seller · Orders.
                      </p>
                    </div>
                    {courierHubLoading ? (
                      <ScreenLoading message="Loading…" />
                    ) : courierSellerAssignOrders.length === 0 ? (
                      <p className="text-sm text-neutral-600 dark:text-slate-400">
                        Nothing waiting for a courier. When you accept a buyer&apos;s delivery order, it shows here until someone is assigned or you deliver yourself.
                      </p>
                    ) : (
                      <ul className="space-y-4">
                        {courierSellerAssignOrders.map((o) => (
                          <li
                            key={String(o.id)}
                            className="rounded-lg border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-slate-600/60 dark:bg-slate-900/50"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-neutral-900 dark:text-slate-100">
                                  {o.listingTitle || "Listing"}
                                </p>
                                <p className="text-[11px] text-neutral-600 dark:text-slate-400">
                                  Total{" "}
                                  <span className="tabular-nums font-medium">
                                    {formatCents(Math.max(0, Number(o.codGoodsCents) || 0) + Math.max(0, Number(o.codDeliveryCents) || 0))}
                                  </span>{" "}
                                  · COD
                                </p>
                              </div>
                              <button
                                type="button"
                                className="btn-secondary min-h-10 w-full shrink-0 touch-manipulation text-xs sm:w-auto sm:min-h-0"
                                onClick={() =>
                                  patchOrderTransition(o.id, "seller_self_out_for_delivery", {
                                    successMessage: "Marked out for delivery.",
                                  })
                                }
                              >
                                I&apos;ll deliver myself
                              </button>
                            </div>
                            <div className="mt-3 border-t border-neutral-200/70 pt-3 dark:border-slate-600/50">
                              <CommunityCourierPanel
                                token={token}
                                communityId={String(
                                  o.listingCommunityId || orderListingsById[String(o.listingId)]?.communityId || "",
                                ).trim()}
                                orderId={o.id}
                                compact={false}
                                onAssigned={refreshCourierAndOrders}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
                {courierTab === COURIER_TABS.BUY ? (
                  <div className="space-y-3 rounded-xl border border-neutral-200/80 bg-white/60 p-4 dark:border-slate-600/70 dark:bg-slate-900/40 md:p-5">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">Suggest a courier on your purchases</h3>
                      <p className="text-sm text-neutral-600 dark:text-slate-400">
                        While the seller prepares, you can suggest a trusted neighbor. They may still assign someone else or deliver themselves — keep everyone in chat.
                      </p>
                    </div>
                    {courierHubLoading ? (
                      <ScreenLoading message="Loading…" />
                    ) : courierBuyerAssignOrders.length === 0 ? (
                      <p className="text-sm text-neutral-600 dark:text-slate-400">
                        No purchases need a courier suggestion right now. After a seller accepts your delivery order, it appears here until a courier is assigned.
                      </p>
                    ) : (
                      <ul className="space-y-4">
                        {courierBuyerAssignOrders.map((o) => (
                          <li
                            key={String(o.id)}
                            className="rounded-lg border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-slate-600/60 dark:bg-slate-900/50"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-neutral-900 dark:text-slate-100">{o.listingTitle || "Listing"}</p>
                              <p className="text-[11px] text-neutral-600 dark:text-slate-400">
                                Total{" "}
                                <span className="tabular-nums font-medium">
                                  {formatCents(Math.max(0, Number(o.codGoodsCents) || 0) + Math.max(0, Number(o.codDeliveryCents) || 0))}
                                </span>{" "}
                                · COD
                              </p>
                            </div>
                            <div className="mt-3 border-t border-neutral-200/70 pt-3 dark:border-slate-600/50">
                              <CommunityCourierPanel
                                token={token}
                                communityId={String(
                                  o.listingCommunityId || orderListingsById[String(o.listingId)]?.communityId || "",
                                ).trim()}
                                orderId={o.id}
                                compact={false}
                                onAssigned={refreshCourierAndOrders}
                                heading="Neighbor couriers"
                                assignButtonLabel="Suggest"
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </section>
        )}

        {activeView === VIEWS.ABOUT && (
          <section className={`${UI_KIT.viewSection} max-w-3xl space-y-4 md:space-y-6`}>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">About LinkMart</h2>
            <p className="text-sm leading-relaxed text-neutral-600 dark:text-slate-400">
              LinkMart is a community marketplace for discovering what is available near you. Commerce is cash-on-delivery or cash at pickup — we do not operate
              an in-app wallet. Delivery can be fulfilled by neighbors who walk, run, or bike; delivery fees are agreed directly between parties. Sellers stay organized
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
                Listings may offer pickup, delivery, or both. Any delivery fee is agreed outside the platform (typically at handoff). The platform coordinates
                information; it does not guarantee delivery times or service quality.
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
          <section className="w-full min-w-0 max-w-none space-y-6 md:space-y-6 lg:space-y-8">
            <div className="grid w-full min-w-0 max-w-none gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-8">
              <div className="min-w-0 space-y-6 bg-transparent p-0 md:space-y-6 lg:rounded-2xl lg:border lg:border-neutral-200/60 lg:bg-white lg:p-5 lg:shadow-sm dark:lg:border-slate-600 dark:lg:bg-slate-900/80">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {!isViewingSellerProfile ? (
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center text-neutral-700 transition hover:text-neutral-900 dark:text-slate-200 dark:hover:text-slate-100 md:hidden"
                        aria-label="Open menu"
                        onClick={() => document.getElementById("mobile-menu-toggle")?.click()}
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <line x1="4" x2="20" y1="6" y2="6" />
                          <line x1="4" x2="20" y1="12" y2="12" />
                          <line x1="4" x2="20" y1="18" y2="18" />
                        </svg>
                      </button>
                    ) : null}
                    <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">
                      {isViewingSellerProfile ? "Seller profile" : "Profile"}
                    </h2>
                  </div>
                  {isViewingSellerProfile ? (
                    <button type="button" className="btn-secondary shrink-0" onClick={goBackFromSellerProfile}>
                      ← Back
                    </button>
                  ) : null}
                  {profileRenderUser && !profileEditing && !isViewingSellerProfile ? (
                    <button
                      type="button"
                      className="btn-secondary hidden min-w-0 shrink-0 md:inline-flex md:w-auto"
                      onClick={openProfileEdit}
                    >
                      Edit profile
                    </button>
                  ) : null}
                </div>
                {profileRenderUser &&
                !profileEditing &&
                !isViewingSellerProfile &&
                user &&
                !buyNowFromProfile.ready &&
                !profileFinishBannerDismissed ? (
                  <ScreenEmpty
                    spacious={false}
                    className="!border-amber-200/85 !bg-amber-50/60 !py-4 dark:!border-amber-900/45 dark:!bg-amber-950/25"
                    title="Finish your profile"
                    description={`Still needed: ${buyNowFromProfile.missing.join(", ")}. Add these so Buy now, cart checkout, and meetup details work.`}
                    primaryAction={{ label: "Complete profile", onClick: openProfileEdit }}
                    onDismiss={() => setProfileFinishBannerDismissed(true)}
                  />
                ) : null}
                {profileRenderUser ? (
              profileEditing ? (
                <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-[2px] md:p-6">
                  <div className={`my-2 max-h-[90vh] w-full max-w-5xl overflow-y-auto overscroll-y-contain p-5 md:my-4 ${UI_KIT.surfaceFloating}`}>
                <form onSubmit={handleProfileSubmit} noValidate className="space-y-3">
                  <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 px-3 py-2 text-xs text-neutral-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                    <span className="font-semibold text-neutral-800 dark:text-slate-100">*</span> Required fields. Optional fields are labeled.
                  </div>
                  <div className={`grid grid-cols-1 items-end gap-4 p-5 md:grid-cols-[minmax(12rem,1fr)_minmax(14rem,1fr)] ${UI_KIT.surfaceRaised}`}>
                    <div className="relative isolate mx-auto h-32 w-32 shrink-0 md:col-span-2 md:self-center">
                      <StableAvatar
                        square
                        src={profileDraft.avatarUrl}
                        alt="Profile avatar preview"
                        initials={(
                          String(profileDraft.username || "").trim().charAt(0) ||
                          String(user?.username || "").trim().charAt(0) ||
                          "?"
                        ).toUpperCase()}
                        className="relative z-0 h-32 w-32 text-3xl ring-2 ring-brand-border"
                        textClassName="text-3xl"
                        sizes="128px"
                      />
                      <input
                        ref={profileAvatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleProfileAvatarChange}
                      />
                      <button
                        type="button"
                        aria-label="Edit avatar"
                        className="absolute bottom-2 right-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/95 bg-neutral-900/95 text-white shadow-lg backdrop-blur-[2px] ring-1 ring-black/10 transition hover:bg-neutral-800 hover:ring-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary dark:border-slate-950/90 dark:bg-slate-100/95 dark:text-slate-900 dark:hover:bg-white dark:ring-white/20"
                        onClick={() => profileAvatarInputRef.current?.click()}
                      >
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                          />
                        </svg>
                      </button>
                    </div>
                    <div className="min-w-0 md:order-1">
                      <label className="label-base" htmlFor="profile-username-inline">
                        Username *
                      </label>
                      <input
                        id="profile-username-inline"
                        name="username"
                        type="text"
                        className="input-base min-h-[44px] w-full min-w-0 text-sm font-semibold md:h-9 md:min-h-0 md:min-w-[13rem]"
                        value={profileDraft.username}
                        onChange={(e) => {
                          const value = e.target.value;
                          setProfileDraft((prev) => ({ ...prev, username: value }));
                          setProfileFieldErrors((prev) => ({ ...prev, username: "" }));
                        }}
                        required
                        minLength={3}
                        maxLength={20}
                        title="3-20 chars, start with a letter, use a-z 0-9 . _ only, no spaces, no duplicate dots/underscores."
                      />
                      {profileFieldErrors.username ? <p className="field-error-text mt-1">{profileFieldErrors.username}</p> : null}
                    </div>
                    <div className="min-w-0 md:order-4">
                      <label className="label-base" htmlFor="profile-community-inline">
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
                          className="input-base min-h-[44px] w-full cursor-default border-0 text-sm read-only:border-0 read-only:bg-neutral-50 read-only:text-neutral-700 dark:read-only:bg-slate-900/50 dark:read-only:text-slate-300 md:h-9 md:min-h-0"
                          value={profileDraft.community}
                          placeholder="No community yet. Join one from Communities."
                          readOnly
                          aria-readonly="true"
                        />
                      </div>
                    </div>
                    <div className="min-w-0 md:order-3">
                      <label className="label-base" htmlFor="profile-phone-inline">
                        Phone number *
                      </label>
                      <div className="input-base flex min-h-[44px] items-center gap-2 px-3 text-sm md:h-9 md:min-h-0">
                        <span className="shrink-0 text-neutral-600 dark:text-slate-300">+63</span>
                        <input
                          id="profile-phone-inline"
                          name="phone"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          className="w-full border-0 bg-transparent p-0 text-base outline-none placeholder:text-neutral-400 dark:placeholder:text-slate-500 md:text-sm"
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
                      {profileFieldErrors.phone ? <p className="field-error-text mt-1">{profileFieldErrors.phone}</p> : null}
                    </div>
                    <div className="min-w-0 md:order-2">
                      <label className="label-base" htmlFor="profile-email-inline">
                        Email
                      </label>
                      <input
                        id="profile-email-inline"
                        name="email"
                        type="email"
                        inputMode="email"
                        readOnly
                        aria-readonly="true"
                        className="input-base min-h-[44px] cursor-default border-0 read-only:border-0 read-only:bg-neutral-50 read-only:text-neutral-700 dark:read-only:bg-slate-900/50 dark:read-only:text-slate-300 md:h-9 md:min-h-0"
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
                          className="label-base"
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
                          minLength={3}
                          maxLength={50}
                          pattern="[A-Za-z]+(?:[ -][A-Za-z]+)*"
                          title="3-50 chars. Letters, spaces, and hyphens only."
                        />
                        {profileFieldErrors.firstName ? (
                          <p className="field-error-text mt-1">{profileFieldErrors.firstName}</p>
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <label
                          className="label-base"
                          htmlFor="profile-middle-name"
                        >
                          Middle name
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
                          pattern="[A-Za-z]+(?:[ -][A-Za-z]+)*"
                          title="Optional. Letters, spaces, and hyphens only."
                        />
                        {profileFieldErrors.middleName ? (
                          <p className="field-error-text mt-1">{profileFieldErrors.middleName}</p>
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <label
                          className="label-base"
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
                          minLength={3}
                          maxLength={50}
                          pattern="[A-Za-z]+(?:[ -][A-Za-z]+)*"
                          title="3-50 chars. Letters, spaces, and hyphens only."
                        />
                        {profileFieldErrors.lastName ? (
                          <p className="field-error-text mt-1">{profileFieldErrors.lastName}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 border-t border-neutral-200/80 pt-4 dark:border-slate-700/80">
                      <span className="block text-sm font-semibold tracking-tight text-neutral-900 dark:text-slate-100">Preferences</span>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">Set demographic details used for profile completeness.</p>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-8 md:items-end md:gap-x-3">
                        <div className="min-w-0 md:col-span-2">
                          <label className="label-base" htmlFor="profile-gender">
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
                            <p className="field-error-text mt-1">{profileFieldErrors.gender}</p>
                          ) : null}
                        </div>
                        <div className="min-w-0 md:col-span-4">
                          <label className="label-base" htmlFor="profile-birthday">
                            Birthday *
                          </label>
                          <input
                            id="profile-birthday"
                            name="birthday"
                            type="date"
                            className="input-base mt-1 w-full"
                            max={todayIsoDate}
                            value={profileDraft.birthday}
                            onChange={(e) => {
                              const birthday = e.target.value;
                              const computed = computeAgeFromBirthday(birthday);
                              setProfileDraft((prev) => ({ ...prev, birthday, age: computed === "" ? "" : String(computed) }));
                              setProfileFieldErrors((prev) => ({ ...prev, birthday: "", age: "" }));
                            }}
                            required
                          />
                          <p className="mt-1 text-[11px] text-neutral-500 dark:text-slate-400">
                            You can type the date manually (YYYY-MM-DD) or pick from the calendar.
                          </p>
                          {profileFieldErrors.birthday ? (
                            <p className="field-error-text mt-1">{profileFieldErrors.birthday}</p>
                          ) : null}
                        </div>
                        <div className="min-w-0 md:col-span-2">
                          <label className="label-base" htmlFor="profile-age">
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
                            <p className="field-error-text mt-1">{profileFieldErrors.age}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-4 border-t border-neutral-200/80 pt-4 dark:border-slate-700/80">
                      <span className="block text-sm font-semibold tracking-tight text-neutral-900 dark:text-slate-100">Address</span>
                      <p className="text-xs text-neutral-500 dark:text-slate-400">Order: Province to City/Municipality to Barangay. Postal code auto-fills.</p>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-x-4">
                        <div className="min-w-0">
                        <label className="label-base" htmlFor="profile-address-house-street">
                          House Number &amp; Street
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
                        />
                        {profileFieldErrors.addressHouseStreet ? (
                          <p className="field-error-text mt-1">{profileFieldErrors.addressHouseStreet}</p>
                        ) : null}
                      </div>
                        <div className="min-w-0">
                        <label className="label-base" htmlFor="profile-address-subdivision">
                          Subdivision
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
                        />
                        {profileFieldErrors.addressSubdivision ? (
                          <p className="field-error-text mt-1">{profileFieldErrors.addressSubdivision}</p>
                        ) : null}
                      </div>
                        <div className="min-w-0">
                        <label className="label-base" htmlFor="profile-address-province">
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
                          <p className="field-error-text mt-1">{profileFieldErrors.addressProvince}</p>
                        ) : null}
                      </div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-x-4">
                        <div className="min-w-0">
                        <label className="label-base" htmlFor="profile-address-city">
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
                          <p className="field-error-text mt-1">{profileFieldErrors.addressCity}</p>
                        ) : null}
                      </div>
                        <div className="min-w-0">
                        <label className="label-base" htmlFor="profile-address-barangay">
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
                          <p className="field-error-text mt-1">{profileFieldErrors.addressBarangay}</p>
                        ) : null}
                        </div>
                        <div className="min-w-0">
                        <label className="label-base" htmlFor="profile-address-postal-code">
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
                          <p className="field-error-text mt-1">{profileFieldErrors.addressPostalCode}</p>
                        ) : null}
                      </div>
                        <div className="min-w-0">
                        <label className="label-base" htmlFor="profile-address-country">
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
                          <p className="field-error-text mt-1">{profileFieldErrors.addressCountry}</p>
                        ) : null}
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="label-base" htmlFor="profile-address-url">
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
                            <label className="label-base" htmlFor="profile-facebook-url">
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
                            <label className="label-base" htmlFor="profile-twitter-url">
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
                            <label className="label-base" htmlFor="profile-instagram-url">
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
                  <MobileFormActions className="flex flex-col gap-2 pt-5 md:static md:flex-row md:flex-wrap md:justify-end md:border-0 md:bg-transparent md:p-0 md:pt-0 md:shadow-none md:backdrop-blur-none">
                    <button
                      type="submit"
                      className="btn-primary w-full min-w-0 md:w-auto md:min-w-[7rem]"
                      disabled={profileSaving}
                      aria-busy={profileSaving || undefined}
                    >
                      {profileSaving ? (
                        <span className="inline-flex items-center justify-center gap-2">
                          <span
                            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent motion-reduce:animate-none"
                            aria-hidden
                          />
                          Saving…
                        </span>
                      ) : (
                        "Save changes"
                      )}
                    </button>
                    <button type="button" className="btn-secondary w-full min-w-0 md:w-auto md:min-w-[7rem]" disabled={profileSaving} onClick={cancelProfileEdit}>
                      Cancel
                    </button>
                  </MobileFormActions>
                </form>
                {profileAvatarCropEditor.open ? (
                  <div className="fixed inset-0 z-[118] flex items-center justify-center p-4">
                    <button
                      type="button"
                      className="absolute inset-0 bg-black/50"
                      aria-label="Close profile image crop editor"
                      onClick={() => closeProfileAvatarCropEditor()}
                    />
                    <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary dark:text-brand-accent">Crop profile image</p>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">Move and resize the square crop before saving your avatar.</p>
                          {![profileDraft.firstName, profileDraft.middleName, profileDraft.lastName].some((x) => String(x || "").trim()) &&
                          !String(profileDraft.username || "").trim() ? (
                            <p className="mt-2 text-xs text-amber-800 dark:text-amber-200/90">
                              Tip: add your name or username in the profile form so files are stored under a searchable folder in your bucket.
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 text-sm text-neutral-600 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                          aria-label="Close profile image crop editor"
                          onClick={() => closeProfileAvatarCropEditor()}
                        >
                          ×
                        </button>
                      </div>
                      <div className="mt-4">
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-primary dark:text-brand-accent">Adjust crop</p>
                          <div
                            ref={profileAvatarCropViewportRef}
                            className="relative aspect-square w-full overflow-hidden rounded-xl border border-neutral-200 bg-black/90 touch-none dark:border-slate-700"
                            onPointerDown={(e) => {
                              if (!profileAvatarCropEditor.open) return;
                              setProfileAvatarCropApplyError("");
                              e.currentTarget.setPointerCapture(e.pointerId);
                              setProfileAvatarCropEditor((prev) => ({
                                ...prev,
                                dragging: true,
                                dragStartX: e.clientX,
                                dragStartY: e.clientY,
                                dragStartLeft: prev.cropLeft,
                                dragStartTop: prev.cropTop,
                              }));
                            }}
                            onPointerMove={(e) => {
                              if (!profileAvatarCropEditor.dragging) return;
                              const viewportSize = Number(profileAvatarCropViewportRef.current?.clientWidth || 1);
                              const dx = e.clientX - profileAvatarCropEditor.dragStartX;
                              const dy = e.clientY - profileAvatarCropEditor.dragStartY;
                              setProfileAvatarCropEditor((prev) => ({
                                ...prev,
                                cropLeft: (() => {
                                  const w = Math.max(1, Number(prev.sourceWidth || 1));
                                  const h = Math.max(1, Number(prev.sourceHeight || 1));
                                  const renderedWidthFactor = w >= h ? 1 : w / h;
                                  const side = Math.max(1, Math.floor(Math.min(w, h) * clampNumber(prev.cropSize, 0.2, 1)));
                                  const maxLeft = Math.max(0, (w - side) / w);
                                  const next = prev.dragStartLeft + (dx / viewportSize) / renderedWidthFactor;
                                  return clampNumber(next, 0, maxLeft);
                                })(),
                                cropTop: (() => {
                                  const w = Math.max(1, Number(prev.sourceWidth || 1));
                                  const h = Math.max(1, Number(prev.sourceHeight || 1));
                                  const renderedHeightFactor = h >= w ? 1 : h / w;
                                  const side = Math.max(1, Math.floor(Math.min(w, h) * clampNumber(prev.cropSize, 0.2, 1)));
                                  const maxTop = Math.max(0, (h - side) / h);
                                  const next = prev.dragStartTop + (dy / viewportSize) / renderedHeightFactor;
                                  return clampNumber(next, 0, maxTop);
                                })(),
                              }));
                            }}
                            onPointerUp={(e) => {
                              if (profileAvatarCropEditor.dragging) {
                                try {
                                  e.currentTarget.releasePointerCapture(e.pointerId);
                                } catch {
                                  // noop
                                }
                              }
                              setProfileAvatarCropEditor((prev) => ({ ...prev, dragging: false }));
                            }}
                            onPointerCancel={() => setProfileAvatarCropEditor((prev) => ({ ...prev, dragging: false }))}
                          >
                            {profileAvatarCropEditor.sourcePreviewUrl ? (
                              <img
                                src={profileAvatarCropEditor.sourcePreviewUrl}
                                alt=""
                                className="h-full w-full object-contain"
                                draggable={false}
                              />
                            ) : null}
                            {(() => {
                              const w = Math.max(1, Number(profileAvatarCropEditor.sourceWidth || 1));
                              const h = Math.max(1, Number(profileAvatarCropEditor.sourceHeight || 1));
                              const renderW = w >= h ? 100 : (w / h) * 100;
                              const renderH = h >= w ? 100 : (h / w) * 100;
                              const offsetX = (100 - renderW) / 2;
                              const offsetY = (100 - renderH) / 2;
                              const side = Math.max(1, Math.floor(Math.min(w, h) * clampNumber(profileAvatarCropEditor.cropSize, 0.2, 1)));
                              const cropWPercent = (side / w) * renderW;
                              const cropHPercent = (side / h) * renderH;
                              const leftPercent = offsetX + clampNumber(profileAvatarCropEditor.cropLeft, 0, 1) * renderW;
                              const topPercent = offsetY + clampNumber(profileAvatarCropEditor.cropTop, 0, 1) * renderH;
                              return (
                                <div
                                  className="pointer-events-none absolute border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                                  style={{
                                    left: `${leftPercent}%`,
                                    top: `${topPercent}%`,
                                    width: `${cropWPercent}%`,
                                    height: `${cropHPercent}%`,
                                  }}
                                />
                              );
                            })()}
                          </div>
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-[11px] font-medium text-neutral-600 dark:text-slate-400">
                              <span>Crop size</span>
                              <span>{Math.round(clampNumber(Number(profileAvatarCropEditor.cropSize) || 1, 0.2, 1) * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min={20}
                              max={100}
                              step={1}
                              className="mt-1 w-full"
                              value={Math.round(clampNumber(Number(profileAvatarCropEditor.cropSize) || 1, 0.2, 1) * 100)}
                              onChange={(e) => {
                                setProfileAvatarCropApplyError("");
                                setProfileAvatarCropEditor((prev) => {
                                  const w = Math.max(1, Number(prev.sourceWidth || 1));
                                  const h = Math.max(1, Number(prev.sourceHeight || 1));
                                  const nextCropSize = clampNumber((Number(e.target.value) || 80) / 100, 0.2, 1);
                                  const side = Math.max(1, Math.floor(Math.min(w, h) * nextCropSize));
                                  const maxLeft = Math.max(0, (w - side) / w);
                                  const maxTop = Math.max(0, (h - side) / h);
                                  return {
                                    ...prev,
                                    cropSize: nextCropSize,
                                    cropLeft: clampNumber(prev.cropLeft, 0, maxLeft),
                                    cropTop: clampNumber(prev.cropTop, 0, maxTop),
                                  };
                                });
                              }}
                            />
                            <p className="mt-1 text-[11px] text-neutral-500 dark:text-slate-400">Drag the square to reposition the crop area.</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col items-stretch gap-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={profileAvatarCropUploading}
                            onClick={() => closeProfileAvatarCropEditor()}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={profileAvatarCropUploading}
                            onClick={() => void applyProfileAvatarCropEditor()}
                          >
                            {profileAvatarCropUploading ? "Saving…" : "Apply crop"}
                          </button>
                        </div>
                        {profileAvatarCropApplyError ? (
                          <p className="field-error-text text-right" role="alert">
                            {profileAvatarCropApplyError}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col items-center gap-4 border-b border-neutral-200/35 pb-8 text-center dark:border-slate-700/35 md:rounded-xl md:border md:border-neutral-200/50 md:bg-white md:p-5 md:pb-5 md:shadow-sm dark:md:border-slate-700/60 dark:md:bg-slate-900/50">
                    <StableAvatar
                      square
                      src={profileRenderUser.avatarUrl}
                      alt="Profile avatar"
                      initials={(String(profileRenderUser?.username || "").trim().charAt(0) || "?").toUpperCase()}
                      className="h-20 w-20 shrink-0 text-2xl"
                      textClassName="text-2xl"
                      sizes="80px"
                    />
                    <div className="w-full">
                      <p className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-slate-100">
                        {getProfileCardDisplayNameFromUser(profileRenderUser)}
                      </p>
                      <div className="mt-2 flex items-center justify-center gap-3">
                        {(() => {
                          const facebookHref =
                            profileRenderUser.facebookUrl ||
                            (profileRenderUser.socialPlatform === "facebook"
                              ? profileRenderUser.socialUrl || profileRenderUser.url
                              : "");
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
                          const twitterHref = profileRenderUser.twitterUrl || (profileRenderUser.socialPlatform === "x_twitter" ? profileRenderUser.socialUrl || profileRenderUser.url : "");
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
                          const instagramHref = profileRenderUser.instagramUrl || (profileRenderUser.socialPlatform === "instagram" ? profileRenderUser.socialUrl || profileRenderUser.url : "");
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
                      {!profileEditing && !isViewingSellerProfile ? (
                        <button
                          type="button"
                          className="btn-secondary mx-auto mt-5 w-full max-w-sm md:hidden"
                          onClick={openProfileEdit}
                        >
                          Edit profile
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="border-b border-neutral-200/35 pb-8 pt-2 dark:border-slate-700/35 md:rounded-xl md:border md:border-neutral-200/50 md:bg-white md:px-4 md:py-4 md:shadow-sm dark:md:border-slate-700 dark:md:bg-[#0f2234]/95">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-brand-primary dark:text-brand-accent">About</h3>
                    <ul className="mt-4 space-y-3 text-sm text-neutral-800 dark:text-slate-200">
                      <li className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-neutral-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                        <span>Joined </span>
                        <span className="font-semibold">
                          {profileRenderUser.joinedAt || profileRenderUser.createdAt || profileRenderUser.created_at || profileJoinedAt
                            ? new Date(profileRenderUser.joinedAt || profileRenderUser.createdAt || profileRenderUser.created_at || profileJoinedAt).toLocaleDateString(undefined, {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })
                            : ""}
                        </span>
                      </li>
                      {profileRenderUser.phone ? (
                        <li className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-neutral-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.62a2 2 0 0 1-.45 2.11L8 9.71a16 16 0 0 0 6.29 6.29l1.26-1.28a2 2 0 0 1 2.11-.45c.84.29 1.72.5 2.62.62A2 2 0 0 1 22 16.92z" />
                          </svg>
                          <span>Phone: </span>
                          <span className="font-semibold">{toPhilippinesLocal11Display(profileRenderUser.phone)}</span>
                        </li>
                      ) : null}
                      {String(profileRenderUser.community || "").trim() ? (
                        <li className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-neutral-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span>Community: </span>
                          <span className="font-semibold">{String(profileRenderUser.community || "").trim()}</span>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                  <div className="pb-2 pt-2 dark:border-slate-700/35 md:rounded-xl md:border md:border-neutral-200/50 md:bg-white md:px-4 md:py-4 md:shadow-sm dark:md:border-slate-700 dark:md:bg-[#0f2234]/95">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-brand-primary dark:text-brand-accent">Dashboard</h3>
                    <ul className="mt-4 grid grid-cols-2 gap-2.5 md:gap-3">
                      {profileDashboardStats.map((stat) => (
                        <li key={stat.key} className="rounded-lg bg-neutral-50/50 px-3 py-3 dark:bg-slate-800/35 md:rounded-xl md:bg-neutral-50/75 md:dark:bg-slate-800/45">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">{stat.label}</p>
                          <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-900 dark:text-slate-100">{stat.value}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            ) : (
              <p className="app-alert-danger-text text-sm">Could not load your profile. Try signing in again.</p>
            )}
              </div>
              {!isViewingSellerProfile ? (
              <aside className="min-w-0 space-y-4 border-t border-neutral-200/35 pt-8 dark:border-slate-700/35 lg:rounded-2xl lg:border lg:border-neutral-200/70 lg:bg-white lg:p-5 lg:pt-5 lg:shadow-sm dark:lg:border-slate-600 dark:lg:bg-slate-900/80">
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Seller hub: products and buyer feedback">
                  {[
                    { id: SELLER_TABS.PRODUCTS, label: "Products" },
                    { id: SELLER_TABS.FEEDBACK, label: "Feedback" },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={sellerTab === id}
                      className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition md:min-h-0 md:px-3 md:py-1.5 ${
                        sellerTab === id
                          ? UI_KIT.tabActive
                          : "border-0 bg-neutral-100/55 text-neutral-600 hover:bg-neutral-100 dark:bg-slate-800/55 dark:text-slate-400 dark:hover:bg-slate-800 md:border md:border-neutral-200/85 md:bg-transparent md:hover:bg-neutral-50 dark:md:border-slate-600"
                      }`}
                      onClick={() => setSellerTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {sellerTab === SELLER_TABS.PRODUCTS && (
                  <div className={`space-y-3 p-4 ${UI_KIT.surfaceCard}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="text-sm font-medium text-neutral-800 dark:text-slate-200">Products</p>
                      <div className="flex items-center gap-2">
                        <ProductViewDensityToggle
                          value={sellerProductsView}
                          onChange={setSellerProductsView}
                          allowCompact={!isMobileViewport}
                          gridTitle="Grid — large photos, full details on each card"
                          compactTitle="Dense — small tiles; use View for long descriptions"
                        />
                        <button
                          type="button"
                          className="btn-primary shrink-0 text-sm"
                          onClick={() => {
                            if (!String(profileCommunityName || "").trim()) {
                              setProfileUploadProductNotice("Tip: set your community in Profile so uploads can be matched to your local shop.");
                            } else {
                              setProfileUploadProductNotice("");
                            }
                            openUploadAtTop();
                          }}
                        >
                          Upload
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
                      <div className="mt-3">
                        {isMobileViewport ? (
                          <BrowseGridSkeleton
                            gridClassName={`${communityBrowseGridClass(effectiveSellerProductsView, isMobileViewport)} w-full min-w-0 ${lmBrowseViewShellClass(effectiveSellerProductsView)}`}
                            variant={
                              effectiveSellerProductsView === "list"
                                ? "list"
                                : effectiveSellerProductsView === "compact"
                                  ? "compact"
                                  : "grid"
                            }
                            softBrowseChrome={isMobileViewport && effectiveSellerProductsView !== "list"}
                            count={effectiveSellerProductsView === "list" ? 3 : effectiveSellerProductsView === "compact" ? 8 : 4}
                            className="min-h-[6rem] w-full min-w-0"
                            ariaLabel="Loading your listings"
                          />
                        ) : (
                          <ScreenLoading message="Loading your listings…" minHeight={false} className="min-h-[6rem] py-6" />
                        )}
                      </div>
                    ) : null}
                    {sellerListingsFetchError ? (
                      <div className="mt-3">
                        <ScreenError
                          title="Couldn’t load your listings"
                          message={sellerListingsFetchError}
                          onRetry={() => void refetchSellerListings()}
                          secondaryAction={{ label: "Open My listings", onClick: openUploadAtTop }}
                          spacious={false}
                        />
                      </div>
                    ) : null}
                    {sellerListings.length ? (
                      <Suspense
                        fallback={
                          <BrowseGridSkeleton
                            gridClassName={`${communityBrowseGridClass(effectiveSellerProductsView, isMobileViewport)} w-full min-w-0 ${lmBrowseViewShellClass(effectiveSellerProductsView)}`}
                            variant={
                              effectiveSellerProductsView === "list"
                                ? "list"
                                : effectiveSellerProductsView === "compact"
                                  ? "compact"
                                  : "grid"
                            }
                            softBrowseChrome={isMobileViewport && effectiveSellerProductsView !== "list"}
                            count={4}
                            className="min-h-[8rem] w-full min-w-0"
                            ariaLabel="Loading your listings"
                          />
                        }
                      >
                        <div
                          className={`${communityBrowseGridClass(effectiveSellerProductsView, isMobileViewport)} w-full min-w-0 ${lmBrowseViewShellClass(effectiveSellerProductsView)}`}
                        >
                          {sellerListings.map((l) => (
                            <LazyCommunityShopListingCard
                              key={l.id}
                              listing={l}
                              gridMode={effectiveSellerProductsView !== "list"}
                              compactGrid={effectiveSellerProductsView === "compact"}
                              mobileOwnerActionsInMenu={isMobileViewport && effectiveSellerProductsView !== "list"}
                              disableGallerySwipe
                              softBrowseChrome={isMobileViewport && effectiveSellerProductsView !== "list"}
                              browseSummaryGrid={isMobileViewport && effectiveSellerProductsView === "grid"}
                              mobileCardUx={isMobileViewport}
                              isFavorite={false}
                              showActions
                              currentUserId={user?.id || ""}
                              buyNowDisabled={false}
                              buyNowDisabledReason=""
                              onSaleSelect={(percent) => applySellerListingDiscount(l, percent)}
                              onEdit={() => beginEditSellerListing(l)}
                              onDelete={() => deleteSellerListingById(l.id)}
                              onInspect={() => {
                                const stockListed = Math.max(0, Number(l.quantity) || 0);
                                openProductInspect(l, {
                                  quantity: stockListed,
                                  quantityLabel: "Stock listed",
                                  subtitle: "Your listing",
                                  listingStockQty: stockListed,
                                  showSellerCommerceActions: true,
                                  onEditListing: () => {
                                    beginEditSellerListing(l);
                                  },
                                  onSaleSelect: (pct) => {
                                    closeProductInspect();
                                    void applySellerListingDiscount(l, pct);
                                  },
                                });
                              }}
                            />
                          ))}
                        </div>
                      </Suspense>
                    ) : !(sellerListingsLoading && sellerListings.length === 0) && !sellerListingsFetchError ? (
                      <ScreenEmpty
                        className="mt-3"
                        title="No listings yet"
                        description="Publish photos, price, and pickup or delivery options so neighbors can buy from you."
                        primaryAction={{ label: "Upload", onClick: openUploadAtTop }}
                        secondaryAction={{ label: "Browse marketplace", onClick: goBrowse }}
                      />
                    ) : null}
                  </div>
                )}
                {sellerTab === SELLER_TABS.FEEDBACK && (
                  <Suspense
                    fallback={
                      <ScreenLoading message="Loading feedback…" minHeight={false} className="min-h-[8rem] py-6" />
                    }
                  >
                    <LazySellerBuyerFeedbackList token={token} />
                  </Suspense>
                )}
              </aside>
              ) : null}
            </div>
          </section>
        )}

      </main>
      </LoggedInHeader>
      </MobileAppShell>

      {orderCancelReasonModalOpen ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center p-4 md:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-cancel-reason-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-neutral-900/45 backdrop-blur-[2px] dark:bg-black/55"
            aria-label="Close cancel dialog"
            onClick={() => setOrderCancelReasonModalOpen(false)}
          />
          <div
            className="relative z-10 max-h-[min(90vh,540px)] w-full max-w-mobile-baseline overflow-y-auto rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.22)] dark:border-slate-600 dark:bg-slate-900 md:max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="order-cancel-reason-title" className="text-lg font-semibold text-neutral-900 dark:text-slate-100">
              Cancel selected order{selectedOrders.length > 1 ? "s" : ""}?
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">
              Choose a reason
              {selectedOrders.length > 1 ? " — it will apply to each selected order." : "."}
            </p>
            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">Cancellation reason</legend>
              {ORDER_CANCELLATION_REASON_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition ${
                    orderCancelReasonId === opt.id
                      ? "border-brand-primary bg-brand-primary/10 dark:border-brand-accent dark:bg-brand-accent/15"
                      : "border-neutral-200/90 bg-white hover:bg-neutral-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800/80"
                  }`}
                >
                  <input
                    type="radio"
                    name="order-cancel-reason"
                    value={opt.id}
                    checked={orderCancelReasonId === opt.id}
                    onChange={() => setOrderCancelReasonId(opt.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 border-neutral-300 text-brand-primary focus:ring-brand-primary/35 dark:border-slate-500 dark:text-brand-accent"
                  />
                  <span className="text-neutral-800 dark:text-slate-100">{opt.label}</span>
                </label>
              ))}
            </fieldset>
            {orderCancelReasonId === "other" ? (
              <label className="mt-3 block">
                <span className="text-xs font-medium text-neutral-600 dark:text-slate-400">Note (optional)</span>
                <textarea
                  value={orderCancelNote}
                  onChange={(e) => setOrderCancelNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Add detail…"
                  className="mt-1 w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-brand-primary/35 focus:border-brand-primary focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-brand-accent dark:focus:ring-brand-accent/35"
                />
              </label>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 md:flex-row md:justify-end">
              <button
                type="button"
                className="btn-secondary min-h-10 w-full md:w-auto"
                onClick={() => setOrderCancelReasonModalOpen(false)}
              >
                Keep order
              </button>
              <button
                type="button"
                className="min-h-10 w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 md:w-auto dark:bg-rose-500 dark:hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!orderCancelReasonId}
                onClick={() => {
                  if (!orderCancelReasonId) {
                    pushMarketplaceToast("Choose a cancellation reason.");
                    return;
                  }
                  setOrderCancelReasonModalOpen(false);
                  void applyTransitionToSelectedOrders("cancel", "Cancelled", {
                    cancellationReason: orderCancelReasonId,
                    cancellationNote: orderCancelNote.trim(),
                  });
                }}
              >
                Confirm cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {leaveCommunityConfirmOpen ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center p-4 md:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-community-confirm-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-neutral-900/45 backdrop-blur-[2px] dark:bg-black/55"
            aria-label="Close leave confirmation"
            onClick={() => setLeaveCommunityConfirmOpen(false)}
          />
          <div
            className="relative z-10 w-full max-w-mobile-baseline rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.22)] dark:border-slate-600 dark:bg-slate-900 md:max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="leave-community-confirm-title" className="text-lg font-semibold text-neutral-900 dark:text-slate-100">
              Leave this community?
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">
              Are you sure you want to leave this community?
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 md:flex-row md:justify-end">
              <button
                type="button"
                className="btn-secondary min-h-10 w-full md:w-auto"
                onClick={() => setLeaveCommunityConfirmOpen(false)}
              >
                Stay
              </button>
              <button
                type="button"
                className="min-h-10 w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 md:w-auto dark:bg-rose-500 dark:hover:bg-rose-400"
                onClick={() => {
                  setLeaveCommunityConfirmOpen(false);
                  void leaveCommunityAndDetachListings(activeCommunity, { notifySuccess: true });
                  leaveCommunityToGlobalMarketplace();
                }}
              >
                Yes, leave
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {quickAddImagePreviewOpen && quickAddListing && String(quickAddListing.imageUrl || "").trim() ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-3 md:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Product image preview"
        >
          <button
            type="button"
            className="absolute inset-0 bg-neutral-900/70 backdrop-blur-[1px] dark:bg-black/75"
            aria-label="Close image preview"
            onClick={() => setQuickAddImagePreviewOpen(false)}
          />
          <div className="relative z-10 w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {!quickAddLightboxImageFailed ? (
              <img
                src={quickAddListing.imageUrl}
                alt={quickAddListing.title || "Product image"}
                className="max-h-[88vh] w-full min-h-[12rem] rounded-2xl border border-white/30 object-contain shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
                decoding="async"
                sizes="100vw"
                onError={() => setQuickAddLightboxImageFailed(true)}
              />
            ) : (
              <div
                className="flex min-h-[40vh] w-full items-center justify-center rounded-2xl border border-white/20 bg-neutral-900/50 text-sm text-white/70"
                role="img"
                aria-label="Image unavailable"
              >
                Image unavailable
              </div>
            )}
            <button
              type="button"
              className="absolute left-4 top-5 z-10 inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center text-white transition hover:text-white/85 md:h-9 md:min-h-0 md:min-w-0 md:w-9"
              aria-label="Back"
              onClick={() => setQuickAddImagePreviewOpen(false)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7 drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
                aria-hidden
              >
                <path d="M19 12H5" />
                <path d="M11 6l-6 6 6 6" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {quickAddModalOpen && quickAddListing ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-add-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-neutral-900/50 backdrop-blur-[2px] dark:bg-black/55"
            aria-label="Close add to cart"
            onClick={closeQuickAddModal}
          />
          <div
            className={`relative z-10 flex max-h-[min(88dvh,42rem)] w-full max-w-lg min-h-0 flex-col overflow-hidden rounded-t-2xl border border-neutral-200/90 bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.18)] dark:border-[#1f3c56] dark:bg-[#0f2234] md:max-h-[min(90dvh,44rem)] md:rounded-2xl md:shadow-[0_20px_60px_rgba(15,23,42,0.22)] ${UI_KIT.surfaceFloating}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-w-0 shrink-0 items-start justify-between gap-2.5 border-b border-neutral-200/80 px-3 pb-2 pt-2.5 min-[390px]:gap-3 min-[390px]:px-4 min-[390px]:pb-2.5 min-[390px]:pt-3 min-[430px]:px-5 dark:border-[#1f3c56]/85 md:px-5 md:pb-3 md:pt-4">
              <button
                type="button"
                className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-neutral-700 transition hover:text-neutral-900 dark:text-slate-200 dark:hover:text-slate-50 md:h-9 md:min-h-0 md:min-w-0 md:w-9"
                aria-label="Close"
                onClick={closeQuickAddModal}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-7 w-7"
                  aria-hidden
                >
                  <path d="M19 12H5" />
                  <path d="M11 6l-6 6 6 6" />
                </svg>
              </button>
              <div className="min-w-0 flex-1 text-center md:text-left">
                <h2
                  id="quick-add-modal-title"
                  className="break-words text-sm font-semibold leading-snug text-neutral-900 dark:text-slate-100 min-[390px]:text-base"
                >
                  {quickActionType === "buy" ? "Place order" : "Add to cart"}
                </h2>
              </div>
              <span className="inline-flex h-11 w-11 shrink-0 md:h-9 md:w-9" aria-hidden />
            </div>

            <div className="drawer-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-2.5 min-[390px]:px-4 min-[390px]:py-3 min-[430px]:px-5 md:px-5 md:py-4">
              <div className="mx-auto min-w-0 max-w-2xl space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4 lg:gap-6">
                  <div className="mx-auto flex w-full shrink-0 flex-col md:mx-0 md:max-w-[12rem] lg:max-w-[14rem]">
                    <div className="relative mx-auto aspect-square w-full max-w-[min(100%,20rem)] shrink-0 overflow-hidden rounded-lg bg-neutral-100 ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/10 md:mx-0 md:max-w-[12rem] lg:max-w-[14rem]">
                      {resolveListingCoverImageUrl(quickAddListing) ? (
                        <button
                          type="button"
                          className="absolute inset-0 z-0 cursor-zoom-in touch-pan-y"
                          aria-label="View larger product image"
                          onClick={() => setQuickAddImagePreviewOpen(true)}
                          style={{ touchAction: "pan-x pan-y" }}
                        >
                          <ProductListingMedia
                            listing={quickAddListing}
                            variant="grid"
                            fillFrame
                            className="pointer-events-none absolute inset-0 min-h-0"
                            imageClassName="transition duration-200 hover:scale-[1.02]"
                            sizes="(max-width: 768px) min(100vw, 64rem), 12rem"
                            loading="eager"
                          />
                        </button>
                      ) : (
                        <ProductListingMedia
                          listing={quickAddListing}
                          variant="grid"
                          fillFrame
                          className="absolute inset-0 min-h-0"
                          sizes="(max-width: 768px) min(100vw, 64rem), 12rem"
                          loading="eager"
                        />
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-4">
                    {(() => {
                      const saleMeta = parseSaleMetaFromDescription(String(quickAddListing.description || ""));
                      const currentPesos = Math.floor((Number(quickAddListing.priceCents) || 0) / 100);
                      const originalPesos = Number.isFinite(Number(saleMeta?.originalPesos))
                        ? Number(saleMeta.originalPesos)
                        : null;
                      const showStrike = originalPesos != null && originalPesos > currentPesos;
                      const qaValsA = normalizeListingOptionValues(quickAddListing.optionValuesA);
                      const qaValsB = normalizeListingOptionValues(quickAddListing.optionValuesB);
                      const qaLabelA = String(quickAddListing.optionNameA || "").trim();
                      const qaLabelB = String(quickAddListing.optionNameB || "").trim();
                      const showVariantPickers =
                        Boolean(qaLabelA && qaValsA.length > 0) || Boolean(qaLabelB && qaValsB.length > 0);
                      const qaFulfillmentModes = Array.isArray(quickAddListing.fulfillmentModes)
                        ? quickAddListing.fulfillmentModes.map(String)
                        : [];
                      const qaOffersPickup = qaFulfillmentModes.includes("pickup");
                      const qaOffersDelivery = qaFulfillmentModes.includes("delivery");
                      return (
                        <>
                          <div className="min-w-0 space-y-2">
                            <p className="product-card-title break-words">{quickAddListing.title || "Product"}</p>
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <p className="product-price tabular-nums">{formatPesoWhole(quickAddListing.priceCents)}</p>
                              {showStrike ? (
                                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                  <span className="text-[11px] font-medium text-neutral-500 line-through min-[380px]:text-xs dark:text-slate-500">
                                    ₱{originalPesos}
                                  </span>
                                  {saleMeta?.percent ? (
                                    <span className="rounded-md border border-amber-300/80 bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-300">
                                      -{saleMeta.percent}%
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          {showVariantPickers ? (
                            <div className="space-y-3">
                              {qaLabelA && qaValsA.length > 0 ? (
                                <fieldset className="min-w-0 space-y-1.5 border-0 p-0">
                                  <legend className="float-none text-xs font-semibold text-neutral-900 dark:text-slate-100">
                                    {qaLabelA}
                                  </legend>
                                  <div className="mt-1 flex flex-wrap gap-2">
                                    {qaValsA.map((choice) => {
                                      const selected = quickAddSelectedVariantA === choice;
                                      return (
                                        <button
                                          key={`quick-add-opt-a-${choice}`}
                                          type="button"
                                          role="radio"
                                          aria-checked={selected}
                                          disabled={quickAddSubmitting}
                                          className={`min-h-[44px] min-w-[44px] rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 dark:focus-visible:ring-brand-accent/40 ${
                                            selected
                                              ? "border-brand-primary bg-brand-primary/12 text-brand-primary shadow-sm dark:border-brand-accent dark:bg-brand-accent/15 dark:text-slate-50"
                                              : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500"
                                          }`}
                                          onClick={() => setQuickAddSelectedVariantA(choice)}
                                        >
                                          {choice}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </fieldset>
                              ) : null}
                              {qaLabelB && qaValsB.length > 0 ? (
                                <fieldset className="min-w-0 space-y-1.5 border-0 p-0">
                                  <legend className="float-none text-xs font-semibold text-neutral-900 dark:text-slate-100">
                                    {qaLabelB}
                                  </legend>
                                  <div className="mt-1 flex flex-wrap gap-2">
                                    {qaValsB.map((choice) => {
                                      const selected = quickAddSelectedVariantB === choice;
                                      return (
                                        <button
                                          key={`quick-add-opt-b-${choice}`}
                                          type="button"
                                          role="radio"
                                          aria-checked={selected}
                                          disabled={quickAddSubmitting}
                                          className={`min-h-[44px] min-w-[44px] rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 dark:focus-visible:ring-brand-accent/40 ${
                                            selected
                                              ? "border-brand-primary bg-brand-primary/12 text-brand-primary shadow-sm dark:border-brand-accent dark:bg-brand-accent/15 dark:text-slate-50"
                                              : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500"
                                          }`}
                                          onClick={() => setQuickAddSelectedVariantB(choice)}
                                        >
                                          {choice}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </fieldset>
                              ) : null}
                            </div>
                          ) : null}
                          {qaOffersPickup && qaOffersDelivery ? (
                            <fieldset className="min-w-0 space-y-1.5 border-0 p-0">
                              <legend className="float-none text-xs font-semibold text-neutral-900 dark:text-slate-100">
                                Fulfillment
                              </legend>
                              <div className="mt-1 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  role="radio"
                                  aria-checked={quickOrderFulfillmentType === "pickup"}
                                  disabled={quickAddSubmitting}
                                  className={`min-h-[44px] min-w-[44px] rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 dark:focus-visible:ring-brand-accent/40 ${
                                    quickOrderFulfillmentType === "pickup"
                                      ? "border-brand-primary bg-brand-primary/12 text-brand-primary shadow-sm dark:border-brand-accent dark:bg-brand-accent/15 dark:text-slate-50"
                                      : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500"
                                  }`}
                                  onClick={() => {
                                    setQuickOrderFulfillmentType("pickup");
                                    writeQuickOrderFulfillmentPref("pickup");
                                  }}
                                >
                                  COD pickup
                                </button>
                                <button
                                  type="button"
                                  role="radio"
                                  aria-checked={quickOrderFulfillmentType === "delivery"}
                                  disabled={quickAddSubmitting}
                                  className={`min-h-[44px] min-w-[44px] rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 dark:focus-visible:ring-brand-accent/40 ${
                                    quickOrderFulfillmentType === "delivery"
                                      ? "border-brand-primary bg-brand-primary/12 text-brand-primary shadow-sm dark:border-brand-accent dark:bg-brand-accent/15 dark:text-slate-50"
                                      : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500"
                                  }`}
                                  onClick={() => {
                                    setQuickOrderFulfillmentType("delivery");
                                    writeQuickOrderFulfillmentPref("delivery");
                                  }}
                                >
                                  Deliver
                                </button>
                              </div>
                            </fieldset>
                          ) : qaOffersPickup || qaOffersDelivery ? (
                            <div className="space-y-1">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                                Fulfillment
                              </p>
                              <p className="text-sm text-neutral-800 dark:text-slate-200">
                                {listingCodAvailabilityLabel(qaOffersPickup ? ["pickup"] : ["delivery"])}
                              </p>
                            </div>
                          ) : null}
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                              Quantity
                            </p>
                            <div className="flex min-w-0 flex-wrap items-center gap-2 md:gap-3">
                              <div className="inline-flex items-center gap-1 md:gap-1.5">
                                <button
                                  type="button"
                                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-white text-base font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 md:h-10 md:w-10"
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
                                  className="input-base h-11 w-16 px-1 text-center text-sm tabular-nums md:h-10 md:w-14"
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
                                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-white text-base font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 md:h-10 md:w-10"
                                  aria-label="Increase quantity"
                                  disabled={
                                    Number(quickAddQuantity) >= Math.max(1, Number(quickAddListing.quantity) || 1) ||
                                    quickAddSubmitting
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
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

              <div className="mt-3 border-t border-neutral-200/70 pt-3 dark:border-slate-700/70">
                <label className="label-base mb-1" htmlFor="quick-add-comment">
                  Comment
                </label>
                <textarea
                  id="quick-add-comment"
                  rows={3}
                  maxLength={quickActionType === "buy" ? 2000 : 250}
                  className="input-base w-full resize-none"
                  placeholder={
                    quickActionType === "buy" ? "Optional note for the seller" : "Optional note for your cart item"
                  }
                  value={quickAddComment}
                  onChange={(e) => setQuickAddComment(e.target.value)}
                />
              </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-neutral-200/80 bg-white/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/85 min-[390px]:px-4 min-[390px]:pt-2.5 min-[430px]:px-5 dark:border-[#1f3c56]/85 dark:bg-[#0f2234]/95 dark:shadow-none md:px-5 md:pb-4 md:pt-3">
              <button
                type="button"
                className="btn-primary w-full"
                disabled={quickAddSubmitting}
                aria-busy={quickAddSubmitting}
                onClick={submitQuickAddOrder}
              >
                {quickAddSubmitting
                  ? quickActionType === "buy"
                    ? "Placing order…"
                    : "Adding…"
                  : quickActionType === "buy"
                    ? "Place order"
                    : "Add to cart"}
              </button>
              {quickAddInlineError ? (
                <p className="app-alert-error mt-2 text-sm" role="alert">
                  {quickAddInlineError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {communityFormOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 md:p-6"
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
                className="btn-icon-only inline-flex shrink-0 items-center justify-center rounded-xl border border-neutral-200/90 text-lg leading-none text-neutral-500 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100 md:!h-9 md:!min-h-9 md:!w-9 md:!max-w-9"
                aria-label="Close community dialog"
                onClick={closeAddCommunityModal}
              >
                <span aria-hidden>×</span>
              </button>
            </div>
            <form onSubmit={handleCreateCommunity} className="space-y-3 rounded-lg border border-neutral-200/90 bg-neutral-50/60 p-3 dark:border-slate-600 dark:bg-slate-800/50">
              <div>
                <label className="label-base mb-1">Add image</label>
                <input
                  ref={communityImageInputRef}
                  className="block w-full max-w-lg cursor-pointer text-sm text-neutral-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-primary dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={async (e) => {
                    const f = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    if (!f) {
                      setCommunityImageFile(null);
                      return;
                    }
                    if (!String(f.type || "").startsWith("image/")) {
                      pushMarketplaceToast("Please choose a JPEG, PNG, WebP, or GIF image.");
                      return;
                    }
                    try {
                      const ready = await ensureImageFileUnderMaxBytes(f, MAX_LISTING_COMMUNITY_IMAGE_BYTES, {
                        maxLongEdge: 2560,
                      });
                      setCommunityImageFile(ready);
                    } catch {
                      pushMarketplaceToast("Could not process that image. Try a different file.");
                    }
                  }}
                />
                <p className="mt-1 text-[11px] text-neutral-500 dark:text-slate-500">
                  JPEG, PNG, WebP, or GIF — large files are compressed to fit 5 MB. Optional; communities without a photo
                  use a color placeholder.
                </p>
                {communityImageFile ? (
                  <p className="mt-1 text-xs text-neutral-600 dark:text-slate-400">Selected: {communityImageFile.name}</p>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="label-base mb-1" htmlFor="add-community-name">
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
                <div className="md:col-span-1">
                  <label
                    className="label-base mb-1"
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
                <div className="md:col-span-1">
                  <label className="label-base mb-1" htmlFor="add-community-city">
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
                <div className="md:col-span-1">
                  <label
                    className="label-base mb-1"
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
              <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
                <button
                  type="submit"
                  className="btn-primary w-full min-w-0 text-sm md:w-auto"
                  disabled={communitySaving}
                  aria-busy={communitySaving || undefined}
                >
                  {communitySaving ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <span
                        className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent motion-reduce:animate-none"
                        aria-hidden
                      />
                      Saving…
                    </span>
                  ) : communityEditingId ? (
                    "Save changes"
                  ) : (
                    "Save community"
                  )}
                </button>
                <button
                  type="button"
                  className="btn-secondary w-full min-w-0 text-sm md:w-auto"
                  disabled={communitySaving}
                  onClick={closeAddCommunityModal}
                >
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
  