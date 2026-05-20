import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config/config.js";
import { sendPhoneVerificationCode, uploadMyAvatar, verifyPhoneCode } from "./controllers/authController.js";
import { createCommunity, listCommunities } from "./controllers/marketplaceController.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandlers.js";
import { requireAuth } from "./middleware/auth.js";
import { avatarUpload } from "./middleware/avatarUpload.js";
import { communityImageUpload } from "./middleware/communityImageUpload.js";
import { assignRequestId } from "./middleware/requestId.js";
import { validate } from "./middleware/validate.js";
import { globalApiLimiter, writeLimiter } from "./middleware/rateLimit.js";
import { apiRouter } from "./routes/index.js";
import { authValidators } from "./schemas/authSchemas.js";

const app = express();
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

const corsOptions = {
  origin:
    config.corsOrigins && config.corsOrigins.length > 0
      ? config.corsOrigins
      : true,
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: "12mb" }));
app.use(assignRequestId);
app.use(globalApiLimiter);
app.use(morgan("dev"));

/** Registered on the root app so these paths always match (also on `apiRouter` for consistency). */
const communityPostChain = [
  requireAuth,
  writeLimiter,
  communityImageUpload.single("image"),
  createCommunity,
];
for (const path of ["/api/v1/communities", "/api/v1/communities/", "/api/communities", "/api/communities/"]) {
  app.get(path, listCommunities);
  app.post(path, ...communityPostChain);
}

/** Profile avatar: registered here so multipart POST matches reliably (same idea as communities above). */
const avatarPostChain = [
  requireAuth,
  writeLimiter,
  avatarUpload.single("avatar"),
  uploadMyAvatar,
];
for (const path of ["/api/v1/auth/me/avatar", "/api/auth/me/avatar"]) {
  app.post(path, ...avatarPostChain);
}

/** Phone OTP — registered on the root app so POST matches reliably (same pattern as avatar upload). */
const phoneSendCodeChain = [requireAuth, writeLimiter, sendPhoneVerificationCode];
const phoneVerifyCodeChain = [
  requireAuth,
  writeLimiter,
  ...authValidators.verifyPhoneCode,
  validate,
  verifyPhoneCode,
];
for (const path of ["/api/v1/auth/phone/send-code", "/api/auth/phone/send-code"]) {
  app.post(path, ...phoneSendCodeChain);
}
for (const path of ["/api/v1/auth/phone/verify-code", "/api/auth/phone/verify-code"]) {
  app.post(path, ...phoneVerifyCodeChain);
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    database: "supabase",
  });
});

app.use("/api/v1", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
