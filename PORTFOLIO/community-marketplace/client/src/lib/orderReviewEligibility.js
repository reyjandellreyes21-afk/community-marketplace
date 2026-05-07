function readString(value) {
  return String(value || "").trim();
}

function readOrderStatus(order) {
  return readString(order?.status || order?.status_id).toLowerCase();
}

function readFulfillmentType(order) {
  return readString(order?.fulfillmentType || order?.fulfillment_type).toLowerCase();
}

function readSellerId(order) {
  return readString(order?.sellerId || order?.seller_id);
}

function hasAcceptedCommunityCourier(order) {
  if (order?.hasCommunityCourierDelivery === true) return true;
  return Boolean(order?.acceptedCourierAssignmentId || order?.accepted_bid_id || order?.acceptedBidId);
}

export function shouldShowSellerSection(order) {
  if (!order) return false;
  if (order?.buyerMayRateSeller === false) return false;
  return readOrderStatus(order) === "completed";
}

export function shouldShowCourierSection(order) {
  if (!order) return false;
  if (order?.buyerMayRateCourier === false) return false;
  if (readOrderStatus(order) !== "completed") return false;
  if (readFulfillmentType(order) !== "delivery") return false;
  if (!hasAcceptedCommunityCourier(order)) return false;
  return Boolean(readSellerId(order));
}

export function orderNeedsCourierReview(order) {
  return shouldShowCourierSection(order) && !order?.buyerCourierReview?.rating;
}

function sectionActionable(saved, canEdit) {
  if (!saved) return true;
  if (canEdit === false) return false;
  return true;
}

export function shouldShowRateButton(order) {
  if (!order || readOrderStatus(order) !== "completed") return false;
  const productSaved = Boolean(order?.buyerReview?.productRating);
  const sellerSection = shouldShowSellerSection(order);
  const sellerSaved = Boolean(order?.buyerReview?.sellerRating);
  const courierSection = shouldShowCourierSection(order);
  const courierSaved = Boolean(order?.buyerCourierReview?.rating);

  const productActionable = sectionActionable(productSaved, order?.buyerReview?.productCanEdit);
  const sellerActionable = sellerSection ? sectionActionable(sellerSaved, order?.buyerReview?.sellerCanEdit) : false;
  const courierActionable = courierSection ? sectionActionable(courierSaved, order?.buyerCourierReview?.canEdit) : false;
  return productActionable || sellerActionable || courierActionable;
}

export function getRateButtonLabel(order) {
  const productSaved = Boolean(order?.buyerReview?.productRating);
  const sellerSection = shouldShowSellerSection(order);
  const sellerSaved = Boolean(order?.buyerReview?.sellerRating);
  const courierSection = shouldShowCourierSection(order);
  const courierSaved = Boolean(order?.buyerCourierReview?.rating);
  const productActionable = sectionActionable(productSaved, order?.buyerReview?.productCanEdit);
  const sellerActionable = sellerSection ? sectionActionable(sellerSaved, order?.buyerReview?.sellerCanEdit) : false;
  const courierActionable = courierSection ? sectionActionable(courierSaved, order?.buyerCourierReview?.canEdit) : false;

  const productMissing = !productSaved;
  const sellerMissing = sellerSection && !sellerSaved;
  const courierMissing = courierSection && !courierSaved;
  if (productActionable && productMissing && sellerActionable && sellerMissing) return "Rate purchase";
  if (productActionable && productMissing) return "Rate product";
  if (sellerActionable && sellerMissing) return "Rate seller";
  if (courierActionable && courierMissing) return "Rate delivery";
  if (productActionable || sellerActionable || courierActionable) return "Update rating";
  return "Rate order";
}
