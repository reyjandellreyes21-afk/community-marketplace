/** @type {import('tailwindcss').Config} */
/**
 * MAIN MOBILE-FIRST RULE (mobile view only for base styles):
 * — Mobile tokens / patterns: `MOBILE_DESIGN_SYSTEM` + flat `MOBILE_UI` in `src/utils/mobile/ui.js`.
 * — Design mobile first; tune at 360 / 390 / 430. Logged-in shell is fluid (`max-w-none`); `max-w-mobile-baseline` = 100% of parent (use `md:`/`lg:` for fixed columns).
 * — Sanity-check at 360px (narrow) and 430px (wide phone).
 * — Do not build desktop-first layouts. Add tablet/desktop only via `md:` / `lg:` (progressive enhancement).
 * — Avoid `max-md:` / `max-lg:` (desktop-first). No `sm:` tier.
 */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    /** Mobile-first: no `sm` breakpoint — unprefixed utilities are mobile; enhance from `md` up only. */
    screens: {
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      maxWidth: {
        /** Full-bleed within the mobile shell — do not cap at 390px (parent provides safe padding) */
        "mobile-baseline": "100%",
      },
      colors: {
        primary: "#1FA6A6",
        "primary-hover": "#178585",
        "primary-soft": "#E8F6F6",
        background: "#F9FAFB",
        surface: "#FFFFFF",
        "text-primary": "#1F2A37",
        /** ≥4.5:1 on white — WCAG AA body text (mobile + desktop) */
        "text-secondary": "#4B5563",
        border: "#E5E7EB",
        danger: "#EF4444",
        "danger-hover": "#DC2626",
        accent: "#F43F5E",
        "accent-hover": "#E11D48",
        success: "#22C55E",
        warning: "#F59E0B",
        app: "#F9FAFB",
        elevated: "#E5E7EB",
        "border-default": "#E5E7EB",
        "text-muted": "#475569",
        "brand-primary": "#1FA6A6",
        "brand-hover": "#178585",
        "brand-accent": "#1FA6A6",
        "brand-soft": "#E8F6F6",
        "brand-muted": "#D7EEEE",
        "brand-border": "#CBE6E6",
        "dark-bg": "#081523",
        "dark-surface": "#0f2234",
        "dark-elevated": "#11283d",
        "dark-border": "#1f3c56",
        "dark-text": "#e9f7ff",
        "dark-text-muted": "#9fc3d9",
        info: "#52525B",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
}
