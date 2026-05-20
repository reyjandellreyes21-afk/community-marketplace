import { Router } from "express";
import { createAppFeedback } from "../controllers/appFeedbackController.js";
import { requireAuth } from "../middleware/auth.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { appFeedbackValidators } from "../schemas/appFeedbackSchemas.js";

const appFeedbackRouter = Router();

appFeedbackRouter.post(
  "/app-feedback",
  requireAuth,
  writeLimiter,
  appFeedbackValidators.create,
  validate,
  createAppFeedback,
);

export { appFeedbackRouter };
