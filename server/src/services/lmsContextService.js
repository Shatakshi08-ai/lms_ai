import { Book } from '../models/Book.js';
import { Circulation } from '../models/Circulation.js';
import { Fine } from '../models/Fine.js';
import { getSettings } from '../models/Settings.js';

function looksLikeCatalogQuery(message) {
  return /(book|title|author|isbn|genre|category|available|find|show|search|science fiction|fantasy|history)/i.test(
    message,
  );
}

export async function buildAuthenticatedLmsContext(actor, message) {
  const settings = await getSettings();
  const [loans, fines] = await Promise.all([
    Circulation.find({ userId: actor._id, status: { $in: ['ISSUED', 'OVERDUE'] } })
      .populate('bookId', 'title authors')
      .select('dueDate status renewalCount fineAmount')
      .limit(8)
      .lean(),
    Fine.find({ userId: actor._id, status: 'PENDING' }).select('amount').limit(8).lean(),
  ]);

  let catalog = [];
  if (looksLikeCatalogQuery(message)) {
    const term = String(message).replace(/[^\w\s\-]/g, ' ').trim().slice(0, 80);
    const rx = new RegExp(term.split(/\s+/).slice(0, 4).join('|') || 'library', 'i');
    catalog = await Book.find({
      $or: [{ title: rx }, { authors: rx }, { genres: rx }, { category: rx }, { isbn: rx }],
    })
      .select('title authors category genres isbn availableCopies')
      .limit(6)
      .lean();
  }

  return {
    member: {
      name: actor.name,
      role: actor.role,
      readerId: actor.readerId,
      maxBorrowLimit: actor.maxBorrowLimit,
      preferredGenres: actor.preferences?.genres || [],
    },
    loans: loans.map((l) => ({
      title: l.bookId?.title,
      dueDate: l.dueDate,
      status: l.status,
      renewals: l.renewalCount,
    })),
    pendingFines: fines.map((f) => f.amount),
    pendingFineTotal: fines.reduce((s, f) => s + (f.amount || 0), 0),
    catalog,
    howTo: {
      issue: 'Staff issue books from Circulation using the member reader ID and copy barcode.',
      return: 'Staff return books from Circulation by scanning the copy barcode.',
      renew: `Members may renew eligible loans up to ${settings.maxRenewals} times from My loans / Circulation, unless the item is reserved or overdue past policy.`,
      loanPeriodDays: settings.loanPeriodDays,
      dailyFineRate: settings.dailyFineRate,
    },
  };
}
