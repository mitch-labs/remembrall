-- Remembrall database (already applied to the Supabase project; kept here for reference).
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 30),
  recall text check (recall is null or char_length(recall) <= 50),
  created_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cat text not null check (char_length(cat) between 1 and 64),
  text text not null check (char_length(text) between 1 and 200),
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  done_at timestamptz  -- set when ticked as done; done items leave the daily recall
);

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  reminders_on boolean not null default true,
  remind_hour int not null default 8 check (remind_hour between 0 and 23),
  remind_tz text not null default 'Asia/Manila',
  last_sent date,
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Every table: a signed-in person can only read and change their own rows.
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.settings enable row level security;
alter table public.push_subscriptions enable row level security;
create policy "own categories" on public.categories for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own items" on public.items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own settings" on public.settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own push subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Server-only config: push signing keys and the scheduler's secret. Not reachable from the app.
create schema if not exists private;
create table private.config (key text primary key, value text not null);
create or replace function public.get_push_config() returns json
  language sql security definer set search_path = '' as $$
  select coalesce(json_object_agg(key, value), '{}'::json) from private.config; $$;
revoke execute on function public.get_push_config() from public, anon, authenticated;
grant execute on function public.get_push_config() to service_role;

-- Hourly job: the function sends each person their recall when it's their chosen hour.
-- select cron.schedule('remembrall-daily-recall', '0 * * * *', $$ select net.http_post(... /functions/v1/daily-recall ...) $$);
