import { describe, it, expect } from 'vitest';
import { dueBadge, formatMoney } from './format.js';

describe('format helpers', () => {
  it('formats currency', () => {
    expect(formatMoney(5, '₹')).toBe('₹5.00');
  });

  it('due badge overdue', () => {
    const past = new Date(Date.now() - 3 * 86400000);
    const b = dueBadge(past);
    expect(b.color).toBe('red');
  });
});
