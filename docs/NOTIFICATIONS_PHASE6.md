# Phase 6 — Courier task notifications

## Preference

- **Database:** `profiles.notify_courier_open_tasks` (boolean, default `true`).
- **REST / JSON:** `allowCourierTaskNotifications` on `GET/PATCH /me/courier-presence` and on `GET/PATCH /auth/me` (via `profileToClient` / `userToClient`).
- **UI:** Community courier tab — “Allow notifications for new tasks / assignments.”

Toggling availability or suggested rate does **not** require changing this preference. Partial `PATCH /me/courier-presence` bodies are supported (e.g. only `allowCourierTaskNotifications`).

## Push tokens (FCM / APNs — later)

- **Database:** `profiles.push_notification_token` (text), `profiles.push_notification_platform` (`fcm` | `apns`).
- **Client writes:** `PATCH /auth/me` or `PATCH /me/courier-presence` with `pushNotificationToken` and optional `pushNotificationPlatform`. Clearing the token clears the platform.
- **Client reads:** Responses expose **`pushNotificationRegistered`** (boolean) and **`pushNotificationPlatform`** (`fcm` | `apns` | null). The raw token is **never** returned in JSON.

### Sending rules (workers / cron)

Send a push about new open tasks only when:

1. `notify_courier_open_tasks` is true, **and**
2. `push_notification_token` is non-empty, **and**
3. `push_notification_platform` is `fcm` or `apns`.

Apply the same checks server-side for any future notification pipeline.

## Migrations

Apply `supabase/migrations/20260506120000_courier_notification_prefs.sql` (or equivalent) before relying on persistence. Until then, the API may omit saving preference/token columns and return a `note` on degraded responses.
