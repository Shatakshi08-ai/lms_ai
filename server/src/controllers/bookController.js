import { Book, GENRES } from '../models/Book.js';
import { BookCopy } from '../models/BookCopy.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateBarcode } from '../utils/ids.js';
import { writeAudit } from '../services/auditService.js';
import { canReadBook, getVisitorBookIds, hasLibraryAccess, LOGIN_REQUIRED_MESSAGE, VISITOR_BOOK_LIMIT } from '../services/visitorAccess.js';
import { BookView } from '../models/BookView.js';
import { Circulation } from '../models/Circulation.js';
import { findBookByCode, bookStatus } from '../services/bookCodeService.js';
import { canDownloadBook, saveUploadedPdf } from '../services/pdfService.js';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function nextBarcodeSeq() {
  const last = await BookCopy.findOne().sort({ barcode: -1 }).select('barcode').lean();
  if (!last?.barcode) return 100001;
  const n = Number(String(last.barcode).replace(/\D/g, ''));
  return (Number.isFinite(n) ? n : 100000) + 1;
}

export const listBooks = asyncHandler(async (req, res) => {
  const { q, category, genre, subcategory, available, isFree, page = 1, limit = 24 } = req.query;
  const clauses = [];
  if (category) {
    const rx = new RegExp(escapeRegex(category), 'i');
    clauses.push({ $or: [{ category: rx }, { genres: rx }, { subcategory: rx }] });
  }
  if (subcategory) clauses.push({ subcategory });
  if (genre) {
    const rx = new RegExp(escapeRegex(genre), 'i');
    clauses.push({
      $or: [{ genres: rx }, { category: rx }, { subcategory: rx }, { tags: rx }],
    });
  }
  if (available === 'true') clauses.push({ availableCopies: { $gt: 0 } });
  if (isFree === 'true') clauses.push({ isFree: true });
  if (isFree === 'false') clauses.push({ isFree: { $ne: true } });
  if (q && String(q).trim()) {
    const term = String(q).trim();
    const rx = new RegExp(escapeRegex(term), 'i');
    clauses.push({
      $or: [
        { title: rx },
        { authors: rx },
        { isbn: rx },
        { isbn10: rx },
        { catalogId: rx },
        { barcode: rx },
        { category: rx },
        { genres: rx },
        { tags: rx },
        { summary: rx },
      ],
    });
  }
  const filter = clauses.length > 1 ? { $and: clauses } : clauses[0] || {};
  const authed = hasLibraryAccess(req.user);
  const previewTrending = String(req.query.preview || '') === 'trending';
  if (!authed && !previewTrending) {
    const visitorIds = await getVisitorBookIds();
    const visitorClause = { _id: { $in: visitorIds } };
    Object.assign(filter, filter._id ? { $and: [filter, visitorClause] } : visitorClause);
  }
  const pageNum = authed || previewTrending ? Math.max(1, Number(page) || 1) : 1;
  let size = Math.min(48, Math.max(8, Number(limit) || 12));
  if (!authed && previewTrending) size = Math.min(8, size);
  if (!authed && !previewTrending) size = VISITOR_BOOK_LIMIT;
  const skip = (pageNum - 1) * size;
  const sortKey = String(req.query.sort || '');
  const sort =
    sortKey === 'rating' || previewTrending
      ? { averageRating: -1, reviewCount: -1 }
      : sortKey === 'popular'
        ? { reviewCount: -1, averageRating: -1 }
        : { isFree: -1, title: 1 };
  const [items, total] = await Promise.all([
    Book.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(size)
      .select('title authors coverImage category genres summary isFree averageRating reviewCount availableCopies totalCopies publicationYear publisher gutenbergId catalogId barcode')
      .lean(),
    Book.countDocuments(filter),
  ]);
  const visitorIds = authed ? [] : await getVisitorBookIds();
  const visitorSet = new Set(visitorIds);
  if (authed && q && String(q).trim()) {
    writeAudit({
      actorId: req.user._id,
      action: 'BOOK_SEARCH',
      entity: 'Book',
      changes: { q: String(q).trim().slice(0, 120) },
      req,
    });
  }
  res.json({
    success: true,
    visitorLimited: !authed,
    items: items.map((b) => ({
      ...b,
      locked: !authed && (previewTrending || !visitorSet.has(String(b._id))),
      visitorAccessible: authed || visitorSet.has(String(b._id)),
    })),
    total: authed ? total : previewTrending ? items.length : Math.min(total, VISITOR_BOOK_LIMIT),
    page: pageNum,
    limit: size,
  });
});

export const listGenres = asyncHandler(async (_req, res) => {
  res.json({ success: true, genres: GENRES });
});

