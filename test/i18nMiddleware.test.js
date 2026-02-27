import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import i18n from '../config/i18n.js';
import { setLanguage } from '../middleware/i18nMiddleware.js';
import request from 'supertest';

// helper to build a minimal app with the middleware
function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
  app.use(i18n.init);
  app.use(setLanguage);
  // simple endpoint that echoes the current locale and a translated string
  app.get('/', (req, res) => {
    res.json({ locale: req.getLocale(), hello: res.__('welcome') });
  });
  // language switch route same as real app
  app.get('/language/:lang', (req, res) => {
    const lang = req.params.lang;
    const supported = ['en', 'ja'];
    if (supported.includes(lang)) {
      res.cookie('lang', lang, { path: '/', sameSite: 'lax' });
      if (req.session) req.session.lang = lang;
      req.setLocale(lang);
    }
    let referer = req.get('referer') || '/';
    const sep = referer.includes('?') ? '&' : '?';
    referer = `${referer}${sep}lang=${lang}`;
    res.redirect(referer);
  });
  return app;
}

// tests

test('switching via /language route persists to next request', async (t) => {
  const app = createApp();
  const agent = request.agent(app);

  // initial request should default to en
  let res = await agent.get('/');
  assert.strictEqual(res.body.locale, 'en');
  assert.strictEqual(res.body.hello, 'welcome');

  // call switcher
  res = await agent.get('/language/ja').set('Referer', '/');
  assert.strictEqual(res.status, 302);

  // follow redirect
  res = await agent.get(res.headers.location);
  assert.strictEqual(res.body.locale, 'ja');
  assert.strictEqual(res.body.hello, '‚æ‚¤‚±‚»');
});


test('query parameter overrides cookie/session', async (t) => {
  const app = createApp();
  const agent = request.agent(app);

  // set a cookie manually
  let res = await agent.get('/').set('Cookie', 'lang=en');
  assert.strictEqual(res.body.locale, 'en');

  // now use query param to switch
  res = await agent.get('/?lang=ja');
  assert.strictEqual(res.body.locale, 'ja');
});
