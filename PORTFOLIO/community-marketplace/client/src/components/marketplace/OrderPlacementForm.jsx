import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/appApi.js";
import { isServiceListing } from "../../lib/listingServiceCardMeta.js";
import {
  formatIsoDateForBookingDisplay,
  formatTimeHmTo12HourLabel,
  slotOptionsForServiceListing,
  validateServiceBookingSelection,
} from "../../lib/serviceBookingSlot.js";

export function OrderPlacementForm({ listing, token, onDone, onError }) {
  const modes = listing?.fulfillmentModes?.length ? listing.fulfillmentModes : ["pickup"];
  const [fulfillmentType, setFulfillmentType] = useState(() => (modes.includes("pickup") ? "pickup" : modes[0]));
  /** Whole pesos — converted to centavos for `buyerCourierContributionCents` on delivery. */
  const [buyerCourierPesos, setBuyerCourierPesos] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isService = isServiceListing(listing);
  const slotOpts = isService ? slotOptionsForServiceListing(listing) : { required: false, dates: [], times: [], scheduleHuman: "" };
  const [serviceBookingDate, setServiceBookingDate] = useState("");
  const [serviceBookingTime, setServiceBookingTime] = useState("");
  const [serviceBookingDateHint, setServiceBookingDateHint] = useState("");
  const [bookedSlots, setBookedSlots] = useState([]);

  useEffect(() => {
    if (!isService || !listing?.id) {
      setBookedSlots([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await apiRequest(`/listings/${listing.id}/service-booked-slots`, { token });
        const raw = Array.isArray(r?.bookedSlots) ? r.bookedSlots : [];
        const norm = raw
          .map((x) => ({ date: String(x?.date || "").trim(), time: String(x?.time || "").trim() }))
          .filter((x) => x.date && x.time);
        if (!cancelled) setBookedSlots(norm);
      } catch {
        if (!cancelled) setBookedSlots([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isService, listing?.id, token]);

  const bookedKeySet = useMemo(() => {
    const s = new Set();
    for (const b of bookedSlots) s.add(`${b.date}\t${b.time}`);
    return s;
  }, [bookedSlots]);

  const timesForSelectedDate = useMemo(() => {
    if (!slotOpts.required) return slotOpts.times;
    const d = String(serviceBookingDate || "").trim();
    return (slotOpts.times || []).filter((t) => !bookedKeySet.has(`${d}\t${t}`));
  }, [slotOpts.required, slotOpts.times, serviceBookingDate, bookedKeySet]);

  useEffect(() => {
    if (!isService || !slotOpts.required) return;
    if (timesForSelectedDate.length === 0) {
      if (serviceBookingTime) setServiceBookingTime("");
      return;
    }
    if (!timesForSelectedDate.includes(serviceBookingTime)) {
      setServiceBookingTime(timesForSelectedDate[0]);
    }
  }, [isService, slotOpts.required, timesForSelectedDate, serviceBookingTime]);

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
    setServiceBookingDateHint("");
  }, [listing]);

  const place = async () => {
    if (!token) return;
    if (isOutOfStock) {
      onError("This listing is currently out of stock.");
      return;
    }
    if (isService) {
      const err = validateServiceBookingSelection(listing, serviceBookingDate, serviceBookingTime);
      if (err) {
        onError(err);
        return;
      }
      if (slotOpts.required) {
        if (timesForSelectedDate.length === 0) {
          onError("No open times remain on that day — pick another date.");
          return;
        }
        if (!timesForSelectedDate.includes(serviceBookingTime)) {
          onError("That time was just taken — pick another slot.");
          return;
        }
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
      onError(e.message || "Could not place order.");
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
          {slotOpts.scheduleHuman ? (
            <p className="text-[11px] text-neutral-600 dark:text-slate-400">{slotOpts.scheduleHuman}</p>
          ) : null}
          {(() => {
            const bookable = slotOpts.dates || [];
            const bookableSet = new Set(bookable);
            const dateMin = bookable[0] || "";
            const dateMax = bookable.length ? bookable[bookable.length - 1] : "";
            return (
              <div className="grid gap-2 min-[400px]:grid-cols-2">
                <label className="text-[11px] font-medium text-neutral-700 dark:text-slate-300">
                  Date
                  <input
                    type="date"
                    className="input-base mt-1 w-full min-h-[2.5rem] text-sm"
                    value={serviceBookingDate}
                    min={dateMin || undefined}
                    max={dateMax || undefined}
                    onChange={(e) => {
                      const v = String(e.target.value || "").trim();
                      if (!v) {
                        if (dateMin) setServiceBookingDate(dateMin);
                        setServiceBookingDateHint("");
                        return;
                      }
                      if (bookableSet.has(v)) {
                        setServiceBookingDate(v);
                        setServiceBookingDateHint("");
                      } else {
                        setServiceBookingDateHint(
                          "That day is not in this provider’s available weekdays — pick another date.",
                        );
                        setServiceBookingDate(dateMin || v);
                      }
                    }}
                    disabled={submitting}
                  />
                  {serviceBookingDate ? (
                    <span className="mt-0.5 block text-[10px] text-neutral-500 dark:text-slate-500">
                      {formatIsoDateForBookingDisplay(serviceBookingDate)}
                    </span>
                  ) : null}
                  {serviceBookingDateHint ? (
                    <p className="mt-1 text-[10px] text-rose-600 dark:text-rose-400">{serviceBookingDateHint}</p>
                  ) : null}
                </label>
                <label className="text-[11px] font-medium text-neutral-700 dark:text-slate-300">
                  Time
                  <select
                    className="input-base mt-1 w-full text-sm tabular-nums"
                    value={serviceBookingTime}
                    onChange={(e) => setServiceBookingTime(e.target.value)}
                    disabled={submitting || timesForSelectedDate.length === 0}
                  >
                    {timesForSelectedDate.length === 0 ? (
                      <option value="">No open times</option>
                    ) : (
                      timesForSelectedDate.map((t) => (
                        <option key={t} value={t}>
                          {formatTimeHmTo12HourLabel(t)}
                        </option>
                      ))
                    )}
                  </select>
                  {bookedSlots.length > 0 && timesForSelectedDate.length === 0 ? (
                    <p className="mt-1 text-[10px] text-rose-600 dark:text-rose-400">
                      All times on this day are already booked.
                    </p>
                  ) : null}
                </label>
              </div>
            );
          })()}
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
      <button type="button" className="btn-primary" disabled={submitting || isOutOfStock} onClick={place}>
        {submitting ? "Placing order…" : "Place order"}
      </button>
    </div>
  );
}
