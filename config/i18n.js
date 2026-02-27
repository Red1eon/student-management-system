const i18n = require('i18n');
const path = require('path');

i18n.configure({
  locales: ['en', 'ja'],
  directory: path.join(__dirname, '..', 'locales'),
  defaultLocale: 'en',
  cookie: 'lang',
  queryParameter: 'lang',
  autoReload: true,
  updateFiles: false,
  objectNotation: true,
  syncFiles: false,
  useCookie: true,
  cookieName: 'lang'
});

module.exports = i18n;
