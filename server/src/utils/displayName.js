import { normalizeSubscriptionTier } from "./subscriptionTier.js";

/** Full display string from structured name + username fallback. */
export function displayNameFromDocument(doc) {
  if (!doc) return "";
  const fn = typeof doc.firstName === "string" ? doc.firstName.trim() : "";
  const mn = typeof doc.middleName === "string" ? doc.middleName.trim() : "";
  const ln = typeof doc.lastName === "string" ? doc.lastName.trim() : "";
  const fromParts = [fn, mn, ln].filter(Boolean).join(" ");
  if (fromParts) return fromParts;
  return typeof doc.username === "string" ? doc.username.trim() : "";
}

function birthdayToIsoDate(d) {
  if (!d) return "";
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  return x.toISOString().slice(0, 10);
}

/** Align with profiles.courier_status + marketplace presence (`offline` | `available` | `active` | `busy`). */
function normalizeCourierStatusForClient(raw) {
  const s = String(raw ?? "offline").trim().toLowerCase();
  const ALLOWED = new Set(["offline", "available", "active", "busy"]);
  return ALLOWED.has(s) ? s : "offline";
}

export function userToClient(doc) {
  const o = doc?.toObject ? doc.toObject() : doc;
  if (!o) return null;
  const id = o.id?.toString?.() ?? o.id ?? o._id?.toString?.() ?? o._id;
  const rawCommunityId = o.communityId ?? o.community_id;
  const communityId =
    rawCommunityId != null && String(rawCommunityId).trim() !== "" ? String(rawCommunityId).trim() : "";
  return {
    id,
    firstName: o.firstName ?? "",
    middleName: o.middleName ?? "",
    lastName: o.lastName ?? "",
    name: displayNameFromDocument(o),
    email: o.email,
    joinedAt: o.joinedAt ?? o.createdAt ?? o.created_at ?? null,
    username: o.username ?? "",
    country: o.country ?? "",
    age: o.age ?? null,
    acceptedTerms: Boolean(o.acceptedTerms),
    avatarUrl: o.avatarUrl || "",
    phone: o.phone ?? "",
    birthday: birthdayToIsoDate(o.birthday),
    community: String(o.community ?? "").trim(),
    communityId,
    address: o.address ?? "",
    addressUrl: o.addressUrl ?? "",
    education: o.education ?? "",
    gender: o.gender ?? "",
    facebookUrl: o.facebookUrl ?? "",
    twitterUrl: o.twitterUrl ?? "",
    instagramUrl: o.instagramUrl ?? "",
    courierSuggestedCents:
      o.courierSuggestedCents != null && Number.isFinite(Number(o.courierSuggestedCents))
        ? Math.max(0, Math.floor(Number(o.courierSuggestedCents)))
        : null,
    allowCourierTaskNotifications:
      o.allowCourierTaskNotifications === undefined ? true : Boolean(o.allowCourierTaskNotifications),
    pushNotificationRegistered: Boolean(o.pushNotificationRegistered),
    pushNotificationPlatform:
      o.pushNotificationPlatform === "fcm" || o.pushNotificationPlatform === "apns" ? o.pushNotificationPlatform : null,
    subscriptionTier: normalizeSubscriptionTier(o.subscriptionTier ?? o.subscription_tier),
    courierStatus: normalizeCourierStatusForClient(o.courierStatus),
    defaultLat:
      o.defaultLat != null && Number.isFinite(Number(o.defaultLat))
        ? Number(o.defaultLat)
        : o.default_lat != null && Number.isFinite(Number(o.default_lat))
          ? Number(o.default_lat)
          : null,
    defaultLng:
      o.defaultLng != null && Number.isFinite(Number(o.defaultLng))
        ? Number(o.defaultLng)
        : o.default_lng != null && Number.isFinite(Number(o.default_lng))
          ? Number(o.default_lng)
          : null,
    emailVerified: o.emailVerified === undefined ? true : Boolean(o.emailVerified),
    phoneVerified: Boolean(o.phoneVerified),
  };
}

/** Split Google `name` into first / middle / last. */
export function splitGoogleDisplayName(fullName, emailLocalFallback) {
  const raw = String(fullName || "").trim();
  if (!raw) {
    const fb = String(emailLocalFallback || "User").split("@")[0] || "User";
    return { firstName: fb, middleName: "", lastName: fb };
  }
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], middleName: "", lastName: parts[0] };
  if (parts.length === 2) return { firstName: parts[0], middleName: "", lastName: parts[1] };
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}
