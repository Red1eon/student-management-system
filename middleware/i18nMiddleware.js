const setLanguage = (req, res, next) => {
  // Priority: 1. URL path /language/:lang, 2. lang query parameter, 3. Cookie, 4. Session, 5. Browser default
  const supportedLocales = ['en', 'ja'];
  const normalizeLang = (value) => {
    if (Array.isArray(value)) {
      value = value[value.length - 1];
    }
    if (typeof value !== 'string') {
      return null;
    }
    return value.trim().toLowerCase();
  };

  // try to infer language from the path (global middleware doesn't have access to params)
  let lang = null;
  const pathMatch = req.path.match(/^\/language\/(en|ja)$/);
  if (pathMatch) {
    lang = normalizeLang(pathMatch[1]);
  }

  // query string beats cookie/session so we can force a value on redirect
  lang = lang
    || normalizeLang(req.query.lang)
    || normalizeLang(req.cookies.lang)
    || normalizeLang(req.session?.lang);

  // fallback to browser preferences if nothing was found or value is unsupported
  if (!lang || !supportedLocales.includes(lang)) {
    lang = normalizeLang(req.acceptsLanguages?.(...supportedLocales)) || 'en';
  }

  if (!supportedLocales.includes(lang)) {
    lang = 'en';
  }

  // update i18n and persistence mechanisms
  req.setLocale(lang);

  res.cookie('lang', lang, {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: false,
    path: '/',
    sameSite: 'lax'
  });

  if (req.session) {
    req.session.lang = lang;
  }

  // expose to templates
  res.locale = lang;
  res.locals.locale = lang;

  next();
};

module.exports = { setLanguage };
