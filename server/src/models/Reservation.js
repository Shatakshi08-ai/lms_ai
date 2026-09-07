import mongoose from 'mongoose';

export const RESERVATION_STATUS = ['PENDING', 'FULFILLED', 'CANCELLED', 'EXPIRED'];

const reservationSchema = new mongoose.Schema(
  {
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reservationDate: { type: Date, default: Date.now },
    queuePosition: { type: Number, required: true, min: 1 },
    status: { type: String, enum: RESERVATION_STATUS, default: 'PENDING', index: true },
    holdExpiresAt: { type: Date },
    copyId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookCopy' },
  },
  { timestamps: true },
);

reservationSchema.index({ bookId: 1, status: 1, queuePosition: 1 });
reservationSchema.index({ userId: 1, bookId: 1, status: 1 });

export const Reservation = mongoose.model('Reservation', reservationSchema);
