# community-marketplace server

## Environment

Required environment variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional feature variable:

- `GOOGLE_CLIENT_ID` (required for `/api/v1/auth/google`)

### Email confirmation (Supabase Auth)

- In the Supabase dashboard: **Authentication → Providers → Email** — enable **Confirm email**.
- Set **Authentication → URL Configuration** with your site URL and redirect URLs; match **`AUTH_EMAIL_REDIRECT_URL`** below (e.g. `https://yourapp.com` or `http://localhost:5173` for local dev).
- `AUTH_EMAIL_REDIRECT_URL` — used in the confirmation and resend emails (optional but recommended).

### Phone verification (SMS)

- Run migration `20260513120000_profiles_phone_verification.sql` (adds `profiles.phone_verified_at` and `phone_verification_challenges`).
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and either `TWILIO_MESSAGING_SERVICE_SID` (recommended) or `TWILIO_FROM_NUMBER` (E.164).
- `OTP_PEPPER` — optional secret for OTP hashes; **set explicitly in production** (defaults to service role in dev only via code fallback).

## Security model

- This API uses `SUPABASE_SERVICE_ROLE_KEY` in `src/lib/supabase.js`.
- Service-role requests bypass Supabase RLS; route middleware and controller checks are the enforcement boundary.
- Keep service-role keys server-only and never expose them in client bundles.

## Schema source of truth

- Use `supabase/migrations/*` as the canonical schema history.
- `server/db/schema.sql` is legacy reference only and should not be used to provision production schema.
