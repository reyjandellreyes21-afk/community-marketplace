import { body, param, query } from "express-validator";

/** Validation chains for notification routes (used with `validate` middleware). */
export const notificationsValidators = {
  list: [
    query("limit").optional().isInt({ min: 1, max: 200 }),
    query("offset").optional().isInt({ min: 0 }),
    query("type").optional().isString().trim().isLength({ min: 1, max: 80 }),
    query("unreadOnly").optional().isBoolean(),
  ],
  markReadOne: [param("id").isUUID()],
  deleteOne: [param("id").isUUID()],
  markReadMany: [body("ids").optional().isArray(), body("ids.*").optional().isUUID()],
};
