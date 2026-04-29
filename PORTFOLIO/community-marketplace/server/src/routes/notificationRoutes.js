import { Router } from "express";
import { listNotifications, markNotificationRead, markNotificationsReadBulk } from "../controllers/notificationsController.js";
import { requireAuth } from "../middleware/auth.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { notificationsValidators } from "../schemas/notificationSchemas.js";

const notificationRouter = Router();

notificationRouter.get("/notifications", requireAuth, notificationsValidators.list, validate, listNotifications);
notificationRouter.patch(
  "/notifications/:id/read",
  requireAuth,
  writeLimiter,
  notificationsValidators.markReadOne,
  validate,
  markNotificationRead,
);
notificationRouter.patch(
  "/notifications/read",
  requireAuth,
  writeLimiter,
  notificationsValidators.markReadMany,
  validate,
  markNotificationsReadBulk,
);

export { notificationRouter };
