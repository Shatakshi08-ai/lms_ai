import { Router } from 'express';
import * as auth from '../controllers/authController.js';
import { optionalProtect, protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const r = Router();
r.post('/register', authLimiter, auth.register);
r.post('/login', authLimiter, auth.login);
r.post('/refresh', auth.refresh);
r.post('/forgot-password', authLimiter, auth.forgotPassword);
r.post('/reset-password', auth.resetPassword);
r.post('/logout', optionalProtect, auth.logout);
r.get('/me', protect, auth.me);
r.patch('/me', protect, auth.updateMe);
export default r;
