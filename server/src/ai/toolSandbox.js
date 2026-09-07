import { Book } from '../models/Book.js';
import { BookCopy } from '../models/BookCopy.js';
import { Circulation } from '../models/Circulation.js';
import { Fine } from '../models/Fine.js';
import { Wishlist } from '../models/Wishlist.js';
import { ReadingProgress } from '../models/ReadingProgress.js';
import { Cart } from '../models/Cart.js';
import { User } from '../models/User.js';
import { Reservation } from '../models/Reservation.js';
import { ROLES, STAFF_ROLES } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

const ALLOWED_TOOLS = {
  searchBooks: {
    roles: ROLES,
    schema: { query: 'string', category: 'string?', limit: 'number?', freeOnly: 'boolean?' },
  },
  checkAvailability: {
    roles: ROLES,
    schema: { query: 'string', isbn: 'string?' },
  },
  listCategories: {
    roles: ROLES,
    schema: {},
  },
  getUserLoans: {
    roles: ROLES,
    schema: { userId: 'string?' },
  },
  getUserFines: {
    roles: ROLES,
    schema: {},
  },
  getUserWishlist: {
    roles: ROLES,
    schema: {},
  },
  getReadingProgress: {
    roles: ROLES,
    schema: {},
  },
  getUserCart: {
    roles: ROLES,
    schema: {},
  },
  getLibraryStats: {
    roles: STAFF_ROLES,
    schema: {},
  },
};

function sanitizeString(v, max = 80) {
  return String(v || '')
    .replace(/[<>${}]/g, '')
    .slice(0, max)
    .trim();
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function asLimit(v, fallback = 8, max = 20) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(n)));
}

function bookCard(b) {
  return {
    title: b.title,
    authors: b.authors,
    category: b.category,
    isbn: b.isbn,
    availableCopies: b.availableCopies,
    isFree: b.isFree,
    shelfLocation: b.shelfLocation,
  };
}

function textFilter(query, category, freeOnly) {
  const filter = {};
  const and = [];
  if (query) {
    const rx = new RegExp(escapeRegex(query), 'i');
    and.push({
      $or: [{ title: rx }, { authors: rx }, { summary: rx }, { isbn: rx }, { tags: rx }, { genres: rx }, { category: rx }],
    });
  }
  if (category) {
    const crx = new RegExp(escapeRegex(category), 'i');
    and.push({ $or: [{ category: crx }, { genres: crx }, { subcategory: crx }] });
  }
  if (freeOnly) filter.isFree = true;
  if (and.length === 1) Object.assign(filter, and[0]);
  else if (and.length > 1) filter.$and = and;
  return filter;
}

export function listTools() {
  return Object.entries(ALLOWED_TOOLS).map(([name, def]) => ({ name, roles: def.roles, schema: def.schema }));
}

