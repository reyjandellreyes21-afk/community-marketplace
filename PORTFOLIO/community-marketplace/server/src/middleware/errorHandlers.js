import { AppError } from "../errors/AppError.js";

export const notFoundHandler = (_req, _res, next) => {
  next(new AppError(404, "Route not found.", null, "NOT_FOUND"));
};

export const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error.";
  const payload = {
    success: false,
    error: {
      code: err.code || "INTERNAL_ERROR",
      message,
      requestId: _req.requestId,
    },
  };
  if (err.details) payload.error.details = err.details;

  if (statusCode === 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(statusCode).json(payload);
};
