/**
 * Absolute URL Supabase should redirect to after "Forgot password" email link.
 * Add this origin + path to Supabase Dashboard → Authentication → URL configuration → Redirect URLs.
 */
export function buildPasswordRecoveryRedirectUrl() {
  if (typeof window === "undefined") return "";
  const base = String(import.meta.env.BASE_URL || "/");
  const normalizedBase = base === "/" ? "" : base.replace(/\/+$/, "");
  return `${window.location.origin}${normalizedBase}/auth/recovery`;
}
