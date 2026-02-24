const loginAttempts = new Map();

function applySecurityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

function createLoginRateLimiter(options = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const maxAttempts = options.maxAttempts || 10;

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = loginAttempts.get(ip) || { count: 0, expiresAt: now + windowMs };

    if (now > entry.expiresAt) {
      entry.count = 0;
      entry.expiresAt = now + windowMs;
    }

    entry.count += 1;
    loginAttempts.set(ip, entry);

    if (entry.count > maxAttempts) {
      return res.status(429).render('auth/login', {
        title: 'Login',
        layout: false,
        error: 'Too many login attempts. Please wait and try again.'
      });
    }

    next();
  };
}

module.exports = {
  applySecurityHeaders,
  createLoginRateLimiter
};
