import mongoose from 'mongoose';

const cartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  },
  { timestamps: true },
);

cartSchema.index({ userId: 1, bookId: 1 }, { unique: true });

export const Cart = mongoose.model('Cart', cartSchema);
