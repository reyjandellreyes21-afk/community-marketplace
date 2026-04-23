export default function HomeHeroSection({
  currentUser,
  canSell,
  canBuy,
  enableRole,
  setShowAuthPanel,
  setAuthMode,
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-teal-50 to-blue-50 p-8 md:p-12">
      <p className="mb-3 inline-block rounded-full border border-teal-300/50 bg-teal-100 px-3 py-1 text-xs font-medium uppercase tracking-widest text-teal-700">
        Community Marketplace
      </p>
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">
        Empowering Homeowners to Offer Products and Services Locally.
      </h1>
      <p className="mt-4 max-w-2xl text-base text-slate-700 md:text-lg">
        Connect trusted neighbors, support local sellers, and discover everyday products and reliable services in one
        community-driven platform.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {currentUser ? (
          <>
            {!canSell && (
              <button
                type="button"
                onClick={() => enableRole("seller")}
                className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
              >
                Become a Seller
              </button>
            )}
            {!canBuy && (
              <button
                type="button"
                onClick={() => enableRole("buyer")}
                className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
              >
                Enable Buyer Mode
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setShowAuthPanel(true);
                setAuthMode("login");
              }}
              className="rounded-full bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-500"
            >
              Login to Buy
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAuthPanel(true);
                setAuthMode("register");
              }}
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
            >
              Create Seller Account
            </button>
          </>
        )}
      </div>
    </section>
  );
}
