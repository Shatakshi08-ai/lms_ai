import api from './api.js';

export async function readErrorMessage(error, fallback = 'Request failed') {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      return parsed.message || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.message || error?.message || fallback;
}

export async function downloadBookPdf(bookId, title) {
  const res = await api.get(`/books/${bookId}/pdf`, { responseType: 'blob' });
  const type = String(res.headers['content-type'] || '');
  const blob = res.data;
  if (type.includes('json') || type.includes('text') || blob?.type?.includes('json')) {
    let text = '';
    try {
      text = await blob.text();
      const parsed = JSON.parse(text);
      throw new Error(parsed.message || 'PDF unavailable');
    } catch (e) {
      if (e.message && !e.message.includes('JSON')) throw e;
      throw new Error('PDF download is not available for this title.');
    }
  }
  const header = await blob.slice(0, 5).text();
  if (header !== '%PDF-') {
    throw new Error('The server did not return a complete PDF for this title.');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${String(title || 'questlearn-book').replace(/[^\w\- ]+/g, '').slice(0, 80) || 'book'}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
