import crypto from "crypto";

/**
 * Stable row identity for cart lines: variant selections + fulfillment + buyer note (UTF-8 payload).
 * Must match the browser helper in `client/src/lib/cartLineSignature.js`.
 */
export function computeCartLineSignature(variantSig, fulfillmentType, buyerComment) {
  const v = String(variantSig ?? "").trim().slice(0, 512);
  const f = String(fulfillmentType ?? "").trim().toLowerCase();
  const c = String(buyerComment ?? "").trim().slice(0, 2000);
  const payload = `${v}\n${f}\n${c}`;
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 64);
}
