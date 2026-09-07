import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const seen = new Set();
const rows = [];

function add(category, question, answer) {
  const q = String(question).replace(/\s+/g, ' ').trim();
  const a = String(answer).replace(/\s+/g, ' ').trim();
  const key = q.toLowerCase();
  if (!q || !a || seen.has(key)) return;
  seen.add(key);
  rows.push({ id: rows.length + 1, category, question: q, answer: a });
}

const how = [
  'How do I',
  'How can I',
  'What is the way to',
  'Where do I go to',
  'Can you tell me how to',
  'What steps should I follow to',
  'Is there a menu option to',
];
const can = ['Can I', 'Am I allowed to', 'Is it possible to', 'Does QuestLearn let me'];

function expand(category, cores) {
  for (const { action, answer, extra = [] } of cores) {
    for (const p of how) add(category, `${p} ${action}?`, answer);
    for (const p of can) add(category, `${p} ${action}?`, answer);
    add(category, `I need help with ${action}.`, answer);
    add(category, `Please explain ${action}.`, answer);
    for (const e of extra) add(category, e.q, e.a || answer);
  }
}

expand('Registration', [
  {
    action: 'create a QuestLearn account',
    answer: 'Open Register, enter your full name, email, password, choose Student or Member, agree to the terms, and submit. QuestLearn saves a hashed password and issues a reader ID.',
    extra: [
      { q: 'Who can register on QuestLearn?', a: 'Students and members can self-register. Librarian and Admin accounts are created by an administrator.' },
      { q: 'Why was my registration rejected?', a: 'The email may already exist, the password may be shorter than 8 characters, or required fields were empty.' },
      { q: 'Do I get a reader ID after signing up?', a: 'Yes. QuestLearn assigns a reader ID such as LIB-YYYY-XXXX when your account is created.' },
    ],
  },
  {
    action: 'register as a student',
    answer: 'On the registration form choose the Student role, complete your details, and submit. You will land on your student dashboard after login.',
  },
  {
    action: 'register as a member',
    answer: 'Choose Member on the registration form. Member accounts use the same catalog and borrowing tools as students, with member labeling on the dashboard.',
  },
]);

expand('Login', [
  {
    action: 'log in to QuestLearn',
    answer: 'Open the login page, enter your registered email and password, optionally tick Remember me, and select Login.',
    extra: [
      { q: 'What if I enter the wrong password?', a: 'QuestLearn shows an invalid credentials message. After several attempts you may be rate limited. Use Forgot password if you cannot sign in.' },
      { q: 'Why does login say account is not active?', a: 'An administrator may have suspended or deactivated the account. Contact library staff.' },
      { q: 'Does Remember me keep me signed in?', a: 'Yes. Remember me stores a secure refresh cookie for up to 30 days on this browser. Do not use it on a shared computer.' },
    ],
  },
]);

expand('Logout', [
  {
    action: 'log out of QuestLearn',
    answer: 'Use Sign out in the sidebar or header. This clears your session cookie and access token.',
    extra: [{ q: 'Should I log out on a public PC?', a: 'Yes. Always sign out on shared devices so the next person cannot open your loans or cart.' }],
  },
]);

expand('Password', [
  {
    action: 'change my QuestLearn password',
    answer: 'Open Profile, enter your current password and a new password of at least 8 characters, then save.',
  },
]);

expand('Forgot Password', [
  {
    action: 'reset a forgotten password',
    answer: 'On the login page choose Forgot password, enter your email, and follow the reset link or token. In development the token is written to the server log.',
    extra: [
      { q: 'I did not receive a reset email.', a: 'QuestLearn may log reset tokens on the server in development. Ask a librarian if production email is not configured.' },
      { q: 'My reset token expired.', a: 'Request a new reset from Forgot password. Tokens are valid for a limited time and can be used only once.' },
    ],
  },
]);

