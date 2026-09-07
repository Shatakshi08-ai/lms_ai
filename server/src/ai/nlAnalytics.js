import mongoose from 'mongoose';
import { Circulation } from '../models/Circulation.js';
import { Fine } from '../models/Fine.js';
import { Book } from '../models/Book.js';
import { AppError } from '../utils/AppError.js';
import { CATEGORIES } from '../models/Book.js';

/**
 * NL queries NEVER execute model-authored pipelines.
 * The model may only pick a templateId + slots; we compile a frozen pipeline.
 */
export const TEMPLATES = {
  topIssuedByCategoryThisMonth: {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    slots: { category: 'enum:category' },
    description: 'Most issued titles in a category this calendar month',
  },
  overdueLoans: {
    roles: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN'],
    slots: {},
    description: 'Currently overdue loans',
  },
  fineRevenueByMonth: {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    slots: {},
    description: 'Paid fine revenue grouped by month',
  },
  categoryPopularity: {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    slots: {},
    description: 'Issue counts by category',
  },
  lowAvailability: {
    roles: ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN'],
    slots: {},
    description: 'Titles with zero available copies',
  },
};

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

export async function runTemplate(templateId, slots, actor) {
  const def = TEMPLATES[templateId];
  if (!def) throw new AppError('Unknown analytics template', 400);
  if (!def.roles.includes(actor.role)) throw new AppError('Template forbidden for role', 403);
  const safe = slots && typeof slots === 'object' ? slots : {};

  if (templateId === 'topIssuedByCategoryThisMonth') {
    const category = CATEGORIES.includes(safe.category) ? safe.category : 'Computer Science';
    const { start, end } = monthRange();
    const rows = await Circulation.aggregate([
      { $match: { issueDate: { $gte: start, $lt: end } } },
      { $lookup: { from: 'books', localField: 'bookId', foreignField: '_id', as: 'book' } },
      { $unwind: '$book' },
      { $match: { 'book.category': category } },
      { $group: { _id: '$bookId', title: { $first: '$book.title' }, issues: { $sum: 1 } } },
      { $sort: { issues: -1 } },
      { $limit: 15 },
    ]);
    return { templateId, category, rows };
  }

  if (templateId === 'overdueLoans') {
    const rows = await Circulation.find({
      status: { $in: ['ISSUED', 'OVERDUE'] },
      dueDate: { $lt: new Date() },
    })
      .populate('userId', 'name readerId')
      .populate('bookId', 'title')
      .populate('copyId', 'barcode')
      .limit(50)
      .lean();
    return { templateId, rows };
  }

  if (templateId === 'fineRevenueByMonth') {
    const rows = await Fine.aggregate([
      { $match: { status: 'PAID' } },
      {
        $group: {
          _id: { y: { $year: '$paymentDate' }, m: { $month: '$paymentDate' } },
          amount: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);
    return { templateId, rows };
  }

  if (templateId === 'categoryPopularity') {
    const rows = await Circulation.aggregate([
      { $lookup: { from: 'books', localField: 'bookId', foreignField: '_id', as: 'book' } },
      { $unwind: '$book' },
      { $group: { _id: '$book.category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return { templateId, rows };
  }

  if (templateId === 'lowAvailability') {
    const rows = await Book.find({ availableCopies: { $lte: 0 } })
      .select('title category isbn totalCopies availableCopies')
      .limit(40)
      .lean();
    return { templateId, rows };
  }

  throw new AppError('Unhandled template', 500);
}

export function isValidObjectId(id) {
  return mongoose.isValidObjectId(id);
}
