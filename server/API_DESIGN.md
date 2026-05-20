# community-marketplace API Design (Supabase)

Base URL: `http://localhost:4000/api/v1`

## Authentication

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/google`
- `GET /auth/me`
- `PATCH /auth/me`

Auth is backed by Supabase Auth access tokens.

## Active endpoints

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/google`
- `GET /auth/me`
- `PATCH /auth/me`

## Data layer

- Supabase table: `profiles`
- Schema + RLS policies are maintained in `server/db/schema.sql`
