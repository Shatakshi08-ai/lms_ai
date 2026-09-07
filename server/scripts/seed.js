import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { Book, CATEGORIES } from '../src/models/Book.js';
import { BookCopy } from '../src/models/BookCopy.js';
import { Circulation } from '../src/models/Circulation.js';
import { Reservation } from '../src/models/Reservation.js';
import { Fine } from '../src/models/Fine.js';
import { Settings } from '../src/models/Settings.js';
import { upsertCanonicalBooks } from './canonicalBooks.js';
import { generateReaderId } from '../src/utils/ids.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_ai';

const DEMO_ACCOUNTS = [
  {
    name: 'Super Admin',
    email: 'superadmin@library.com',
    password: 'Password123!',
    role: 'SUPER_ADMIN',
    readerId: generateReaderId(2026, 1),
    department: 'IT',
    preferencesOnboarded: true,
  },
  {
    name: 'Library Admin',
    email: 'admin@library.com',
    password: 'Password123!',
    role: 'ADMIN',
    readerId: generateReaderId(2026, 2),
    department: 'Administration',
    preferencesOnboarded: true,
  },
  {
    name: 'Desk Librarian',
    email: 'librarian@library.com',
    password: 'Password123!',
    role: 'LIBRARIAN',
    readerId: generateReaderId(2026, 3),
    department: 'Circulation',
    preferencesOnboarded: true,
  },
  {
    name: 'Aisha Student',
    email: 'student@library.com',
    password: 'Password123!',
    role: 'STUDENT',
    readerId: generateReaderId(2026, 8942),
    department: 'Computer Science',
    maxBorrowLimit: 5,
    preferencesOnboarded: true,
    preferences: { genres: ['Computer Science', 'Artificial Intelligence', 'Science Fiction'], languages: ['English'], readingGoal: 'coursework' },
  },
  {
    name: 'Jordan Member',
    email: 'member@library.com',
    password: 'Password123!',
    role: 'MEMBER',
    readerId: generateReaderId(2026, 4),
    department: 'General',
    maxBorrowLimit: 5,
    preferencesOnboarded: true,
    preferences: { genres: ['Literature'], languages: ['English'], readingGoal: 'casual' },
  },
];

async function ensureDemoUsers() {
  for (const account of DEMO_ACCOUNTS) {
    const exists = await User.findOne({ email: account.email });
    if (!exists) await User.create(account);
  }
}

const PEXELS = [
  'https://images.pexels.com/photos/159711/books-bookstore-book-reading-159711.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/256541/pexels-photo-256541.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/415071/pexels-photo-415071.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1370295/pexels-photo-1370295.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/694740/pexels-photo-694740.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/46274/pexels-photo-46274.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/590493/pexels-photo-590493.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/2041540/pexels-photo-2041540.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1290141/pexels-photo-1290141.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1106468/pexels-photo-1106468.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1181244/pexels-photo-1181244.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1181298/pexels-photo-1181298.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/267885/pexels-photo-267885.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/207662/pexels-photo-207662.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/159751/book-address-book-learning-learn-159751.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/2908984/pexels-photo-2908984.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3747468/pexels-photo-3747468.jpeg?auto=compress&cs=tinysrgb&w=600',
];

