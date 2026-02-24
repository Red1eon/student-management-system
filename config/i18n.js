const i18n = require('i18n');
const path = require('path');

i18n.configure({
  locales: ['en', 'ja'],
  directory: path.join(__dirname, '..', 'locales'),
  defaultLocale: process.env.DEFAULT_LANGUAGE || 'en',
  cookie: 'lang',
  queryParameter: 'lang',
  autoReload: true,
  updateFiles: false,
  objectNotation: true
});

module.exports = i18n;