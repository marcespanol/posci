-- Enable extension for UUID generation if needed.
create extension if not exists "pgcrypto";

create table if not exists public.posters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  doc jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(doc) = 'object')
);

create table if not exists public.poster_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  poster_id uuid not null references public.posters(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  unique (poster_id, storage_path)
);

create index if not exists posters_user_updated_idx
  on public.posters (user_id, updated_at desc);

create index if not exists poster_assets_poster_idx
  on public.poster_assets (poster_id);

create index if not exists poster_assets_user_idx
  on public.poster_assets (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posters_set_updated_at on public.posters;
create trigger posters_set_updated_at
before update on public.posters
for each row
execute function public.set_updated_at();

alter table public.posters enable row level security;
alter table public.poster_assets enable row level security;

-- Posters: owner-only CRUD
create policy "posters_select_own"
on public.posters
for select
using (auth.uid() = user_id);

create policy "posters_insert_own"
on public.posters
for insert
with check (auth.uid() = user_id);

create policy "posters_update_own"
on public.posters
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "posters_delete_own"
on public.posters
for delete
using (auth.uid() = user_id);

-- Poster assets: owner-only CRUD
create policy "poster_assets_select_own"
on public.poster_assets
for select
using (auth.uid() = user_id);

create policy "poster_assets_insert_own"
on public.poster_assets
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.posters p
    where p.id = poster_id
      and p.user_id = auth.uid()
  )
);

create policy "poster_assets_update_own"
on public.poster_assets
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "poster_assets_delete_own"
on public.poster_assets
for delete
using (auth.uid() = user_id);

-- Storage bucket strategy
-- 1) Create bucket in Supabase dashboard: poster-assets (private)
-- 2) Recommended object path format:
--    poster-assets/{userId}/{posterId}/{assetId}-{filename}
-- 3) Add storage policies in dashboard SQL editor:
--    Allow authenticated users to manage only objects under their own userId prefix.
