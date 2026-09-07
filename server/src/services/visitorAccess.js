import { Book } from '../models/Book.js';

export const VISITOR_BOOK_LIMIT = 10;

const LIBRARY_ROLES = ['STUDENT', 'MEMBER', 'LIBRARIAN', 'ADMIN', 'SUPER_ADMIN'];

let cache = { ids: [], at: 0 };

export function hasLibraryAccess(user) {
  return Boolean(user && LIBRARY_ROLES.includes(user.role) && user.status === 'ACTIVE');
}

export async function getVisitorBookIds() {
  if (cache.ids.length && Date.now() - cache.at < 5 * 60 * 1000) return cache.ids;
  const free = await Book.find({ isFree: true }).sort({ title: 1, _id: 1 }).limit(VISITOR_BOOK_LIMIT).select('_id').lean();
  let ids = free.map((b) => String(b._id));
  if (ids.length < VISITOR_BOOK_LIMIT) {
    const extra = await Book.find({ _id: { $nin: ids } })
      .sort({ title: 1, _id: 1 })
      .limit(VISITOR_BOOK_LIMIT - ids.length)
      .select('_id')
      .lean();
    ids = ids.concat(extra.map((b) => String(b._id)));
  }
  cache = { ids, at: Date.now() };
  return ids;
}

export async function canReadBook(user, bookId) {
  if (hasLibraryAccess(user)) return true;
  const ids = await getVisitorBookIds();
  return ids.includes(String(bookId));
}

export const LOGIN_REQUIRED_MESSAGE = 'Please register or log in to QuestLearn to access and read this book.';
