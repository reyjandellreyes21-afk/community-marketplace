import cors from "cors";
import express from "express";
import morgan from "morgan";
import { uploadMyAvatar } from "./controllers/authController.js";
import { createCommunity, listCommunities } from "./controllers/marketplaceController.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandlers.js";
import { requireAuth } from "./middleware/auth.js";
import { avatarUpload } from "./middleware/avatarUpload.js";
import { communityImageUpload } from "./middleware/communityImageUpload.js";
import { assignRequestId } from "./middleware/requestId.js";
import { globalApiLimiter, writeLimiter } from "./middleware/rateLimit.js";
import { apiRouter } from "./routes/index.js";

const app = express();
app.set("trust proxy", 1);

app.use(cors());
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
