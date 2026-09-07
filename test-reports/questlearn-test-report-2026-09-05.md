# QuestLearn LMS test report — 2026-09-05

Executed from the repo root with `npm test`.

## Counts

| | Server (node:test + Supertest) | Client (Vitest + RTL) | Combined |
|---|---:|---:|---:|
| Total | 66 | 23 | 89 |
| Passed | 66 | 23 | 89 |
| Failed | 0 | 0 | 0 |
| Skipped | 0 | 0 | 0 |

Pass percentage of executed tests: **100%**

Machine-readable client JSON: `test-reports/client-vitest.json`

Database: isolated MongoDB `lms_ai_test` (dropped per integration file). Production catalog/users are not used.

## Feature status

| Feature | Status |
|---|---|
| Authentication | PASS |
| Admin dashboard | PASS |
| Librarian dashboard | PASS |
| Member dashboard | PASS |
| Student dashboard | PASS |
| Books | PASS |
| Book cart | PASS |
| Borrowing | PASS |
| Returning | PASS |
| Reservations | PASS |
| Elena chatbot | PASS |
| Voice assistant | PASS (mocked browser APIs) |
| Responsive UI | BLOCKED (layout overflow) / CSS tests PASS |

## Fixes applied while making tests pass

- Skip rate limiters when `NODE_ENV=test`.
- Register rejects invalid emails (400).
- Map Mongoose `CastError` / `ValidationError` / duplicate key to 400/409.
- Elena unknown questions return a safe LMS fallback instead of 502/503.
- Elena matcher allows single-token questions and synonyms (reserve/reservation, admin/administrator).
- Voice STT resolves `SpeechRecognition` at start time (not only at module load).
- Cart cover images expose `alt={title}` for accessibility and UI tests.

## Next task

Add Playwright coverage for real viewports (desktop/tablet/mobile) on login, register, dashboards, and cart so Responsive UI can move from BLOCKED to PASS.
