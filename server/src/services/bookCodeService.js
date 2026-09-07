import { Book } from '../models/Book.js';
import { Counter } from '../models/Counter.js';

export function formatCatalogId(n) {
  return `BOOK-${String(Math.max(1, Number(n) || 1)).padStart(6, '0')}`;
}

export async function takeNextCatalogId() {
  const row = await Counter.findByIdAndUpdate('bookCatalog', { $inc: { seq: 1 } }, { new: true, upsert: true });
  return formatCatalogId(row.seq);
}

export async function assignCatalogId(doc) {
  if (doc.catalogId) {
    if (!doc.barcode) doc.barcode = doc.catalogId;
    return doc;
  }
  for (let i = 0; i < 12; i += 1) {
    const catalogId = await takeNextCatalogId();
    const clash = await Book.exists({ $or: [{ catalogId }, { barcode: catalogId }] });
    if (!clash) {
      doc.catalogId = catalogId;
      doc.barcode = doc.barcode || catalogId;
      return doc;
    }
  }
  throw new Error('Could not allocate a unique Book ID');
}

export async function ensureBookCodes() {
  const missing = await Book.find({
    $or: [{ catalogId: { $exists: false } }, { catalogId: null }, { catalogId: '' }],
  }).select('_id catalogId barcode');
  for (const book of missing) {
    await assignCatalogId(book);
    await Book.updateOne({ _id: book._id }, { catalogId: book.catalogId, barcode: book.barcode });
  }
  const noBarcode = await Book.find({
    catalogId: { $exists: true, $ne: '' },
    $or: [{ barcode: { $exists: false } }, { barcode: null }, { barcode: '' }],
  }).select('_id catalogId');
  for (const book of noBarcode) {
    await Book.updateOne({ _id: book._id }, { barcode: book.catalogId });
  }
  const last = await Book.findOne({ catalogId: /^BOOK-\d+$/ }).sort({ catalogId: -1 }).select('catalogId').lean();
  const lastN = last ? Number(String(last.catalogId).replace(/\D/g, '')) : 0;
  const counter = await Counter.findById('bookCatalog');
  if (!counter || counter.seq < lastN) {
    await Counter.findByIdAndUpdate('bookCatalog', { seq: lastN }, { upsert: true });
  }
}

export function bookStatus(book) {
  if (!book) return 'Unavailable';
  if (book.isUpcoming) return 'Reserved';
  if ((book.availableCopies || 0) > 0) return 'Available';
  if ((book.totalCopies || 0) > 0) return 'Borrowed';
  return 'Unavailable';
}

export async function findBookByCode(raw) {
  const code = String(raw || '')
    .trim()
    .replace(/\s+/g, '');
  if (!code) return { book: null, copy: null, code };
  const copy = await BookCopySafe(code);
  if (copy?.bookId) {
    const book = copy.bookId?.title ? copy.bookId : await Book.findById(copy.bookId);
    return { book, copy, code };
  }
  const book = await Book.findOne({
    $or: [{ catalogId: new RegExp(`^${escape(code)}$`, 'i') }, { barcode: new RegExp(`^${escape(code)}$`, 'i') }, { isbn: code }],
  });
  return { book, copy: null, code };
}

function escape(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function BookCopySafe(code) {
  const { BookCopy } = await import('../models/BookCopy.js');
  return BookCopy.findOne({ barcode: new RegExp(`^${escape(code)}$`, 'i') }).populate('bookId');
}
