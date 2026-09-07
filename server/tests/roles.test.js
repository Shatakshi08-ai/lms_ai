import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { User } from '../src/models/User.js';
import { Book } from '../src/models/Book.js';
import { Circulation } from '../src/models/Circulation.js';
import {
  appRequest,
  auth,
  closeTestDb,
  connectTestDb,
  seedLms,
  tokenFor,
} from './helpers.js';

describe('role-based access', () => {
  let api;
  let seed;
  let adminTok;
  let libTok;
  let memberTok;
  let studentTok;

  before(async () => {
    await connectTestDb();
    api = appRequest();
    seed = await seedLms();
    adminTok = await tokenFor(api, seed.admin);
    libTok = await tokenFor(api, seed.librarian);
    memberTok = await tokenFor(api, seed.member);
    studentTok = await tokenFor(api, seed.student);
  });

  after(async () => {
    await closeTestDb();
  });

  it('admin dashboard loads live counts', async () => {
    const res = await api.get('/api/v1/analytics/dashboard').set(auth(adminTok));
    assert.equal(res.status, 200);
    const users = await User.countDocuments();
    const members = await User.countDocuments({ role: 'MEMBER' });
    const students = await User.countDocuments({ role: 'STUDENT' });
    const librarians = await User.countDocuments({ role: 'LIBRARIAN' });
    const books = await Book.countDocuments();
    assert.equal(res.body.kpis.totalUsers, users);
    assert.equal(res.body.kpis.totalMembers, members);
    assert.equal(res.body.kpis.totalStudents, students);
    assert.equal(res.body.kpis.totalLibrarians, librarians);
    assert.equal(res.body.kpis.totalBooks, books);
    assert.ok(Array.isArray(res.body.recent.issues));
  });

  it('admin can list users, members, students, librarians, books, and loans', async () => {
    const users = await api.get('/api/v1/users').set(auth(adminTok));
    const members = await api.get('/api/v1/users?role=MEMBER').set(auth(adminTok));
    const students = await api.get('/api/v1/users?role=STUDENT').set(auth(adminTok));
    const librarians = await api.get('/api/v1/users?role=LIBRARIAN').set(auth(adminTok));
    const books = await api.get('/api/v1/books').set(auth(adminTok));
    const loans = await api.get('/api/v1/circulation/loans').set(auth(adminTok));
    assert.equal(users.status, 200);
    assert.ok(users.body.total >= 4);
    assert.equal(members.body.items.every((u) => u.role === 'MEMBER'), true);
    assert.equal(students.body.items.every((u) => u.role === 'STUDENT'), true);
    assert.equal(librarians.body.items.every((u) => u.role === 'LIBRARIAN'), true);
    assert.equal(books.status, 200);
    assert.ok(books.body.total >= 2);
    assert.equal(loans.status, 200);
  });

  it('librarian dashboard and permitted lists load; librarians can add catalog titles', async () => {
    const dash = await api.get('/api/v1/analytics/dashboard').set(auth(libTok));
    const patrons = await api.get('/api/v1/users').set(auth(libTok));
    const books = await api.get('/api/v1/books').set(auth(libTok));
    const loans = await api.get('/api/v1/circulation/loans').set(auth(libTok));
    const create = await api.post('/api/v1/books').set(auth(libTok)).send({
      title: 'Librarian Catalog Title',
      isbn: `978${Date.now()}`.slice(0, 13),
      category: 'History',
    });
    const staffUser = await api.get(`/api/v1/users/${seed.admin._id}`).set(auth(libTok));
    assert.equal(dash.status, 200);
    assert.equal(patrons.status, 200);
    assert.equal(patrons.body.items.every((u) => ['STUDENT', 'MEMBER'].includes(u.role)), true);
    assert.equal(books.status, 200);
    assert.equal(loans.status, 200);
    assert.equal(create.status, 201);
    assert.match(create.body.book.catalogId, /^BOOK-\d{6}$/);
    assert.equal(staffUser.status, 403);
  });

  it('member dashboard, catalog, and cart work; admin APIs are blocked', async () => {
    const me = await api.get('/api/v1/analytics/me').set(auth(memberTok));
    const books = await api.get('/api/v1/books').set(auth(memberTok));
    const one = await api.get(`/api/v1/books/${seed.catalogA.book._id}`).set(auth(memberTok));
    const cart = await api.post(`/api/v1/books/${seed.catalogA.book._id}/cart`).set(auth(memberTok));
    const loans = await api.get('/api/v1/circulation/loans/me').set(auth(memberTok));
    const users = await api.get('/api/v1/users').set(auth(memberTok));
    const dash = await api.get('/api/v1/analytics/dashboard').set(auth(memberTok));
    assert.equal(me.status, 200);
    assert.equal(me.body.profile.email, seed.member.email);
    assert.equal(books.status, 200);
    assert.equal(one.status, 200);
    assert.equal(one.body.book.title, 'Algorithms Unlocked');
    assert.equal(cart.status, 201);
    assert.equal(loans.status, 200);
    assert.equal(users.status, 403);
    assert.equal(dash.status, 403);
  });

  it('student dashboard, catalog, cart, and own loans work; admin APIs are blocked', async () => {
    const me = await api.get('/api/v1/analytics/me').set(auth(studentTok));
    const books = await api.get('/api/v1/books').set(auth(studentTok));
    const cart = await api.post(`/api/v1/books/${seed.catalogB.book._id}/cart`).set(auth(studentTok));
    const loans = await api.get('/api/v1/circulation/loans/me').set(auth(studentTok));
    const report = await api.get('/api/v1/ai/report').set(auth(studentTok));
    assert.equal(me.status, 200);
    assert.equal(books.status, 200);
    assert.equal(cart.status, 201);
    assert.equal(loans.status, 200);
    assert.equal(report.status, 403);
  });

  it('dashboard issued/returned/overdue match circulation collection', async () => {
    const res = await api.get('/api/v1/analytics/dashboard').set(auth(adminTok));
    const issued = await Circulation.countDocuments({ status: { $in: ['ISSUED', 'OVERDUE'] } });
    const returned = await Circulation.countDocuments({ status: 'RETURNED' });
    assert.equal(res.body.kpis.issuedBooks, issued);
    assert.equal(res.body.kpis.returnedBooks, returned);
    assert.equal(res.body.kpis.overdueBooks, await Circulation.countDocuments({
      status: { $in: ['ISSUED', 'OVERDUE'] },
      dueDate: { $lt: new Date() },
    }));
  });
});
