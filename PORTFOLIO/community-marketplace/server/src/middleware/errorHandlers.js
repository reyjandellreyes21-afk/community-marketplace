import { MulterError } from "multer";
import { AppError } from "../errors/AppError.js";

export const notFoundHandler = (req, _res, next) => {
  next(
    new AppError(404, "Route not found.", { method: req.method, url: req.originalUrl || req.url }, "NOT_FOUND"),
  );
};

export const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error.";
  let code = err.code || "INTERNAL_ERROR";

  if (err instanceof MulterError) {
    statusCode = 400;
    code = "UPLOAD_ERROR";
    if (err.code === "LIMIT_FILE_SIZE") message = "Image must be 5 MB or smaller.";
    else if (err.code === "LIMIT_UNEXPECTED_FILE") message = "Unexpected file field. Use the image field for uploads.";
    else message = err.message || "Upload failed.";
  }

  const payload = {
    success: false,
    error: {
      code,
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
