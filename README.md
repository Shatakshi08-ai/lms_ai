# Aether Library LMS

Production-oriented MERN library platform with RBAC, transactional circulation, and a sandboxed AI tool layer.

## Stack

- **Client**: React 18, Vite, Ant Design v5, Tailwind, TanStack Query, Recharts, Web Speech API
- **Server**: Node.js (ESM), Express, Mongoose, Helmet, CORS, rate limits, Winston
- **AI**: Provider abstraction (OpenAI / Gemini / Anthropic / mock) + allowlisted tools only

## Quick start

```bash
# 1. MongoDB must be running locally (or set MONGODB_URI)
copy server\.env.example server\.env

npm install
npm run install:all
npm run seed
npm run dev
```

- API: `http://localhost:5000/api/v1/health`
- UI: `http://localhost:5173`

### Demo accounts (password `Password123!`)

| Role | Email |
| --- | --- |
| Super Admin | superadmin@library.com |
| Admin | admin@library.com |
| Librarian | librarian@library.com |
| Student | student@library.com |

Student reader ID example: `LIB-2026-8942`. Copy barcodes start at `BC-100001`.

## Tests

```bash
npm test
```

## AI sandbox

All database access from the copilot goes through `/server/src/ai/toolSandbox.js`. Natural-language analytics may **only** select frozen templates in `/server/src/ai/nlAnalytics.js` — the model never authors Mongoose pipelines.

Set `AI_PROVIDER=openai|gemini|anthropic|mock` and the matching API key in `server/.env`. Without keys, the mock provider still drives the UI.

## API (v1)

| Area | Prefix |
| --- | --- |
| Auth | `/api/v1/auth` |
| Users | `/api/v1/users` |
| Books | `/api/v1/books` |
| Circulation | `/api/v1/circulation` |
| Fines | `/api/v1/fines` |
| Analytics | `/api/v1/analytics` |
| AI | `/api/v1/ai` |

See `docs/api.md` for route-level notes.
