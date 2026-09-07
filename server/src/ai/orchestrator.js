import mongoose from 'mongoose';
import { completeChat, parseJsonLoose, visionOcr, streamChat, hasLiveAi } from './providers.js';
import { executeTool, listTools } from './toolSandbox.js';
import { runTemplate, TEMPLATES } from './nlAnalytics.js';
import { recommendForUser } from '../services/recommendationService.js';
import { Book } from '../models/Book.js';
import { Conversation } from '../models/Conversation.js';
import { AppError } from '../utils/AppError.js';
import { isPatron } from '../models/User.js';
import { getSettings } from '../models/Settings.js';
import { buildAuthenticatedLmsContext } from '../services/lmsContextService.js';
import { DEFAULT_ELENA_PROMPT } from './elenaPrompt.js';
import { env } from '../config/env.js';
import { matchElenaKnowledge, formatToolAnswer } from './knowledgeMatch.js';

const MAX_MESSAGE = 4000;
const HISTORY_LIMIT = 12;

async function elenaSystem(settings) {
  return settings.ai?.systemPrompt || env.elenaPrompt || DEFAULT_ELENA_PROMPT;
}

const LIBRARY_HINT =
  /\b(book|books|isbn|catalog|library|borrow|loan|overdue|fine|fines|wishlist|author|authors|available|availability|recommend\b|python book|java book|free books?|category|categories|reading progress|currently reading)\b/i;

function extractCategory(content) {
  const lower = content.toLowerCase();
  const named = [
    'Computer Science',
    'Data Science',
    'Artificial Intelligence',
    'Science Fiction',
    'Self-Help',
    'Business',
    'Literature',
    'History',
    'Physics',
    'Mystery',
    'Romance',
    'Fantasy',
    'Thriller',
    'Biography',
    'Philosophy',
    'Science',
  ];
  for (const c of named) {
    if (lower.includes(c.toLowerCase())) return c;
  }
  return '';
}

function searchQueryFrom(content, category) {
  let q = String(content || '')
    .replace(/find me |show me |books about |book about |recommend( me)? |available |please |which |what /gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (category && q.toLowerCase() === category.toLowerCase()) return '';
  return q.slice(0, 120);
}

function pickElenaIntent(content, tools) {
  const q = content.toLowerCase();
  const has = (name) => tools.includes(name);
  let tool = null;
  let args = { query: content, limit: 8 };

  if (/\bwishlist\b/.test(q) && has('getUserWishlist')) tool = 'getUserWishlist';
  else if (/\bcart\b/.test(q) && has('getUserCart')) tool = 'getUserCart';
  else if (/(reading progress|currently reading|what am i reading)/.test(q) && has('getReadingProgress')) {
    tool = 'getReadingProgress';
  } else if (/\bfines?\b/.test(q) && has('getUserFines')) tool = 'getUserFines';
  else if (/(how many books can i|borrow limit|borrowing limit)/.test(q) && has('getUserLoans')) tool = 'getUserLoans';
  else if (/(total books|how many members|how many students|overdue books|issued books|library stats)/.test(q) && has('getLibraryStats')) {
    tool = 'getLibraryStats';
  } else if (/\b(loans?|borrowed|due date|overdue|checked out|borrowing history|currently have|my books|issued to me|books do i have)\b/.test(q) && has('getUserLoans')) {
    tool = 'getUserLoans';
  }
  else if (/\bcategor(y|ies)\b/.test(q) && !/\bbooks?\b/.test(q) && has('listCategories')) tool = 'listCategories';
  else if (LIBRARY_HINT.test(content) && has('searchBooks')) {
    tool = 'searchBooks';
    const category = extractCategory(content);
    const freeOnly = /free books?/.test(q);
    args = {
      query: searchQueryFrom(content, category),
      category,
      freeOnly,
      limit: 8,
    };
  }

  const kind = tool ? 'library' : 'general';
  return { kind, tool, args };
}

async function classifyAndFetch({ content, actor, tools }) {
  const intent = pickElenaIntent(content, tools);
  const result = intent.tool ? await executeTool(intent.tool, intent.args, actor) : null;
  const lms = {
    member: { name: actor.name, role: actor.role },
  };
  if (intent.tool) {
    const extra = await buildAuthenticatedLmsContext(actor, content);
    lms.member = extra.member;
    if (intent.tool === 'getUserLoans') lms.loans = extra.loans;
    if (intent.tool === 'getUserFines') lms.pendingFineTotal = extra.pendingFineTotal;
  }
  return { kind: intent.kind, tool: intent.tool, result, lms };
}

async function resolveConversation(actor, conversationId, firstMessage) {
  if (conversationId && mongoose.isValidObjectId(conversationId)) {
    const existing = await Conversation.findOne({ _id: conversationId, userId: actor._id });
    if (existing) return existing;
  }
  return Conversation.create({
    userId: actor._id,
    title: String(firstMessage || 'Library chat').slice(0, 80),
    messages: [],
  });
}

export async function copilotChat({ message, actor, conversationId }) {
  const settings = await getSettings();
  if (!settings.ai.studentCopilotEnabled && isPatron(actor)) {
    throw new AppError('Student copilot is disabled', 403);
  }
  const content = String(message || '').trim();
  if (!content) throw new AppError('message required', 400);
  if (content.length > MAX_MESSAGE) throw new AppError('Message is too long', 400);

  const conversation = await resolveConversation(actor, conversationId, content);
  const history = conversation.messages.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content }));
  const tools = listTools()
    .filter((t) => t.roles.includes(actor.role))
    .map((t) => t.name);
  const { tool, result, lms } = await classifyAndFetch({ content, actor, tools });
  let answer = '';
  const kb = matchElenaKnowledge(content);
  if (hasLiveAi() && !(kb && !tool)) {
    answer = await completeChat({
      system: `${await elenaSystem(settings)}\nAuthoritative LMS data (do not invent beyond this): ${JSON.stringify({ lms, tool, result }).slice(0, 4500)}`,
      messages: [...history, { role: 'user', content }],
    });
  } else {
    answer = (tool && formatToolAnswer(tool, result)) || kb?.answer || '';
  }
  if (!answer.trim()) {
    answer =
      'I am Elena, the QuestLearn library assistant. I can help with login, registration, books, borrowing, returns, reservations, fines, the cart, and dashboards. I will not invent catalog or account data I cannot look up — try a library question, or browse the catalog.';
  }
  conversation.messages.push(
    { role: 'user', content, timestamp: new Date() },
    { role: 'assistant', content: answer, timestamp: new Date(), metadata: { tool } },
  );
  if (conversation.messages.length > 80) conversation.messages = conversation.messages.slice(-80);
  await conversation.save();
  return { answer, tool, result, conversationId: String(conversation._id) };
}

