import { useEffect, useState } from "react";
import { getApiV1Base } from "../apiBase.js";
import { formatCents } from "../marketplace/money.js";

const API_URL = getApiV1Base();

export function PublicListingPage({ listingId, onBack, onOpenLogin }) {
  const [listing, setListing] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError("");
      try {
        const res = await fetch(`${API_URL}/listings/${listingId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error?.message || "Could not load listing.");
        if (!cancelled && data.listing && String(data.listing.id) === String(listingId)) setListing(data.listing);
      } catch (e) {
        if (!cancelled) setError(e.message || "Could not load listing.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  return (
    <div className="min-h-screen bg-app px-6 py-10 dark:bg-slate-950">
      <div className="mx-auto max-w-lg space-y-6">
        <button type="button" className="text-sm font-medium text-brand-primary hover:underline" onClick={onBack}>
          ← Back
        </button>
        {error ? <p className="app-alert-error text-sm">{error}</p> : null}
        {listing && String(listing.id) === String(listingId) ? (
          <div className="app-card space-y-4">
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">{listing.title}</h1>
            <p className="text-2xl font-bold text-brand-primary">{formatCents(listing.priceCents)}</p>
            {String((Array.isArray(listing.imageUrls) ? listing.imageUrls[0] : listing.imageUrl) || "").trim() ? (
              <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-slate-700 dark:bg-slate-900/60">
                <img
                  src={String((Array.isArray(listing.imageUrls) ? listing.imageUrls[0] : listing.imageUrl) || "").trim()}
                  alt={listing.title || "Product"}
                  className="h-64 w-full object-cover"
                />
              </div>
            ) : null}
            {listing.cityLabel ? (
              <p className="text-sm text-neutral-600 dark:text-slate-400">{listing.cityLabel}</p>
            ) : null}
            <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-slate-300">{listing.description || "No description."}</p>
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              Cash on delivery (COD) or pickup — LinkMart does not hold a wallet. Sign in to place an order.
            </p>
            <button type="button" className="btn-primary w-full" onClick={onOpenLogin}>
              Log in to order
            </button>
          </div>
        ) : !error ? (
          <p className="text-sm text-neutral-600 dark:text-slate-400">Loading…</p>
        ) : null}
      </div>
    </div>
  );
}