export const listUpcoming = asyncHandler(async (req, res) => {
  const limit = Math.min(24, Math.max(4, Number(req.query.limit || (req.query.compact ? 6 : 12))));
  const now = new Date();
  const select = 'title authors coverImage category genres availableCopies isUpcoming featured releaseDate publicationYear';
  let comingSoon = await Book.find({
    $or: [{ isUpcoming: true }, { releaseDate: { $gt: now } }],
  })
    .sort({ releaseDate: 1, createdAt: -1 })
    .limit(limit)
    .select(select)
    .lean();
  let featured = await Book.find({ featured: true }).sort({ updatedAt: -1 }).limit(limit).select(select).lean();
  let newReleases = await Book.find({
    $or: [{ publicationYear: { $gte: now.getFullYear() } }, { createdAt: { $gte: new Date(now.getFullYear(), 0, 1) } }],
    isUpcoming: { $ne: true },
  })
    .sort({ publicationYear: -1, createdAt: -1 })
    .limit(limit)
    .select(select)
    .lean();

  if (!comingSoon.length && !featured.length && !newReleases.length) {
    const latest = await Book.find().sort({ publicationYear: -1, createdAt: -1 }).limit(limit * 3).select(select).lean();
    newReleases = latest.slice(0, limit);
    featured = latest.slice(limit, limit * 2);
    comingSoon = latest.slice(limit * 2);
  } else {
    if (!featured.length) featured = await Book.find().sort({ availableCopies: -1 }).limit(limit).select(select).lean();
    if (!newReleases.length) newReleases = await Book.find().sort({ publicationYear: -1 }).limit(limit).select(select).lean();
    if (!comingSoon.length) comingSoon = await Book.find().sort({ createdAt: -1 }).limit(limit).select(select).lean();
  }

  res.json({ success: true, newReleases, comingSoon, featured });
});

export const getBook = asyncHandler(async (req, res) => {
  if (!req.params.id?.match(/^[a-f\d]{24}$/i)) throw new AppError('Book not found', 404);
  const book = await Book.findById(req.params.id).select('-fullText');
  if (!book) throw new AppError('Book not found', 404);
  const allowed = await canReadBook(req.user, book._id);
  if (!allowed) {
    return res.status(403).json({
      success: false,
      code: 'LOGIN_REQUIRED',
      message: LOGIN_REQUIRED_MESSAGE,
      preview: {
        _id: book._id,
        title: book.title,
        authors: book.authors,
        coverImage: book.coverImage,
        category: book.category,
        averageRating: book.averageRating,
        locked: true,
      },
    });
  }
  const copies = await BookCopy.find({ bookId: book._id }).sort({ barcode: 1 });
  if (req.user) {
    await writeAudit({
      actorId: req.user._id,
      action: 'BOOK_VIEW',
      entity: 'Book',
      entityId: book._id,
      bookId: book._id,
      bookTitle: book.title,
      catalogId: book.catalogId,
      req,
    });
    await BookView.findOneAndUpdate(
      { userId: req.user._id, bookId: book._id },
      { viewedAt: new Date() },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
  const json = book.toObject();
  json.status = bookStatus(book);
  json.hasPdf = Boolean(book.pdfFileName);
  res.json({ success: true, book: json, copies, canDownloadPdf: canDownloadBook(book) });
});

export const createBook = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  delete payload.catalogId;
  delete payload.barcode;
  delete payload.pdfFileName;
  if (!payload.genres?.length && payload.category) payload.genres = [payload.category];
  if (payload.isbn) {
    const existingIsbn = await Book.findOne({ isbn: String(payload.isbn).trim() }).select('_id title isbn');
    if (existingIsbn) {
      throw new AppError('A book with this ISBN already exists.', 409);
    }
  }
  const book = await Book.create(payload);
  const copies = Number(req.body.initialCopies || 1);
  let seq = await nextBarcodeSeq();
  const docs = [];
  for (let i = 0; i < copies; i += 1) {
    const barcode = generateBarcode(seq + i);
    docs.push({
      bookId: book._id,
      barcode,
      accessionNumber: barcode,
      condition: 'NEW',
      status: 'AVAILABLE',
      shelfLocation: book.shelfLocation,
    });
  }
  await BookCopy.insertMany(docs);
  book.totalCopies = copies;
  book.availableCopies = copies;
  await book.save();
  await writeAudit({
    actorId: req.user._id,
    action: 'BOOK_CREATE',
    entity: 'Book',
    entityId: book._id,
    bookId: book._id,
    bookTitle: book.title,
    catalogId: book.catalogId,
    req,
  });
  res.status(201).json({
    success: true,
    book,
    catalogId: book.catalogId,
    barcode: book.barcode,
    pdfStatus: book.pdfFileName ? 'Uploaded' : book.isFree || book.gutenbergId ? 'Available via download' : 'No PDF yet',
  });
});

