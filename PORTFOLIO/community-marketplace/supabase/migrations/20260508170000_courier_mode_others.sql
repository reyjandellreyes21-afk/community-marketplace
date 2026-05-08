-- Extend courier assignment transport modes with 'others' (walk / run / bike / others).

ALTER TABLE public.courier_assignments DROP CONSTRAINT IF EXISTS delivery_bids_mode_check;
ALTER TABLE public.courier_assignments DROP CONSTRAINT IF EXISTS courier_assignments_mode_check;

ALTER TABLE public.courier_assignments
  ADD CONSTRAINT courier_assignments_mode_check
  CHECK (mode IN ('walk', 'run', 'bike', 'others'));
