import { Book } from '../models/Book.js';
import { Review } from '../models/Review.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const publicStats = asyncHandler(async (_req, res) => {
  const [books, members, categories, reviews, free] = await Promise.all([
    Book.countDocuments(),
    User.countDocuments({ role: { $in: ['STUDENT', 'MEMBER'] } }),
    Book.distinct('category'),
    Review.countDocuments(),
    Book.countDocuments({ isFree: true }),
  ]);
  res.json({
    success: true,
    stats: {
      books,
      members,
      categories: categories.filter(Boolean).length,
      reviews,
      free,
    },
  });
});

export const recentReviews = asyncHandler(async (_req, res) => {
  const items = await Review.find()
    .populate('userId', 'name')
    .populate('bookId', 'title coverImage')
    .sort({ createdAt: -1 })
    .limit(6);
  res.json({
    success: true,
    items: items.filter((r) => r.bookId),
  });
});