const CATALOG = {
  'Computer Science': {
    sub: ['Algorithms', 'Operating Systems', 'Networks', 'Databases', 'Software Engineering'],
    titles: [
      'Introduction to Algorithms',
      'Modern Operating Systems',
      'Computer Networks',
      'Database System Concepts',
      'Clean Architecture Patterns',
      'Distributed Systems Primer',
      'Compilers: Principles in Practice',
      'Data Structures Workshop',
    ],
    authors: ['Knuth Rivera', 'Ada Brooks', 'Linus Chandra', 'Grace Patel', 'Alan Mehta'],
    tags: ['coding', 'systems', 'algorithms', 'software'],
    genres: ['Computer Science'],
  },
  'Data Science': {
    sub: ['Statistics', 'Visualization', 'ETL', 'Python', 'SQL'],
    titles: [
      'Practical Statistics for Analysts',
      'Python for Data Wrangling',
      'Storytelling with Charts',
      'Warehouse Design Notes',
      'Feature Engineering Handbook',
      'Causal Inference Primer',
    ],
    authors: ['Hadley Sen', 'DJ Patel', 'Florence Rao', 'Nate Kim'],
    tags: ['python', 'stats', 'viz', 'sql'],
    genres: ['Data Science'],
  },
  'Artificial Intelligence': {
    sub: ['Machine Learning', 'NLP', 'Computer Vision', 'Agents', 'Ethics'],
    titles: [
      'Deep Learning Foundations',
      'Natural Language Pipelines',
      'Vision Systems Lab',
      'Reinforcement Learning Notes',
      'Responsible AI Playbook',
      'Transformer Architecture Guide',
      'Multi-Agent Workflows',
    ],
    authors: ['Yoshua Das', 'Fei Chen', 'Andrew Iyer', 'Demis Shah'],
    tags: ['ml', 'nlp', 'llm', 'ethics'],
    genres: ['Artificial Intelligence', 'Science Fiction'],
  },
  Business: {
    sub: ['Strategy', 'Finance', 'Operations', 'Marketing', 'Leadership'],
    titles: [
      'Competitive Strategy Cases',
      'Corporate Finance Essentials',
      'Lean Operations Fieldbook',
      'Brand Systems Manual',
      'Leading High-Trust Teams',
      'Product Management Cadence',
    ],
    authors: ['Michael Kapoor', 'Rita Banerjee', 'Peter Singh', 'Amy Desai'],
    tags: ['strategy', 'mba', 'ops'],
    genres: ['Business'],
  },
  Literature: {
    sub: ['Fiction', 'Poetry', 'Drama', 'Essays', 'World Literature'],
    titles: [
      'River of Lanterns',
      'The Quiet Archive',
      'Sonnets for a Monsoon',
      'Stage Lights Over Delhi',
      'Essays on Belonging',
      'Maps of Imagined Cities',
    ],
    authors: ['Arundhati Cole', 'Orhan Devi', 'Toni Sharma', 'Haruki Bose'],
    tags: ['fiction', 'poetry', 'classic'],
    genres: ['Literature', 'Fiction', 'Poetry'],
  },
  History: {
    sub: ['Ancient', 'Medieval', 'Modern', 'South Asia', 'World Wars'],
    titles: [
      'Silk Roads Revisited',
      'Mughal Court Chronicles',
      'Industrial Age Letters',
      'Partition Oral Histories',
      'The Long Twentieth Century',
      'Maritime Empires',
    ],
    authors: ['Ramachandra Holt', 'William Thapar', 'Barbara Sen', 'Eric Nair'],
    tags: ['archive', 'civilization', 'war'],
    genres: ['History', 'Biography'],
  },
  Physics: {
    sub: ['Mechanics', 'Electromagnetism', 'Quantum', 'Thermodynamics', 'Astrophysics'],
    titles: [
      'Classical Mechanics Worked',
      'Fields and Waves Lab',
      'Quantum Primer',
      'Statistical Mechanics Notes',
      'Stars and Relativity',
      'Optics for Engineers',
    ],
    authors: ['Feynman Rao', 'Maxwell Iyer', 'Dirac Khan', 'Sagan Mukherjee'],
    tags: ['quantum', 'astro', 'lab'],
    genres: ['Physics'],
  },
  Mystery: {
    sub: ['Detective', 'Cozy', 'Noir', 'Police Procedural', 'Locked Room'],
    titles: [
      'The Lantern Clue',
      'Fog Over Marine Drive',
      'The Silent Stack',
      'Case of the Missing Folio',
      'Midnight Circulation Desk',
      'Whispers in the Rare Room',
    ],
    authors: ['Agatha Sen', 'Raymond Kapoor', 'Tana Iyer', 'Louise Mehta'],
    tags: ['mystery', 'crime', 'detective'],
    genres: ['Mystery', 'Thriller', 'Fiction'],
  },
  Romance: {
    sub: ['Contemporary', 'Historical', 'Campus', 'Slow Burn', 'Feel-good'],
    titles: [
      'Letters Across the Stacks',
      'Monsoon Bookshop',
      'The Last Reading List',
      'Coffee and Catalog Cards',
      'A Shelf of Our Own',
      'Due Date for the Heart',
    ],
    authors: ['Emily Das', 'Colleen Rao', 'Helen Banerjee', 'Ali Nair'],
    tags: ['romance', 'feel-good', 'campus'],
    genres: ['Romance', 'Fiction'],
  },
  Fantasy: {
    sub: ['Epic', 'Urban', 'Mythic', 'Portal', 'Court'],
    titles: [
      'The Inkbound Kingdom',
      'Libraries of Emberfall',
      'Moonward Cartography',
      'The Ninth Binding',
      'Salt and Starlight',
      'Crown of Quiet Pages',
    ],
    authors: ['N.K. Sharma', 'Leigh Patel', 'Brandon Cole', 'Naomi Iyer'],
    tags: ['fantasy', 'magic', 'quest'],
    genres: ['Fantasy', 'Fiction', 'Young Adult'],
  },
  'Science Fiction': {
    sub: ['Space Opera', 'Near Future', 'AI', 'Dystopia', 'First Contact'],
    titles: [
      'Orbit of the Last Archive',
      'Neural Dust Colony',
      'The Quiet Protocol',
      'Starlight Catalog',
      'Machines That Remember',
      'Horizon Index',
    ],
    authors: ['Liu Chen', 'Octavia Rao', 'Ted Mukherjee', 'Ann Lata'],
    tags: ['scifi', 'future', 'ai'],
    genres: ['Science Fiction', 'Fiction'],
  },
  Thriller: {
    sub: ['Psychological', 'Political', 'Techno', 'Spy', 'Legal'],
    titles: [
      'The Overdue File',
      'Blackout on Level B',
      'Cipher in the Margin',
      'Hold Queue',
      'The Last Borrower',
      'Redacted Dedication',
    ],
    authors: ['Gillian Shah', 'Lee Childs', 'Paula Nair', 'Dan Kapoor'],
    tags: ['thriller', 'suspense', 'spy'],
    genres: ['Thriller', 'Mystery', 'Fiction'],
  },
  Biography: {
    sub: ['Scientists', 'Leaders', 'Artists', 'Activists', 'Explorers'],
    titles: [
      'Life of a Circuit Maker',
      'Walking with Archives',
      'The Cartographer of Bombay',
      'Notes from a Quiet Rebel',
      'She Mapped the Stars',
      'A Librarian at War',
    ],
    authors: ['Walter Isaac', 'Ramachandra Holt', 'Maya Sen', 'David Thapar'],
    tags: ['biography', 'memoir', 'lives'],
    genres: ['Biography', 'History'],
  },
  'Self-Help': {
    sub: ['Habits', 'Focus', 'Communication', 'Career', 'Wellbeing'],
    titles: [
      'Deep Work for Readers',
      'The Gentle Deadline',
      'Atomic Reading Habits',
      'Speak So Shelves Listen',
      'Rest Between Chapters',
      'Build a Personal Canon',
    ],
    authors: ['James Clearwater', 'Cal Newportia', 'Brené Kapoor', 'Atomic Sen'],
    tags: ['habits', 'focus', 'growth'],
    genres: ['Self-Help'],
  },
  Philosophy: {
    sub: ['Ethics', 'Logic', 'Metaphysics', 'Political', 'Eastern'],
    titles: [
      'Questions in the Quiet Carrel',
      'The Examined Shelf',
      'On Borrowed Time',
      'Virtue and Circulation',
      'What We Owe the Next Reader',
      'Reason After Closing Time',
    ],
    authors: ['Martha Nuss', 'Kwame Sen', 'Simone Iyer', 'Alain Patel'],
    tags: ['ethics', 'ideas', 'thought'],
    genres: ['Philosophy'],
  },
};

