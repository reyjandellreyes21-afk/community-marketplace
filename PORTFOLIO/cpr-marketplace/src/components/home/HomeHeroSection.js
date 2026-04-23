export default function HomeHeroSection({
  currentUser,
  canSell,
  canBuy,
  enableRole,
  setShowAuthPanel,
  setAuthMode,
}) {
  return (
    <section className="surface-card p-8 md:p-12">
      <p className="mb-4 inline-block rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium uppercase tracking-widest text-teal-700">
        Community Marketplace
      </p>
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl">
        Empowering Homeowners to Offer Products and Services Locally.
      </h1>
      <p className="mt-4 max-w-2xl text-base text-slate-600 md:text-lg">
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
                className="btn-secondary px-5 py-3 text-sm"
              >
                Become a Seller
              </button>
            )}
            {!canBuy && (
              <button
                type="button"
                onClick={() => enableRole("buyer")}
                className="btn-secondary px-5 py-3 text-sm"
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
              className="btn-primary px-5 py-3 text-sm"
            >
              Login to Buy
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAuthPanel(true);
                setAuthMode("register");
              }}
              className="btn-secondary px-5 py-3 text-sm"
            >
              Create Seller Account
            </button>
          </>
        )}
      </div>
    </section>
  );
}
