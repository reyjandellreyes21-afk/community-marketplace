import { OAuth2Client } from "google-auth-library";
import { config } from "../config/config.js";
import { AppError } from "../errors/AppError.js";
import { uploadAvatarImage } from "../lib/communityImageStorage.js";
import { generateSixDigitCode, hashPhoneOtp, sendTwilioSms } from "../lib/phoneVerification.js";
import { displayNameForStoragePath } from "../lib/storagePathLabel.js";
import {
  findCommunityIdByName,
  syncSellerListingsCommunityId,
  syncSellerListingsLocationPin,
} from "../lib/profileListingCommunity.js";
import { supabaseAdmin, supabaseAuth } from "../lib/supabase.js";
import { splitGoogleDisplayName, userToClient } from "../utils/displayName.js";

const googleClient = new OAuth2Client(config.googleClientId || undefined);
const isMissingProfilesCommunityColumn = (error) =>
  /community/i.test(String(error?.message || "")) && /profiles|schema cache/i.test(String(error?.message || ""));
const isMissingProfilesCommunityIdColumn = (error) =>
  /community_id/i.test(String(error?.message || "")) && /profiles|schema cache/i.test(String(error?.message || ""));
const isMissingProfilesCourierSuggestedColumn = (error) =>
  /courier_suggested/i.test(String(error?.message || "")) && /profiles|schema cache/i.test(String(error?.message || ""));
const isMissingProfilesNotifyCourierColumn = (error) =>
  /notify_courier_open_tasks/i.test(String(error?.message || "")) && /profiles|schema cache/i.test(String(error?.message || ""));
const isMissingProfilesPushTokenColumn = (error) =>
  /push_notification_token|push_notification_platform/i.test(String(error?.message || "")) &&
  /profiles|schema cache/i.test(String(error?.message || ""));
const isMissingPhoneVerifiedColumn = (error) =>
  /phone_verified_at/i.test(String(error?.message || "")) && /profiles|schema cache/i.test(String(error?.message || ""));
const isMissingProfilesDefaultLatLngColumn = (error) =>
  /default_lat|default_lng/i.test(String(error?.message || "")) && /profiles|schema cache/i.test(String(error?.message || ""));
const isMissingPhoneChallengeTable = (error) =>
  /phone_verification_challenges|relation.*does not exist/i.test(String(error?.message || ""));
const USERNAME_RULE = /^[a-z][a-z0-9._]{2,19}$/;
const USERNAME_DUPLICATE_SEPARATOR_RULE = /(\.\.|__)/;

const isValidUsername = (value) => USERNAME_RULE.test(value) && !USERNAME_DUPLICATE_SEPARATOR_RULE.test(value);

const sanitizeUsernameSeed = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .replace(/[._]{2,}/g, (match) => match[0])
    .replace(/^[^a-z]+/, "")
    .replace(/[._]+$/g, "");