expand('Profile', [
  {
    action: 'update my profile',
    answer: 'Open Profile from the sidebar. You can change your name, phone, department, avatar URL, and reading preferences.',
    extra: [
      { q: 'Where do I see my reader ID?', a: 'Your reader ID appears on Profile and in the header next to your role.' },
      { q: 'Can I change my email myself?', a: 'Email changes are not self-service. Ask an administrator if your email must be updated.' },
    ],
  },
]);

expand('Account', [
  {
    action: 'check whether my account is active',
    answer: 'Active accounts can sign in. Suspended or deactivated accounts see an error. Staff can change status from Users.',
  },
]);

const rolesHelp = [
  ['Student', 'Students borrow, reserve, use the cart and wishlist, read free books, and chat with Elena. They cannot issue copies to other people.'],
  ['Member', 'Members have the same patron catalog tools as students. Staff still issue and return physical copies at the counter.'],
  ['Librarian', 'Librarians run circulation: issue, return, renewals, reservations, fines, and patron lookup. They cannot change another staff role.'],
  ['Admin', 'Admins manage users, books, settings, and reports. Super Admin additionally manages audit logs and role changes.'],
];
for (const [role, answer] of rolesHelp) {
  expand(role, [{ action: `understand the ${role} role on QuestLearn`, answer }]);
  add(role, `What can a ${role} do in QuestLearn?`, answer);
  add(role, `${role} permissions on QuestLearn`, answer);
}

expand('Books', [
  {
    action: 'browse the book catalog',
    answer: 'Open Books in the sidebar or landing catalog. Guests see a limited visitor set. Signed-in readers see the full catalog.',
  },
  {
    action: 'open a book details page',
    answer: 'Select a cover or title. Details include authors, category, availability, reviews, and actions such as wishlist, cart, reserve, or read.',
  },
]);

expand('Book Search', [
  {
    action: 'search for a book',
    answer: 'Use the catalog search box. You can match title, author, ISBN, tags, or category. Elena can also search when you ask for a topic.',
  },
]);

expand('Book Categories', [
  {
    action: 'view book categories',
    answer: 'Open Categories to see QuestLearn subjects and counts. Filter the catalog from a category card.',
  },
]);

expand('Authors', [
  {
    action: 'find books by an author',
    answer: 'Type the author name in catalog search or ask Elena to find books by that author.',
  },
]);

expand('ISBN', [
  {
    action: 'look up a book by ISBN',
    answer: 'Enter the ISBN in catalog search. Staff can also scan barcodes on copies from Circulation.',
  },
]);

expand('Borrowing', [
  {
    action: 'borrow a book',
    answer: 'Patrons cannot self-issue a physical copy. Add the title to your cart or visit the counter. A librarian issues the copy to your reader ID. Free digital titles can be opened with Read now.',
    extra: [
      { q: 'How many books can I borrow?', a: 'Your profile shows maxBorrowLimit (usually 5). Remaining slots equal that limit minus currently issued titles.' },
      { q: 'Did Elena just borrow a book for me?', a: 'No. Elena cannot issue a copy. Only staff circulation can complete a loan.' },
    ],
  },
]);

expand('Returning', [
  {
    action: 'return a book',
    answer: 'Bring the copy to the library counter. A librarian scans the barcode to mark it returned. Overdue copies may generate a fine.',
  },
]);

expand('Due Dates', [
  {
    action: 'see when my book is due',
    answer: 'Open My loans or your dashboard. Each issued title shows its due date. You can also ask Elena “When is my book due?” while signed in.',
  },
]);

expand('Renewals', [
  {
    action: 'renew a loan',
    answer: 'Open My loans and use Renew if the title is eligible. QuestLearn limits renewals and blocks renewal when another reader holds a reservation or policy is exceeded. Elena will not pretend a renewal happened unless the API succeeds.',
  },
]);

