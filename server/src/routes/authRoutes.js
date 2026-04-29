import { Router } from "express";
import { getMe, googleAuth, login, register, updateMe } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { authValidators } from "../schemas/authSchemas.js";

const authRouter = Router();

authRouter.post("/register", authLimiter, [...authValidators.register, validate], register);

authRouter.post("/login", authLimiter, [...authValidators.login, validate], login);

authRouter.post("/google", authLimiter, [...authValidators.google, validate], googleAuth);
authRouter.get("/me", requireAuth, getMe);
authRouter.patch("/me", requireAuth, updateMe);

export { authRouter };
