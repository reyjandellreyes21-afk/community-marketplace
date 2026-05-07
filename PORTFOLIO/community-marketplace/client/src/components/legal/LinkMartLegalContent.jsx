/**
 * Shared copy for About and Terms & conditions (landing auth links + logged-in app views).
 */
export function AboutLinkMartBody() {
  return (
    <div className="space-y-5 max-[360px]:space-y-4 max-[390px]:space-y-4 max-[430px]:space-y-4 md:flex-1 md:space-y-6">
      <p className="text-sm font-medium leading-snug text-neutral-800 max-[360px]:text-[13px] max-[390px]:text-[15px] md:text-base dark:text-slate-200">
        The neighborhood marketplace—browse what&apos;s in stock, message, and buy—without living inside a spammy group chat.
      </p>
      <p className="text-sm leading-relaxed text-neutral-600 max-[360px]:text-[13px] max-[360px]:leading-snug max-[390px]:text-[15px] md:text-base dark:text-slate-300">
        LinkMart is for{" "}
        <span className="text-neutral-800 dark:text-slate-200">small businesses and online sellers in your geographic neighborhood</span>—so everyone can see
        what&apos;s actually available near them, without digging through endless chat.
      </p>
      <p className="text-sm leading-relaxed text-neutral-600 max-[360px]:text-[13px] max-[360px]:leading-snug max-[390px]:text-[15px] md:text-base dark:text-slate-300">
        A lot of selling still happens in group chats: sellers post again and again, buyers scroll the whole conversation to find something, and it&apos;s hard to
        know if a product is still in stock. That costs time and energy on both sides.
      </p>
      <p className="text-sm leading-relaxed text-neutral-600 max-[360px]:text-[13px] max-[360px]:leading-snug max-[390px]:text-[15px] md:text-base dark:text-slate-300">
        This app is <span className="text-neutral-800 dark:text-slate-200">for your community only</span>—not city-wide “everything apps” like generic marketplaces
        or giant delivery platforms. It brings browsing, messaging, buying, selling, and deliveries into{" "}
        <span className="text-neutral-800 dark:text-slate-200">one place</span>, with local trust and transparency, so people can feel safer doing business with
        neighbors.
      </p>
      <p className="text-sm leading-relaxed text-neutral-600 max-[360px]:text-[13px] max-[360px]:leading-snug max-[390px]:text-[15px] md:text-base dark:text-slate-300">
        Set up your profile first—then the flow is natural: browse, message, buy; list and sell; deliver when needed. Communities can shape their own space; if
        yours is far away, you can build your own instead of being lost in a huge, impersonal feed.
      </p>
      <div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">Mission</h3>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600 max-[360px]:text-[13px] max-[390px]:text-[15px] md:text-base dark:text-slate-300">
          We exist to help small businesses and online sellers inside a geographic community—so neighbors always know what&apos;s available and can trade with less
          chaos and more clarity, using one shared home instead of noisy chat spam.
        </p>
      </div>
      <div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">Vision</h3>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600 max-[360px]:text-[13px] max-[390px]:text-[15px] md:text-base dark:text-slate-300">
          Life gets more convenient when each community has its own trusted marketplace: people create and stay within their own scope—and when someone is far
          away, they can start their own instead of relying on a region-wide ordering app.
        </p>
      </div>
      <div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">What makes this different</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-600 max-[360px]:text-[13px] max-[390px]:text-[15px] md:text-base marker:text-neutral-400 dark:text-slate-300 dark:marker:text-slate-500">
          <li>
            <span className="font-medium text-neutral-800 dark:text-slate-200">Local trust</span> — neighbors and sellers you can recognize.
          </li>
          <li>
            <span className="font-medium text-neutral-800 dark:text-slate-200">Multi-role in one place</span> — buy, sell, and coordinate delivery without juggling
            five apps.
          </li>
          <li>
            <span className="font-medium text-neutral-800 dark:text-slate-200">Transparency</span> — a clearer picture of what&apos;s listed and available than
            scrolling a messenger thread.
          </li>
          <li>
            <span className="font-medium text-neutral-800 dark:text-slate-200">Community scope</span> — we&apos;re not trying to be a whole-city ordering giant;
            we&apos;re built for the community.
          </li>
        </ul>
      </div>
      <div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">Trust &amp; sign-in</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-600 max-[360px]:text-[13px] max-[390px]:text-[15px] md:text-base marker:text-neutral-400 dark:text-slate-300 dark:marker:text-slate-500">
          <li>Sign in with Google keeps accounts simple.</li>
          <li>Belonging matters—this marketplace is meant for people who genuinely live and trade in that community.</li>
        </ul>
      </div>
      <div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">Payments &amp; delivery</h3>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600 max-[360px]:text-[13px] max-[390px]:text-[15px] md:text-base dark:text-slate-300">
          Commerce is cash on delivery or cash at pickup—we don&apos;t run an in-app wallet. Delivery can be fulfilled by neighbors; fees are agreed directly between
          parties. Sellers stay organized with stock and orders in one hub.
        </p>
      </div>
      <p className="text-sm leading-relaxed text-neutral-600 max-[360px]:text-[13px] max-[360px]:leading-snug max-[390px]:text-[15px] md:text-base dark:text-slate-300">
        For support or partnerships, use the contact options on the public landing page.
      </p>
    </div>
  );
}

