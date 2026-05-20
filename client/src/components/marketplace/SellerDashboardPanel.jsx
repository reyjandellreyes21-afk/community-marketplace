import React, { useState } from "react";
import { formatCents } from "../../marketplace/money.js";

const PRESET_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
  { id: "custom", label: "Custom" },
];

function MetricCard({ label, value, tone = "neutral" }) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "danger"
        ? "text-rose-700 dark:text-rose-300"
        : "text-neutral-900 dark:text-slate-100";
  return (
    <article className="min-w-0 rounded-xl border border-neutral-200/80 bg-white p-2.5 shadow-sm max-[430px]:p-2 md:p-3 dark:border-slate-600 dark:bg-slate-900/70">
      <p className="text-[10px] font-medium uppercase leading-tight tracking-wide text-neutral-500 max-[430px]:text-[9px] md:text-xs dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-1 break-words text-base font-semibold tabular-nums max-[430px]:text-sm md:text-xl ${toneClass}`}>{value}</p>
    </article>
  );
}

export function SellerDashboardPanel({
  dashboard,
  loading,
  error,
  preset,
  onPresetChange,
  customRange,
  onCustomRangeChange,
  ledgerDraft,
  onLedgerDraftChange,
  onSubmitLedger,
  submitting,
}) {
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);

  const closeLedgerModal = () => setLedgerModalOpen(false);

  const handleLedgerFormSubmit = async (ev) => {
    const ok = await onSubmitLedger(ev);
    if (ok) setLedgerModalOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Dashboard date range">
          {PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onPresetChange(opt.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                preset === opt.id
                  ? "border-brand-primary bg-brand-primary/10 text-brand-primary dark:border-brand-accent dark:bg-brand-accent/20 dark:text-brand-accent"
                  : "border-neutral-200 text-neutral-700 hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-primary hidden shrink-0 text-sm md:inline-flex md:w-auto"
          onClick={() => setLedgerModalOpen(true)}
        >
          Add external/manual entry
        </button>
      </div>

      {preset === "custom" ? (
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-neutral-600 dark:text-slate-400">Start date</span>
            <input
              type="date"
              value={customRange.startDate}
              onChange={(e) => onCustomRangeChange("startDate", e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-neutral-600 dark:text-slate-400">End date</span>
            <input
              type="date"
              value={customRange.endDate}
              onChange={(e) => onCustomRangeChange("endDate", e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            />
          </label>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
      {loading ? <p className="text-sm text-neutral-500 dark:text-slate-400">Loading dashboard…</p> : null}

      {dashboard ? (
        <>
          <div className="grid grid-cols-1 gap-2 max-[430px]:grid-cols-2 max-[430px]:gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-4">
            <MetricCard label="Total income" value={formatCents(dashboard.revenueCents || 0)} tone="positive" />
            <MetricCard label="Total expense" value={formatCents(dashboard.expenseCents || 0)} tone="danger" />
            <MetricCard label="Net profit" value={formatCents(dashboard.profitCents || 0)} tone="neutral" />
            <MetricCard label="Completed sales" value={String(dashboard.completedOrders || 0)} />
            <MetricCard label="Total items" value={String(dashboard.totalItems || 0)} />
            <MetricCard label="Stock units" value={String(dashboard.totalStockUnits || 0)} />
            <MetricCard label="Low stock items" value={String(dashboard.lowStockItems || 0)} />
            <MetricCard label="Out of stock" value={String(dashboard.outOfStockItems || 0)} />
          </div>
          <p className="text-[11px] leading-snug text-neutral-500 max-[430px]:text-[10px] md:text-xs dark:text-slate-400">
            In-app income: {formatCents(dashboard.inAppRevenueCents || 0)} · Manual income: {formatCents(dashboard.manualIncomeCents || 0)} ·
            In-app expense: {formatCents(dashboard.inAppExpenseCents || 0)} · Manual expense: {formatCents(dashboard.manualExpenseCents || 0)}
          </p>
        </>
      ) : null}

      <button
        type="button"
        className="btn-primary w-full shrink-0 text-sm md:hidden"
        onClick={() => setLedgerModalOpen(true)}
      >
        Add external/manual entry
      </button>

      {ledgerModalOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 md:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-neutral-900/45 backdrop-blur-[2px] dark:bg-black/55"
            aria-label="Close dialog"
            onClick={closeLedgerModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="seller-ledger-modal-title"
            className="relative z-10 w-full max-w-md rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.22)] dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="seller-ledger-modal-title" className="text-lg font-semibold text-neutral-900 dark:text-slate-100">
              Add external/manual entry
            </h2>
            <form className="mt-4 space-y-3" onSubmit={handleLedgerFormSubmit}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-neutral-600 dark:text-slate-400">Type</span>
                  <select
                    value={ledgerDraft.entryType}
                    onChange={(e) => onLedgerDraftChange("entryType", e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                  >
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                    <option value="stock_in">Stock in</option>
                    <option value="stock_out">Stock out</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-neutral-600 dark:text-slate-400">Occurred date</span>
                  <input
                    type="date"
                    value={ledgerDraft.occurredAt}
                    onChange={(e) => onLedgerDraftChange("occurredAt", e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-neutral-600 dark:text-slate-400">Amount (PHP)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ledgerDraft.amountPesos}
                    onChange={(e) => onLedgerDraftChange("amountPesos", e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-neutral-600 dark:text-slate-400">Quantity</span>
                  <input
                    type="number"
                    value={ledgerDraft.quantityDelta}
                    onChange={(e) => onLedgerDraftChange("quantityDelta", e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-neutral-600 dark:text-slate-400">Item/category label</span>
                  <input
                    type="text"
                    maxLength={200}
                    value={ledgerDraft.itemName}
                    onChange={(e) => onLedgerDraftChange("itemName", e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                  />
                </label>
              </div>
              <div className="flex flex-col-reverse gap-2 pt-1 md:flex-row md:justify-end">
                <button type="button" className="btn-secondary text-sm" onClick={closeLedgerModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-sm" disabled={submitting}>
                  {submitting ? "Saving…" : "Add entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
