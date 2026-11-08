-- Blue Rush: tablas persistentes para el modo de demostración.
-- Ejecutar una sola vez (el script es seguro para volver a ejecutarlo).
-- IMPORTANTE: las cuentas del juego son ficticias y NO son Supabase Auth.
-- Estas políticas permiten operar los 3 perfiles de demostración desde el navegador.
-- No almacenar aquí contraseñas, información privada ni datos de usuarios reales.

create table if not exists public.br_profiles (
  account_id text primary key check (account_id in ('sonic', 'tails', 'amy')),
  display_name varchar(16) not null,
  selected_character text not null default 'sonic'
    check (selected_character in ('sonic', 'tails', 'knuckles', 'amy', 'shadow')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.br_player_stats (
  account_id text primary key references public.br_profiles(account_id) on delete cascade,
  best_score integer not null default 0 check (best_score >= 0),
  total_score bigint not null default 0 check (total_score >= 0),
  games_played integer not null default 0 check (games_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  best_time numeric(10, 2),
  last_score integer not null default 0 check (last_score >= 0),
  last_outcome text,
  updated_at timestamptz not null default now()
);

create table if not exists public.br_match_history (
  id uuid primary key,
  account_id text not null references public.br_profiles(account_id) on delete cascade,
  room_code text,
  character_id text not null
    check (character_id in ('sonic', 'tails', 'knuckles', 'amy', 'shadow')),
  score integer not null default 0 check (score >= 0),
  duration_seconds numeric(10, 2) not null default 0 check (duration_seconds >= 0),
  outcome text not null check (outcome in ('complete', 'win', 'loss', 'gameover')),
  started_at timestamptz,
  finished_at timestamptz not null default now()
);

create index if not exists br_match_history_account_finished_idx
  on public.br_match_history (account_id, finished_at desc);
create index if not exists br_player_stats_best_score_idx
  on public.br_player_stats (best_score desc);

create or replace function public.br_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists br_profiles_set_updated_at on public.br_profiles;
create trigger br_profiles_set_updated_at
before update on public.br_profiles
for each row execute function public.br_set_updated_at();

drop trigger if exists br_player_stats_set_updated_at on public.br_player_stats;
create trigger br_player_stats_set_updated_at
before update on public.br_player_stats
for each row execute function public.br_set_updated_at();

alter table public.br_profiles enable row level security;
alter table public.br_player_stats enable row level security;
alter table public.br_match_history enable row level security;

grant select, insert, update on public.br_profiles to anon, authenticated;
grant select, insert, update on public.br_player_stats to anon, authenticated;
grant select, insert on public.br_match_history to anon, authenticated;

drop policy if exists "br_profiles_demo_read" on public.br_profiles;
create policy "br_profiles_demo_read"
on public.br_profiles for select
to anon, authenticated
using (true);

drop policy if exists "br_profiles_demo_insert" on public.br_profiles;
create policy "br_profiles_demo_insert"
on public.br_profiles for insert
to anon, authenticated
with check (account_id in ('sonic', 'tails', 'amy'));

drop policy if exists "br_profiles_demo_update" on public.br_profiles;
create policy "br_profiles_demo_update"
on public.br_profiles for update
to anon, authenticated
using (account_id in ('sonic', 'tails', 'amy'))
with check (account_id in ('sonic', 'tails', 'amy'));

drop policy if exists "br_player_stats_demo_read" on public.br_player_stats;
create policy "br_player_stats_demo_read"
on public.br_player_stats for select
to anon, authenticated
using (true);

drop policy if exists "br_player_stats_demo_insert" on public.br_player_stats;
create policy "br_player_stats_demo_insert"
on public.br_player_stats for insert
to anon, authenticated
with check (account_id in ('sonic', 'tails', 'amy'));

drop policy if exists "br_player_stats_demo_update" on public.br_player_stats;
create policy "br_player_stats_demo_update"
on public.br_player_stats for update
to anon, authenticated
using (account_id in ('sonic', 'tails', 'amy'))
with check (account_id in ('sonic', 'tails', 'amy'));

drop policy if exists "br_match_history_demo_read" on public.br_match_history;
create policy "br_match_history_demo_read"
on public.br_match_history for select
to anon, authenticated
using (true);

drop policy if exists "br_match_history_demo_insert" on public.br_match_history;
create policy "br_match_history_demo_insert"
on public.br_match_history for insert
to anon, authenticated
with check (account_id in ('sonic', 'tails', 'amy'));

-- Crear los tres perfiles de prueba para que el ranking empiece con todos.
insert into public.br_profiles (account_id, display_name, selected_character)
values
  ('sonic', 'Sonic', 'sonic'),
  ('tails', 'Tails', 'tails'),
  ('amy', 'Amy', 'amy')
on conflict (account_id) do nothing;

insert into public.br_player_stats (account_id)
values ('sonic'), ('tails'), ('amy')
on conflict (account_id) do nothing;
