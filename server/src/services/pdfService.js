import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadReadablePages } from './readingService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PRIVATE_PDF_DIR = path.join(__dirname, '../../private-pdfs');

function pdfEscape(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function toWinAnsi(text) {
  return String(text || '')
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, (ch) => {
      const map = {
        '\u2018': "'",
        '\u2019': "'",
        '\u201c': '"',
        '\u201d': '"',
        '\u2013': '-',
        '\u2014': '-',
        '\u2026': '...',
      };
      return map[ch] || '?';
    });
}

function wrapLines(text, width = 90) {
  const out = [];
  for (const raw of String(text || '').split(/\n/)) {
    const line = toWinAnsi(raw);
    if (!line) {
      out.push('');
      continue;
    }
    let rest = line;
    while (rest.length > width) {
      let cut = rest.lastIndexOf(' ', width);
      if (cut < 40) cut = width;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    if (rest) out.push(rest);
  }
  return out.length ? out : [''];
}

export function buildPdfFromPages(title, pages) {
  const chunks = (pages || []).map((p) => String(p || '').trim()).filter(Boolean);
  const body = chunks.length ? chunks : ['No readable text was stored for this title.'];
  const objects = [];
  const kids = [];
  const contentIds = [];

  body.forEach((pageText, idx) => {
    const lines = wrapLines(pageText, 92).slice(0, 52);
    const header = toWinAnsi(`${title || 'QuestLearn'} — page ${idx + 1} of ${body.length}`);
    let y = 770;
    const cmds = [`BT /F1 9 Tf 48 ${y} Td (${pdfEscape(header)}) Tj ET`];
    y = 742;
    cmds.push(`BT /F1 11 Tf 48 ${y} Td`);
    lines.forEach((line, i) => {
      if (i === 0) cmds.push(`(${pdfEscape(line)}) Tj`);
      else cmds.push(`0 -14 Td (${pdfEscape(line)}) Tj`);
    });
    cmds.push('ET');
    contentIds.push(objects.length + 1);
    objects.push({ stream: cmds.join('\n') });
  });

  const pageObjectIds = [];
  contentIds.forEach((cid) => {
    pageObjectIds.push(objects.length + 1);
    objects.push({ dict: true, contentId: cid });
  });

  const pagesId = objects.length + 1;
  objects.push({ pages: true, kids: pageObjectIds });
  const fontId = objects.length + 1;
  objects.push({ font: true });
  const catalogId = objects.length + 1;
  objects.push({ catalog: true, pagesId });

  const parts = ['%PDF-1.4\n'];
  const xref = [0];
  function pushObj(id, bodyStr) {
    xref[id] = Buffer.byteLength(parts.join(''), 'latin1');
    parts.push(`${id} 0 obj\n${bodyStr}\nendobj\n`);
  }
  objects.forEach((obj, i) => {
    const id = i + 1;
    if (obj.stream != null) {
      const stream = obj.stream;
      pushObj(id, `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    } else if (obj.dict) {
      pushObj(
        id,
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${obj.contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
      );
    } else if (obj.pages) {
      pushObj(id, `<< /Type /Pages /Count ${obj.kids.length} /Kids [${obj.kids.map((k) => `${k} 0 R`).join(' ')}] >>`);
    } else if (obj.font) {
      pushObj(id, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    } else if (obj.catalog) {
      pushObj(id, `<< /Type /Catalog /Pages ${obj.pagesId} 0 R >>`);
    }
  });
  const xrefStart = Buffer.byteLength(parts.join(''), 'latin1');
  let xrefTable = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    xrefTable += `${String(xref[i]).padStart(10, '0')} 00000 n \n`;
  }
  parts.push(xrefTable);
  parts.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);
  return Buffer.from(parts.join(''), 'latin1');
}

export async function pdfPathFor(book) {
  if (!book?.pdfFileName) return null;
  const safe = path.basename(book.pdfFileName);
  const full = path.join(PRIVATE_PDF_DIR, safe);
  try {
    await fs.access(full);
    return full;
  } catch {
    return null;
  }
}

export async function saveUploadedPdf(bookId, buffer) {
  await fs.mkdir(PRIVATE_PDF_DIR, { recursive: true });
  const name = `${bookId}.pdf`;
  const full = path.join(PRIVATE_PDF_DIR, name);
  await fs.writeFile(full, buffer);
  return name;
}

export async function resolveBookPdf(book) {
  const stored = await pdfPathFor(book);
  if (stored) return fs.readFile(stored);

  const gid = book.gutenbergId;
  if (gid) {
    const urls = [
      `https://www.gutenberg.org/files/${gid}/${gid}-pdf.pdf`,
      `https://www.gutenberg.org/cache/epub/${gid}/pg${gid}.pdf`,
      `https://www.gutenberg.org/cache/epub/${gid}/pg${gid}-images.pdf`,
      `https://www.gutenberg.org/ebooks/${gid}.pdf`,
    ];
    for (const url of urls) {
      try {
        const upstream = await fetch(url, {
          headers: { 'User-Agent': 'QuestLearnLMS/1.0 (authenticated library download)' },
          signal: AbortSignal.timeout(30000),
          redirect: 'follow',
        });
        if (!upstream.ok) continue;
        const buf = Buffer.from(await upstream.arrayBuffer());
        if (buf.slice(0, 5).toString() === '%PDF-') return buf;
      } catch {
        /* try next source */
      }
    }
  }

  if (book.fullText) {
    const pages = String(book.fullText)
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    return buildPdfFromPages(book.title, pages.length ? pages : [book.fullText]);
  }

  if (book.isFree) {
    const pages = await loadReadablePages(book);
    if (pages?.length) return buildPdfFromPages(book.title, pages);
  }

  return null;
}

export function canDownloadBook(book) {
  return Boolean(book?.pdfFileName || book?.fullText || book?.gutenbergId || book?.isFree);
}
