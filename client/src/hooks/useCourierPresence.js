import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../lib/appApi.js";
import { persistCourierModesToProfile } from "../lib/courierProfileModesApi.js";
import { defaultClaimModeFromProfile, MODE_ORDER } from "../lib/courierTransportModes.js";

const SAVE_FEEDBACK = {
  offline: "",
  available: "",
  active: "Still listed — tasks below.",
  busy: "You’re on a delivery — finish up when you can.",
};

const ALLOWED_COURIER_STATUS = new Set(["offline", "available", "active", "busy"]);

/** Match server / DB `courier_status` — unknown values fall back to offline so hub chrome stays consistent. */
function normalizeCourierPresenceStatus(raw) {
  const s = String(raw ?? "offline").trim().toLowerCase();
  return ALLOWED_COURIER_STATUS.has(s) ? s : "offline";
}

/** Must match server `ALLOWED_COURIER_OPTIONAL_TAGS`. */
const COURIER_OPTIONAL_TAG_OPTIONS = [
  { id: "eco", label: "Eco" },
  { id: "bike", label: "Cycling" },
  { id: "fast", label: "Fast" },
  { id: "helping", label: "Helping" },
];

const OPTIONAL_TAG_IDS = new Set(COURIER_OPTIONAL_TAG_OPTIONS.map((o) => o.id));

export function normalizeCourierOptionalTags(raw) {
  return [
    ...new Set(
      (Array.isArray(raw) ? raw : [])
        .map((t) => String(t || "").trim().toLowerCase())
        .filter((t) => OPTIONAL_TAG_IDS.has(t)),
    ),
  ];
}

export { COURIER_OPTIONAL_TAG_OPTIONS };

/**
 * Shared courier presence + profile modes state for Activity → Courier (Tasks hub and chrome above tabs).
 *
 * @param {{
 *   token: string,
 *   communityId: string,
 *   onPresenceApplied?: (payload: { courierStatus?: string }) => void,
 *   courierProfileReady?: boolean,
 *   viewerProfile?: { id: string, displayName?: string, username?: string, avatarUrl?: string } | null,
 *   initialCourierStatus?: string | null,
 * }} opts
 */
