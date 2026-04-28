/** @type {import('tailwindcss').Config} */
/**
 * Responsive policy: mobile-first — unprefixed utilities target phones; `md:` / `lg:` add desktop behavior.
 * Avoid `max-md:` / `max-lg:` (desktop-first). Validate at 360 / 390 / 430; shell baseline `max-w-mobile-baseline` (390px). No `sm:` tier.
 */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      maxWidth: {
        /** Primary mobile shell width — design at 390px; scales down on 360, centers on 430+ */
        "mobile-baseline": "390px",
      },
      colors: {
        primary: "#1FA6A6",
        "primary-hover": "#178585",
        "primary-soft": "#E8F6F6",
        background: "#F9FAFB",
        surface: "#FFFFFF",
        "text-primary": "#1F2A37",
        "text-secondary": "#6B7280",
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
        "text-muted": "#64748b",
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
