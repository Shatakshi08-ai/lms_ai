export function formatMoney(amount, symbol = '₹') {
  const n = Number(amount || 0);
  return `${symbol}${n.toFixed(2)}`;
}

export function daysUntil(date) {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

export function dueBadge(dueDate) {
  const d = daysUntil(dueDate);
  if (d == null) return { color: 'default', text: '—' };
  if (d < 0) return { color: 'red', text: `${Math.abs(d)}d overdue` };
  if (d <= 2) return { color: 'orange', text: `${d}d left` };
  return { color: 'green', text: `${d}d left` };
}
