import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { upsertCanonicalBooks, CANONICAL_BOOKS } from './canonicalBooks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_ai');
const saved = await upsertCanonicalBooks();
console.log(`Upserted ${saved.length} canonical books.`);
console.log('Genres:', [...new Set(CANONICAL_BOOKS.map((b) => b.category))].join(', '));
await mongoose.disconnect();
