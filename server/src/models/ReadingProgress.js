import mongoose from 'mongoose';

const readingProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    page: { type: Number, default: 1, min: 1 },
    totalPages: { type: Number, default: 1, min: 1 },
    percent: { type: Number, default: 0, min: 0, max: 100 },
    currentPosition: { type: String, default: '' },
  },
  { timestamps: true },
);

readingProgressSchema.index({ userId: 1, bookId: 1 }, { unique: true });

export const ReadingProgress = mongoose.model('ReadingProgress', readingProgressSchema);
