# CPR Marketplace

Professional minimalist community marketplace built with Next.js on the frontend and a separate Express + PostgreSQL backend.

## Stack

- Frontend: Next.js 16, React 19, Tailwind CSS 4
- Backend: Express 5, JWT auth, PostgreSQL (`pg`)
- Database: PostgreSQL migration scripts under `backend/db/migrations`

## Local Development

### 1) Frontend

```bash
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

### 2) Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend runs at `http://localhost:4000`.

### 3) Database

Create a PostgreSQL database named `cpr_marketplace`, then run:

```sql
-- run in order
\i backend/db/migrations/001_init.sql
\i backend/db/migrations/002_seed.sql
```

## Environment Variables

Create root `.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Create `backend/.env` from `backend/.env.example`.

## Notes

- Frontend keeps local fallback behavior so development remains usable if backend is offline.
- API migration includes auth, product creation, checkout order creation, and initial marketplace snapshot hydration.
