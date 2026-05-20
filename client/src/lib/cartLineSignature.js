/**
 * Stable row identity for cart lines — must match server `computeCartLineSignature` exactly.
 */
export async function computeCartLineSignature(variantSig, fulfillmentType, buyerComment) {
  const v = String(variantSig ?? "").trim().slice(0, 512);
  const f = String(fulfillmentType ?? "").trim().toLowerCase();
  const c = String(buyerComment ?? "").trim().slice(0, 2000);
  const payload = `${v}\n${f}\n${c}`;
  const enc = new TextEncoder().encode(payload);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 64);
}
