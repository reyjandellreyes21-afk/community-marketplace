const navItems = [
  { label: "Home", href: "/" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "About us", href: "/about-us" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact Us", href: "/contact-us" },
];

export default function HomeStickyHeader({
  pathname,
  router,
  cartButtonRef,
  cartItems,
  currentUser,
  showNavMenu,
  setShowNavMenu,
  setShowAuthPanel,
  setAuthMode,
  setAuthError,
  setShowSellerDashboardModal,
  logout,
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <a href="#" className="logo text-xl font-semibold tracking-tight text-slate-900">
          cpr/p
        </a>

        <div className="hidden flex-1 items-center justify-end md:flex">
          <div className="flex items-center text-sm text-slate-700">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <a
                  key={item.label}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex items-center gap-1 px-3 py-1 transition-colors duration-500 ease-out after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-teal-500 after:transition-transform after:duration-500 after:ease-out ${
                    isActive
                      ? "font-semibold text-teal-600 after:scale-x-100"
                      : "text-slate-700 hover:text-teal-600"
                  }`}
                >
                  <span>{item.label}</span>
                </a>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <button
            ref={cartButtonRef}
            type="button"
            onClick={() => {
              if (!currentUser) {
                setShowAuthPanel(true);
                setAuthMode("login");
                setAuthError("Please login to access buyer checkout.");
                return;
              }
              setShowSellerDashboardModal(false);
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
          {!currentUser && (
            <button
              type="button"
              onClick={() => {
                setShowAuthPanel(true);
                setAuthMode("login");
              }}
              className="btn-primary px-4 py-2 text-xs"
            >
              Login / Sign up
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setShowNavMenu((prev) => !prev)}
              className="group flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold transition hover:border-teal-300 hover:bg-teal-50"
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
                    <button
                      type="button"
                      onClick={() => {
                        setShowNavMenu(false);
                        router.push("/users");
                      }}
                      className="mt-2 w-full rounded-lg border-t border-slate-200 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      User
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setShowNavMenu(false);
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
                      setShowAuthPanel(true);
                      setAuthMode("login");
                      setShowNavMenu(false);
                    }}
                    className="btn-primary w-full px-3 py-2 text-sm"
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