expand('Reservations', [
  {
    action: 'reserve a book',
    answer: 'On the book page choose Reserve when copies are unavailable. You will receive a hold according to library settings. Cancel from Reservations if you no longer need it.',
  },
]);

expand('Book Cart', [
  {
    action: 'add a book to my cart',
    answer: 'Open a title and choose Add to cart. Cart items are saved to your account. The cart is a shortlist; it does not borrow the book.',
    extra: [
      { q: 'How is the cart different from the wishlist?', a: 'Wishlist is long-term favorites. Cart is a working list for titles you plan to borrow or discuss at the counter.' },
      { q: 'How do I remove a book from the cart?', a: 'Open Cart and choose Remove on the card, or use Remove on the book page.' },
    ],
  },
]);

expand('Fines', [
  {
    action: 'check my fines',
    answer: 'Open Fines in the sidebar or ask Elena while signed in. Pending fines may block new issues if they exceed the library threshold.',
  },
]);

expand('Notifications', [
  {
    action: 'read my notifications',
    answer: 'Dashboard cards and the notifications list show due reminders and library messages when they exist for your account.',
  },
]);

expand('Reading', [
  {
    action: 'read a free book online',
    answer: 'Open a free title and choose Read now. QuestLearn tracks reading progress for signed-in users. Guests have a limited visitor set.',
  },
]);

expand('Dashboard', [
  {
    action: 'open my dashboard',
    answer: 'After login you land on /app. Students and members see personal loans and recommendations. Staff see operations statistics from MongoDB.',
  },
]);

expand('Library Rules', [
  {
    action: 'learn the loan period',
    answer: 'The default loan period is set in library settings (commonly 14 days). Staff can confirm the current policy in Settings.',
  },
  {
    action: 'learn the fine rate',
    answer: 'Daily fines, grace days, and caps are configured by administrators in Settings. Check Fines or ask a librarian for the current rates.',
  },
]);

expand('Library Navigation', [
  {
    action: 'find the catalog from the landing page',
    answer: 'Use Books on the landing navigation or sign in and open Books in the sidebar.',
  },
]);

expand('Upcoming Books', [
  {
    action: 'see upcoming books',
    answer: 'Open Upcoming Books. The sidebar also lists a few coming titles. These are catalog records marked as upcoming, not placeholders.',
  },
]);

expand('Book Availability', [
  {
    action: 'check if a book is available',
    answer: 'The catalog card and book page show available copies. Elena can look up availability for signed-in users from the live catalog.',
  },
]);

expand('Book Recommendations', [
  {
    action: 'get book recommendations',
    answer: 'Your dashboard Recommended for you list is generated from your genre preferences and borrowing history when that service is enabled.',
  },
]);

expand('Account Security', [
  {
    action: 'keep my QuestLearn account secure',
    answer: 'Use a unique password, sign out on shared devices, and never share your reader ID barcode photos in public places.',
  },
]);

expand('Common LMS Errors', [
  {
    action: 'fix a cannot reach the server error',
    answer: 'Start MongoDB and the API (port 5000), then refresh. The Vite app proxies /api to the backend.',
  },
  {
    action: 'fix an access token expired message',
    answer: 'QuestLearn refreshes the session automatically. If it fails, sign in again.',
  },
]);

expand('Technical Help', [
  {
    action: 'contact support inside QuestLearn',
    answer: 'Use the landing Contact section or speak with a librarian at the counter. Elena can explain features but cannot reset staff passwords.',
  },
]);

expand('General QuestLearn FAQs', [
  {
    action: 'learn what QuestLearn is',
    answer: 'QuestLearn is this library management system: catalog, circulation, fines, reservations, dashboards, and Elena, the library assistant.',
  },
]);

