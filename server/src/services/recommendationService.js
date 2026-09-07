import { Circulation } from '../models/Circulation.js';
import { Book } from '../models/Book.js';
import { User } from '../models/User.js';

export async function recommendForUser(userId, limit = 5) {
  const loans = await Circulation.find({ userId }).select('bookId').lean();
  const bookIds = [...new Set(loans.map((l) => String(l.bookId)))];
  const borrowed = await Book.find({ _id: { $in: bookIds } }).lean();

  const user = await User.findById(userId).select('name department preferences').lean();
  const categoryWeights = {};
  const authorWeights = {};
  for (const g of user?.preferences?.genres || []) {
    categoryWeights[g] = (categoryWeights[g] || 0) + 4;
  }
  for (const b of borrowed) {
    categoryWeights[b.category] = (categoryWeights[b.category] || 0) + 2;
    for (const g of b.genres || []) categoryWeights[g] = (categoryWeights[g] || 0) + 2;
    for (const a of b.authors || []) authorWeights[a] = (authorWeights[a] || 0) + 3;
    for (const t of b.tags || []) categoryWeights[t] = (categoryWeights[t] || 0) + 0.5;
  }

  const candidates = await Book.find({
    _id: { $nin: bookIds },
    availableCopies: { $gt: 0 },
  })
    .limit(200)
    .lean();

  const scored = candidates
    .map((b) => {
      let score = 0;
      score += categoryWeights[b.category] || 0;
      for (const g of b.genres || []) score += categoryWeights[g] || 0;
      for (const a of b.authors || []) score += authorWeights[a] || 0;
      for (const t of b.tags || []) score += categoryWeights[t] || 0;
      score += Math.min(b.availableCopies, 5) * 0.1;
      return { book: b, score };
    })
    .sort((x, y) => y.score - x.score);

  let top = scored.filter((s) => s.score > 0).slice(0, limit);
  if (top.length < limit) {
    const popular = await Circulation.aggregate([
      { $group: { _id: '$bookId', c: { $sum: 1 } } },
      { $sort: { c: -1 } },
      { $limit: 20 },
    ]);
    const extraIds = popular.map((p) => p._id).filter((id) => !bookIds.includes(String(id)));
    const extras = await Book.find({ _id: { $in: extraIds }, availableCopies: { $gt: 0 } }).lean();
    for (const b of extras) {
      if (top.length >= limit) break;
      if (!top.some((t) => String(t.book._id) === String(b._id))) {
        top.push({ book: b, score: 0.1 });
      }
    }
  }
  if (top.length < limit) {
    const fill = await Book.find({ _id: { $nin: bookIds } }).limit(limit).lean();
    for (const b of fill) {
      if (top.length >= limit) break;
      if (!top.some((t) => String(t.book._id) === String(b._id))) top.push({ book: b, score: 0 });
    }
  }

  return {
    user,
    recommendations: top.slice(0, limit).map((t) => ({
      ...t.book,
      affinityScore: Number(t.score.toFixed(2)),
    })),
  };
}