export async function executeTool(name, rawArgs, actor) {
  const def = ALLOWED_TOOLS[name];
  if (!def) throw new AppError(`Tool not allowed: ${name}`, 400);
  if (!def.roles.includes(actor.role)) throw new AppError('Tool forbidden for role', 403);
  const args = rawArgs && typeof rawArgs === 'object' ? rawArgs : {};

  if (name === 'searchBooks') {
    const query = sanitizeString(args.query, 120);
    const category = sanitizeString(args.category, 40);
    const limit = asLimit(args.limit);
    const freeOnly = Boolean(args.freeOnly);
    const filter = textFilter(query, category, freeOnly);
    const items = await Book.find(filter)
      .limit(limit)
      .select('title authors category isbn availableCopies isFree coverImage shelfLocation')
      .lean();
    return { items: items.map(bookCard), count: items.length };
  }

  if (name === 'listCategories') {
    const categories = await Book.distinct('category');
    return { categories: categories.filter(Boolean).sort() };
  }

  if (name === 'checkAvailability') {
    const isbn = sanitizeString(args.isbn, 20);
    const query = sanitizeString(args.query);
    let book = null;
    if (isbn) book = await Book.findOne({ isbn }).lean();
    if (!book && query) {
      const rx = new RegExp(escapeRegex(query), 'i');
      book = await Book.findOne({ $or: [{ title: rx }, { isbn: rx }, { authors: rx }] }).lean();
    }
    if (!book) return { available: false, message: 'Title not found' };
    const copies = await BookCopy.aggregate([
      { $match: { bookId: book._id } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]);
    return {
      title: book.title,
      isbn: book.isbn,
      availableCopies: book.availableCopies,
      isFree: book.isFree,
      byStatus: Object.fromEntries(copies.map((c) => [c._id, c.n])),
    };
  }

  if (name === 'getUserLoans') {
    let userId = actor._id;
    if (args.userId && STAFF_ROLES.includes(actor.role)) {
      userId = args.userId;
    }
    const items = await Circulation.find({ userId, status: { $in: ['ISSUED', 'OVERDUE'] } })
      .populate('bookId', 'title dueDate authors')
      .populate('copyId', 'barcode')
      .lean();
    return {
      items: items.map((i) => ({
        title: i.bookId?.title,
        barcode: i.copyId?.barcode,
        dueDate: i.dueDate,
        status: i.status,
      })),
    };
  }

  if (name === 'getUserFines') {
    const items = await Fine.find({ userId: actor._id, status: 'PENDING' }).select('amount status createdAt').lean();
    return {
      items: items.map((f) => ({ amount: f.amount, status: f.status, createdAt: f.createdAt })),
      total: items.reduce((s, f) => s + (f.amount || 0), 0),
    };
  }

  if (name === 'getUserWishlist') {
    const rows = await Wishlist.find({ userId: actor._id })
      .populate('bookId', 'title authors category availableCopies isFree')
      .limit(20)
      .lean();
    return {
      items: rows
        .filter((r) => r.bookId)
        .map((r) => ({
          title: r.bookId.title,
          authors: r.bookId.authors,
          category: r.bookId.category,
          availableCopies: r.bookId.availableCopies,
          isFree: r.bookId.isFree,
        })),
    };
  }

  if (name === 'getReadingProgress') {
    const rows = await ReadingProgress.find({ userId: actor._id })
      .populate('bookId', 'title authors')
      .sort({ updatedAt: -1 })
      .limit(12)
      .lean();
    return {
      items: rows.map((r) => ({
        title: r.bookId?.title,
        authors: r.bookId?.authors,
        percent: r.percent,
        page: r.page,
        totalPages: r.totalPages,
      })),
    };
  }

  if (name === 'getUserCart') {
    const rows = await Cart.find({ userId: actor._id }).populate('bookId', 'title authors category availableCopies isFree').limit(20).lean();
    return {
      items: rows.filter((r) => r.bookId).map((r) => ({
        title: r.bookId.title,
        authors: r.bookId.authors,
        availableCopies: r.bookId.availableCopies,
        isFree: r.bookId.isFree,
      })),
    };
  }

  if (name === 'getLibraryStats') {
    const now = new Date();
    const [totalBooks, availableBooks, issued, overdue, members, students, librarians, pendingHolds] = await Promise.all([
      Book.countDocuments({}),
      Book.countDocuments({ availableCopies: { $gt: 0 } }),
      Circulation.countDocuments({ status: { $in: ['ISSUED', 'OVERDUE'] } }),
      Circulation.countDocuments({ status: { $in: ['ISSUED', 'OVERDUE'] }, dueDate: { $lt: now } }),
      User.countDocuments({ role: 'MEMBER' }),
      User.countDocuments({ role: 'STUDENT' }),
      User.countDocuments({ role: 'LIBRARIAN' }),
      Reservation.countDocuments({ status: 'PENDING' }),
    ]);
    return { totalBooks, availableBooks, issued, overdue, members, students, librarians, pendingHolds };
  }

  throw new AppError('Unhandled tool', 500);
}

export { Fine };
