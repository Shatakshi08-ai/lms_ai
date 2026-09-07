import { io } from 'socket.io-client';
import { getAccessToken } from './api.js';

export function connectNotifySocket({ onNotification, onStatus } = {}) {
  const token = getAccessToken();
  if (!token) return { disconnect() {} };
  const socket = io({
    path: '/socket.io',
    auth: { token },
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 800,
  });
  socket.on('connect', () => onStatus?.('connected'));
  socket.on('notify:new', (payload) => onNotification?.(payload));
  socket.on('connect_error', () => onStatus?.('error'));
  return {
    disconnect() {
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}
