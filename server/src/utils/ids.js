export function generateReaderId(year = new Date().getFullYear(), seq) {
  const n = String(seq).padStart(4, '0');
  return `LIB-${year}-${n}`;
}

export function generateBarcode(seq) {
  return `BC-${String(seq).padStart(6, '0')}`;
}

export function generateTransactionId() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TXN-${Date.now()}-${rand}`;
}

export function randomFourDigit() {
  return Math.floor(1000 + Math.random() * 9000);
}
