import crypto from "crypto";
import { config } from "../config/config.js";

export function hashPhoneOtp(userId, phoneE164, code) {
  const pepper = config.otpPepper || "otp";
  return crypto.createHmac("sha256", pepper).update(`${userId}|${phoneE164}|${code}`).digest("hex");
}

export function generateSixDigitCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * @returns {Promise<void>}
 * @throws {Error} code `SMS_NOT_CONFIGURED` or Twilio HTTP error text
 */
export async function sendTwilioSms(toE164, bodyText) {
  const sid = config.twilioAccountSid;
  const token = config.twilioAuthToken;
  const messagingSid = config.twilioMessagingServiceSid;
  const fromNum = config.twilioFromNumber;
  if (!sid || !token || (!messagingSid && !fromNum)) {
    const err = new Error("SMS_NOT_CONFIGURED");
    err.code = "SMS_NOT_CONFIGURED";
    throw err;
  }
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams();
  params.set("To", toE164);
  if (messagingSid) {
    params.set("MessagingServiceSid", messagingSid);
  } else {
    params.set("From", fromNum);
  }
  params.set("Body", bodyText);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
}
