/**
 * Human-readable label for Storage path folders (avatar, listings, etc.).
 * @param {Record<string, unknown> | null | undefined} profile — `profiles` row
 * @param {Record<string, unknown> | null | undefined} authUser — Supabase Auth user (optional)
 * @returns {string}
 */
export function displayNameForStoragePath(profile, authUser) {
  if (profile) {
    const parts = [profile.first_name, profile.middle_name, profile.last_name]
      .map((p) => String(p || "").trim())
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
    const u = String(profile.username || "").trim();
    if (u) return u;
  }
  if (authUser) {
    const m = authUser.user_metadata || {};
    const metaParts = [m.first_name, m.middle_name, m.last_name]
      .map((p) => String(p || "").trim())
      .filter(Boolean);
    if (metaParts.length) return metaParts.join(" ");
    if (String(m.username || "").trim()) return String(m.username).trim();
    const email = String(authUser.email || "").trim();
    if (email.includes("@")) return email.split("@")[0];
  }
  return "";
}
