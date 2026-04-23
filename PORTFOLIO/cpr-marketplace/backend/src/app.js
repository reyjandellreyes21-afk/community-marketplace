import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import stateRoutes from "./routes/stateRoutes.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 250,
  })
);

app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/state", stateRoutes);

app.use(errorHandler);

export default app;

