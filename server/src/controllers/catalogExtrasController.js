import { Book, CATEGORIES, GENRES } from '../models/Book.js';
import { Review } from '../models/Review.js';
import { Cart } from '../models/Cart.js';
import { ReadingProgress } from '../models/ReadingProgress.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { loadReadablePages } from '../services/readingService.js';
import { canReadBook, getVisitorBookIds, hasLibraryAccess, LOGIN_REQUIRED_MESSAGE, VISITOR_BOOK_LIMIT } from '../services/visitorAccess.js';
import { writeAudit } from '../services/auditService.js';
import { notifyUser } from '../services/notifyService.js';
import { Wishlist } from '../models/Wishlist.js';
import { resolveBookPdf } from '../services/pdfService.js';

async function refreshBookRating(bookId) {
  const [agg] = await Review.aggregate([
    { $match: { bookId } },
    { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } },
  ]);
  await Book.findByIdAndUpdate(bookId, {
    averageRating: agg ? Math.round(agg.avg * 10) / 10 : 0,
    reviewCount: agg ? agg.n : 0,
  });
}

export const listVisitorBooks = asyncHandler(async (_req, res) => {
  const ids = await getVisitorBookIds();
  const items = await Book.find({ _id: { $in: ids } })
    .sort({ title: 1 })
    .select('title authors coverImage category genres summary isFree averageRating reviewCount availableCopies gutenbergId')
    .lean();
  res.json({
    success: true,
    items: items.map((b) => ({ ...b, locked: false, visitorAccessible: true })),
    total: items.length,
    limit: VISITOR_BOOK_LIMIT,
  });
});

export const listFreeBooks = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const authed = hasLibraryAccess(req.user);
  const limit = authed ? Math.min(24, Math.max(8, Number(req.query.limit || 12))) : VISITOR_BOOK_LIMIT;
  const filter = { isFree: true };
  if (!authed) {
    const ids = await getVisitorBookIds();
    filter._id = { $in: ids };
  }
  const [items, total] = await Promise.all([
    Book.find(filter).sort({ downloadCount: -1, title: 1 }).skip(authed ? (page - 1) * limit : 0).limit(limit),
    Book.countDocuments(filter),
  ]);
  res.json({ success: true, items, total: authed ? total : items.length, page: authed ? page : 1, visitorLimited: !authed });
});

export const listCategories = asyncHandler(async (_req, res) => {
  const grouped = await Book.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  const fromDb = grouped.filter((g) => g._id).map((g) => ({ name: g._id, count: g.count }));
  const names = new Set(fromDb.map((c) => c.name));
  for (const name of [...CATEGORIES, ...GENRES]) {
    if (!names.has(name)) fromDb.push({ name, count: 0 });
  }
  res.json({ success: true, categories: fromDb });
});

export const relatedBooks = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id).select('category genres');
  if (!book) throw new AppError('Book not found', 404);
  const query = {
    _id: { $ne: book._id },
    $or: [{ category: book.category }, { genres: { $in: book.genres || [] } }],
  };
  if (!hasLibraryAccess(req.user)) {
    const ids = (await getVisitorBookIds()).filter((id) => id !== String(book._id));
    query._id = { $in: ids };
  }
  const items = await Book.find(query)
    .sort({ averageRating: -1, downloadCount: -1 })
    .limit(8)
    .select('title authors coverImage category genres isFree averageRating reviewCount availableCopies summary');
  res.json({ success: true, items });
});

export const listReviews = asyncHandler(async (req, res) => {
  const items = await Review.find({ bookId: req.params.id })
    .populate('userId', 'name role')
    .sort({ createdAt: -1 })
    .limit(200);
  res.json({ success: true, items });
});

export const upsertReview = asyncHandler(async (req, res) => {
  const rating = Number(req.body.rating);
  const comment = String(req.body.comment || '').trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError('Rating must be 1 to 5 stars', 400);
  if (comment.length < 8) throw new AppError('Please write a short review (at least 8 characters)', 400);
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError('Book not found', 404);
  const review = await Review.findOneAndUpdate(
    { userId: req.user._id, bookId: book._id },
    { rating, comment },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
  );
  await refreshBookRating(book._id);
  res.status(201).json({ success: true, review });
});

export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.reviewId);
  if (!review) throw new AppError('Review not found', 404);
  const owner = String(review.userId) === String(req.user._id);
  const staff = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  if (!owner && !staff) throw new AppError('You can only delete your own review', 403);
  await review.deleteOne();
  await refreshBookRating(review.bookId);
  res.json({ success: true });
});