export async function streamCopilotChat({ message, actor, conversationId, signal, onStart, onChunk, regenerate }) {
  const settings = await getSettings();
  if (!settings.ai.studentCopilotEnabled && isPatron(actor)) {
    throw new AppError('Student copilot is disabled', 403);
  }
  let content = String(message || '').trim();
  const conversation = await resolveConversation(actor, conversationId, content || 'Library chat');
  let skipUser = false;
  if (regenerate) {
    if (conversation.messages.at(-1)?.role === 'assistant') conversation.messages.pop();
    const lastUser = [...conversation.messages].reverse().find((m) => m.role === 'user');
    if (!content) content = lastUser?.content || '';
    skipUser = Boolean(lastUser && lastUser.content === content);
  }
  if (!content) throw new AppError('message required', 400);
  if (content.length > MAX_MESSAGE) throw new AppError('Message is too long', 400);

  onStart?.({ conversationId: String(conversation._id) });
  const historyMsgs = conversation.messages.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content }));
  const tools = listTools()
    .filter((t) => t.roles.includes(actor.role))
    .map((t) => t.name);
  const { tool, result, lms } = await classifyAndFetch({ content, actor, tools });
  const kb = matchElenaKnowledge(content);

  const payload =
    skipUser && historyMsgs.at(-1)?.role === 'user'
      ? historyMsgs
      : [...historyMsgs, { role: 'user', content }];

  let answer = '';
  const useKb = Boolean(kb && !tool);
  const localAnswer = (tool && !hasLiveAi() && formatToolAnswer(tool, result)) || (useKb ? kb.answer : '');

  if (hasLiveAi() && !useKb) {
    for await (const chunk of streamChat({
      system: `${await elenaSystem(settings)}\nAuthoritative LMS data (do not invent beyond this): ${JSON.stringify({ lms, tool, result }).slice(0, 4500)}`,
      messages: payload,
      signal,
    })) {
      if (signal?.aborted) break;
      answer += chunk;
      onChunk?.(chunk);
    }
  } else if (localAnswer) {
    answer = localAnswer;
    onChunk?.(answer);
  }

  if (!signal?.aborted) {
    if (!answer.trim()) {
      answer =
        'I am Elena, the QuestLearn library assistant. I can help with login, registration, books, borrowing, returns, reservations, fines, the cart, and dashboards. I will not invent catalog or account data I cannot look up — try a library question, or browse the catalog.';
      onChunk?.(answer);
    }
    if (!skipUser) conversation.messages.push({ role: 'user', content, timestamp: new Date() });
    conversation.messages.push({ role: 'assistant', content: answer, timestamp: new Date(), metadata: { tool } });
    if (conversation.messages.length > 80) conversation.messages = conversation.messages.slice(-80);
    await conversation.save();
  }

  return { answer, tool, conversationId: String(conversation._id), stopped: Boolean(signal?.aborted) };
}

export async function nlQuery({ question, actor }) {
  const settings = await getSettings();
  if (!settings.ai.adminNlQueryEnabled) throw new AppError('NL analytics disabled', 403);
  const ids = Object.keys(TEMPLATES).filter((id) => TEMPLATES[id].roles.includes(actor.role));
  const raw = await completeChat({
    system: `Choose templateId from: ${ids.join(', ')}. Return JSON {templateId, slots}. Never invent pipelines.`,
    user: `template selection: ${question}`,
    json: true,
  });
  const parsed = parseJsonLoose(raw);
  const templateId = ids.includes(parsed.templateId) ? parsed.templateId : ids[0];
  const data = await runTemplate(templateId, parsed.slots || {}, actor);
  const summary = await completeChat({
    system: 'Summarize analytics rows for a library administrator. No speculation beyond the numbers.',
    user: `${question}\n${JSON.stringify(data).slice(0, 5000)}`,
  });
  return { templateId, data, summary };
}

export async function bookInsights(bookId) {
  const book = await Book.findById(bookId).lean();
  if (!book) throw new AppError('Book not found', 404);
  const raw = await completeChat({
    system: 'Produce JSON {takeaways: string[3], readingLevel, audience} for the catalog item.',
    user: `summary request: ${book.title} by ${(book.authors || []).join(', ')}. ${book.summary || ''}`,
    json: true,
  });
  const parsed = parseJsonLoose(raw);
  return {
    bookId,
    title: book.title,
    takeaways: parsed.takeaways || [],
    readingLevel: parsed.readingLevel || 'General',
    audience: parsed.audience || 'Library members',
  };
}

export async function ocrIngest(imageBase64, mimeType) {
  return visionOcr({ imageBase64, mimeType });
}

export { recommendForUser };
