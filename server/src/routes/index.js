import { Router } from "express";
import { authRouter } from "./authRoutes.js";
import { conversationRouter } from "./conversationRoutes.js";
import { marketplaceRouter } from "./marketplaceRoutes.js";
import { notificationRouter } from "./notificationRoutes.js";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use(conversationRouter);
apiRouter.use(notificationRouter);
apiRouter.use(marketplaceRouter);

export { apiRouter };
