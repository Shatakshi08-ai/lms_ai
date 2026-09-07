import mongoose from 'mongoose';

export const COPY_CONDITION = ['NEW', 'GOOD', 'DAMAGED', 'LOST'];
export const COPY_STATUS = ['AVAILABLE', 'ISSUED', 'RESERVED', 'MAINTENANCE'];

const bookCopySchema = new mongoose.Schema(
  {
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    barcode: { type: String, required: true, unique: true, index: true },
    accessionNumber: { type: String, required: true, unique: true },
    condition: { type: String, enum: COPY_CONDITION, default: 'GOOD' },
    status: { type: String, enum: COPY_STATUS, default: 'AVAILABLE', index: true },
    shelfLocation: { type: String, default: '' },
  },
  { timestamps: true },
);

bookCopySchema.index({ bookId: 1, status: 1 });

export const BookCopy = mongoose.model('BookCopy', bookCopySchema);
