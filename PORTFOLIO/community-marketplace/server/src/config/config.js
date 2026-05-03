/**
 * Comma-separated origins for `Access-Control-Allow-Origin` (production).
 * Example: https://app.example.com,https://www.example.com
 * Omit or empty → reflect request origin (browser calls allowed from any origin).
 */
function parseCorsOrigins() {
  const raw = String(process.env.CORS_ORIGIN || "").trim();
  if (!raw) return null;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  /** When set, browser requests must come from one of these origins. */
  corsOrigins: parseCorsOrigins(),
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  /** Supabase Storage bucket for community cover photos (public read). */
  communityImagesBucket: process.env.COMMUNITY_IMAGES_BUCKET || "community-images",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-1.5-flash",
};
