import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, readerId: user.readerId || null },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessExpires },
  );
}

export function signRefreshToken(user, tokenId) {
  return jwt.sign(
    { sub: String(user._id), jti: tokenId, typ: 'refresh' },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshExpires },
  );
}

export function verifyAccess(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

export function verifyRefresh(token) {
  return jwt.verify(token, env.jwtRefreshSecret);
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function newTokenId() {
  return crypto.randomBytes(16).toString('hex');
}

export function setRefreshCookie(res, token, { remember = true } = {}) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSecure ? 'none' : 'lax',
    maxAge: remember ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie('refreshToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
}
