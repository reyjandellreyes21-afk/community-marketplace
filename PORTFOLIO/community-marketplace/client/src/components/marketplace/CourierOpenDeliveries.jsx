import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../lib/appApi.js";
import { Button } from "../ui/Button.jsx";
import { formatCents } from "../../marketplace/money.js";

/**
 * Lists delivery orders open in the member's community (GET /delivery/open).
 */
export function CourierOpenDeliveries({ token, communityId, courierStatus, onClaimed }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState(null);
  const [error, setError] = useState("");

  const eligible = courierStatus === "available" || courierStatus === "active";

  const load = useCallback(async () => {
    if (!token || !communityId || !eligible) {
      setOrders([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const d = await apiRequest("/delivery/open", { token });
      setOrders(Array.isArray(d?.orders) ? d.orders : []);
    } catch (e) {
      setOrders([]);
      setError(e?.message || "Could not load open deliveries.");
    } finally {
      setLoading(false);
    }
  }, [token, communityId, eligible]);

  useEffect(() => {
    void load();
  }, [load]);

  const claim = async (orderId) => {
    if (!token || !orderId) return;
    setClaimingId(orderId);
    try {
      await apiRequest(`/orders/${encodeURIComponent(orderId)}/courier/claim`, { method: "POST", token });
      await load();
      if (typeof onClaimed === "function") await onClaimed();
    } catch (e) {
      setError(e?.message || "Could not claim delivery.");
    } finally {
      setClaimingId(null);
    }
  };

  if (!token || !communityId) return null;
  if (!eligible) {
    return (
      <p className="mt-2 text-[11px] text-neutral-600 dark:text-slate-400">
        Set your courier status to Available or Active to see open delivery requests in your community.
      </p>
    );
  }

  return (
    <div className="mt-4 border-t border-neutral-200/80 pt-4 dark:border-slate-600/80">
      <h4 className="text-xs font-semibold text-neutral-900 dark:text-slate-100">Open deliveries</h4>
      <p className="mt-1 text-[11px] text-neutral-600 dark:text-slate-400">
        First to accept gets the run — agree pickup details in chat with the seller.
      </p>
      {error ? (
        <p className="mt-2 text-[11px] text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="mt-2 text-[11px] text-neutral-500">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="mt-2 text-[11px] text-neutral-600 dark:text-slate-400">No open delivery orders in your community right now.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {orders.map((o) => (
            <li
              key={String(o.id)}
              className="flex flex-col gap-2 rounded-lg border border-neutral-200/80 bg-white/70 px-3 py-2 dark:border-slate-600/70 dark:bg-slate-900/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-neutral-900 dark:text-slate-100">
                  {o.listingTitle || "Order"}
                </p>
                <p className="text-[11px] text-neutral-600 dark:text-slate-400">
                  Goods {formatCents(o.codGoodsCents || 0)}
                  {o.codDeliveryCents ? ` · Delivery fee ${formatCents(o.codDeliveryCents)}` : ""} · COD
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                className="min-h-10 w-full shrink-0 px-3 text-xs sm:w-auto"
                loading={claimingId === o.id}
                loadingLabel="…"
                disabled={Boolean(claimingId)}
                onClick={() => claim(o.id)}
              >
                Accept delivery
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
