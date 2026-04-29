-- Performance + search helpers for marketplace browse APIs.
-- Safe to run repeatedly.

create extension if not exists pg_trgm;

-- Accelerate list listings text search (q param).
create index if not exists listings_title_trgm_idx
  on public.listings using gin (title gin_trgm_ops);

create index if not exists listings_description_trgm_idx
  on public.listings using gin (description gin_trgm_ops);

-- Support common browse/order path filters and sort.
create index if not exists listings_active_created_idx
  on public.listings (status, created_at desc);

create index if not exists listings_active_community_created_idx
  on public.listings (status, community_id, created_at desc)
  where community_id is not null;

create index if not exists listings_active_vertical_sub_created_idx
  on public.listings (status, vertical_id, sub_id, created_at desc);

create index if not exists orders_buyer_created_idx
  on public.orders (buyer_id, created_at desc);

create index if not exists orders_seller_created_idx
  on public.orders (seller_id, created_at desc);

-- Grouped SQL for community member counts (avoids loading all profiles into API memory).
create or replace function public.community_member_counts()
returns table (community_id uuid, member_count bigint)
language sql
stable
as $$
  select p.community_id, count(*)::bigint as member_count
  from public.profiles p
  where p.community_id is not null
  group by p.community_id
$$;

grant execute on function public.community_member_counts() to authenticated, anon, service_role;
