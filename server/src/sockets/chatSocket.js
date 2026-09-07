import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { verifyAccess } from '../utils/tokens.js';
import { User } from '../models/User.js';
import { streamCopilotChat } from '../ai/orchestrator.js';
import { setNotifyIo } from '../services/notifyService.js';

const hits = new Map();

function allowChat(userId) {
  const now = Date.now();
  const list = (hits.get(userId) || []).filter((t) => now - t < 60_000);
  if (list.length >= 30) {
    hits.set(userId, list);
    return false;
  }
  list.push(now);
  hits.set(userId, list);
  return true;
}

export function attachChatSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, credentials: true },
    path: '/socket.io',
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyAccess(token);
      const user = await User.findById(payload.sub);
      if (!user || user.status !== 'ACTIVE') return next(new Error('Authentication required'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Authentication required'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user._id}`);
    const generations = new Map();

    async function runChat(payload = {}) {
      const message = String(payload.message || '').trim();
      if (!message) {
        socket.emit('chat:error', { message: 'Please enter a message.' });
        return;
      }
      if (!allowChat(String(socket.user._id))) {
        socket.emit('chat:error', { message: 'Too many requests. Please wait a moment.' });
        return;
      }
      const conversationId = payload.conversationId || null;
      const abort = new AbortController();
      generations.set(socket.id, abort);
      let liveId = conversationId;
      try {
        const result = await streamCopilotChat({
          message,
          actor: socket.user,
          conversationId,
          signal: abort.signal,
          onStart: ({ conversationId: id }) => {
            liveId = id;
          },
          onChunk: (chunk) => socket.emit('chat:chunk', { chunk, conversationId: liveId }),
        });
        socket.emit('chat:complete', {
          conversationId: result.conversationId,
          tool: result.tool,
          stopped: result.stopped,
        });
      } catch (err) {
        logger.warn(err.message);
        socket.emit('chat:error', {
          message: "Sorry, I couldn't process your request right now.\nPlease try again.",
        });
      } finally {
        generations.delete(socket.id);
      }
    }

    socket.on('chat:send', runChat);
    socket.on('chat:retry', runChat);
    socket.on('chat:stop', () => {
      generations.get(socket.id)?.abort();
    });
    socket.on('disconnect', () => {
      generations.get(socket.id)?.abort();
      generations.delete(socket.id);
    });
  });

  setNotifyIo(io);
  return io;
}
