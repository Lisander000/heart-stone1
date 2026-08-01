-- Shared per-user category access. Super users decide which sidebar categories a user
-- may see; each user reads their own row on login, so restrictions apply on any device.
create table if not exists public.user_access (
  email      text primary key,
  categories text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.user_access enable row level security;

-- Any signed-in user may read (so each user learns their own restrictions).
drop policy if exists "user_access read" on public.user_access;
create policy "user_access read"
  on public.user_access for select
  to authenticated
  using (true);

-- Any signed-in user may write; the UI only exposes this to super users.
-- (Stricter option: replace the two `true`s below with
--    lower(auth.jwt() ->> 'email') = any (array['lisander@gooodboys.com'])
--  to let only named super admins change access server-side.)
drop policy if exists "user_access write" on public.user_access;
create policy "user_access write"
  on public.user_access for all
  to authenticated
  using (true)
  with check (true);
