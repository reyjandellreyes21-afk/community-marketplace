import { Router } from "express";
import { geoReverse, geoSearch, geoTile } from "../controllers/geoController.js";
import { geoLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { geoValidators } from "../schemas/geoSchemas.js";

const geoRouter = Router();

geoRouter.get("/search", geoLimiter, geoValidators.search, validate, geoSearch);
geoRouter.get("/reverse", geoLimiter, geoValidators.reverse, validate, geoReverse);
/** No geoLimiter — maps request many tiles; globalApiLimiter still applies. */
geoRouter.get("/tiles/:z/:x/:y", geoTile);
geoRouter.get("/tiles/:z/:x/:y.png", geoTile);

export { geoRouter };