const usernameExists = async (username) => {
  const { data: existingUsernameRows, error: usernameError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .limit(1);
  if (usernameError && usernameError.code !== "PGRST205") {
    throw new AppError(500, "Failed to verify username uniqueness.");
  }
  return Array.isArray(existingUsernameRows) && existingUsernameRows.length > 0;
};

const normalizePhilippinesPhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  // Canonicalize by the mobile local part (9XXXXXXXXX), regardless of input formatting.
  if (digits.length >= 10) {
    const local10 = digits.slice(-10);
    if (local10.startsWith("9")) return `+63${local10}`;
  }
  if (digits.startsWith("63") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+63${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("9")) return `+63${digits}`;
  return String(value || "").trim();
};

const phoneVariants = (value) => {
  const normalized = normalizePhilippinesPhone(value);
  if (!normalized) return [];
  const digits = normalized.replace(/\D/g, "");
  if (digits.length !== 12 || !digits.startsWith("63")) return [normalized];
  const local10 = digits.slice(2);
  return Array.from(new Set([`+${digits}`, `0${local10}`, local10]));
};

const phoneExistsForOtherUser = async (phone, userId) => {
  const normalizedPhone = normalizePhilippinesPhone(phone);
  if (!normalizedPhone) return false;
  const variants = phoneVariants(normalizedPhone);
  for (const variant of variants) {
    const { data: exactRows, error: exactError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", variant)
      .neq("id", userId)
      .limit(1);
    if (exactError && exactError.code !== "PGRST205") {
      throw new AppError(500, "Failed to verify phone uniqueness.");
    }
    if (Array.isArray(exactRows) && exactRows.length > 0) return true;
  }
  const { data: existingPhoneRows, error: phoneError } = await supabaseAdmin
    .from("profiles")
    .select("id, phone")
    .neq("id", userId)
    .not("phone", "is", null)
    .neq("phone", "")
    .limit(20000);
  if (phoneError && phoneError.code !== "PGRST205") {
    throw new AppError(500, "Failed to verify phone uniqueness.");
  }
  const duplicate = (existingPhoneRows || []).some((row) => normalizePhilippinesPhone(row?.phone) === normalizedPhone);
  return duplicate;
};

const ensureUniquePhoneOnWrite = async (phone, userId) => {
  const normalizedPhone = normalizePhilippinesPhone(phone);
  if (!normalizedPhone) return "";
  if (await phoneExistsForOtherUser(normalizedPhone, userId)) {
    throw new AppError(409, "Phone number already in use.");
  }
  return normalizedPhone;
};

const normalizeProfilePayloadPhone = (payload) => {
  const normalizedPhone = normalizePhilippinesPhone(payload.phone);
  return { ...payload, phone: normalizedPhone };
};

const generateUsernameFromEmail = async (email) => {
  const suffixLength = 6;
  const separator = "_";
  const maxBaseLength = 10;
  const baseSeed = sanitizeUsernameSeed(String(email || "").split("@")[0]);
  const safeBase = (baseSeed || "user").slice(0, maxBaseLength) || "user";
  for (let i = 0; i < 8; i += 1) {
    const suffix = Math.random().toString(36).slice(2, 2 + suffixLength);
    const candidate = `${safeBase}${separator}${suffix}`;
    if (isValidUsername(candidate) && !(await usernameExists(candidate))) return candidate;
  }
  const fallbackSuffix = Date.now().toString(36).slice(-suffixLength);
  const fallback = `${safeBase}${separator}${fallbackSuffix}`;
  return fallback.slice(0, 20);
};

const profileToClient = (profile, authUser = null) =>
  userToClient({
    id: profile.id,
    firstName: profile.first_name || "",
    middleName: profile.middle_name || "",
    lastName: profile.last_name || "",
    email: profile.email || "",
    joinedAt: profile.created_at || null,
    username: profile.username || "",
    age: profile.age,
    acceptedTerms: profile.accepted_terms,
    avatarUrl: profile.avatar_url || "",
    phone: profile.phone || "",
    birthday: profile.birthday,
    community: profile.community || "",
    community_id: profile.community_id ?? null,
    address: profile.address || "",
    addressUrl: profile.address_url || "",
    gender: profile.gender || "",
    facebookUrl: profile.facebook_url || "",
    twitterUrl: profile.twitter_url || "",
    instagramUrl: profile.instagram_url || "",
    courierSuggestedCents:
      profile.courier_suggested_cents != null && Number.isFinite(Number(profile.courier_suggested_cents))
        ? Math.max(0, Math.floor(Number(profile.courier_suggested_cents)))
        : null,
    allowCourierTaskNotifications: profile.notify_courier_open_tasks !== false,
    pushNotificationRegistered: Boolean(String(profile.push_notification_token || "").trim()),
    pushNotificationPlatform: ["fcm", "apns"].includes(String(profile.push_notification_platform || "").toLowerCase())
      ? String(profile.push_notification_platform).toLowerCase()
      : null,
    subscription_tier: profile.subscription_tier ?? "basic",
    courierStatus: profile.courier_status ?? "offline",
    defaultLat: profile.default_lat != null && Number.isFinite(Number(profile.default_lat)) ? Number(profile.default_lat) : null,
    defaultLng: profile.default_lng != null && Number.isFinite(Number(profile.default_lng)) ? Number(profile.default_lng) : null,
    emailVerified: authUser != null ? Boolean(authUser.email_confirmed_at) : true,
    phoneVerified: Boolean(profile.phone_verified_at),
  });

const authUserToClient = (authUser) => {
  const meta = authUser?.user_metadata || {};
  return userToClient({
    id: authUser.id,
    email: authUser.email || "",
    joinedAt: authUser.created_at || null,
    firstName: meta.first_name || "",
    middleName: meta.middle_name || "",
    lastName: meta.last_name || "",
    username: meta.username || "",
    age: meta.age ?? null,
    acceptedTerms: Boolean(meta.accepted_terms),
    avatarUrl: meta.avatar_url || "",
    phone: meta.phone || "",
    birthday: meta.birthday || null,
    community: meta.community || "",
    communityId: meta.community_id ? String(meta.community_id).trim() : "",
    address: meta.address || "",
    addressUrl: meta.address_url || "",
    gender: meta.gender || "",
    facebookUrl: meta.facebook_url || "",
    twitterUrl: meta.twitter_url || "",
    instagramUrl: meta.instagram_url || "",
    subscription_tier: "basic",
    emailVerified: Boolean(authUser?.email_confirmed_at),
    phoneVerified: false,
  });
};

const getProfileById = async (id) => {
  const { data, error } = await supabaseAdmin.from("profiles").select("*").eq("id", id).limit(1);
  if (error?.code === "PGRST205") return null;
  if (error) throw new AppError(500, "Failed to load user profile.");
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
};

const resolveProfileCommunityId = async ({ community }) => {
  try {
    const { data: communityRows, error } = await supabaseAdmin.from("communities").select("*");
    if (error) return null;
    // Use the same exact → strip-"Barangay" → case-insensitive → fuzzy rules the client uses
    // to pick a community shop, so the profile's `community_id` matches the community the user sees.
    return findCommunityIdByName(communityRows || [], community);
  } catch {
    return null;
  }
};

const ensureProfile = async (user, partial = {}) => {
  const payload = normalizeProfilePayloadPhone({
    id: user.id,
    email: user.email || partial.email || "",
    first_name: partial.first_name || "",
    middle_name: partial.middle_name || "",
    last_name: partial.last_name || "",
    username: partial.username || "",
    age: partial.age ?? null,
    accepted_terms: Boolean(partial.accepted_terms),
    accepted_terms_at: partial.accepted_terms ? new Date().toISOString() : null,
    avatar_url: partial.avatar_url || "",
    phone: partial.phone || "",
    birthday: partial.birthday || null,
    community: partial.community || "",
    address: partial.address || "",
    address_url: partial.address_url || "",
    gender: partial.gender || "",
    facebook_url: partial.facebook_url || "",
    twitter_url: partial.twitter_url || "",
    instagram_url: partial.instagram_url || "",
  });
  const { error } = await supabaseAdmin.from("profiles").upsert(payload);
  if (error?.code === "PGRST205") return null;
  if (error && isMissingProfilesCommunityColumn(error)) {
    const { community, ...payloadWithoutCommunity } = payload;
    const retry = await supabaseAdmin.from("profiles").upsert(payloadWithoutCommunity);
    if (retry.error?.code === "PGRST205") return null;
    if (retry.error) throw new AppError(500, retry.error.message || "Failed to save profile.");
  } else if (error) {
    throw new AppError(500, error.message || "Failed to save profile.");
  }
  const refreshed = await getProfileById(user.id);
  return refreshed;
};

export const register = async (req, res, next) => {
  try {
    const { username, age, acceptedTerms, email, password } = req.body;
    const normalizedUsername = String(username || "").trim().toLowerCase();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    let chosenUsername = normalizedUsername;
    if (chosenUsername) {
      if (!isValidUsername(chosenUsername)) {
        throw new AppError(
          400,
          "Username must be 3-20 characters, start with a letter, use lowercase a-z, 0-9, . or _, and not contain duplicate dots/underscores.",
        );
      }
      if (await usernameExists(chosenUsername)) throw new AppError(409, "Username already taken.");
    } else {
      chosenUsername = await generateUsernameFromEmail(normalizedEmail);
    }

    const { data: createdData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: false,
    });
    if (createError) {
      if (/already registered|already exists|duplicate|unique/i.test(createError.message || "")) {
        throw new AppError(409, "Email already registered.");
      }
      throw new AppError(400, createError.message || "Registration failed.");
    }
    if (!createdData?.user) throw new AppError(400, "Registration failed.");

    const profile = await ensureProfile(createdData.user, {
      username: chosenUsername,
      age: age === undefined || age === null || age === "" ? null : Number(age),
      accepted_terms: Boolean(acceptedTerms),
    });

    const redirectTo = config.authEmailRedirectUrl || undefined;
    const { error: resendError } = await supabaseAuth.auth.resend({
      type: "signup",
      email: normalizedEmail,
      ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {}),
    });
    if (resendError) {
      const m = String(resendError.message || "");
      const probablyRateOrDuplicate = /rate|too many|seconds|after|already|please wait/i.test(m);
      if (!probablyRateOrDuplicate) {
        throw new AppError(
          500,
          resendError.message ||
            "Account was created but we could not send the confirmation email. Try “Resend email” or contact support.",
        );
      }
    }

    res.status(201).json({
      emailVerificationRequired: true,
      message: "Check your email to confirm your address, then sign in.",
      email: normalizedEmail,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedLoginEmail = String(email || "").trim().toLowerCase();
    const { data: signInData, error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email: normalizedLoginEmail,
      password,
    });
    if (signInError || !signInData?.user || !signInData?.session) {
      const msg = String(signInError?.message || "");
      if (/email not confirmed|confirm your email|email address is not confirmed/i.test(msg)) {
        throw new AppError(403, "Confirm your email before signing in. Check your inbox or use “Resend confirmation”.");
      }
      if (/invalid login credentials|invalid credentials/i.test(msg)) {
        const { data: existingProfileRows, error: profileLookupError } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", normalizedLoginEmail)
          .limit(1);
        if (profileLookupError && profileLookupError.code !== "PGRST205") {
          throw new AppError(500, "Failed to verify account credentials.");
        }
        const hasExistingEmail = Array.isArray(existingProfileRows) && existingProfileRows.length > 0;
        if (!hasExistingEmail) throw new AppError(404, "No existing email found.");
        throw new AppError(401, "Wrong password.");
      }
      throw new AppError(401, "Invalid credentials.");
    }
    const { data: authFull, error: authFullErr } = await supabaseAdmin.auth.admin.getUserById(signInData.user.id);
    const authUser = !authFullErr && authFull?.user ? authFull.user : signInData.user;
    const profile = (await getProfileById(signInData.user.id)) || (await ensureProfile(signInData.user));
    res.json({
      user: profile ? profileToClient(profile, authUser) : authUserToClient(authUser),
      token: signInData.session.access_token,
    });
  } catch (error) {
    next(error);
  }
};

export const googleAuth = async (req, res, next) => {
  try {
    if (!config.googleClientId) throw new AppError(500, "Google auth is not configured on the server.");
    const { credential } = req.body;
    if (!credential) throw new AppError(400, "Missing Google credential.");

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new AppError(401, "Invalid Google token.");

    const { data: googleData, error: googleError } = await supabaseAuth.auth.signInWithIdToken({
      provider: "google",
      token: credential,
    });
    if (googleError || !googleData?.user || !googleData?.session) throw new AppError(401, "Google sign-in failed.");

    const nameParts = splitGoogleDisplayName(payload.name, payload.email.split("@")[0]);
    const profile = await ensureProfile(googleData.user, {
      first_name: nameParts.firstName,
      middle_name: nameParts.middleName,
      last_name: nameParts.lastName,
      avatar_url: payload.picture || "",
    });
    res.json({
      user: profile ? profileToClient(profile, googleData.user) : authUserToClient(googleData.user),
      token: googleData.session.access_token,
    });
  } catch (error) {
    next(error);
  }
};

export const uploadMyAvatar = async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      throw new AppError(400, "Missing image file.");
    }
    const existingProfile = await getProfileById(req.user.id);
    let displayName = displayNameForStoragePath(existingProfile, null);
    let authUserForMetadata = null;
    if (!displayName) {
      const { data: authLookup, error: authLookupErr } = await supabaseAdmin.auth.admin.getUserById(req.user.id);
      if (!authLookupErr && authLookup?.user) {
        authUserForMetadata = authLookup.user;
        displayName = displayNameForStoragePath(null, authUserForMetadata);
      }
    }
    const publicUrl = await uploadAvatarImage(req.file.buffer, req.file.mimetype, req.user.id, displayName);
    if (existingProfile) {
      const { error } = await supabaseAdmin.from("profiles").update({ avatar_url: publicUrl }).eq("id", req.user.id);
      if (error) throw new AppError(500, error.message || "Failed to update profile.");
      const data = await getProfileById(req.user.id);
      if (!data) throw new AppError(500, "Failed to load updated profile.");
      const { data: authSnap } = await supabaseAdmin.auth.admin.getUserById(req.user.id);
      return res.json({ user: profileToClient(data, authSnap?.user || null) });
    }
    let authUser = authUserForMetadata;
    if (!authUser) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(req.user.id);
      if (authError || !authData?.user) throw new AppError(401, "User no longer exists.", null, "UNAUTHORIZED");
      authUser = authData.user;
    }
    const existingMeta = authUser.user_metadata || {};
    const { data: updatedAuth, error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
      user_metadata: { ...existingMeta, avatar_url: publicUrl },
    });
    if (updateAuthError || !updatedAuth?.user) {
      throw new AppError(500, updateAuthError?.message || "Failed to update profile.");
    }
    return res.json({ user: authUserToClient(updatedAuth.user) });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(req.user.id);
    if (authError || !authData?.user) throw new AppError(401, "User no longer exists.", null, "UNAUTHORIZED");
    const profile = await getProfileById(req.user.id);
    if (profile) return res.json({ user: profileToClient(profile, authData.user) });
    res.json({ user: authUserToClient(authData.user) });
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const existingProfile = await getProfileById(req.user.id);
    const {
      firstName,
      middleName,
      lastName,
      username,
      avatarUrl,
      email,
      phone,
      birthday,
      community,
      communityId,
      address,
      addressUrl,
      age,
      gender,
      facebookUrl,
      twitterUrl,
      instagramUrl,
      courierSuggestedCents,
      allowCourierTaskNotifications,
      pushNotificationToken,
      pushNotificationPlatform,
      defaultLat,
      defaultLng,
    } = req.body || {};

    const updates = {};
    if (firstName !== undefined) updates.first_name = String(firstName).trim();
    if (middleName !== undefined) updates.middle_name = String(middleName).trim();
    if (lastName !== undefined) updates.last_name = String(lastName).trim();
    if (username !== undefined) updates.username = String(username).trim();
    if (avatarUrl !== undefined) updates.avatar_url = String(avatarUrl).trim();
    if (phone !== undefined) updates.phone = normalizePhilippinesPhone(phone);
    if (community !== undefined) updates.community = String(community).trim();
    if (address !== undefined) updates.address = String(address).trim();
    if (addressUrl !== undefined) updates.address_url = String(addressUrl).trim();
    if (gender !== undefined) updates.gender = String(gender).trim();
    if (facebookUrl !== undefined) updates.facebook_url = String(facebookUrl).trim();
    if (twitterUrl !== undefined) updates.twitter_url = String(twitterUrl).trim();
    if (instagramUrl !== undefined) updates.instagram_url = String(instagramUrl).trim();
    if (age !== undefined) updates.age = Number(age);
    if (courierSuggestedCents !== undefined) {
      if (courierSuggestedCents === null || courierSuggestedCents === "") {
        updates.courier_suggested_cents = null;
      } else {
        const n = Math.floor(Number(courierSuggestedCents));
        if (!Number.isFinite(n) || n < 0 || n > 10_000_000) {
          throw new AppError(400, "courierSuggestedCents must be between 0 and 10000000 centavos, or null.");
        }
        updates.courier_suggested_cents = n;
      }
    }
    if (allowCourierTaskNotifications !== undefined) {
      updates.notify_courier_open_tasks = Boolean(allowCourierTaskNotifications);
    }
    if (defaultLat !== undefined) {
      if (defaultLat === null || defaultLat === "") {
        updates.default_lat = null;
      } else {
        const n = Number(defaultLat);
        if (!Number.isFinite(n) || n < -90 || n > 90) throw new AppError(400, "defaultLat must be between -90 and 90.");
        updates.default_lat = n;
      }
    }
    if (defaultLng !== undefined) {
      if (defaultLng === null || defaultLng === "") {
        updates.default_lng = null;
      } else {
        const n = Number(defaultLng);
        if (!Number.isFinite(n) || n < -180 || n > 180) throw new AppError(400, "defaultLng must be between -180 and 180.");
        updates.default_lng = n;
      }
    }
    if (pushNotificationToken !== undefined) {
      const raw = String(pushNotificationToken ?? "").trim();
      updates.push_notification_token = raw.length ? raw.slice(0, 512) : null;
      if (!raw.length) updates.push_notification_platform = null;
    }
    if (pushNotificationPlatform !== undefined) {
      const p = String(pushNotificationPlatform ?? "").trim().toLowerCase();
      const effectiveTok =
        updates.push_notification_token !== undefined
          ? String(updates.push_notification_token ?? "").trim()
          : String(existingProfile?.push_notification_token ?? "").trim();
      if (!p || !effectiveTok) {
        updates.push_notification_platform = null;
      } else if (p === "fcm" || p === "apns") {
        updates.push_notification_platform = p;
      } else {
        throw new AppError(400, "pushNotificationPlatform must be fcm or apns.");
      }
    }

    if (birthday !== undefined) {
      const raw = birthday === null || birthday === "" ? null : String(birthday).trim();
      updates.birthday = raw || null;
    }

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
        email: normalizedEmail,
      });
      if (emailError) throw new AppError(409, emailError.message || "Email already in use.");
      updates.email = normalizedEmail;
    }

    if (existingProfile && updates.username) {
      const { data: existingUsernameRows, error: usernameError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", updates.username)
        .neq("id", req.user.id)
        .limit(1);
      const existingUsername = Array.isArray(existingUsernameRows) && existingUsernameRows.length > 0 ? existingUsernameRows[0] : null;
      if (usernameError) throw new AppError(500, "Failed to verify username uniqueness.");
      if (existingUsername) throw new AppError(409, "Username already taken.");
    }
    if (updates.phone !== undefined) {
      updates.phone = await ensureUniquePhoneOnWrite(updates.phone, req.user.id);
      if (existingProfile) {
        const before = normalizePhilippinesPhone(existingProfile.phone || "");
        const after = updates.phone;
        if (before !== after) updates.phone_verified_at = null;
      }
    }
    if (communityId !== undefined) {
      const rawCommunityId = communityId === null ? "" : String(communityId).trim();
      if (!rawCommunityId) {
        updates.community_id = null;
      } else {
        const { data: communityRow, error: communityErr } = await supabaseAdmin
          .from("communities")
          .select("id,name")
          .eq("id", rawCommunityId)
          .maybeSingle();
        if (communityErr) throw new AppError(400, communityErr.message || "Invalid community.");
        if (!communityRow?.id) throw new AppError(400, "Community not found.");
        updates.community_id = String(communityRow.id);
        if (community === undefined) updates.community = String(communityRow.name || "").trim();
      }
    }
    // Only derive community_id from the name when the caller did not pass an explicit,
    // already-validated communityId (e.g. the "Join community" flow). Otherwise the
    // validated id below would be clobbered by a name lookup that may not match.
    if (communityId === undefined && (updates.address !== undefined || updates.community !== undefined)) {
      const nextCommunity = updates.community !== undefined ? updates.community : String(existingProfile?.community || "");
      updates.community_id = await resolveProfileCommunityId({ community: nextCommunity });
    }

    if (existingProfile) {
      const { error } = await supabaseAdmin.from("profiles").update(updates).eq("id", req.user.id);
      if (
        error &&
        (isMissingProfilesCommunityColumn(error) ||
          isMissingProfilesCommunityIdColumn(error) ||
          isMissingProfilesCourierSuggestedColumn(error) ||
          isMissingProfilesNotifyCourierColumn(error) ||
          isMissingProfilesPushTokenColumn(error) ||
          isMissingProfilesDefaultLatLngColumn(error) ||
          isMissingPhoneVerifiedColumn(error))
      ) {
        const updatesWithoutMissingColumns = { ...updates };
        if (isMissingProfilesCommunityColumn(error)) delete updatesWithoutMissingColumns.community;
        if (isMissingProfilesCommunityIdColumn(error)) delete updatesWithoutMissingColumns.community_id;
        if (isMissingProfilesCourierSuggestedColumn(error)) delete updatesWithoutMissingColumns.courier_suggested_cents;
        if (isMissingProfilesNotifyCourierColumn(error)) delete updatesWithoutMissingColumns.notify_courier_open_tasks;
        if (isMissingProfilesPushTokenColumn(error)) {
          delete updatesWithoutMissingColumns.push_notification_token;
          delete updatesWithoutMissingColumns.push_notification_platform;
        }
        if (isMissingProfilesDefaultLatLngColumn(error)) {
          delete updatesWithoutMissingColumns.default_lat;
          delete updatesWithoutMissingColumns.default_lng;
        }
        if (isMissingPhoneVerifiedColumn(error)) delete updatesWithoutMissingColumns.phone_verified_at;
        const retry = await supabaseAdmin.from("profiles").update(updatesWithoutMissingColumns).eq("id", req.user.id);
        if (retry.error) throw new AppError(500, retry.error.message || "Failed to update profile.");
      } else if (error) {
        throw new AppError(500, error.message || "Failed to update profile.");
      }
      const data = await getProfileById(req.user.id);
      if (!data) throw new AppError(500, "Failed to load updated profile.");
      if (updates.community !== undefined || updates.community_id !== undefined) {
        const existingMeta = req.user?.user_metadata || {};
        await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
          user_metadata: {
            ...existingMeta,
            ...(updates.community !== undefined ? { community: updates.community || "" } : {}),
            ...(updates.community_id !== undefined ? { community_id: updates.community_id || null } : {}),
          },
        });
      }
      if (updates.address !== undefined) {
        await syncSellerListingsCommunityId(supabaseAdmin, req.user.id, String(data?.address ?? ""));
      }
      if (updates.default_lat !== undefined || updates.default_lng !== undefined) {
        await syncSellerListingsLocationPin(supabaseAdmin, req.user.id, {
          lat: data?.default_lat,
          lng: data?.default_lng,
        });
      }
      const { data: authAfterProfile } = await supabaseAdmin.auth.admin.getUserById(req.user.id);
      return res.json({ user: profileToClient(data, authAfterProfile?.user || null) });
    }

    const userMetadata = {};
    if (updates.first_name !== undefined) userMetadata.first_name = updates.first_name;
    if (updates.middle_name !== undefined) userMetadata.middle_name = updates.middle_name;
    if (updates.last_name !== undefined) userMetadata.last_name = updates.last_name;
    if (updates.username !== undefined) userMetadata.username = updates.username;
    if (updates.avatar_url !== undefined) userMetadata.avatar_url = updates.avatar_url;
    if (updates.phone !== undefined) userMetadata.phone = updates.phone;
    if (updates.community !== undefined) userMetadata.community = updates.community;
    if (updates.community_id !== undefined) userMetadata.community_id = updates.community_id;
    if (updates.birthday !== undefined) userMetadata.birthday = updates.birthday;
    if (updates.address !== undefined) userMetadata.address = updates.address;
    if (updates.address_url !== undefined) userMetadata.address_url = updates.address_url;
    if (updates.age !== undefined) userMetadata.age = updates.age;
    if (updates.gender !== undefined) userMetadata.gender = updates.gender;
    if (updates.facebook_url !== undefined) userMetadata.facebook_url = updates.facebook_url;
    if (updates.twitter_url !== undefined) userMetadata.twitter_url = updates.twitter_url;
    if (updates.instagram_url !== undefined) userMetadata.instagram_url = updates.instagram_url;

    const { data: updatedAuth, error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
      ...(updates.email !== undefined ? { email: updates.email } : {}),
      user_metadata: userMetadata,
    });
    if (updateAuthError || !updatedAuth?.user) {
      throw new AppError(500, updateAuthError?.message || "Failed to update profile.");
    }
    if (updates.address !== undefined) {
      await syncSellerListingsCommunityId(supabaseAdmin, req.user.id, String(updates.address ?? ""));
    }
    return res.json({ user: authUserToClient(updatedAuth.user) });
  } catch (error) {
    next(error);
  }
};

