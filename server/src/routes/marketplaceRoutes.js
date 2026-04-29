import { Router } from "express";
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
import { listingsValidators, marketplaceRouteValidators } from "../schemas/marketplaceSchemas.js";

const marketplaceRouter = Router();

marketplaceRouter.get("/communities", listCommunities);
marketplaceRouter.get("/communities/:id", marketplaceRouteValidators.communityIdParam, validate, getCommunityById);
marketplaceRouter.post("/communities", requireAuth, writeLimiter, communityImageUpload.single("image"), createCommunity);
marketplaceRouter.patch(
  "/communities/:id",
  requireAuth,
  writeLimiter,
  marketplaceRouteValidators.communityIdParam,
  validate,
  communityImageUpload.single("image"),
  updateCommunity,
);

marketplaceRouter.get("/listings", optionalAuth, listingsValidators.list, validate, listListings);
marketplaceRouter.get("/listings/:id", listingsValidators.idParam, validate, getListing);

marketplaceRouter.get("/users", requireAuth, marketplaceRouteValidators.listUsers, validate, listUsersDirectory);

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
  listingsValidators.patch,
  validate,
  updateListing,
);
marketplaceRouter.delete("/me/listings/:id", requireAuth, writeLimiter, listingsValidators.idParam, validate, deleteListing);

marketplaceRouter.get("/me/favorites", requireAuth, listFavorites);
marketplaceRouter.post("/me/favorites/:listingId", requireAuth, writeLimiter, marketplaceRouteValidators.listingIdParam, validate, addFavorite);
marketplaceRouter.delete("/me/favorites/:listingId", requireAuth, writeLimiter, marketplaceRouteValidators.listingIdParam, validate, removeFavorite);

marketplaceRouter.get("/me/cart", requireAuth, listCartItems);
marketplaceRouter.post(
  "/me/cart/items",
  requireAuth,
  writeLimiter,
  marketplaceRouteValidators.cartAdd,
  validate,
  addCartItem,
);
marketplaceRouter.patch(
  "/me/cart/items/:listingId",
  requireAuth,
  writeLimiter,
  marketplaceRouteValidators.cartPatch,
  validate,
  patchCartItem,
);
marketplaceRouter.delete("/me/cart/items/:listingId", requireAuth, writeLimiter, marketplaceRouteValidators.listingIdParam, validate, removeCartItem);

marketplaceRouter.post(
  "/orders",
  requireAuth,
  writeLimiter,
  marketplaceRouteValidators.createOrder,
  validate,
  createOrder,
);
marketplaceRouter.get("/orders", requireAuth, marketplaceRouteValidators.listOrders, validate, listOrders);
marketplaceRouter.patch(
  "/orders/:id",
  requireAuth,
  writeLimiter,
  marketplaceRouteValidators.patchOrder,
  validate,
  patchOrder,
);
marketplaceRouter.put(
  "/orders/:id/review",
  requireAuth,
  writeLimiter,
  marketplaceRouteValidators.orderReview,
  validate,
  upsertOrderReview,
);
marketplaceRouter.get("/orders/:id/bids", requireAuth, marketplaceRouteValidators.orderIdParam, validate, listBidsForOrder);
marketplaceRouter.post(
  "/orders/:id/bids",
  requireAuth,
  writeLimiter,
  marketplaceRouteValidators.createBid,
  validate,
  createBid,
);
marketplaceRouter.post("/orders/:id/bids/:bidId/accept", requireAuth, writeLimiter, marketplaceRouteValidators.acceptBid, validate, acceptBid);

marketplaceRouter.get("/delivery/open", requireAuth, listOpenDeliveryOrders);
marketplaceRouter.get("/delivery/my-bids", requireAuth, listMyBids);
marketplaceRouter.get("/me/courier-modes", requireAuth, getCourierModes);
marketplaceRouter.patch("/me/courier-modes", requireAuth, writeLimiter, marketplaceRouteValidators.patchCourierModes, validate, patchCourierModes);

marketplaceRouter.get("/me/order-attention", requireAuth, getMeOrderAttention);
marketplaceRouter.put("/me/order-attention", requireAuth, writeLimiter, putMeOrderAttention);

marketplaceRouter.get("/me/seller/summary", requireAuth, sellerSummary);
marketplaceRouter.get("/me/seller/buyer-feedback", requireAuth, listSellerBuyerFeedback);
marketplaceRouter.get("/me/expenses", requireAuth, listExpenses);
marketplaceRouter.post(
  "/me/expenses",
  requireAuth,
  writeLimiter,
  marketplaceRouteValidators.createExpense,
  validate,
  createExpense,
);
marketplaceRouter.delete("/me/expenses/:id", requireAuth, writeLimiter, marketplaceRouteValidators.expenseIdParam, validate, deleteExpense);

export { marketplaceRouter };
