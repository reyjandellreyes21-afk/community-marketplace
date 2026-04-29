import { body, param, query } from "express-validator";

/**
 * Listing-related validation (shared across GET/POST/PATCH listing routes).
 * Used with `validate` middleware.
 */
export const listingsValidators = {
  list: [
    query("categories").optional().isString(),
    query("verticalId").optional().isString(),
    query("subId").optional().isString(),
    query("communityId").optional().isUUID(),
    query("q").optional().isString().isLength({ min: 1, max: 120 }),
    query("lat").optional().isFloat(),
    query("lng").optional().isFloat(),
    query("radiusKm").optional().isFloat({ min: 0.5, max: 500 }),
    query("limit").optional().isInt({ min: 1, max: 60 }),
    query("offset").optional().isInt({ min: 0, max: 5000 }),
  ],
  create: [
    body("title").isString().trim().isLength({ min: 2, max: 200 }),
    body("description").optional().isString().isLength({ max: 2000 }),
    body("priceCents").isInt({ min: 0 }),
    body("quantity").isInt({ min: 0 }),
    body("categories").optional().isString().trim().notEmpty().isLength({ min: 1, max: 32 }),
    body("verticalId").optional().isString().trim().notEmpty().isLength({ min: 1, max: 32 }),
    body().custom((_, { req }) => {
      const categories = String(req.body?.categories ?? "").trim();
      const verticalId = String(req.body?.verticalId ?? "").trim();
      if (!categories && !verticalId) throw new Error("Categories is required.");
      return true;
    }),
    body("subId")
      .optional({ nullable: true })
      .custom((v) => v === null || v === undefined || v === "" || (typeof v === "string" && v.trim().length <= 64)),
    body("fulfillmentModes").optional().isArray(),
    body("cityLabel").optional().isString().trim(),
    body("lat").optional().isFloat(),
    body("lng").optional().isFloat(),
    body("imageUrl").optional().isString(),
    body("imageUrls").optional().isArray(),
    body("optionNameA").optional().isString().isLength({ max: 120 }),
    body("optionValuesA").optional().isArray(),
    body("optionNameB").optional().isString().isLength({ max: 120 }),
    body("optionValuesB").optional().isArray(),
    body("variants")
      .optional()
      .isArray()
      .custom((v) => {
        if (v == null) return true;
        if (Array.isArray(v) && v.length <= 2) return true;
        throw new Error("At most two variant groups are allowed.");
      }),
    body("orderType").optional().isIn(["in_stock", "pre_order"]),
    body("processingTime").optional().isString().isLength({ max: 120 }),
  ],
  patch: [
    body("title").optional().isString().trim().isLength({ min: 2, max: 200 }),
    body("description").optional({ nullable: true }).isString().isLength({ max: 2000 }),
    body("priceCents").optional().isInt({ min: 0 }),
    body("quantity").optional().isInt({ min: 0 }),
    body("categories").optional().isString().trim().isLength({ min: 1, max: 32 }),
    body("verticalId").optional().isString().trim().isLength({ min: 1, max: 32 }),
    body("subId")
      .optional({ nullable: true })
      .custom((v) => v === null || v === undefined || v === "" || (typeof v === "string" && v.trim().length <= 64)),
    body("fulfillmentModes").optional().isArray(),
    body("cityLabel").optional({ nullable: true }).isString(),
    body("lat").optional({ nullable: true }).isFloat(),
    body("lng").optional({ nullable: true }).isFloat(),
    body("imageUrl").optional({ nullable: true }).isString(),
    body("imageUrls").optional().isArray(),
    body("optionNameA").optional({ nullable: true }).isString().isLength({ max: 120 }),
    body("optionValuesA").optional().isArray(),
    body("optionNameB").optional({ nullable: true }).isString().isLength({ max: 120 }),
    body("optionValuesB").optional().isArray(),
    body("variants")
      .optional()
      .isArray()
      .custom((v) => {
        if (v == null) return true;
        if (Array.isArray(v) && v.length <= 2) return true;
        throw new Error("At most two variant groups are allowed.");
      }),
    body("orderType").optional().isIn(["in_stock", "pre_order"]),
    body("processingTime").optional({ nullable: true }).isString().isLength({ max: 120 }),
    body("communityId").optional({ nullable: true }).isUUID(),
    body("status").optional().isIn(["active", "paused", "sold"]),
  ],
  idParam: [param("id").isUUID()],
};

/** Additional marketplace route validators (param/body chains only). */
export const marketplaceRouteValidators = {
  communityIdParam: [param("id").isUUID()],
  listingIdParam: [param("listingId").isUUID()],
  cartAdd: [
    body("listingId").isUUID(),
    body("quantity").optional().isInt({ min: 1 }),
    body("comment").optional().isString().isLength({ max: 2000 }),
  ],
  cartPatch: [param("listingId").isUUID(), body("quantity").isInt({ min: 1 })],
  createOrder: [
    body("listingId").isUUID(),
    body("fulfillmentType").isIn(["pickup", "delivery"]),
    body("quantity").optional().isInt({ min: 1 }),
    body("comment").optional().isString().isLength({ max: 2000 }),
  ],
  patchOrder: [param("id").isUUID(), body("transition").trim().isString().notEmpty()],
  listOrders: [
    query("role").optional().isIn(["buyer", "seller"]),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("offset").optional().isInt({ min: 0, max: 10000 }),
  ],
  listUsers: [
    query("limit").optional().isInt({ min: 1, max: 300 }),
    query("offset").optional().isInt({ min: 0, max: 20000 }),
  ],
  orderReview: [
    param("id").isUUID(),
    body("rating").isInt({ min: 1, max: 5 }),
    body("reviewText").optional({ checkFalsy: true }).isString().isLength({ max: 2000 }),
  ],
  orderIdParam: [param("id").isUUID()],
  createBid: [
    param("id").isUUID(),
    body("amountCents").isInt({ min: 1 }),
    body("mode").isIn(["walk", "run", "bike"]),
    body("etaMinutes").optional().isInt({ min: 1 }),
  ],
  acceptBid: [param("id").isUUID(), param("bidId").isUUID()],
  patchCourierModes: [body("modes").isArray()],
  createExpense: [
    body("amountCents").isInt({ min: 0 }),
    body("category").optional().isString(),
    body("note").optional().isString(),
    body("occurredOn").optional().isString().trim(),
  ],
  expenseIdParam: [param("id").isUUID()],
};
