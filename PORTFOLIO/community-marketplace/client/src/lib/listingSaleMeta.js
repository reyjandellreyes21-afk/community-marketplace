export const SALE_PERCENT_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 50, 70, 90];

export const formatPesoWhole = (priceCents) => `₱${Math.floor((Number(priceCents) || 0) / 100)}`;

export const parseSaleMetaFromDescription = (description) => {
  const text = String(description || "");
  const pctMatch = text.match(/Sale\s+(\d{1,2})%\s+off/i);
  const originalMatch = text.match(/Original\s+₱\s*(\d+)/i);
  return {
    percent: pctMatch ? Number(pctMatch[1]) : null,
    originalPesos: originalMatch ? Number(originalMatch[1]) : null,
  };
};

export const removeSaleMetaLines = (description) =>
  String(description || "")
    .split("\n")
    .filter((line) => !/Sale\s+\d{1,2}%\s+off/i.test(line) && !/Original\s+₱\s*\d+/i.test(line))
    .join("\n")
    .trim();

/** COD fulfillment label for listing cards (pickup / delivery / both). */
export const listingCodAvailabilityLabel = (fulfillmentModes) => {
  const modes = Array.isArray(fulfillmentModes) ? fulfillmentModes : [];
  const supportsPickup = modes.includes("pickup");
  const supportsDelivery = modes.includes("delivery");
  return supportsPickup && supportsDelivery ? "COD pickup + delivery" : supportsDelivery ? "COD delivery" : "COD pickup";
};
