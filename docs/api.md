# API v1

Base: `/api/v1` · JSON · credentials (refresh cookie)

## Auth

- `POST /auth/register` `{ name, email, password, department }`
- `POST /auth/login` `{ email, password }` → `{ accessToken, user }`
- `POST /auth/refresh` cookie `refreshToken`
- `POST /auth/logout` Bearer
- `GET|PATCH /auth/me`
- `POST /auth/forgot-password` `{ email }`
- `POST /auth/reset-password` `{ token, password }`

## Catalog

- `GET /books?q&category&page`
- `GET /books/:id`
- `POST /books` ADMIN `{ ...fields, initialCopies }`
- `POST /books/:id/copies`
- `GET /books/barcode/:barcode` staff

## Circulation

- `POST /circulation/issue` `{ userId, barcode|copyId }`
- `POST /circulation/return` `{ barcode|copyId }`
- `POST /circulation/renew/:id`
- `GET /circulation/loans` · `GET /circulation/loans/me`
- `GET /circulation/today`
- `POST /circulation/reservations` `{ bookId }`
- `GET /circulation/reservations`

## Fines

- `GET /fines`
- `POST /fines/:id/pay` `{ paymentMethod: CASH|CARD|UPI|ONLINE }`
- `POST /fines/:id/waive` `{ reason }`

## AI

- `POST /ai/chat` `{ message }` → tool-sandboxed copilot
- `POST /ai/nl-query` ADMIN `{ question }`
- `POST /ai/recommend`
- `GET /ai/insights/:bookId`
- `POST /ai/ocr` `{ imageBase64, mimeType }`
- `GET /ai/report`

Tools allowed: `searchBooks`, `checkAvailability`, `getUserLoans`.
