const setLanguage = (req, res, next) => {
    const lang = req.query.lang || req.cookies.lang || req.getLocale();
    req.setLocale(lang);
    res.cookie('lang', lang, { maxAge: 900000, httpOnly: true });
    next();
  };
  
  module.exports = { setLanguage };