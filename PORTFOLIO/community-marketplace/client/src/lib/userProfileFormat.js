/** Title-case each word: "rey jandell b reyes" → "Rey Jandell B Reyes". */
export const formatDisplayName = (name) => {
  if (!name || typeof name !== "string") return "";
  return name
    .trim()
    .split(/\s+/)
    .map((segment) => {
      if (!segment) return "";
      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
    })
    .filter(Boolean)
    .join(" ");
};

/** Prefer structured name fields from the API; fall back to legacy `name` string. */
export const getDisplayNameFromUser = (user) => {
  if (!user || typeof user !== "object") return "";
  const parts = [user.firstName, user.middleName, user.lastName].map((s) => String(s ?? "").trim()).filter(Boolean);
  if (parts.length > 0) return formatDisplayName(parts.join(" "));
  return formatDisplayName(user.name || "");
};

/** Up to two letters for avatar fallback when no image URL (match lists / headers). */
export function getAvatarInitialsFromUser(user) {
  const dn =
    getDisplayNameFromUser(user) ||
    String(user?.name || "").trim() ||
    String(user?.username || "").trim() ||
    "?";
  const parts = dn.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase().slice(0, 2);
  }
  const one = parts[0] || "?";
  return one.slice(0, 2).toUpperCase();
}

/** Read-only profile card: first + middle initial + last; edit form still uses full middle name. */
export const getProfileCardDisplayNameFromUser = (user) => {
  if (!user || typeof user !== "object") return "";
  const first = String(user.firstName ?? "").trim();
  const middle = String(user.middleName ?? "").trim();
  const last = String(user.lastName ?? "").trim();
  if (first || middle || last) {
    const segments = [];
    if (first) segments.push(formatDisplayName(first));
    if (middle) segments.push(`${middle.charAt(0).toUpperCase()}.`);
    if (last) segments.push(formatDisplayName(last));
    return segments.join(" ");
  }
  return formatDisplayName(user.name || "");
};

export const PROFILE_GENDER_OPTIONS = [
  ["female", "Female"],
  ["male", "Male"],
  ["non_binary", "Non-binary"],
  ["other", "Other"],
  ["prefer_not_to_say", "Prefer not to say"],
];

export function formatBirthdayDisplay(iso) {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return iso;
  try {
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function computeAgeFromBirthday(iso) {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return "";
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return "";
  const birthDate = new Date(year, month - 1, day);
  if (Number.isNaN(birthDate.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - year;
  const hasBirthdayPassedThisYear =
    today.getMonth() > month - 1 || (today.getMonth() === month - 1 && today.getDate() >= day);
  if (!hasBirthdayPassedThisYear) age -= 1;
  if (age < 0 || age > 120) return "";
  return age;
}

export function formatGenderDisplay(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  const found = PROFILE_GENDER_OPTIONS.find(([k]) => k === v);
  return found ? found[1] : v;
}
