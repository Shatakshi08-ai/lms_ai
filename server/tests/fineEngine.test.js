import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFine, calculateOverdueDays } from '../src/services/fineEngine.js';

describe('fine engine', () => {
  it('applies grace period', () => {
    assert.equal(calculateOverdueDays('2026-01-01', '2026-01-03', 2), 0);
    assert.equal(calculateOverdueDays('2026-01-01', '2026-01-06', 2), 3);
  });

  it('caps fine', () => {
    const r = calculateFine({
      dueDate: '2026-01-01',
      returnDate: '2026-03-01',
      dailyFineRate: 5,
      gracePeriodDays: 2,
      maxFineCap: 50,
    });
    assert.equal(r.amount, 50);
    assert.ok(r.overdueDays > 10);
  });

  it('zero when on time', () => {
    const r = calculateFine({
      dueDate: '2026-01-10',
      returnDate: '2026-01-09',
      dailyFineRate: 5,
      gracePeriodDays: 2,
      maxFineCap: 500,
    });
    assert.equal(r.amount, 0);
    assert.equal(r.overdueDays, 0);
  });
});