export const updateBook = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  delete body.catalogId;
  delete body.barcode;
  delete body.pdfFileName;
  const book = await Book.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!book) throw new AppError('Book not found', 404);
  await writeAudit({
    actorId: req.user._id,
    action: 'BOOK_UPDATE',
    entity: 'Book',
    entityId: book._id,
    bookId: book._id,
    bookTitle: book.title,
    catalogId: book.catalogId,
    req,
  });
  res.json({ success: true, book });
});

export const addCopies = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError('Book not found', 404);
  const count = Math.max(1, Number(req.body.count || 1));
  let seq = await nextBarcodeSeq();
  const docs = [];
  for (let i = 0; i < count; i += 1) {
    const barcode = generateBarcode(seq + i);
    docs.push({
      bookId: book._id,
      barcode,
      accessionNumber: barcode,
      condition: req.body.condition || 'NEW',
      status: 'AVAILABLE',
      shelfLocation: req.body.shelfLocation || book.shelfLocation,
    });
  }
  await BookCopy.insertMany(docs);
  book.totalCopies += count;
  book.availableCopies += count;
  await book.save();
  res.status(201).json({ success: true, book, copies: docs });
});

export const updateCopy = asyncHandler(async (req, res) => {
  const copy = await BookCopy.findById(req.params.copyId);
  if (!copy) throw new AppError('Copy not found', 404);
  const { condition, status, shelfLocation } = req.body;
  if (condition) copy.condition = condition;
  if (status) copy.status = status;
  if (shelfLocation !== undefined) copy.shelfLocation = shelfLocation;
  await copy.save();
  const available = await BookCopy.countDocuments({ bookId: copy.bookId, status: 'AVAILABLE' });
  await Book.findByIdAndUpdate(copy.bookId, { availableCopies: available });
  res.json({ success: true, copy });
});

export const lookupBarcode = asyncHandler(async (req, res) => {
  const { book, copy, code } = await findBookByCode(req.params.barcode || req.params.code);
  if (!book) throw new AppError('Barcode not found', 404);
  const copies = await BookCopy.find({ bookId: book._id }).sort({ barcode: 1 }).lean();
  const loans = await Circulation.find({ bookId: book._id, status: { $in: ['ISSUED', 'OVERDUE'] } })
    .populate('userId', 'name readerId role')
    .populate('copyId', 'barcode status')
    .sort({ issueDate: -1 })
    .limit(20)
    .lean();
  const source = String(req.query.source || 'scan').toLowerCase() === 'upload' ? 'BARCODE_UPLOAD' : 'BARCODE_SCAN';
  await writeAudit({
    actorId: req.user._id,
    action: source,
    entity: 'Book',
    entityId: book._id,
    bookId: book._id,
    bookTitle: book.title,
    catalogId: book.catalogId,
    changes: { code },
    req,
  });
  const json = typeof book.toObject === 'function' ? book.toObject() : { ...book };
  delete json.fullText;
  json.status = bookStatus(json);
  res.json({
    success: true,
    code,
    book: json,
    copy,
    copies,
    loans,
    catalogId: json.catalogId,
    barcode: json.barcode,
  });
});

export const recentBooks = asyncHandler(async (req, res) => {
  const rows = await BookView.find({ userId: req.user._id })
    .sort({ viewedAt: -1 })
    .limit(12)
    .populate('bookId', 'title authors coverImage category catalogId barcode availableCopies isFree averageRating reviewCount');
  res.json({
    success: true,
    items: rows.map((r) => r.bookId).filter(Boolean),
  });
});

export const uploadBookPdf = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError('Book not found', 404);
  if (!req.file?.buffer?.length) throw new AppError('Please upload a PDF file.', 400);
  const magic = req.file.buffer.slice(0, 5).toString();
  if (magic !== '%PDF-') throw new AppError('The uploaded file is not a valid PDF.', 400);
  book.pdfFileName = await saveUploadedPdf(book._id, req.file.buffer);
  await book.save();
  await writeAudit({
    actorId: req.user._id,
    action: 'BOOK_UPDATE',
    entity: 'Book',
    entityId: book._id,
    bookId: book._id,
    bookTitle: book.title,
    catalogId: book.catalogId,
    changes: { pdf: true },
    req,
  });
  res.json({ success: true, book: { ...book.toObject(), fullText: undefined }, pdfStatus: 'Uploaded' });
});

export const uploadBookCover = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError('Book not found', 404);
  if (!req.file?.filename) throw new AppError('Please upload a cover image.', 400);
  book.coverImage = `/uploads/covers/${req.file.filename}`;
  await book.save();
  await writeAudit({
    actorId: req.user._id,
    action: 'BOOK_UPDATE',
    entity: 'Book',
    entityId: book._id,
    bookId: book._id,
    bookTitle: book.title,
    catalogId: book.catalogId,
    changes: { coverImage: book.coverImage },
    req,
  });
  res.json({ success: true, book: { ...book.toObject(), fullText: undefined }, coverImage: book.coverImage });
});
