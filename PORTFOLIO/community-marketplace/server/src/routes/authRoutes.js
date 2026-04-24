import { Router } from "express";
import { body } from "express-validator";
import { getMe, googleAuth, login, register, updateMe } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";

const authRouter = Router();

authRouter.post(
  "/register",
  authLimiter,
  [
    body("acceptedTerms").isBoolean().custom((value) => value === true),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
    validate,
  ],
  register,
);

authRouter.post(
  "/login",
  authLimiter,
  [body("email").isEmail().normalizeEmail(), body("password").isLength({ min: 8 }), validate],
  login,
);

authRouter.post("/google", authLimiter, [body("credential").isString().notEmpty(), validate], googleAuth);
authRouter.get("/me", requireAuth, getMe);
authRouter.patch("/me", requireAuth, updateMe);

export { authRouter };
