import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/appApi.js";

export function OrderPlacementForm({ listing, token, onDone, onError }) {
  const modes = listing?.fulfillmentModes?.length ? listing.fulfillmentModes : ["pickup"];
  const [fulfillmentType, setFulfillmentType] = useState(() => (modes.includes("pickup") ? "pickup" : modes[0]));
  /** Whole pesos — converted to centavos for `buyerCourierContributionCents` on delivery. */
  const [buyerCourierPesos, setBuyerCourierPesos] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isOutOfStock = Math.max(0, Number(listing?.quantity) || 0) <= 0;

  useEffect(() => {
    const m = listing?.fulfillmentModes?.length ? listing.fulfillmentModes : ["pickup"];
    setFulfillmentType(m.includes("pickup") ? "pickup" : m[0]);
  }, [listing?.id, listing?.fulfillmentModes]);

  const place = async () => {
    if (!token) return;
    if (isOutOfStock) {
      onError("This listing is currently out of stock.");
      return;
    }
    setSubmitting(true);
    try {
      const desiredQty = 1;
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
      const pesosRaw = String(buyerCourierPesos || "").trim();
      const pesos = pesosRaw === "" ? 0 : Number(pesosRaw);
      const buyerCourierContributionCents =
        fulfillmentType === "delivery" && Number.isFinite(pesos) && pesos >= 0 ? Math.round(pesos * 100) : 0;
      if (fulfillmentType === "delivery" && pesosRaw !== "" && !Number.isFinite(pesos)) {
        onError("Enter a valid number for your courier share (pesos), or leave it blank.");
        return;
      }
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
