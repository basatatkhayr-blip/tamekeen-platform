-- =====================================================================
-- CRM Security Setup — run this SQL in your Supabase project
-- (Dashboard → SQL Editor → New Query → paste → Run)
-- =====================================================================

-- 1) Add ownership columns (safe to re-run)
alter table public.contacts
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_by_email text;

-- 2) Enable Row Level Security
alter table public.contacts enable row level security;

-- 3) Drop any old permissive policies (adjust names if yours differ)
drop policy if exists "Public read"          on public.contacts;
drop policy if exists "Public insert"        on public.contacts;
drop policy if exists "Public update"        on public.contacts;
drop policy if exists "Public delete"        on public.contacts;
drop policy if exists "Enable read for all"  on public.contacts;
drop policy if exists "Enable insert for all" on public.contacts;
drop policy if exists "Enable update for all" on public.contacts;
drop policy if exists "Enable delete for all" on public.contacts;

-- 4) Authenticated-only policies
create policy "authenticated can read contacts"
  on public.contacts for select
  to authenticated
  using (true);

create policy "authenticated can insert contacts"
  on public.contacts for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "authenticated can update contacts"
  on public.contacts for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated can delete contacts"
  on public.contacts for delete
  to authenticated
  using (true);

-- 5) (Recommended) restrict who can sign up:
--    Supabase Dashboard → Authentication → Providers → Email
--    - Disable "Enable email signups" once your team has registered, OR
--    - Use Authentication → Users → Invite User to onboard team members only.
