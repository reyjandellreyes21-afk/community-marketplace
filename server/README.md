# community-marketplace server

## Local development

1. Copy `server/.env.example` → `server/.env` and set Supabase keys.
2. `npm run dev` in `server/` — API at **http://localhost:4000** (or `PORT`).
3. `npm run dev` in `client/` — Vite at **http://localhost:5173**; `/api` is proxied to the API.
4. For email confirmation, set **`AUTH_EMAIL_REDIRECT_URL=http://localhost:5173`** and the same URL in Supabase **Authentication → URL Configuration**.

See `client/.env.example` for optional client overrides (`VITE_API_URL` is usually not needed locally).

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

### OpenStreetMap geocoding (Nominatim proxy)

The client must **not** call Nominatim directly. Use these API routes instead:

- `GET /api/v1/geo/search?q=...&limit=5` — forward geocode (Philippines-biased query suffix).
- `GET /api/v1/geo/reverse?lat=...&lng=...` — reverse geocode for map pin drops.

Environment:

- `NOMINATIM_BASE_URL` — default `https://nominatim.openstreetmap.org` (or your self-hosted instance).
- `NOMINATIM_USER_AGENT` — **required in production** per [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) (include app name and contact email).

Responses are cached in memory (~24h) and rate-limited (30 requests/minute per IP). Map tiles in the client use OSM raster tiles; show **© OpenStreetMap contributors** on every map.

Courier turn-by-turn routing (OSRM) is not implemented yet — see `docs/OSM_TESTING.md`.

## Security model

- This API uses `SUPABASE_SERVICE_ROLE_KEY` in `src/lib/supabase.js`.
- Service-role requests bypass Supabase RLS; route middleware and controller checks are the enforcement boundary.
- Keep service-role keys server-only and never expose them in client bundles.

## Schema source of truth

- Use `supabase/migrations/*` as the canonical schema history.
- `server/db/schema.sql` is legacy reference only and should not be used to provision production schema.
