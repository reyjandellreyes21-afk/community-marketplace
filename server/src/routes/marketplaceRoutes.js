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
  putMeOrderAttention,
  removeFavorite,
  removeCartItem,
  sellerSummary,
  updateListing,
} from "../controllers/marketplaceController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { communityImageUpload } from "../middleware/communityImageUpload.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { marketplaceSchemas } from "../schemas/marketplaceSchemas.js";

const marketplaceRouter = Router();

marketplaceRouter.get("/communities", listCommunities);
marketplaceRouter.get("/communities/:id", marketplaceSchemas.communityIdParam, validate, getCommunityById);
marketplaceRouter.post("/communities", requireAuth, writeLimiter, communityImageUpload.single("image"), createCommunity);
marketplaceRouter.patch(
  "/communities/:id",
  requireAuth,
  writeLimiter,
  marketplaceSchemas.communityIdParam,
  validate,
  communityImageUpload.single("image"),
  updateCommunity,
);

marketplaceRouter.get("/listings", optionalAuth, marketplaceSchemas.listListings, validate, listListings);
marketplaceRouter.get("/listings/:id", marketplaceSchemas.listingIdParam, validate, getListing);

marketplaceRouter.get("/users", requireAuth, listUsersDirectory);

marketplaceRouter.get("/me/listings", requireAuth, listMyListings);
marketplaceRouter.post(
  "/me/listings",
  requireAuth,
  writeLimiter,
  marketplaceSchemas.createListing,
  validate,
  createListing,
);
marketplaceRouter.patch(
  "/me/listings/:id",
  requireAuth,
  writeLimiter,
  marketplaceSchemas.listingIdParam,
  validate,
  updateListing,
);
marketplaceRouter.delete("/me/listings/:id", requireAuth, writeLimiter, marketplaceSchemas.listingIdParam, validate, deleteListing);

marketplaceRouter.get("/me/favorites", requireAuth, listFavorites);
marketplaceRouter.post("/me/favorites/:listingId", requireAuth, writeLimiter, marketplaceSchemas.listingIdRouteParam, validate, addFavorite);
marketplaceRouter.delete("/me/favorites/:listingId", requireAuth, writeLimiter, marketplaceSchemas.listingIdRouteParam, validate, removeFavorite);

marketplaceRouter.get("/me/cart", requireAuth, listCartItems);
marketplaceRouter.post(
  "/me/cart/items",
  requireAuth,
  writeLimiter,
  marketplaceSchemas.addCartItem,
  validate,
  addCartItem,
);
marketplaceRouter.patch(
  "/me/cart/items/:listingId",
  requireAuth,
  writeLimiter,
  marketplaceSchemas.patchCartItem,
  validate,
  patchCartItem,
);
marketplaceRouter.delete("/me/cart/items/:listingId", requireAuth, writeLimiter, marketplaceSchemas.listingIdRouteParam, validate, removeCartItem);

marketplaceRouter.post(
  "/orders",
  requireAuth,
  writeLimiter,
  marketplaceSchemas.createOrder,
  validate,
  createOrder,
);
marketplaceRouter.get("/orders", requireAuth, listOrders);
marketplaceRouter.patch(
  "/orders/:id",
  requireAuth,
  writeLimiter,
  marketplaceSchemas.patchOrder,
  validate,
  patchOrder,
);
marketplaceRouter.get("/orders/:id/bids", requireAuth, marketplaceSchemas.orderIdParam, validate, listBidsForOrder);
marketplaceRouter.post(
  "/orders/:id/bids",
  requireAuth,
  writeLimiter,
  marketplaceSchemas.createBid,
  validate,
  createBid,
);
marketplaceRouter.post("/orders/:id/bids/:bidId/accept", requireAuth, writeLimiter, marketplaceSchemas.orderBidIdParams, validate, acceptBid);

marketplaceRouter.get("/delivery/open", requireAuth, listOpenDeliveryOrders);
marketplaceRouter.get("/delivery/my-bids", requireAuth, listMyBids);
marketplaceRouter.get("/me/courier-modes", requireAuth, getCourierModes);
marketplaceRouter.patch("/me/courier-modes", requireAuth, writeLimiter, marketplaceSchemas.patchCourierModes, validate, patchCourierModes);

marketplaceRouter.get("/me/order-attention", requireAuth, getMeOrderAttention);
marketplaceRouter.put("/me/order-attention", requireAuth, writeLimiter, putMeOrderAttention);

marketplaceRouter.get("/me/seller/summary", requireAuth, sellerSummary);
marketplaceRouter.get("/me/expenses", requireAuth, listExpenses);
marketplaceRouter.post(
  "/me/expenses",
  requireAuth,
  writeLimiter,
  marketplaceSchemas.createExpense,
  validate,
  createExpense,
);
marketplaceRouter.delete("/me/expenses/:id", requireAuth, writeLimiter, marketplaceSchemas.expenseIdParam, validate, deleteExpense);

export { marketplaceRouter };
