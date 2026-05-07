import { LandingArtworkCard } from "./LandingArtworkCard.jsx";

const TEAL = "#1FA6A6";
const TEAL_SOFT = "#5FC4C4";
const VIOLET = "#6366F1";
const MUTED = "#94A3B8";
const MUTED_DARK = "#64748B";

/** Abstract “app + local trust” graphic for the features band — distinct from the hero photo/illustration. */
function LandingFeaturesGraphic() {
  return (
    <svg
      className="h-full w-full max-h-full max-w-full"
      viewBox="0 0 640 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="lf-bg" x1="80" y1="0" x2="520" y2="400" gradientUnits="userSpaceOnUse">
          <stop stopColor={TEAL} stopOpacity="0.08" />
          <stop offset="0.45" stopColor={VIOLET} stopOpacity="0.06" />
          <stop offset="1" stopColor={TEAL} stopOpacity="0.03" />
        </linearGradient>
        <linearGradient id="lf-phone" x1="280" y1="60" x2="420" y2="360" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAFC" />
          <stop offset="1" stopColor="#EEF2FF" />
        </linearGradient>
        <filter id="lf-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" floodOpacity="0.12" />
        </filter>
      </defs>
      <rect width="640" height="400" rx="24" fill="url(#lf-bg)" />

      {/* Decorative nodes — neighborhood / network hint */}
      <circle cx="96" cy="88" r="6" fill={TEAL} opacity="0.35" />
      <circle cx="132" cy="124" r="4" fill={VIOLET} opacity="0.4" />
      <circle cx="548" cy="96" r="5" fill={TEAL_SOFT} opacity="0.45" />
      <path
        d="M108 100C148 120 180 116 220 132"
        stroke={MUTED}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="6 8"
        opacity="0.45"
      />

      {/* Chat — buyer/seller nearby */}
      <g filter="url(#lf-soft)">
        <rect x="72" y="168" width="148" height="92" rx="16" fill="white" stroke={MUTED} strokeOpacity="0.35" strokeWidth="1.5" />
        <rect x="92" y="188" width="88" height="10" rx="4" fill={MUTED} opacity="0.35" />
        <rect x="92" y="208" width="64" height="10" rx="4" fill={MUTED} opacity="0.22" />
        <circle cx="108" cy="232" r="14" fill={TEAL} opacity="0.9" />
        <path
          d="M104 232l3 3 6-6"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Location pin */}
      <g transform="translate(480 200)">
        <path
          d="M0-36c14 0 24 11 24 24 0 18-24 44-24 44S-24 6-24-12c0-13 10-24 24-24z"
          fill="white"
          stroke={TEAL}
          strokeWidth="2"
          filter="url(#lf-soft)"
        />
        <circle cy="-12" r="8" fill={TEAL} opacity="0.25" />
        <circle cy="-12" r="4" fill={TEAL} />
      </g>

      {/* Phone + listing rows */}
      <g filter="url(#lf-soft)">
        <rect x="232" y="48" width="196" height="304" rx="28" fill="url(#lf-phone)" stroke={MUTED_DARK} strokeOpacity="0.25" strokeWidth="2" />
        <rect x="256" y="72" width="148" height="22" rx="8" fill={TEAL} opacity="0.15" />
        <rect x="268" y="78" width="56" height="10" rx="3" fill={TEAL} opacity="0.65" />

        {/* Listing cards */}
        <rect x="248" y="112" width="164" height="56" rx="12" fill="white" stroke={MUTED} strokeOpacity="0.3" />
        <rect x="260" y="124" width="40" height="32" rx="6" fill={TEAL} opacity="0.2" />
        <rect x="312" y="128" width="88" height="8" rx="3" fill={MUTED} opacity="0.35" />
        <rect x="312" y="144" width="56" height="8" rx="3" fill={MUTED} opacity="0.2" />

        <rect x="248" y="182" width="164" height="56" rx="12" fill="white" stroke={MUTED} strokeOpacity="0.3" />
        <rect x="260" y="194" width="40" height="32" rx="6" fill={VIOLET} opacity="0.18" />
        <rect x="312" y="198" width="72" height="8" rx="3" fill={MUTED} opacity="0.35" />
        <rect x="312" y="214" width="48" height="8" rx="3" fill={MUTED} opacity="0.2" />

        <rect x="248" y="252" width="164" height="56" rx="12" fill="white" stroke={MUTED} strokeOpacity="0.3" />
        <rect x="260" y="264" width="40" height="32" rx="6" fill={TEAL_SOFT} opacity="0.25" />
        <rect x="312" y="268" width="96" height="8" rx="3" fill={MUTED} opacity="0.35" />
        <rect x="312" y="284" width="40" height="8" rx="3" fill={MUTED} opacity="0.2" />

        {/* COD / fulfillment strip (wordless — full label is in `alt` on the card) */}
        <rect x="248" y="322" width="164" height="18" rx="9" fill={TEAL} opacity="0.88" />
        <circle cx="272" cy="331" r="3" fill="white" opacity="0.95" />
        <rect x="284" y="328" width="112" height="6" rx="3" fill="white" opacity="0.35" />
      </g>
    </svg>
  );
}

export function LandingFeaturesIllustration() {
  return (
    <LandingArtworkCard
      alt="Stylized phone showing local listings, neighbor chat, pickup location, and cash on delivery"
      aspectClassName="aspect-[16/10]"
      className="w-full max-w-xs md:max-w-sm lg:max-w-none lg:max-w-[min(100%,28rem)]"
    >
      <LandingFeaturesGraphic />
    </LandingArtworkCard>
  );
}
