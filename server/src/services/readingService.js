const textCache = new Map();
const PAGE_CHARS = 1800;

function pickTextUrl(formats = {}) {
  return (
    formats['text/plain; charset=utf-8'] ||
    formats['text/plain; charset=us-ascii'] ||
    formats['text/plain'] ||
    ''
  );
}

export function gutenbergTextUrl(formats, id) {
  return pickTextUrl(formats) || (id ? `https://www.gutenberg.org/files/${id}/${id}-0.txt` : '');
}

function cleanGutenbergText(raw) {
  let text = String(raw || '').replace(/\r\n/g, '\n');
  const start = text.search(/\*\*\*\s*START OF (THIS|THE) PROJECT GUTENBERG/i);
  const end = text.search(/\*\*\*\s*END OF (THIS|THE) PROJECT GUTENBERG/i);
  if (start >= 0) text = text.slice(text.indexOf('\n', start) + 1);
  if (end > 0) text = text.slice(0, end);
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function paginate(text) {
  const pages = [];
  let buf = '';
  for (const para of text.split(/\n\s*\n/)) {
    const chunk = para.trim();
    if (!chunk) continue;
    if (buf.length + chunk.length > PAGE_CHARS && buf) {
      pages.push(buf.trim());
      buf = chunk;
    } else {
      buf = buf ? `${buf}\n\n${chunk}` : chunk;
    }
  }
  if (buf.trim()) pages.push(buf.trim());
  return pages.length ? pages : ['No readable text is available for this title.'];
}

export async function loadReadablePages(book) {
  if (!book?.isFree && !book?.fullText && !book?.gutenbergId) return null;
  const key = String(book._id);
  if (textCache.has(key)) return textCache.get(key);
  if (book.fullText) {
    const pages = paginate(cleanGutenbergText(book.fullText));
    textCache.set(key, pages);
    return pages;
  }
  const id = book.gutenbergId;
  const urls = [book.textUrl, id && `https://www.gutenberg.org/files/${id}/${id}-0.txt`, id && `https://www.gutenberg.org/files/${id}/${id}.txt`, id && `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`].filter(Boolean);
  let lastErr;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'QuestLearnLMS/1.0 (library reader; public-domain)' },
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) {
        lastErr = new Error(`Reading source returned ${res.status}`);
        continue;
      }
      const pages = paginate(cleanGutenbergText(await res.text()));
      textCache.set(key, pages);
      return pages;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('No reading source');
}
