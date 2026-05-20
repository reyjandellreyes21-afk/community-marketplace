import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/appApi.js";
import { Button } from "../ui/Button.jsx";

export function orderHasAcceptedCourierAssignment(o) {
  return Boolean(o?.acceptedCourierAssignmentId ?? o?.acceptedBidId);
}

/**
 * Buyer/seller may PATCH `update_courier_contributions` before a courier claims (server mirrors same rules).
 */
export function canAdjustCourierPoolForViewer(o, viewerRole) {
  if (!o || o.fulfillmentType !== "delivery") return false;
  if (orderHasAcceptedCourierAssignment(o)) return false;
  const st = String(o.status || "").toLowerCase();
  if (st === "placed") return viewerRole === "buyer";
  if (st === "seller_accepted") return viewerRole === "buyer" || viewerRole === "seller";
  return false;
}

/**
 * Compact inline editor for courier COD pool share before assignment.
 *
 * @param {{ order: object, viewerRole: 'buyer' | 'seller', token: string, onUpdated?: () => void | Promise<void> }} props
 */
export function OrderCourierPoolAdjust({ order, viewerRole, token, onUpdated }) {
  const buyerCents = Math.max(0, Number(order.buyerCourierContributionCents ?? order.buyer_courier_contribution_cents) || 0);
  const sellerCents = Math.max(0, Number(order.sellerCourierContributionCents ?? order.seller_courier_contribution_cents) || 0);
  const editBuyer = viewerRole === "buyer";
  const baselineCents = editBuyer ? buyerCents : sellerCents;
  const [pesosDraft, setPesosDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    const p = baselineCents / 100;
    setPesosDraft(p === 0 ? "" : String(p));
    setNote("");
  }, [order?.id, baselineCents, editBuyer]);

  const save = async () => {
    if (!token || !order?.id) return;
    const raw = String(pesosDraft || "").trim();
    const pesos = raw === "" ? 0 : Number(raw);
    if (raw !== "" && (!Number.isFinite(pesos) || pesos < 0)) {
      setNote("Enter a valid amount or 0.");
      return;
    }
    const cents = Math.round(Math.max(0, pesos) * 100);
    setSaving(true);
    setNote("");
    try {
      const body = { transition: "update_courier_contributions" };
      if (editBuyer) body.buyerCourierContributionCents = cents;
      else body.sellerCourierContributionCents = cents;
      await apiRequest(`/orders/${encodeURIComponent(String(order.id))}`, {
        method: "PATCH",
        token,
        body,
      });
      if (typeof onUpdated === "function") await onUpdated();
    } catch (e) {
      setNote(e?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const shortLabel =
    editBuyer && String(order.status || "").toLowerCase() === "placed"
      ? "Your share"
      : editBuyer
        ? "Your share"
        : "Seller add-on";

  const fieldId = `order-courier-pool-${String(order.id || "")}-${editBuyer ? "buyer" : "seller"}`;

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <label
        htmlFor={fieldId}
        className="block text-[10px] font-medium leading-snug text-neutral-700 dark:text-slate-300"
      >
        {shortLabel} (₱)
      </label>
      <div className="flex min-h-8 w-full min-w-0 items-stretch overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-950 dark:shadow-none">
        <input
          id={fieldId}
          type="text"
          inputMode="decimal"
          className="min-w-0 flex-1 border-0 bg-transparent px-2 py-1 text-xs text-neutral-900 outline-none placeholder:text-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary/35 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:ring-brand-accent/35"
          placeholder="0"
          value={pesosDraft}
          onChange={(e) => setPesosDraft(e.target.value)}
          disabled={saving}
          autoComplete="off"
        />
        <Button
          type="button"
          variant="secondary"
          size="compact"
          className="min-h-8 shrink-0 rounded-none border-0 border-l border-neutral-200 bg-white px-3 py-1 text-[11px] shadow-none hover:bg-neutral-50 dark:border-slate-600 dark:bg-slate-950 dark:hover:bg-slate-900"
          loading={saving}
          loadingLabel="…"
          onClick={() => void save()}
        >
          Save
        </Button>
      </div>
      {note ? (
        <p className="text-[10px] text-rose-700 dark:text-rose-300" role="alert">
          {note}
        </p>
      ) : null}
    </div>
  );
}
