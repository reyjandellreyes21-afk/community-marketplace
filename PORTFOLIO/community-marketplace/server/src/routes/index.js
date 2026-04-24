import { Router } from "express";
import { authRouter } from "./authRoutes.js";
import { marketplaceRouter } from "./marketplaceRoutes.js";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use(marketplaceRouter);

export { apiRouter };
