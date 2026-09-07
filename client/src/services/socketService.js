import { io } from 'socket.io-client';
import { getAccessToken } from './api.js';

export function connectChatSocket({ onChunk, onComplete, onError, onStatus }) {
  onStatus?.('Connecting...');
  const socket = io({
    path: '/socket.io',
    auth: { token: getAccessToken() },
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 800,
  });

  socket.on('connect', () => onStatus?.('Connected'));
  socket.on('disconnect', () => onStatus?.('Disconnected'));
  socket.io.on('reconnect_attempt', () => onStatus?.('Reconnecting...'));
  socket.io.on('reconnect', () => onStatus?.('Connected'));
  socket.on('connect_error', () => onStatus?.('Disconnected'));
  socket.on('chat:chunk', (payload) => onChunk?.(payload));
  socket.on('chat:complete', (payload) => onComplete?.(payload));
  socket.on('chat:error', (payload) => onError?.(payload));

  return {
    socket,
    send(message, conversationId) {
      socket.emit('chat:send', { message, conversationId });
    },
    retry(message, conversationId) {
      socket.emit('chat:retry', { message, conversationId });
    },
    stop() {
      socket.emit('chat:stop');
    },
    disconnect() {
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}
