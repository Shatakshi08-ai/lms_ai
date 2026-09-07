import { Notification } from '../models/Notification.js';
import { logger } from '../utils/logger.js';

let ioRef = null;

export function setNotifyIo(io) {
  ioRef = io;
}

export function emitToUser(userId, event, payload) {
  if (!ioRef || !userId) return;
  ioRef.to(`user:${userId}`).emit(event, payload);
}

export async function notifyUser({ userId, title, body, type = 'INFO', meta = {} }) {
  try {
    const doc = await Notification.create({ userId, title, body, type, meta, read: false });
    const payload = {
      _id: doc._id,
      title: doc.title,
      body: doc.body,
      type: doc.type,
      read: doc.read,
      meta: doc.meta,
      createdAt: doc.createdAt,
    };
    emitToUser(userId, 'notify:new', payload);
    return doc;
  } catch (err) {
    logger.warn(err.message);
    return null;
  }
}
