import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../lib/appApi.js";
import { isServiceListing } from "../lib/listingServiceCardMeta.js";
import { normalizeBookedSlotsArray, slotOptionsForServiceListing } from "../lib/serviceBookingSlot.js";

const DEFAULT_POLL_MS = 0;
const DEBOUNCE_MS = 450;

/**
 * Loads `/listings/:id/service-booked-slots` for a service listing with weekly slots.
 * Centralizes retries, stale handling, polling, visibility refresh, and request-generation guards.
 *
 * @param {{
 *   listingRef: React.MutableRefObject<unknown>;
 *   listingId: string;
 *   token: string | undefined;
 *   enabled: boolean;
 *   pollMs?: number;
 *   debouncedDateIso?: string;
 * }} args
 * @returns {{
 *   bookedSlots: { date: string; time: string }[];
 *   occupancyStale: boolean;
 *   occupancyLoading: boolean;
 *   occupancyLive: boolean;
 *   reload: () => Promise<void>;
 * }}
 */
export function useServiceListingBookedSlots({
  listingRef,
  listingId,
  token,
  enabled,
  pollMs = DEFAULT_POLL_MS,
  debouncedDateIso = "",
}) {
  const [bookedSlots, setBookedSlots] = useState([]);
  const [occupancyStale, setOccupancyStale] = useState(false);
  const [occupancyLoading, setOccupancyLoading] = useState(false);
  /** At least one successful fetch for the current `listingId` while `enabled` (reset when disabled or id changes). */
  const [occupancyLive, setOccupancyLive] = useState(false);
  const fetchGenRef = useRef(0);
  const occupancyLiveRef = useRef(false);
  occupancyLiveRef.current = occupancyLive;

  const load = useCallback(async () => {
    const id = String(listingId || "").trim();
    const listing = listingRef?.current;
    if (!enabled || !id) return;
    if (!isServiceListing(listing) || String(listing?.id || "").trim() !== id) return;
    if (!slotOptionsForServiceListing(listing).required) return;
    const reqId = ++fetchGenRef.current;
    const showLoading = !occupancyLiveRef.current;
    if (showLoading) setOccupancyLoading(true);
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const r = await apiRequest(`/listings/${id}/service-booked-slots`, { token, cache: "no-store" });
          const norm = normalizeBookedSlotsArray(r?.bookedSlots);
          if (reqId !== fetchGenRef.current) return;
          setBookedSlots(norm);
          setOccupancyStale(false);
          occupancyLiveRef.current = true;
          setOccupancyLive(true);
          setOccupancyLoading(false);
          return;
        } catch {
          if (attempt < 2) await sleep(350 * (attempt + 1));
        }
      }
      if (reqId !== fetchGenRef.current) return;
      setOccupancyStale(true);
      setOccupancyLoading(false);
    } finally {
      /** Superseded in-flight loads must not leave `occupancyLoading` stuck true (e.g. Strict Mode / gen bump races). */
      if (showLoading && reqId !== fetchGenRef.current) {
        setOccupancyLoading(false);
      }
    }
  }, [enabled, listingId, listingRef, token]);

  useEffect(() => {
    if (!enabled) {
      fetchGenRef.current += 1;
      occupancyLiveRef.current = false;
      setBookedSlots([]);
      setOccupancyStale(false);
      setOccupancyLoading(false);
      setOccupancyLive(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchGenRef.current += 1;
    occupancyLiveRef.current = false;
    setBookedSlots([]);
    setOccupancyStale(false);
    setOccupancyLive(false);
    setOccupancyLoading(false);
  }, [listingId, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await load();
    };
    void run();
    const onVis = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, listingId, token, load]);

  useEffect(() => {
    if (!enabled || !pollMs || pollMs <= 0) return undefined;
    const id = window.setInterval(() => void load(), pollMs);
    return () => window.clearInterval(id);
  }, [enabled, pollMs, load]);

  useEffect(() => {
    if (!enabled) return undefined;
    const d = String(debouncedDateIso || "").trim();
    if (!d) return undefined;
    const tid = window.setTimeout(() => void load(), DEBOUNCE_MS);
    return () => window.clearTimeout(tid);
  }, [debouncedDateIso, enabled, load]);

  return { bookedSlots, occupancyStale, occupancyLoading, occupancyLive, reload: load };
}
