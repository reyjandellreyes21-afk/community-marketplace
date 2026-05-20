import { Router } from "express";
import {
  changePassword,
  getMe,
  googleAuth,
  login,
  register,
  resendSignupConfirmation,
  sendPhoneVerificationCode,
  updateMe,
  uploadMyAvatar,
  verifyPhoneCode,
} from "../controllers/authController.js";
import { avatarUpload } from "../middleware/avatarUpload.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter, writeLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { authValidators } from "../schemas/authSchemas.js";

const authRouter = Router();

authRouter.post("/register", authLimiter, [...authValidators.register, validate], register);

authRouter.post("/resend-confirmation", authLimiter, [...authValidators.resendConfirmation, validate], resendSignupConfirmation);

authRouter.post("/login", authLimiter, [...authValidators.login, validate], login);

authRouter.post("/google", authLimiter, [...authValidators.google, validate], googleAuth);
authRouter.get("/me", requireAuth, getMe);
authRouter.post("/me/avatar", requireAuth, writeLimiter, avatarUpload.single("avatar"), uploadMyAvatar);
authRouter.patch("/me", requireAuth, updateMe);
authRouter.patch(
  "/me/password",
  requireAuth,
  writeLimiter,
  [...authValidators.changePassword, validate],
  changePassword,
);

authRouter.post("/phone/send-code", requireAuth, writeLimiter, sendPhoneVerificationCode);
authRouter.post(
  "/phone/verify-code",
  requireAuth,
  writeLimiter,
  [...authValidators.verifyPhoneCode, validate],
  verifyPhoneCode,
);

export { authRouter };
