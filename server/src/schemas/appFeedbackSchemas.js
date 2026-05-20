import { body } from "express-validator";

const CATEGORIES = ["experience", "improvement", "concern", "other"];

export const appFeedbackValidators = {
  create: [
    body("category").trim().notEmpty().isIn(CATEGORIES).withMessage(`category must be one of: ${CATEGORIES.join(", ")}`),
    body("message").trim().notEmpty().isLength({ min: 1, max: 8000 }),
    body("clientPlatform").optional().trim().isLength({ max: 64 }),
  ],
};
