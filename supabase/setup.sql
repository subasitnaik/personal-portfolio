-- Supabase schema bootstrap for personal-portfolio
-- Run inside the SQL Editor or the supabase CLI.

-- Ensure required extension for UUID generation.
create extension if not exists "pgcrypto";

-- Helper trigger to keep updated_at current.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create projects table (id, timestamps managed by Supabase).
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text,
  summary text,
  tech_stack text,
  launched_on text,
  cta_url text,
  is_featured boolean not null default false,
  thumbnail_url text,
  gallery_urls text[] not null default '{}',
  gallery_interval integer not null default 4500
);

-- Maintain updated_at automatically.
create trigger update_projects_updated_at
before update on public.projects
for each row execute procedure public.set_updated_at();

-- Optional: fast filter for featured projects.
create index if not exists idx_projects_is_featured on public.projects (is_featured);

-- Enable Row Level Security.
alter table public.projects enable row level security;

drop policy if exists "Projects are viewable by everyone" on public.projects;
create policy "Projects are viewable by everyone"
on public.projects
for select
using (true);

-- Allow authenticated users to insert/update/delete projects.
drop policy if exists "Projects write access for authenticated users" on public.projects;
create policy "Projects write access for authenticated users"
on public.projects
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

-- Storage bucket for project images (public)
insert into storage.buckets (id, name, public)
values ('project-images', 'project-images', true)
on conflict (id) do nothing;

-- Storage policy: allow public read access.
drop policy if exists "Public read project images" on storage.objects;
create policy "Public read project images"
on storage.objects
for select
using (bucket_id = 'project-images');

-- Storage policy: authenticated users manage objects.
drop policy if exists "Authenticated manage project images" on storage.objects;
create policy "Authenticated manage project images"
on storage.objects
for all
using (bucket_id = 'project-images' and auth.role() = 'authenticated')
with check (bucket_id = 'project-images' and auth.role() = 'authenticated');

-- Seed admin user (replace placeholders, run once; requires service role).
-- insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at)
-- values (
--   gen_random_uuid(),
--   '00000000-0000-0000-0000-000000000000',
--   'admin@example.com',
--   crypt('SuperSecretPassword', gen_salt('bf')),
--   now()
-- );

