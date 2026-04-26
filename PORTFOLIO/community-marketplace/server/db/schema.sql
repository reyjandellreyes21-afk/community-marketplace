-- community-marketplace v2 schema foundation
-- Run in Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_name text not null default '',
  middle_name text not null default '',
  last_name text not null default '',
  username text not null default '' unique,
  age integer,
  accepted_terms boolean not null default false,
  accepted_terms_at timestamptz,
  avatar_url text not null default '',
  phone text not null default '',
  birthday date,
  address text not null default '',
  address_url text not null default '',
  gender text not null default '',
  facebook_url text not null default '',
  twitter_url text not null default '',
  instagram_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_phone_unique_non_empty_idx
  on public.profiles (phone)
  where nullif(trim(phone), '') is not null;

create unique index if not exists profiles_phone_mobile10_unique_idx
  on public.profiles ((right(regexp_replace(phone, '\D', '', 'g'), 10)))
  where length(regexp_replace(phone, '\D', '', 'g')) >= 10;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop table if exists public.listings cascade;
drop table if exists public.communities cascade;

drop table if exists public.listings_v2 cascade;
drop table if exists public.communities_v2 cascade;

create table public.communities_v2 (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  name varchar(120) not null,
  slug varchar(80) not null unique,
  description text not null default '',
  cover_image_url text not null default '',
  visibility varchar(16) not null default 'public' check (visibility in ('public', 'private')),
  status varchar(16) not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listings_v2 (
  id uuid primary key default gen_random_uuid(),
  seller_profile_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid references public.communities_v2(id) on delete set null,
  title varchar(200) not null,
  description text not null,
  price numeric(10, 2) not null check (price >= 0),
  currency char(3) not null default 'PHP',
  category varchar(120) not null,
  item_condition varchar(16) not null default 'good' check (item_condition in ('new', 'like_new', 'good', 'fair', 'poor')),
  location_text varchar(255) not null default '',
  status varchar(16) not null default 'draft' check (status in ('draft', 'published', 'sold', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_communities_v2_owner_profile_id on public.communities_v2(owner_profile_id);
create index idx_communities_v2_status on public.communities_v2(status);
create index idx_listings_v2_seller_profile_id on public.listings_v2(seller_profile_id);
create index idx_listings_v2_community_id on public.listings_v2(community_id);
create index idx_listings_v2_category on public.listings_v2(category);
create index idx_listings_v2_status_created_at on public.listings_v2(status, created_at desc);

drop trigger if exists trg_communities_v2_updated_at on public.communities_v2;
create trigger trg_communities_v2_updated_at
before update on public.communities_v2
for each row
execute function public.set_updated_at();

drop trigger if exists trg_listings_v2_updated_at on public.listings_v2;
create trigger trg_listings_v2_updated_at
before update on public.listings_v2
for each row
execute function public.set_updated_at();
