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
  /** Link in signup confirmation email (Supabase Auth → URL Configuration must allow this origin). */
  authEmailRedirectUrl: String(process.env.AUTH_EMAIL_REDIRECT_URL || "").trim(),
  /** HMAC secret for phone OTP hashes (set explicitly in production). */
  otpPepper: String(process.env.OTP_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || "local-dev-otp-pepper").trim(),
  twilioAccountSid: String(process.env.TWILIO_ACCOUNT_SID || "").trim(),
  twilioAuthToken: String(process.env.TWILIO_AUTH_TOKEN || "").trim(),
  /** Prefer Messaging Service SID (`MG…`) when set; else use `TWILIO_FROM_NUMBER`. */
  twilioMessagingServiceSid: String(process.env.TWILIO_MESSAGING_SERVICE_SID || "").trim(),
  twilioFromNumber: String(process.env.TWILIO_FROM_NUMBER || "").trim(),
};
