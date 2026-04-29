import { Router } from "express";
import { getMe, googleAuth, login, register, updateMe } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { authSchemas } from "../schemas/authSchemas.js";

const authRouter = Router();

authRouter.post(
  "/register",
  authLimiter,
  authSchemas.register,
  validate,
  register,
);

authRouter.post(
  "/login",
  authLimiter,
  authSchemas.login,
  validate,
  login,
);

authRouter.post("/google", authLimiter, authSchemas.google, validate, googleAuth);
authRouter.get("/me", requireAuth, getMe);
authRouter.patch("/me", requireAuth, updateMe);

export { authRouter };
