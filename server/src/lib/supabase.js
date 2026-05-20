import { createClient } from "@supabase/supabase-js";
import { config } from "../config/config.js";

const ensureConfig = () => {
  if (!config.supabaseUrl || !config.supabasePublishableKey || !config.supabaseServiceRoleKey) {
    throw new Error("Supabase env is missing. Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY.");
  }
};

ensureConfig();

/** Trailing slashes or spaces break Storage REST paths (`requested path is invalid`). */
const supabaseUrl = String(config.supabaseUrl).trim().replace(/\/+$/, "");

export const supabaseAdmin = createClient(supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export const supabaseAuth = createClient(supabaseUrl, config.supabasePublishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
