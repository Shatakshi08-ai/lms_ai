import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { matchElenaKnowledge, normalizeQuestion } from '../src/ai/knowledgeMatch.js';
import {
  appRequest,
  auth,
  closeTestDb,
  connectTestDb,
  seedLms,
  tokenFor,
} from './helpers.js';

const kbPath = join(dirname(fileURLToPath(import.meta.url)), '../../client/src/data/elenaKnowledgeBase.json');

describe('Elena knowledge base', () => {
  it('loads at least 2000 Q&A records without empty or duplicate questions', () => {
    const kb = JSON.parse(readFileSync(kbPath, 'utf8'));
    assert.ok(Array.isArray(kb));
    assert.ok(kb.length >= 2000, `expected >= 2000, got ${kb.length}`);
    const seen = new Set();
    const categories = new Set();
    for (const row of kb) {
      assert.ok(String(row.question || '').trim(), 'empty question');
      assert.ok(String(row.answer || '').trim(), 'empty answer');
      const key = normalizeQuestion(row.question);
      assert.equal(seen.has(key), false, `duplicate question: ${row.question}`);
      seen.add(key);
      if (row.category) categories.add(row.category);
    }
    assert.ok(categories.size > 0);
  });

  it('matches LMS questions to relevant answers', () => {
    const kb = JSON.parse(readFileSync(kbPath, 'utf8'));
    const byCat = new Map();
    for (const row of kb) {
      if (row.category && !byCat.has(row.category)) byCat.set(row.category, row);
    }
    assert.ok(byCat.size > 0);
    for (const row of byCat.values()) {
      const hit = matchElenaKnowledge(row.question);
      assert.ok(hit, `no match for stored question: ${row.question}`);
      assert.equal(hit.answer, row.answer);
    }
    const samples = [
      'How do I create a QuestLearn account?',
      'How do I log in to QuestLearn?',
      'How do I search for a book?',
      'How do I borrow a book?',
      'How do I return a book?',
      'How do I reserve a book?',
      'When is my book due?',
      'How are library fines calculated?',
      'How does the book cart work?',
      'What are upcoming books?',
    ];
    for (const q of samples) {
      const hit = matchElenaKnowledge(q);
      assert.ok(hit, `no KB match for: ${q}`);
      assert.ok(hit.answer.length > 20);
    }
  });
});

describe('Elena chatbot API', () => {
  let api;
  let studentTok;
  let adminTok;

  before(async () => {
    await connectTestDb();
    api = appRequest();
    const seed = await seedLms();
    studentTok = await tokenFor(api, seed.student);
    adminTok = await tokenFor(api, seed.admin);
  });

  after(async () => {
    await closeTestDb();
  });

  it('requires authentication', async () => {
    const res = await api.post('/api/v1/ai/elena').send({ message: 'How do I log in?' });
    assert.equal(res.status, 401);
  });

  it('requires a message', async () => {
    const res = await api.post('/api/v1/ai/elena').set(auth(studentTok)).send({});
    assert.equal(res.status, 400);
  });

  it('answers LMS how-to questions from the knowledge base', async () => {
    const res = await api.post('/api/v1/ai/elena').set(auth(studentTok)).send({
      message: 'How do I log in to QuestLearn?',
    });
    assert.equal(res.status, 200);
    assert.ok(String(res.body.answer).toLowerCase().includes('login') || String(res.body.answer).length > 40);
  });

  it('answers a cart question without inventing a borrow', async () => {
    const res = await api.post('/api/v1/ai/elena').set(auth(studentTok)).send({
      message: 'What is in my cart?',
    });
    assert.equal(res.status, 200);
    assert.match(String(res.body.answer), /cart/i);
  });

  it('gives a safe fallback for unknown questions', async () => {
    const res = await api.post('/api/v1/ai/elena').set(auth(studentTok)).send({
      message: 'xyzzy plugh unrelated quantum banana 999',
    });
    assert.equal(res.status, 200);
    const answer = String(res.body.answer).toLowerCase();
    assert.ok(answer.includes('elena') || answer.includes('library') || answer.includes('questlearn'));
    assert.equal(answer.includes('quantum banana is definitely'), false);
  });

  it('blocks patrons from admin NL analytics', async () => {
    const res = await api.post('/api/v1/ai/nl-query').set(auth(studentTok)).send({ question: 'top issued' });
    assert.equal(res.status, 403);
  });

  it('staff can read AI status', async () => {
    const res = await api.get('/api/v1/ai/status').set(auth(adminTok));
    assert.equal(res.status, 200);
  });
});
