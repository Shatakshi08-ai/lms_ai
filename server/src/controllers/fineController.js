import { isPatron } from '../models/User.js';
import { Fine } from '../models/Fine.js';
import { getSettings } from '../models/Settings.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import * as fines from '../services/fineService.js';

export const listFines = asyncHandler(async (req, res) => {
  const filter = {};
  if (isPatron(req.user)) filter.userId = req.user._id;
  else if (req.query.userId) filter.userId = req.query.userId;
  if (req.query.status) filter.status = req.query.status;
  const items = await Fine.find(filter)
    .populate('userId', 'name readerId email')
    .populate('circulationId')
    .populate('cashierId', 'name')
    .sort({ createdAt: -1 })
    .limit(200);
  res.json({ success: true, items });
});

export const pay = asyncHandler(async (req, res) => {
  const { paymentMethod } = req.body;
  if (!paymentMethod) throw new AppError('paymentMethod required', 400);
  const result = await fines.payFine({
    fineId: req.params.id,
    paymentMethod,
    actor: req.user,
    req,
  });
  res.json({ success: true, ...result });
});

export const waive = asyncHandler(async (req, res) => {
  const fine = await fines.waiveFine({
    fineId: req.params.id,
    reason: req.body.reason,
    actor: req.user,
    req,
  });
  res.json({ success: true, fine });
});

export const getFine = asyncHandler(async (req, res) => {
  const fine = await Fine.findById(req.params.id)
    .populate('userId', 'name readerId email')
    .populate({ path: 'circulationId', populate: { path: 'bookId', select: 'title isbn' } })
    .populate('cashierId', 'name');
  if (!fine) throw new AppError('Fine not found', 404);
  const settings = await getSettings();
  res.json({ success: true, fine, settings });
});
