import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { getSettings } from '../models/Settings.js';

function openaiClient() {
  return new OpenAI({ apiKey: env.openaiKey });
}

function openaiModel() {
  return env.openaiModel || env.aiModel || 'gpt-4o-mini';
}

function asMessages({ system, user, messages }) {
  const list = [{ role: 'system', content: system }];
  if (Array.isArray(messages) && messages.length) {
    list.push(...messages.filter((m) => m?.role && m?.content));
  } else if (user) {
    list.push({ role: 'user', content: user });
  }
  return list;
}

function liveProvider() {
  if (env.geminiKey) return 'gemini';
  if (env.openaiKey) return 'openai';
  if (env.anthropicKey) return 'anthropic';
  return null;
}

export function hasLiveAi() {
  return Boolean(liveProvider());
}

function geminiClient() {
  return new GoogleGenAI({ apiKey: env.geminiKey });
}

function geminiModel() {
  return env.geminiModel || 'gemini-2.0-flash';
}

function toGeminiContents(messages, user) {
  const out = [];
  if (Array.isArray(messages) && messages.length) {
    for (const m of messages) {
      if (!m?.content) continue;
      out.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content) }],
      });
    }
  } else if (user) {
    out.push({ role: 'user', parts: [{ text: String(user) }] });
  }
  if (!out.length) out.push({ role: 'user', parts: [{ text: String(user || 'Hello') }] });
  return out;
}

export async function completeChat({ system, user, json, messages }) {
  const settings = await getSettings();
  const provider = liveProvider() || (settings.ai?.provider || env.aiProvider || 'mock').toLowerCase();
  if (provider === 'openai' && env.openaiKey) return openaiComplete({ system, user, json, messages });
  if (provider === 'gemini' && env.geminiKey) return geminiComplete({ system, user, json, messages });
  if (provider === 'anthropic' && env.anthropicKey) return anthropicComplete({ system, user });
  if (json) return mockComplete({ system, user, json });
  throw new Error('Elena is temporarily unavailable. Please try again shortly.');
}

export async function* streamChat({ system, user, messages, signal }) {
  const settings = await getSettings();
  const provider = liveProvider() || (settings.ai?.provider || env.aiProvider || 'mock').toLowerCase();
  if (provider === 'openai' && env.openaiKey) {
    yield* openaiStream({ system, user, messages, signal });
    return;
  }
  if (provider === 'gemini' && env.geminiKey) {
    yield* geminiStream({ system, user, messages, signal });
    return;
  }
  if (provider === 'anthropic' && env.anthropicKey) {
    yield* anthropicStream({ system, user, signal });
    return;
  }
  throw new Error('Elena is temporarily unavailable. Please try again shortly.');
}

async function openaiComplete({ system, user, json, messages }) {
  const res = await openaiClient().chat.completions.create({
    model: openaiModel(),
    temperature: json ? 0.1 : 0.4,
    response_format: json ? { type: 'json_object' } : undefined,
    messages: asMessages({ system, user, messages }),
  });
  return res.choices?.[0]?.message?.content || '';
}

async function* openaiStream({ system, user, messages, signal }) {
  const stream = await openaiClient().chat.completions.create(
    {
      model: openaiModel(),
      temperature: 0.4,
      stream: true,
      messages: asMessages({ system, user, messages }),
    },
    { signal },
  );
  for await (const part of stream) {
    if (signal?.aborted) break;
    const chunk = part.choices?.[0]?.delta?.content;
    if (chunk) yield chunk;
  }
}

async function geminiComplete({ system, user, json, messages }) {
  const prompt = json ? `${user || ''}\nRespond with JSON only.` : user;
  const res = await geminiClient().models.generateContent({
    model: geminiModel(),
    contents: toGeminiContents(messages, prompt),
    config: {
      systemInstruction: system,
      temperature: json ? 0.1 : 0.6,
      maxOutputTokens: 2048,
      responseMimeType: json ? 'application/json' : undefined,
    },
  });
  return res.text || '';
}

async function* geminiStream({ system, user, messages, signal }) {
  const stream = await geminiClient().models.generateContentStream({
    model: geminiModel(),
    contents: toGeminiContents(messages, user),
    config: {
      systemInstruction: system,
      temperature: 0.6,
      maxOutputTokens: 2048,
      abortSignal: signal,
    },
  });
  for await (const chunk of stream) {
    if (signal?.aborted) break;
    const text = chunk.text;
    if (text) yield text;
  }
}

async function anthropicComplete({ system, user }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.anthropicKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.aiModel || 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Anthropic error');
  return data.content?.map((c) => c.text).join('\n') || '';
}

async function* anthropicStream({ system, user, signal }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'x-api-key': env.anthropicKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.aiModel || 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      stream: true,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Anthropic streaming error');
  }
  yield* readSseContent(res, (json) => (json.type === 'content_block_delta' ? json.delta?.text || '' : ''));
}

async function* readSseContent(res, pick) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const chunk = pick(json);
        if (chunk) yield chunk;
      } catch {
        // ignore malformed SSE frames
      }
    }
  }
}

