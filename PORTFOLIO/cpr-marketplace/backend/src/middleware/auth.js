import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    return next(err);
  }

  try {
    req.user = jwt.verify(token, env.jwtSecret);
    return next();
  } catch {
    const err = new Error("Invalid token");
    err.statusCode = 401;
    return next(err);
  }
}

