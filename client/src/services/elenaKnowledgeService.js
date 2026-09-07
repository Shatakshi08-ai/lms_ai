import kb from '../data/elenaKnowledgeBase.json';

export function normalizeQuestion(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchKnowledgeBase(question) {
  const q = normalizeQuestion(question);
  if (!q) return null;
  return kb.find((row) => normalizeQuestion(row.question) === q) || null;
}

export function knowledgeCount() {
  return kb.length;
}
