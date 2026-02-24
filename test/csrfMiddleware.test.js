const test = require('node:test');
const assert = require('node:assert/strict');
const { ensureCsrfToken, csrfProtection } = require('../middleware/csrfMiddleware');

test('ensureCsrfToken creates token and sets res.locals', () => {
  const req = { session: {} };
  const res = { locals: {} };
  ensureCsrfToken(req, res, () => {});
  assert.ok(req.session.csrfToken);
  assert.equal(res.locals.csrfToken, req.session.csrfToken);
});

test('csrfProtection allows safe methods', () => {
  let called = false;
  const req = { method: 'GET', session: {} };
  const res = {};
  csrfProtection(req, res, () => { called = true; });
  assert.equal(called, true);
});

test('csrfProtection blocks invalid token', () => {
  const req = { method: 'POST', session: { csrfToken: 'abc' }, body: { _csrf: 'wrong' }, headers: {} };
  let statusCode = null;
  let rendered = null;
  const res = {
    status(code) { statusCode = code; return this; },
    render(view, payload) { rendered = { view, payload }; }
  };

  csrfProtection(req, res, () => {});
  assert.equal(statusCode, 403);
  assert.equal(rendered.view, 'error');
});

test('csrfProtection allows valid token', () => {
  let called = false;
  const req = { method: 'POST', session: { csrfToken: 'abc' }, body: { _csrf: 'abc' }, headers: {} };
  const res = { status() { return this; }, render() {} };
  csrfProtection(req, res, () => { called = true; });
  assert.equal(called, true);
});
