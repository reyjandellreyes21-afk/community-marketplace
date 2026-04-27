import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import tabLogo from "./assets/new-icon-only.png";
import heroStudyImage from "./assets/new-auth-landing.png";
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
import { UI_KIT } from "./lib/appUiKit.js";
import {
  formatDisplayName,
  getDisplayNameFromUser,
  getProfileCardDisplayNameFromUser,
  PROFILE_GENDER_OPTIONS,
  formatBirthdayDisplay,
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
  parseSaleMetaFromDescription,
  removeSaleMetaLines,
  listingCodAvailabilityLabel,
} from "./lib/listingSaleMeta.js";
import {
  CART_RECENT_BADGE_STORAGE_KEY,
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
import { computeMarketplaceFeedbackForText } from "./lib/marketplaceFeedbackToast.js";
import { fileToDataUrl } from "./lib/fileToDataUrl.js";
import { LANDING_DISCOVERY_SLIDES, BROWSE_QUICK_FILTERS } from "./lib/landingDiscoveryData.js";
import { quickFilterIcon, categoryIcon } from "./components/browse/BrowseFilterIcons.jsx";
import { MarketplaceProductDetailStack } from "./components/marketplace/MarketplaceProductDetailStack.jsx";
import { SectionHeading } from "./components/marketplace/SectionHeading.jsx";
import { FilterOptionButton } from "./components/marketplace/FilterOptionButton.jsx";
import { CommunityShopListingCard } from "./components/marketplace/CommunityShopListingCard.jsx";
import { ListingCategoryPicker } from "./components/marketplace/ListingCategoryPicker.jsx";
import { OrderBuyerReviewForm } from "./components/marketplace/OrderBuyerReviewForm.jsx";
import { CartSellerSelectAllCheckbox } from "./components/marketplace/CartSellerSelectAllCheckbox.jsx";
import { SellerProductCard } from "./components/marketplace/SellerProductCard.jsx";
import { ProductInspectModal } from "./components/marketplace/ProductInspectModal.jsx";
import { LandingFeatureRow, LANDING_FEATURE_ROWS } from "./components/landing/LandingFeatureRows.jsx";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeHidePasswordIcon,
  EyeShowPasswordIcon,
  LandingIllustration,
  LandingSiteFooter,
  LinkMartLogo,
} from "./components/landing/LandingMarketing.jsx";

/** Best-effort recency for ordering “unseen” pending rows (API field names vary). */
function orderRowSortMs(o) {
  const raw = o?.updatedAt ?? o?.updated_at ?? o?.createdAt ?? o?.created_at ?? 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function formatOrderCompletedAtLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Full milestone context on the Completed tab (placed → processing → done). */
function OrderCompletedMilestoneList({ order }) {
  const createdRaw = order?.createdAt ?? order?.created_at;
  const processingRaw = order?.processingEnteredAt ?? order?.processing_entered_at;
  const completedRaw = order?.completedAt ?? order?.completed_at;
  const updatedRaw = order?.updatedAt ?? order?.updated_at;
  const items = [];
  if (createdRaw) {
    const t = formatOrderCompletedAtLabel(createdRaw);
    if (t) items.push({ key: "placed", label: "Placed (pending)", time: t });
  }
  if (processingRaw) {
    const t = formatOrderCompletedAtLabel(processingRaw);
    if (t) items.push({ key: "processing", label: "Processing started", time: t });
  }
  const doneIso = completedRaw || updatedRaw;
  if (doneIso) {
    const t = formatOrderCompletedAtLabel(doneIso);
    if (t) items.push({ key: "completed", label: "Completed", time: t });
  }
  if (items.length === 0) return null;
  return (
    <div className="max-w-full overflow-hidden rounded-lg border border-neutral-200/80 bg-neutral-50/90 px-2.5 py-1.5 sm:px-3 sm:py-2 dark:border-slate-600/80 dark:bg-slate-900/50">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-500">Order timeline</p>
      <ul className="mt-1.5 space-y-1.5 text-[11px] text-neutral-600 dark:text-slate-400">
        {items.map((it) => (
          <li key={it.key} className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-1.5">
            <span className="shrink-0 font-medium text-neutral-800 dark:text-slate-200">{it.label}</span>
            <span className="hidden sm:inline text-neutral-400 dark:text-slate-500">·</span>
            <span className="min-w-0 break-words text-neutral-600 dark:text-slate-400">{it.time}</span>
          </li>
        ))}
      </ul>
      {!processingRaw && createdRaw && doneIso ? (
        <p className="mt-1.5 text-pretty text-[10px] leading-snug text-neutral-500 dark:text-slate-500">
          Processing start time was not recorded for this order (older data or edge case).
        </p>
      ) : null}
    </div>
  );
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

/** Success toast: full visible time before fade; fade length (should match CSS transition) */
const PUBLISH_TOAST_DURATION_MS = 7500;
const PUBLISH_TOAST_FADE_MS = 350;
/** Seller snapshot polling while away from Sales inbox — complements Supabase Realtime for nav badge latency. */
const SELLER_ORDERS_POLL_MS = 28_000;
/** Coalesce bursty `orders` row events without delaying badge updates too much. */
const ORDERS_REALTIME_DEBOUNCE_MS = 200;
/** Coalesce bursty chat events for immediate but efficient conversation updates. */
const CHAT_REALTIME_DEBOUNCE_MS = 220;

/** Responsive browse layouts: list, comfortable auto-fill grid, or compact auto-fill grid. */
function communityBrowseGridClass(view) {
  if (view === "list") return "space-y-3 sm:space-y-4";
  if (view === "compact") {
    return "grid items-stretch [grid-template-columns:repeat(auto-fill,minmax(min(100%,10.25rem),1fr))] gap-2 sm:gap-3";
  }
  return "grid items-stretch [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-3 sm:gap-4 lg:gap-5";
}

function favoritesGridClass(view) {
  if (view === "list") return "grid grid-cols-1 items-stretch gap-3 sm:gap-4";
  if (view === "compact") return "grid grid-cols-4 items-stretch gap-2 sm:gap-3";
  return "grid grid-cols-2 items-stretch gap-3 sm:gap-4";
}

function sellerListingsGridClass(view) {
  if (view === "list") return "mt-3 space-y-3";
  if (view === "compact") {
    /** Dense: tighter gaps, more tiles per row than comfortable grid. */
    return [
      "mt-3 grid min-w-0 items-stretch",
      "grid-cols-1",
      "gap-1.5 sm:gap-2",
      "sm:[grid-template-columns:repeat(auto-fill,minmax(min(100%,9rem),1fr))]",
      "md:[grid-template-columns:repeat(auto-fill,minmax(min(100%,10.25rem),1fr))]",
      "xl:[grid-template-columns:repeat(auto-fill,minmax(min(100%,11rem),1fr))]",
    ].join(" ");
  }
  /** Comfortable grid: roomier cards vs dense; multi-column from sm+. */
  return [
    "mt-3 grid min-w-0 items-stretch",
    "grid-cols-1",
    "gap-4 sm:gap-5",
    "sm:[grid-template-columns:repeat(auto-fill,minmax(min(100%,10.75rem),1fr))]",
    "lg:[grid-template-columns:repeat(auto-fill,minmax(min(100%,15.5rem),1fr))]",
    "xl:[grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]",
  ].join(" ");
}

function ProductViewDensityToggle({
  value,
  onChange,
  groupAriaLabel = "Product layout",
  gridTitle = "Grid — columns fit your screen (comfortable cards)",
  compactTitle = "Compact — more tiles per row, shorter cards",
}) {
  const btn = (isActive) =>
    `inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-md px-2 py-1.5 text-xs font-semibold transition sm:min-h-0 sm:min-w-0 sm:gap-1.5 sm:px-2.5 ${
      isActive
        ? "bg-brand-soft text-brand-primary shadow-sm dark:bg-slate-800 dark:text-slate-100"
        : "text-neutral-600 hover:bg-neutral-100 dark:text-slate-400 dark:hover:bg-slate-800"
    }`;
  const iconCls = "h-4 w-4 shrink-0";
  return (
    <div
      className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-xl border border-neutral-200/90 bg-white p-1 shadow-sm dark:border-slate-600 dark:bg-slate-900"
      role="group"
      aria-label={groupAriaLabel}
    >
      <button
        type="button"
        className={btn(value === "list")}
        aria-label="List view"
        title="List — full-width rows"
        onClick={() => onChange("list")}
      >
        <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
        <span className="hidden pl-1 sm:inline">List</span>
      </button>
      <button
        type="button"
        className={btn(value === "grid")}
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
        <span className="hidden pl-1 sm:inline">Grid</span>
      </button>
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
        <span className="hidden pl-1 sm:inline">Dense</span>
      </button>
    </div>
  );
}

const COMMERCE_FLOW_BUYER_STORAGE_KEY = "linkmart_commerce_flow_buyer_v1";
const COMMERCE_FLOW_SELLER_STORAGE_KEY = "linkmart_commerce_flow_seller_v1";
/** Legacy single key — migrated once into buyer/seller keys. */
const COMMERCE_FLOW_VIEW_STORAGE_KEY_LEGACY = "linkmart_commerce_flow_view_v1";
const NOTIFICATION_INBOX_STORAGE_KEY = "linkmart_notification_inbox_v1";
const NOTIFICATION_INBOX_MAX_ITEMS = 80;
const CHAT_THREADS_STORAGE_KEY = "linkmart_chat_threads_v1";
const CHAT_MESSAGES_MAX_PER_THREAD = 250;
const chatStorageKeyForUser = (userId) => `${CHAT_THREADS_STORAGE_KEY}:${String(userId || "").trim()}`;

function createNotificationId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `notif-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function createChatMessageId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `chat-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function classifyNotificationType(text) {
  const lower = String(text || "").toLowerCase();
  if (lower.includes("delivery")) return "delivery";
  if (lower.includes("order")) return "orders";
  if (lower.includes("joined") || lower.includes("left") || lower.includes("community")) return "community";
  if (lower.includes("error") || lower.includes("could not") || lower.includes("unavailable")) return "system";
  return "marketplace";
}

function readNotificationInboxFromStorage() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_INBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        id: String(item?.id || "").trim(),
        text: String(item?.text || "").trim(),
        createdAt: Number(item?.createdAt || 0),
        read: !!item?.read,
        type: String(item?.type || "").trim() || "marketplace",
      }))
      .filter((item) => item.id && item.text && Number.isFinite(item.createdAt));
  } catch {
    return [];
  }
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

/**
 * Line items inside one seller card (Add to cart, My purchases, Sales inbox).
 * List: stacked rows. Grid: 2 columns from sm+. Dense: 3 columns from lg+ (same as buying/selling).
 */
