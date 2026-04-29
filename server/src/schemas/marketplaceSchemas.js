import { body, param, query } from "express-validator";

const requireListingCategory = body().custom((_, { req }) => {
  const categories = String(req.body?.categories ?? "").trim();
  const verticalId = String(req.body?.verticalId ?? "").trim();
  if (!categories && !verticalId) throw new Error("Categories is required.");
  return true;
});

export const marketplaceSchemas = {
  communityIdParam: [param("id").isUUID()],
  listingIdParam: [param("id").isUUID()],
  listingIdRouteParam: [param("listingId").isUUID()],
  orderIdParam: [param("id").isUUID()],
  orderBidIdParams: [param("id").isUUID(), param("bidId").isUUID()],
  expenseIdParam: [param("id").isUUID()],

  listListings: [
    query("categories").optional().isString(),
    query("verticalId").optional().isString(),
    query("subId").optional().isString(),
    query("communityId").optional().isUUID(),
    query("lat").optional().isFloat(),
    query("lng").optional().isFloat(),
    query("radiusKm").optional().isFloat({ min: 0.5, max: 500 }),
  ],
  createListing: [
    body("title").isString().trim().isLength({ min: 2, max: 200 }),
    body("description").optional().isString().isLength({ max: 8000 }),
    body("priceCents").isInt({ min: 0 }),
    body("quantity").isInt({ min: 0 }),
    body("categories").optional().isString().trim().notEmpty().isLength({ min: 1, max: 32 }),
    body("verticalId").optional().isString().trim().notEmpty().isLength({ min: 1, max: 32 }),
    requireListingCategory,
    body("subId").optional({ values: "null" }).isString().trim(),
    body("fulfillmentModes").optional().isArray(),
    body("cityLabel").optional().isString().trim(),
    body("lat").optional().isFloat(),
    body("lng").optional().isFloat(),
    body("imageUrl").optional().isString(),
  ],

  addCartItem: [
    body("listingId").isUUID(),
    body("quantity").optional().isInt({ min: 1 }),
    body("comment").optional().isString().isLength({ max: 2000 }),
  ],
  patchCartItem: [param("listingId").isUUID(), body("quantity").isInt({ min: 1 })],

  createOrder: [
    body("listingId").isUUID(),
    body("fulfillmentType").isIn(["pickup", "delivery"]),
    body("quantity").optional().isInt({ min: 1 }),
  ],
  patchOrder: [param("id").isUUID(), body("transition").isString().notEmpty()],

  createBid: [
    param("id").isUUID(),
    body("amountCents").isInt({ min: 1 }),
    body("mode").isIn(["walk", "run", "bike"]),
    body("etaMinutes").optional().isInt({ min: 1 }),
  ],

  patchCourierModes: [body("modes").isArray()],
  createExpense: [
    body("amountCents").isInt({ min: 0 }),
    body("category").optional().isString(),
    body("note").optional().isString(),
    body("occurredOn").optional().isString().trim(),
  ],
};
