import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import * as ai from '../ai/orchestrator.js';
import { generateExecutiveReport } from '../ai/reports.js';
import { getSettings } from '../models/Settings.js';
import { Conversation } from '../models/Conversation.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

function publicAiError(err) {
  const status = err.statusCode || err.status;
  if (status === 400 || status === 403 || status === 404) return err.message;
  logger.warn(err.message || err);
  return 'Elena is temporarily unavailable. Please try again in a moment.';
}

export const chat = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) throw new AppError('message required', 400);
  const data = await ai.copilotChat({ message, actor: req.user, conversationId: req.body.conversationId });
  res.json({ success: true, ...data });
});

export const analyticsQuery = asyncHandler(async (req, res) => {
  const { question } = req.body;
  if (!question) throw new AppError('question required', 400);
  const data = await ai.nlQuery({ question, actor: req.user });
  res.json({ success: true, ...data });
});

export const recommend = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const data = await ai.recommendForUser(userId, 5);
  res.json({ success: true, ...data });
});

export const insights = asyncHandler(async (req, res) => {
  const data = await ai.bookInsights(req.params.bookId);
  res.json({ success: true, ...data });
});

export const ocr = asyncHandler(async (req, res) => {
  const { imageBase64, mimeType } = req.body;
  if (!imageBase64) throw new AppError('imageBase64 required', 400);
  const data = await ai.ocrIngest(imageBase64, mimeType);
  res.json({ success: true, extracted: data });
});

export const report = asyncHandler(async (_req, res) => {
  const data = await generateExecutiveReport();
  res.json({ success: true, report: data });
});

export const aiStatus = asyncHandler(async (_req, res) => {
  const settings = await getSettings();
  res.json({ success: true, ai: settings.ai });
});

export const streamElena = async (req, res, next) => {
  const message = String(req.body.message || '').trim();
  const regenerate = Boolean(req.body.regenerate);
  if (!message && !regenerate) return next(new AppError('message required', 400));
  if (message.length > 4000) return next(new AppError('Message is too long', 400));

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const abort = new AbortController();
  req.on('close', () => abort.abort());

  const send = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const result = await ai.streamCopilotChat({
      message,
      actor: req.user,
      conversationId: req.body.conversationId,
      regenerate,
      signal: abort.signal,
      onStart: ({ conversationId }) => send({ type: 'start', conversationId }),
      onChunk: (chunk) => send({ type: 'chunk', chunk }),
    });
    send({
      type: 'done',
      conversationId: result.conversationId,
      tool: result.tool,
      stopped: result.stopped,
    });
    res.end();
  } catch (err) {
    send({ type: 'error', message: publicAiError(err) });
    res.end();
  }
};

export const postConversationMessage = asyncHandler(async (req, res) => {
  const data = await ai.copilotChat({
    message: req.body.message,
    actor: req.user,
    conversationId: req.params.id,
  });
  res.json({ success: true, ...data });
});

export const rateMessage = asyncHandler(async (req, res) => {
  const rating = req.body.rating === 'down' ? 'down' : 'up';
  const index = Number(req.body.index);
  const doc = await Conversation.findOne({ _id: req.params.id, userId: req.user._id });
  if (!doc) throw new AppError('Conversation not found', 404);
  if (!Number.isInteger(index) || index < 0 || index >= doc.messages.length) {
    throw new AppError('Invalid message', 400);
  }
  const msg = doc.messages[index];
  if (msg.role !== 'assistant') throw new AppError('Can only rate Elena messages', 400);
  msg.metadata = { ...(msg.metadata || {}), rating };
  await doc.save();
  res.json({ success: true });
});

export const listConversations = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(5, Number(req.query.limit || 20)));
  const q = String(req.query.q || '').trim().slice(0, 80);
  const filter = { userId: req.user._id };
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { 'messages.content': rx }];
  }
  const [items, total] = await Promise.all([
    Conversation.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).select('title updatedAt createdAt'),
    Conversation.countDocuments(filter),
  ]);
  res.json({ success: true, items, total, page });
});

export const getConversation = asyncHandler(async (req, res) => {
  const doc = await Conversation.findOne({ _id: req.params.id, userId: req.user._id });
  if (!doc) throw new AppError('Conversation not found', 404);
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(10, Number(req.query.limit || 50)));
  const start = Math.max(0, doc.messages.length - page * limit);
  const end = doc.messages.length - (page - 1) * limit;
  res.json({
    success: true,
    conversation: {
      _id: doc._id,
      title: doc.title,
      messages: doc.messages.slice(start, end),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    },
  });
});

export const clearConversation = asyncHandler(async (req, res) => {
  const doc = await Conversation.findOne({ _id: req.params.id, userId: req.user._id });
  if (!doc) throw new AppError('Conversation not found', 404);
  doc.messages = [];
  await doc.save();
  res.json({ success: true });
});

export const deleteConversation = asyncHandler(async (req, res) => {
  const doc = await Conversation.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!doc) throw new AppError('Conversation not found', 404);
  res.json({ success: true });
});

export const speakTts = asyncHandler(async (req, res) => {
  const text = String(req.body.text || '').replace(/\s+/g, ' ').trim().slice(0, 900);
  if (!text) throw new AppError('text required', 400);
  if (!env.elevenLabsKey) {
    throw new AppError('Voice service is not configured. Elena can still chat in text.', 503);
  }
  const voice = env.elevenLabsVoiceId || 'EXAVITQu4vr4xnSDxMaL';
  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: 'POST',
    headers: {
      'xi-api-key': env.elevenLabsKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.8 },
    }),
  });
  if (!upstream.ok) {
    throw new AppError('Elena voice is temporarily unavailable.', 502);
  }
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-store');
  res.send(buf);
});
