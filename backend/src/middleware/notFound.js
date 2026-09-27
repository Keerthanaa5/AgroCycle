export function notFoundHandler(req, res, _next) {
  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}
