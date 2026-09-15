function errorMiddleware(err, req, res, next) {
  res.status(err.statusCode || 500).json({
    error: err.message || "Internal server error",
  });
}

module.exports = errorMiddleware;
