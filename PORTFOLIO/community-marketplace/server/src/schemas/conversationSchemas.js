import { body, param, query } from "express-validator";

/** Validation chains for conversation routes (used with `validate` middleware). */
export const conversationsValidators = {
  create: [
    body("type").isIn(["direct", "order"]),
    body("targetUserId").optional({ nullable: true }).isUUID(),
    body("orderId").optional({ nullable: true }).isUUID(),
    body("roleHint").optional({ nullable: true }).isIn(["buyer", "seller", "courier"]),
  ],
  conversationId: [param("id").isUUID()],
  listMessages: [param("id").isUUID(), query("limit").optional().isInt({ min: 1, max: 200 }), query("before").optional().isUUID()],
  createMessage: [param("id").isUUID(), body("body").isString().trim().isLength({ min: 1, max: 4000 })],
  markRead: [param("id").isUUID(), body("lastReadMessageId").optional({ nullable: true }).isUUID()],
};
