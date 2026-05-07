/**
 * SMS OTP phone verification (profile edit). Default off — enable when Twilio is configured:
 * `VITE_ENABLE_PHONE_VERIFICATION=true` in client env + rebuild.
 */
export const phoneVerificationEnabled =
  String(import.meta.env.VITE_ENABLE_PHONE_VERIFICATION || "").trim().toLowerCase() === "true";