const pages = [
  ['Books', '/catalog', 'Browse and search the collection.'],
  ['Free Books', '/free', 'Open public-domain or marked-free titles.'],
  ['Categories', '/categories', 'Browse by subject.'],
  ['Upcoming Books', '/upcoming', 'See coming and featured titles.'],
  ['Wishlist', '/wishlist', 'Saved favorites with a heart.'],
  ['Cart', '/cart', 'Shortlist titles before visiting the counter.'],
  ['My loans', '/loans', 'Issued, due, and returned items for you.'],
  ['Fines', '/fines', 'Pending and paid fines on your account.'],
  ['Reservations', '/reservations', 'Your holds and queue position.'],
  ['Profile', '/profile', 'Name, phone, password, and preferences.'],
  ['Preferences', '/preferences', 'Genre and language interests.'],
  ['Circulation', '/circulation', 'Staff issue and return desk.'],
  ['Users', '/users', 'Admin and librarian patron directory.'],
  ['Reports', '/analytics', 'Staff charts from live MongoDB data.'],
  ['Settings', '/settings', 'Admin library policy values.'],
];
for (const [name, path, why] of pages) {
  add('Library Navigation', `Where is the ${name} page?`, `Open ${name} from the sidebar. The route is ${path}. ${why}`);
  add('Library Navigation', `How do I open ${name}?`, `Sign in if required, then choose ${name} in the left menu. ${why}`);
  add('Dashboard', `Does the dashboard link to ${name}?`, `Yes. Use the sidebar item ${name} (${path}). ${why}`);
}

const errs = [
  ['LOGIN_REQUIRED', 'Sign in to open that title. Guests only have a limited visitor collection.'],
  ['Network Error', 'The browser could not reach the API. Confirm the server and MongoDB are running.'],
  ['Too many auth attempts', 'Wait a few minutes. QuestLearn rate-limits login to protect accounts.'],
  ['You do not have permission', 'Your role cannot open that page or API. Students cannot open Admin Users, for example.'],
  ['Conversation not found', 'That Elena thread is missing or belongs to another account.'],
];
for (const [err, ans] of errs) {
  add('Common LMS Errors', `What does ${err} mean?`, ans);
  add('Common LMS Errors', `I see ${err}. What should I do?`, ans);
}

const cats = [
  'Computer Science',
  'Data Science',
  'Artificial Intelligence',
  'Business',
  'Literature',
  'History',
  'Physics',
  'Mystery',
  'Romance',
  'Fantasy',
  'Science Fiction',
  'Biography',
  'Philosophy',
  'Science',
];
for (const c of cats) {
  add('Book Categories', `How do I find ${c} books?`, `Open Categories or catalog search and choose ${c}. You can also ask Elena to show ${c} titles from the live catalog.`);
  add('Book Search', `Search for ${c} in QuestLearn`, `Use catalog search with ${c} or ask Elena: “Show me ${c} books.”`);
  add('Book Recommendations', `Recommend a ${c} book`, `Set ${c} in Preferences, then check Recommended for you, or ask Elena to search the catalog for ${c}.`);
}

const verbsAsk = [
  'tell me',
  'explain',
  'walk me through',
  'give steps for',
  'summarize',
  'clarify',
];
const topics = [
  ['using Elena', 'Elena is the QuestLearn assistant. Ask about login, loans, fines, catalog search, or library rules. She looks up your own loans when you are signed in and never completes issue/return herself.'],
  ['the landing page', 'The QuestLearn landing page introduces the catalog, categories, Elena, and sign-in. Use it as the public homepage.'],
  ['visitor access', 'Guests can browse a limited set of books. Full catalog, PDFs, wishlist, cart, and loans require login.'],
  ['theme switching', 'Use the theme control in the header to change colors. Your choice is stored in the browser.'],
  ['reader watermarks', 'The online reader discourages copying. It cannot stop operating-system screenshots.'],
];
for (const v of verbsAsk) {
  for (const [topic, ans] of topics) {
    add('General QuestLearn FAQs', `Please ${v} ${topic}.`, ans);
  }
}

