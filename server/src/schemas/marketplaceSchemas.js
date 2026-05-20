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
    query("includeOwn").optional().isIn(["true", "false", "1", "0"]),
    query("q").optional().isString().isLength({ min: 1, max: 120 }),
    query("lat").optional().isFloat(),
    query("lng").optional().isFloat(),
    query("radiusKm").optional().isFloat({ min: 0.5, max: 500 }),
    query("limit").optional().isInt({ min: 1, max: 60 }),
    query("offset").optional().isInt({ min: 0, max: 5000 }),
    query("sellerId").optional().isUUID(),
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
    body("imageFocalRects")
      .optional()
      .isArray()
      .custom((v) => {
        if (v == null) return true;
        if (!Array.isArray(v) || v.length > 6) throw new Error("At most six image focal rects are allowed.");
        for (const item of v) {
          if (item == null || typeof item !== "object" || Array.isArray(item)) {
            throw new Error("Each imageFocalRects entry must be an object.");
          }
          const cropSize = Number(item.cropSize);
          if (!Number.isFinite(cropSize) || cropSize < 0.2 || cropSize > 1) {
            throw new Error("cropSize must be between 0.2 and 1.");
          }
        }
        return true;
      }),
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
    body("serviceMeta")
      .optional({ nullable: true })
      .custom((v) => {
        if (v == null) return true;
        if (typeof v !== "object" || Array.isArray(v)) throw new Error("serviceMeta must be an object.");
        const len = JSON.stringify(v).length;
        if (len > 20000) throw new Error("serviceMeta is too large.");
        return true;
      }),
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
    body("imageFocalRects")
      .optional()
      .isArray()
      .custom((v) => {
        if (v == null) return true;
        if (!Array.isArray(v) || v.length > 6) throw new Error("At most six image focal rects are allowed.");
        for (const item of v) {
          if (item == null || typeof item !== "object" || Array.isArray(item)) {
            throw new Error("Each imageFocalRects entry must be an object.");
          }
          const cropSize = Number(item.cropSize);
          if (!Number.isFinite(cropSize) || cropSize < 0.2 || cropSize > 1) {
            throw new Error("cropSize must be between 0.2 and 1.");
          }
        }
        return true;
      }),
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
    body("serviceMeta")
      .optional({ nullable: true })
      .custom((v) => {
        if (v == null) return true;
        if (typeof v !== "object" || Array.isArray(v)) throw new Error("serviceMeta must be an object.");
        const len = JSON.stringify(v).length;
        if (len > 20000) throw new Error("serviceMeta is too large.");
        return true;
      }),
    body("communityId").optional({ nullable: true }).isUUID(),
    body("status").optional().isIn(["active", "paused", "sold"]),
  ],
  idParam: [param("id").isUUID()],
};

