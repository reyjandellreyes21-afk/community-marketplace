-- Supabase schema for community-marketplace
-- Run in Supabase SQL editor after enabling pgcrypto.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_name text not null default '',
  middle_name text not null default '',
  last_name text not null default '',
  username text not null default '' unique,
  country text not null default '',
  age integer,
  accepted_terms boolean not null default false,
  accepted_terms_at timestamptz,
  avatar_url text not null default '',
  phone text not null default '',
  birthday date,
  address text not null default '',
  address_url text not null default '',
  education text not null default '',
  gender text not null default '',
  facebook_url text not null default '',
  twitter_url text not null default '',
  instagram_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Marketplace tables (listings, orders, communities, …) live in `supabase/migrations/`.
