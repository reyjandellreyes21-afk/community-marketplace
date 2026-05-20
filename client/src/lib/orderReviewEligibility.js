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

/** Compare API/order ids without brittle strict equality (UUID casing, whitespace). */
export function normalizeOrderIdForCompare(id) {
  return String(id ?? "").trim().toLowerCase();
}

export function orderIdsMatch(a, b) {
  const na = normalizeOrderIdForCompare(a);
  const nb = normalizeOrderIdForCompare(b);
  return na !== "" && na === nb;
}

/** Overlay PUT `/orders/:id/review` — embed `review` when `order.buyerReview` is missing or stale. */
export function orderFromBuyerReviewPutPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const root = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data) ? payload.data : payload;
  const order = root.order;
  if (!order || typeof order !== "object") return null;
  const review = root.review;
  const buyerReview =
    review && typeof review === "object"
      ? { ...(typeof order.buyerReview === "object" ? order.buyerReview : {}), ...review }
      : order.buyerReview ?? null;
  return { ...order, buyerReview };
}

/** Overlay PUT `/orders/:id/courier-review`. */
export function orderFromCourierReviewPutPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const root = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data) ? payload.data : payload;
  const order = root.order;
  if (!order || typeof order !== "object") return null;
  const courierReview = root.courierReview;
  const buyerCourierReview =
    courierReview && typeof courierReview === "object"
      ? { ...(typeof order.buyerCourierReview === "object" ? order.buyerCourierReview : {}), ...courierReview }
      : order.buyerCourierReview ?? null;
  return { ...order, buyerCourierReview };
}

export function mergeOrderPreserveListing(prevOrder, mergedOrder) {
  if (!prevOrder || typeof prevOrder !== "object") return mergedOrder;
  if (!mergedOrder || typeof mergedOrder !== "object") return prevOrder;
  return {
    ...prevOrder,
    ...mergedOrder,
    listingTitle: mergedOrder.listingTitle ?? prevOrder.listingTitle,
    listingImageUrl: mergedOrder.listingImageUrl ?? prevOrder.listingImageUrl,
    listingImageUrls:
      Array.isArray(mergedOrder.listingImageUrls) && mergedOrder.listingImageUrls.length
        ? mergedOrder.listingImageUrls
        : prevOrder.listingImageUrls,
    listingCommunityId: mergedOrder.listingCommunityId ?? prevOrder.listingCommunityId,
  };
}

/**
 * After PUT /orders/:id/review: GET /orders may omit or stale `buyerReview`; PUT body is authoritative for review fields.
 */
export function mergeOrderAfterReviewPut(prevSnap, fromList, fromPut) {
  const put = fromPut && typeof fromPut === "object" ? fromPut : null;
  const listRow = fromList && typeof fromList === "object" ? fromList : null;
  let row =
    prevSnap && typeof prevSnap === "object" ? prevSnap : listRow || put;
  if (!row) row = listRow || put;
  if (!row) return null;
  if (listRow) row = mergeOrderPreserveListing(row, listRow);
  if (put) {
    row = mergeOrderPreserveListing(row, put);
    if (put.buyerReview && typeof put.buyerReview === "object") {
      row = {
        ...row,
        buyerReview: {
          ...(row.buyerReview && typeof row.buyerReview === "object" ? row.buyerReview : {}),
          ...put.buyerReview,
        },
      };
    }
  }
  return row;
}

/** After PUT /orders/:id/courier-review — same pattern for `buyerCourierReview`. */
export function mergeOrderAfterCourierReviewPut(prevSnap, fromList, fromPut) {
  const put = fromPut && typeof fromPut === "object" ? fromPut : null;
  const listRow = fromList && typeof fromList === "object" ? fromList : null;
  let row =
    prevSnap && typeof prevSnap === "object" ? prevSnap : listRow || put;
  if (!row) row = listRow || put;
  if (!row) return null;
  if (listRow) row = mergeOrderPreserveListing(row, listRow);
  if (put) {
    row = mergeOrderPreserveListing(row, put);
    if (put.buyerCourierReview && typeof put.buyerCourierReview === "object") {
      row = {
        ...row,
        buyerCourierReview: {
          ...(row.buyerCourierReview && typeof row.buyerCourierReview === "object" ? row.buyerCourierReview : {}),
          ...put.buyerCourierReview,
        },
      };
    }
  }
  return row;
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
