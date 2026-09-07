import { isPatron, PATRON_ROLES, User } from '../models/User.js';
import { Circulation } from '../models/Circulation.js';
import { Fine } from '../models/Fine.js';
import { Reservation } from '../models/Reservation.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateReaderId, randomFourDigit } from '../utils/ids.js';
import { writeAudit } from '../services/auditService.js';

export const listUsers = asyncHandler(async (req, res) => {
  const { q, role, status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (req.user.role === 'LIBRARIAN') {
    if (role === 'STUDENT' || role === 'MEMBER') filter.role = role;
    else filter.role = { $in: PATRON_ROLES };
  } else if (role === 'PATRON') filter.role = { $in: PATRON_ROLES };
  else if (role) filter.role = role;
  if (status) filter.status = status;
  if (q) {
    filter.$or = [
      { name: new RegExp(q, 'i') },
      { email: new RegExp(q, 'i') },
      { readerId: new RegExp(q, 'i') },
    ];
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, items: items.map((u) => u.toSafeJSON()), total, page: Number(page) });
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, department, maxBorrowLimit } = req.body;
  if (!name || !email || !password) throw new AppError('Missing required fields', 400);
  if (role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('Only Super Admin can create Super Admins', 403);
  }
  let readerId;
  for (let i = 0; i < 10; i += 1) {
    const candidate = generateReaderId(new Date().getFullYear(), randomFourDigit());
    if (!(await User.exists({ readerId: candidate }))) {
      readerId = candidate;
      break;
    }
  }
  const user = await User.create({
    name,
    email,
    password,
    role: role || 'STUDENT',
    department,
    maxBorrowLimit: maxBorrowLimit || 5,
    readerId,
    preferencesOnboarded: !isPatron(role || 'STUDENT'),
  });
  await writeAudit({ actorId: req.user._id, action: 'USER_CREATE', entity: 'User', entityId: user._id, req });
  res.status(201).json({ success: true, user: user.toSafeJSON() });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  const { name, department, role, status, maxBorrowLimit, avatar } = req.body;
  if (role && role !== user.role) {
    if (req.user.role !== 'SUPER_ADMIN') throw new AppError('Only Super Admin can change roles', 403);
    user.role = role;
  }
  if (name !== undefined) user.name = name;
  if (department !== undefined) user.department = department;
  if (status !== undefined) user.status = status;
  if (maxBorrowLimit !== undefined) user.maxBorrowLimit = maxBorrowLimit;
  if (avatar !== undefined) user.avatar = avatar;
  await user.save();
  await writeAudit({
    actorId: req.user._id,
    action: 'USER_UPDATE',
    entity: 'User',
    entityId: user._id,
    changes: req.body,
    req,
  });
  res.json({ success: true, user: user.toSafeJSON() });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (req.user.role === 'LIBRARIAN' && !PATRON_ROLES.includes(user.role)) {
    throw new AppError('You do not have permission to view this account', 403);
  }
  const [loans, fines, reservations] = await Promise.all([
    Circulation.find({ userId: user._id })
      .populate('bookId', 'title isbn authors')
      .sort({ issueDate: -1 })
      .limit(40)
      .lean(),
    Fine.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20).lean(),
    Reservation.find({ userId: user._id }).populate('bookId', 'title').sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  const issued = loans.filter((l) => ['ISSUED', 'OVERDUE'].includes(l.status));
  res.json({
    success: true,
    user: user.toSafeJSON(),
    library: {
      issued,
      overdue: issued.filter((l) => new Date(l.dueDate) < new Date()),
      returned: loans.filter((l) => l.status === 'RETURNED'),
      history: loans,
      reservations,
      fines,
      pendingFineTotal: fines.filter((f) => f.status === 'PENDING').reduce((s, f) => s + (f.amount || 0), 0),
    },
  });
});
