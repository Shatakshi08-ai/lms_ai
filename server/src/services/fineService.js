import { User } from '../models/User.js';
import { Fine } from '../models/Fine.js';
import { getSettings } from '../models/Settings.js';
import { AppError } from '../utils/AppError.js';
import { generateTransactionId } from '../utils/ids.js';
import { writeAudit } from './auditService.js';

export async function payFine({ fineId, paymentMethod, actor, req }) {
  const fine = await Fine.findById(fineId);
  if (!fine) throw new AppError('Fine not found', 404);
  if (fine.status !== 'PENDING') throw new AppError('Fine is not payable', 400);
  fine.status = 'PAID';
  fine.paymentMethod = paymentMethod;
  fine.paymentDate = new Date();
  fine.transactionId = generateTransactionId();
  fine.cashierId = actor._id;
  await fine.save();
  await User.findByIdAndUpdate(fine.userId, { $inc: { activeFineBalance: -fine.amount } });
  const member = await User.findById(fine.userId);
  if (member && member.activeFineBalance < 0) {
    member.activeFineBalance = 0;
    await member.save();
  }
  await writeAudit({
    actorId: actor._id,
    action: 'FINE_PAY',
    entity: 'Fine',
    entityId: fine._id,
    changes: { transactionId: fine.transactionId, paymentMethod },
    req,
  });
  const settings = await getSettings();
  return { fine, settings };
}

export async function waiveFine({ fineId, reason, actor, req }) {
  const fine = await Fine.findById(fineId);
  if (!fine) throw new AppError('Fine not found', 404);
  if (fine.status !== 'PENDING') throw new AppError('Fine cannot be waived', 400);
  fine.status = 'WAIVED';
  fine.waivedBy = actor._id;
  fine.waiverReason = reason || 'Manual waiver';
  await fine.save();
  await User.findByIdAndUpdate(fine.userId, { $inc: { activeFineBalance: -fine.amount } });
  const member = await User.findById(fine.userId);
  if (member && member.activeFineBalance < 0) {
    member.activeFineBalance = 0;
    await member.save();
  }
  await writeAudit({
    actorId: actor._id,
    action: 'FINE_WAIVE',
    entity: 'Fine',
    entityId: fine._id,
    changes: { reason },
    req,
  });
  return fine;
}
