import http from 'http';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';
import { expireHolds } from './services/circulationService.js';
import { Circulation } from './models/Circulation.js';
import { attachChatSocket } from './sockets/chatSocket.js';

const app = createApp();
const httpServer = http.createServer(app);
attachChatSocket(httpServer);

async function markOverdue() {
  await Circulation.updateMany(
    { status: 'ISSUED', dueDate: { $lt: new Date() } },
    { $set: { status: 'OVERDUE' } },
  );
}

function redactMongoUri(uri) {
  try {
    const parsed = new URL(uri);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return 'mongodb://<unparseable-uri>';
  }
}

function isLocalMongo(uri) {
  try {
    const { hostname } = new URL(uri);
    return hostname === '127.0.0.1' || hostname === 'localhost';
  } catch {
    return true;
  }
}

function mongoStartupError(err) {
  const uri = redactMongoUri(env.mongoUri);
  const reason = err?.reason?.message || err?.message || String(err);
  const lines = [
    'MongoDB connection failed. The API will not start until the database is reachable.',
    `URI: ${uri}`,
    `Reason: ${reason}`,
  ];
  if (isLocalMongo(env.mongoUri) && /ECONNREFUSED|Server selection timed out/i.test(reason)) {
    lines.push(
      'This project is configured for local MongoDB on port 27017 (database name: lms_ai).',
      'Nothing is listening on 127.0.0.1:27017. Start MongoDB, then restart the backend.',
      'Windows service (if MongoDB is installed): net start MongoDB',
      'Docker (existing compose service): docker compose up -d mongo',
    );
  }
  return lines.join('\n');
}

const MONGO_CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
  socketTimeoutMS: 45000,
  family: 4,
};

let mongoListenersAttached = false;

function attachMongoListeners() {
  if (mongoListenersAttached) return;
  mongoListenersAttached = true;
  mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB connection error: ${err.message}`);
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
}

function assertMongoUri() {
  const uri = String(env.mongoUri || '').trim();
  if (!uri) {
    throw new Error('MONGODB_URI is missing. Set it in server/.env');
  }
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error(`MONGODB_URI is invalid: ${redactMongoUri(uri)}`);
  }
  if (parsed.protocol !== 'mongodb:' && parsed.protocol !== 'mongodb+srv:') {
    throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }
  return uri;
}

async function connectMongo() {
  const uri = assertMongoUri();
  if (mongoose.connection.readyState === 1) return;
  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
    return;
  }
  attachMongoListeners();
  logger.info(`Connecting to MongoDB (${redactMongoUri(uri)})`);
  await mongoose.connect(uri, MONGO_CONNECT_OPTIONS);
}

async function start() {
  try {
    await connectMongo();
  } catch (err) {
    logger.error(mongoStartupError(err));
    process.exit(1);
  }

  logger.info('MongoDB connected successfully');
  const { ensureBookCodes } = await import('./services/bookCodeService.js');
  await ensureBookCodes().catch((e) => logger.warn(e.message));
  setInterval(() => {
    expireHolds().catch((e) => logger.warn(e.message));
    markOverdue().catch((e) => logger.warn(e.message));
  }, 15 * 60 * 1000);

  await new Promise((resolve, reject) => {
    httpServer.listen(env.port, '0.0.0.0', () => {
      logger.info(`Server running on 0.0.0.0:${env.port}`);
      resolve();
    });
    httpServer.once('error', reject);
  });
}

start().catch((err) => {
  logger.error(err?.stack || err?.message || err);
  process.exit(1);
});
