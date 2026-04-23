# Supabase Schema - community-marketplace

This service uses Supabase (PostgreSQL + Auth). MongoDB is not used.

## Source of truth

- Apply schema from `server/db/schema.sql` in Supabase SQL Editor.

## Core tables

- `profiles` (linked to `auth.users`)

## Security model

- Row-level security is enabled on all application tables.
- Policies are defined in `server/db/schema.sql`.

## Notes

- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed in the client.
- If you are migrating an existing environment, run the schema first before using API endpoints.
