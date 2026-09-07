import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Cart } from '../src/models/Cart.js';
import { Circulation } from '../src/models/Circulation.js';
import {
  appRequest,
  auth,
  closeTestDb,
  connectTestDb,
  seedLms,
  tokenFor,
} from './helpers.js';

describe('book cart', () => {
  let api;
  let seed;
  let studentTok;
  let memberTok;

  before(async () => {
    await connectTestDb();
    api = appRequest();
    seed = await seedLms();
    studentTok = await tokenFor(api, seed.student);
    memberTok = await tokenFor(api, seed.member);
  });

  after(async () => {
    await closeTestDb();
  });

  it('adds, lists, and does not duplicate cart rows', async () => {
    const id = seed.catalogA.book._id;
    const a = await api.post(`/api/v1/books/${id}/cart`).set(auth(studentTok));
    const b = await api.post(`/api/v1/books/${id}/cart`).set(auth(studentTok));
    const view = await api.get('/api/v1/books/cart').set(auth(studentTok));
    const count = await Cart.countDocuments({ userId: seed.student._id, bookId: id });
    assert.equal(a.status, 201);
    assert.equal(b.status, 200);
    assert.equal(b.body.alreadyInCart, true);
    assert.equal(view.status, 200);
    assert.equal(view.body.total, 1);
    assert.equal(view.body.items[0].title, 'Algorithms Unlocked');
    assert.ok(view.body.items[0].coverImage);
    assert.ok(view.body.items[0].authors?.length);
    assert.equal(view.body.items[0].category, 'Computer Science');
    assert.ok(typeof view.body.items[0].availableCopies === 'number');
    assert.equal(count, 1);
  });

  it('adding to cart does not issue a loan', async () => {
    const loans = await Circulation.countDocuments({ userId: seed.student._id });
    assert.equal(loans, 0);
  });

  it('removes an item and can empty the cart', async () => {
    await api.post(`/api/v1/books/${seed.catalogB.book._id}/cart`).set(auth(studentTok));
    const removed = await api.delete(`/api/v1/books/${seed.catalogA.book._id}/cart`).set(auth(studentTok));
    assert.equal(removed.status, 200);
    const mid = await api.get('/api/v1/books/cart').set(auth(studentTok));
    assert.equal(mid.body.total, 1);
    const cleared = await api.delete('/api/v1/books/cart').set(auth(studentTok));
    assert.equal(cleared.status, 200);
    const empty = await api.get('/api/v1/books/cart').set(auth(studentTok));
    assert.equal(empty.body.total, 0);
    assert.equal(empty.body.items.length, 0);
  });

  it('carts are per-user', async () => {
    await api.post(`/api/v1/books/${seed.catalogA.book._id}/cart`).set(auth(memberTok));
    const memberCart = await api.get('/api/v1/books/cart').set(auth(memberTok));
    const studentCart = await api.get('/api/v1/books/cart').set(auth(studentTok));
    assert.equal(memberCart.body.total, 1);
    assert.equal(studentCart.body.total, 0);
  });

  it('rejects cart add for a missing book', async () => {
    const res = await api.post('/api/v1/books/000000000000000000000000/cart').set(auth(memberTok));
    assert.equal(res.status, 404);
  });

  it('requires authentication', async () => {
    const res = await api.get('/api/v1/books/cart');
    assert.equal(res.status, 401);
  });

  it('member can reserve a title that is in the cart without auto-issuing', async () => {
    const bookId = seed.catalogB.book._id;
    await api.post(`/api/v1/books/${bookId}/cart`).set(auth(memberTok));
    const hold = await api.post('/api/v1/circulation/reservations').set(auth(memberTok)).send({ bookId });
    assert.equal(hold.status, 201);
    const loans = await Circulation.countDocuments({ userId: seed.member._id });
    assert.equal(loans, 0);
  });
});
