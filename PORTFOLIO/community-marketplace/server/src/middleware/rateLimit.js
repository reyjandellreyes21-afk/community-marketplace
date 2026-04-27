import rateLimit from "express-rate-limit";

export const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  // Auth endpoints have their own dedicated limiter (`authLimiter`) and should
  // not be blocked by unrelated background polling traffic.
  skip: (req) => {
    const path = String(req.originalUrl || req.url || "");
    return path.includes("/api/v1/auth/") || path.includes("/api/auth/");
  },
  message: { error: { message: "Too many requests. Please try again shortly." } },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many login attempts. Try again later." } },
});

export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many writes. Slow down and try again." } },
});
