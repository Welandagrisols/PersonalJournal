-- Pages Supabase schema
-- Run this in Supabase SQL Editor.
-- Enable email/password authentication in Authentication -> Providers.

create table if not exists public.journal_entries (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  type text not null,
  title text not null default '',
  body text not null default '',
  mood text not null default '',
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  is_favorite boolean not null default false,
  gratitude_items jsonb,
  prompt_question text
);

create table if not exists public.journal_settings (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  user_name text not null default '',
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  updated_at timestamptz not null default now()
);

create table if not exists public.vault_photos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  storage_path text,
  local_uri text,
  filename text not null,
  created_at timestamptz not null,
  note text not null default '',
  width integer,
  height integer
);

alter table public.journal_entries enable row level security;
alter table public.journal_settings enable row level security;
alter table public.vault_photos enable row level security;

drop policy if exists "journal entries are private" on public.journal_entries;
create policy "journal entries are private"
  on public.journal_entries for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "journal settings are private" on public.journal_settings;
create policy "journal settings are private"
  on public.journal_settings for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "vault photos are private" on public.vault_photos;
create policy "vault photos are private"
  on public.vault_photos for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('vault', 'vault', false)
on conflict (id) do nothing;

drop policy if exists "vault files are private" on storage.objects;
create policy "vault files are private"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'vault'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'vault'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
