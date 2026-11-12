-- Rode este script no Supabase: SQL Editor > New query > colar > Run
-- Cria as tabelas do app e as regras de segurança (cada usuário só vê os próprios dados).

create table if not exists public.vehicles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plate        text not null,
  nickname     text,
  brand        text not null,
  model        text not null,
  year_model   integer,
  fuel         text,
  fipe_code    text,
  fipe_value   text,
  fipe_ref     text,
  vin          text,
  current_km   integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (user_id, plate)
);

create table if not exists public.maintenances (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id   uuid not null references public.vehicles (id) on delete cascade,
  type         text not null,
  description  text,
  date         date not null,
  km           integer not null,
  cost         numeric(12, 2),
  workshop     text,
  notes        text,
  next_km      integer,
  next_date    date,
  created_at   timestamptz not null default now()
);

create index if not exists maintenances_vehicle_idx on public.maintenances (vehicle_id, date desc);

create table if not exists public.obd_snapshots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id   uuid not null references public.vehicles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  protocol     text,
  vin          text,
  dtcs         text[] not null default '{}',
  readings     jsonb not null default '{}'::jsonb
);

create index if not exists obd_snapshots_vehicle_idx on public.obd_snapshots (vehicle_id, created_at desc);

alter table public.vehicles      enable row level security;
alter table public.maintenances  enable row level security;
alter table public.obd_snapshots enable row level security;

drop policy if exists "own vehicles" on public.vehicles;
create policy "own vehicles" on public.vehicles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own maintenances" on public.maintenances;
create policy "own maintenances" on public.maintenances
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own obd snapshots" on public.obd_snapshots;
create policy "own obd snapshots" on public.obd_snapshots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
