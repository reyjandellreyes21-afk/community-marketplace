import { Router } from "express";
import {
  createConversation,
  listConversations,
  listConversationMessages,
  createConversationMessage,
  markConversationRead,
} from "../controllers/conversationsController.js";
import { requireAuth } from "../middleware/auth.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { conversationsValidators } from "../schemas/conversationSchemas.js";

const conversationRouter = Router();

conversationRouter.get("/conversations", requireAuth, listConversations);
conversationRouter.post("/conversations", requireAuth, writeLimiter, conversationsValidators.create, validate, createConversation);
conversationRouter.get(
  "/conversations/:id/messages",
  requireAuth,
  conversationsValidators.listMessages,
  validate,
  listConversationMessages,
);
conversationRouter.post(
  "/conversations/:id/messages",
  requireAuth,
  writeLimiter,
  conversationsValidators.createMessage,
  validate,
  createConversationMessage,
);
conversationRouter.patch(
  "/conversations/:id/read",
  requireAuth,
  writeLimiter,
  conversationsValidators.markRead,
  validate,
  markConversationRead,
);

export { conversationRouter };