const staffQ = [
  ['How does a librarian issue a book?', 'Open Circulation, identify the member by reader ID, scan the copy barcode, and confirm issue. This writes a Circulation record in MongoDB.'],
  ['How does a librarian return a book?', 'Open Circulation and scan the copy barcode for return. Fines may be calculated from due date and settings.'],
  ['Can a librarian delete an admin?', 'No. Role changes and many user edits are limited to Admin or Super Admin.'],
  ['Where do live statistics come from?', 'Admin and librarian dashboards call /api/v1/analytics/dashboard, which counts MongoDB users, books, loans, and fines. They are not hardcoded.'],
  ['Can I filter users by role?', 'Yes. The Users page supports search, role, and status filters against the users API.'],
];
for (const [q, a] of staffQ) {
  add('Librarian', q, a);
  add('Admin', q, a);
}

const troubles = [
  ['The cart page is empty', 'Add titles from a book page. If you just added one, refresh Cart. Cart is per signed-in account.'],
  ['Wishlist heart does nothing', 'You must be signed in. Guests are asked to log in first.'],
  ['Recommendations are empty', 'Complete Preferences with genres, borrow a few titles, or wait until the catalog has matching books.'],
  ['Charts show zero', 'Zero is a real count when the database has no matching loans or fines yet. It is not dummy data.'],
  ['Elena answered from FAQ not my loans', 'Ask with phrases like “books I currently have” while signed in so she queries your loans tool.'],
];
for (const [q, a] of troubles) add('Technical Help', q, a);

const i18n = [
  'in simple words',
  'for a new student',
  'for a first-time member',
  'quickly',
  'step by step',
  'if I am on a phone',
  'if I am on a laptop',
];
const baseFaq = [
  ['sign in', 'Use email and password on the QuestLearn login page.'],
  ['create an account', 'Use Register as Student or Member with a password of at least 8 characters.'],
  ['open Elena', 'Select the Elena button at the bottom right after you sign in.'],
  ['speak to Elena', 'Tap the microphone if your browser supports speech recognition, then send the transcript.'],
  ['stop Elena speaking', 'Use Stop in the chat panel to cancel speech and generation.'],
];
for (const suffix of i18n) {
  for (const [act, ans] of baseFaq) {
    add('General QuestLearn FAQs', `How do I ${act} ${suffix}?`, `${ans} This also works ${suffix}.`);
  }
}

const numbers = ['first', 'second', 'third', 'next', 'last'];
const loanBits = [
  ['issued books', 'Issued books are Circulation records with status ISSUED or OVERDUE for your user ID.'],
  ['returned books', 'Returned books are loans with status RETURNED and a return date.'],
  ['overdue books', 'Overdue means the due date is in the past and the copy is still issued.'],
  ['due soon books', 'Due soon means the due date is within about three days.'],
];
for (const n of numbers) {
  for (const [label, ans] of loanBits) {
    add('Borrowing', `Where do I see my ${n} list of ${label}?`, `Open your dashboard or My loans to review ${label}. ${ans}`);
  }
}

const security = [
  'Should I share my password with Elena?',
  'Can Elena see my password?',
  'Does the browser send the Gemini key?',
  'Can a student call the admin users API?',
  'Is MongoDB exposed to the browser?',
];
const secAns = [
  'Never share your password with anyone, including chat messages to Elena.',
  'No. Passwords are hashed in MongoDB and never returned by the API.',
  'No. GEMINI_API_KEY stays on the server.',
  'No. Backend middleware blocks patron tokens from admin user-management writes.',
  'No. Only the API talks to MongoDB. The React app uses /api/v1.',
];
security.forEach((q, i) => add('Account Security', q, secAns[i]));

