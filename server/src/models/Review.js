import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { timestamps: true },
);

reviewSchema.index({ userId: 1, bookId: 1 }, { unique: true });

export const Review = mongoose.model('Review', reviewSchema);
