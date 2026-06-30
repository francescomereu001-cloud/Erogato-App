-- Remote settings used by the mobile Forecast & Target screen.
-- Run once in Supabase SQL editor if the table does not exist yet.
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- The app currently uses the public anon client, matching the existing pratiche access pattern.
-- Tighten these policies if authentication is added later.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_settings' and policyname = 'Allow app settings read'
  ) then
    create policy "Allow app settings read" on public.app_settings for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_settings' and policyname = 'Allow app settings upsert'
  ) then
    create policy "Allow app settings upsert" on public.app_settings for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_settings' and policyname = 'Allow app settings update'
  ) then
    create policy "Allow app settings update" on public.app_settings for update using (true) with check (true);
  end if;
end $$;
