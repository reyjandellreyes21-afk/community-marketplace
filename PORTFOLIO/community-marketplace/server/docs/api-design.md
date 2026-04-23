# community-marketplace API v1

This backend is Supabase-based and does not use MongoDB.

## Health

- `GET /health`

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/google`
- `GET /auth/me`
- `PATCH /auth/me`

## Active endpoints

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/google`
- `GET /auth/me`
- `PATCH /auth/me`

## Storage

- Supabase schema: `server/db/schema.sql` (`profiles` table only)
