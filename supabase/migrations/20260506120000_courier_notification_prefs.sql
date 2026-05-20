-- Phase 6: courier task notification preference + optional native push token slots (FCM/APNs later).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_courier_open_tasks boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_notification_token text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_notification_platform text;

COMMENT ON COLUMN public.profiles.notify_courier_open_tasks IS 'When true, user opts in to alerts for new open courier tasks / assignments (in-app + push when wired).';
COMMENT ON COLUMN public.profiles.push_notification_token IS 'FCM or APNs device token; server-side only for sends — never expose to clients in API responses.';
COMMENT ON COLUMN public.profiles.push_notification_platform IS 'fcm | apns — set when native app registers; optional.';
