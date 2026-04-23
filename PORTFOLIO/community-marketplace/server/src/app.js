import cors from "cors";
import express from "express";
import morgan from "morgan";
import { assignRequestId } from "./middleware/requestId.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandlers.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "12mb" }));
app.use(assignRequestId);
app.use(morgan("dev"));

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
