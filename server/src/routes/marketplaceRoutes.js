import { Router } from "express";
import { body, param } from "express-validator";
import {
  acceptBid,
  addFavorite,
  addCartItem,
  createBid,
  createCommunity,
  createExpense,
  createListing,
  createOrder,
  deleteExpense,
  deleteListing,
  getCourierModes,
  getListing,
  getMeOrderAttention,
  listBidsForOrder,
  listCartItems,
  patchCartItem,
  listExpenses,
  listFavorites,
  getCommunityById,
  listCommunities,
  updateCommunity,
  listListings,
  listMyBids,
  listMyListings,
  listOpenDeliveryOrders,
  listOrders,
  listUsersDirectory,
  listingsValidators,
  patchCourierModes,
  patchOrder,
  upsertOrderReview,
  putMeOrderAttention,
  removeFavorite,
  removeCartItem,
  listSellerBuyerFeedback,
  sellerSummary,
  updateListing,
} from "../controllers/marketplaceController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { communityImageUpload } from "../middleware/communityImageUpload.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";

const marketplaceRouter = Router();

marketplaceRouter.get("/communities", listCommunities);
marketplaceRouter.get("/communities/:id", [param("id").isUUID()], validate, getCommunityById);
marketplaceRouter.post("/communities", requireAuth, writeLimiter, communityImageUpload.single("image"), createCommunity);
marketplaceRouter.patch(
  "/communities/:id",
  requireAuth,
  writeLimiter,
  [param("id").isUUID()],
  validate,
  communityImageUpload.single("image"),
  updateCommunity,
);

marketplaceRouter.get("/listings", optionalAuth, listingsValidators.list, validate, listListings);
marketplaceRouter.get("/listings/:id", listingsValidators.idParam, validate, getListing);

marketplaceRouter.get("/users", requireAuth, listUsersDirectory);

marketplaceRouter.get("/me/listings", requireAuth, listMyListings);
marketplaceRouter.post(
  "/me/listings",
  requireAuth,
  writeLimiter,
  listingsValidators.create,
  validate,
  createListing,
);
marketplaceRouter.patch(
  "/me/listings/:id",
  requireAuth,
  writeLimiter,
  listingsValidators.idParam,
  validate,
  updateListing,
);
marketplaceRouter.delete("/me/listings/:id", requireAuth, writeLimiter, listingsValidators.idParam, validate, deleteListing);

marketplaceRouter.get("/me/favorites", requireAuth, listFavorites);
marketplaceRouter.post("/me/favorites/:listingId", requireAuth, writeLimiter, [param("listingId").isUUID()], validate, addFavorite);
marketplaceRouter.delete("/me/favorites/:listingId", requireAuth, writeLimiter, [param("listingId").isUUID()], validate, removeFavorite);

marketplaceRouter.get("/me/cart", requireAuth, listCartItems);
marketplaceRouter.post(
  "/me/cart/items",
  requireAuth,
  writeLimiter,
  [body("listingId").isUUID(), body("quantity").optional().isInt({ min: 1 }), body("comment").optional().isString().isLength({ max: 2000 })],
  validate,
  addCartItem,
);
marketplaceRouter.patch(
  "/me/cart/items/:listingId",
  requireAuth,
  writeLimiter,
  [param("listingId").isUUID(), body("quantity").isInt({ min: 1 })],
  validate,
  patchCartItem,
);
marketplaceRouter.delete("/me/cart/items/:listingId", requireAuth, writeLimiter, [param("listingId").isUUID()], validate, removeCartItem);

marketplaceRouter.post(
  "/orders",
  requireAuth,
  writeLimiter,
  [
    body("listingId").isUUID(),
    body("fulfillmentType").isIn(["pickup", "delivery"]),
    body("quantity").optional().isInt({ min: 1 }),
    body("comment").optional().isString().isLength({ max: 2000 }),
  ],
  validate,
  createOrder,
);
marketplaceRouter.get("/orders", requireAuth, listOrders);
marketplaceRouter.patch(
  "/orders/:id",
  requireAuth,
  writeLimiter,
  [param("id").isUUID(), body("transition").trim().isString().notEmpty()],
  validate,
  patchOrder,
);
marketplaceRouter.put(
  "/orders/:id/review",
  requireAuth,
  writeLimiter,
  [param("id").isUUID(), body("rating").isInt({ min: 1, max: 5 }), body("reviewText").optional({ checkFalsy: true }).isString().isLength({ max: 2000 })],
  validate,
  upsertOrderReview,
);
marketplaceRouter.get("/orders/:id/bids", requireAuth, [param("id").isUUID()], validate, listBidsForOrder);
marketplaceRouter.post(
  "/orders/:id/bids",
  requireAuth,
  writeLimiter,
  [param("id").isUUID(), body("amountCents").isInt({ min: 1 }), body("mode").isIn(["walk", "run", "bike"]), body("etaMinutes").optional().isInt({ min: 1 })],
  validate,
  createBid,
);
marketplaceRouter.post("/orders/:id/bids/:bidId/accept", requireAuth, writeLimiter, [param("id").isUUID(), param("bidId").isUUID()], validate, acceptBid);

marketplaceRouter.get("/delivery/open", requireAuth, listOpenDeliveryOrders);
marketplaceRouter.get("/delivery/my-bids", requireAuth, listMyBids);
marketplaceRouter.get("/me/courier-modes", requireAuth, getCourierModes);
marketplaceRouter.patch("/me/courier-modes", requireAuth, writeLimiter, [body("modes").isArray()], validate, patchCourierModes);

marketplaceRouter.get("/me/order-attention", requireAuth, getMeOrderAttention);
marketplaceRouter.put("/me/order-attention", requireAuth, writeLimiter, putMeOrderAttention);

marketplaceRouter.get("/me/seller/summary", requireAuth, sellerSummary);
marketplaceRouter.get("/me/seller/buyer-feedback", requireAuth, listSellerBuyerFeedback);
marketplaceRouter.get("/me/expenses", requireAuth, listExpenses);
marketplaceRouter.post(
  "/me/expenses",
  requireAuth,
  writeLimiter,
  [body("amountCents").isInt({ min: 0 }), body("category").optional().isString(), body("note").optional().isString(), body("occurredOn").optional().isString().trim()],
  validate,
  createExpense,
);
marketplaceRouter.delete("/me/expenses/:id", requireAuth, writeLimiter, [param("id").isUUID()], validate, deleteExpense);

export { marketplaceRouter };
