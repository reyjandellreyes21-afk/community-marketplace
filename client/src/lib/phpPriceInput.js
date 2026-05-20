/**
 * Philippine peso price input helpers: comma-separated thousands while typing,
 * compatible with validation via {@link parsePhpPricePesos}.
 */

/** Display amount with comma grouping (no currency symbol). */
export function formatPhpPriceFromNumber(n) {
  if (!Number.isFinite(n) || n < 0) return "";
  const cents = Math.round(n * 100);
  const whole = Math.floor(cents / 100);
  const frac = cents % 100;
  const intStr = String(whole);
  const withCommas = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (frac === 0) return withCommas;
  return `${withCommas}.${String(frac).padStart(2, "0")}`;
}

/**
 * Format raw keystrokes/paste into grouped digits and at most two decimal places.
 */
export function formatPhpPriceTyping(raw) {
  const s = String(raw ?? "").replace(/,/g, "");
  let out = "";
  let dotSeen = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch === "." && !dotSeen) {
      out += ".";
      dotSeen = true;
    }
  }
  const parts = out.split(".");
  let intPart = parts[0] ?? "";
  let decPart = parts.length > 1 ? parts.slice(1).join("") : "";
  decPart = decPart.slice(0, 2);
  const hadTrailingDot = out.endsWith(".") && decPart.length === 0 && parts.length > 1;

  intPart = intPart.replace(/^0+(?=\d)/, "");

  if (intPart === "" && decPart === "" && !hadTrailingDot) return "";

  const intDisplay =
    intPart === "" && (decPart.length > 0 || hadTrailingDot)
      ? "0"
      : intPart === ""
        ? "0"
        : intPart;

  const withCommas = intDisplay.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (parts.length > 1) {
    if (hadTrailingDot && decPart === "") return `${withCommas}.`;
    if (decPart.length > 0) return `${withCommas}.${decPart}`;
    return `${withCommas}.`;
  }
  return withCommas;
}

/** Parse displayed value (with optional commas) to a peso amount for API validation. */
export function parsePhpPricePesos(displayValue) {
  const stripped = String(displayValue ?? "").replace(/,/g, "").trim();
  if (stripped === "" || stripped === ".") return NaN;
  const n = Number(stripped);
  return Number.isFinite(n) ? n : NaN;
}
