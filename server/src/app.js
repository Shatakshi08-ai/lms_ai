import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import bookRoutes from './routes/bookRoutes.js';
import circulationRoutes from './routes/circulationRoutes.js';
import fineRoutes from './routes/fineRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import publicRoutes from './routes/publicRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.clientOrigins.length === 1 ? env.clientOrigins[0] : env.clientOrigins,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '8mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.use('/uploads', express.static(path.join(__dirname, '..', env.uploadDir)));
  app.use('/api/v1', apiLimiter);
  app.get('/api/v1/health', (_req, res) =>
    res.json({
      ok: true,
      service: 'lms-ai',
      mongo: mongoose.connection.readyState === 1,
    }),
  );
  app.use('/api/v1/public', publicRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/books', bookRoutes);
  app.use('/api/v1/circulation', circulationRoutes);
  app.use('/api/v1/fines', fineRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use('/api/v1/ai', aiRoutes);
  app.use('/api/v1/chat', aiRoutes);
  app.use('/api/chat', aiRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
