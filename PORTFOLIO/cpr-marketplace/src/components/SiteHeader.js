"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const loadPersistedState = () => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("cpr-marketplace-state-v1");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export default function SiteHeader({ activePage = "home" }) {
  const router = useRouter();
  const persistedState = useMemo(() => loadPersistedState(), []);
  const users = persistedState?.users ?? [];
  const cart = persistedState?.cart ?? [];
  const currentUserId = persistedState?.currentUserId ?? null;
  const [showNavMenu, setShowNavMenu] = useState(false);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) || null,
    [users, currentUserId]
  );
  const cartItems = useMemo(() => {
    if (!currentUser) return [];
    return cart.filter((item) => item.buyerId === currentUser.id);
  }, [cart, currentUser]);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link href="/" className="logo text-xl font-extrabold tracking-tight text-slate-900">
          cpr/p
        </Link>

        <nav className="hidden flex-1 items-center justify-end md:flex">
          <div className="flex items-center text-sm text-slate-700">
            <Link
              href="/"
              aria-current={activePage === "home" ? "page" : undefined}
              className={`relative px-3 py-1 transition-colors duration-500 ease-out after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-teal-500 after:transition-transform after:duration-500 after:ease-out ${
                activePage === "home"
                  ? "font-semibold text-teal-600 after:scale-x-100"
                  : "text-slate-700 hover:text-teal-600"
              }`}
            >
              Home
            </Link>
            <Link
              href="/marketplace"
              aria-current={activePage === "marketplace" ? "page" : undefined}
              className={`relative px-3 py-1 transition-colors duration-500 ease-out after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-teal-500 after:transition-transform after:duration-500 after:ease-out ${
                activePage === "marketplace"
                  ? "font-semibold text-teal-600 after:scale-x-100"
                  : "text-slate-700 hover:text-teal-600"
              }`}
            >
              Marketplace
            </Link>
            <Link
              href="/about-us"
              aria-current={activePage === "about-us" ? "page" : undefined}
              className={`relative px-3 py-1 transition-colors duration-500 ease-out after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-teal-500 after:transition-transform after:duration-500 after:ease-out ${
                activePage === "about-us"
                  ? "font-semibold text-teal-600 after:scale-x-100"
                  : "text-slate-700 hover:text-teal-600"
              }`}
            >
              About us
            </Link>
            <Link
              href="/faq"
              aria-current={activePage === "faq" ? "page" : undefined}
              className={`relative px-3 py-1 transition-colors duration-500 ease-out after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-teal-500 after:transition-transform after:duration-500 after:ease-out ${
                activePage === "faq"
                  ? "font-semibold text-teal-600 after:scale-x-100"
                  : "text-slate-700 hover:text-teal-600"
              }`}
            >
              FAQ
            </Link>
            <Link
              href="/contact-us"
              aria-current={activePage === "contact-us" ? "page" : undefined}
              className={`relative px-3 py-1 transition-colors duration-500 ease-out after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-teal-500 after:transition-transform after:duration-500 after:ease-out ${
                activePage === "contact-us"
                  ? "font-semibold text-teal-600 after:scale-x-100"
                  : "text-slate-700 hover:text-teal-600"
              }`}
            >
              Contact Us
            </Link>
          </div>
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                router.push("/");
                return;
              }
              window.dispatchEvent(new CustomEvent("cpr-open-checkout"));
            }}
            aria-label="Buyer checkout"
            className="relative rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            🛒
            {cartItems.length > 0 && (
              <span className="absolute -right-1 -top-1 rounded-full bg-teal-600 px-1.5 text-[10px] font-bold text-white">
                {cartItems.length}
              </span>
            )}
          </button>
          <div className="relative">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setShowNavMenu((prev) => !prev)}
              className="group flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold transition hover:border-teal-400 hover:bg-teal-50"
            >
              <span className="text-sm font-bold leading-none text-slate-700 transition group-hover:text-teal-600">
                ☰
              </span>
            </button>
            {showNavMenu && (
              <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                {currentUser ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNavMenu(false);
                        router.push("/seller-dashboard");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg border-b border-slate-200 pb-2 text-left transition hover:bg-slate-100"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-sm font-semibold text-slate-600">
                        {currentUser.name?.charAt(0).toUpperCase() || "U"}
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Account</p>
                        <p className="text-sm font-semibold text-slate-800">{currentUser.name}</p>
                      </div>
                    </button>
                    <Link
                      href="/users"
                      onClick={() => setShowNavMenu(false)}
                      className="mt-2 block w-full rounded-lg border-t border-slate-200 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      User
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = {
                          ...(loadPersistedState() ?? {}),
                          currentUserId: null,
                        };
                        localStorage.setItem("cpr-marketplace-state-v1", JSON.stringify(nextState));
                        setShowNavMenu(false);
                        router.push("/");
                      }}
                      className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Log-out
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNavMenu(false);
                      router.push("/");
                    }}
                    className="w-full rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500"
                  >
                    Login / Sign up
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
