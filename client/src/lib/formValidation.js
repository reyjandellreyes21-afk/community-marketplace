/** Client-side messages for inline mobile-friendly validation (pair with `FormField` / `aria-live`). */

export function validateEmail(value) {
  const s = String(value || "").trim();
  if (!s) return "Enter your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "Enter a valid email address using an @ sign and domain.";
  return "";
}

/**
 * @param {string} password
 * @param {{ signup?: boolean }} [opts] signup requires min 8 chars
 */
export function validatePasswordClient(password, { signup = false } = {}) {
  const s = String(password || "");
  if (!s) return signup ? "Enter a password (at least 8 characters)." : "Enter your password.";
  if (signup && s.length < 8) return "Use at least 8 characters.";
  return "";
}

export function validateConfirmPassword(password, confirm) {
  if (String(password || "") !== String(confirm || "")) return "Passwords must match.";
  return "";
}