function commerceFlowLineItemsClass(view, ctx = {}) {
  const variant = ctx.variant ?? "cart";

  if (view === "list") {
    /** Order rows use bordered cards + gap like grid; cart list keeps slim `divide-y` rows. */
    if (variant === "orders") return "flex flex-col gap-2 px-1 sm:gap-2.5 sm:px-1.5";
    return "divide-y divide-neutral-200/80 px-1 dark:divide-slate-700/80 sm:px-1.5";
  }

  if (variant === "orders" || variant === "cart") {
    if (view === "compact") {
      return [
        "grid items-stretch gap-2 sm:gap-2.5",
        "grid-cols-1",
        "sm:grid-cols-2",
        "lg:grid-cols-3",
      ].join(" ");
    }
    return [
      "grid items-stretch gap-2.5 sm:gap-3",
      "grid-cols-1",
      "sm:grid-cols-2",
    ].join(" ");
  }

  return "grid items-stretch gap-2.5 sm:gap-3 grid-cols-1 sm:grid-cols-2";
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
    if (savedView && Object.values(VIEWS).includes(savedView)) return savedView;
    return VIEWS.BROWSE;
  });
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
  const [sellerListingQtySavingId, setSellerListingQtySavingId] = useState(null);
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
  const [favoritesList, setFavoritesList] = useState([]);
  const favoritesListRef = useRef([]);
  favoritesListRef.current = favoritesList;
  const [orders, setOrders] = useState([]);
  const ordersRef = useRef([]);
  ordersRef.current = orders;
  const [ordersRole, setOrdersRole] = useState("buyer");
  const [ordersStatusTab, setOrdersStatusTab] = useState("pending");
  /** Completed tab: `orderId` -> expanded "Order details" (ID, pickup line, timeline). */
  const [completedTabOrderDetailsOpen, setCompletedTabOrderDetailsOpen] = useState({});
  const activeViewRef = useRef(activeView);
  const ordersRoleRef = useRef(ordersRole);
  useEffect(() => {
    activeViewRef.current = activeView;
    ordersRoleRef.current = ordersRole;
  }, [activeView, ordersRole]);
  useEffect(() => {
    if (ordersStatusTab !== "completed") setCompletedTabOrderDetailsOpen({});
  }, [ordersStatusTab]);
  useEffect(() => {
    writeActiveView(activeView);
  }, [activeView]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  /** `orderId` -> selected (orders screen only). */
  const [orderSelection, setOrderSelection] = useState({});
  const [ordersBulkActionSubmitting, setOrdersBulkActionSubmitting] = useState(false);
  const [buyerCancelConfirmOpen, setBuyerCancelConfirmOpen] = useState(false);
  const [leaveCommunityConfirmOpen, setLeaveCommunityConfirmOpen] = useState(false);
  /** Order ids the user has marked “seen” per status tab (localStorage per user). Unseen rows drive badges + highlights. */
  const [buyerOrderDismissedIdsByTab, setBuyerOrderDismissedIdsByTab] = useState(() => emptyOrderAttentionByTab());
  const [sellerOrderDismissedIdsByTab, setSellerOrderDismissedIdsByTab] = useState(() => emptyOrderAttentionByTab());
  /** True after the buyer opens these Purchases queues; leaving Purchases can dismiss only those tabs. */
  const buyerCancelledTabVisitedThisPurchasesSessionRef = useRef(false);
  const buyerProcessingTabVisitedThisPurchasesSessionRef = useRef(false);
  const buyerCompletedTabVisitedThisPurchasesSessionRef = useRef(false);
  /** Same for seller Orders. */
  const sellerCancelledTabVisitedThisOrdersSessionRef = useRef(false);
  const sellerProcessingTabVisitedThisOrdersSessionRef = useRef(false);
  const sellerCompletedTabVisitedThisOrdersSessionRef = useRef(false);
  const ordersStatusTabDismissContextRef = useRef({ key: "", tab: "pending" });

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
  /** Stacked marketplace toasts (e.g. multiple “Order placed” while prior toasts are still visible). */
  const [marketplaceToasts, setMarketplaceToasts] = useState([]);
  const [notificationInbox, setNotificationInbox] = useState(() => readNotificationInboxFromStorage());
  const marketplaceToastTimeoutsRef = useRef({});
  const unreadNotificationCount = useMemo(
    () => notificationInbox.reduce((sum, item) => sum + (item.read ? 0 : 1), 0),
    [notificationInbox],
  );
  const addNotification = useCallback((raw, { markRead = false } = {}) => {
    const text = String(raw ?? "").trim();
    if (!text) return;
    const item = {
      id: createNotificationId(),
      text,
      createdAt: Date.now(),
      read: !!markRead,
      type: classifyNotificationType(text),
    };
    setNotificationInbox((prev) => [item, ...prev].slice(0, NOTIFICATION_INBOX_MAX_ITEMS));
  }, []);
  const markNotificationRead = useCallback((id) => {
    setNotificationInbox((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
  }, []);
  const markAllNotificationsRead = useCallback(() => {
    setNotificationInbox((prev) => prev.map((item) => (item.read ? item : { ...item, read: true })));
  }, []);
  const dismissNotification = useCallback((id) => {
    setNotificationInbox((prev) => prev.filter((item) => item.id !== id));
  }, []);
  const clearNotificationInbox = useCallback(() => {
    setNotificationInbox([]);
  }, []);
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
    const id = createNotificationId();
    setMarketplaceToasts((prev) => [...prev, { id, text }]);
    addNotification(text);
    const tid = window.setTimeout(() => {
      delete marketplaceToastTimeoutsRef.current[id];
      setMarketplaceToasts((prev) => prev.filter((t) => t.id !== id));
    }, 10000);
    marketplaceToastTimeoutsRef.current[id] = tid;
  }, [addNotification]);

  useEffect(() => {
    try {
      window.localStorage.setItem(NOTIFICATION_INBOX_STORAGE_KEY, JSON.stringify(notificationInbox));
    } catch {
      /* ignore */
    }
  }, [notificationInbox]);

  useEffect(() => {
    if (activeView === VIEWS.NOTIFICATIONS && unreadNotificationCount > 0) {
      markAllNotificationsRead();
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
  /** Marketplace “Buy now” requires contact + delivery/pickup details (lighter than seller upload checklist). */
  const buyNowFromProfile = useMemo(() => {
    const parsedAddress = splitAddressParts(user?.address);
    const checks = [
      [String(user?.username || "").trim().length >= 3, "Username"],
      [toPhilippinesLocalPhone10(user?.phone).length === 10, "Phone number"],
      [String(user?.firstName || "").trim().length >= 2, "First name"],
      [String(user?.lastName || "").trim().length >= 2, "Last name"],
      [String(parsedAddress.addressHouseStreet || "").trim().length > 0, "House number & street"],
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
    const sid = String(shopCommunityId);
    if (String(listingCommunityFromProfile.id || "") === sid) return true;
    if (String(joinedShopCommunityId || "") === sid) return true;
    const openCommunity = communities.find((c) => String(c.id || "") === sid);
    if (openCommunity?.createdBy && String(openCommunity.createdBy) === String(user?.id || "")) return true;
    return false;
  }, [communities, joinedShopCommunityId, listingCommunityFromProfile.id, shopCommunityId, user?.id]);
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
  /** Throttle pull-to-refresh triggers. */
  const communityShopPtrLastTriggerRef = useRef(0);
  /** Clear orders when `ordersRole` changes; keep rows when re-entering Orders with the same role. */
  const ordersDataQueryKeyRef = useRef(null);
  const communityListingsSyncedRef = useRef(null);
  const skipAutoCommunityBrowseRef = useRef(false);
  const [expandedBidOrderId, setExpandedBidOrderId] = useState(null);
  const [bidsForOrder, setBidsForOrder] = useState([]);
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
  const [quickAddListing, setQuickAddListing] = useState(null);
  const [quickAddImagePreviewOpen, setQuickAddImagePreviewOpen] = useState(false);
  const [quickActionType, setQuickActionType] = useState("cart");
  const [quickAddQuantity, setQuickAddQuantity] = useState("1");
  const [quickAddComment, setQuickAddComment] = useState("");
  const [quickOrderFulfillmentType, setQuickOrderFulfillmentType] = useState("pickup");
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);
  const [quickAddInlineError, setQuickAddInlineError] = useState("");
  /** Read-only modal: full listing text + cart/order buyer note. */
  const [productInspect, setProductInspect] = useState(null);
  const [recentlyAddedCartListingIds, setRecentlyAddedCartListingIds] = useState(() => readStoredStringArray(CART_RECENT_BADGE_STORAGE_KEY));
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
  const hasViewedRecentCartAddsRef = useRef(false);
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
  const startCartItemFadeOut = useCallback((listingId) => {
    const id = String(listingId || "");
    if (!id) return;
    setCartRemovingListingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (cartRemovingListingIdsRef.current[id]) {
      clearTimeout(cartRemovingListingIdsRef.current[id]);
    }
    cartRemovingListingIdsRef.current[id] = window.setTimeout(() => {
      setCartItems((prev) => prev.filter((it) => String(it.listingId) !== id));
      setCartRemovingListingIds((prev) => prev.filter((x) => x !== id));
      setRecentlyAddedCartListingIds((prev) => prev.filter((x) => x !== id));
      delete cartRemovingListingIdsRef.current[id];
    }, 2000);
  }, []);
  const cancelCartItemFadeOut = useCallback((listingId) => {
    const id = String(listingId || "");
    if (!id) return;
    if (cartRemovingListingIdsRef.current[id]) {
      clearTimeout(cartRemovingListingIdsRef.current[id]);
      delete cartRemovingListingIdsRef.current[id];
    }
    setCartRemovingListingIds((prev) => prev.filter((x) => x !== id));
  }, []);
  useEffect(() => {
    if (activeView === VIEWS.CART && recentlyAddedCartListingIds.length > 0) {
      hasViewedRecentCartAddsRef.current = true;
      return;
    }
    if (activeView !== VIEWS.CART && hasViewedRecentCartAddsRef.current && recentlyAddedCartListingIds.length > 0) {
      setRecentlyAddedCartListingIds([]);
      hasViewedRecentCartAddsRef.current = false;
      return;
    }
    if (activeView !== VIEWS.CART && recentlyAddedCartListingIds.length === 0) {
      hasViewedRecentCartAddsRef.current = false;
    }
  }, [activeView, recentlyAddedCartListingIds]);
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(CART_RECENT_BADGE_STORAGE_KEY, JSON.stringify(recentlyAddedCartListingIds));
    } catch {
      // ignore storage failures
    }
  }, [recentlyAddedCartListingIds]);

  /** Dismiss queues when leaving Purchases / Orders or switching tabs (localStorage-backed). */
  const ordersNavPrevRef = useRef({ view: activeView, role: ordersRole });
  useEffect(() => {
    const prev = ordersNavPrevRef.current;
    const buyerList = buyerOrdersForBadges ?? [];
    const sellerList = sellerOrdersForBadges ?? [];
    const leftMyPurchases = prev.view === VIEWS.MY_PURCHASES && activeView !== VIEWS.MY_PURCHASES;
    const leftOrders = prev.view === VIEWS.ORDERS && activeView !== VIEWS.ORDERS;
    if (leftMyPurchases) {
      const dismissCancelled = buyerCancelledTabVisitedThisPurchasesSessionRef.current;
      const dismissProcessing = buyerProcessingTabVisitedThisPurchasesSessionRef.current;
      const dismissCompleted = buyerCompletedTabVisitedThisPurchasesSessionRef.current;
      buyerCancelledTabVisitedThisPurchasesSessionRef.current = false;
      buyerProcessingTabVisitedThisPurchasesSessionRef.current = false;
      buyerCompletedTabVisitedThisPurchasesSessionRef.current = false;
      dismissBuyerOrdersForTab("pending", buyerList);
      if (dismissProcessing) dismissBuyerOrdersForTab("processing", buyerList);
      if (dismissCompleted) dismissBuyerOrdersForTab("completed", buyerList);
      if (dismissCancelled) dismissBuyerOrdersForTab("cancelled", buyerList);
    }
    if (leftOrders) {
      if (prev.role === "seller") {
        const dismissCancelled = sellerCancelledTabVisitedThisOrdersSessionRef.current;
        const dismissProcessing = sellerProcessingTabVisitedThisOrdersSessionRef.current;
        const dismissCompleted = sellerCompletedTabVisitedThisOrdersSessionRef.current;
        sellerCancelledTabVisitedThisOrdersSessionRef.current = false;
        sellerProcessingTabVisitedThisOrdersSessionRef.current = false;
        sellerCompletedTabVisitedThisOrdersSessionRef.current = false;
        dismissSellerOrdersForTab("pending", sellerList);
        if (dismissProcessing) dismissSellerOrdersForTab("processing", sellerList);
        if (dismissCompleted) dismissSellerOrdersForTab("completed", sellerList);
        if (dismissCancelled) dismissSellerOrdersForTab("cancelled", sellerList);
      }
      if (prev.role === "buyer") {
        setBuyerOrderDismissedIdsByTab((prevTabs) => {
          const next = { ...prevTabs };
          for (const tab of RECENT_ORDER_TAB_KEYS) {
            const ids = buyerList
              .filter((o) => orderMatchesOrdersStatusTab(o.status, tab))
              .map((o) => String(o.id || ""))
              .filter(Boolean);
            const set = new Set(next[tab] ?? []);
            ids.forEach((id) => set.add(id));
            next[tab] = Array.from(set);
          }
          return next;
        });
      }
    }
    const enteredMyPurchases = prev.view !== VIEWS.MY_PURCHASES && activeView === VIEWS.MY_PURCHASES;
    if (enteredMyPurchases) {
      buyerCancelledTabVisitedThisPurchasesSessionRef.current = false;
      buyerProcessingTabVisitedThisPurchasesSessionRef.current = false;
      buyerCompletedTabVisitedThisPurchasesSessionRef.current = false;
    }
    const enteredSellerOrders = prev.view !== VIEWS.ORDERS && activeView === VIEWS.ORDERS && ordersRole === "seller";
    if (enteredSellerOrders) {
      sellerCancelledTabVisitedThisOrdersSessionRef.current = false;
      sellerProcessingTabVisitedThisOrdersSessionRef.current = false;
      sellerCompletedTabVisitedThisOrdersSessionRef.current = false;
    }
    ordersNavPrevRef.current = { view: activeView, role: ordersRole };
  }, [activeView, ordersRole, buyerOrdersForBadges, sellerOrdersForBadges, dismissBuyerOrdersForTab, dismissSellerOrdersForTab]);

  useEffect(() => {
    if (activeView !== VIEWS.MY_PURCHASES || ordersRole !== "buyer") return;
    if (ordersStatusTab === "cancelled") buyerCancelledTabVisitedThisPurchasesSessionRef.current = true;
    if (ordersStatusTab === "processing") buyerProcessingTabVisitedThisPurchasesSessionRef.current = true;
    if (ordersStatusTab === "completed") buyerCompletedTabVisitedThisPurchasesSessionRef.current = true;
  }, [activeView, ordersRole, ordersStatusTab]);

  useEffect(() => {
    if (activeView !== VIEWS.ORDERS || ordersRole !== "seller") return;
    if (ordersStatusTab === "cancelled") sellerCancelledTabVisitedThisOrdersSessionRef.current = true;
    if (ordersStatusTab === "processing") sellerProcessingTabVisitedThisOrdersSessionRef.current = true;
    if (ordersStatusTab === "completed") sellerCompletedTabVisitedThisOrdersSessionRef.current = true;
  }, [activeView, ordersRole, ordersStatusTab]);

  useEffect(() => {
    const key =
      ordersRole === "buyer" && activeView === VIEWS.MY_PURCHASES
        ? "buyer-mp"
        : ordersRole === "buyer" && activeView === VIEWS.ORDERS
          ? "buyer-ord"
          : ordersRole === "seller" && activeView === VIEWS.ORDERS
            ? "seller-ord"
            : "other";

    const ctx = ordersStatusTabDismissContextRef.current;
    const leaving = ctx.tab;
    const entering = ordersStatusTab;
    const leavingIsTab = RECENT_ORDER_TAB_KEYS.includes(leaving);
    if (key === ctx.key && key !== "other" && leaving !== entering && RECENT_ORDER_TAB_KEYS.includes(entering) && leavingIsTab) {
      const buyerList = buyerOrdersForBadges ?? [];
      const sellerList = sellerOrdersForBadges ?? [];
      if (key.startsWith("buyer")) {
        dismissBuyerOrdersForTab(leaving, buyerList);
      } else if (key === "seller-ord") {
        dismissSellerOrdersForTab(leaving, sellerList);
        dismissSellerOrdersForTab(entering, sellerList);
      }
    }
    ordersStatusTabDismissContextRef.current = { key, tab: ordersStatusTab };
  }, [ordersStatusTab, activeView, ordersRole, buyerOrdersForBadges, sellerOrdersForBadges, dismissBuyerOrdersForTab, dismissSellerOrdersForTab]);

  useEffect(() => {
    if (!token) {
      setPolledSellerOrders(null);
      setPolledBuyerOrders(null);
    }
  }, [token]);
  useEffect(() => {
    setRecentlyAddedCartListingIds((prev) => {
      if (!prev.length) return prev;
      const existingIds = new Set(cartItems.map((it) => String(it?.listingId || "")));
      const next = prev.filter((id) => existingIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [cartItems]);
  const [sellerTab, setSellerTab] = useState(SELLER_TABS.PRODUCTS);
  const [sellerProductsView, setSellerProductsView] = useState("list");
  const [communityProductsView, setCommunityProductsView] = useState("grid");
  const [favoriteProductsView, setFavoriteProductsView] = useState("list");
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
      return "list";
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
  /** Inline notice by “Upload product” on Profile (not the global marketplace banner). */
  const [profileUploadProductNotice, setProfileUploadProductNotice] = useState("");

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
          await apiRequest("/auth/me", {
            method: "PATCH",
            token,
            body: { community: joinedName, communityId: joinedId || null },
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
    [applyJoinedCommunity, token, user?.id],
  );

  const loadCommunityShopListings = useCallback(
    async ({ preserveExistingRows = false, cancelledRef } = {}) => {
      if (!token || activeView !== VIEWS.COMMUNITY_SHOP) return;
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
          await apiRequest("/auth/me", {
            method: "PATCH",
            token,
            body: { community: "", communityId: null },
          });
          const communitiesRes = await apiRequest("/communities", { token });
          setCommunities(communitiesRes?.communities || []);
          if (notifySuccess) pushMarketplaceToast(`You left ${leftName || "the community"} successfully.`);
        } catch (error) {
          pushMarketplaceToast(error?.message || "Left locally, but we could not sync your membership yet.");
        }
      })();
    },
    [applyJoinedCommunity, detachSellerListingsFromCommunity, token],
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
        setUser((prev) => {
          const preservedJoined =
            incoming.joinedAt || incoming.createdAt || incoming.created_at || prev?.joinedAt || prev?.createdAt || prev?.created_at || "";
          return { ...(prev || {}), ...incoming, joinedAt: preservedJoined };
        });
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

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const lock = activeView === VIEWS.MESSAGES && messagesMobilePane === "thread" && isMobile;
    if (!lock) return undefined;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [activeView, messagesMobilePane]);

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
  const commerceFlowOrdersView = activeView === VIEWS.MY_PURCHASES ? commerceFlowViewBuyer : commerceFlowViewSeller;
  const setCommerceFlowOrdersView =
    activeView === VIEWS.MY_PURCHASES ? setCommerceFlowViewBuyer : setCommerceFlowViewSeller;

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
      const incoming = Array.isArray(d?.items) ? d.items : [];
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
          startCartItemFadeOut(id);
          try {
            await apiRequest(`/me/cart/items/${id}`, {
              method: "DELETE",
              token,
            });
            clearMarketplaceToasts();
          } catch (e) {
            cancelCartItemFadeOut(id);
            pushMarketplaceToast(e.message || "Could not remove item from cart.");
          } finally {
            setCartQtySavingId(null);
          }
        } else {
          startCartItemFadeOut(id);
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
          const incoming = Array.isArray(d?.items) ? d.items : [];
          setCartItems((prev) => mergeCartItemsPreservingOrder(prev, incoming));
          clearMarketplaceToasts();
        } catch (e) {
          pushMarketplaceToast(e.message || "Could not update quantity.");
        } finally {
          setCartQtySavingId(null);
        }
      } else {
        setCartItems((prev) => prev.map((it) => (String(it.listingId) === id ? { ...it, quantity: clamped } : it)));
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
      const qty = Math.max(1, Math.floor(Number(item?.quantity) || 1));
      const modes = Array.isArray(item?.fulfillmentModes) ? item.fulfillmentModes : [];
      const fulfillmentType = modes.includes("pickup") ? "pickup" : modes.includes("delivery") ? "delivery" : "pickup";
      try {
        const created = await apiRequest("/orders", {
          method: "POST",
          token,
          body: { listingId, fulfillmentType, quantity: qty },
        });
        successCount += 1;
        startCartItemFadeOut(listingId);
        try {
          await apiRequest(`/me/cart/items/${listingId}`, {
            method: "DELETE",
            token,
          });
        } catch {
          // Keep checkout success even if cart row deletion returns an error.
          cancelCartItemFadeOut(listingId);
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
    async (transition, label) => {
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
      setOrdersBulkActionSubmitting(true);
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
          await apiRequest(`/orders/${oid}`, { method: "PATCH", token, body: { transition: transitionNorm } });
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
      setOrdersBulkActionSubmitting(false);
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

  /** Mobile: pull down from top of page to refetch listings (same as Refresh). */
  useEffect(() => {
    if (!token || activeView !== VIEWS.COMMUNITY_SHOP) return undefined;
    if (typeof window === "undefined" || !("ontouchstart" in window)) return undefined;
    let startY = 0;
    let startScroll = 0;
    let armed = false;
    const PTR_COOLDOWN_MS = 2500;
    const PULL_THRESHOLD_PX = 72;
    const TOP_TOUCH_MAX_Y = 140;

    const onTouchStart = (e) => {
      if (listingsBusyRef.current) return;
      if (window.scrollY > 6) return;
      const y = e.touches[0]?.clientY ?? 0;
      if (y > TOP_TOUCH_MAX_Y) return;
      startY = y;
      startScroll = window.scrollY;
      armed = true;
    };

    const onTouchEnd = (e) => {
      if (!armed) return;
      armed = false;
      if (listingsBusyRef.current) return;
      if (startScroll > 6 || window.scrollY > 6) return;
      const endY = e.changedTouches[0]?.clientY ?? startY;
      const dy = endY - startY;
      if (dy < PULL_THRESHOLD_PX) return;
      const now = Date.now();
      if (now - communityShopPtrLastTriggerRef.current < PTR_COOLDOWN_MS) return;
      communityShopPtrLastTriggerRef.current = now;
      void loadCommunityShopListings({ preserveExistingRows: true });
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [token, activeView, loadCommunityShopListings]);

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

  const patchOrderTransition = async (orderId, transition, options = {}) => {
    const { orderIds, successMessage } = options;
    const transitionNorm = String(transition ?? "").trim();
    clearMarketplaceToasts();
    try {
      const ids =
        transitionNorm === "buyer_ack_receipt" && Array.isArray(orderIds) && orderIds.length > 0
          ? [...new Set(orderIds.map((x) => String(x || "")).filter(Boolean))]
          : [String(orderId || "")].filter(Boolean);
      for (const id of ids) {
        await apiRequest(`/orders/${id}`, { method: "PATCH", token, body: { transition: transitionNorm } });
      }
      const data = await apiRequest(`/orders?role=${ordersRole}`, { token });
      setOrders(data.orders || []);
      pushMarketplaceToast(successMessage || "Order updated.");
    } catch (e) {
      pushMarketplaceToast(e.message || "Could not update order.");
    }
  };

  const toggleCompletedTabOrderDetails = useCallback((orderId) => {
    const k = String(orderId || "");
    if (!k) return;
    setCompletedTabOrderDetailsOpen((prev) => ({ ...prev, [k]: !prev[k] }));
  }, []);

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

  const acceptOrderBid = async (orderId, bidId) => {
    clearMarketplaceToasts();
    try {
      await apiRequest(`/orders/${orderId}/bids/${bidId}/accept`, { method: "POST", token });
      const data = await apiRequest(`/orders?role=${ordersRole}`, { token });
      setOrders(data.orders || []);
      setExpandedBidOrderId(null);
      setBidsForOrder([]);
      pushMarketplaceToast("Bid accepted. Agreed delivery fee is stored for COD at handoff.");
    } catch (e) {
      pushMarketplaceToast(e.message || "Could not accept bid.");
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
      const [sum, exp] = await Promise.all([apiRequest("/me/seller/summary", { token }), apiRequest("/me/expenses", { token })]);
      setSellerSummary(sum);
      setExpenses(exp.expenses || []);
      pushMarketplaceToast("Expense added.");
    } catch (e) {
      pushMarketplaceToast(e.message || "Could not add expense.");
    }
  };

  const deleteExpenseById = async (id) => {
    try {
      await apiRequest(`/me/expenses/${id}`, { method: "DELETE", token });
      const [sum, exp] = await Promise.all([apiRequest("/me/seller/summary", { token }), apiRequest("/me/expenses", { token })]);
      setSellerSummary(sum);
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
          pickup: false,
          delivery: false,
        });
        setListingFieldErrors({});
        setListingImageFile(null);
        if (listingImagePreviewUrl) URL.revokeObjectURL(listingImagePreviewUrl);
        setListingImagePreviewUrl("");
      }
      pushMarketplaceToast("Listing deleted.");
    } catch (e) {
      pushMarketplaceToast(e.message || "Could not delete listing.");
    }
  };

  const adjustSellerListingQuantityById = useCallback(
    async (listingId, delta) => {
      const id = String(listingId || "");
      if (!id || !Number.isFinite(Number(delta)) || Number(delta) === 0) return;
      if (!token) {
        pushMarketplaceToast("Please sign in to update listing quantity.");
        return;
      }
      const target = sellerListings.find((l) => String(l?.id || "") === id);
      if (!target) return;
      const currentQty = Math.max(0, Number(target.quantity) || 0);
      const nextQty = Math.max(0, currentQty + Number(delta));
      if (nextQty === currentQty) return;
      setSellerListingQtySavingId(id);
      try {
        const res = await apiRequest(`/me/listings/${id}`, {
          method: "PATCH",
          token,
          body: { quantity: nextQty },
        });
        const updated = res?.listing;
        setSellerListings((prev) =>
          prev.map((l) =>
            String(l?.id || "") === id
              ? {
                  ...l,
                  ...(updated || {}),
                  quantity: Number.isFinite(Number(updated?.quantity)) ? Number(updated.quantity) : nextQty,
                }
              : l,
          ),
        );
        pushMarketplaceToast("Product quantity updated.");
      } catch (e) {
        pushMarketplaceToast(e.message || "Could not update product quantity.");
      } finally {
        setSellerListingQtySavingId(null);
      }
    },
    [sellerListings, token],
  );

  const setSellerListingQuantityById = useCallback(
    async (listingId, targetQty) => {
      const id = String(listingId || "");
      const nextQty = Math.max(0, Math.floor(Number(targetQty) || 0));
      if (!id) return;
      if (!token) {
        pushMarketplaceToast("Please sign in to update listing quantity.");
        return;
      }
      const target = sellerListings.find((l) => String(l?.id || "") === id);
      if (!target) return;
      const currentQty = Math.max(0, Number(target.quantity) || 0);
      if (nextQty === currentQty) return;
      setSellerListingQtySavingId(id);
      try {
        const res = await apiRequest(`/me/listings/${id}`, {
          method: "PATCH",
          token,
          body: { quantity: nextQty },
        });
        const updated = res?.listing;
        setSellerListings((prev) =>
          prev.map((l) =>
            String(l?.id || "") === id
              ? {
                  ...l,
                  ...(updated || {}),
                  quantity: Number.isFinite(Number(updated?.quantity)) ? Number(updated.quantity) : nextQty,
                }
              : l,
          ),
        );
        pushMarketplaceToast("Product quantity updated.");
      } catch (e) {
        pushMarketplaceToast(e.message || "Could not update product quantity.");
      } finally {
        setSellerListingQtySavingId(null);
      }
    },
    [sellerListings, token],
  );

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
    const initialFulfillment = savedPref && listingModes.includes(savedPref) ? savedPref : defaultFulfillment;
    setQuickAddListing(listing);
    setQuickActionType(mode);
    setQuickOrderFulfillmentType(initialFulfillment);
    setQuickAddQuantity("1");
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

  const closeQuickAddModal = () => {
    if (quickAddSubmitting) return;
    setQuickAddImagePreviewOpen(false);
    setQuickAddModalOpen(false);
    setQuickAddListing(null);
    setQuickActionType("cart");
    setQuickOrderFulfillmentType("pickup");
    setQuickAddQuantity("1");
    setQuickAddComment("");
    setQuickAddInlineError("");
  };

  const closeProductInspect = useCallback(() => setProductInspect(null), []);

  const openProductInspect = useCallback((listingLike, extra = {}) => {
    if (!listingLike) return;
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
    setProductInspect({
      title: String(listingLike.title || "Product"),
      imageUrl: listingLike.imageUrl,
      priceCents,
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
      quantity:
        extra.quantity != null && Number.isFinite(Number(extra.quantity)) ? Number(extra.quantity) : null,
      quantityLabel: extra.quantityLabel || "Quantity",
      subtitle: extra.subtitle || "",
      listingStockQty:
        extra.listingStockQty != null && Number.isFinite(Number(extra.listingStockQty))
          ? Number(extra.listingStockQty)
          : null,
      showBuyerCommerceActions: Boolean(extra.showBuyerCommerceActions),
      showSellerCommerceActions: Boolean(extra.showSellerCommerceActions),
      onAddToCart: typeof extra.onAddToCart === "function" ? extra.onAddToCart : undefined,
      onBuyNow: typeof extra.onBuyNow === "function" ? extra.onBuyNow : undefined,
      onEditListing: typeof extra.onEditListing === "function" ? extra.onEditListing : undefined,
      onSaleSelect: typeof extra.onSaleSelect === "function" ? extra.onSaleSelect : undefined,
      buyNowDisabled: Boolean(extra.buyNowDisabled),
      buyNowDisabledReason: String(extra.buyNowDisabledReason || ""),
    });
  }, [activeView, closeProductInspect, user?.id, usersById]);

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
              comment: String(quickAddComment || "").trim(),
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
              comment: String(quickAddComment || "").trim(),
            },
          });
          const incoming = Array.isArray(cartData?.items) ? cartData.items : [];
          setCartItems((prev) => {
            const merged = mergeCartItemsPreservingOrder(prev, incoming);
            return moveSellerGroupToTop(merged, quickAddListing?.sellerId);
          });
          setRecentlyAddedCartListingIds((prev) => (prev.includes(addedListingId) ? prev : [...prev, addedListingId]));
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
        setRecentlyAddedCartListingIds((prev) => (prev.includes(addedListingId) ? prev : [...prev, addedListingId]));
        {
          const titleForToast = String(quickAddListing.title || "Item").trim();
          const shortTitle = titleForToast.length > 52 ? `${titleForToast.slice(0, 52)}…` : titleForToast;
          pushMarketplaceToast(`Added to cart: ${shortTitle} ×${parsedQty}.`);
        }
      }
      setActiveView(shopCommunityId ? VIEWS.COMMUNITY_SHOP : VIEWS.BROWSE);
      setQuickAddModalOpen(false);
      setQuickAddListing(null);
      setQuickAddQuantity("1");
      setQuickAddComment("");
      setQuickAddInlineError("");
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
    clearMarketplaceToasts();
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
      setListingFieldErrors((prev) => ({ ...prev, fulfillment: "Choose at least one fulfillment method." }));
      clearMarketplaceToasts();
      return;
    }
    setListingSaving(true);
    clearMarketplaceToasts();
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
      clearMarketplaceToasts();
      setPublishFlash("");
      setSellerTab(SELLER_TABS.PRODUCTS);
      goOwnProfile();
      navigate("/", { replace: true });
    } catch (e) {
      pushMarketplaceToast(e.message || "Could not publish listing.");
    } finally {
      setListingSaving(false);
    }
  };

  const setListingImage = (file) => {
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      pushMarketplaceToast("Please choose an image file.");
      return;
    }
    const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_LISTING_IMAGE_BYTES) {
      pushMarketplaceToast("Image is too large. Please choose one smaller than 5MB.");
      return;
    }
    if (listingImagePreviewUrl) URL.revokeObjectURL(listingImagePreviewUrl);
    setListingImageFile(file);
    setListingImagePreviewUrl(URL.createObjectURL(file));
    clearMarketplaceToasts();
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
    } else if (normalizedUsername.length < 3 || normalizedUsername.length > 20) {
      nextFieldErrors.username = "Username must be 3-20 characters.";
    } else if (!/^[A-Za-z]/.test(normalizedUsername)) {
      nextFieldErrors.username = "Username must start with a letter.";
    } else if (/\s/.test(normalizedUsername)) {
      nextFieldErrors.username = "Username cannot contain spaces.";
    } else if (!/^[A-Za-z0-9._]+$/.test(normalizedUsername)) {
      nextFieldErrors.username = "Only letters, numbers, dots, and underscores are allowed.";
    } else if (/[A-Z]/.test(normalizedUsername)) {
      nextFieldErrors.username = "Use lowercase letters only (a-z).";
    } else if (/(\.\.|__)/.test(normalizedUsername)) {
      nextFieldErrors.username = "Username cannot contain duplicate dots or underscores.";
    }
    const namePattern = /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/;
    if (!normalizedFirstName) {
      nextFieldErrors.firstName = "First name is required.";
    } else if (normalizedFirstName.length < 3 || normalizedFirstName.length > 50) {
      nextFieldErrors.firstName = "First name must be 3-50 characters.";
    } else if (!namePattern.test(normalizedFirstName)) {
      nextFieldErrors.firstName = "First name can only contain letters, spaces, and hyphens.";
    }
    if (normalizedMiddleName && !namePattern.test(normalizedMiddleName)) {
      nextFieldErrors.middleName = "Middle name can only contain letters, spaces, and hyphens.";
    }
    if (!normalizedLastName) {
      nextFieldErrors.lastName = "Last name is required.";
    } else if (normalizedLastName.length < 3 || normalizedLastName.length > 50) {
      nextFieldErrors.lastName = "Last name must be 3-50 characters.";
    } else if (!namePattern.test(normalizedLastName)) {
      nextFieldErrors.lastName = "Last name can only contain letters, spaces, and hyphens.";
    }
    if (!normalizedGender) {
      nextFieldErrors.gender = "Gender is required.";
    }
    if (!normalizedBirthday) {
      nextFieldErrors.birthday = "Birthday is required.";
    } else if (normalizedBirthday > todayIsoDate) {
      nextFieldErrors.birthday = "Birthday cannot be in the future.";
    }
    if (!normalizedProvince) nextFieldErrors.addressProvince = "Province is required.";
    if (!normalizedCity) nextFieldErrors.addressCity = "City or Municipality is required.";
    if (!normalizedBarangay) nextFieldErrors.addressBarangay = "Barangay is required.";
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
        setProfileFieldErrors((prev) => ({ ...prev, phone: "This mobile number is already in use." }));
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
              <LinkMartLogo className="h-10 w-auto max-w-[13rem] shrink-0 object-contain sm:h-11 sm:max-w-[14rem]" />
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
                  setLandingDiscoverySlide((s) => (s - 1 + LANDING_DISCOVERY_SLIDES.length) % LANDING_DISCOVERY_SLIDES.length)
                }
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="absolute right-0 top-[42%] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200/90 bg-white text-neutral-500 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-500 sm:right-1 md:right-2"
                aria-label="Next categories"
                onClick={() => setLandingDiscoverySlide((s) => (s + 1) % LANDING_DISCOVERY_SLIDES.length)}
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
              <div className="mx-auto grid w-full max-w-5xl grid-cols-1 justify-items-center gap-12 px-4 sm:grid-cols-3 sm:gap-x-8 sm:gap-y-0 md:gap-x-12 md:px-6">
                {LANDING_DISCOVERY_SLIDES[landingDiscoverySlide].map((card) => (
                  <div key={card.title} className="flex w-full max-w-[20rem] flex-col items-center gap-3 text-center sm:max-w-none">
                    {card.logo ? (
                      <div className="flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl p-2">
                        <img src={card.logo} alt={`${card.title} logo`} className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <div className="flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-sm font-bold tracking-tight text-brand-primary shadow-sm dark:bg-slate-800 dark:text-brand-accent sm:text-base">
                        {card.badge}
                      </div>
                    )}
                    <h3 className="px-1 text-[15px] font-semibold leading-snug text-brand-accent sm:text-base md:whitespace-nowrap md:text-lg">{card.title}</h3>
                    <p className="text-pretty text-sm leading-relaxed text-neutral-600 dark:text-slate-400">{card.description}</p>
                  </div>
                ))}
              </div>
              <div className="mt-10 flex justify-center gap-2.5">
                {LANDING_DISCOVERY_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`h-2 w-2 rounded-full transition ${i === landingDiscoverySlide ? "bg-neutral-700 dark:bg-slate-200" : "bg-neutral-300 dark:bg-slate-600"}`}
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
        goOwnProfile={goOwnProfile}
        goBrowse={goBrowse}
        goOrders={goOrders}
        goMyPurchases={goMyPurchases}
        goCart={goCart}
        cartItemCount={recentlyAddedCartListingIds.length}
        purchasesItemCount={purchaseNavBadgeCount}
        ordersItemCount={sellerNavBadgeCount}
        notificationUnreadCount={unreadNotificationCount}
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

      {marketplaceToasts.length > 0 ? (
        <div
          className="pointer-events-none fixed left-3 right-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px)+0.75rem)] z-[70] flex max-h-[min(70vh,calc(100vh-10rem))] flex-col gap-2 overflow-y-auto sm:left-4 sm:right-4 md:left-auto md:right-6 md:bottom-6 md:w-[24rem]"
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
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-base leading-none transition hover:bg-black/5 dark:hover:bg-white/10 ${fb.dismissClass}`}
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

      <main className="app-container space-y-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] max-sm:pt-4 md:space-y-6 md:py-8 md:pb-12">
        {isBrowseLikeView && activeView !== VIEWS.FAVORITES && (
          <section
            className={`${UI_KIT.viewSection} space-y-4 md:space-y-6 ${
              activeView === VIEWS.COMMUNITY_SHOP ? "border-0 ring-0" : ""
            }`}
          >
            <div className="space-y-4">
              {activeView === VIEWS.COMMUNITY_SHOP ? (
                <div
                  className={`${UI_KIT.surfaceRaised} relative overflow-hidden border border-[#7cded9]/60 bg-gradient-to-r from-[#e6fbfb] via-[#edf8ff] to-[#eaf2ff] p-3 transition-opacity duration-200 dark:border-[#1f3c56] dark:bg-gradient-to-r dark:from-[#0f2234] dark:via-[#11283d] dark:to-[#16324a] sm:p-4 lg:p-5 ${
                    mobileCommunityFiltersOpen ? "max-lg:pointer-events-none max-lg:opacity-40" : ""
                  }`}
                >
                  <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4 lg:gap-5">
                      <button
                        type="button"
                        className="hidden min-h-[44px] shrink-0 items-center justify-center rounded-full bg-brand-primary px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary/90 sm:min-h-0 sm:justify-start sm:py-2 lg:mt-0.5 lg:inline-flex lg:w-auto dark:bg-brand-accent dark:text-slate-900 dark:hover:bg-brand-accent/90"
                        onClick={() => leaveCommunityToGlobalMarketplace()}
                      >
                        ← All communities
                      </button>
                      <div className="min-w-0 flex-1 space-y-2 border-neutral-200 sm:space-y-2 lg:border-l lg:pl-5 dark:lg:border-slate-600">
                        <div className="flex items-start justify-between gap-2 lg:flex-col lg:items-stretch lg:justify-start lg:gap-2">
                          <div className="min-w-0 flex-1 lg:flex-none">
                            <h2 className="text-xl font-semibold tracking-tight text-[#123a5f] dark:text-[#e9f7ff] lg:text-2xl">
                              {toTitleCase(activeCommunity?.name?.trim()) || "Community"}
                            </h2>
                            {activeCommunityLocaleLine ? (
                              <p className="mt-1 text-sm text-[#2a597f] dark:text-[#9fc3d9]">{activeCommunityLocaleLine}</p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 self-start pt-0.5 lg:w-full lg:justify-start lg:self-auto lg:pt-0">
                            {isMemberOfOpenCommunity ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/80 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                                ● Joined member
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-neutral-300/80 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                ○ Not a member yet
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
                          <div className="flex flex-row items-center gap-1.5">
                            <button
                              type="button"
                              className={`inline-flex min-h-9 items-center justify-center rounded-full bg-brand-primary px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-primary/90 dark:bg-brand-accent dark:text-slate-900 dark:hover:bg-brand-accent/90 ${
                                activeCommunity?.createdBy && String(activeCommunity.createdBy) === String(user?.id || "")
                                    ? "w-full"
                                    : "min-w-0 flex-1 truncate"
                              }`}
                              onClick={() => leaveCommunityToGlobalMarketplace()}
                            >
                              <span className="sm:hidden">← Communities</span>
                              <span className="hidden sm:inline">← All communities</span>
                            </button>
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
                            ) : activeCommunity?.createdBy && String(activeCommunity.createdBy) !== String(user?.id || "") ? (
                              <button
                                type="button"
                                aria-label="Leave this community"
                                className="inline-flex min-h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 dark:bg-rose-500 dark:text-white dark:hover:bg-rose-400"
                                onClick={requestLeaveCommunityConfirmation}
                              >
                                Leave
                              </button>
                            ) : null}
                          </div>
                          {isMemberOfOpenCommunity && activeCommunity?.createdBy && String(activeCommunity.createdBy) === String(user?.id || "") ? (
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                className="inline-flex min-h-9 items-center justify-center rounded-full border border-neutral-300/80 bg-white px-2 py-1.5 text-[11px] font-medium leading-tight text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                                onClick={() => openEditCommunityModal(activeCommunity)}
                              >
                                Edit community
                              </button>
                              <button
                                type="button"
                                className="inline-flex min-h-9 items-center justify-center rounded-full bg-rose-600 px-2 py-1.5 text-[11px] font-semibold leading-tight text-white shadow-sm transition hover:bg-rose-700 dark:bg-rose-500 dark:text-white dark:hover:bg-rose-400"
                                onClick={requestLeaveCommunityConfirmation}
                              >
                                Leave
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="hidden w-full flex-wrap gap-2 lg:mt-0.5 lg:flex lg:w-auto lg:shrink-0 lg:justify-end">
                      {activeCommunity?.createdBy && String(activeCommunity.createdBy) === String(user?.id || "") ? (
                        <button
                          type="button"
                          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-neutral-300/80 bg-white px-3 py-2.5 text-xs font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 sm:min-h-0 sm:flex-none sm:px-4 sm:py-2 sm:text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                          onClick={() => openEditCommunityModal(activeCommunity)}
                        >
                          Edit community
                        </button>
                      ) : null}
                      {!isMemberOfOpenCommunity ? (
                        <button
                          type="button"
                          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary/90 sm:min-h-0 sm:flex-none sm:py-2 dark:bg-brand-accent dark:text-slate-900 dark:hover:bg-brand-accent/90"
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
                          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-rose-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 sm:min-h-0 sm:flex-none sm:px-4 sm:py-2 sm:text-sm dark:bg-rose-500 dark:text-white dark:hover:bg-rose-400"
                          onClick={requestLeaveCommunityConfirmation}
                        >
                          Leave
                        </button>
                      )}
                    </div>
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
                {!(communitiesLoading && communities.length === 0) && communities.length > 0 ? (
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                    <div className="relative min-w-0 flex-1 sm:max-w-md">
                      <label htmlFor="community-directory-search" className="sr-only">
                        Search communities
                      </label>
                      <input
                        id="community-directory-search"
                        type="search"
                        autoComplete="off"
                        placeholder="Search by name or location…"
                        value={communityDirectoryQuery}
                        onChange={(e) => setCommunityDirectoryQuery(e.target.value)}
                        className="input-base w-full py-2 pl-3 pr-9 text-sm"
                      />
                      {communityDirectoryQuery.trim() ? (
                        <button
                          type="button"
                          className="absolute right-1.5 top-1/2 inline-flex h-8 min-w-[2rem] -translate-y-1/2 items-center justify-center rounded-md text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          aria-label="Clear search"
                          onClick={() => setCommunityDirectoryQuery("")}
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <p className="text-xs text-neutral-500 dark:text-slate-400" aria-live="polite">
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
                        className="input-base min-w-[10.5rem] py-2 pl-3 pr-8 text-sm"
                      >
                        <option value="name">Name (A–Z)</option>
                        <option value="members">Most members</option>
                      </select>
                    </div>
                  </div>
                ) : null}
                <ul
                  className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
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
                        <div className="flex h-full min-h-0 flex-col rounded-xl border border-neutral-200/90 bg-neutral-50/40 p-2.5 dark:border-slate-600 dark:bg-slate-800/50 sm:p-3">
                          <button
                            type="button"
                            className="group flex min-h-0 flex-1 flex-col gap-2 text-left transition hover:opacity-95"
                            onClick={() => {
                              setShopCommunityId(c.id);
                              setActiveView(VIEWS.COMMUNITY_SHOP);
                              navigate("/", { replace: true });
                            }}
                          >
                            <div className="relative aspect-[16/9] max-h-[9.5rem] w-full shrink-0 overflow-hidden rounded-lg shadow-inner ring-1 ring-black/5 transition group-hover:ring-brand-primary/30 dark:ring-white/10 sm:max-h-[10rem]">
                              {c.imageUrl ? (
                                <img src={c.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                              ) : (
                                <div
                                  className="flex h-full w-full items-center justify-center text-base font-bold tracking-tight text-white sm:text-xl"
                                  style={{ backgroundImage: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                                  aria-hidden
                                >
                                  {initials}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 px-0.5">
                              <p className="truncate text-sm font-semibold text-neutral-900 dark:text-slate-100 sm:text-base">
                                {toTitleCase(String(c.name || "").trim())}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600 dark:text-slate-400 sm:text-sm">
                                {formatCommunityMarketplaceSubtitle(c)}
                              </p>
                              <p className="mt-0.5 text-xs text-neutral-600 dark:text-slate-400 sm:text-sm">
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
                className={`order-1 shadow-sm transition-[opacity,transform] duration-300 ease-out lg:order-none lg:sticky lg:top-24 lg:block lg:rounded-2xl lg:border lg:border-neutral-200/80 lg:bg-neutral-50/40 lg:p-3 lg:shadow-sm lg:transition-none dark:lg:border-slate-600 dark:lg:bg-slate-900/50 max-lg:fixed max-lg:inset-0 max-lg:z-[110] max-lg:flex max-lg:flex-col max-lg:items-stretch max-lg:justify-center max-lg:bg-transparent max-lg:p-3 max-lg:pt-[max(0.5rem,env(safe-area-inset-top))] max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:pointer-events-none ${
                  mobileCommunityFiltersOpen
                    ? "max-lg:visible max-lg:scale-100 max-lg:opacity-100"
                    : "max-lg:invisible max-lg:scale-[0.98] max-lg:opacity-0"
                } space-y-3 sm:space-y-4 lg:pointer-events-auto lg:max-h-[calc(100dvh-6rem)] lg:w-auto lg:max-w-none lg:overflow-y-auto lg:overflow-x-visible lg:overscroll-y-contain lg:pr-0.5 drawer-scroll lg:opacity-100 lg:visible lg:scale-100`}
              >
                <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center max-lg:max-h-full lg:contents">
                  <div className="flex min-h-0 w-full max-w-md flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_24px_64px_-12px_rgba(15,23,42,0.45)] ring-1 ring-black/[0.04] max-lg:pointer-events-auto max-lg:max-h-[min(88dvh,40rem)] dark:border-slate-600 dark:bg-slate-900 dark:ring-white/[0.06] lg:max-h-none lg:max-w-none lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none lg:ring-0 lg:contents">
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
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:bg-neutral-50 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
                  <div className="drawer-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-3 py-3 sm:space-y-5 lg:max-h-none lg:flex-none lg:space-y-3 lg:overflow-visible lg:px-0 lg:py-0">
                  <div className="rounded-xl bg-neutral-50/90 p-2.5 dark:bg-slate-800/35 max-lg:ring-1 max-lg:ring-neutral-200/60 dark:max-lg:ring-slate-600/50 lg:bg-transparent lg:p-0 lg:ring-0">
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
              <div className="order-2 min-w-0 space-y-3 sm:space-y-4 lg:order-none">
                {activeView === VIEWS.FAVORITES ? (
                  <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">My Favorites</h2>
                ) : null}
                <div className="lg:hidden">
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-neutral-300/90 bg-white px-3.5 py-2.5 text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    onClick={() => setMobileCommunityFiltersOpen(true)}
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
                    </svg>
                    <span className="sm:hidden">{"Browse & filter"}</span>
                    <span className="hidden sm:inline">{"Browse & Categories"}</span>
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
                      }}
                    >
                      Reset
                    </button>
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
                  <div
                    className={
                      activeView === VIEWS.COMMUNITY_SHOP
                        ? "flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200/80 pb-3 dark:border-slate-700/80"
                        : "flex justify-end"
                    }
                  >
                    {activeView === VIEWS.COMMUNITY_SHOP ? (
                      <div className="min-w-0 flex-1 pr-2">
                        <h3 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-slate-100 lg:text-lg">
                          Listings
                        </h3>
                        <p className="mt-0.5 text-xs text-neutral-500 dark:text-slate-400">Posted in this community</p>
                        {listingsRefreshing ? (
                          <p className="mt-1 text-xs font-medium text-brand-primary dark:text-brand-accent" aria-live="polite">
                            Updating listings…
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {activeView === VIEWS.COMMUNITY_SHOP ? (
                        <button
                          type="button"
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-neutral-300/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                          aria-busy={listingsLoading || listingsRefreshing}
                          disabled={listingsLoading || listingsRefreshing}
                          title="Reload listings from the server"
                          onClick={() => refreshCommunityShopListings()}
                        >
                          <svg
                            className={`h-3.5 w-3.5 shrink-0 ${listingsLoading || listingsRefreshing ? "animate-spin" : ""}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          Refresh
                        </button>
                      ) : null}
                      <ProductViewDensityToggle
                        value={activeView === VIEWS.FAVORITES ? favoriteProductsView : communityProductsView}
                        onChange={activeView === VIEWS.FAVORITES ? setFavoriteProductsView : setCommunityProductsView}
                      />
                    </div>
                  </div>
                ) : null}
                {(activeView === VIEWS.FAVORITES
                  ? !(favoritesLoading && strictFavoritesList.length === 0) && visibleFavoritesListings.length > 0
                  : !listingsError && visibleBrowseListings.length > 0) ? (
                  <div
                    className={
                      activeView === VIEWS.FAVORITES
                        ? favoritesGridClass(favoriteProductsView)
                        : communityBrowseGridClass(communityProductsView)
                    }
                  >
                    {(activeView === VIEWS.FAVORITES ? visibleFavoritesListings : visibleBrowseListings).map((l) => (
                      <CommunityShopListingCard
                        key={l.id}
                        listing={l}
                        gridMode={(activeView === VIEWS.FAVORITES ? favoriteProductsView : communityProductsView) !== "list"}
                        compactGrid={(activeView === VIEWS.FAVORITES ? favoriteProductsView : communityProductsView) === "compact"}
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
                            subtitle: activeView === VIEWS.FAVORITES ? "Saved listing" : "Marketplace listing",
                            listingStockQty: stockListed,
                            showBuyerCommerceActions: !isOwn,
                            showSellerCommerceActions: isOwn,
                            onAddToCart: isOwn
                              ? undefined
                              : () => {
                                  closeProductInspect();
                                  openQuickAddModal(l, "cart");
                                },
                            onBuyNow: isOwn
                              ? undefined
                              : () => {
                                  closeProductInspect();
                                  openQuickAddModal(l, "buy");
                                },
                            buyNowDisabled: !isOwn && buyNowBlocked,
                            buyNowDisabledReason: !isOwn ? buyNowBlockedReason : "",
                            onEditListing: isOwn
                              ? () => {
                                  closeProductInspect();
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
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition ${
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
                    <p className="px-2 py-2 text-xs text-neutral-500 dark:text-slate-400">Loading users…</p>
                  ) : null}
                  {usersError ? <p className="px-2 py-2 text-xs text-rose-600 dark:text-rose-400">{usersError}</p> : null}
                  {!usersError ? (
                    <ul className="space-y-1">
                      {filteredMessagePeople.map((u) => (
                          <li key={`messages-user-${u.id}`}>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-neutral-100 dark:hover:bg-slate-800"
                              onClick={() => openChatWithUser(u.id)}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-neutral-900 dark:text-slate-100">
                                  {formatDisplayName(u.name || u.username || "Member")}
                                </span>
                                <span className="block truncate text-[11px] text-neutral-500 dark:text-slate-400">
                                  {communityLabelForUser(u)}
                                  {u.joinedAt ? ` · Joined ${new Date(u.joinedAt).toLocaleDateString()}` : ""}
                                </span>
                              </span>
                              <span className="rounded-md border border-brand-primary/35 px-2 py-1 text-[11px] font-semibold text-brand-primary dark:border-brand-primary/45">
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
                  <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-neutral-600 dark:text-slate-400">
                    Select a conversation from the left.
                  </div>
                ) : (
                  <>
                    <div className="border-b border-neutral-200 px-4 py-2 dark:border-slate-700 md:py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-primary md:hidden"
                        onClick={() => setMessagesMobilePane("list")}
                      >
                        <span aria-hidden>←</span>
                        Back to chats
                      </button>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
                        {formatDisplayName(activeChatUser?.name || activeChatUser?.username || "Member")}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500 dark:text-slate-400">{communityLabelForUser(activeChatUser)}</p>
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
                      <div className="flex gap-2">
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
                          className="input-base h-11 flex-1"
                        />
                        <button
                          type="button"
                          className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={sendChatMessage}
                          disabled={chatSendPending}
                        >
                          Send
                        </button>
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Notifications</h2>
                <p className="text-sm text-neutral-600 dark:text-slate-400">
                  Order updates, delivery status, and marketplace alerts from your session appear here.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-neutral-300/80 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={markAllNotificationsRead}
                  disabled={unreadNotificationCount === 0}
                >
                  Mark all read
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-neutral-300/80 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={clearNotificationInbox}
                  disabled={notificationInbox.length === 0}
                >
                  Clear all
                </button>
              </div>
            </div>
            {notificationInbox.length === 0 ? (
              <div className={`${UI_KIT.surfaceMuted} border-dashed p-8 text-center md:p-10`}>
                <p className="text-sm font-medium text-neutral-700 dark:text-slate-300">No notifications yet</p>
                <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">You are all caught up for now.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {notificationInbox.map((item) => {
                  const createdLabel = new Date(item.createdAt).toLocaleString();
                  return (
                    <article
                      key={item.id}
                      className={`${UI_KIT.surfaceRaised} flex items-start justify-between gap-3 p-3 sm:p-3.5 ${
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
                  <ProductViewDensityToggle value={favoriteProductsView} onChange={setFavoriteProductsView} />
                </div>
                <div className={favoritesGridClass(favoriteProductsView)}>
                  {strictFavoritesList.map((l) => (
                    <CommunityShopListingCard
                      key={l.id}
                      listing={l}
                      gridMode={favoriteProductsView !== "list"}
                      compactGrid={favoriteProductsView === "compact"}
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
                                closeProductInspect();
                                openQuickAddModal(l, "cart");
                              },
                          onBuyNow: isOwn
                            ? undefined
                            : () => {
                                closeProductInspect();
                                openQuickAddModal(l, "buy");
                              },
                          buyNowDisabled: !isOwn && buyNowBlocked,
                          buyNowDisabledReason: !isOwn ? buyNowBlockedReason : "",
                          onEditListing: isOwn
                            ? () => {
                                closeProductInspect();
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
                  className={`rounded-xl border border-dashed bg-white/80 transition dark:bg-slate-900/60 ${
                    listingImageDragActive
                      ? "border-brand-primary text-brand-primary dark:border-brand-accent dark:text-brand-accent"
                      : listingFieldErrors.image
                        ? "border-rose-400 text-neutral-500 dark:border-rose-500 dark:text-slate-400"
                        : "border-neutral-300 text-neutral-500 dark:border-slate-600 dark:text-slate-400"
                  } ${
                    listingImagePreviewUrl
                      ? "p-3 sm:p-4"
                      : "flex min-h-[10rem] cursor-pointer flex-col items-center justify-center gap-1.5 px-4 py-6 text-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-offset-2 dark:focus-visible:ring-brand-accent/40 dark:focus-visible:ring-offset-slate-900"
                  }`}
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
                    const file = e.dataTransfer?.files?.[0];
                    if (file) setListingImage(file);
                  }}
                >
                  <input
                    ref={listingImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setListingImage(file);
                      e.target.value = "";
                    }}
                  />
                  {listingImagePreviewUrl ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                      <button
                        type="button"
                        className="group relative mx-auto shrink-0 overflow-hidden rounded-xl ring-1 ring-neutral-200/90 transition hover:ring-brand-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 dark:ring-slate-600 dark:hover:ring-brand-accent/40 dark:focus-visible:ring-brand-accent/50 sm:mx-0"
                        aria-label="Replace listing photo"
                        onClick={() => listingImageInputRef.current?.click()}
                      >
                        <img
                          src={listingImagePreviewUrl}
                          alt=""
                          className="h-32 w-full max-w-[14rem] object-cover object-center sm:h-36 sm:w-36 sm:max-w-none"
                        />
                        <span className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/55 to-transparent pb-2 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                          Replace
                        </span>
                      </button>
                      <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
                        <p className="truncate text-sm font-medium text-neutral-800 dark:text-slate-200" title={listingImageFile?.name || "Selected image"}>
                          {listingImageFile?.name || "Selected image"}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-slate-400">Tip: click the photo or use Replace to choose a different image.</p>
                        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                          <button
                            type="button"
                            className="btn-secondary text-xs"
                            onClick={() => {
                              setListingImageFile(null);
                              if (listingImagePreviewUrl && listingImagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(listingImagePreviewUrl);
                              setListingImagePreviewUrl("");
                              if (listingImageInputRef.current) listingImageInputRef.current.value = "";
                            }}
                          >
                            Remove
                          </button>
                          <button type="button" className="btn-secondary text-xs" onClick={() => listingImageInputRef.current?.click()}>
                            Replace
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-medium text-neutral-800 dark:text-slate-200">Drag and drop a photo here</p>
                      <p className="max-w-sm text-xs text-neutral-500 dark:text-slate-400">
                        or click this area to browse — square or 4:3 looks best. JPG, PNG, or WebP up to 5MB.
                      </p>
                      <button
                        type="button"
                        className="btn-secondary mt-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          listingImageInputRef.current?.click();
                        }}
                      >
                        Choose photo
                      </button>
                    </>
                  )}
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
                <ListingCategoryPicker
                  value={listingForm.categories}
                  invalid={Boolean(listingFieldErrors.categories)}
                  onChange={(id) => {
                    setListingForm((p) => ({ ...p, categories: id, subId: "all" }));
                    if (listingFieldErrors.categories) setListingFieldErrors((prev) => ({ ...prev, categories: "" }));
                  }}
                />
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
                  <div
                    className={`flex min-w-0 overflow-hidden rounded-xl border bg-white transition dark:bg-slate-950 ${
                      listingFieldErrors.pricePesos
                        ? "border-rose-400 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-200 dark:border-rose-500/70 dark:focus-within:ring-rose-500/30"
                        : "border-neutral-200 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/25 dark:border-slate-600 dark:focus-within:border-brand-primary dark:focus-within:ring-brand-primary/25"
                    }`}
                  >
                    <span
                      className="flex shrink-0 select-none items-center border-r border-neutral-200 bg-neutral-50 px-3 text-xs font-semibold tracking-wide text-neutral-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                      aria-hidden
                    >
                      PHP
                    </span>
                    <input
                      className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-neutral-900 outline-none ring-0 placeholder:text-neutral-400 focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="e.g. 499.00"
                      aria-label="Price in Philippine pesos"
                      inputMode="decimal"
                      value={listingForm.pricePesos}
                      onChange={(e) => {
                        setListingForm((p) => ({ ...p, pricePesos: e.target.value }));
                        if (listingFieldErrors.pricePesos) setListingFieldErrors((prev) => ({ ...prev, pricePesos: "" }));
                      }}
                    />
                  </div>
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
                      clearMarketplaceToasts();
                      setSellerTab(SELLER_TABS.PRODUCTS);
                      goOwnProfile();
                      navigate("/", { replace: true });
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </section>
        )}

        {activeView === VIEWS.CART && (
          <section className={`${UI_KIT.viewSection} space-y-4 md:space-y-6`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">Add to cart</h2>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <ProductViewDensityToggle
                  value={commerceFlowViewBuyer}
                  onChange={setCommerceFlowViewBuyer}
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
                  const orderedItems = [...items].sort((a, b) => {
                    const aId = String(a?.listingId || "");
                    const bId = String(b?.listingId || "");
                    const aIdx = recentlyAddedCartListingIds.indexOf(aId);
                    const bIdx = recentlyAddedCartListingIds.indexOf(bId);
                    const aRecent = aIdx >= 0;
                    const bRecent = bIdx >= 0;
                    if (aRecent && bRecent) return bIdx - aIdx; // latest added first
                    if (aRecent) return -1;
                    if (bRecent) return 1;
                    return 0;
                  });
                  const rowIds = orderedItems.map((i) => String(i.listingId));
                  const selectedCount = rowIds.filter((id) => cartItemSelection[id]).length;
                  const allSelected = rowIds.length > 0 && selectedCount === rowIds.length;
                  const someSelected = selectedCount > 0 && !allSelected;
                  const sellerLabel = orderedItems[0]?.sellerLabel || "Unknown seller";
                  return (
                    <div key={sellerId} className={`${UI_KIT.surfaceCard} p-3.5`}>
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
                      <div className={commerceFlowLineItemsClass(commerceFlowViewBuyer, { variant: "cart" })}>
                        {orderedItems.map((item) => {
                          const lid = String(item.listingId);
                          const isRecentlyAdded = recentlyAddedCartListingIds.includes(lid);
                          const isRemoving = cartRemovingListingIds.includes(lid);
                          const cfList = commerceFlowViewBuyer === "list";
                          const cfCompact = commerceFlowViewBuyer === "compact";
                          const thumbClass = cfList
                            ? "h-20 w-20"
                            : cfCompact
                              ? "h-12 w-12 sm:h-14 sm:w-14"
                              : "h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]";
                          return (
                            <div
                              key={item.listingId}
                              className={`flex gap-2 transition-opacity duration-[2000ms] sm:gap-3 ${
                                cfList
                                  ? "items-center rounded-xl px-2 py-2.5 sm:px-2.5"
                                  : "h-full min-h-0 flex-1 items-start rounded-xl border border-border bg-surface p-2 shadow-sm sm:items-center sm:p-2.5 dark:border-slate-700/70 dark:bg-slate-900/50"
                              } ${
                                isRecentlyAdded ? "bg-primary-soft dark:bg-primary/15" : ""
                              } ${
                                isRemoving ? "pointer-events-none opacity-0" : "opacity-100"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className={`h-4 w-4 shrink-0 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary/35 dark:border-slate-500 ${
                                  cfList ? "" : "mt-0.5 sm:mt-0"
                                }`}
                                checked={Boolean(cartItemSelection[lid])}
                                onChange={() => toggleCartListingSelected(item.listingId)}
                                aria-label={`Select ${item.title || "product"}`}
                              />
                              <div
                                className={`${thumbClass} shrink-0 overflow-hidden rounded-xl border border-border bg-primary-soft/40 dark:border-slate-700 dark:bg-slate-800`}
                              >
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.title || "Cart item"} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                                    No image
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                {isRecentlyAdded ? (
                                  <span className="mb-1 inline-flex items-center rounded-full border border-primary/40 bg-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary dark:border-primary/55 dark:bg-primary/20 dark:text-primary-soft">
                                    Newly added
                                  </span>
                                ) : null}
                                <MarketplaceProductDetailStack
                                  title={item.title || "Product"}
                                  priceCents={item.unitPriceCents}
                                  description={item.description}
                                  hideDescription
                                  fulfillmentModes={item.fulfillmentModes}
                                />
                                <div
                                  className={`mt-1 space-y-0.5 text-neutral-600 dark:text-slate-400 ${
                                    cfCompact ? "text-[10px] leading-snug sm:text-[11px]" : "text-xs"
                                  }`}
                                >
                                  <p className="line-clamp-2 text-pretty">
                                    Description: {removeSaleMetaLines(item.description) || "No description"}
                                  </p>
                                  <p className="line-clamp-2 text-pretty">
                                    Comment: {String(item.comment || "").trim() || "N/a"}
                                  </p>
                                  <button
                                    type="button"
                                    className="btn-secondary mt-1.5 touch-manipulation self-start px-3 py-1.5 text-xs"
                                    onClick={() => {
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
                                          closeProductInspect();
                                          openQuickAddModal(listingForQuick, "cart");
                                        },
                                        onBuyNow: () => {
                                          closeProductInspect();
                                          openQuickAddModal(listingForQuick, "buy");
                                        },
                                      });
                                    }}
                                  >
                                    View details
                                  </button>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-text-secondary dark:text-slate-400">Qty</span>
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-primary/45 bg-surface text-sm font-semibold text-primary transition duration-200 ease-in-out hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
                                      className="input-base h-8 w-14 rounded-xl border-primary/45 bg-surface px-1 text-center text-xs text-text-primary focus:border-primary focus:ring-primary/25"
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
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-primary/45 bg-surface text-sm font-semibold text-primary transition duration-200 ease-in-out hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
                                  <span className="text-[11px] text-text-secondary dark:text-slate-500">
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
              <h2 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl dark:text-slate-100">
                {activeView === VIEWS.MY_PURCHASES ? "My purchases" : "Sales inbox"}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600 line-clamp-4 sm:text-sm sm:leading-normal sm:line-clamp-none dark:text-slate-400">
                {activeView === VIEWS.MY_PURCHASES
                  ? "Things you bought from other sellers. COD only — LinkMart never holds your money. No refunds; cancel in Pending before the seller accepts, otherwise contact the seller."
                  : "Things buyers ordered from you. COD at pickup or delivery — you collect payment; LinkMart never holds balances."}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex w-full min-w-0 items-center gap-2 border-b border-neutral-200/70 pb-2 dark:border-slate-700/70 sm:border-0 sm:pb-0">
                <div
                  className="-mx-0.5 flex min-w-0 flex-1 snap-x snap-mandatory gap-1.5 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:pb-0 sm:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden sm:[&::-webkit-scrollbar]:auto"
                  role="tablist"
                  aria-label={activeView === VIEWS.MY_PURCHASES ? "Purchase status" : "Sales order status"}
                >
                  {ORDERS_STATUS_TABS.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={ordersStatusTab === id}
                      className={`snap-start shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition sm:px-3 sm:py-1.5 sm:text-sm ${ordersStatusTab === id ? UI_KIT.tabActive : UI_KIT.tabIdle}`}
                      onClick={() => setOrdersStatusTab(id)}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span>{label}</span>
                        {id === "pending" && pendingTabPillCount > 0 ? (
                          <span className="inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-brand-primary px-1.5 text-[10px] font-bold leading-none text-white shadow-sm ring-1 ring-black/10 dark:bg-brand-accent dark:text-slate-950 dark:ring-white/15">
                            {pendingTabPillCount > 99 ? "99+" : pendingTabPillCount}
                          </span>
                        ) : null}
                        {(id === "processing" || id === "completed" || id === "cancelled") &&
                        ordersTabBadgeIdsByTab[id]?.length > 0 ? (
                          <span className="inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-brand-primary px-1.5 text-[10px] font-bold leading-none text-white shadow-sm ring-1 ring-black/10 dark:bg-brand-accent dark:text-slate-950 dark:ring-white/15">
                            {ordersTabBadgeIdsByTab[id].length > 99 ? "99+" : ordersTabBadgeIdsByTab[id].length}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="shrink-0 self-center sm:self-start">
                  <ProductViewDensityToggle
                    value={commerceFlowOrdersView}
                    onChange={setCommerceFlowOrdersView}
                    groupAriaLabel={
                      activeView === VIEWS.MY_PURCHASES ? "My purchases line layout" : "Sales inbox line layout"
                    }
                    gridTitle="Grid — two columns for readable order cards"
                    compactTitle="Dense — three columns for a compact overview"
                  />
                </div>
              </div>
              {ordersStatusTab === "pending" ? (
                <div className="flex w-full flex-col gap-2 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center min-[480px]:justify-end min-[480px]:gap-2">
                  <span className="inline-flex w-full items-center justify-center rounded-lg border border-neutral-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 min-[480px]:w-auto min-[480px]:justify-start dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    Selected: {selectedOrders.length}
                  </span>
                  <div className="flex flex-col gap-2 min-[360px]:flex-row min-[360px]:justify-end min-[360px]:gap-2">
                    {ordersRole === "seller" ? (
                      <button
                        type="button"
                        className="btn-secondary min-h-11 w-full touch-manipulation text-sm disabled:cursor-not-allowed disabled:opacity-50 min-[360px]:w-auto min-[360px]:min-h-0 min-[480px]:shrink-0"
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
                      className="min-h-11 w-full touch-manipulation rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 min-[360px]:w-auto min-[360px]:min-h-0 min-[480px]:shrink-0 dark:border-rose-500/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                      disabled={ordersBulkActionSubmitting || !ordersDeclineEnabled}
                      onClick={() => {
                        if (ordersRole === "buyer") {
                          setBuyerCancelConfirmOpen(true);
                          return;
                        }
                        void applyTransitionToSelectedOrders(
                          "cancel",
                          ordersRole === "buyer" ? "Cancelled" : "Declined"
                        );
                      }}
                    >
                      {ordersBulkActionSubmitting ? "Working…" : ordersRole === "buyer" ? "Cancel" : "Decline"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            {ordersLoading && orders.length === 0 ? (
              <p className="text-sm text-neutral-600 dark:text-slate-400">Loading…</p>
            ) : null}
            {!(ordersLoading && orders.length === 0) && orders.length === 0 ? (
              <div className={`${UI_KIT.surfaceMuted} border-dashed p-8 text-sm text-neutral-500 dark:text-slate-400`}>
                {activeView === VIEWS.MY_PURCHASES
                  ? "You have no purchases yet. When you buy from the marketplace, they will show up here."
                  : "You have no buyer orders yet. When someone buys your listings, they will show up here."}
              </div>
            ) : null}
            {!(ordersLoading && orders.length === 0) && orders.length > 0 && ordersForStatusTab.length === 0 ? (
              <div className={`${UI_KIT.surfaceMuted} space-y-2 border-dashed p-8 text-sm text-neutral-500 dark:text-slate-400`}>
                <p>
                  {activeView === VIEWS.MY_PURCHASES ? (
                    <>
                      No {ORDERS_STATUS_TABS.find((t) => t.id === ordersStatusTab)?.label?.toLowerCase() || ""}{" "}
                      purchases.
                    </>
                  ) : (
                    <>
                      No {ORDERS_STATUS_TABS.find((t) => t.id === ordersStatusTab)?.label?.toLowerCase() || ""} orders.
                    </>
                  )}
                </p>
                {ordersRole === "seller" &&
                ordersStatusTab === "pending" &&
                orders.some((o) => orderMatchesOrdersStatusTab(o.status, "processing")) ? (
                  <p className="text-xs leading-relaxed text-neutral-600 dark:text-slate-400">
                    You still have seller orders in other stages. Open the{" "}
                    <button
                      type="button"
                      className="font-semibold text-brand-primary underline decoration-brand-primary/40 underline-offset-2 hover:text-brand-primary/90 dark:text-brand-accent"
                      onClick={() => setOrdersStatusTab("processing")}
                    >
                      Processing
                    </button>{" "}
                    tab (for example after you accept a delivery order, or while pickup is being arranged).
                  </p>
                ) : null}
              </div>
            ) : null}
            {ordersForStatusTab.length > 0 ? (
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
                          const cardListing = listing
                            ? { ...listing, quantity: orderedQty }
                            : {
                                id: o.listingId,
                                title: `Order ${String(o.id).slice(0, 8)}`,
                                priceCents: o.codGoodsCents,
                                quantity: orderedQty,
                                fulfillmentModes: [o.fulfillmentType],
                                imageUrl: "",
                                description: "",
                                sellerId: o.sellerId,
                              };
                          // Always merge same product rows by listing id in buyer purchases.
                          const mergeKey = String(o.listingId || "");
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
                          const cardListing = listing
                            ? { ...listing, quantity: orderedQty }
                            : {
                                id: o.listingId,
                                title: `Order ${String(o.id).slice(0, 8)}`,
                                priceCents: o.codGoodsCents,
                                quantity: orderedQty,
                                fulfillmentModes: [o.fulfillmentType],
                                imageUrl: "",
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
                    <div key={groupPartyId} className={`${UI_KIT.surfaceCard} p-3 sm:p-3.5`}>
                      <div className="mb-1.5 flex items-center gap-2 border-b border-neutral-200/80 pb-1.5 sm:mb-2 sm:pb-2 dark:border-slate-700/80">
                        {ordersStatusTab === "pending" ? (
                          <CartSellerSelectAllCheckbox
                            allChecked={sellerAllSelected}
                            someSelected={sellerSomeSelected}
                            onChange={() => toggleOrderSellerSelectAll(orderedSellerOrders)}
                            ariaLabel={`Select all orders for ${sellerLabel}`}
                          />
                        ) : null}
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600 sm:text-xs dark:text-slate-300">
                          {sellerLabel}
                        </p>
                      </div>
                      <div
                        className={commerceFlowLineItemsClass(commerceFlowOrdersView, {
                          variant: "orders",
                        })}
                      >
                        {mergedSellerOrders.map((entry) => {
                          const o = entry.representativeOrder;
                          const cardListing = entry.cardListing;
                          const cfList = commerceFlowOrdersView === "list";
                          const cfCompact = commerceFlowOrdersView === "compact";
                          const multicolOrderCard = !cfList;
                          const orderThumbClass = cfList
                            ? "h-20 w-20"
                            : cfCompact
                              ? "h-12 w-12 sm:h-14 sm:w-14"
                              : "h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]";
                          const orderCommentPlain = String(o.comment || "").trim();
                          const orderHasComment = orderCommentPlain.length > 0 && !/^n\/a$/i.test(orderCommentPlain);
                          const orderDescPlain = String(removeSaleMetaLines(cardListing.description) || "").trim();
                          const orderHasDesc = orderDescPlain.length > 0;
                          const orderId = String(o.id || "");
                          const pickupBuyerAckOrderIds = entry.orderIds.filter((id) => {
                            const ord = orders.find((x) => String(x.id) === id);
                            return (
                              ord &&
                              String(ord.status || "") === "ready_for_pickup" &&
                              !ord.buyerReceiptAcknowledgedAt
                            );
                          });
                          const pickupBuyerAcknowledgedAll =
                            ordersRole === "buyer" &&
                            String(o.status || "") === "ready_for_pickup" &&
                            entry.orderIds.length > 0 &&
                            entry.orderIds.every((id) => {
                              const ord = orders.find((x) => String(x.id) === id);
                              return (
                                ord &&
                                String(ord.status || "") === "ready_for_pickup" &&
                                Boolean(ord.buyerReceiptAcknowledgedAt)
                              );
                            });
                          const pickupBuyerAcknowledgedAny =
                            String(o.status || "") === "ready_for_pickup" &&
                            entry.orderIds.some((id) => Boolean(orders.find((x) => String(x.id) === id)?.buyerReceiptAcknowledgedAt));
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
                          const completedDetailsKey = String(o.id || "");
                          const completedDetailsOpen = Boolean(completedTabOrderDetailsOpen[completedDetailsKey]);
                          const orderRowSurfaceBase = shouldHighlightRecent
                            ? "rounded-xl border border-primary/45 bg-primary-soft p-2 shadow-sm ring-1 ring-primary/25 sm:p-2.5 dark:border-primary/55 dark:bg-primary/20 dark:ring-primary/25"
                            : "rounded-xl border border-border bg-surface p-2 shadow-sm sm:p-2.5 dark:border-slate-700/70 dark:bg-slate-900/50";
                          const orderRowListShell = orderRowSurfaceBase;
                          const orderRowGridShell = `h-full min-h-0 min-w-0 flex-1 ${orderRowSurfaceBase}`;
                          return (
                            <div
                              key={`${groupPartyId}:${entry.mergeKey}`}
                              className={cfList ? orderRowListShell : orderRowGridShell}
                            >
                              <div
                                className={`flex flex-col sm:flex-row sm:items-start ${
                                  cfCompact ? "gap-2 sm:gap-3" : "gap-3 sm:gap-3"
                                }`}
                              >
                                <div className="flex shrink-0 flex-row items-start gap-3">
                                  {ordersStatusTab === "pending" ? (
                                    <input
                                      type="checkbox"
                                      className={`h-4 w-4 shrink-0 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary/35 dark:border-slate-500 ${
                                        cfList ? "mt-1" : "mt-0.5 sm:mt-1"
                                      }`}
                                      checked={rowAllSelected}
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
                                  <div
                                    className={`${orderThumbClass} shrink-0 overflow-hidden rounded-xl border border-border bg-primary-soft/40 dark:border-slate-700 dark:bg-slate-800`}
                                  >
                                  {String(cardListing.imageUrl || "").trim() ? (
                                    <img src={cardListing.imageUrl} alt={cardListing.title || "Order item"} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                                      No image
                                    </div>
                                  )}
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  {shouldHighlightRecent ? (
                                    <span className="mb-1 inline-flex items-center rounded-full border border-emerald-400/90 bg-emerald-200/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900 dark:border-emerald-400/60 dark:bg-emerald-500/25 dark:text-emerald-200">
                                      Recently updated
                                    </span>
                                  ) : null}
                                  <MarketplaceProductDetailStack
                                    title={cardListing.title || "Product"}
                                    priceCents={cardListing.priceCents}
                                    description={cardListing.description}
                                    hideDescription
                                    hideAvailability
                                    fulfillmentModes={cardListing.fulfillmentModes}
                                  />
                                  <p className="mt-1 text-pretty text-[11px] leading-snug text-neutral-600 sm:text-xs dark:text-slate-400">
                                    <span className="font-medium text-neutral-700 dark:text-slate-300">Qty</span>{" "}
                                    <span className="font-semibold tabular-nums">{Number(cardListing.quantity) || 1}</span>
                                    <span className="text-neutral-400 dark:text-slate-600"> · </span>
                                    {listingCodAvailabilityLabel(cardListing.fulfillmentModes)}
                                  </p>
                                  <div
                                    className={`mt-1 space-y-0.5 leading-snug text-neutral-600 dark:text-slate-400 ${
                                      cfCompact ? "text-[10px] sm:text-[11px]" : "text-[11px] sm:text-xs sm:leading-normal"
                                    }`}
                                  >
                                    <p className="line-clamp-2 text-pretty">
                                      Description: {orderHasDesc ? orderDescPlain : "No description"}
                                    </p>
                                    <p className="line-clamp-2 text-pretty">
                                      Comment: {orderHasComment ? orderCommentPlain : "N/a"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div
                                className={`border-t border-neutral-200/80 text-sm dark:border-slate-700/80 ${
                                  multicolOrderCard
                                    ? "mt-1.5 space-y-1 pt-1.5 sm:mt-2 sm:space-y-1.5 sm:pt-2"
                                    : "mt-2 space-y-1.5 pt-1.5 sm:mt-3 sm:space-y-2 sm:pt-2"
                                }`}
                              >
                                {!completedHistoryRow ? (
                                  <>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="min-w-0 text-[11px] text-neutral-500 dark:text-slate-400">
                                        <span className="mr-1.5 font-medium text-neutral-600 dark:text-slate-300">
                                          {entry.orderIds.length > 1 ? "Order IDs" : "Order ID"}
                                        </span>
                                        {entry.orderIds.length > 1 ? (
                                          <span className="mt-1 block space-y-0.5">
                                            {entry.orderIds.map((id) => (
                                              <span key={id} className="block break-all font-mono">
                                                {id}
                                              </span>
                                            ))}
                                          </span>
                                        ) : (
                                          <span className="break-all font-mono">{entry.orderIds[0]}</span>
                                        )}
                                      </span>
                                    </div>
                                    <p className="text-pretty text-xs leading-snug text-neutral-600 dark:text-slate-400">
                                      {o.fulfillmentType === "delivery" ? "Delivery" : "Pickup"} · goods{" "}
                                      {formatCents(entry.mergedGoodsCents ?? o.codGoodsCents)}
                                      {(entry.mergedDeliveryCents ?? o.codDeliveryCents) > 0 ? (
                                        <span> · delivery {formatCents(entry.mergedDeliveryCents ?? o.codDeliveryCents)}</span>
                                      ) : null}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-start gap-2 sm:gap-3">
                                      <p className="min-w-0 flex-1 text-pretty text-[11px] leading-snug text-neutral-600 dark:text-slate-400">
                                        Completed{" "}
                                        <span className="font-medium text-neutral-800 dark:text-slate-200">
                                          {formatOrderCompletedAtLabel(
                                            o.completedAt || o.completed_at || o.updatedAt || o.updated_at,
                                          )}
                                        </span>
                                      </p>
                                      <button
                                        type="button"
                                        className="shrink-0 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700/80 sm:px-3 sm:py-2 sm:text-xs"
                                        aria-expanded={completedDetailsOpen}
                                        onClick={() => toggleCompletedTabOrderDetails(o.id)}
                                      >
                                        <span className="sm:hidden">{completedDetailsOpen ? "Hide" : "Details"}</span>
                                        <span className="hidden sm:inline">
                                          {completedDetailsOpen ? "Hide order details" : "Order details"}
                                        </span>
                                      </button>
                                    </div>
                                    {completedDetailsOpen ? (
                                      <>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="min-w-0 text-[11px] text-neutral-500 dark:text-slate-400">
                                            <span className="mr-1.5 font-medium text-neutral-600 dark:text-slate-300">
                                              {entry.orderIds.length > 1 ? "Order IDs" : "Order ID"}
                                            </span>
                                            {entry.orderIds.length > 1 ? (
                                              <span className="mt-1 block space-y-0.5">
                                                {entry.orderIds.map((id) => (
                                                  <span key={id} className="block break-all font-mono">
                                                    {id}
                                                  </span>
                                                ))}
                                              </span>
                                            ) : (
                                              <span className="break-all font-mono">{entry.orderIds[0]}</span>
                                            )}
                                          </span>
                                        </div>
                                        <p className="text-pretty text-xs leading-snug text-neutral-600 dark:text-slate-400">
                                          {o.fulfillmentType === "delivery" ? "Delivery" : "Pickup"} · goods{" "}
                                          {formatCents(entry.mergedGoodsCents ?? o.codGoodsCents)}
                                          {(entry.mergedDeliveryCents ?? o.codDeliveryCents) > 0 ? (
                                            <span> · delivery {formatCents(entry.mergedDeliveryCents ?? o.codDeliveryCents)}</span>
                                          ) : null}
                                        </p>
                                        <OrderCompletedMilestoneList order={o} />
                                      </>
                                    ) : null}
                                  </>
                                )}
                                {(() => {
                                  const tab = String(ordersStatusTab || "");
                                  if (tab === "completed" && String(o.status || "") === "completed") return null;
                                  const line =
                                    tab === "pending" && (o.createdAt || o.created_at)
                                      ? `Placed ${formatOrderCompletedAtLabel(o.createdAt || o.created_at)}`
                                      : tab === "processing"
                                        ? o.processingEnteredAt || o.processing_entered_at
                                          ? `In progress since ${formatOrderCompletedAtLabel(o.processingEnteredAt || o.processing_entered_at)}`
                                          : o.updatedAt || o.updated_at
                                            ? `Last updated ${formatOrderCompletedAtLabel(o.updatedAt || o.updated_at)}`
                                            : null
                                        : tab === "cancelled"
                                          ? `Cancelled ${formatOrderCompletedAtLabel(o.cancelledAt || o.cancelled_at || o.updatedAt || o.updated_at)}`
                                          : null;
                                  if (!line) return null;
                                  return (
                                    <p className="text-pretty text-[11px] leading-snug text-neutral-500 dark:text-slate-500">{line}</p>
                                  );
                                })()}
                                {ordersRole === "buyer" && ordersStatusTab === "completed" && String(o.status || "") === "completed" ? (
                                  <div
                                    className={`flex flex-col rounded-lg border border-neutral-200/70 bg-white/50 dark:border-slate-600/80 dark:bg-slate-900/30 ${
                                      multicolOrderCard
                                        ? "gap-1.5 p-2 sm:gap-2 sm:p-2.5"
                                        : "gap-2 p-2.5 sm:gap-3 sm:p-3"
                                    }`}
                                  >
                                    <div className="min-w-0 space-y-1">
                                      {o.buyerReceiptAcknowledgedAt ? (
                                        <p className="text-pretty text-[11px] leading-snug text-neutral-500 dark:text-slate-500">
                                          You had marked this order as received before it was completed.
                                        </p>
                                      ) : null}
                                    </div>
                                    <div
                                      className={
                                        multicolOrderCard
                                          ? "flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-1.5"
                                          : "-mx-0.5 flex gap-2 overflow-x-auto pb-0.5 sm:mx-0 sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0"
                                      }
                                    >
                                      <button
                                        type="button"
                                        className={`btn-secondary w-full touch-manipulation whitespace-nowrap sm:w-auto ${
                                          multicolOrderCard
                                            ? "min-h-9 shrink-0 px-2.5 py-1.5 text-[11px] sm:min-h-0"
                                            : "min-h-10 shrink-0 px-3 text-xs sm:min-h-0"
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
                                        className={`btn-secondary w-full touch-manipulation whitespace-nowrap sm:w-auto ${
                                          multicolOrderCard
                                            ? "min-h-9 shrink-0 px-2.5 py-1.5 text-[11px] sm:min-h-0"
                                            : "min-h-10 shrink-0 px-3 text-xs sm:min-h-0"
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
                                        className={`btn-secondary w-full touch-manipulation whitespace-nowrap sm:w-auto ${
                                          multicolOrderCard
                                            ? "min-h-9 shrink-0 px-2.5 py-1.5 text-[11px] sm:min-h-0"
                                            : "min-h-10 shrink-0 px-3 text-xs sm:min-h-0"
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
                                  <OrderBuyerReviewForm
                                    orderId={o.id}
                                    initialReview={o.buyerReview}
                                    onSubmit={submitOrderReview}
                                    disabled={!token}
                                    compact={multicolOrderCard}
                                  />
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
                                  <div
                                    className={`flex w-full flex-col min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:items-center ${
                                      multicolOrderCard ? "gap-1.5" : "gap-2"
                                    }`}
                                  >
                                  <button
                                    type="button"
                                    className={`btn-secondary w-full touch-manipulation whitespace-nowrap min-[400px]:w-auto min-[400px]:min-h-0 ${
                                      multicolOrderCard
                                        ? "min-h-9 shrink-0 px-2.5 py-1.5 text-[11px] sm:min-h-0"
                                        : "min-h-10 shrink-0 px-3 text-xs sm:min-h-0"
                                    }`}
                                    onClick={() => {
                                      const L = orderListingsById[String(o.listingId)];
                                      const base =
                                        L ||
                                        ({
                                          id: o.listingId,
                                          title: cardListing.title,
                                          imageUrl: cardListing.imageUrl,
                                          priceCents: cardListing.priceCents,
                                          description: cardListing.description,
                                          fulfillmentModes: cardListing.fulfillmentModes,
                                          quantity: cardListing.quantity,
                                          sellerId: o.sellerId,
                                          communityId: cardListing.communityId,
                                        });
                                      const listingIdStr = String(base.id || o.listingId || "");
                                      const inspectPayload = {
                                        title: base.title,
                                        imageUrl: base.imageUrl,
                                        priceCents: base.priceCents,
                                        description: base.description,
                                        fulfillmentModes: base.fulfillmentModes,
                                        sellerName: String(o.sellerName || "").trim(),
                                        sellerUsername: String(o.sellerUsername || "").trim(),
                                      };
                                      const forQuick = {
                                        ...base,
                                        id: listingIdStr,
                                        priceCents: base.priceCents,
                                        quantity: base.quantity,
                                        fulfillmentModes:
                                          Array.isArray(base.fulfillmentModes) && base.fulfillmentModes.length
                                            ? base.fulfillmentModes
                                            : [o.fulfillmentType],
                                        sellerId: base.sellerId ?? o.sellerId,
                                        communityId: base.communityId,
                                        imageUrl: base.imageUrl,
                                        title: base.title,
                                        description: base.description,
                                      };
                                      const stockQty = Math.max(0, Number(base.quantity) || 0);
                                      const isBuyer = ordersRole === "buyer";
                                      const isOrderSeller =
                                        ordersRole === "seller" && String(o.sellerId || "") === String(user?.id || "");
                                      const buyerCanShop = isBuyer && String(o.sellerId || "") !== String(user?.id || "");

                                      openProductInspect(inspectPayload, {
                                        quantity: Number(cardListing.quantity) || 1,
                                        comment: orderCommentPlain,
                                        commentSectionRequired: true,
                                        commentHeading:
                                          ordersRole === "seller" ? "Buyer's note" : "Your order note",
                                        subtitle:
                                          ordersRole === "buyer"
                                            ? `Your purchase · ${o.fulfillmentType === "delivery" ? "Delivery" : "Pickup"}`
                                            : `Buyer order · ${o.fulfillmentType === "delivery" ? "Delivery" : "Pickup"}`,
                                        listingStockQty: stockQty,
                                        showBuyerCommerceActions: buyerCanShop && Boolean(listingIdStr),
                                        showSellerCommerceActions: isOrderSeller && Boolean(listingIdStr),
                                        onAddToCart:
                                          buyerCanShop && listingIdStr
                                            ? () => {
                                                closeProductInspect();
                                                openQuickAddModal(forQuick, "cart");
                                              }
                                            : undefined,
                                        onBuyNow:
                                          buyerCanShop && listingIdStr
                                            ? () => {
                                                closeProductInspect();
                                                openQuickAddModal(forQuick, "buy");
                                              }
                                            : undefined,
                                        onEditListing:
                                          isOrderSeller && listingIdStr
                                            ? () => {
                                                closeProductInspect();
                                                beginEditSellerListing(forQuick);
                                              }
                                            : undefined,
                                        onSaleSelect:
                                          isOrderSeller && listingIdStr
                                            ? (pct) => {
                                                closeProductInspect();
                                                void applySellerListingDiscount(forQuick, pct);
                                              }
                                            : undefined,
                                      });
                                    }}
                                  >
                                    View details
                                  </button>
                                  {ordersRole === "buyer" &&
                                  String(o.status || "") === "ready_for_pickup" &&
                                  o.fulfillmentType === "pickup" &&
                                  !pickupBuyerAcknowledgedAll &&
                                  pickupBuyerAckOrderIds.length > 0 ? (
                                    <button
                                      type="button"
                                      className={`btn-secondary w-full touch-manipulation whitespace-nowrap min-[400px]:w-auto min-[400px]:min-h-0 ${
                                        multicolOrderCard
                                          ? "min-h-9 shrink-0 px-2.5 py-1.5 text-[11px] sm:min-h-0"
                                          : "min-h-10 shrink-0 px-3 text-xs sm:min-h-0"
                                      }`}
                                      onClick={() =>
                                        patchOrderTransition(pickupBuyerAckOrderIds[0], "buyer_ack_receipt", {
                                          orderIds: pickupBuyerAckOrderIds,
                                          successMessage: "Thanks — seller will mark pickup complete when handoff is done.",
                                        })
                                      }
                                    >
                                      Mark as received
                                    </button>
                                  ) : null}
                                  {ordersRole === "seller" && o.status === "placed" ? (
                                    <button
                                      type="button"
                                      className="btn-secondary min-h-11 w-full touch-manipulation text-xs min-[400px]:w-auto min-[400px]:min-h-0"
                                      onClick={() => patchOrderTransition(o.id, "seller_accept")}
                                    >
                                      Accept order
                                    </button>
                                  ) : null}
                                  {ordersRole === "seller" && o.status === "ready_for_pickup" ? (
                                    <button
                                      type="button"
                                      className="btn-secondary min-h-11 w-full touch-manipulation text-xs min-[400px]:w-auto min-[400px]:min-h-0"
                                      onClick={() => patchOrderTransition(o.id, "mark_pickup_done")}
                                    >
                                      Mark pickup complete
                                    </button>
                                  ) : null}
                                  {ordersRole === "seller" && o.status === "bid_accepted" ? (
                                    <button
                                      type="button"
                                      className="btn-secondary min-h-11 w-full touch-manipulation text-xs min-[400px]:w-auto min-[400px]:min-h-0"
                                      onClick={() => patchOrderTransition(o.id, "mark_out_for_delivery")}
                                    >
                                      Mark out for delivery
                                    </button>
                                  ) : null}
                                  {o.status === "out_for_delivery" ? (
                                    <button
                                      type="button"
                                      className="btn-secondary min-h-11 w-full touch-manipulation text-xs min-[400px]:w-auto min-[400px]:min-h-0"
                                      onClick={() => patchOrderTransition(o.id, "mark_delivered")}
                                    >
                                      Mark delivered
                                    </button>
                                  ) : null}
                                  {o.status === "bidding_open" ? (
                                    <button
                                      type="button"
                                      className="btn-secondary min-h-11 w-full touch-manipulation text-xs min-[400px]:w-auto min-[400px]:min-h-0"
                                      onClick={() => loadBidsForOrder(o.id)}
                                    >
                                      {expandedBidOrderId === o.id ? "Reload bids" : "View bids"}
                                    </button>
                                  ) : null}
                                  </div>
                                  {ordersRole === "seller" && o.status === "ready_for_pickup" && pickupBuyerAcknowledgedAny ? (
                                    <div className="max-w-xl space-y-1 text-[11px] leading-snug text-neutral-500 dark:text-slate-400">
                                      <p className="text-emerald-800 dark:text-emerald-200/90">
                                        The buyer marked this pickup as received (optional). You still need to mark pickup complete to close the order.
                                      </p>
                                    </div>
                                  ) : null}
                                  {ordersRole === "buyer" &&
                                  o.status === "ready_for_pickup" &&
                                  o.fulfillmentType === "pickup" &&
                                  pickupBuyerAcknowledgedAll ? (
                                    <div className="max-w-xl space-y-1">
                                      <p className="text-[11px] text-neutral-600 dark:text-slate-400">You marked this pickup as received.</p>
                                    </div>
                                  ) : null}
                                </div>
                                {expandedBidOrderId === o.id && o.status === "bidding_open" ? (
                                  <ul className="mt-2 space-y-2 rounded-lg border border-neutral-200/80 bg-neutral-50/80 p-3 dark:border-slate-600 dark:bg-slate-900/50">
                                    {bidsForOrder.length === 0 ? <li className="text-xs text-neutral-500">No bids yet.</li> : null}
                                    {bidsForOrder.map((b) => (
                                      <li
                                        key={b.id}
                                        className="flex flex-col gap-2 text-xs min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"
                                      >
                                        <span className="min-w-0 break-words text-neutral-700 dark:text-slate-300">
                                          {formatCents(b.amountCents)} · {b.mode} · {b.status}
                                        </span>
                                        {b.status === "pending" && (o.buyerId === user?.id || o.sellerId === user?.id) ? (
                                          <button
                                            type="button"
                                            className="min-h-10 shrink-0 touch-manipulation self-start text-brand-primary hover:underline min-[420px]:self-auto"
                                            onClick={() => acceptOrderBid(o.id, b.id)}
                                          >
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
                  <h2 className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">
                    {isViewingSellerProfile ? "Seller profile" : "My profile"}
                  </h2>
                  {isViewingSellerProfile ? (
                    <button type="button" className="btn-secondary shrink-0" onClick={goBackFromSellerProfile}>
                      ← Back
                    </button>
                  ) : null}
                  {profileRenderUser && !profileEditing && !isViewingSellerProfile ? (
                    <button type="button" className="btn-secondary shrink-0" onClick={openProfileEdit}>
                      Edit profile
                    </button>
                  ) : null}
                </div>
                {profileRenderUser ? (
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
                        maxLength={20}
                        title="3-20 chars, start with a letter, use a-z 0-9 . _ only, no spaces, no duplicate dots/underscores."
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
                          minLength={3}
                          maxLength={50}
                          pattern="[A-Za-z]+(?:[ -][A-Za-z]+)*"
                          title="3-50 chars. Letters, spaces, and hyphens only."
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
                          minLength={3}
                          maxLength={50}
                          pattern="[A-Za-z]+(?:[ -][A-Za-z]+)*"
                          title="3-50 chars. Letters, spaces, and hyphens only."
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
                          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{profileFieldErrors.addressHouseStreet}</p>
                        ) : null}
                      </div>
                        <div className="min-w-0">
                        <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="profile-address-subdivision">
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
                      {profileRenderUser.avatarUrl ? (
                        <img src={profileRenderUser.avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
                      ) : (
                        (String(profileRenderUser?.username || "").trim().charAt(0) || "?").toUpperCase()
                      )}
                    </div>
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
                </div>
              )
            ) : (
              <p className="app-alert-danger-text text-sm">Could not load your profile. Try signing in again.</p>
            )}
              </div>
              {!isViewingSellerProfile ? (
              <aside className="min-w-0 space-y-4 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-900/80">
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
                        <ProductViewDensityToggle
                          value={sellerProductsView}
                          onChange={setSellerProductsView}
                          gridTitle="Grid — large photos, full details on each card"
                          compactTitle="Dense — small tiles; use View for long descriptions"
                        />
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
                      <ul className={sellerListingsGridClass(sellerProductsView)}>
                        {sellerListings.map((l) => {
                          return (
                            <SellerProductCard
                              key={l.id}
                              listing={l}
                              gridMode={sellerProductsView !== "list"}
                              compactGrid={sellerProductsView === "compact"}
                              onSaleSelect={(percent) => applySellerListingDiscount(l, percent)}
                              onEdit={() => beginEditSellerListing(l)}
                              onDelete={() => deleteSellerListingById(l.id)}
                              onAdjustQuantity={(delta) => {
                                void adjustSellerListingQuantityById(l.id, delta);
                              }}
                              onSetQuantity={(qty) => {
                                void setSellerListingQuantityById(l.id, qty);
                              }}
                              onNotifyQuantityRequired={() =>
                                pushMarketplaceToast("Enter a quantity before tapping Set.")
                              }
                              quantityUpdating={sellerListingQtySavingId === String(l.id)}
                              onView={() => {
                                const stockListed = Math.max(0, Number(l.quantity) || 0);
                                openProductInspect(l, {
                                  quantity: stockListed,
                                  quantityLabel: "Stock listed",
                                  subtitle: "Your listing",
                                  listingStockQty: stockListed,
                                  showSellerCommerceActions: true,
                                  onEditListing: () => {
                                    closeProductInspect();
                                    beginEditSellerListing(l);
                                  },
                                  onSaleSelect: (pct) => {
                                    closeProductInspect();
                                    void applySellerListingDiscount(l, pct);
                                  },
                                });
                              }}
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
              ) : null}
            </div>
          </section>
        )}

      </main>

      {productInspect ? (
        <ProductInspectModal open onClose={closeProductInspect} {...productInspect} />
      ) : null}

      {buyerCancelConfirmOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="buyer-cancel-confirm-title">
          <button
            type="button"
            className="absolute inset-0 bg-neutral-900/45 backdrop-blur-[2px] dark:bg-black/55"
            aria-label="Close cancel confirmation"
            onClick={() => setBuyerCancelConfirmOpen(false)}
          />
          <div
            className="relative z-10 w-full max-w-md rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.22)] dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="buyer-cancel-confirm-title" className="text-lg font-semibold text-neutral-900 dark:text-slate-100">
              Cancel selected order{selectedOrders.length > 1 ? "s" : ""}?
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">
              Are you sure you want to cancel {selectedOrders.length > 1 ? "these selected orders" : "this selected order"}?
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-secondary min-h-10 w-full sm:w-auto"
                onClick={() => setBuyerCancelConfirmOpen(false)}
              >
                Keep order
              </button>
              <button
                type="button"
                className="min-h-10 w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 sm:w-auto dark:bg-rose-500 dark:hover:bg-rose-400"
                onClick={() => {
                  setBuyerCancelConfirmOpen(false);
                  void applyTransitionToSelectedOrders("cancel", "Cancelled");
                }}
              >
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {leaveCommunityConfirmOpen ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center p-4 sm:p-6"
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
            className="relative z-10 w-full max-w-md rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.22)] dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="leave-community-confirm-title" className="text-lg font-semibold text-neutral-900 dark:text-slate-100">
              Leave this community?
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">
              Are you sure you want to leave this community?
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-secondary min-h-10 w-full sm:w-auto"
                onClick={() => setLeaveCommunityConfirmOpen(false)}
              >
                Stay
              </button>
              <button
                type="button"
                className="min-h-10 w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 sm:w-auto dark:bg-rose-500 dark:hover:bg-rose-400"
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
          className="fixed inset-0 z-[96] flex items-center justify-center p-3 sm:p-6"
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
            <img
              src={quickAddListing.imageUrl}
              alt={quickAddListing.title || "Product image"}
              className="max-h-[88vh] w-full rounded-2xl border border-white/30 object-contain shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
            />
            <button
              type="button"
              className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-black/45 text-lg leading-none text-white transition hover:bg-black/60"
              aria-label="Close image preview"
              onClick={() => setQuickAddImagePreviewOpen(false)}
            >
              <span aria-hidden>×</span>
            </button>
          </div>
        </div>
      ) : null}

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
                  {quickActionType === "buy" ? "Complete your order" : "Add to cart"}
                </h2>
                <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                  {quickActionType === "buy"
                    ? "Pay COD when you receive your order."
                    : "You can check out from your cart anytime."}
                </p>
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
                      <button
                        type="button"
                        className="h-full w-full cursor-zoom-in"
                        aria-label="View larger product image"
                        onClick={() => setQuickAddImagePreviewOpen(true)}
                      >
                        <img
                          src={quickAddListing.imageUrl}
                          alt={quickAddListing.title || "Product"}
                          className="h-full w-full object-cover transition duration-200 hover:scale-[1.02]"
                        />
                      </button>
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
                    frameDescriptionAsSellerNote
                    quantityAfterDescription
                    quantityRow={
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <span className="text-xs font-medium text-neutral-600 dark:text-slate-400">Qty</span>
                        <div className="inline-flex items-center gap-1 sm:gap-1.5">
                          <button
                            type="button"
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-white text-base font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:h-10 sm:w-10"
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
                            className="input-base h-11 w-16 px-1 text-center text-sm tabular-nums sm:h-10 sm:w-14"
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
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-white text-base font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:h-10 sm:w-10"
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
                <div className="mt-3 border-t border-neutral-200/60 pt-3 dark:border-slate-600/60">
                  <button
                    type="button"
                    className="text-left text-xs font-semibold text-brand-primary underline decoration-brand-primary/40 underline-offset-2 hover:text-brand-primary/90 dark:text-brand-accent"
                    onClick={() => {
                      const q = Number(quickAddQuantity);
                      openProductInspect(
                        { ...quickAddListing, priceCents: quickAddListing.priceCents },
                        {
                          quantity: Number.isFinite(q) && q > 0 ? q : 1,
                          comment: String(quickAddComment || "").trim(),
                          commentSectionRequired: true,
                          commentHeading:
                            quickActionType === "buy" ? "Your note with this order" : "Your note to the seller",
                          subtitle: quickActionType === "buy" ? "Order preview" : "Add to cart preview",
                        },
                      );
                    }}
                  >
                    View full description & note
                  </button>
                </div>
              </div>
              {quickActionType === "buy" ? (
                <div className="border-t border-neutral-200/90 pt-3 dark:border-slate-600/90">
                  <p className="mb-2 text-xs font-medium text-neutral-600 dark:text-slate-400">Fulfillment</p>
                  <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
                    {(Array.isArray(quickAddListing.fulfillmentModes) && quickAddListing.fulfillmentModes.length
                      ? quickAddListing.fulfillmentModes
                      : ["pickup"]
                    ).includes("pickup") ? (
                      <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg py-1 pr-2 text-sm sm:min-h-0">
                        <input
                          type="radio"
                          name="quick-order-fulfillment"
                          className="h-4 w-4 shrink-0"
                          checked={quickOrderFulfillmentType === "pickup"}
                          onChange={() => setQuickOrderFulfillmentType("pickup")}
                        />
                        Pickup
                      </label>
                    ) : null}
                    {(Array.isArray(quickAddListing.fulfillmentModes) && quickAddListing.fulfillmentModes.length
                      ? quickAddListing.fulfillmentModes
                      : ["pickup"]
                    ).includes("delivery") ? (
                      <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg py-1 pr-2 text-sm sm:min-h-0">
                        <input
                          type="radio"
                          name="quick-order-fulfillment"
                          className="h-4 w-4 shrink-0"
                          checked={quickOrderFulfillmentType === "delivery"}
                          onChange={() => setQuickOrderFulfillmentType("delivery")}
                        />
                        Delivery
                      </label>
                    ) : null}
                  </div>
                  {(() => {
                    const q = Math.max(1, Number(quickAddQuantity) || 1);
                    const unitCents = Math.max(0, Number(quickAddListing.priceCents) || 0);
                    const lineCents = unitCents * q;
                    return (
                      <div className="mt-3 rounded-lg border border-neutral-200/80 bg-neutral-50/80 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800/50">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">Subtotal</p>
                        <p className="mt-1 text-base font-semibold tabular-nums text-neutral-900 dark:text-slate-100">{formatCents(lineCents)}</p>
                        <p className="mt-0.5 text-xs text-neutral-500 dark:text-slate-400">
                          {q} {q === 1 ? "item" : "items"} at {formatCents(unitCents)} each
                        </p>
                      </div>
                    );
                  })()}
                </div>
              ) : null}
              <div className="border-t border-neutral-200/90 pt-3 dark:border-slate-600/90">
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-400" htmlFor="quick-add-comment">
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
                <p className="app-alert-error text-sm" role="alert">
                  {quickAddInlineError}
                </p>
              ) : null}
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
