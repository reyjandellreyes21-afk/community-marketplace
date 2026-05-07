import { AppError } from "../errors/AppError.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { displayNameFromDocument } from "../utils/displayName.js";
import { meetsMinSubscriptionTier, normalizeSubscriptionTier } from "../utils/subscriptionTier.js";

export const requireAuth = async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError(401, "Missing or invalid Authorization header."));
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return next(new AppError(401, "Missing or invalid Authorization header."));
  }
  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return next(new AppError(401, "Invalid or expired token."));
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError && profileError.code !== "PGRST205") {
      return next(new AppError(500, "Failed to load profile."));
    }

    const user = profile || { id: authData.user.id, email: authData.user.email || "" };
    req.user = {
      id: authData.user.id,
      email: user.email,
      name: displayNameFromDocument(user),
      subscriptionTier: profile ? normalizeSubscriptionTier(profile.subscription_tier) : "basic",
    };
    return next();
  } catch {
    return next(new AppError(401, "Invalid or expired token."));
  }
};

/**
 * When a Bearer token is present and valid, sets `req.user` (same shape as `requireAuth`).
 * Missing or invalid token continues without `req.user` — for public GET routes that optionally personalize.
 */
export const optionalAuth = async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return next();

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) return next();

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError && profileError.code !== "PGRST205") return next();

    const user = profile || { id: authData.user.id, email: authData.user.email || "" };
    req.user = {
      id: authData.user.id,
      email: user.email,
      name: displayNameFromDocument(user),
      subscriptionTier: profile ? normalizeSubscriptionTier(profile.subscription_tier) : "basic",
    };
    return next();
  } catch {
    return next();
  }
};

/**
 * Require an authenticated user whose plan is at least `minTier` (basic | pro | premium).
 * Use on routes that implement paid-only behavior.
 */
export const requireMinSubscriptionTier = (minTier) => (req, _res, next) => {
  if (!req.user?.id) {
    return next(new AppError(401, "Authentication required."));
  }
  const tier = req.user.subscriptionTier || "basic";
  if (!meetsMinSubscriptionTier(tier, minTier)) {
    return next(
      new AppError(403, `This action requires a ${String(minTier)} plan or higher.`, null, "PLAN_REQUIRED"),
    );
  }
  return next();
};