export const resendSignupConfirmation = async (req, res, next) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (!email) throw new AppError(400, "Email is required.");
    const redirectTo = config.authEmailRedirectUrl || undefined;
    const { error: resendError } = await supabaseAuth.auth.resend({
      type: "signup",
      email,
      ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {}),
    });
    if (resendError) throw new AppError(400, resendError.message || "Could not resend confirmation email.");
    res.json({ ok: true, message: "If an account exists for that email, a confirmation link has been sent." });
  } catch (error) {
    next(error);
  }
};

export const sendPhoneVerificationCode = async (req, res, next) => {
  try {
    const profile = await getProfileById(req.user.id);
    const rawPhone = req.body?.phone !== undefined ? req.body.phone : profile?.phone;
    const targetPhone = normalizePhilippinesPhone(rawPhone || "");
    const profilePhone = normalizePhilippinesPhone(profile?.phone || "");
    if (!profile || !targetPhone || !profilePhone) {
      throw new AppError(400, "Save a valid mobile number on your profile before requesting a code.");
    }
    if (targetPhone !== profilePhone) {
      throw new AppError(400, "Phone number does not match your profile. Save your number first, then request a code.");
    }

    await supabaseAdmin.from("phone_verification_challenges").delete().eq("user_id", req.user.id);

    const code = generateSixDigitCode();
    const codeHash = hashPhoneOtp(req.user.id, targetPhone, code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insErr } = await supabaseAdmin.from("phone_verification_challenges").insert({
      user_id: req.user.id,
      phone_e164: targetPhone,
      code_hash: codeHash,
      expires_at: expiresAt,
    });
    if (insErr) {
      if (isMissingPhoneChallengeTable(insErr)) {
        throw new AppError(503, "Phone verification is not available yet (database migration pending).");
      }
      throw new AppError(500, insErr.message || "Could not start phone verification.");
    }

    const bodyText = `Your LinkMart verification code is ${code}. It expires in 10 minutes.`;
    try {
      await sendTwilioSms(targetPhone, bodyText);
    } catch (e) {
      await supabaseAdmin.from("phone_verification_challenges").delete().eq("user_id", req.user.id);
      if (e?.code === "SMS_NOT_CONFIGURED") {
        throw new AppError(
          503,
          "SMS is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN, plus either TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER (see server/.env.example). Restart the API after updating .env.",
        );
      }
      throw new AppError(502, e?.message || "Could not send SMS.");
    }

    res.json({ ok: true, message: "Verification code sent." });
  } catch (error) {
    next(error);
  }
};

