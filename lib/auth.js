'use strict';

const crypto = require('crypto');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const sessions = new Map();

function adminEnabled() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function purgeExpired() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

function login(password) {
  purgeExpired();
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return { ok: false, error: 'Admin is not configured. Set ADMIN_PASSWORD on the server.' };
  }

  const a = Buffer.from(String(password));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'Invalid password.' };
  }

  return { ok: true, token: createSession() };
}

function isAuthorized(req) {
  purgeExpired();
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const session = sessions.get(match[1]);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(match[1]);
    return false;
  }
  return true;
}

function requireAdmin(req, res) {
  if (!adminEnabled()) {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Admin is not configured. Set ADMIN_PASSWORD on the server.' }));
    return false;
  }
  if (!isAuthorized(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return false;
  }
  return true;
}

module.exports = {
  adminEnabled,
  login,
  requireAdmin,
};
