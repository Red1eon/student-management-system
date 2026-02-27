const setLanguage = (req, res, next) => {
  // Priority: 1. URL query parameter, 2. Cookie, 3. Browser default
  let lang = req.query.lang || req.cookies.lang;
  
  // Validate that the language is supported
  const supportedLocales = ['en', 'ja'];
  if (!lang || !supportedLocales.includes(lang)) {
    lang = req.getLocale() || 'en';
  }
  
  // Ensure lang is valid
  if (!supportedLocales.includes(lang)) {
    lang = 'en';
  }
  
  req.setLocale(lang);
  res.cookie('lang', lang, { maxAge: 900000, httpOnly: false, path: '/' });
  next();
};

module.exports = { setLanguage };
