# community-marketplace server

## Environment

Required environment variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional feature variable:

- `GOOGLE_CLIENT_ID` (required for `/api/v1/auth/google`)

## Security model

- This API uses `SUPABASE_SERVICE_ROLE_KEY` in `src/lib/supabase.js`.
- Service-role requests bypass Supabase RLS; route middleware and controller checks are the enforcement boundary.
- Keep service-role keys server-only and never expose them in client bundles.

## Schema source of truth

- Use `supabase/migrations/*` as the canonical schema history.
- `server/db/schema.sql` is legacy reference only and should not be used to provision production schema.
