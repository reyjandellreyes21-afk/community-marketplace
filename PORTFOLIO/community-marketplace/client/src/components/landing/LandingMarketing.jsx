import { LinkMartLogo } from "../media/LinkMartLogo.jsx";

export { LandingIllustration } from "./LandingIllustration.jsx";
export { LinkMartLogo };

export function EyeShowPasswordIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeHidePasswordIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 01-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

export function ChevronDownIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ChevronLeftIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function ChevronRightIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function LandingFooterIconMail(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <path d="M22 6l-10 7L2 6" />
    </svg>
  );
}

function LandingFooterIconMapPin(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function LandingSiteFooter({
  onOpenAbout,
  onOpenTerms,
  onOpenPrivacy,
  onOpenDataPrivacyAct,
  onOpenScammers,
  onOpenProhibited,
  /** Formatted counts from GET /public-stats (same display rules as logged-out hero). */
  statsListingsDisplay = "—",
  statsSellersDisplay = "—",
  statsCommunitiesDisplay = "—",
}) {
  const accent = "text-teal-400 shrink-0";
  const legalBtn =
    "cursor-pointer border-0 bg-transparent p-0 text-left font-inherit text-inherit underline-offset-2 hover:underline";
  return (
    <footer className="landing-site-footer w-full" role="contentinfo">
      <svg className="block h-11 w-full shrink-0" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden>
        <path fill="#2d3748" d="M0 48V16Q720 0 1440 16V48H0z" />
      </svg>
      <div className="-mt-px bg-[#2d3748] px-6 pb-8 pt-0 md:px-8 lg:px-12">
        <div className="app-container mx-auto grid grid-cols-1 gap-12 pb-14 md:grid-cols-2 md:gap-10 lg:grid-cols-3 lg:gap-8 lg:pb-16">
          <div className="text-left">
            <h2 className="text-base font-bold tracking-tight text-white">Why LinkMart</h2>
            <p className="mt-4 text-sm leading-relaxed text-white/85">
              LinkMart is built for local communities where neighbors can buy and sell with people they trust.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/85">
              Discover nearby listings, support local sellers, and complete faster transactions inside your subdivision, barangay, or compound.
            </p>
          </div>
          <div className="text-left">
            <h2 className="text-base font-bold tracking-tight text-white">Contact</h2>
            <ul className="mt-4 flex flex-col gap-4 text-sm">
              <li className="flex gap-3">
                <LandingFooterIconMail className={`${accent} mt-0.5`} />
                <a href="mailto:reyjandellreyes21@gmail.com">reyjandellreyes21@gmail.com</a>
              </li>
              <li className="flex gap-3">
                <LandingFooterIconMapPin className={`${accent} mt-0.5 self-start`} />
                <span className="text-white/90">
                  CPR, Calamba City,
                  <br />
                  Laguna, Philippines
                </span>
              </li>
            </ul>
          </div>
          <div className="text-left md:col-span-2 lg:col-span-1">
            <h2 className="text-base font-bold tracking-tight text-white">Key stats</h2>
            <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-8 lg:gap-x-12" aria-label="Marketplace totals">
              <div className="min-w-0 text-left">
                <dt className="sr-only">Active listings</dt>
                <dd className="m-0">
                  <span className="block text-2xl font-semibold tracking-tight tabular-nums text-white md:text-3xl">
                    {statsListingsDisplay}
                  </span>
                  <span className="mt-1 block text-sm font-normal text-white/55">Active listings</span>
                </dd>
              </div>
              <div className="min-w-0 text-left">
                <dt className="sr-only">Local sellers</dt>
                <dd className="m-0">
                  <span className="block text-2xl font-semibold tracking-tight tabular-nums text-white md:text-3xl">
                    {statsSellersDisplay}
                  </span>
                  <span className="mt-1 block text-sm font-normal text-white/55">Local sellers</span>
                </dd>
              </div>
              <div className="min-w-0 text-left">
                <dt className="sr-only">Covered communities</dt>
                <dd className="m-0">
                  <span className="block text-2xl font-semibold tracking-tight tabular-nums text-white md:text-3xl">
                    {statsCommunitiesDisplay}
                  </span>
                  <span className="mt-1 block text-sm font-normal text-white/55">Covered communities</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="app-container mx-auto border-t border-white/15 pt-10">
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col items-center gap-1 lg:items-start">
              <LinkMartLogo className="h-9 w-auto max-w-[12rem] shrink-0 object-contain brightness-0 invert md:h-10 md:max-w-[13rem]" />
              <p className="text-xs font-medium tracking-wide text-white/55">Local marketplace for every community</p>
            </div>
            <nav className="flex max-w-full flex-col items-center gap-3 text-sm text-white/85 lg:items-end" aria-label="Legal">
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
                {onOpenPrivacy ? (
                  <button type="button" className={legalBtn} onClick={onOpenPrivacy}>
                    Privacy Policy
                  </button>
                ) : (
                  <a href="#">Privacy Policy</a>
                )}
                {onOpenDataPrivacyAct ? (
                  <button type="button" className={legalBtn} onClick={onOpenDataPrivacyAct}>
                    Data Privacy Act
                  </button>
                ) : null}
                {onOpenScammers ? (
                  <button type="button" className={legalBtn} onClick={onOpenScammers}>
                    Beware of scammers
                  </button>
                ) : null}
                {onOpenProhibited ? (
                  <button type="button" className={legalBtn} onClick={onOpenProhibited}>
                    Prohibited products
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
                {onOpenTerms ? (
                  <button type="button" className={legalBtn} onClick={onOpenTerms}>
                    Terms & conditions
                  </button>
                ) : (
                  <a href="#">Terms & conditions</a>
                )}
                {onOpenAbout ? (
                  <button type="button" className={legalBtn} onClick={onOpenAbout}>
                    About
                  </button>
                ) : null}
              </div>
              <p className="text-center text-xs text-white/45 lg:text-right">
                © {new Date().getFullYear()} LinkMart. All rights reserved.
              </p>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
