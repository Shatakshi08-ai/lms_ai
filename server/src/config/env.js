import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// This file lives at server/src/config/env.js — load server/.env first, then cwd fallbacks.
const envCandidates = [
  path.join(__dirname, '../../.env'),
  path.join(process.cwd(), '.env'),
  path.join(__dirname, '../../../.env'),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
    break;
  }
}

const clientOrigins = String(process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigins,
  clientOrigin: clientOrigins[0] || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_ai',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me-please-32',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me-please-32',
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  aiProvider: (process.env.AI_PROVIDER || 'mock').toLowerCase(),
  aiModel: process.env.AI_MODEL || process.env.OPENAI_MODEL || '',
  geminiModel: process.env.GEMINI_MODEL || process.env.AI_MODEL || 'gemini-2.0-flash',
  openaiModel: process.env.OPENAI_MODEL || process.env.AI_MODEL || 'gpt-4o-mini',
  openaiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '',
  elenaPrompt: process.env.ELENA_SYSTEM_PROMPT || '',
  geminiKey: process.env.GEMINI_API_KEY || '',
  jwtSecret: process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || '',
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  currency: process.env.CURRENCY || 'INR',
  currencySymbol: process.env.CURRENCY_SYMBOL || '₹',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  elevenLabsKey: process.env.ELEVENLABS_API_KEY || process.env.TTS_API_KEY || '',
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
};