export const verifyPhoneCode = async (req, res, next) => {
  try {
    const code = String(req.body?.code || "").replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) throw new AppError(400, "Enter the 6-digit code from SMS.");

    const profile = await getProfileById(req.user.id);
    const targetPhone = normalizePhilippinesPhone(profile?.phone || "");
    if (!profile || !targetPhone) {
      throw new AppError(400, "Save a mobile number on your profile first.");
    }

    const { data: rows, error: selErr } = await supabaseAdmin
      .from("phone_verification_challenges")
      .select("id, phone_e164, code_hash, expires_at")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (selErr) {
      if (isMissingPhoneChallengeTable(selErr)) {
        throw new AppError(503, "Phone verification is not available yet (database migration pending).");
      }
      throw new AppError(500, selErr.message || "Verification failed.");
    }
    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!row) throw new AppError(400, "No verification code pending. Request a new code.");
    if (normalizePhilippinesPhone(row.phone_e164) !== targetPhone) {
      throw new AppError(400, "Your profile phone changed. Request a new code.");
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("phone_verification_challenges").delete().eq("id", row.id);
      throw new AppError(400, "Code expired. Request a new one.");
    }
    const expectedHash = hashPhoneOtp(req.user.id, targetPhone, code);
    if (expectedHash !== row.code_hash) {
      throw new AppError(400, "Invalid code.");
    }

    await supabaseAdmin.from("phone_verification_challenges").delete().eq("user_id", req.user.id);

    const verifiedAt = new Date().toISOString();
    const { error: updErr } = await supabaseAdmin
      .from("profiles")
      .update({ phone_verified_at: verifiedAt })
      .eq("id", req.user.id);
    if (updErr) {
      if (isMissingPhoneVerifiedColumn(updErr)) {
        throw new AppError(503, "Phone verification column missing. Apply the latest database migration.");
      }
      throw new AppError(500, updErr.message || "Could not save verification.");
    }

    const data = await getProfileById(req.user.id);
    if (!data) throw new AppError(500, "Failed to load profile.");
    const { data: authSnap } = await supabaseAdmin.auth.admin.getUserById(req.user.id);
    res.json({ user: profileToClient(data, authSnap?.user || null) });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const cur = String(currentPassword || "");
    const nextPass = String(newPassword || "");
    if (cur === nextPass) {
      throw new AppError(400, "New password must be different from your current password.");
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(req.user.id);
    if (userErr || !userData?.user) throw new AppError(401, "User no longer exists.", null, "UNAUTHORIZED");

    const authUser = userData.user;
    const hasEmailProvider =
      Array.isArray(authUser.identities) && authUser.identities.some((i) => i.provider === "email");
    if (!hasEmailProvider) {
      throw new AppError(400, "This account signs in with Google. Password change isn’t available.");
    }

    const email = String(authUser.email || req.user.email || "").trim().toLowerCase();
    if (!email) throw new AppError(400, "No email on file for this account.");

    const { error: signErr } = await supabaseAuth.auth.signInWithPassword({ email, password: cur });
    if (signErr) throw new AppError(401, "Current password is incorrect.");

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, { password: nextPass });
    if (updErr) throw new AppError(400, updErr.message || "Could not update password.");

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};