function isbn13(n) {
  const body = `978${String(100000000 + n).slice(-9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return body + check;
}

async function seed() {
  await mongoose.connect(MONGO);
  console.log('Mongo connected');
  if (process.argv.includes('--ensure-only')) {
    await ensureDemoUsers();
    await Settings.findOneAndUpdate(
      { key: 'library' },
      { $setOnInsert: { key: 'library', libraryName: 'QuestLearn' } },
      { upsert: true },
    );
    console.log('Demo accounts ensured (existing users were not deleted)');
    await mongoose.disconnect();
    return;
  }
  await Promise.all([
    User.deleteMany({}),
    Book.deleteMany({}),
    BookCopy.deleteMany({}),
    Circulation.deleteMany({}),
    Reservation.deleteMany({}),
    Fine.deleteMany({}),
    Settings.deleteMany({}),
  ]);

  await Settings.create({ key: 'library', dailyFineRate: 5, gracePeriodDays: 2, maxFineCap: 500 });

  const users = await User.create(DEMO_ACCOUNTS);

  const extraStudents = [];
  for (let i = 0; i < 40; i += 1) {
    extraStudents.push({
      name: `Member ${i + 1}`,
      email: `member${i + 1}@library.com`,
      password: 'Password123!',
      role: 'STUDENT',
      readerId: generateReaderId(2026, 1000 + i),
      department: CATEGORIES[i % CATEGORIES.length],
      preferencesOnboarded: true,
      preferences: { genres: [CATEGORIES[i % CATEGORIES.length]], languages: ['English'], readingGoal: 'casual' },
    });
  }
  const members = await User.create(extraStudents);
  const allStudents = [users[3], ...members];

  const books = [];
  let n = 0;
  while (books.length < 1000) {
    for (const category of CATEGORIES) {
      if (books.length >= 1000) break;
      const meta = CATALOG[category];
      const base = meta.titles[n % meta.titles.length];
      const edition = Math.floor(n / meta.titles.length) + 1;
      const author = meta.authors[n % meta.authors.length];
      const co = meta.authors[(n + 1) % meta.authors.length];
      const sub = meta.sub[n % meta.sub.length];
      books.push({
        title: edition === 1 ? base : `${base} (Vol. ${edition})`,
        subtitle: `${sub} series`,
        isbn: isbn13(100000 + books.length),
        isbn10: String(1000000000 + books.length).slice(0, 10),
        summary: `${base} covers ${sub} in ${category} with worked examples, exercises, and a reading path for university libraries.`,
        authors: [author, co],
        publisher: ['Aether Press', 'North Stack', 'Campus Press', 'Open Shelf'][n % 4],
        publicationYear: 1998 + (n % 28),
        category,
        genres: meta.genres || [category],
        subcategory: sub,
        shelfLocation: `${category.slice(0, 2).toUpperCase()}-${String((n % 40) + 1).padStart(2, '0')}`,
        tags: meta.tags,
        coverImage: PEXELS[books.length % PEXELS.length],
        totalCopies: 0,
        availableCopies: 0,
        pages: 180 + (n % 400),
      });
      n += 1;
    }
  }

  const insertedBooks = await Book.insertMany(books, { ordered: true });
  const upcomingIds = insertedBooks.slice(-12).map((b) => b._id);
  const featuredIds = insertedBooks.slice(0, 8).map((b) => b._id);
  await Book.updateMany(
    { _id: { $in: upcomingIds } },
    { $set: { isUpcoming: true, featured: false, releaseDate: new Date(Date.now() + 21 * 86400000) } },
  );
  await Book.updateMany({ _id: { $in: featuredIds } }, { $set: { featured: true } });
  const canonical = await upsertCanonicalBooks();
  console.log('Books', insertedBooks.length, 'canonical', canonical.length);

  const copies = [];
  let barcodeSeq = 100001;
  for (const book of insertedBooks) {
    const count = 3;
    for (let i = 0; i < count; i += 1) {
      const barcode = generateBarcode(barcodeSeq);
      copies.push({
        bookId: book._id,
        barcode,
        accessionNumber: barcode,
        condition: i === 0 ? 'NEW' : 'GOOD',
        status: 'AVAILABLE',
        shelfLocation: book.shelfLocation,
      });
      barcodeSeq += 1;
    }
    book.totalCopies = count;
    book.availableCopies = count;
  }
  await BookCopy.insertMany(copies, { ordered: false });
  await Book.bulkWrite(
    insertedBooks.map((b) => ({
      updateOne: { filter: { _id: b._id }, update: { $set: { totalCopies: 3, availableCopies: 3 } } },
    })),
  );
  console.log('Copies', copies.length);

  const copyDocs = await BookCopy.find().limit(400).lean();
  const librarian = users[2];
  const now = Date.now();
  const circs = [];
  for (let i = 0; i < 180; i += 1) {
    const copy = copyDocs[i];
    const student = allStudents[i % allStudents.length];
    const issueDate = new Date(now - (20 + (i % 40)) * 86400000);
    const dueDate = new Date(issueDate.getTime() + 14 * 86400000);
    const returned = i % 3 !== 0;
    circs.push({
      userId: student._id,
      copyId: copy._id,
      bookId: copy.bookId,
      issueDate,
      dueDate,
      returnDate: returned ? new Date(dueDate.getTime() + (i % 8) * 86400000) : null,
      renewalCount: i % 7 === 0 ? 1 : 0,
      status: returned ? 'RETURNED' : dueDate < new Date() ? 'OVERDUE' : 'ISSUED',
      fineAmount: 0,
      issuedBy: librarian._id,
    });
  }
  const insertedCirc = await Circulation.insertMany(circs);

  const issued = insertedCirc.filter((c) => c.status !== 'RETURNED');
  await BookCopy.updateMany({ _id: { $in: issued.map((c) => c.copyId) } }, { $set: { status: 'ISSUED' } });
  const issuedByBook = {};
  for (const c of issued) {
    const k = String(c.bookId);
    issuedByBook[k] = (issuedByBook[k] || 0) + 1;
  }
  await Book.bulkWrite(
    Object.entries(issuedByBook).map(([id, nIssued]) => ({
      updateOne: { filter: { _id: id }, update: { $inc: { availableCopies: -nIssued } } },
    })),
  );

  const fines = [];
  for (const c of insertedCirc.filter((x) => x.status === 'RETURNED').slice(0, 40)) {
    const amount = 5 * ((c._id.getTimestamp().getDate() % 6) + 1);
    const paid = fines.length % 2 === 0;
    fines.push({
      userId: c.userId,
      circulationId: c._id,
      amount,
      status: paid ? 'PAID' : 'PENDING',
      transactionId: paid ? generateTransactionId() : undefined,
      paymentDate: paid ? new Date() : undefined,
      paymentMethod: paid ? 'UPI' : undefined,
      cashierId: paid ? librarian._id : undefined,
    });
    if (!paid) {
      await User.updateOne({ _id: c.userId }, { $inc: { activeFineBalance: amount } });
    }
  }
  await Fine.insertMany(fines);

  const resv = [];
  for (let i = 0; i < 25; i += 1) {
    const book = insertedBooks[i * 7];
    resv.push({
      bookId: book._id,
      userId: allStudents[i]._id,
      queuePosition: 1,
      status: 'PENDING',
    });
  }
  await Reservation.insertMany(resv);

  console.log('Seed complete');
  console.log('Logins: superadmin@library.com / admin@library.com / librarian@library.com / student@library.com');
  console.log('Password: Password123!');
  await mongoose.disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
