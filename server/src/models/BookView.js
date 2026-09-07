import mongoose from 'mongoose';

const bookViewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    viewedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

bookViewSchema.index({ userId: 1, bookId: 1 }, { unique: true });

export const BookView = mongoose.model('BookView', bookViewSchema);