export const wishlistIds = asyncHandler(async (req, res) => {
  const items = await Wishlist.find({ userId: req.user._id }).select('bookId');
  res.json({ success: true, ids: items.map((i) => String(i.bookId)) });
});

export const listWishlist = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = 12;
  const filter = { userId: req.user._id };
  const total = await Wishlist.countDocuments(filter);
  const rows = await Wishlist.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('bookId');
  res.json({
    success: true,
    total,
    page,
    items: rows
      .map((r) => {
        if (!r.bookId) return null;
        const obj = typeof r.bookId.toObject === 'function' ? r.bookId.toObject() : r.bookId;
        return { ...obj, addedAt: r.createdAt };
      })
      .filter(Boolean),
  });
});

export const addWishlist = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError('Book not found', 404);
  const existing = await Wishlist.findOne({ userId: req.user._id, bookId: book._id });
  if (existing) {
    return res.json({
      success: true,
      wishlisted: true,
      alreadyInWishlist: true,
      message: 'This book is already in your wishlist.',
    });
  }
  await Wishlist.create({ userId: req.user._id, bookId: book._id });
  await writeAudit({
    actorId: req.user._id,
    action: 'WISHLIST_ADD',
    entity: 'Wishlist',
    entityId: book._id,
    bookId: book._id,
    bookTitle: book.title,
    catalogId: book.catalogId,
    req,
  });
  await notifyUser({
    userId: req.user._id,
    title: 'Wishlist',
    body: `Book added to your wishlist. ❤️`,
    type: 'WISHLIST',
    meta: { bookId: String(book._id), title: book.title },
  });
  res.status(201).json({
    success: true,
    wishlisted: true,
    alreadyInWishlist: false,
    message: 'Book added to your wishlist. ❤️',
  });
});

export const removeWishlist = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id).select('title');
  await Wishlist.deleteOne({ userId: req.user._id, bookId: req.params.id });
  await writeAudit({
    actorId: req.user._id,
    action: 'WISHLIST_REMOVE',
    entity: 'Wishlist',
    entityId: req.params.id,
    bookId: req.params.id,
    bookTitle: book?.title || '',
    req,
  });
  res.json({ success: true, wishlisted: false, message: 'Removed from wishlist.' });
});

export const cartIds = asyncHandler(async (req, res) => {
  const items = await Cart.find({ userId: req.user._id }).select('bookId');
  res.json({ success: true, ids: items.map((i) => String(i.bookId)) });
});

export const listCart = asyncHandler(async (req, res) => {
  const rows = await Cart.find({ userId: req.user._id }).sort({ createdAt: -1 }).populate('bookId');
  const items = rows
    .map((r) => {
      const book = r.bookId;
      if (!book) return null;
      const obj = typeof book.toObject === 'function' ? book.toObject() : { ...book };
      return { ...obj, addedAt: r.createdAt };
    })
    .filter(Boolean);
  res.json({
    success: true,
    items,
    total: items.length,
  });
});

export const addCart = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError('Book not found', 404);
  const existing = await Cart.findOne({ userId: req.user._id, bookId: book._id });
  if (existing) {
    return res.json({
      success: true,
      inCart: true,
      alreadyInCart: true,
      message: 'This book is already in your cart.',
    });
  }
  await Cart.create({ userId: req.user._id, bookId: book._id });
  await writeAudit({
    actorId: req.user._id,
    action: 'CART_ADD',
    entity: 'Cart',
    entityId: book._id,
    bookId: book._id,
    bookTitle: book.title,
    catalogId: book.catalogId,
    req,
  });
  await notifyUser({
    userId: req.user._id,
    title: 'Book cart',
    body: '🛒 Book added to your cart successfully.',
    type: 'CART',
    meta: { bookId: String(book._id), title: book.title },
  });
  res.status(201).json({
    success: true,
    inCart: true,
    alreadyInCart: false,
    message: 'Book added to your cart successfully. 🛒',
  });
});

export const removeCart = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id).select('title');
  await Cart.deleteOne({ userId: req.user._id, bookId: req.params.id });
  await writeAudit({
    actorId: req.user._id,
    action: 'CART_REMOVE',
    entity: 'Cart',
    entityId: req.params.id,
    bookId: req.params.id,
    bookTitle: book?.title || '',
    req,
  });
  res.json({ success: true, inCart: false, message: 'Removed from cart.' });
});

