process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-chars-xxxx';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-xxxx';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_ai_test';

import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Book } from '../src/models/Book.js';
import { BookCopy } from '../src/models/BookCopy.js';
import { getSettings } from '../src/models/Settings.js';

export const PASSWORD = 'Password123!';
const stamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
let mailSeq = 0;

export function mail(role) {
  mailSeq += 1;
  return `${role}.${stamp}.${mailSeq}@questlearn.test`;
}

export async function connectTestDb() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  await mongoose.connection.dropDatabase();
  await getSettings();
}

export async function closeTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
  }
}

export function appRequest() {
  return request(createApp());
}

export async function createUser(overrides = {}) {
  mailSeq += 1;
  const role = overrides.role || 'STUDENT';
  const user = await User.create({
    name: overrides.name || `${role} Tester`,
    email: overrides.email || mail(role.toLowerCase()),
    password: PASSWORD,
    role,
    status: overrides.status || 'ACTIVE',
    readerId: overrides.readerId || `T${Date.now().toString(36)}${mailSeq}${Math.random().toString(36).slice(2, 8)}`,
    department: overrides.department || 'QA',
    phone: overrides.phone || '',
    maxBorrowLimit: overrides.maxBorrowLimit || 5,
    preferencesOnboarded: true,
  });
  return user;
}

export async function loginAs(api, email, password = PASSWORD) {
  const res = await api.post('/api/v1/auth/login').send({ email, password, remember: true });
  return res;
}

export async function tokenFor(api, user) {
  const res = await loginAs(api, user.email);
  if (res.status !== 200) throw new Error(`login failed ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.accessToken;
}

export function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function seedLms() {
  const admin = await createUser({ role: 'ADMIN', name: 'Admin Tester' });
  const librarian = await createUser({ role: 'LIBRARIAN', name: 'Librarian Tester' });
  const member = await createUser({ role: 'MEMBER', name: 'Member Tester' });
  const student = await createUser({ role: 'STUDENT', name: 'Student Tester' });
  const catalogA = await createCatalogBook({
    title: 'Algorithms Unlocked',
    authors: ['Thomas Cormen'],
    category: 'Computer Science',
  });
  const catalogB = await createCatalogBook({
    title: 'Pride and Prejudice',
    authors: ['Jane Austen'],
    category: 'Literature',
    copies: 1,
  });
  return { admin, librarian, member, student, catalogA, catalogB };
}

let isbnSeq = 1000000000000 + Math.floor(Math.random() * 100000);

export async function createCatalogBook(overrides = {}) {
  isbnSeq += 1;
  const book = await Book.create({
    title: overrides.title || `Test Book ${isbnSeq}`,
    isbn: String(isbnSeq),
    authors: overrides.authors || ['Ada Tester'],
    category: overrides.category || 'Computer Science',
    genres: overrides.genres || ['Computer Science'],
    summary: overrides.summary || 'A controlled test title.',
    coverImage: overrides.coverImage || 'https://example.com/cover.jpg',
    isFree: Boolean(overrides.isFree),
    availableCopies: 0,
    totalCopies: 0,
  });
  const copies = [];
  const n = overrides.copies ?? 2;
  for (let i = 0; i < n; i += 1) {
    const barcode = `BC-T${isbnSeq}${i}`;
    copies.push(
      await BookCopy.create({
        bookId: book._id,
        barcode,
        accessionNumber: barcode,
        condition: 'NEW',
        status: 'AVAILABLE',
      }),
    );
  }
  book.totalCopies = copies.length;
  book.availableCopies = copies.length;
  await book.save();
  return { book, copies };
}
