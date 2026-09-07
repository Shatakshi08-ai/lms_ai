import { Circulation } from '../models/Circulation.js';
import { Fine } from '../models/Fine.js';
import { User } from '../models/User.js';
import { Book } from '../models/Book.js';
import { BookCopy } from '../models/BookCopy.js';
import { Reservation } from '../models/Reservation.js';
import { AuditLog } from '../models/AuditLog.js';
import { Wishlist } from '../models/Wishlist.js';
import { Cart } from '../models/Cart.js';
import { Notification } from '../models/Notification.js';
import { BookView } from '../models/BookView.js';
import { getSettings } from '../models/Settings.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { writeAudit } from '../services/auditService.js';
import { AppError } from '../utils/AppError.js';
import { isPatron } from '../models/User.js';
import mongoose from 'mongoose';

export const dashboard = asyncHandler(async (_req, res) => {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    activeLoans,
    overdueBooks,
    totalUsers,
    totalMembers,
    totalStudents,
    totalLibrarians,
    totalAdmins,
    activeUsers,
    recentRegistrations,
    totalBooks,
    availableBooks,
    issuedBooks,
    returnedBooks,
    reservedBooks,
    revenueAgg,
    issuedThisMonth,
    pendingFines,
    availableCopies,
    pendingHolds,
    recentIssues,
    recentReturns,
  ] = await Promise.all([
    Circulation.countDocuments({ status: { $in: ['ISSUED', 'OVERDUE'] } }),
    Circulation.countDocuments({ status: { $in: ['ISSUED', 'OVERDUE'] }, dueDate: { $lt: now } }),
    User.countDocuments({}),
    User.countDocuments({ role: 'MEMBER' }),
    User.countDocuments({ role: 'STUDENT' }),
    User.countDocuments({ role: 'LIBRARIAN' }),
    User.countDocuments({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] } }),
    User.countDocuments({ status: 'ACTIVE' }),
    User.countDocuments({ createdAt: { $gte: weekAgo } }),
    Book.countDocuments({}),
    Book.countDocuments({ availableCopies: { $gt: 0 } }),
    Circulation.countDocuments({ status: { $in: ['ISSUED', 'OVERDUE'] } }),
    Circulation.countDocuments({ status: 'RETURNED' }),
    Reservation.countDocuments({ status: { $in: ['PENDING', 'FULFILLED'] } }),
    Fine.aggregate([{ $match: { status: 'PAID' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Circulation.countDocuments({ issueDate: { $gte: startMonth } }),
    Fine.aggregate([{ $match: { status: 'PENDING' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    BookCopy.countDocuments({ status: 'AVAILABLE' }),
    Reservation.countDocuments({ status: 'PENDING' }),
    Circulation.find({}).sort({ issueDate: -1 }).limit(8).populate('userId', 'name readerId role').populate('bookId', 'title isbn').lean(),
    Circulation.find({ status: 'RETURNED' }).sort({ returnDate: -1 }).limit(8).populate('userId', 'name readerId').populate('bookId', 'title').lean(),
  ]);

  const [monthly, categoryPop, revenueMonthly, recentUsers] = await Promise.all([
    Circulation.aggregate([
      { $group: { _id: { y: { $year: '$issueDate' }, m: { $month: '$issueDate' } }, issues: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
      { $limit: 12 },
    ]),
    Circulation.aggregate([
      { $lookup: { from: 'books', localField: 'bookId', foreignField: '_id', as: 'book' } },
      { $unwind: '$book' },
      { $group: { _id: '$book.category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Fine.aggregate([
      { $match: { status: 'PAID', paymentDate: { $ne: null } } },
      { $group: { _id: { y: { $year: '$paymentDate' }, m: { $month: '$paymentDate' } }, amount: { $sum: '$amount' } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
      { $limit: 12 },
    ]),
    User.find({ role: { $in: ['STUDENT', 'MEMBER'] } })
      .sort({ createdAt: -1 })
      .limit(8)
      .select('name email role status createdAt readerId'),
  ]);

  const [wishlistCount, cartCount, downloadAgg] = await Promise.all([
    Wishlist.countDocuments(),
    Cart.countDocuments(),
    Book.aggregate([{ $group: { _id: null, n: { $sum: '$downloadCount' } } }]),
  ]);

  res.json({
    success: true,
    kpis: {
      activeLoans,
      overdueBooks,
      totalUsers,
      totalMembers,
      totalStudents,
      totalLibrarians,
      totalAdmins,
      activeUsers,
      recentRegistrations,
      totalBooks,
      availableBooks,
      issuedBooks,
      returnedBooks,
      reservedBooks,
      revenue: revenueAgg[0]?.total || 0,
      issuedThisMonth,
      pendingFines: pendingFines[0]?.total || 0,
      availableCopies,
      pendingHolds,
      wishlistCount,
      cartCount,
      downloads: downloadAgg[0]?.n || 0,
    },
    recent: {
      issues: recentIssues,
      returns: recentReturns,
      users: recentUsers,
    },
    charts: { monthly, categoryPop, revenueMonthly },
  });
});

export const patronHome = asyncHandler(async (req, res) => {
  if (!isPatron(req.user)) throw new AppError('Patron dashboard only', 403);
  const now = new Date();
  const uid = req.user._id;
  const [loans, reservations, wishlist, cart, notifications, fines, upcoming, recentViews] = await Promise.all([
    Circulation.find({ userId: uid }).populate('bookId', 'title authors coverImage isbn category isFree availableCopies catalogId barcode').sort({ issueDate: -1 }).lean(),
    Reservation.find({ userId: uid, status: 'PENDING' }).populate('bookId', 'title authors coverImage catalogId').sort({ createdAt: -1 }).lean(),
    Wishlist.find({ userId: uid }).sort({ createdAt: -1 }).limit(8).populate('bookId').lean(),
    Cart.find({ userId: uid }).sort({ createdAt: -1 }).limit(8).populate('bookId').lean(),
    Notification.find({ userId: uid }).sort({ createdAt: -1 }).limit(12).lean(),
    Fine.find({ userId: uid }).sort({ createdAt: -1 }).limit(20).lean(),
    Book.find({ isUpcoming: true }).sort({ releaseDate: 1 }).limit(6).select('title authors coverImage category releaseDate catalogId').lean(),
    BookView.find({ userId: uid }).sort({ viewedAt: -1 }).limit(8).populate('bookId', 'title authors coverImage category catalogId isFree availableCopies averageRating reviewCount').lean(),
  ]);
  const issued = loans.filter((l) => ['ISSUED', 'OVERDUE'].includes(l.status));
  const overdue = issued.filter((l) => new Date(l.dueDate) < now);
  const dueSoon = issued.filter((l) => {
    const due = new Date(l.dueDate);
    return due >= now && due - now < 3 * 24 * 60 * 60 * 1000;
  });
  const returned = loans.filter((l) => l.status === 'RETURNED');
  const pendingFine = fines.filter((f) => f.status === 'PENDING').reduce((s, f) => s + (f.amount || 0), 0);
  const settings = await getSettings();
  res.json({
    success: true,
    profile: {
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone || '',
      role: req.user.role,
      readerId: req.user.readerId,
      status: req.user.status,
      department: req.user.department,
      maxBorrowLimit: req.user.maxBorrowLimit,
      createdAt: req.user.createdAt,
    },
    stats: {
      issued: issued.length,
      returned: returned.length,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      reservations: reservations.length,
      wishlist: wishlist.length,
      cart: cart.length,
      remainingBorrows: Math.max(0, (req.user.maxBorrowLimit || 5) - issued.length),
      pendingFine,
      loanPeriodDays: settings.loanPeriodDays,
      maxRenewals: settings.maxRenewals,
    },
    issued,
    overdue,
    dueSoon,
    returned: returned.slice(0, 12),
    history: loans.slice(0, 20),
    reservations,
    wishlist: (wishlist || []).map((w) => w.bookId).filter(Boolean),
    cart: (cart || []).map((c) => c.bookId).filter(Boolean),
    recentViews: (recentViews || []).map((v) => v.bookId).filter(Boolean),
    notifications,
    upcoming,
  });
});

export const getSettingsCtrl = asyncHandler(async (_req, res) => {
  const settings = await getSettings();
  res.json({ success: true, settings });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const fields = [
    'dailyFineRate',
    'gracePeriodDays',
    'maxFineCap',
    'loanPeriodDays',
    'maxRenewals',
    'holdExpiryHours',
    'unpaidFineIssueBlock',
    'currency',
    'currencySymbol',
    'libraryName',
  ];
  for (const f of fields) if (req.body[f] !== undefined) settings[f] = req.body[f];
  if (req.body.ai) Object.assign(settings.ai, req.body.ai);
  await settings.save();
  await writeAudit({ actorId: req.user._id, action: 'SETTINGS_UPDATE', entity: 'Settings', req });
  res.json({ success: true, settings });
});

export const auditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, action, role, status, book, user, from, to } = req.query;
  const filter = {};
  if (action) filter.action = action;
  if (role) filter.actorRole = role;
  if (status) filter.status = status;
  if (book) {
    filter.$or = [
      { bookTitle: new RegExp(String(book).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { catalogId: new RegExp(String(book).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ...(mongoose.isValidObjectId(book) ? [{ bookId: book }] : []),
    ];
  }
  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = new Date(from);
    if (to) filter.timestamp.$lte = new Date(to);
  }
  if (user) {
    const users = await User.find({
      $or: [
        { name: new RegExp(String(user).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { email: new RegExp(String(user).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { readerId: new RegExp(String(user).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ],
    }).select('_id');
    filter.actorId = { $in: users.map((u) => u._id) };
  }
  const size = Math.min(100, Math.max(10, Number(limit) || 20));
  const skip = (Math.max(1, Number(page) || 1) - 1) * size;
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('actorId', 'name email role readerId')
      .populate('bookId', 'title isbn catalogId barcode')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(size),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ success: true, items, total, page: Number(page) || 1, limit: size });
});

export const notifications = asyncHandler(async (req, res) => {
  const items = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
  const unread = items.filter((n) => !n.read).length;
  res.json({ success: true, items, unread });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const item = await Notification.findOne({ _id: req.params.id, userId: req.user._id });
  if (!item) throw new AppError('Notification not found', 404);
  item.read = true;
  await item.save();
  await writeAudit({ actorId: req.user._id, action: 'NOTIFICATION_VIEW', entity: 'Notification', entityId: item._id, req });
  res.json({ success: true, item });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, read: false }, { $set: { read: true } });
  res.json({ success: true });
});

export const inventoryBottlenecks = asyncHandler(async (_req, res) => {
  const demand = await Circulation.aggregate([
    { $group: { _id: '$bookId', issues: { $sum: 1 } } },
    { $sort: { issues: -1 } },
    { $limit: 25 },
    { $lookup: { from: 'books', localField: '_id', foreignField: '_id', as: 'book' } },
    { $unwind: '$book' },
  ]);
  const lowStock = await Book.find({ $expr: { $lt: ['$availableCopies', 1] } })
    .sort({ totalCopies: 1 })
    .limit(25);
  res.json({ success: true, demand, lowStock });
});
