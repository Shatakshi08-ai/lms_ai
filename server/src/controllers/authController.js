import crypto from 'crypto';
import mongoose from 'mongoose';
import { PUBLIC_REGISTER_ROLES, User } from '../models/User.js';
import { PasswordReset } from '../models/PasswordReset.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefresh,
  hashToken,
  newTokenId,
  setRefreshCookie,
  clearRefreshCookie,
} from '../utils/tokens.js';
import { generateReaderId, randomFourDigit } from '../utils/ids.js';
import { writeAudit } from '../services/auditService.js';
import { logger } from '../utils/logger.js';

async function uniqueReaderId() {
  for (let i = 0; i < 12; i += 1) {
    const id = generateReaderId(new Date().getFullYear(), randomFourDigit());
    const exists = await User.exists({ readerId: id });
    if (!exists) return id;
  }
  return generateReaderId(new Date().getFullYear(), Date.now() % 10000);
}

function issuePair(user, res, remember = true) {
  const accessToken = signAccessToken(user);
  const jti = newTokenId();
  const refreshToken = signRefreshToken(user, jti);
  setRefreshCookie(res, refreshToken, { remember });
  return { accessToken, refreshToken };
}

export const register = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = req.body.password;
  const department = req.body.department;
  const requestedRole = String(req.body.role || 'STUDENT').toUpperCase();
  const role = PUBLIC_REGISTER_ROLES.includes(requestedRole) ? requestedRole : 'STUDENT';
  if (!name || !email || !password) throw new AppError('Name, email and password are required', 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Enter a valid email', 400);
  if (password.length < 8) throw new AppError('Password must be at least 8 characters', 400);
  const exists = await User.findOne({ email });
  if (exists) throw new AppError('An account with this email already exists. Please sign in.', 409);
  const readerId = await uniqueReaderId();
  const phone = String(req.body.phone || '').trim();
  const user = await User.create({
    name,
    email,
    password,
    department,
    phone,
    role,
    readerId,
    preferencesOnboarded: false,
    lastActivityAt: new Date(),
  });
  const tokens = issuePair(user, res, true);
  user.refreshTokenHash = hashToken(tokens.refreshToken);
  await user.save({ validateBeforeSave: false });
  await writeAudit({ actorId: user._id, action: 'AUTH_REGISTER', entity: 'User', entityId: user._id, req });
  res.status(201).json({ success: true, accessToken: tokens.accessToken, user: user.toSafeJSON() });
});

export const login = asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError('Database unavailable. Start MongoDB and try again.', 503);
  }
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = req.body.password;
  if (!email || !password) throw new AppError('Email and password are required', 400);
  const user = await User.findOne({ email }).select('+password +refreshTokenHash');
  if (!user || !(await user.comparePassword(password || ''))) {
    throw new AppError('Invalid email or password.', 401);
  }
  if (user.status !== 'ACTIVE') throw new AppError('Account is not active', 403);
  const remember = req.body.remember !== false;
  const tokens = issuePair(user, res, remember);
  user.refreshTokenHash = hashToken(tokens.refreshToken);
  user.lastActivityAt = new Date();
  await user.save({ validateBeforeSave: false });
  await writeAudit({ actorId: user._id, action: 'AUTH_LOGIN', entity: 'User', entityId: user._id, req });
  res.json({ success: true, accessToken: tokens.accessToken, user: user.toSafeJSON() });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new AppError('Refresh token missing', 401);
  let payload;
  try {
    payload = verifyRefresh(token);
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }
  const user = await User.findById(payload.sub).select('+refreshTokenHash');
  if (!user || user.refreshTokenHash !== hashToken(token)) {
    throw new AppError('Refresh token revoked', 401);
  }
  const tokens = issuePair(user, res);
  user.refreshTokenHash = hashToken(tokens.refreshToken);
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, accessToken: tokens.accessToken, user: user.toSafeJSON() });
});

export const logout = asyncHandler(async (req, res) => {
  if (req.user) {
    await User.findByIdAndUpdate(req.user._id, { $unset: { refreshTokenHash: 1 } });
    await writeAudit({ actorId: req.user._id, action: 'AUTH_LOGOUT', entity: 'User', entityId: req.user._id, req });
  }
  clearRefreshCookie(res);
  res.json({ success: true });
});

export const me = asyncHandler(async (req, res) => {
  req.user.lastActivityAt = new Date();
  await req.user.save({ validateBeforeSave: false });
  res.json({ success: true, user: req.user.toSafeJSON() });
});

export const updateMe = asyncHandler(async (req, res) => {
  const allowed = ['name', 'department', 'avatar', 'phone'];
  for (const k of allowed) if (req.body[k] !== undefined) req.user[k] = req.body[k];
  if (req.body.preferences) {
    const next = { ...(req.user.preferences?.toObject?.() || req.user.preferences || {}) };
    if (req.body.preferences.genres) next.genres = req.body.preferences.genres;
    if (req.body.preferences.languages) next.languages = req.body.preferences.languages;
    if (req.body.preferences.readingGoal !== undefined) next.readingGoal = req.body.preferences.readingGoal;
    req.user.preferences = next;
  }
  if (req.body.preferencesOnboarded !== undefined) {
    req.user.preferencesOnboarded = Boolean(req.body.preferencesOnboarded);
  }
  if (req.body.password) {
    if (!req.body.currentPassword) throw new AppError('Current password required', 400);
    const fresh = await User.findById(req.user._id).select('+password');
    if (!(await fresh.comparePassword(req.body.currentPassword))) {
      throw new AppError('Current password is incorrect', 400);
    }
    fresh.password = req.body.password;
    await fresh.save();
  }
  await req.user.save();
  res.json({ success: true, user: req.user.toSafeJSON() });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user) {
    const raw = crypto.randomBytes(24).toString('hex');
    await PasswordReset.create({
      userId: user._id,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    logger.info({ msg: 'Password reset token issued', email: user.email, token: raw });
  }
  res.json({
    success: true,
    message: 'If that email exists, a reset token was generated (check server logs in development).',
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) throw new AppError('Token and password required', 400);
  const rec = await PasswordReset.findOne({ tokenHash: hashToken(token), used: false, expiresAt: { $gt: new Date() } });
  if (!rec) throw new AppError('Invalid or expired reset token', 400);
  const user = await User.findById(rec.userId).select('+password');
  user.password = password;
  await user.save();
  rec.used = true;
  await rec.save();
  res.json({ success: true, message: 'Password updated' });
});
