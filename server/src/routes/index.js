import { Router } from "express";
import { authRouter } from "./authRoutes.js";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);

export { apiRouter };
