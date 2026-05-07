-- Track whether buyer and/or seller suggested this courier (pending invitation).
-- Both can be true when each party independently picks the same courier.

ALTER TABLE public.courier_assignments
  ADD COLUMN IF NOT EXISTS invited_by_buyer boolean NOT NULL DEFAULT false;

ALTER TABLE public.courier_assignments
  ADD COLUMN IF NOT EXISTS invited_by_seller boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.courier_assignments.invited_by_buyer IS 'True if the buyer suggested this courier for the pending invitation.';
COMMENT ON COLUMN public.courier_assignments.invited_by_seller IS 'True if the seller suggested this courier for the pending invitation.';

NOTIFY pgrst, 'reload schema';