export function useCourierPresence({
  token,
  communityId,
  onPresenceApplied,
  courierProfileReady = true,
  viewerProfile = null,
  initialCourierStatus = null,
}) {
  const [courierStatus, setCourierStatus] = useState(() =>
    initialCourierStatus != null ? normalizeCourierPresenceStatus(initialCourierStatus) : "offline",
  );
  const [optionalTags, setOptionalTags] = useState([]);
  const [courierModes, setCourierModes] = useState([]);
  const [viewerBadges, setViewerBadges] = useState(/** @type {{ id: string, label: string }[]} */ ([]));
  const [viewerCompleted, setViewerCompleted] = useState(0);
  const [courierAvgRating, setCourierAvgRating] = useState(/** @type {number | null} */ (null));
  const [courierReviewCount, setCourierReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [saveFeedback, setSaveFeedback] = useState("");
  /** @type {number | null} */
  const [suggestedCompensationCents, setSuggestedCompensationCents] = useState(null);
  const [suggestedPesosDraft, setSuggestedPesosDraft] = useState("");
  const [savingSuggested, setSavingSuggested] = useState(false);
  const [allowTaskNotifications, setAllowTaskNotifications] = useState(true);
  const [savingNotify, setSavingNotify] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const feedbackClearRef = useRef(/** @type {number | null} */ (null));
  const [neighborSettingsOpen, setNeighborSettingsOpen] = useState(false);
  const [claimMode, setClaimMode] = useState("walk");
  const [profileModes, setProfileModes] = useState(/** @type {string[]} */ ([]));
  const [modesLoaded, setModesLoaded] = useState(false);
  const [activeRunAssignmentMode, setActiveRunAssignmentMode] = useState(/** @type {string | null} */ (null));
  const presenceHydratedRef = useRef(false);

  useEffect(() => {
    presenceHydratedRef.current = false;
  }, [token]);

  const selectableModes = useMemo(() => {
    if (profileModes.length > 0) return MODE_ORDER.filter((x) => profileModes.includes(x));
    return [...MODE_ORDER];
  }, [profileModes]);

  const applyModesFromApi = useCallback((modesRes) => {
    if (!modesRes || typeof modesRes !== "object") {
      setProfileModes([]);
      setClaimMode("walk");
      setModesLoaded(true);
      return;
    }
    const raw = Array.isArray(modesRes?.modes)
      ? modesRes.modes.map((x) => String(x || "").toLowerCase()).filter((x) => MODE_ORDER.includes(x))
      : [];
    setProfileModes([...new Set(raw)]);
    setClaimMode(defaultClaimModeFromProfile(raw));
    setModesLoaded(true);
  }, []);

  const applyPresencePayload = useCallback(
    (d) => {
      if (!d || typeof d !== "object") return;
      setCourierStatus(normalizeCourierPresenceStatus(d.courierStatus));
      setOptionalTags(normalizeCourierOptionalTags(d.optionalTags));
      setAllowTaskNotifications(d.allowCourierTaskNotifications !== false);
      const sc = d.suggestedCompensationCents;
      if (sc != null && Number.isFinite(Number(sc))) {
        const n = Math.max(0, Math.floor(Number(sc)));
        setSuggestedCompensationCents(n);
        setSuggestedPesosDraft(String(n / 100));
      } else {
        setSuggestedCompensationCents(null);
        setSuggestedPesosDraft("");
      }
      setCourierModes(
        Array.isArray(d.modes) ? d.modes.map((m) => String(m || "").trim().toLowerCase()).filter(Boolean) : [],
      );
      setViewerBadges(Array.isArray(d.badges) ? d.badges : []);
      setViewerCompleted(typeof d.completedDeliveries === "number" ? d.completedDeliveries : 0);
      const ar = d.courierAvgRating;
      setCourierAvgRating(ar != null && Number.isFinite(Number(ar)) ? Number(ar) : null);
      setCourierReviewCount(typeof d.courierReviewCount === "number" && d.courierReviewCount >= 0 ? d.courierReviewCount : 0);
      onPresenceApplied?.(d);
    },
    [onPresenceApplied],
  );

  const refresh = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [presenceResult, modesResult] = await Promise.allSettled([
        apiRequest("/me/courier-presence", { token }),
        apiRequest("/me/courier-modes", { token }),
      ]);
      if (presenceResult.status === "fulfilled") {
        applyPresencePayload(presenceResult.value);
        setNote("");
        presenceHydratedRef.current = true;
      } else {
        setCourierStatus("offline");
        setOptionalTags([]);
        setCourierModes([]);
        setViewerBadges([]);
        setViewerCompleted(0);
        setCourierAvgRating(null);
        setCourierReviewCount(0);
        setAllowTaskNotifications(true);
        setSuggestedCompensationCents(null);
        setSuggestedPesosDraft("");
        presenceHydratedRef.current = true;
      }
      if (modesResult.status === "fulfilled") {
        applyModesFromApi(modesResult.value);
      } else {
        applyModesFromApi(null);
      }
    } finally {
      setLoading(false);
    }
  }, [token, applyPresencePayload, applyModesFromApi]);

  const refreshPresenceQuiet = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiRequest("/me/courier-presence", { token });
      applyPresencePayload(d);
    } catch {
      /* keep current UI */
    }
  }, [token, applyPresencePayload]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!token) return undefined;
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") void refreshPresenceQuiet();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [token, refreshPresenceQuiet]);

  useEffect(() => {
    return () => {
      if (feedbackClearRef.current != null) window.clearTimeout(feedbackClearRef.current);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setProfileModes([]);
      setModesLoaded(false);
    }
  }, [token]);

  useEffect(() => {
    if (presenceHydratedRef.current) return undefined;
    if (initialCourierStatus == null) return undefined;
    setCourierStatus(normalizeCourierPresenceStatus(initialCourierStatus));
    return undefined;
  }, [token, initialCourierStatus]);

  useEffect(() => {
    if (!selectableModes.includes(claimMode)) {
      setClaimMode(selectableModes[0] || "walk");
    }
  }, [selectableModes, claimMode]);

  useEffect(() => {
    if (!neighborSettingsOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setNeighborSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [neighborSettingsOpen]);

  const showSaveFeedback = useCallback((statusId) => {
    setSaveFeedback(SAVE_FEEDBACK[statusId] || "");
    if (feedbackClearRef.current != null) window.clearTimeout(feedbackClearRef.current);
    feedbackClearRef.current = window.setTimeout(() => setSaveFeedback(""), 4000);
  }, []);

  const saveSuggestedRate = useCallback(async () => {
    if (!token || courierStatus === "busy") return;
    setNote("");
    const raw = String(suggestedPesosDraft || "").trim();
    let suggestedPayload = null;
    if (raw !== "") {
      const pesos = Number(raw);
      if (!Number.isFinite(pesos) || pesos < 0) {
        setNote("Enter a valid suggested rate in pesos, or leave blank to clear.");
        return;
      }
      suggestedPayload = Math.round(pesos * 100);
    }
    const currentCents =
      suggestedCompensationCents != null && Number.isFinite(Number(suggestedCompensationCents))
        ? Math.max(0, Math.floor(Number(suggestedCompensationCents)))
        : null;
    if (suggestedPayload === currentCents) return;

    setSavingSuggested(true);
    try {
      const d = await apiRequest("/me/courier-presence", {
        method: "PATCH",
        token,
        body: {
          suggestedCompensationCents: suggestedPayload,
        },
      });
      applyPresencePayload(d);
      setSaveFeedback("Suggested rate saved (reference only).");
      if (feedbackClearRef.current != null) window.clearTimeout(feedbackClearRef.current);
      feedbackClearRef.current = window.setTimeout(() => setSaveFeedback(""), 4000);
    } catch (e) {
      setNote(e?.message || "Could not save.");
    } finally {
      setSavingSuggested(false);
    }
  }, [token, courierStatus, suggestedPesosDraft, suggestedCompensationCents, applyPresencePayload]);

  const saveTaskNotifications = useCallback(
    async (next) => {
      if (!token) return;
      setSavingNotify(true);
      setNote("");
      try {
        const d = await apiRequest("/me/courier-presence", {
          method: "PATCH",
          token,
          body: { allowCourierTaskNotifications: next },
        });
        applyPresencePayload(d);
        setSaveFeedback(next ? "Task notifications on." : "Task notifications off.");
        if (feedbackClearRef.current != null) window.clearTimeout(feedbackClearRef.current);
        feedbackClearRef.current = window.setTimeout(() => setSaveFeedback(""), 4000);
      } catch (e) {
        setNote(e?.message || "Could not update notifications.");
      } finally {
        setSavingNotify(false);
      }
    },
    [token, applyPresencePayload],
  );

  const saveStatus = useCallback(
    async (next) => {
      if (!token) return;
      const nextNorm = String(next || "").trim().toLowerCase();
      if ((nextNorm === "available" || nextNorm === "active") && !courierProfileReady) {
        setNote("Complete your profile before turning on courier availability.");
        return;
      }
      const previousStatus = courierStatus;
      if (nextNorm === "offline") {
        setCourierStatus("offline");
      }
      setSaving(true);
      setNote("");
      try {
        const d = await apiRequest("/me/courier-presence", {
          method: "PATCH",
          token,
          body: { courierStatus: next, optionalTags },
        });
        applyPresencePayload(d);
        const resolved = normalizeCourierPresenceStatus(d.courierStatus ?? next);
        if (d.note) setNote(String(d.note));
        showSaveFeedback(resolved);
      } catch (e) {
        if (nextNorm === "offline") {
          setCourierStatus(previousStatus);
        }
        setNote(e?.message || "Could not update.");
      } finally {
        setSaving(false);
      }
    },
    [token, courierProfileReady, optionalTags, courierStatus, applyPresencePayload, showSaveFeedback],
  );

  const onActiveRunMeta = useCallback((meta) => {
    const m = meta?.assignmentMode != null ? String(meta.assignmentMode).trim().toLowerCase() : "";
    setActiveRunAssignmentMode(m || null);
  }, []);

  const applyPersistedCourierModes = useCallback((normalized) => {
    setProfileModes(normalized);
    setCourierModes(normalized);
  }, []);

  const toggleProfileMode = useCallback(
    async (m) => {
      const mode = MODE_ORDER.includes(String(m || "").trim().toLowerCase()) ? String(m).trim().toLowerCase() : "walk";
      const base = profileModes.length > 0 ? [...profileModes] : [...MODE_ORDER];
      const has = base.includes(mode);
      let nextModes = has ? base.filter((x) => x !== mode) : [...base, mode].sort((a, b) => MODE_ORDER.indexOf(a) - MODE_ORDER.indexOf(b));
      if (nextModes.length === 0) nextModes = [mode];
      if (!token) return;
      try {
        const normalized = await persistCourierModesToProfile(token, nextModes);
        applyPersistedCourierModes(normalized);
        setClaimMode((prev) => (normalized.includes(prev) ? prev : defaultClaimModeFromProfile(normalized)));
      } catch (e) {
        setNote(e?.message || "Could not save transport modes.");
      }
    },
    [token, profileModes, applyPersistedCourierModes],
  );

  const selectNextClaimMode = useCallback((m) => {
    const next = MODE_ORDER.includes(String(m || "").trim().toLowerCase()) ? String(m).trim().toLowerCase() : "walk";
    setClaimMode(next);
  }, []);

  const toggleOptionalTag = useCallback(
    async (tagId) => {
      if (!token || courierStatus === "busy" || savingTags) return;
      const id = String(tagId || "").trim().toLowerCase();
      const normalized = normalizeCourierOptionalTags(optionalTags);
      const has = normalized.includes(id);
      const next = has ? normalized.filter((t) => t !== id) : [...normalized, id];
      setSavingTags(true);
      setNote("");
      try {
        const d = await apiRequest("/me/courier-presence", {
          method: "PATCH",
          token,
          body: { optionalTags: next },
        });
        applyPresencePayload(d);
        if (d.note) setNote(String(d.note));
        setSaveFeedback("Badges updated.");
        if (feedbackClearRef.current != null) window.clearTimeout(feedbackClearRef.current);
        feedbackClearRef.current = window.setTimeout(() => setSaveFeedback(""), 4000);
      } catch (e) {
        setNote(e?.message || "Could not update badges.");
      } finally {
        setSavingTags(false);
      }
    },
    [token, courierStatus, savingTags, optionalTags, applyPresencePayload],
  );

  const normalizedOptionalTags = useMemo(() => normalizeCourierOptionalTags(optionalTags), [optionalTags]);

  const neighborPreviewCourier = useMemo(() => {
    if (!viewerProfile || !String(viewerProfile.id || "").trim()) return null;
    const busy = courierStatus === "busy";
    return {
      id: String(viewerProfile.id),
      displayName: viewerProfile.displayName,
      username: viewerProfile.username,
      avatarUrl: viewerProfile.avatarUrl,
      courierStatus,
      optionalTags: normalizedOptionalTags,
      modes: courierModes,
      completedDeliveries: viewerCompleted,
      badges: viewerBadges,
      suggestedCompensationCents,
      runAssignmentMode: busy ? activeRunAssignmentMode : null,
      nextClaimMode: !busy && courierStatus !== "offline" ? claimMode : null,
      courierAvgRating,
      courierReviewCount,
    };
  }, [
    viewerProfile,
    courierStatus,
    normalizedOptionalTags,
    courierModes,
    viewerCompleted,
    viewerBadges,
    suggestedCompensationCents,
    activeRunAssignmentMode,
    claimMode,
    courierAvgRating,
    courierReviewCount,
  ]);

  const courierTransportState = useMemo(
    () => ({
      claimMode,
      setClaimMode,
      profileModes,
      modesLoaded,
    }),
    [claimMode, profileModes, modesLoaded],
  );

  const isOn = courierStatus !== "offline";
  const availabilityLocked = courierStatus === "busy";

  return {
    token,
    communityId,
    courierProfileReady,
    viewerProfile,
    courierStatus,
    optionalTags,
    courierModes,
    viewerBadges,
    viewerCompleted,
    courierAvgRating,
    courierReviewCount,
    loading,
    saving,
    note,
    setNote,
    saveFeedback,
    suggestedCompensationCents,
    suggestedPesosDraft,
    setSuggestedPesosDraft,
    savingSuggested,
    allowTaskNotifications,
    savingNotify,
    savingTags,
    neighborSettingsOpen,
    setNeighborSettingsOpen,
    claimMode,
    profileModes,
    modesLoaded,
    selectableModes,
    refresh,
    refreshPresenceQuiet,
    saveSuggestedRate,
    saveTaskNotifications,
    saveStatus,
    onActiveRunMeta,
    toggleProfileMode,
    selectNextClaimMode,
    toggleOptionalTag,
    normalizedOptionalTags,
    neighborPreviewCourier,
    courierTransportState,
    isOn,
    availabilityLocked,
    SAVE_FEEDBACK,
  };
}
