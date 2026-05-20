alter table public.listings
  add column if not exists service_meta jsonb;

create index if not exists listings_service_meta_gin_idx
  on public.listings
  using gin (service_meta);