export const clearCart = asyncHandler(async (req, res) => {
  await Cart.deleteMany({ userId: req.user._id });
  res.json({ success: true });
});

export const getProgress = asyncHandler(async (req, res) => {
  const doc = await ReadingProgress.findOne({ userId: req.user._id, bookId: req.params.id });
  res.json({ success: true, progress: doc });
});

export const saveProgress = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.body.page || 1));
  const totalPages = Math.max(1, Number(req.body.totalPages || 1));
  const percent = Math.min(100, Math.max(0, Number(req.body.percent ?? Math.round((page / totalPages) * 100))));
  const progress = await ReadingProgress.findOneAndUpdate(
    { userId: req.user._id, bookId: req.params.id },
    { page, totalPages, percent, currentPosition: req.body.currentPosition || `Page ${page}` },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  res.json({ success: true, progress });
});

export const readBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError('Book not found', 404);
  if (!(await canReadBook(req.user, book._id))) {
    return res.status(403).json({ success: false, code: 'LOGIN_REQUIRED', message: LOGIN_REQUIRED_MESSAGE });
  }
  if (req.user) {
    await writeAudit({
      actorId: req.user._id,
      action: 'BOOK_READ',
      entity: 'Book',
      entityId: book._id,
      bookId: book._id,
      bookTitle: book.title,
      req,
    });
  }

  // Uploaded PDF-only titles are read in the client PDF viewer.
  if (book.pdfFileName && !book.fullText && !book.gutenbergId && !book.isFree) {
    return res.json({
      success: true,
      readable: true,
      mode: 'pdf',
      title: book.title,
      authors: book.authors,
      category: book.category,
      coverImage: book.coverImage,
      hasPdf: true,
    });
  }

  if (!book.isFree && !book.fullText && !book.gutenbergId) {
    return res.json({
      success: true,
      readable: false,
      message: 'Full text is not stored here. Borrow a library copy or ask a librarian to upload a PDF for this title.',
    });
  }
  try {
    const pages = await loadReadablePages(book);
    if (!pages?.length) {
      if (book.pdfFileName) {
        return res.json({
          success: true,
          readable: true,
          mode: 'pdf',
          title: book.title,
          authors: book.authors,
          category: book.category,
          coverImage: book.coverImage,
          hasPdf: true,
        });
      }
      return res.json({
        success: true,
        readable: false,
        message: 'Could not load reading content for this title right now.',
      });
    }
    const page = Math.min(pages.length, Math.max(1, Number(req.query.page || 1)));
    res.json({
      success: true,
      readable: true,
      mode: 'text',
      page,
      totalPages: pages.length,
      content: pages[page - 1],
      title: book.title,
      authors: book.authors,
      category: book.category,
      coverImage: book.coverImage,
      hasPdf: Boolean(book.pdfFileName || book.gutenbergId || book.isFree || book.fullText),
    });
  } catch {
    if (book.pdfFileName) {
      return res.json({
        success: true,
        readable: true,
        mode: 'pdf',
        title: book.title,
        authors: book.authors,
        category: book.category,
        coverImage: book.coverImage,
        hasPdf: true,
      });
    }
    throw new AppError('Could not load reading content right now. Try again shortly.', 502);
  }
});

export const downloadPdf = asyncHandler(async (req, res) => {
  if (!hasLibraryAccess(req.user)) {
    throw new AppError(LOGIN_REQUIRED_MESSAGE, 403);
  }
  if (!req.params.id?.match(/^[a-f\d]{24}$/i)) throw new AppError('Book not found', 404);
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError('Book not found', 404);
  let pdf;
  try {
    pdf = await resolveBookPdf(book);
  } catch {
    throw new AppError('Could not build a PDF for this title right now.', 502);
  }
  if (!pdf?.length || pdf.slice(0, 5).toString() !== '%PDF-') {
    throw new AppError('A PDF is not available for this title.', 404);
  }
  await Book.findByIdAndUpdate(book._id, { $inc: { downloadCount: 1 } });
  await writeAudit({
    actorId: req.user._id,
    action: 'BOOK_DOWNLOAD',
    entity: 'Book',
    entityId: book._id,
    bookId: book._id,
    bookTitle: book.title,
    catalogId: book.catalogId,
    req,
  });
  const safe = String(book.catalogId || book.title || 'questlearn-book').replace(/[^\w\- ]+/g, '').slice(0, 80);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safe || 'book'}.pdf"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(pdf);
});
