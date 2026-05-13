import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../../lib/appApi.js";
import { useServiceListingBookedSlots } from "../../hooks/useServiceListingBookedSlots.js";
import { isServiceListing } from "../../lib/listingServiceCardMeta.js";
import {
  bookedSlotsToKeySet,
  bookingTimeHmWithinWindow,
  isServiceSlotElapsed,
  normalizeBookingDateIso,
  normalizeBookingTimeHm,
  slotOptionsForServiceListing,
  validateServiceBookingSelection,
} from "../../lib/serviceBookingSlot.js";
import { ServiceBookingPicker } from "./ServiceBookingPicker.jsx";

export function OrderPlacementForm({ listing, token, onDone, onError }) {
  const modes = listing?.fulfillmentModes?.length ? listing.fulfillmentModes : ["pickup"];
  const [fulfillmentType, setFulfillmentType] = useState(() => (modes.includes("pickup") ? "pickup" : modes[0]));
  /** Whole pesos — converted to centavos for `buyerCourierContributionCents` on delivery. */
  const [buyerCourierPesos, setBuyerCourierPesos] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isService = isServiceListing(listing);
  const orderPlacementListingRef = useRef(listing);
  orderPlacementListingRef.current = listing;
  const serviceBookingSlotKey = useMemo(
    () =>
      `${String(listing?.id ?? "")}|${String(listing?.verticalId ?? "")}|${String(listing?.categories ?? "")}|${String(
        listing?.serviceMeta?.common?.availabilitySchedule ?? "",
      )}`,
    [listing?.id, listing?.verticalId, listing?.categories, listing?.serviceMeta?.common?.availabilitySchedule],
  );
  const slotOpts = useMemo(() => {
    if (!isServiceListing(listing)) return { required: false, dates: [], times: [], scheduleHuman: "", windowStart: "", windowEnd: "" };
    return slotOptionsForServiceListing(listing);
    // `serviceBookingSlotKey` captures fields that affect generated dates/times copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceBookingSlotKey]);
  const [serviceBookingDate, setServiceBookingDate] = useState("");
  const [serviceBookingTime, setServiceBookingTime] = useState("");
  const {
    bookedSlots,
    occupancyStale: bookingOccupancyStale,
    occupancyLoading: bookingOccupancyLoading,
    occupancyLive: bookingOccupancyLive,
    reload: reloadBookedSlots,
  } = useServiceListingBookedSlots({
    listingRef: orderPlacementListingRef,
    listingId: String(listing?.id || ""),
    token,
    enabled: Boolean(isService && listing?.id && slotOpts.required),
    debouncedDateIso: normalizeBookingDateIso(serviceBookingDate),
  });
  const placementBlockedByOccupancy = Boolean(slotOpts.required && bookingOccupancyLoading && !bookingOccupancyLive);

  const bookedKeySet = useMemo(() => bookedSlotsToKeySet(bookedSlots), [bookedSlots]);

  const timeOkOnDay = (dateIso, timeHm) => {
    const di = normalizeBookingDateIso(dateIso);
    const tm = normalizeBookingTimeHm(timeHm);
    if (!di || !tm || !slotOpts.dates?.includes(di)) return false;
    if (!bookingTimeHmWithinWindow(tm, slotOpts.windowStart, slotOpts.windowEnd)) return false;
    if (isServiceSlotElapsed(di, tm)) return false;
    if (bookedKeySet.has(`${di}\t${tm}`)) return false;
    if (slotOpts.required && bookingOccupancyLoading && !bookingOccupancyLive) return false;
    return true;
  };

  useEffect(() => {
    if (!isService || !slotOpts.required) return;
    const d = normalizeBookingDateIso(serviceBookingDate);
    const tNorm = normalizeBookingTimeHm(serviceBookingTime);
    if (d && tNorm && timeOkOnDay(d, tNorm)) return;
    const first = (slotOpts.times || []).find((tm) => timeOkOnDay(serviceBookingDate, tm));
    if (first) setServiceBookingTime(first);
    else if (serviceBookingTime) setServiceBookingTime("");
  }, [isService, slotOpts.required, slotOpts.times, serviceBookingDate, serviceBookingTime, bookedKeySet, bookingOccupancyLive, bookingOccupancyLoading, bookingOccupancyStale, slotOpts.windowStart, slotOpts.windowEnd, slotOpts.dates]);

  const isOutOfStock = !isService && Math.max(0, Number(listing?.quantity) || 0) <= 0;

  useEffect(() => {
    const m = listing?.fulfillmentModes?.length ? listing.fulfillmentModes : ["pickup"];
    setFulfillmentType(m.includes("pickup") ? "pickup" : m[0]);
  }, [listing?.id, listing?.fulfillmentModes]);

  useEffect(() => {
    if (!isServiceListing(listing)) {
      setServiceBookingDate("");
      setServiceBookingTime("");
      return;
    }
    const o = slotOptionsForServiceListing(listing);
    setServiceBookingDate(o.dates[0] || "");
    setServiceBookingTime("");
  }, [listing]);

  const place = async () => {
    if (!token) return;
    if (isOutOfStock) {
      onError("This listing is currently out of stock.");
      return;
    }
    if (isService) {
      if (slotOpts.required && bookingOccupancyLoading && !bookingOccupancyLive) {
        onError("Loading taken slots. Please wait a moment.");
        return;
      }
      const err = validateServiceBookingSelection(listing, serviceBookingDate, serviceBookingTime, {
        bookedSlotKeys: slotOpts.required && bookingOccupancyLive ? bookedKeySet : undefined,
      });
      if (err) {
        onError(err);
        return;
      }
    }
    setSubmitting(true);
    try {
      const desiredQty = 1;
      if (!isService) {
        const listingMaxQty = Math.max(0, Number(listing?.quantity) || 0);
        const currentOrders = await apiRequest("/orders?role=buyer", { token });
        const pendingQtyForListing = (Array.isArray(currentOrders?.orders) ? currentOrders.orders : [])
          .filter((o) => String(o?.listingId || "") === String(listing?.id || "") && String(o?.status || "").toLowerCase() === "placed")
          .reduce((sum, o) => sum + Math.max(0, Number(o?.quantity) || 0), 0);
        const availableQty = Math.max(0, listingMaxQty - pendingQtyForListing);
        if (availableQty < desiredQty) {
          onError("Maximum available quantity is already in pending orders.");
          return;
        }
      }
      const pesosRaw = String(buyerCourierPesos || "").trim();
      const pesos = pesosRaw === "" ? 0 : Number(pesosRaw);
      const buyerCourierContributionCents =
        fulfillmentType === "delivery" && Number.isFinite(pesos) && pesos >= 0 ? Math.round(pesos * 100) : 0;
      if (fulfillmentType === "delivery" && pesosRaw !== "" && !Number.isFinite(pesos)) {
        onError("Enter a valid number for your courier share (pesos), or leave it blank.");
        return;
      }
      const bookingBody =
        isService && serviceBookingDate && serviceBookingTime
          ? { serviceBookingDate, serviceBookingTime }
          : {};
      const created = await apiRequest("/orders", {
        method: "POST",
        token,
        body: {
          listingId: listing.id,
          fulfillmentType,
          quantity: desiredQty,
          ...(fulfillmentType === "delivery" && buyerCourierContributionCents > 0
            ? { buyerCourierContributionCents }
            : {}),
          ...bookingBody,
        },
      });
      const createdOrderId = String(created?.order?.id || "");
      onDone(
        fulfillmentType === "delivery"
          ? "Order placed. Delivery tip is shown on the order — pay COD for goods + courier share at handoff (no in-app wallet)."
          : "Order placed. Pay COD at pickup or when delivery is completed.",
        createdOrderId,
      );
    } catch (e) {
      const msg = e.message || "Could not place order.";
      if (
        isService &&
        slotOpts.required &&
        listing?.id &&
        /already booked|no longer available/i.test(String(msg))
      ) {
        void reloadBookedSlots();
        return;
      }
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-neutral-200/90 bg-white/80 p-4 dark:border-slate-600 dark:bg-slate-900/60">
      <p className="text-sm font-medium text-neutral-800 dark:text-slate-200">Place order (COD)</p>
      {isOutOfStock ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/20 dark:text-rose-300">
          Out of stock. You can still view this item, but ordering is disabled.
        </p>
      ) : null}
      {isService && slotOpts.required ? (
        <fieldset className="space-y-2 rounded-lg border border-neutral-200/80 bg-neutral-50/70 p-2.5 dark:border-slate-700/70 dark:bg-slate-900/40">
          <legend className="text-xs font-semibold text-neutral-900 dark:text-slate-100">Preferred slot</legend>
          <ServiceBookingPicker
            key={String(listing?.id || "")}
            scheduleHuman={slotOpts.scheduleHuman}
            bookableDates={slotOpts.dates || []}
            slotTimes={slotOpts.times || []}
            windowStartHm={slotOpts.windowStart || ""}
            windowEndHm={slotOpts.windowEnd || ""}
            bookedSlots={bookedSlots}
            selectedDate={serviceBookingDate}
            selectedTime={serviceBookingTime}
            onSelectDate={(iso) => setServiceBookingDate(iso)}
            onSelectTime={setServiceBookingTime}
            disabled={submitting}
            occupancyStale={bookingOccupancyStale}
            occupancyLoading={bookingOccupancyLoading}
            occupancyLive={bookingOccupancyLive}
          />
        </fieldset>
      ) : isService ? (
        <p className="text-xs text-neutral-600 dark:text-slate-400">
          Add your preferred date and time in a follow-up message after placing; this listing does not yet define weekly
          hours for automatic slot picking.
        </p>
      ) : null}
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
            Delivery (community courier or seller; pay COD at handoff)
          </label>
        ) : null}
      </div>
      {fulfillmentType === "delivery" ? (
        <label className="block text-xs text-neutral-700 dark:text-slate-300">
          <span className="font-medium">Your share for the courier (optional, ₱)</span>
          <input
            type="text"
            inputMode="decimal"
            className="mt-1 w-full max-w-[12rem] rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
            placeholder="0"
            value={buyerCourierPesos}
            onChange={(e) => setBuyerCourierPesos(e.target.value)}
            autoComplete="off"
          />
          <span className="mt-1 block text-[11px] text-neutral-500 dark:text-slate-500">
            Added to the courier COD pool with the seller&apos;s share (if any). Not charged in-app.
          </span>
        </label>
      ) : null}
      <button type="button" className="btn-primary" disabled={submitting || isOutOfStock || placementBlockedByOccupancy} onClick={place}>
        {submitting ? "Placing order…" : "Place order"}
      </button>
    </div>
  );
}
