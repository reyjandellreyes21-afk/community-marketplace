import { OAuth2Client } from "google-auth-library";
import { config } from "../config/config.js";
import { AppError } from "../errors/AppError.js";
import { syncSellerListingsCommunityId } from "../lib/profileListingCommunity.js";
import { supabaseAdmin, supabaseAuth } from "../lib/supabase.js";
import { splitGoogleDisplayName, userToClient } from "../utils/displayName.js";

const googleClient = new OAuth2Client(config.googleClientId || undefined);

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
      address: meta.address || "",
      addressUrl: meta.address_url || "",
      gender: meta.gender || "",
      facebookUrl: meta.facebook_url || "",
      twitterUrl: meta.twitter_url || "",
      instagramUrl: meta.instagram_url || "",
    });
  };

const getProfileById = async (id) => {
  const { data, error } = await supabaseAdmin.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error?.code === "PGRST205") return null;
  if (error) throw new AppError(500, "Failed to load user profile.");
  return data;
};

const ensureProfile = async (user, partial = {}) => {
  const payload = {
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
    address: partial.address || "",
    address_url: partial.address_url || "",
    gender: partial.gender || "",
    facebook_url: partial.facebook_url || "",
    twitter_url: partial.twitter_url || "",
    instagram_url: partial.instagram_url || "",
  };
  const { data, error } = await supabaseAdmin.from("profiles").upsert(payload).select("*").single();
  if (error?.code === "PGRST205") return null;
  if (error) throw new AppError(500, error.message || "Failed to save profile.");
  return data;
};

export const register = async (req, res, next) => {
  try {
    const { username, age, acceptedTerms, email, password } = req.body;
    const normalizedUsername = String(username || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    let chosenUsername = normalizedUsername;
    if (chosenUsername) {
      const { data: existingUsername, error: usernameError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", chosenUsername)
        .maybeSingle();
      if (usernameError && usernameError.code !== "PGRST205") {
        throw new AppError(500, "Failed to verify username uniqueness.");
      }
      if (existingUsername) throw new AppError(409, "Username already taken.");
    } else {
      const emailPrefix = normalizedEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || "user";
      chosenUsername = `${emailPrefix}_${Math.random().toString(36).slice(2, 8)}`;
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
      firstName, middleName, lastName, username, avatarUrl, email, phone, birthday, address, addressUrl, age, gender, facebookUrl, twitterUrl, instagramUrl,
    } = req.body || {};

    const updates = {};
    if (firstName !== undefined) updates.first_name = String(firstName).trim();
    if (middleName !== undefined) updates.middle_name = String(middleName).trim();
    if (lastName !== undefined) updates.last_name = String(lastName).trim();
    if (username !== undefined) updates.username = String(username).trim();
    if (avatarUrl !== undefined) updates.avatar_url = String(avatarUrl).trim();
    if (phone !== undefined) updates.phone = String(phone).trim();
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
      const { data: existingUsername, error: usernameError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", updates.username)
        .neq("id", req.user.id)
        .maybeSingle();
      if (usernameError) throw new AppError(500, "Failed to verify username uniqueness.");
      if (existingUsername) throw new AppError(409, "Username already taken.");
    }

    if (existingProfile) {
      const { data, error } = await supabaseAdmin.from("profiles").update(updates).eq("id", req.user.id).select("*").single();
      if (error) throw new AppError(500, error.message || "Failed to update profile.");
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
