import navLogo from "../../assets/new-brand-logo.png";
import communityImage from "../../assets/community-image.png";

export function LandingIllustration() {
  return (
    <div className="relative w-full overflow-hidden rounded-[1.75rem] border border-neutral-200/80 bg-gradient-to-br from-white to-violet-50/60 shadow-[0_18px_45px_-28px_rgba(67,56,202,0.45)] dark:border-slate-700 dark:from-slate-900 dark:to-slate-800/80">
      <div className="aspect-[16/10] w-full">
        <img
          src={communityImage}
          alt="Local community marketplace"
          className="h-full w-full object-cover object-[74%_center]"
        />
      </div>
    </div>
  );
}

export function LinkMartLogo({ className = "h-8 w-auto max-w-[12rem] shrink-0 object-contain sm:h-9 sm:max-w-[13.5rem]" }) {
  return <img src={navLogo} alt="LinkMart logo" className={className} />;
}

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

export function LandingSiteFooter() {
  const accent = "text-teal-400 shrink-0";
  return (
    <footer className="landing-site-footer w-full" role="contentinfo">
      <svg className="block h-11 w-full shrink-0" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden>
        <path fill="#2d3748" d="M0 48V16Q720 0 1440 16V48H0z" />
      </svg>
      <div className="-mt-px bg-[#2d3748] px-6 pb-8 pt-0 sm:px-8 lg:px-12">
        <div className="app-container mx-auto grid max-w-7xl grid-cols-1 gap-12 pb-14 md:grid-cols-2 md:gap-10 lg:grid-cols-3 lg:gap-8 lg:pb-16">
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
          <div className="text-left">
            <h2 className="text-base font-bold tracking-tight text-white">Key stats</h2>
            <dl className="mt-4 flex flex-col gap-6">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-white/55">Active listings</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">8k+</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-white/55">Local sellers</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">1.2k+</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-white/55">Covered communities</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">50+</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="app-container mx-auto max-w-7xl border-t border-white/15 pt-10">
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col items-center gap-1 lg:items-start">
              <LinkMartLogo className="h-9 w-auto max-w-[12rem] shrink-0 object-contain brightness-0 invert sm:h-10 sm:max-w-[13rem]" />
              <p className="text-xs font-medium tracking-wide text-white/55">Local marketplace for every community</p>
            </div>
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/85" aria-label="Legal">
              <a href="#">Privacy Policy</a>
              <a href="#">Copyright</a>
              <a href="#">Terms of Service</a>
            </nav>
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <a href="#" className="landing-footer-social" aria-label="Facebook">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a href="#" className="landing-footer-social" aria-label="X / Twitter">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="#" className="landing-footer-social" aria-label="Instagram">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a href="#" className="landing-footer-social" aria-label="YouTube">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