/** Additional marketplace route validators (param/body chains only). */
export const marketplaceRouteValidators = {
  communityIdParam: [param("id").isUUID()],
  communityCouriersParam: [param("communityId").isUUID()],
  sellerIdParam: [param("sellerId").isUUID()],
  listingIdParam: [param("listingId").isUUID()],
  cartAdd: [
    body("listingId").isUUID(),
    body("quantity").optional().isInt({ min: 1 }),
    body("comment").optional().isString().isLength({ max: 2000 }),
    body("variantSignature").optional().isString().isLength({ max: 512 }),
    body("fulfillmentType").optional().isIn(["pickup", "delivery"]),
  ],
  cartPatch: [
    param("listingId").isUUID(),
    body("quantity").isInt({ min: 1 }),
    body("fulfillmentType").optional().isIn(["pickup", "delivery"]),
    query("lineSignature").matches(/^[a-f0-9]{64}$/),
  ],
  cartDelete: [param("listingId").isUUID(), query("lineSignature").matches(/^[a-f0-9]{64}$/)],
  createOrder: [
    body("listingId").isUUID(),
    body("fulfillmentType").isIn(["pickup", "delivery"]),
    body("quantity").optional().isInt({ min: 1 }),
    body("comment").optional().isString().isLength({ max: 2000 }),
    body("variantSignature").optional().isString().isLength({ max: 512 }),
    body("buyerCourierContributionCents").optional().isInt({ min: 0, max: 10000000 }),
    body("serviceBookingDate").optional().isString().trim().isLength({ min: 10, max: 10 }),
    body("serviceBookingTime").optional().isString().trim().isLength({ min: 5, max: 5 }),
    body("service_booking_date").optional().isString().trim().isLength({ min: 10, max: 10 }),
    body("service_booking_time").optional().isString().trim().isLength({ min: 5, max: 5 }),
  ],
  patchOrder: [
    param("id").isUUID(),
    body("transition").trim().isString().notEmpty(),
    body("cancellationReason")
      .optional()
      .isIn(["change_of_mind", "change_variant", "better_price_elsewhere", "placed_by_mistake", "other"]),
    body("cancellationNote").optional({ nullable: true }).isString().isLength({ max: 500 }),
    body("sellerCourierContributionCents").optional().isInt({ min: 0, max: 10000000 }),
    body("buyerCourierContributionCents").optional().isInt({ min: 0, max: 10000000 }),
  ],
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
    /** JSON bodies often send numbers; `validator.isInt` only accepts strings — use numeric check. */
    body("productRating")
      .optional({ nullable: true })
      .custom((v) => {
        if (v === undefined || v === null || v === "") return true;
        const n = Number(v);
        return Number.isInteger(n) && n >= 1 && n <= 5;
      })
      .withMessage("productRating must be an integer from 1 to 5"),
    body("sellerRating")
      .optional({ nullable: true })
      .custom((v) => {
        if (v === undefined || v === null || v === "") return true;
        const n = Number(v);
        return Number.isInteger(n) && n >= 1 && n <= 5;
      })
      .withMessage("sellerRating must be an integer from 1 to 5"),
    body("productReviewText").optional({ nullable: true }).isString().isLength({ max: 2000 }),
    body("sellerReviewText").optional({ nullable: true }).isString().isLength({ max: 2000 }),
    body("product_rating")
      .optional({ nullable: true })
      .custom((v) => {
        if (v === undefined || v === null || v === "") return true;
        const n = Number(v);
        return Number.isInteger(n) && n >= 1 && n <= 5;
      }),
    body("seller_rating")
      .optional({ nullable: true })
      .custom((v) => {
        if (v === undefined || v === null || v === "") return true;
        const n = Number(v);
        return Number.isInteger(n) && n >= 1 && n <= 5;
      }),
    body("product_review_text").optional({ nullable: true }).isString().isLength({ max: 2000 }),
    body("seller_review_text").optional({ nullable: true }).isString().isLength({ max: 2000 }),
  ],
  orderCourierReview: [
    param("id").isUUID(),
    body("rating")
      .custom((v) => {
        const n = Number(v);
        return Number.isInteger(n) && n >= 1 && n <= 5;
      })
      .withMessage("rating must be an integer from 1 to 5"),
    body("tags").optional().isArray(),
    body("abuseNote").optional({ nullable: true }).isString().isLength({ max: 500 }),
  ],
  orderIdParam: [param("id").isUUID()],
  patchCourierModes: [body("modes").isArray()],
  patchCourierPresence: [
    body("courierStatus").optional().isIn(["offline", "available", "active"]),
    body("courier_status").optional().isIn(["offline", "available", "active"]),
    body("optionalTags").optional().isArray(),
    body("optional_tags").optional().isArray(),
    body("suggestedCompensationCents").optional({ nullable: true }).isInt({ min: 0, max: 10000000 }),
    body("suggested_compensation_cents").optional({ nullable: true }).isInt({ min: 0, max: 10000000 }),
    body("allowCourierTaskNotifications").optional().isBoolean(),
    body("pushNotificationToken").optional({ nullable: true }).isString().isLength({ max: 512 }),
    body("pushNotificationPlatform").optional({ nullable: true }).isIn(["fcm", "apns", ""]),
    body().custom((_, { req }) => {
      const b = req.body || {};
      const keys = [
        "courierStatus",
        "courier_status",
        "optionalTags",
        "optional_tags",
        "suggestedCompensationCents",
        "suggested_compensation_cents",
        "allowCourierTaskNotifications",
        "pushNotificationToken",
        "pushNotificationPlatform",
      ];
      if (keys.some((k) => Object.prototype.hasOwnProperty.call(b, k))) return true;
      throw new Error("Provide at least one field to update.");
    }),
  ],
  assignCommunityCourier: [
    param("id").isUUID(),
    body("courierId").isUUID(),
    body("mode").optional().isIn(["walk", "run", "bike", "others"]),
  ],
  claimCommunityCourier: [param("id").isUUID(), body("mode").optional().isIn(["walk", "run", "bike", "others"])],
  respondCourierInvitation: [
    param("id").isUUID(),
    body("accept").isBoolean(),
    body("mode").optional().isIn(["walk", "run", "bike", "others"]),
  ],
  createExpense: [
    body("amountCents").isInt({ min: 0 }),
    body("category").optional().isString(),
    body("note").optional().isString(),
    body("occurredOn").optional().isString().trim(),
  ],
  expenseIdParam: [param("id").isUUID()],
  sellerDashboardQuery: [
    query("preset").optional().isIn(["today", "week", "month", "year", "custom"]),
    query("startDate").optional().isISO8601(),
    query("endDate").optional().isISO8601(),
  ],
  createSellerLedgerEntry: [
    body("entryType").isIn(["income", "expense", "stock_in", "stock_out"]),
    body("source").optional().isIn(["manual", "in_app"]),
    body("amountCents").optional().isInt({ min: 0 }),
    body("quantityDelta").optional().isInt({ min: -1000000, max: 1000000 }),
    body("listingId").optional({ nullable: true }).isUUID(),
    body("itemName").optional({ nullable: true }).isString().isLength({ max: 200 }),
    body("category").optional({ nullable: true }).isString().isLength({ min: 1, max: 64 }),
    body("note").optional({ nullable: true }).isString().isLength({ max: 2000 }),
    body("occurredAt").optional({ nullable: true }).isISO8601(),
  ],
};
