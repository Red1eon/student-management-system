const crypto = require('crypto');

function ensureCsrfToken(req, res, next) {
  if (req.session) {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;
  }
  next();
}

function csrfProtection(req, res, next) {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
  if (safeMethods.has(req.method)) return next();

  const sessionToken = req.session?.csrfToken;
  const incomingToken = req.body?._csrf
    || req.headers['x-csrf-token']
    || req.headers['csrf-token']
    || req.query?._csrf;

  if (!sessionToken || !incomingToken || incomingToken !== sessionToken) {
    return res.status(403).render('error', {
      title: 'Security Error',
      message: 'Invalid or missing CSRF token. Please refresh and try again.'
    });
  }
  return next();
}

module.exports = {
  ensureCsrfToken,
  csrfProtection
};
