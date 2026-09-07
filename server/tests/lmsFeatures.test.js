import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Wishlist } from '../src/models/Wishlist.js';
import { Notification } from '../src/models/Notification.js';
import { AuditLog } from '../src/models/AuditLog.js';
import {
  appRequest,
  auth,
  closeTestDb,
  connectTestDb,
  seedLms,
  tokenFor,
} from './helpers.js';

describe('wishlist notifications activity', () => {
  let api;
  let seed;
  let studentTok;
  let memberTok;
  let adminTok;
  let libTok;

  before(async () => {
    await connectTestDb();
    api = appRequest();
    seed = await seedLms();
    studentTok = await tokenFor(api, seed.student);
    memberTok = await tokenFor(api, seed.member);
    adminTok = await tokenFor(api, seed.admin);
    libTok = await tokenFor(api, seed.librarian);
  });

  after(async () => {
    await closeTestDb();
  });

  it('adds wishlist without duplicates and persists per user', async () => {
    const id = seed.catalogA.book._id;
    const a = await api.post(`/api/v1/books/${id}/wishlist`).set(auth(studentTok));
    const b = await api.post(`/api/v1/books/${id}/wishlist`).set(auth(studentTok));
    const list = await api.get('/api/v1/books/wishlist').set(auth(studentTok));
    const count = await Wishlist.countDocuments({ userId: seed.student._id, bookId: id });
    assert.equal(a.status, 201);
    assert.equal(b.status, 200);
    assert.equal(b.body.alreadyInWishlist, true);
    assert.equal(list.body.total, 1);
    assert.equal(count, 1);
  });

  it('creates a cart notification for the owner only', async () => {
    const id = seed.catalogB.book._id;
    await api.post(`/api/v1/books/${id}/cart`).set(auth(memberTok));
    const notes = await api.get('/api/v1/analytics/notifications').set(auth(memberTok));
    assert.equal(notes.status, 200);
    assert.ok((notes.body.items || []).some((n) => n.type === 'CART'));
    const other = await api.get('/api/v1/analytics/notifications').set(auth(studentTok));
    assert.equal((other.body.items || []).some((n) => n.meta?.bookId === String(id) && n.type === 'CART'), false);
  });

  it('marks a notification read', async () => {
    const notes = await api.get('/api/v1/analytics/notifications').set(auth(memberTok));
    const unread = (notes.body.items || []).find((n) => !n.read);
    assert.ok(unread);
    const res = await api.patch(`/api/v1/analytics/notifications/${unread._id}/read`).set(auth(memberTok));
    assert.equal(res.status, 200);
    assert.equal(res.body.item.read, true);
  });

  it('downloads a complete generated PDF for stored full text', async () => {
    const { createCatalogBook } = await import('./helpers.js');
    const seeded = await createCatalogBook({
      title: 'Complete PDF Source',
      isFree: true,
    });
    await (await import('../src/models/Book.js')).Book.findByIdAndUpdate(seeded.book._id, {
      fullText: 'Chapter one.\n\nThe complete book text for QuestLearn download testing.\n\nChapter two continues the story so the PDF has more than a preview.',
    });
    const res = await api.get(`/api/v1/books/${seeded.book._id}/pdf`).set(auth(studentTok));
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /pdf/);
    assert.match(res.headers['content-disposition'], /attachment/);
    assert.equal(Buffer.from(res.body).slice(0, 5).toString(), '%PDF-');
    assert.ok(Buffer.from(res.body).length > 200);
  });

  it('assigns unique Book IDs and finds books by barcode', async () => {
    const a = await api.post('/api/v1/books').set(auth(adminTok)).send({
      title: 'Book Code Alpha',
      isbn: `978${Date.now()}1`.slice(0, 13),
      category: 'Physics',
      authors: ['A'],
    });
    const b = await api.post('/api/v1/books').set(auth(adminTok)).send({
      title: 'Book Code Beta',
      isbn: `978${Date.now()}2`.slice(0, 13),
      category: 'Physics',
      authors: ['B'],
    });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.match(a.body.book.catalogId, /^BOOK-\d{6}$/);
    assert.notEqual(a.body.book.catalogId, b.body.book.catalogId);
    const lookup = await api.get(`/api/v1/books/lookup/${a.body.book.catalogId}`).set(auth(libTok));
    assert.equal(lookup.status, 200);
    assert.equal(lookup.body.book.title, 'Book Code Alpha');
    const denied = await api.get(`/api/v1/books/lookup/${a.body.book.catalogId}`).set(auth(studentTok));
    assert.equal(denied.status, 403);
  });

  it('rejects unauthorized PDF download and missing PDF', async () => {
    const anon = await api.get(`/api/v1/books/${seed.catalogA.book._id}/pdf`);
    assert.equal(anon.status, 401);
    const missing = await api.get(`/api/v1/books/${seed.catalogA.book._id}/pdf`).set(auth(studentTok));
    assert.equal(missing.status, 404);
  });

  it('staff can read activity logs; students cannot', async () => {
    const denied = await api.get('/api/v1/analytics/audit').set(auth(studentTok));
    const admin = await api.get('/api/v1/analytics/audit').set(auth(adminTok));
    const lib = await api.get('/api/v1/analytics/audit').set(auth(libTok));
    assert.equal(denied.status, 403);
    assert.equal(admin.status, 200);
    assert.equal(lib.status, 200);
    assert.ok(admin.body.items.some((i) => i.action === 'CART_ADD' || i.action === 'WISHLIST_ADD' || i.action === 'AUTH_LOGIN'));
    const n = await Notification.countDocuments({ userId: seed.student._id });
    assert.ok(n >= 1);
    const logs = await AuditLog.countDocuments({ action: 'WISHLIST_ADD' });
    assert.ok(logs >= 1);
  });

  it('removes wishlist entries', async () => {
    const id = seed.catalogA.book._id;
    const res = await api.delete(`/api/v1/books/${id}/wishlist`).set(auth(studentTok));
    assert.equal(res.status, 200);
    const count = await Wishlist.countDocuments({ userId: seed.student._id, bookId: id });
    assert.equal(count, 0);
  });
});
