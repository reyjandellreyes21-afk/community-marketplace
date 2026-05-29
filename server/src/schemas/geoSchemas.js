import { query } from "express-validator";

export const geoValidators = {
  search: [
    query("q").isString().trim().isLength({ min: 2, max: 200 }),
    query("limit").optional().isInt({ min: 1, max: 10 }),
  ],
  reverse: [
    query("lat").isFloat({ min: -90, max: 90 }),
    query("lng").isFloat({ min: -180, max: 180 }),
  ],
};
