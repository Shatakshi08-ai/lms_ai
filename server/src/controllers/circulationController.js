import { isPatron } from '../models/User.js';
import { Circulation } from '../models/Circulation.js';
import { Reservation } from '../models/Reservation.js';
import { BookCopy } from '../models/BookCopy.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import * as circ from '../services/circulationService.js';

export const issue = asyncHandler(async (req, res) => {
  const { userId, copyId, barcode } = req.body;
  if (!userId || (!copyId && !barcode)) throw new AppError('userId and copy/barcode required', 400);
  const loan = await circ.issueBook({ userId, copyId, barcode, actor: req.user, req });
  res.status(201).json({ success: true, loan });
});

export const returnCopy = asyncHandler(async (req, res) => {
  const { copyId, barcode } = req.body;
  if (!copyId && !barcode) throw new AppError('copyId or barcode required', 400);
  const result = await circ.returnBook({ copyId, barcode, actor: req.user, req });
  res.json({ success: true, ...result });
});

export const renew = asyncHandler(async (req, res) => {
  const loan = await circ.renewLoan({ circulationId: req.params.id, actor: req.user, req });
  res.json({ success: true, loan });
});

export const listLoans = asyncHandler(async (req, res) => {
  const { userId, status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (isPatron(req.user)) filter.userId = req.user._id;
  else if (userId) filter.userId = userId;
  if (status) filter.status = status;
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Circulation.find(filter)
      .populate('userId', 'name readerId email')
      .populate('bookId', 'title coverImage authors isbn')
      .populate('copyId', 'barcode')
      .sort({ issueDate: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Circulation.countDocuments(filter),
  ]);
  res.json({ success: true, items, total });
});

export const myLoans = asyncHandler(async (req, res) => {
  const items = await Circulation.find({ userId: req.user._id })
    .populate('bookId', 'title coverImage authors isbn category')
    .populate('copyId', 'barcode')
    .sort({ issueDate: -1 });
  res.json({ success: true, items });
});

export const todayStats = asyncHandler(async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [issued, returned, overdue] = await Promise.all([
    Circulation.countDocuments({ issueDate: { $gte: start } }),
    Circulation.countDocuments({ returnDate: { $gte: start } }),
    Circulation.countDocuments({ status: { $in: ['ISSUED', 'OVERDUE'] }, dueDate: { $lt: new Date() } }),
  ]);
  res.json({ success: true, issued, returned, overdue });
});

export const lookupMemberOrBarcode = asyncHandler(async (req, res) => {
  const q = req.query.q || '';
  const copy = await BookCopy.findOne({ barcode: q }).populate('bookId');
  res.json({ success: true, copy });
});

export const reserve = asyncHandler(async (req, res) => {
  const userId = isPatron(req.user) ? req.user._id : req.body.userId || req.user._id;
  const rec = await circ.placeReservation({ userId, bookId: req.body.bookId, actor: req.user, req });
  res.status(201).json({ success: true, reservation: rec });
});

export const listReservations = asyncHandler(async (req, res) => {
  const filter = {};
  if (isPatron(req.user)) filter.userId = req.user._id;
  else {
    if (req.query.bookId) filter.bookId = req.query.bookId;
    if (req.query.status) filter.status = req.query.status;
  }
  const items = await Reservation.find(filter)
    .populate('userId', 'name readerId')
    .populate('bookId', 'title coverImage')
    .populate('copyId', 'barcode')
    .sort({ reservationDate: -1 })
    .limit(200);
  res.json({ success: true, items });
});

export const cancelReservation = asyncHandler(async (req, res) => {
  const rec = await Reservation.findById(req.params.id);
  if (!rec) throw new AppError('Reservation not found', 404);
  if (isPatron(req.user) && String(rec.userId) !== String(req.user._id)) {
    throw new AppError('Forbidden', 403);
  }
  rec.status = 'CANCELLED';
  await rec.save();
  res.json({ success: true, reservation: rec });
});
