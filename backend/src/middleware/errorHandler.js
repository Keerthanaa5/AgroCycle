import { config } from '../config/env.js';

export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;
  const isProd = config.isProduction;

  // Log error details on server side
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message || err);
  if (!isProd && err.stack) {
    console.error(err.stack);
  }

  const response = {
    status: 'error',
    code: err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR'),
    message: isProd && statusCode === 500 ? 'Internal Server Error' : (err.message || 'An unexpected error occurred'),
  };

  if (!isProd && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
