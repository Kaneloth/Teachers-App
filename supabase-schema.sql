-- EduCross Supabase Schema
-- Run this in the Supabase SQL editor to set up all required tables

-- ============================================================
-- EDUCATORS TABLE
-- ============================================================
create table if not exists public.educators (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references auth.users(id) on delete cascade not null,
  full_name text not null,
  email text,
  phone text,
  bio text,
  sace_number text,
  avatar_url text,

  -- School / location
  current_school text,
  current_province text,
  current_district text,

  -- Teaching details
  phase text,
  subjects text[],
  years_experience integer,

  -- Transfer preferences
  preferred_provinces text[],
  available_from date,
  is_actively_looking boolean default false,

  -- Verification
  is_sace_verified boolean default false,

  -- Admin
  account_status text default 'active',

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.educators enable row level security;

create policy "Educators are publicly readable"
  on public.educators for select
  using (true);

create policy "Users can insert their own educator profile"
  on public.educators for insert
  with check (auth.uid() = created_by_id);

create policy "Users can update their own educator profile"
  on public.educators for update
  using (auth.uid() = created_by_id);

create policy "Admins can update any educator profile"
  on public.educators for update
  using ((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true);

create policy "Users can delete their own educator profile"
  on public.educators for delete
  using (auth.uid() = created_by_id);

-- Index
create index if not exists educators_created_by_id_idx on public.educators(created_by_id);
create index if not exists educators_province_idx on public.educators(current_province);
create index if not exists educators_phase_idx on public.educators(phase);

-- ============================================================
-- MESSAGES TABLE
-- ============================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users(id) on delete cascade not null,
  receiver_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- RLS
alter table public.messages enable row level security;

create policy "Users can read their own messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can send messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "Users can update (mark as read) their received messages"
  on public.messages for update
  using (auth.uid() = receiver_id);

-- Indexes
create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists messages_receiver_idx on public.messages(receiver_id);
create index if not exists messages_created_at_idx on public.messages(created_at desc);

-- Enable realtime for messages
alter publication supabase_realtime add table public.messages;

-- ============================================================
-- VACANCIES TABLE
-- ============================================================
create table if not exists public.vacancies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  school text,
  province text,
  district text,
  phase text,
  subjects text[],
  post_level text,
  closing_date date,
  description text,
  source text,
  url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.vacancies enable row level security;

create policy "Vacancies are publicly readable"
  on public.vacancies for select
  using (true);

-- Only service role / admin can insert vacancies
-- (vacancies are scraped/imported by the platform)

-- Indexes
create index if not exists vacancies_province_idx on public.vacancies(province);
create index if not exists vacancies_closing_date_idx on public.vacancies(closing_date);
create index if not exists vacancies_created_at_idx on public.vacancies(created_at desc);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
-- Create the 'avatars' bucket for profile photos and CV PDFs
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Storage policies for the avatars bucket
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- UPDATED_AT TRIGGER (for educators + vacancies)
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger educators_updated_at
  before update on public.educators
  for each row execute function public.handle_updated_at();

create trigger vacancies_updated_at
  before update on public.vacancies
  for each row execute function public.handle_updated_at();

-- ============================================================
-- MIGRATION: add columns to existing educators table
-- (run these if the table already exists without these columns)
-- ============================================================
-- alter table public.educators add column if not exists email text;
-- alter table public.educators add column if not exists account_status text default 'active';
-- alter table public.educators add column if not exists available_from date;