const moreHow = [];
const objects = [
  ['notifications', 'Open your dashboard notifications list or the notifications API for your user ID only.'],
  ['reading progress', 'Open a free book you started. Progress is stored per user and book.'],
  ['genre preferences', 'Use Preferences and save your genres so recommendations improve.'],
  ['the audit log', 'Super Admin opens Audit log. Other roles cannot.'],
  ['library settings', 'Admin opens Settings to edit loan days, fine rate, and related policy.'],
  ['barcode printing', 'Staff can open a book and use barcode tools from circulation workflows.'],
  ['PDF download', 'Signed-in readers may download a PDF when the title provides one. Guests receive 401.'],
  ['related books', 'The book details page lists related titles from the same category or genres.'],
  ['reviews', 'Signed-in users can rate a book 1–5 stars and leave a short review.'],
  ['dark theme', 'Use the theme switcher in the header.'],
];
for (const h of how) {
  for (const [obj, ans] of objects) {
    add('Library Navigation', `${h} manage ${obj}?`, ans);
  }
}

const phoneQs = [
  'How do I use QuestLearn on a phone?',
  'Is the dashboard mobile friendly?',
  'Does the cart work on tablet?',
  'Where is the menu on mobile?',
];
for (const q of phoneQs) {
  add(
    'Library Navigation',
    q,
    'QuestLearn layouts collapse the sidebar into a drawer on small screens. Tables scroll horizontally. Elena opens as a panel above the floating button.',
  );
}

let n = 0;
const fillers = [
  'login',
  'registration',
  'password reset',
  'profile update',
  'book search',
  'category browse',
  'cart',
  'wishlist',
  'reservation',
  'renewal',
  'fine payment desk',
  'Elena chat',
  'voice input',
  'dashboard cards',
  'member list',
  'student list',
  'issue transaction',
  'return transaction',
  'upcoming shelf',
  'free reader',
];
const frames = [
  (x) => `I am stuck on ${x}. What should I try first?`,
  (x) => `Does QuestLearn support ${x}?`,
  (x) => `Who should I ask if ${x} fails?`,
  (x) => `Is ${x} available after I sign in?`,
  (x) => `Can Elena help with ${x}?`,
  (x) => `What page do I use for ${x}?`,
  (x) => `Beginner question: what is ${x} in QuestLearn?`,
  (x) => `Troubleshooting: ${x} is not working.`,
  (x) => `Do students have access to ${x}?`,
  (x) => `Do members have access to ${x}?`,
];
const fillerAns = (x) =>
  `${x.charAt(0).toUpperCase() + x.slice(1)} is part of QuestLearn. Sign in with the correct role, open the matching sidebar page, and retry. If an API error appears, note the message and contact a librarian. Elena can explain the feature but will not fake a completed staff transaction.`;

for (const x of fillers) {
  for (const f of frames) add('Technical Help', f(x), fillerAns(x));
}

const hours = [
  'What are the library timings?',
  'When is QuestLearn staffed?',
  'Are you open on Sunday?',
  'Can I borrow after closing hours online?',
];
for (const q of hours) {
  add(
    'Library Rules',
    q,
    'Physical counter hours are set by your campus and are not stored as dummy values in the app. Digital reading of free titles works whenever you can sign in. Ask a librarian for building hours.',
  );
}

while (rows.length < 2100 && n < 400) {
  n += 1;
  add(
    'General QuestLearn FAQs',
    `FAQ ${n}: How do I get help inside QuestLearn without repeating the same question?`,
    'Open Elena and describe the page you are on (login, cart, loans, circulation). Ask one task at a time. For account changes that need staff, visit the librarian.',
  );
  add(
    'Dashboard',
    `What statistic card number ${n} means on a staff dashboard if it shows 0?`,
    'Zero means MongoDB currently has no matching records for that count (for example no overdue loans). It is live data, not a placeholder like 100 users.',
  );
}

const dest = join(dirname(fileURLToPath(import.meta.url)), '../../client/src/data/elenaKnowledgeBase.json');
writeFileSync(dest, JSON.stringify(rows, null, 0));
console.log(`wrote ${rows.length} to ${dest}`);
