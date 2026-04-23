"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import SiteHeader from "@/components/SiteHeader";
import HomeProductPlaceholder from "@/components/home/HomeProductPlaceholder";
import { withoutLegacyDemoProducts } from "@/data/seedMarketplace";
import { loadPersistedState } from "@/lib/cprMarketplaceStorage";

const EMPTY_GRID_SLOTS = 4;

function ProductCard({ product }) {
  const router = useRouter();

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3">
      <div
        className={`relative h-32 overflow-hidden rounded-xl ${
          product.imageDataUrl ? "bg-slate-100" : `bg-gradient-to-r ${product.imageClass}`
        }`}
      >
        {product.imageDataUrl ? (
          <img src={product.imageDataUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
        {product.isPromo && (
          <span className="absolute left-2 top-2 rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">
            Promo
          </span>
        )}
      </div>
      <h3 className="mt-3 line-clamp-2 text-[22px] font-semibold leading-tight text-slate-900">
        {product.name}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{product.subtitle}</p>
      <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
        <span className="text-amber-400">★</span>
        <span>{product.rating}</span>
        <span>•</span>
        <span>{product.distance}</span>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <p className="text-base font-semibold text-slate-900">
          {"\u20B1"}
          {product.price}
        </p>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {product.category}
        </span>
      </div>
      <button
        type="button"
        onClick={() => router.push("/")}
        className="mt-3 rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-100"
      >
        Add to Cart
      </button>
    </article>
  );
}

export default function MarketplacePage() {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (!isClient) return;
    const sync = () => {
      const stored = loadPersistedState()?.products;
      const list = Array.isArray(stored) ? stored : [];
      setProducts(withoutLegacyDemoProducts(list));
    };
    sync();
    window.addEventListener("cpr-marketplace-state-changed", sync);
    return () => window.removeEventListener("cpr-marketplace-state-changed", sync);
  }, [isClient]);

  const activeProducts = useMemo(
    () => products.filter((product) => product.isActive),
    [products]
  );
  const offers = useMemo(
    () => activeProducts.filter((product) => product.isPromo),
    [activeProducts]
  );

  if (!isClient) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader activePage="marketplace" />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-12 md:px-10">
        <section>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">Offers</h1>
            <p className="text-sm text-slate-500">{offers.length} promo items</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {offers.length === 0
              ? Array.from({ length: EMPTY_GRID_SLOTS }, (_, i) => <HomeProductPlaceholder key={`offer-ph-${i}`} />)
              : offers.map((product) => <ProductCard key={`offer-${product.id}`} product={product} />)}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">All products</h2>
            <p className="text-sm text-slate-500">{activeProducts.length} items</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {activeProducts.length === 0
              ? Array.from({ length: EMPTY_GRID_SLOTS }, (_, i) => (
                  <HomeProductPlaceholder key={`all-ph-${i}`} />
                ))
              : activeProducts.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>
      </main>
    </div>
  );
}
