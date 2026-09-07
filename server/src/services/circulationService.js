import { User } from '../models/User.js';
import { Book } from '../models/Book.js';
import { BookCopy } from '../models/BookCopy.js';
import { Circulation } from '../models/Circulation.js';
import { Reservation } from '../models/Reservation.js';
import { Fine } from '../models/Fine.js';
import { Notification } from '../models/Notification.js';
import { Wishlist } from '../models/Wishlist.js';
import { notifyUser } from './notifyService.js';
import { getSettings } from '../models/Settings.js';
import { AppError } from '../utils/AppError.js';
import { calculateFine } from './fineEngine.js';
import { writeAudit } from './auditService.js';
import { withTransaction } from '../utils/withTransaction.js';

const HOLD_MS = (hours) => hours * 60 * 60 * 1000;
const unassignedHold = { $or: [{ copyId: null }, { copyId: { $exists: false } }] };

async function recomputeAvailable(bookId, session) {
  const q = BookCopy.countDocuments({ bookId, status: 'AVAILABLE' });
  if (session) q.session(session);
  const available = await q;
  await Book.findByIdAndUpdate(bookId, { availableCopies: available }, session ? { session } : {});
  return available;
}

async function notifyLowCopies(bookId) {
  const book = await Book.findById(bookId).select('title availableCopies catalogId');
  if (!book || book.availableCopies > 2) return;
  const staff = await User.find({ role: { $in: ['LIBRARIAN', 'ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' }).select('_id');
  await Promise.all(
    staff.map((u) =>
      notifyUser({
        userId: u._id,
        title: 'Low copies',
        body: `${book.title} (${book.catalogId || 'book'}) is down to ${book.availableCopies} available cop${book.availableCopies === 1 ? 'y' : 'ies'}.`,
        type: 'INVENTORY',
        meta: { bookId: String(book._id), catalogId: book.catalogId },
      }),
    ),
  );
}

async function insert(Model, doc, session) {
  if (session) {
    const [row] = await Model.create([doc], { session });
    return row;
  }
  return Model.create(doc);
}

export async function issueBook({ userId, copyId, barcode, actor, req }) {
  const settings = await getSettings();
  const circ = await withTransaction(async (session) => {
    const member = await User.findById(userId).session(session || null);
    if (!member || member.status !== 'ACTIVE') throw new AppError('Member is not active', 400);
    if (member.activeFineBalance >= settings.unpaidFineIssueBlock) {
      throw new AppError('Unpaid fine threshold exceeded. Settle fines before issuing.', 403);
    }

    let copy;
    if (copyId) copy = await BookCopy.findById(copyId).session(session || null);
    else if (barcode) copy = await BookCopy.findOne({ barcode }).session(session || null);
    if (!copy) throw new AppError('Copy not found', 404);
    if (copy.status === 'MAINTENANCE' || copy.condition === 'LOST') {
      throw new AppError('Copy is not issuable', 400);
    }

    const activeLoans = await Circulation.countDocuments({
      userId: member._id,
      status: { $in: ['ISSUED', 'OVERDUE'] },
    }).session(session || null);
    if (activeLoans >= member.maxBorrowLimit) {
      throw new AppError(`Borrow limit reached (${member.maxBorrowLimit})`, 400);
    }

    const alreadyHasTitle = await Circulation.exists({
      userId: member._id,
      bookId: copy.bookId,
      status: { $in: ['ISSUED', 'OVERDUE'] },
    }).session(session || null);
    if (alreadyHasTitle) throw new AppError('Member already has an active copy of this title', 400);

    if (copy.status === 'RESERVED') {
      const hold = await Reservation.findOne({
        copyId: copy._id,
        userId: member._id,
        status: 'PENDING',
      }).session(session || null);
      if (!hold) throw new AppError('This copy is reserved for another member', 403);
      hold.status = 'FULFILLED';
      await hold.save({ session });
    } else if (copy.status !== 'AVAILABLE') {
      throw new AppError(`Copy is ${copy.status}`, 400);
    }

    const now = new Date();
    const due = new Date(now.getTime() + settings.loanPeriodDays * 86_400_000);
    copy.status = 'ISSUED';
    await copy.save({ session });

    const created = await insert(
      Circulation,
      {
        userId: member._id,
        copyId: copy._id,
        bookId: copy.bookId,
        issueDate: now,
        dueDate: due,
        status: 'ISSUED',
        issuedBy: actor._id,
      },
      session,
    );
    await recomputeAvailable(copy.bookId, session);
    return created;
  });

  await writeAudit({
    actorId: actor._id,
    action: 'CIRCULATION_ISSUE',
    entity: 'Circulation',
    entityId: circ._id,
    bookId: circ.bookId,
    changes: { userId, barcode: barcode || undefined },
    req,
  });
  await notifyLowCopies(circ.bookId);
  return Circulation.findById(circ._id)
    .populate('userId', 'name readerId email')
    .populate('bookId', 'title isbn coverImage authors catalogId')
    .populate('copyId', 'barcode accessionNumber');
}

export async function returnBook({ copyId, barcode, actor, req }) {
  const settings = await getSettings();
  const payload = await withTransaction(async (session) => {
    let copy;
    if (copyId) copy = await BookCopy.findById(copyId).session(session || null);
    else if (barcode) copy = await BookCopy.findOne({ barcode }).session(session || null);
    if (!copy) throw new AppError('Copy not found', 404);

    const circ = await Circulation.findOne({
      copyId: copy._id,
      status: { $in: ['ISSUED', 'OVERDUE'] },
    }).session(session || null);
    if (!circ) throw new AppError('No active loan for this copy', 400);

    const now = new Date();
    const { overdueDays, amount } = calculateFine({
      dueDate: circ.dueDate,
      returnDate: now,
      dailyFineRate: settings.dailyFineRate,
      gracePeriodDays: settings.gracePeriodDays,
      maxFineCap: settings.maxFineCap,
    });

    circ.returnDate = now;
    circ.status = 'RETURNED';
    circ.fineAmount = amount;
    circ.returnedBy = actor._id;
    await circ.save({ session });

    if (amount > 0) {
      await insert(
        Fine,
        { userId: circ.userId, circulationId: circ._id, amount, status: 'PENDING' },
        session,
      );
      await User.findByIdAndUpdate(circ.userId, { $inc: { activeFineBalance: amount } }, session ? { session } : {});
    }

    const nextHold = await Reservation.findOne({ bookId: copy.bookId, status: 'PENDING', ...unassignedHold })
      .sort({ queuePosition: 1, reservationDate: 1 })
      .session(session || null);

    if (nextHold) {
      copy.status = 'RESERVED';
      nextHold.copyId = copy._id;
      nextHold.holdExpiresAt = new Date(Date.now() + HOLD_MS(settings.holdExpiryHours));
      await nextHold.save({ session });
      await insert(
        Notification,
        {
          userId: nextHold.userId,
          title: 'Reserved book is ready',
          body: `A copy is on hold for you for ${settings.holdExpiryHours} hours. Please collect it at the circulation desk.`,
          type: 'HOLD',
          meta: { bookId: copy.bookId, copyId: copy._id, holdExpiresAt: nextHold.holdExpiresAt },
        },
        session,
      );
    } else {
      copy.status = 'AVAILABLE';
    }
    await copy.save({ session });
    await recomputeAvailable(copy.bookId, session);
    return {
      circId: circ._id,
      overdueDays,
      amount,
      reservedForNext: Boolean(nextHold),
      barcode: copy.barcode,
      bookId: copy.bookId,
      bookTitle: '',
    };
  });

  await writeAudit({
    actorId: actor._id,
    action: 'CIRCULATION_RETURN',
    entity: 'Circulation',
    entityId: payload.circId,
    bookId: payload.bookId,
    changes: { overdueDays: payload.overdueDays, amount: payload.amount, barcode: payload.barcode },
    req,
  });
  if (!payload.reservedForNext && payload.bookId) {
    const title = payload.bookTitle || '';
    const fans = await Wishlist.find({ bookId: payload.bookId }).select('userId');
    await Promise.all(
      fans.map((w) =>
        notifyUser({
          userId: w.userId,
          title: 'Wishlist',
          body: '📚 A book from your wishlist is now available.',
          type: 'WISHLIST',
          meta: { bookId: String(payload.bookId), title },
        }),
      ),
    );
  }
  await notifyLowCopies(payload.bookId);
  return {
    circulation: await Circulation.findById(payload.circId)
      .populate('userId', 'name readerId email')
      .populate('bookId', 'title isbn coverImage authors')
      .populate('copyId', 'barcode accessionNumber'),
    fine: { overdueDays: payload.overdueDays, amount: payload.amount },
    reservedForNext: payload.reservedForNext,
  };
}

export async function renewLoan({ circulationId, actor, req }) {
  const settings = await getSettings();
  const circ = await withTransaction(async (session) => {
    const row = await Circulation.findById(circulationId).session(session || null);
    if (!row || !['ISSUED', 'OVERDUE'].includes(row.status)) {
      throw new AppError('Loan cannot be renewed', 400);
    }
    if (row.renewalCount >= settings.maxRenewals) {
      throw new AppError('Maximum renewals reached', 400);
    }
    const pendingRes = await Reservation.exists({ bookId: row.bookId, status: 'PENDING' }).session(session || null);
    if (pendingRes) throw new AppError('Cannot renew: this title has an active reservation', 400);
    row.renewalCount += 1;
    row.dueDate = new Date(row.dueDate.getTime() + settings.loanPeriodDays * 86_400_000);
    row.status = 'ISSUED';
    await row.save({ session });
    return row;
  });
  await writeAudit({ actorId: actor._id, action: 'CIRCULATION_RENEW', entity: 'Circulation', entityId: circ._id, req });
  return circ;
}

export async function placeReservation({ userId, bookId, actor, req }) {
  const resv = await withTransaction(async (session) => {
    const last = await Reservation.findOne({ bookId, status: 'PENDING' })
      .sort({ queuePosition: -1 })
      .session(session || null);
    const exists = await Reservation.exists({ userId, bookId, status: 'PENDING' }).session(session || null);
    if (exists) throw new AppError('You already have a pending reservation for this title', 400);
    return insert(
      Reservation,
      { bookId, userId, queuePosition: (last?.queuePosition || 0) + 1, status: 'PENDING' },
      session,
    );
  });
  await writeAudit({ actorId: actor._id, action: 'RESERVATION_CREATE', entity: 'Reservation', entityId: resv._id, req });
  return resv;
}

export async function expireHolds() {
  const now = new Date();
  const expired = await Reservation.find({
    status: 'PENDING',
    holdExpiresAt: { $lte: now },
    copyId: { $ne: null },
  });
  for (const hold of expired) {
    await withTransaction(async (session) => {
      hold.status = 'EXPIRED';
      await hold.save({ session });
      const copy = await BookCopy.findById(hold.copyId).session(session || null);
      if (copy && copy.status === 'RESERVED') {
        const nextHold = await Reservation.findOne({
          bookId: hold.bookId,
          status: 'PENDING',
          _id: { $ne: hold._id },
          ...unassignedHold,
        })
          .sort({ queuePosition: 1 })
          .session(session || null);
        const settings = await getSettings();
        if (nextHold) {
          nextHold.copyId = copy._id;
          nextHold.holdExpiresAt = new Date(Date.now() + HOLD_MS(settings.holdExpiryHours));
          await nextHold.save({ session });
        } else {
          copy.status = 'AVAILABLE';
          await copy.save({ session });
          await recomputeAvailable(copy.bookId, session);
        }
      }
    }).catch(() => {});
  }
}
