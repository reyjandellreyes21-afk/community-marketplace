# OpenStreetMap integration — manual testing

LinkMart geocoding goes through the Express API (`/api/v1/geo/*`). Map **tiles** load from the CARTO/OSM CDN in the browser by default; optional same-origin proxy at `/api/v1/geo/tiles/{z}/{x}/{y}.png` if you set `VITE_MAP_TILES=api`. Attribution appears under every map.

## Prerequisites

1. **Server** (from `server/`):
   - `NOMINATIM_USER_AGENT=LinkMart/1.0 (your-email@example.com)` — required for Nominatim policy.
   - Optional: `NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org`
2. **Client**: `npm run dev` in `client/` (Vite default: `http://localhost:5173`)
3. **Server**: `npm run dev` in `server/` (API default: `http://localhost:4000`, override with `PORT`)
4. Listings in Supabase should already have `lat`, `lng`, `city_label` columns (no migration needed for MVP).

## 1. Geocode API (server)

```bash
# Search (Philippines bias applied server-side)
curl -s "http://localhost:4000/api/v1/geo/search?q=Barangay%20San%20Antonio,%20Quezon%20City" | jq .

# Reverse
curl -s "http://localhost:4000/api/v1/geo/reverse?lat=14.6760&lng=121.0437" | jq .
```

Expect `results[]` / `result` with `lat`, `lng`, `cityLabel`, `displayName`. Repeated identical queries should be fast (in-memory cache). More than ~30 requests/min/IP should return rate-limit errors.

## 2. Publish product location (profile address)

1. Sign in → ensure **Profile** has city and province (and barangay/community if possible).
2. **My listings** → create or edit a **product** (not service-only flow). There is no map picker on upload; meet-up location is set from your profile on publish.
3. Publish. Coordinates come from profile default pin, geocoded profile address, or community fallback.
4. Open the listing in product inspect → **Meet-up location** shows the static map when geocoding succeeded.

## 3. Near me browse

1. Open a **community shop** (or global community browse).
2. Tap **Near me** (allow location when prompted).
3. Listings with `lat`/`lng` within the default **8 km** radius should appear; others drop out.
4. Turn **Near me** off — full community list returns.
5. Optional: in **Profile** edit, set the map pin under your address and **Save changes**; if GPS is denied, enabling Near me can fall back to that pin.

## 4. Profile address map pin (optional)

1. Profile → edit → fill address fields → **Pin your location on the map** should auto-center from province/city/barangay when you have no saved pin yet (or use search, tap map, **Use my location**, or **Center on my address**).
2. **Save changes** — same `PATCH /auth/me` as the rest of the profile; stores `defaultLat` / `defaultLng` and clears legacy `addressUrl`.

## 5. Regression checks

- [ ] No request from the browser to `nominatim.openstreetmap.org` (geocode via your API only).
- [ ] Map tiles load from `/api/v1/geo/tiles/...` (200 PNG), not blank blue grid.
- [ ] OSM attribution visible on picker and product detail maps.
- [ ] `npm test` in `server/` (includes `geoSchemas.test.js`).
- [ ] Client build: `npm run build` in `client/`.

## Phase 2 (not in MVP)

Courier routing via OSRM is documented in `server/README.md` only — not implemented.

## Supabase

Usually **no manual steps** if `listings.lat`, `listings.lng`, `listings.city_label`, and `profiles.default_lat`, `profiles.default_lng` already exist.
