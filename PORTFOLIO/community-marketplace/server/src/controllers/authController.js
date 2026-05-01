import { OAuth2Client } from "google-auth-library";
import { config } from "../config/config.js";
import { AppError } from "../errors/AppError.js";
import { uploadAvatarImage } from "../lib/communityImageStorage.js";
import { displayNameForStoragePath } from "../lib/storagePathLabel.js";
import { syncSellerListingsCommunityId } from "../lib/profileListingCommunity.js";
import { supabaseAdmin, supabaseAuth } from "../lib/supabase.js";
import { splitGoogleDisplayName, userToClient } from "../utils/displayName.js";

const googleClient = new OAuth2Client(config.googleClientId || undefined);
const isMissingProfilesCommunityColumn = (error) =>
  /community/i.test(String(error?.message || "")) && /profiles|schema cache/i.test(String(error?.message || ""));
const isMissingProfilesCommunityIdColumn = (error) =>
  /community_id/i.test(String(error?.message || "")) && /profiles|schema cache/i.test(String(error?.message || ""));
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

const profileToClient = (profile) =>
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
  });

const authUserToClient = (authUser) =>
  {
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
    const label = String(community || "").trim().toLowerCase();
    if (!label) return null;
    const exact = (communityRows || []).find((c) => String(c?.name || "").trim().toLowerCase() === label);
    return exact?.id ? String(exact.id) : null;
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
      email_confirm: true,
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

    const { data: signInData, error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (signInError || !signInData?.session) {
      throw new AppError(400, "Account created, but automatic sign-in failed. Please log in.");
    }

    res.status(201).json({
      user: profile ? profileToClient(profile) : authUserToClient(createdData.user),
      token: signInData.session.access_token,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { data: signInData, error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email: String(email || "").trim().toLowerCase(),
      password,
    });
    if (signInError || !signInData?.user || !signInData?.session) throw new AppError(401, "Invalid credentials.");
    const profile = (await getProfileById(signInData.user.id)) || (await ensureProfile(signInData.user));
    res.json({
      user: profile ? profileToClient(profile) : authUserToClient(signInData.user),
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
      user: profile ? profileToClient(profile) : authUserToClient(googleData.user),
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
      return res.json({ user: profileToClient(data) });
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
    const profile = await getProfileById(req.user.id);
    if (profile) return res.json({ user: profileToClient(profile) });
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(req.user.id);
    if (authError || !authData?.user) throw new AppError(401, "User no longer exists.", null, "UNAUTHORIZED");
    res.json({ user: authUserToClient(authData.user) });
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const existingProfile = await getProfileById(req.user.id);
    const {
      firstName, middleName, lastName, username, avatarUrl, email, phone, birthday, community, communityId, address, addressUrl, age, gender, facebookUrl, twitterUrl, instagramUrl,
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
    if (updates.address !== undefined || updates.community !== undefined) {
      const nextCommunity = updates.community !== undefined ? updates.community : String(existingProfile?.community || "");
      updates.community_id = await resolveProfileCommunityId({ community: nextCommunity });
    }

    if (existingProfile) {
      const { error } = await supabaseAdmin.from("profiles").update(updates).eq("id", req.user.id);
      if (error && (isMissingProfilesCommunityColumn(error) || isMissingProfilesCommunityIdColumn(error))) {
        const updatesWithoutMissingColumns = { ...updates };
        if (isMissingProfilesCommunityColumn(error)) delete updatesWithoutMissingColumns.community;
        if (isMissingProfilesCommunityIdColumn(error)) delete updatesWithoutMissingColumns.community_id;
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
      return res.json({ user: profileToClient(data) });
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
