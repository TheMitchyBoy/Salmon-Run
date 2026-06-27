'use strict';

const crypto = require('crypto');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function adminEnabled() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function signToken(expiresAt) {
  return crypto
    .createHmac('sha256', process.env.ADMIN_PASSWORD)
    .update(String(expiresAt))
    .digest('hex');
}

function createSession() {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  return `${expiresAt}.${signToken(expiresAt)}`;
}

function isAuthorized(req) {
  if (!adminEnabled()) return false;

  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const token = match[1];
  const dot = token.indexOf('.');
  if (dot === -1) return false;

  const expiresAt = Number(token.slice(0, dot));
  const signature = token.slice(dot + 1);
  if (!Number.isFinite(expiresAt) || !signature) return false;
  if (Date.now() > expiresAt) return false;

  const expected = signToken(expiresAt);
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

function login(password) {
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

function requireAdmin(req, res) {
  if (!adminEnabled()) {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Admin is not configured. Set ADMIN_PASSWORD on the server.' }));
    return false;
  }
  if (!isAuthorized(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Session expired or unauthorized. Sign in again.' }));
    return false;
  }
  return true;
}

module.exports = {
  adminEnabled,
  login,
  requireAdmin,
};
