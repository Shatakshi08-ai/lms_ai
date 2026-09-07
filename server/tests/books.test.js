import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Book } from '../src/models/Book.js';
import {
  appRequest,
  auth,
  closeTestDb,
  connectTestDb,
  seedLms,
  tokenFor,
} from './helpers.js';

describe('book management', () => {
  let api;
  let seed;
  let adminTok;
  let libTok;
  let studentTok;

  before(async () => {
    await connectTestDb();
    api = appRequest();
    seed = await seedLms();
    adminTok = await tokenFor(api, seed.admin);
    libTok = await tokenFor(api, seed.librarian);
    studentTok = await tokenFor(api, seed.student);
  });

  after(async () => {
    await closeTestDb();
  });

  it('lists books for an authenticated user', async () => {
    const res = await api.get('/api/v1/books').set(auth(studentTok));
    assert.equal(res.status, 200);
    assert.equal(res.body.total, await Book.countDocuments());
    assert.ok(res.body.items.length >= 2);
  });

  it('gets a single book with copies and availability', async () => {
    const res = await api.get(`/api/v1/books/${seed.catalogA.book._id}`).set(auth(studentTok));
    assert.equal(res.status, 200);
    assert.equal(res.body.book.title, 'Algorithms Unlocked');
    assert.ok(res.body.book.availableCopies > 0);
    assert.ok(res.body.copies.length >= 2);
  });

  it('searches by title, author, and ISBN', async () => {
    const title = await api.get('/api/v1/books?q=Algorithms').set(auth(studentTok));
    const author = await api.get('/api/v1/books?q=Austen').set(auth(studentTok));
    const isbn = await api.get(`/api/v1/books?q=${seed.catalogA.book.isbn}`).set(auth(studentTok));
    assert.equal(title.status, 200);
    assert.ok(title.body.items.some((b) => b.title.includes('Algorithms')));
    assert.ok(author.body.items.some((b) => (b.authors || []).join(' ').includes('Austen')));
    assert.ok(isbn.body.items.some((b) => String(b._id) === String(seed.catalogA.book._id)));
  });

  it('filters by category', async () => {
    const res = await api.get('/api/v1/books?category=Literature').set(auth(studentTok));
    assert.equal(res.status, 200);
    assert.ok(res.body.items.every((b) => /literature/i.test(b.category || '') || (b.genres || []).some((g) => /literature/i.test(g))));
  });

  it('returns an empty list for unmatched search', async () => {
    const res = await api.get('/api/v1/books?q=zzznomatchquestlearnxyz').set(auth(studentTok));
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 0);
    assert.equal(res.body.total, 0);
  });

  it('rejects invalid and missing book ids', async () => {
    const bad = await api.get('/api/v1/books/not-a-valid-id').set(auth(studentTok));
    const missing = await api.get(`/api/v1/books/${new mongoose.Types.ObjectId()}`).set(auth(studentTok));
    assert.equal(bad.status, 404);
    assert.equal(missing.status, 404);
  });

  it('admin can add and edit a book', async () => {
    const created = await api.post('/api/v1/books').set(auth(adminTok)).send({
      title: 'Test Catalog Title',
      isbn: `978${Date.now()}`.slice(0, 13),
      authors: ['QA Author'],
      category: 'Physics',
      summary: 'Created by automated test',
      initialCopies: 2,
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.book.title, 'Test Catalog Title');
    assert.equal(created.body.book.availableCopies, 2);
    const patched = await api.patch(`/api/v1/books/${created.body.book._id}`).set(auth(adminTok)).send({
      summary: 'Updated summary',
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.book.summary, 'Updated summary');
  });

  it('rejects book create with missing required fields', async () => {
    const res = await api.post('/api/v1/books').set(auth(adminTok)).send({ title: 'No ISBN' });
    assert.equal(res.status, 400);
  });

  it('does not expose a delete-book route', async () => {
    const res = await api.delete(`/api/v1/books/${seed.catalogA.book._id}`).set(auth(adminTok));
    assert.equal(res.status, 404);
  });

  it('librarian can create a book and receives a unique Book ID', async () => {
    const copyId = seed.catalogA.copies[0]._id;
    const ok = await api.patch(`/api/v1/books/copies/${copyId}`).set(auth(libTok)).send({ condition: 'GOOD' });
    const created = await api.post('/api/v1/books').set(auth(libTok)).send({
      title: 'Librarian Added Title',
      isbn: `979${Date.now()}`.slice(0, 13),
      category: 'History',
      authors: ['Staff Author'],
      initialCopies: 1,
    });
    assert.equal(ok.status, 200);
    assert.equal(created.status, 201);
    assert.match(created.body.book.catalogId, /^BOOK-\d{6}$/);
    assert.equal(created.body.book.barcode, created.body.book.catalogId);
  });

  it('unauthenticated visitors cannot use staff create', async () => {
    const res = await api.post('/api/v1/books').send({
      title: 'Anon',
      isbn: '2222222222222',
      category: 'History',
    });
    assert.equal(res.status, 401);
  });
});
