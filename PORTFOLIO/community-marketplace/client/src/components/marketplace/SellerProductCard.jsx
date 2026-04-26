import { useEffect, useState } from "react";
import {
  formatPesoWhole,
  listingCodAvailabilityLabel,
  parseSaleMetaFromDescription,
  removeSaleMetaLines,
  SALE_PERCENT_OPTIONS,
} from "../../lib/listingSaleMeta.js";

export function SellerProductCard({
  listing,
  gridMode,
  compactGrid = false,
  onSaleSelect,
  onEdit,
  onDelete,
  onAdjustQuantity,
  onSetQuantity,
  quantityUpdating = false,
  onView,
}) {
  const [saleOpen, setSaleOpen] = useState(false);
  const [qtyDraft, setQtyDraft] = useState(String(Math.max(0, Number(listing?.quantity) || 0)));
  const normalizedStatus = String(listing.status || "").toLowerCase();
  const statusClass =
    normalizedStatus === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
      : "border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-300";
  const imageUrl = String(listing.imageUrl || "").trim();
  const availabilityLabel = listingCodAvailabilityLabel(listing.fulfillmentModes);
  const saleMeta = parseSaleMetaFromDescription(listing.description);
  const currentPesos = Math.floor((Number(listing.priceCents) || 0) / 100);
  const originalPesos = Number.isFinite(Number(saleMeta.originalPesos)) ? Number(saleMeta.originalPesos) : null;
  const descriptionPreview = removeSaleMetaLines(listing.description);

  useEffect(() => {
    setQtyDraft(String(Math.max(0, Number(listing?.quantity) || 0)));
  }, [listing?.quantity, listing?.id]);

  const pad = gridMode && compactGrid ? "p-2.5" : "p-3.5";
  const imgBox =
    gridMode && compactGrid
      ? "h-28 w-full"
      : gridMode
        ? "h-48 w-full"
        : "h-32 w-32";
  const mainGap = gridMode && compactGrid ? "gap-2" : gridMode ? "gap-2.5" : "gap-3";

  return (
    <li className={`rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/60 ${pad} ${gridMode ? "h-full" : ""}`}>
      <div className={`flex ${gridMode ? `flex-col ${mainGap}` : "flex-row items-start gap-3"}`}>
        <div className={`shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-slate-700 dark:bg-slate-800 ${imgBox}`}>
          {imageUrl ? (
            <img src={imageUrl} alt={listing.title || "Product"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-400">No image</div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-semibold text-neutral-900 dark:text-slate-100">{listing.title || "Untitled product"}</p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-neutral-800 dark:text-slate-200">{formatPesoWhole(listing.priceCents)}</p>
            {originalPesos != null && originalPesos > currentPesos ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-neutral-500 line-through dark:text-slate-400">₱{originalPesos}</span>
                {saleMeta.percent ? (
                  <span className="rounded-full border border-amber-300/90 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                    -{saleMeta.percent}%
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-slate-400">
            <span>
              Quantity: <span className="font-semibold">{Number(listing.quantity) || 0}</span>
            </span>
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                disabled={quantityUpdating || (Number(listing.quantity) || 0) <= 0}
                onClick={() => onAdjustQuantity?.(-1)}
                aria-label="Decrease product quantity"
              >
                -
              </button>
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                disabled={quantityUpdating}
                onClick={() => onAdjustQuantity?.(1)}
                aria-label="Increase product quantity"
              >
                +
              </button>
            </div>
            <div className="inline-flex items-center gap-1">
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className="h-6 w-16 rounded-md border border-neutral-300 bg-white px-1.5 text-[11px] text-neutral-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                value={qtyDraft}
                disabled={quantityUpdating}
                onChange={(e) => {
                  const digits = String(e.target.value || "").replace(/[^\d]/g, "");
                  setQtyDraft(digits);
                }}
                onBlur={() => {
                  if (qtyDraft === "") setQtyDraft("0");
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const parsed = Number(qtyDraft);
                  if (!Number.isFinite(parsed) || parsed < 0) return;
                  onSetQuantity?.(Math.floor(parsed));
                }}
                aria-label="Set product quantity"
              />
              <button
                type="button"
                className="inline-flex h-6 items-center justify-center rounded-md border border-neutral-300 bg-white px-1.5 text-[10px] font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                disabled={quantityUpdating}
                onClick={() => {
                  const parsed = Number(qtyDraft);
                  if (!Number.isFinite(parsed) || parsed < 0) return;
                  onSetQuantity?.(Math.floor(parsed));
                }}
                aria-label="Apply quantity"
              >
                Set
              </button>
            </div>
            {quantityUpdating ? <span className="text-[10px] font-medium text-neutral-500 dark:text-slate-400">Saving…</span> : null}
          </div>
          <p className="text-xs text-neutral-600 dark:text-slate-400">Availability: {availabilityLabel}</p>
          {descriptionPreview ? (
            <p
              className={`text-pretty text-xs leading-relaxed text-neutral-600 dark:text-slate-400 ${gridMode && compactGrid ? "line-clamp-2" : "line-clamp-3"}`}
            >
              {descriptionPreview}
            </p>
          ) : null}
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${statusClass}`}>{normalizedStatus || "unknown"}</span>
        </div>
        <div className={`flex flex-wrap items-center gap-1.5 ${gridMode ? "self-start" : "shrink-0"}`}>
          {onView ? (
            <button
              type="button"
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              title="Read full description"
              onClick={() => onView()}
            >
              View
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-300 dark:hover:bg-amber-950/30"
            onClick={() => setSaleOpen((prev) => !prev)}
          >
            Sale
          </button>
          <button
            type="button"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={onEdit}
          >
            Edit
          </button>
          <button
            type="button"
            className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </div>
      {saleOpen ? (
        <div className="mt-3 overflow-x-auto">
          <div className="flex min-w-max items-center gap-1.5 rounded-xl border border-amber-200/80 bg-amber-50/80 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
            {SALE_PERCENT_OPTIONS.map((percent) => (
              <button
                key={percent}
                type="button"
                className="rounded-md border border-amber-300/90 bg-white px-2 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/50 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-900/30"
                onClick={() => {
                  onSaleSelect(percent);
                  setSaleOpen(false);
                }}
              >
                {percent}%
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}
