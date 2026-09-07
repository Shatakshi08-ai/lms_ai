/**
 * Duplicate-safe import of 1000+ English public-domain titles from the official
 * Project Gutenberg catalog CSV. Re-running upserts by gutenbergId and never
 * deletes users or other collections.
 *
 * Usage: npm run seed:catalog --prefix server
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Book, GENRES } from '../src/models/Book.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_ai';
const TARGET = 1100;
const CATALOG_URL = 'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv';
const FREE_IDS = [11, 16, 36, 43, 45, 55, 74, 76, 84, 98, 120, 158, 174, 219, 345, 514, 844, 1232, 1260, 1342, 1661, 2701, 2591, 25344];

const CATEGORY_RULES = [
  [/science fiction|sci-fi|time travel/i, 'Science Fiction'],
  [/fantasy|fairy|wizard|magic|myth/i, 'Fantasy'],
  [/mystery|detective|crime|sherlock/i, 'Mystery'],
  [/horror|ghost|gothic|dracula|frankenstein/i, 'Thriller'],
  [/romance|love stories/i, 'Romance'],
  [/biography|autobiography|memoir/i, 'Biography'],
  [/philosophy|ethics|stoic/i, 'Philosophy'],
  [/physics|astronomy|chemistry|biology|mathematics|science --|natural science/i, 'Science'],
  [/computer|programming|software/i, 'Computer Science'],
  [/business|economics|finance/i, 'Business'],
  [/history|war|civil war|world war/i, 'History'],
  [/self-help|conduct of life|success/i, 'Self-Help'],
  [/poetry|poems/i, 'Poetry'],
  [/fiction|novel/i, 'Fiction'],
];

function mapCategory(subjects = [], shelves = []) {
  const hay = [...subjects, ...shelves].join(' | ');
  for (const [rx, cat] of CATEGORY_RULES) {
    if (rx.test(hay)) return cat;
  }
  return 'Literature';
}

function mapGenres(subjects = [], shelves = [], category) {
  const hay = [...subjects, ...shelves, category];
  const found = GENRES.filter((g) => hay.some((h) => String(h).toLowerCase().includes(g.toLowerCase())));
  return [...new Set([category, ...found])].slice(0, 6);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n') {
      row.push(cur.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cur = '';
    } else cur += c;
  }
  if (cur || row.length) {
    row.push(cur.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

function splitList(value) {
  return String(value || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function authorNames(raw) {
  return splitList(raw).map((a) => a.replace(/,\s*\d{4}.*$/, '').trim()).filter(Boolean);
}

function toDoc(rec) {
  const id = Number(rec.id);
  const subjects = splitList(rec.subjects);
  const shelves = splitList(rec.shelves);
  const category = mapCategory(subjects, shelves);
  const authors = authorNames(rec.authors);
  const year = rec.issued ? Number(String(rec.issued).slice(0, 4)) : 1900;
  return {
    title: String(rec.title || 'Untitled').slice(0, 220),
    subtitle: shelves[0] || '',
    isbn: `PG-${id}`,
    summary: subjects.length
      ? `Public-domain work by ${authors[0] || 'Unknown'}. Filed under ${category}. Subjects: ${subjects.slice(0, 4).join('; ')}.`
      : `Public-domain work by ${authors[0] || 'Unknown'}, sourced from Project Gutenberg.`,
    authors: authors.length ? authors : ['Unknown'],
    publisher: 'Project Gutenberg',
    publicationYear: year >= 1400 && year <= 2100 ? year : 1900,
    category,
    genres: mapGenres(subjects, shelves, category),
    tags: subjects.slice(0, 8),
    coverImage: `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`,
    language: 'English',
    totalCopies: 2,
    availableCopies: 2,
    gutenbergId: id,
    source: 'gutenberg',
    sourceUrl: `https://www.gutenberg.org/ebooks/${id}`,
    textUrl: `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    htmlUrl: `https://www.gutenberg.org/files/${id}/${id}-h/${id}-h.htm`,
    downloadCount: 0,
    featured: FREE_IDS.includes(id),
  };
}

async function run() {
  await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 8000 });
  const res = await fetch(CATALOG_URL, {
    headers: { 'User-Agent': 'QuestLearnLMS/1.0' },
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`Catalog download failed: ${res.status}`);
  const rows = parseCsv(await res.text());
  const header = rows.shift() || [];
  const idx = Object.fromEntries(header.map((h, i) => [h.replace(/^\uFEFF/, ''), i]));
  const english = [];
  for (const row of rows) {
    if ((row[idx.Type] || '') !== 'Text') continue;
    if ((row[idx.Language] || '') !== 'en') continue;
    const title = row[idx.Title];
    const id = Number(row['Text#'] ?? row[idx['Text#']]);
    if (!title || !Number.isFinite(id)) continue;
    english.push({
      id,
      title,
      issued: row[idx.Issued],
      authors: row[idx.Authors],
      subjects: row[idx.Subjects],
      shelves: row[idx.Bookshelves],
    });
  }
  english.sort((a, b) => {
    const as = a.shelves ? 0 : 1;
    const bs = b.shelves ? 0 : 1;
    if (as !== bs) return as - bs;
    return a.id - b.id;
  });
  const picked = english.slice(0, TARGET);
  console.log(`Parsed ${english.length} English texts; importing ${picked.length}`);

  const chunk = 200;
  let upserted = 0;
  let modified = 0;
  for (let i = 0; i < picked.length; i += chunk) {
    const slice = picked.slice(i, i + chunk).map(toDoc);
    const ops = slice.map((d) => {
      const { featured, ...meta } = d;
      return {
        updateOne: {
          filter: { gutenbergId: d.gutenbergId },
          update: {
            $set: { ...meta, featured },
            $setOnInsert: { averageRating: 4.1, reviewCount: 0, isFree: false },
          },
          upsert: true,
        },
      };
    });
    const result = await Book.bulkWrite(ops, { ordered: false });
    upserted += result.upsertedCount || 0;
    modified += result.modifiedCount || 0;
    console.log(`Wrote ${Math.min(i + chunk, picked.length)}/${picked.length}`);
  }

  await Book.updateMany({ isFree: true, source: 'gutenberg' }, { $set: { isFree: false } });
  const freePresent = await Book.find({ gutenbergId: { $in: FREE_IDS } }).select('_id gutenbergId').lean();
  let freeIds = freePresent.map((b) => b._id);
  if (freeIds.length < 20) {
    const extra = await Book.find({ source: 'gutenberg', _id: { $nin: freeIds } })
      .sort({ gutenbergId: 1 })
      .limit(20 - freeIds.length)
      .select('_id');
    freeIds = [...freeIds, ...extra.map((b) => b._id)];
  }
  await Book.updateMany({ _id: { $in: freeIds.slice(0, 24) } }, { $set: { isFree: true } });

  const total = await Book.countDocuments();
  const free = await Book.countDocuments({ isFree: true });
  console.log(`Done. books=${total} free=${free} upserted=${upserted} updated=${modified}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
