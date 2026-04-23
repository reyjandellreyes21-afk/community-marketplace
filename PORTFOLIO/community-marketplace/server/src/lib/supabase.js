import { createClient } from "@supabase/supabase-js";
import { config } from "../config/config.js";

const ensureConfig = () => {
  if (!config.supabaseUrl || !config.supabasePublishableKey || !config.supabaseServiceRoleKey) {
    throw new Error("Supabase env is missing. Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY.");
  }
};

ensureConfig();

export const supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const supabaseAuth = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
