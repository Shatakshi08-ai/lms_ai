import { Book } from '../models/Book.js';
import { Circulation } from '../models/Circulation.js';
import { Fine } from '../models/Fine.js';
import { BookCopy } from '../models/BookCopy.js';
import { User } from '../models/User.js';
import { completeChat } from './providers.js';

export async function generateExecutiveReport() {
  const [activeLoans, overdue, members, paid, top] = await Promise.all([
    Circulation.countDocuments({ status: { $in: ['ISSUED', 'OVERDUE'] } }),
    Circulation.countDocuments({ status: { $in: ['ISSUED', 'OVERDUE'] }, dueDate: { $lt: new Date() } }),
    User.countDocuments({ role: { $in: ['STUDENT', 'MEMBER'] } }),
    Fine.aggregate([{ $match: { status: 'PAID' } }, { $group: { _id: null, t: { $sum: '$amount' } } }]),
    Circulation.aggregate([
      { $group: { _id: '$bookId', issues: { $sum: 1 } } },
      { $sort: { issues: -1 } },
      { $limit: 8 },
      { $lookup: { from: 'books', localField: '_id', foreignField: '_id', as: 'book' } },
      { $unwind: '$book' },
    ]),
  ]);

  const demandForecast = top.map((t) => ({
    title: t.book.title,
    historicalIssues: t.issues,
    projectedNextMonth: Math.round(t.issues * 1.12),
    available: t.book.availableCopies,
    bottleneck: t.book.availableCopies === 0,
  }));

  const facts = JSON.stringify({
    activeLoans,
    overdue,
    members,
    revenue: paid[0]?.t || 0,
    demandForecast,
  });

  const narrative = await completeChat({
    system: 'You are a library director analyst. Write a concise executive briefing from facts only. No SQL.',
    user: `report facts: ${facts}`,
  });

  const zeroAvail = await BookCopy.countDocuments({ status: 'AVAILABLE' });
  return {
    generatedAt: new Date().toISOString(),
    kpis: { activeLoans, overdue, members, revenue: paid[0]?.t || 0, availableCopies: zeroAvail },
    demandForecast,
    narrative,
  };
}
