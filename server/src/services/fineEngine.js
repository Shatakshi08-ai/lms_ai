/**
 * Deterministic fine engine — used by circulation and tests.
 */
export function calculateOverdueDays(dueDate, returnDate, gracePeriodDays = 2) {
  const due = new Date(dueDate);
  const ret = new Date(returnDate);
  due.setHours(0, 0, 0, 0);
  ret.setHours(0, 0, 0, 0);
  const ms = ret.getTime() - due.getTime();
  const calendarDays = Math.max(0, Math.floor(ms / 86_400_000));
  return Math.max(0, calendarDays - gracePeriodDays);
}

export function calculateFine({ dueDate, returnDate, dailyFineRate, gracePeriodDays, maxFineCap }) {
  const overdueDays = calculateOverdueDays(dueDate, returnDate, gracePeriodDays);
  const raw = overdueDays * dailyFineRate;
  const amount = Math.min(raw, maxFineCap);
  return { overdueDays, amount: Number(amount.toFixed(2)) };
}
