const rateLimit = require('express-rate-limit');

// Common handler for 429 responses
const limitHandler = (req, res /*, next, options */) => {
  return res.status(429).json({
    success: false,
    message: 'Too many requests. Please slow down.',
    retryAfter: res.get('Retry-After')
  });
};

// Identify the requester: authenticated user id or IP for guests
const keyGenerator = (req) => {
  if (req.user && req.user.id) return `u:${req.user.id}`;
  return `g:${req.ip}`; // trust proxy is enabled in app.js
};

// Skip certain lightweight endpoints
const skip = (req) => {
  const p = req.path;
  return p === '/health' || p === '/playground' || p.startsWith('/api/admin');
};

// Per-second limiter: guests 1 req/sec, users 5 req/sec
const perSecondLimiter = rateLimit({
  windowMs: 1000,
  limit: (req, res) => (req.user ? 10 : 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: limitHandler,
  skip
});

// Per-minute limiter: guests 30 req/min, users 300 req/min
const perMinuteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: (req, res) => (req.user ? 300 : 100),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: limitHandler,
  skip
});

// Combined middleware to enforce both limits
const dynamicRateLimit = (req, res, next) => {
  perSecondLimiter(req, res, (err) => {
    if (err) return; // express-rate-limit already handled response
    perMinuteLimiter(req, res, next);
  });
};

module.exports = { dynamicRateLimit };