function mockComplete({ user, json }) {
  const q = (user || '').toLowerCase();
  if (json && q.includes('summary')) {
    return JSON.stringify({
      takeaways: [
        'Core ideas are presented with practical examples for library learners.',
        'Concepts build from fundamentals to applied problem-solving.',
        'Useful as a structured reference for coursework and self-study.',
      ],
      readingLevel: 'Undergraduate',
      audience: 'Students and practitioners exploring this subject',
    });
  }
  if (json && q.includes('template')) {
    if (q.includes('computer science') || q.includes('issued most')) {
      return JSON.stringify({ templateId: 'topIssuedByCategoryThisMonth', slots: { category: 'Computer Science' } });
    }
    if (q.includes('overdue')) return JSON.stringify({ templateId: 'overdueLoans', slots: {} });
    if (q.includes('revenue') || q.includes('fine')) return JSON.stringify({ templateId: 'fineRevenueByMonth', slots: {} });
    return JSON.stringify({ templateId: 'categoryPopularity', slots: {} });
  }
  if (json) {
    if (q.includes('loan') || q.includes('borrow') || q.includes('due')) {
      return JSON.stringify({ kind: 'account', tool: 'getUserLoans', args: {} });
    }
    if (q.includes('fine')) {
      return JSON.stringify({ kind: 'account', tool: 'getUserFines', args: {} });
    }
    if (/\b(hi|hello|hey)\b/.test(q) && !q.includes('recommend')) {
      return JSON.stringify({ kind: 'general', tool: null });
    }
    if (q.includes('artificial intelligence') || q.includes('machine learning') || (q.includes('what is') && !q.includes('book') && !q.includes('available'))) {
      return JSON.stringify({ kind: 'general', tool: null });
    }
    if (q.includes('available') || q.includes('stock')) {
      return JSON.stringify({ kind: 'library', tool: 'checkAvailability', args: { query: user } });
    }
    if (q.includes('recommend') || q.includes('fantasy') || q.includes('science fiction') || q.includes('thriller')) {
      return JSON.stringify({ kind: 'recommendation', tool: 'searchBooks', args: { query: user.slice(-120) } });
    }
    return JSON.stringify({ kind: 'library', tool: 'searchBooks', args: { query: user.slice(-80) } });
  }
  if (/\b(hi|hello|hey)\b/.test(q) && q.length < 80) {
    return `Hi, I'm Elena. I can help you find books, check loans and fines, or talk through a topic you're studying. What would you like to do?`;
  }
  if (q.includes('artificial intelligence') || q.includes('what is ai')) {
    return 'Artificial intelligence is the field of building systems that perform tasks associated with human intelligence, such as language, perception, and decision-making. In this library, you can also find titles under Artificial Intelligence and Computer Science if you want to go deeper.';
  }
  if (q.includes('report') || q.includes('forecast')) {
    return [
      'Executive summary (mock provider): circulation is healthy with concentrated demand in Computer Science and AI.',
      'Inventory bottlenecks appear on high-affinity titles with zero available copies.',
      'Recommend expanding copies for the top 10 issued titles and running a hold-expiry sweep daily.',
    ].join(' ');
  }
  if (q.includes('normalization')) {
    return [
      'Database normalization is the process of organizing data to reduce redundancy and improve integrity.',
      'First normal form stores atomic values. Second normal form removes partial key dependencies.',
      'Third normal form removes transitive dependencies. In this LMS, books, copies, and loans are separate collections for that reason.',
    ].join(' ');
  }
  if (q.includes('"title"') || q.includes('availablecopies')) {
    return 'I found matching titles in the catalog. I will only confirm availability from the library records included with this request. Ask if you want a specific ISBN or a similar genre.';
  }
  return `Hi, I'm Elena. I can search the catalog by title, author, or genre, check availability, and summarize loans. Try asking for a title or a genre you enjoy.`;
}

async function* mockStream({ user, messages, system, signal }) {
  const last = messages?.filter((m) => m.role === 'user').at(-1)?.content || user;
  const text = mockComplete({ user: `${system || ''}\n${last}`, json: false });
  const parts = text.match(/\S+\s*/g) || [text];
  for (const part of parts) {
    if (signal?.aborted) return;
    yield part;
    await new Promise((resolve) => setImmediate(resolve));
  }
}

export async function visionOcr({ imageBase64, mimeType = 'image/jpeg' }) {
  if (env.geminiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.geminiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Extract book metadata from this cover or ISBN barcode image. Return JSON: title, authors, isbn, publisher, publicationYear, category, summary.',
              },
              { inlineData: { mimeType, data: imageBase64 } },
            ],
          },
        ],
      }),
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n') || '{}';
    return parseJsonLoose(text);
  }
  return {
    title: 'Extracted Title (mock OCR)',
    authors: ['Unknown Author'],
    isbn: '9780000000000',
    publisher: 'Aether Press',
    publicationYear: new Date().getFullYear(),
    category: 'Computer Science',
    summary: 'Metadata inferred locally because no vision provider key is configured.',
  };
}

export function parseJsonLoose(text) {
  try {
    const match = String(text).match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : text);
  } catch {
    return {};
  }
}
