import mongoose from 'mongoose';

export const CIRC_STATUS = ['ISSUED', 'RETURNED', 'OVERDUE'];

const circulationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    copyId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookCopy', required: true, index: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    issueDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true },
    returnDate: { type: Date },
    renewalCount: { type: Number, default: 0, min: 0, max: 2 },
    status: { type: String, enum: CIRC_STATUS, default: 'ISSUED', index: true },
    fineAmount: { type: Number, default: 0, min: 0 },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    returnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

circulationSchema.index({ userId: 1, status: 1 });
circulationSchema.index({ bookId: 1, issueDate: -1 });
circulationSchema.index({ dueDate: 1, status: 1 });

export const Circulation = mongoose.model('Circulation', circulationSchema);
