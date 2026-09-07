import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { verifyAccess } from '../utils/tokens.js';
import { asyncHandler } from './errorHandler.js';

export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError('Authentication required', 401);
  let payload;
  try {
    payload = verifyAccess(token);
  } catch {
    throw new AppError('Access token expired or invalid', 401);
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new AppError('User no longer exists', 401);
  if (user.status !== 'ACTIVE') throw new AppError('Account is not active', 403);
  req.user = user;
  next();
});

export function restrictTo(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
}

export const staffOnly = restrictTo('SUPER_ADMIN', 'ADMIN', 'LIBRARIAN');
export const adminOnly = restrictTo('SUPER_ADMIN', 'ADMIN');
export const superAdminOnly = restrictTo('SUPER_ADMIN');

export const optionalProtect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = verifyAccess(token);
    const user = await User.findById(payload.sub);
    if (user && user.status === 'ACTIVE') req.user = user;
  } catch {
    /* logout still clears the refresh cookie */
  }
  next();
});
