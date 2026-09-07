import { getAccessToken } from './api.js';

export async function streamElenaChat({ message, conversationId, regenerate, signal, onStart, onChunk, onDone, onError }) {
  const res = await fetch('/api/v1/ai/elena/stream', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
    },
    body: JSON.stringify({ message, conversationId, regenerate: Boolean(regenerate) }),
    signal,
  });

  if (!res.ok) {
    let msg = 'Elena is temporarily unavailable. Please try again in a moment.';
    try {
      const data = await res.json();
      if (data.message) msg = data.message;
    } catch {
      // keep default
    }
    onError?.(msg);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onError?.('Elena is temporarily unavailable. Please try again in a moment.');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';
    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      let payload;
      try {
        payload = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      if (payload.type === 'start') onStart?.(payload);
      else if (payload.type === 'chunk' && payload.chunk) onChunk?.(payload.chunk, payload);
      else if (payload.type === 'done') {
        finished = true;
        onDone?.(payload);
      } else if (payload.type === 'error') {
        finished = true;
        onError?.(payload.message);
      }
    }
  }
  if (!finished) onDone?.({});
}