/** Paragraphs only — wrap with a section heading when embedded in Terms. */
export function DataPrivacyActBody() {
  return (
    <div className="space-y-4">
      <p className="mt-1 text-neutral-600 dark:text-slate-300">
        We value your privacy and are committed to protecting your personal information. By using this marketplace, you agree that your data may be collected and used
        for account verification, order processing, communication, security, and platform improvement.
      </p>
      <p className="text-neutral-600 dark:text-slate-300">We do not sell your personal information to third parties.</p>
      <p className="text-neutral-600 dark:text-slate-300">
        Users are responsible for protecting their own account credentials and personal information.
      </p>
      <p className="text-neutral-600 dark:text-slate-300">
        This platform follows the principles of the <span className="text-neutral-800 dark:text-slate-200">Data Privacy Act of 2012</span>.
      </p>
    </div>
  );
}

/**
 * @param {{ termsSection?: number }} props
 */
export function ProhibitedProductsBody({ termsSection } = {}) {
  const title =
    typeof termsSection === "number" ? `${termsSection}. Prohibited & illegal products` : "Prohibited & illegal products";
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 text-neutral-600 dark:text-slate-300">
        This marketplace does not tolerate illegal, harmful, or prohibited products.
      </p>
      <p className="font-medium text-neutral-800 dark:text-slate-200">The following are strictly prohibited:</p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 marker:text-neutral-400 dark:marker:text-slate-500">
        <li className="text-neutral-600 dark:text-slate-300">Illegal drugs and controlled substances</li>
        <li className="text-neutral-600 dark:text-slate-300">Stolen items</li>
        <li className="text-neutral-600 dark:text-slate-300">Weapons and dangerous materials</li>
        <li className="text-neutral-600 dark:text-slate-300">Counterfeit or fake products</li>
        <li className="text-neutral-600 dark:text-slate-300">Fraudulent services</li>
        <li className="text-neutral-600 dark:text-slate-300">Any product that violates local laws</li>
      </ul>
    </div>
  );
}

/**
 * @param {{ termsSection?: number }} props
 */
export function BewareOfScammersBody({ termsSection } = {}) {
  const title = typeof termsSection === "number" ? `${termsSection}. Beware of scammers` : "Beware of scammers";
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 font-medium text-neutral-800 dark:text-slate-200">Stay alert and transact responsibly.</p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 marker:text-neutral-400 dark:marker:text-slate-500">
        <li className="text-neutral-600 dark:text-slate-300">Never send payments outside the platform</li>
        <li className="text-neutral-600 dark:text-slate-300">Avoid dealing with suspicious or unverified users</li>
        <li className="text-neutral-600 dark:text-slate-300">Do not trust fake payment screenshots</li>
        <li className="text-neutral-600 dark:text-slate-300">Meet in safe public locations when possible</li>
        <li className="text-neutral-600 dark:text-slate-300">Report suspicious activity immediately</li>
      </ul>
    </div>
  );
}

export function TermsLinkMartBody() {
  return (
    <div className="space-y-6 text-sm leading-relaxed text-neutral-700 max-[360px]:space-y-5 max-[390px]:space-y-5 max-[430px]:space-y-5 md:flex-1 md:space-y-6 dark:text-slate-300">
      <p className="text-xs text-neutral-500 dark:text-slate-400">
        This is a plain-language outline, not legal advice. Have counsel review before production launch.
      </p>
      <div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">1. Community marketplace</h3>
        <p className="mt-1 text-neutral-600 dark:text-slate-300">
          LinkMart is built for <span className="text-neutral-800 dark:text-slate-200">geographic communities</span>—neighbors, small sellers, and local buyers—not as
          a generic whole-city “everything” marketplace. You use listings, messaging, buying, and selling in that community context; the platform helps coordinate
          information and orders but does not replace how you and other members agree to trade.
        </p>
      </div>
      <div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">2. No wallet; COD</h3>
        <p className="mt-1 text-neutral-600 dark:text-slate-300">
          LinkMart does not hold buyer or seller funds. Payment for goods and any agreed delivery fee is settled directly between parties (typically cash on delivery
          or at pickup). You are responsible for confirming payment at handoff.
        </p>
      </div>
      <div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">3. Pickup and delivery</h3>
        <p className="mt-1 text-neutral-600 dark:text-slate-300">
          Listings may offer pickup, delivery, or both. Delivery fees and handoff details are agreed between buyers and sellers (or couriers); the platform
          coordinates information and does not guarantee delivery times or service quality.
        </p>
      </div>
      <div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">4. Couriers</h3>
        <p className="mt-1 text-neutral-600 dark:text-slate-300">
          Neighbor or courier deliveries arranged through the app are fulfilled by independent users, not by LinkMart as a carrier, unless separately contracted.
          Couriers must follow local laws and safe handoff practices.
        </p>
      </div>
      <div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">5. Disputes</h3>
        <p className="mt-1 text-neutral-600 dark:text-slate-300">
          Because the platform does not hold funds, disputes over quality, non-payment, or failed delivery should first be resolved between users. LinkMart may offer
          reporting tools but does not arbitrate cash transactions.
        </p>
      </div>
      <div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">6. Accounts</h3>
        <p className="mt-1 text-neutral-600 dark:text-slate-300">
          You may sign in with email and password or with Google. You agree to provide accurate profile information and to comply with these rules when using messaging,
          listings, orders, and delivery features.
        </p>
      </div>
      <div id="linkmart-privacy-policy" className="scroll-mt-4">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">7. Data Privacy Act</h3>
        <DataPrivacyActBody />
      </div>
      <ProhibitedProductsBody termsSection={8} />
      <BewareOfScammersBody termsSection={9} />
    </div>
  );
}
