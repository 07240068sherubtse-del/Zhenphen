function requireAuth(req, res, next) {
  if (!req.session.userId || !req.user) {
    return res.status(401).json({ error: 'Sign in to continue.' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    next();
  };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function apiError(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must contain valid JSON.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error('API request failed:', error);
  res.status(500).json({ error: 'The request could not be completed. Please try again.' });
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = { requireAuth, requireRole, asyncRoute, apiError, httpError };
