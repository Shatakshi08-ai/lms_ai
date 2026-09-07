import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const STOP = new Set(
  'a an the to of in on for with from at is are was were be been being i me my we you your do does did how can what where when why who which please help me about into and or if it this that'.split(
    ' ',
  ),
);

let cache = null;

function loadKb() {
  if (cache) return cache;
  const dir = dirname(fileURLToPath(import.meta.url));
  const file = join(dir, '../../../client/src/data/elenaKnowledgeBase.json');
  try {
    cache = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    cache = [];
  }
  return cache;
}

export function normalizeQuestion(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SYNONYMS = {
  reservation: ['reserve', 'hold', 'reservations'],
  reserve: ['reservation', 'hold'],
  reservations: ['reservation', 'reserve'],
  login: ['signin', 'sign'],
  signin: ['login'],
  borrow: ['issue', 'checkout', 'loan'],
  borrowing: ['borrow', 'loan'],
  returning: ['return'],
  fines: ['fine'],
  cart: ['basket'],
  admin: ['administrator', 'admins'],
  administrator: ['admin'],
};

export function tokensOf(text) {
  const base = normalizeQuestion(text)
    .split(' ')
    .filter((w) => w.length > 2 && !STOP.has(w));
  const extra = [];
  for (const w of base) {
    for (const syn of SYNONYMS[w] || []) extra.push(syn);
  }
  return [...base, ...extra];
}

export function matchElenaKnowledge(question, { minScore = 0.42 } = {}) {
  const kb = loadKb();
  const qNorm = normalizeQuestion(question);
  const qTokens = tokensOf(question);
  if (!qNorm || !qTokens.length || !kb.length) return null;

  let best = null;
  for (const row of kb) {
    const nq = normalizeQuestion(row.question);
    if (!nq) continue;
    if (nq === qNorm) return { ...row, score: 1 };
    let score = 0;
    if (qNorm.includes(nq) || nq.includes(qNorm)) score += 0.45;
    const t = tokensOf(row.question);
    if (!t.length) continue;
    const overlap = t.filter((w) => qTokens.includes(w)).length;
    score += overlap / Math.max(t.length, qTokens.length, 1);
    if (qTokens.some((tok) => nq.includes(tok) && tok.length > 5)) score += 0.12;
    if (row.category && qNorm.includes(normalizeQuestion(row.category))) score += 0.05;
    if (qTokens.length === 1) score -= 0.15;
    if (!best || score > best.score) best = { ...row, score };
  }
  if (!best || best.score < minScore) return null;
  return best;
}

export function formatToolAnswer(tool, result) {
  if (!result) return '';
  if (tool === 'getUserLoans') {
    const items = result.items || [];
    if (!items.length) return 'You do not currently have any issued books.';
    return `You currently have ${items.length} issued title(s): ${items
      .map((i) => `${i.title}${i.dueDate ? ` (due ${new Date(i.dueDate).toLocaleDateString()})` : ''} · ${i.status}`)
      .join('; ')}.`;
  }
  if (tool === 'getUserFines') {
    return `Your pending fine total is ${result.total || 0}. I cannot mark a fine as paid — please use Fines in your dashboard or visit the librarian.`;
  }
  if (tool === 'getUserWishlist') {
    const items = result.items || [];
    if (!items.length) return 'Your wishlist is empty. Open a book and tap the heart to save it.';
    return `Your wishlist includes: ${items.map((i) => i.title).join(', ')}.`;
  }
  if (tool === 'getUserCart') {
    const items = result.items || [];
    if (!items.length) return 'Your book cart is empty. Open a title and choose Add to cart.';
    return `Your cart includes: ${items.map((i) => i.title).join(', ')}. Adding a book to the cart does not borrow it. A librarian still issues the copy.`;
  }
  if (tool === 'getLibraryStats') {
    return `Live QuestLearn counts — books: ${result.totalBooks}, available titles: ${result.availableBooks}, issued: ${result.issued}, overdue: ${result.overdue}, members: ${result.members}, students: ${result.students}, pending reservations: ${result.pendingHolds}.`;
  }
  if (tool === 'searchBooks') {
    const items = result.items || [];
    if (!items.length) return 'I did not find matching titles in the QuestLearn catalog. Try another keyword or browse Categories.';
    return `I found ${items.length} catalog match(es): ${items
      .map((i) => `${i.title} (${i.availableCopies || 0} available${i.isFree ? ', free' : ''})`)
      .join('; ')}.`;
  }
  if (tool === 'listCategories') {
    return `QuestLearn categories include: ${(result.categories || []).slice(0, 20).join(', ')}.`;
  }
  return '';
}
