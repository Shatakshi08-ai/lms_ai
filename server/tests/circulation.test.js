import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Book } from '../src/models/Book.js';
import { BookCopy } from '../src/models/BookCopy.js';
import { Circulation } from '../src/models/Circulation.js';
import { Reservation } from '../src/models/Reservation.js';
import {
  appRequest,
  auth,
  closeTestDb,
  connectTestDb,
  seedLms,
  tokenFor,
} from './helpers.js';

describe('borrowing returning reservations', () => {
  let api;
  let seed;
  let adminTok;
  let libTok;
  let studentTok;
  let memberTok;

  before(async () => {
    await connectTestDb();
    api = appRequest();
    seed = await seedLms();
    adminTok = await tokenFor(api, seed.admin);
    libTok = await tokenFor(api, seed.librarian);
    studentTok = await tokenFor(api, seed.student);
    memberTok = await tokenFor(api, seed.member);
  });

  after(async () => {
    await closeTestDb();
  });

  it('rejects issue without required fields', async () => {
    const res = await api.post('/api/v1/circulation/issue').set(auth(libTok)).send({});
    assert.equal(res.status, 400);
  });

  it('rejects unauthorized issue by a student', async () => {
    const res = await api.post('/api/v1/circulation/issue').set(auth(studentTok)).send({
      userId: seed.student._id,
      copyId: seed.catalogA.copies[0]._id,
    });
    assert.equal(res.status, 403);
  });

  it('issues a book, sets due date, and updates copy availability', async () => {
    const copyId = seed.catalogA.copies[0]._id;
    const res = await api.post('/api/v1/circulation/issue').set(auth(libTok)).send({
      userId: seed.student._id,
      copyId,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.loan.status, 'ISSUED');
    assert.ok(res.body.loan.dueDate);
    const copy = await BookCopy.findById(copyId);
    const book = await Book.findById(seed.catalogA.book._id);
    const row = await Circulation.findById(res.body.loan._id);
    assert.equal(copy.status, 'ISSUED');
    assert.equal(book.availableCopies, 1);
    assert.equal(row.status, 'ISSUED');
  });

  it('rejects issuing the same title again', async () => {
    const res = await api.post('/api/v1/circulation/issue').set(auth(libTok)).send({
      userId: seed.student._id,
      copyId: seed.catalogA.copies[1]._id,
    });
    assert.equal(res.status, 400);
  });

  it('student can see own loan and cannot issue', async () => {
    const mine = await api.get('/api/v1/circulation/loans/me').set(auth(studentTok));
    assert.equal(mine.status, 200);
    assert.equal(mine.body.items.length, 1);
  });

  it('renews an active loan', async () => {
    const loan = await Circulation.findOne({ userId: seed.student._id, status: 'ISSUED' });
    const res = await api.post(`/api/v1/circulation/renew/${loan._id}`).set(auth(studentTok));
    assert.equal(res.status, 200);
    assert.ok(new Date(res.body.loan.dueDate) >= new Date(loan.dueDate));
  });

  it('returns the copy and records RETURNED', async () => {
    const copyId = seed.catalogA.copies[0]._id;
    const res = await api.post('/api/v1/circulation/return').set(auth(adminTok)).send({ copyId });
    assert.equal(res.status, 200);
    const copy = await BookCopy.findById(copyId);
    const circ = await Circulation.findOne({ copyId }).sort({ issueDate: -1 });
    assert.equal(copy.status, 'AVAILABLE');
    assert.equal(circ.status, 'RETURNED');
    assert.ok(circ.returnDate);
  });

  it('rejects return of a copy that is not issued', async () => {
    const res = await api.post('/api/v1/circulation/return').set(auth(libTok)).send({
      copyId: seed.catalogA.copies[0]._id,
    });
    assert.equal(res.status, 400);
  });

  it('rejects unavailable copy issue', async () => {
    const copy = seed.catalogB.copies[0];
    copy.status = 'MAINTENANCE';
    await copy.save();
    const res = await api.post('/api/v1/circulation/issue').set(auth(libTok)).send({
      userId: seed.member._id,
      copyId: copy._id,
    });
    assert.equal(res.status, 400);
    copy.status = 'AVAILABLE';
    await copy.save();
  });

  it('places and lists a reservation', async () => {
    const res = await api.post('/api/v1/circulation/reservations').set(auth(memberTok)).send({
      bookId: seed.catalogB.book._id,
    });
    assert.equal(res.status, 201);
    const listed = await api.get('/api/v1/circulation/reservations').set(auth(memberTok));
    assert.equal(listed.status, 200);
    assert.ok(listed.body.items.length >= 1);
    const db = await Reservation.countDocuments({ userId: seed.member._id });
    assert.ok(db >= 1);
  });

  it('rejects invalid circulation id renew', async () => {
    const res = await api.post('/api/v1/circulation/renew/not-valid').set(auth(studentTok));
    assert.ok(res.status === 400 || res.status === 404);
  });
});
