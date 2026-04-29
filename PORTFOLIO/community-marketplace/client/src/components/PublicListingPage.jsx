import { useCallback, useEffect, useState } from "react";
import { getApiV1Base } from "../apiBase.js";
import { formatCents } from "../marketplace/money.js";
import { Button, Card } from "./ui/index.js";
import { ScreenEmpty, ScreenError, InlineSuccess, ScreenLoading } from "./ui/ScreenState.jsx";

const API_URL = getApiV1Base();

export function PublicListingPage({ listingId, onBack, onOpenLogin }) {
  const [listing, setListing] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchListing = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/listings/${listingId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Could not load listing.");
      if (data.listing && String(data.listing.id) === String(listingId)) setListing(data.listing);
      else setListing(null);
    } catch (e) {
      setError(e.message || "Could not load listing.");
      setListing(null);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void fetchListing();
  }, [fetchListing]);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-app pl-[max(1.5rem,env(safe-area-inset-left,0px))] pr-[max(1.5rem,env(safe-area-inset-right,0px))] pt-[max(2.5rem,env(safe-area-inset-top,0px))] pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] dark:bg-slate-950">
      <main id="main-content" className="mx-auto w-full max-w-mobile-baseline space-y-6 md:max-w-lg">
        <Button type="button" variant="ghost" className="-ml-2 px-3 text-sm font-medium text-brand-primary hover:underline dark:text-brand-accent" onClick={onBack}>
          ← Back
        </Button>
        {loading ? <ScreenLoading message="Loading listing…" spacious /> : null}
        {!loading && error ? (
          <ScreenError
            title="Couldn’t load this listing"
            message={error}
            onRetry={() => void fetchListing()}
            secondaryAction={{ label: "Go back", onClick: onBack }}
            spacious
          />
        ) : null}
        {!loading && !error && (!listing || String(listing.id) !== String(listingId)) ? (
          <ScreenEmpty
            title="Listing not found"
            description="It may have been removed or the link is incorrect."
            primaryAction={{ label: "Go back", onClick: onBack }}
          />
        ) : null}
        {!loading && !error && listing && String(listing.id) === String(listingId) ? (
          <>
            <InlineSuccess>
              Prices and availability are shown for browsing only — sign in to place an order.
            </InlineSuccess>
            <Card className="space-y-4">
              <h1 className="text-xl font-semibold leading-snug text-neutral-900 dark:text-slate-100">{listing.title}</h1>
              <p className="text-2xl font-bold tabular-nums text-brand-primary">{formatCents(listing.priceCents)}</p>
              {String((Array.isArray(listing.imageUrls) ? listing.imageUrls[0] : listing.imageUrl) || "").trim() ? (
                <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-slate-700 dark:bg-slate-900/60">
                  <img
                    src={String((Array.isArray(listing.imageUrls) ? listing.imageUrls[0] : listing.imageUrl) || "").trim()}
                    alt={listing.title || "Product"}
                    className="h-64 w-full object-cover"
                    decoding="async"
                    sizes="(max-width: 768px) 100vw, min(32rem, 90vw)"
                    fetchPriority="high"
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
              <Button type="button" variant="primary" className="w-full" onClick={onOpenLogin}>
                Log in to order
              </Button>
            </Card>
          </>
        ) : null}
      </main>
    </div>
  );
}
