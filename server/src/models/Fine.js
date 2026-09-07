import mongoose from 'mongoose';

export const FINE_STATUS = ['PENDING', 'PAID', 'WAIVED'];
export const PAYMENT_METHODS = ['CASH', 'CARD', 'UPI', 'ONLINE'];

const fineSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    circulationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Circulation', required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: FINE_STATUS, default: 'PENDING', index: true },
    transactionId: { type: String, unique: true, sparse: true },
    paymentDate: { type: Date },
    paymentMethod: { type: String, enum: PAYMENT_METHODS },
    waivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    waiverReason: { type: String, default: '' },
    cashierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

fineSchema.index({ userId: 1, status: 1 });

export const Fine = mongoose.model('Fine', fineSchema);
