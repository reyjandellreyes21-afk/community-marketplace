"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import SiteHeader from "@/components/SiteHeader";
import {
  getSellerLikeCount,
  hasViewerLikedSeller,
  registerSellerLike,
  unregisterSellerLike,
} from "@/lib/sellerLikes";
import { loadPersistedState, persistMarketplaceState } from "@/lib/cprMarketplaceStorage";

export default function PublicSellerProfilePage() {
  const params = useParams();
  const sellerId = params?.sellerId;
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    const onChanged = () => refresh();
    window.addEventListener("cpr-marketplace-state-changed", onChanged);
    return () => window.removeEventListener("cpr-marketplace-state-changed", onChanged);
  }, [refresh]);

  const snapshot = useMemo(() => loadPersistedState(), [tick]);

  const users = snapshot?.users ?? [];
  const currentUserId = snapshot?.currentUserId ?? null;

  const seller = useMemo(
    () => (typeof sellerId === "string" ? users.find((u) => u.id === sellerId) : null),
    [users, sellerId]
  );

  const sellerAddress = (seller?.address ?? "").trim() || "Not set yet";
  const sellerContactNo = (seller?.contactNo ?? seller?.phone ?? "").trim() || "Not set yet";
  const sellerAvatar = seller?.profileImage?.trim() || "";
  const likeCount = getSellerLikeCount(seller);
  const hasLiked = hasViewerLikedSeller(seller, currentUserId);
  const isOwnProfile = Boolean(currentUserId && sellerId && currentUserId === sellerId);

  const handleLike = () => {
    if (!seller || typeof sellerId !== "string") return;
    if (!currentUserId) {
      window.dispatchEvent(
        new CustomEvent("cpr-require-auth", {
          detail: { message: "Login to like this seller." },
        })
      );
      return;
    }
    if (isOwnProfile) return;

    const nextUsers = hasLiked
      ? unregisterSellerLike(users, sellerId, currentUserId)
      : registerSellerLike(users, sellerId, currentUserId);
    persistMarketplaceState({ users: nextUsers });
    refresh();
    window.dispatchEvent(
      new CustomEvent("cpr-notice", {
        detail: {
          message: hasLiked ? "Like removed." : "Thanks — your like was saved.",
        },
      })
    );
  };

  if (!isClient) {
    return <div className="min-h-screen bg-white" />;
  }

  if (!sellerId || typeof sellerId !== "string") {
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader activePage="" />
        <main className="mx-auto max-w-xl px-6 py-12 text-center">
          <p className="text-slate-600">Invalid profile link.</p>
          <Link href="/" className="mt-4 inline-block text-teal-600 hover:underline">
            Back to home
          </Link>
        </main>
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader activePage="" />
        <main className="mx-auto max-w-xl px-6 py-12 text-center">
          <p className="text-slate-600">Seller not found.</p>
          <Link href="/" className="mt-4 inline-block text-teal-600 hover:underline">
            Back to home
          </Link>
        </main>
      </div>
    );
  }

  const likeDisabledOnlyOwn = isOwnProfile;
  const likeTitle = !currentUserId
    ? "Login to like this seller"
    : isOwnProfile
      ? "You cannot like your own profile here"
      : hasLiked
        ? "Unlike this seller"
        : "Like this seller";

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader activePage="" />
      <main className="mx-auto w-full max-w-2xl px-6 py-8 md:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="text-sm font-semibold text-teal-700 hover:text-teal-600 hover:underline"
          >
            ← Back to marketplace
          </Link>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
            <div className="flex shrink-0 flex-col items-center gap-3 sm:items-start">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-2xl font-semibold text-slate-600">
                {sellerAvatar ? (
                  <img src={sellerAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span aria-hidden>{seller.name?.charAt(0).toUpperCase() || "U"}</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleLike}
                disabled={likeDisabledOnlyOwn}
                title={likeTitle}
                aria-label={likeTitle}
                aria-pressed={hasLiked}
                className={`inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-full border px-4 text-lg transition-colors ${
                  hasLiked
                    ? "cursor-pointer border-teal-600 bg-teal-600 text-white shadow-sm hover:bg-teal-700"
                    : likeDisabledOnlyOwn
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                <span aria-hidden>♥</span>
              </button>
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-left text-sm text-slate-600">
              <span className="font-semibold text-slate-900">Name:</span>
              <span className="break-words">{seller.name}</span>
              <span className="font-semibold text-slate-900">Address:</span>
              <span className="break-words">{sellerAddress}</span>
              <span className="font-semibold text-slate-900">Contact no:</span>
              <span className="break-words">{sellerContactNo}</span>
              <span className="font-semibold text-slate-900">Likes:</span>
              <span className="tabular-nums">{likeCount}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
