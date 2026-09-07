import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function notFound(_req, _res, next) {
  next(new AppError('Route not found', 404));
}

export function errorHandler(err, req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid ID';
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = err.message;
  } else if (err.code === 11000) {
    status = 409;
    message = 'Duplicate value';
  }
  if (!err.isOperational && status >= 500) logger.error(err);
  else logger.warn({ message, path: req.path, status });
  res.status(status).json({
    success: false,
    message,
    details: err.details,
    stack: env.nodeEnv === 'development' && !err.isOperational ? err.stack : undefined,
  });
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
