import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiRequest } from "../../lib/appApi.js";
import { formatCents } from "../../marketplace/money.js";
import { Button } from "../ui/Button.jsx";
import { canAdjustCourierPoolForViewer } from "./OrderCourierPoolAdjust.jsx";

function parsePesosDraftToCents(pesosDraft) {
  const raw = String(pesosDraft ?? "").trim();
  if (raw === "") return { ok: true, cents: 0 };
  const pesos = Number(raw);
  if (!Number.isFinite(pesos) || pesos < 0) return { ok: false, cents: null };
  return { ok: true, cents: Math.round(Math.max(0, pesos) * 100) };
}

/**
 * Before POST /orders/:id/courier/assign — review delivery tip pool; Confirm saves share (PATCH);
 * Suggest sends the invitation only.
 *
 * @param {{
 *   open: boolean,
 *   courier: { id?: string, displayName?: string, username?: string } | null,
 *   order: object | null,
 *   viewerRole: 'buyer' | 'seller',
 *   token: string,
 *   orderId: string,
 *   onClose: () => void,
 *   onSuggest: () => void | Promise<void>,
 *   onPoolUpdated?: () => void | Promise<void>,
 * }} props
 */
export function SuggestCourierConfirmModal({
  open,
  courier,
  order,
  viewerRole,
  token,
  orderId,
  onClose,
  onSuggest,
  onPoolUpdated,
}) {
  const titleId = useId();
  const fieldId = useId();
  const buyerCents = Math.max(0, Number(order?.buyerCourierContributionCents ?? order?.buyer_courier_contribution_cents) || 0);
  const sellerCents = Math.max(0, Number(order?.sellerCourierContributionCents ?? order?.seller_courier_contribution_cents) || 0);
  const totalCents = buyerCents + sellerCents;
  const editBuyer = viewerRole === "buyer";
  const baselineCents = editBuyer ? buyerCents : sellerCents;
  const [pesosDraft, setPesosDraft] = useState("");
  const [savingTip, setSavingTip] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [note, setNote] = useState("");

  const canAdjust = Boolean(order && canAdjustCourierPoolForViewer(order, viewerRole));

  const tipDirty = useMemo(() => {
    if (!canAdjust) return false;
    const parsed = parsePesosDraftToCents(pesosDraft);
    if (!parsed.ok) return true;
    return parsed.cents !== baselineCents;
  }, [canAdjust, pesosDraft, baselineCents]);

  useEffect(() => {
    if (!open || !order) return undefined;
    const p = baselineCents / 100;
    setPesosDraft(p === 0 ? "" : String(p));
    setNote("");
    return undefined;
  }, [open, order?.id, baselineCents, editBuyer]);

  useEffect(() => {
    if (!open) return undefined;
    const active = document.activeElement;
    if (active && typeof active.blur === "function" && active instanceof HTMLElement) active.blur();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const shortLabel =
    editBuyer && String(order?.status || "").toLowerCase() === "placed" ? "Your tip share" : editBuyer ? "Your tip share" : "Seller add-on";

  const handleConfirmTip = async () => {
    if (!token || !orderId || !order) return;
    setSavingTip(true);
    setNote("");
    try {
      const raw = String(pesosDraft || "").trim();
      const pesos = raw === "" ? 0 : Number(raw);
      if (raw !== "" && (!Number.isFinite(pesos) || pesos < 0)) {
        setNote("Enter a valid amount or 0.");
        return;
      }
      const cents = Math.round(Math.max(0, pesos) * 100);
      const body = { transition: "update_courier_contributions" };
      if (editBuyer) body.buyerCourierContributionCents = cents;
      else body.sellerCourierContributionCents = cents;
      await apiRequest(`/orders/${encodeURIComponent(String(orderId))}`, {
        method: "PATCH",
        token,
        body,
      });
      if (typeof onPoolUpdated === "function") await onPoolUpdated();
    } catch (e) {
      setNote(e?.message || "Could not save tip share.");
    } finally {
      setSavingTip(false);
    }
  };

  const handleSuggest = async () => {
    if (!courier?.id || tipDirty) return;
    setSuggesting(true);
    setNote("");
    try {
      await onSuggest();
    } catch (e) {
      setNote(e?.message || "Could not send suggestion.");
    } finally {
      setSuggesting(false);
    }
  };

  const busy = savingTip || suggesting;

  if (!open || !courier) return null;

  const name = String(courier.displayName || courier.username || "Courier").trim() || "Courier";

  const modal = (
    <div className="fixed inset-0 z-[126] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm dark:bg-slate-950/70"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] flex max-h-[min(88dvh,560px)] w-full max-w-md flex-col rounded-t-2xl border border-neutral-200/90 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900 sm:rounded-2xl"
      >
        <div className="shrink-0 border-b border-neutral-100 px-4 py-3 dark:border-slate-700">
          <p id={titleId} className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
            Suggest this courier?
          </p>
          <p className="mt-1 text-xs text-neutral-600 dark:text-slate-400">
            <span className="font-medium text-neutral-800 dark:text-slate-200">{name}</span> will get an invitation to deliver. Confirm saves your
            tip share; Suggest sends the invitation (cash at handoff).
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/80 px-3 py-2.5 dark:border-slate-600/70 dark:bg-slate-800/50">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-500">Delivery tip pool</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-900 dark:text-slate-100">{formatCents(totalCents)} total</p>
            <p className="mt-1 text-[11px] text-neutral-600 dark:text-slate-400">
              {formatCents(buyerCents)} buyer · {formatCents(sellerCents)} seller · cash at handoff, not in-app
            </p>
          </div>

          {canAdjust ? (
            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor={fieldId} className="block text-[11px] font-medium text-neutral-700 dark:text-slate-300">
                Adjust {shortLabel.toLowerCase()} (₱, optional)
              </label>
              <div className="flex min-h-10 w-full min-w-0 items-stretch overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-950 dark:shadow-none">
                <input
                  id={fieldId}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  disabled={busy}
                  className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary/35 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:ring-brand-accent/35"
                  placeholder="0"
                  value={pesosDraft}
                  onChange={(e) => setPesosDraft(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  className="min-h-10 shrink-0 rounded-none border-0 border-l border-neutral-200 bg-white px-4 py-2 text-xs shadow-none hover:bg-neutral-50 dark:border-slate-600 dark:bg-slate-950 dark:hover:bg-slate-900"
                  loading={savingTip}
                  loadingLabel="…"
                  disabled={busy && !savingTip}
                  onClick={() => void handleConfirmTip()}
                >
                  Confirm
                </Button>
              </div>
              <p className="text-[10px] leading-snug text-neutral-500 dark:text-slate-500">
                Confirm saves your share on the order. Suggest sends the invitation — confirm first if you changed the amount.
              </p>
              {tipDirty ? (
                <p className="text-[10px] text-amber-700 dark:text-amber-300">Save your tip share with Confirm before suggesting.</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-neutral-500 dark:text-slate-500">
              Tip shares can no longer be edited for this order state — you can still send the invitation with the amounts above.
            </p>
          )}

          {note ? (
            <p className="mt-3 text-[11px] text-red-600 dark:text-red-400" role="alert">
              {note}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-neutral-100 px-4 py-3 dark:border-slate-700">
          <Button type="button" variant="secondary" className="min-h-11 flex-1" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            className="min-h-11 flex-1"
            loading={suggesting}
            loadingLabel="…"
            disabled={busy && !suggesting || (canAdjust && tipDirty)}
            onClick={() => void handleSuggest()}
          >
            Suggest
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}
