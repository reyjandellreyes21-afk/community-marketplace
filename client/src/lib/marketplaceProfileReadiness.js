import { phoneVerificationEnabled } from "./featureFlags.js";
import { splitAddressParts, toPhilippinesLocalPhone10 } from "./philippinesAddress.js";

/**
 * Same rules as marketplace checkout (“Buy now”): core identity + PH locale on the profile address.
 *
 * @param {object | null | undefined} user Normalized app user (`/auth/me` style).
 * @returns {{ ready: boolean, missing: string[] }}
 */
export function computeMarketplaceProfileReadiness(user) {
  const parsedAddress = splitAddressParts(user?.address);
  const phone10Ok = toPhilippinesLocalPhone10(user?.phone).length === 10;
  const checks = [
    [String(user?.username || "").trim().length >= 3, "Username"],
    [phone10Ok, "Phone number"],
    ...(phone10Ok && phoneVerificationEnabled ? [[user?.phoneVerified === true, "Verified phone number"]] : []),
    [String(user?.firstName || "").trim().length >= 2, "First name"],
    [String(user?.lastName || "").trim().length >= 2, "Last name"],
    [String(parsedAddress.addressBarangay || "").trim().length > 0, "Barangay"],
    [String(parsedAddress.addressCity || "").trim().length > 0, "City or Municipality"],
    [String(parsedAddress.addressProvince || "").trim().length > 0, "Province"],
  ];
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
  return { ready: missing.length === 0, missing };
}
