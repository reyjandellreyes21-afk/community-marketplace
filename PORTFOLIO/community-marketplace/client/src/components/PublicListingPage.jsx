import { useCallback, useEffect, useMemo, useState } from "react";
import { getListingCategoryShortLabel } from "../categoryNav.js";
import { getApiV1Base } from "../apiBase.js";
import { formatCents } from "../marketplace/money.js";
import { Button, Card } from "./ui/index.js";
import { ScreenEmpty, ScreenError, InlineSuccess, ScreenLoading } from "./ui/ScreenState.jsx";
import { ProductListingMedia } from "./media/ProductListingMedia.jsx";
import { PublicListingDetailSkeleton } from "./marketplace/MobileBrowseSkeleton.jsx";
import { ListingProductMetaExtras } from "./marketplace/ListingProductMetaExtras.jsx";

const API_URL = getApiV1Base();

function listingGalleryUrls(listing) {
  if (!listing) return [];
  const seen = new Set();
  const out = [];
  const push = (u) => {
    const s = String(u || "").trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  push(listing.imageUrl);
  if (Array.isArray(listing.imageUrls)) {
    for (const u of listing.imageUrls) push(u);
  }
  return out.slice(0, 12);
}

function PublicListingDetailBody({ listing, publicHeroImageIdx, setPublicHeroImageIdx, onOpenLogin }) {
  const categoryShort = getListingCategoryShortLabel(listing.verticalId, listing.subId);
  const galleryUrls = useMemo(() => listingGalleryUrls(listing), [listing]);
  const heroIdx =
    galleryUrls.length > 0 ? Math.min(publicHeroImageIdx, galleryUrls.length - 1) : 0;
  const heroSrc = galleryUrls[heroIdx] || "";

  return (
    <>
      <InlineSuccess>
        Prices and availability are shown for browsing only — sign in to place an order.
      </InlineSuccess>
      <Card className="space-y-4">
        <h1 className="break-words text-pretty text-xl font-semibold leading-snug text-neutral-900 dark:text-slate-100">
          {listing.title}
        </h1>
        {categoryShort ? (
          <p className="text-sm text-neutral-500 dark:text-slate-400">{categoryShort}</p>
        ) : null}
        <p className="text-2xl font-bold tabular-nums text-brand-primary">{formatCents(listing.priceCents)}</p>
        <ListingProductMetaExtras
          orderType={listing.orderType}
          processingTime={listing.processingTime}
          optionNameA={listing.optionNameA}
          optionValuesA={listing.optionValuesA}
          optionNameB={listing.optionNameB}
          optionValuesB={listing.optionValuesB}
          density="card"
        />
        <div className="space-y-2">
          <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-xl">
            <ProductListingMedia
              listing={listing}
              src={heroSrc}
              variant="grid"
              className="absolute inset-0 min-h-0"
              decoding="async"
              sizes="(max-width: 768px) 100vw, min(32rem, 90vw)"
              loading="eager"
              fetchPriority="high"
            />
          </div>
          {galleryUrls.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5" role="list" aria-label="Product photos">
              {galleryUrls.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  role="listitem"
                  aria-label={`Photo ${i + 1} of ${galleryUrls.length}`}
                  aria-current={i === heroIdx ? "true" : undefined}
                  className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                    i === heroIdx
                      ? "border-brand-primary ring-1 ring-brand-primary/25 dark:border-brand-accent"
                      : "border-transparent opacity-80 hover:opacity-100"
                  }`}
                  onClick={() => setPublicHeroImageIdx(i)}
                >
                  <ProductListingMedia
                    listing={{ title: listing.title, imageUrl: url, imageUrls: [url] }}
                    variant="list"
                    className="absolute inset-0 min-h-0 rounded-lg"
                    sizes="56px"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {listing.cityLabel ? (
          <p className="text-sm text-neutral-600 dark:text-slate-400">{listing.cityLabel}</p>
        ) : null}
        {String(listing.description || "").trim() ? (
          <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-slate-300">{listing.description}</p>
        ) : null}
        <p className="text-xs text-neutral-500 dark:text-slate-400">
          Cash on delivery (COD) or pickup — LinkMart does not hold a wallet. Sign in to place an order.
        </p>
        <Button type="button" variant="primary" className="w-full" onClick={onOpenLogin}>
          Log in to order
        </Button>
      </Card>
    </>
  );
}

export function PublicListingPage({ listingId, onBack, onOpenLogin }) {
  const [listing, setListing] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [publicHeroImageIdx, setPublicHeroImageIdx] = useState(0);

  useEffect(() => {
    setPublicHeroImageIdx(0);
  }, [listingId]);

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
        {loading ? (
          <>
            <div className="md:hidden">
              <PublicListingDetailSkeleton />
            </div>
            <div className="hidden md:block">
              <ScreenLoading message="Loading listing…" spacious />
            </div>
          </>
        ) : null}
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
          <PublicListingDetailBody
            listing={listing}
            publicHeroImageIdx={publicHeroImageIdx}
            setPublicHeroImageIdx={setPublicHeroImageIdx}
            onOpenLogin={onOpenLogin}
          />
        ) : null}
      </main>
    </div>
  );
}
