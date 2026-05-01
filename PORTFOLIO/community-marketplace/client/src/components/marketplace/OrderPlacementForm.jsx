import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/appApi.js";

export function OrderPlacementForm({ listing, token, onDone, onError }) {
  const modes = listing?.fulfillmentModes?.length ? listing.fulfillmentModes : ["pickup"];
  const [fulfillmentType, setFulfillmentType] = useState(() => (modes.includes("pickup") ? "pickup" : modes[0]));
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
      const created = await apiRequest("/orders", {
        method: "POST",
        token,
        body: { listingId: listing.id, fulfillmentType, quantity: desiredQty },
      });
      const createdOrderId = String(created?.order?.id || "");
      onDone("Order placed. Pay COD at pickup or when delivery is completed.", createdOrderId);
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
      <button type="button" className="btn-primary" disabled={submitting || isOutOfStock} onClick={place}>
        {submitting ? "Placing order…" : "Place order"}
      </button>
    </div>
  );
}
