-- Stage config: make boss_id nullable, add direct game columns
alter table public.stage_configs
  alter column boss_id drop not null,
  add column if not exists enemy_count integer not null default 0,
  add column if not exists reward_gold integer not null default 0,
  add column if not exists waves jsonb not null default '[]'::jsonb;

-- Boss stats: add move_speed (was missing)
alter table public.boss_stats
  add column if not exists move_speed integer not null default 85;

-- Skill defs: add display name
alter table public.skill_defs
  add column if not exists name text not null default '';

-- Relic defs: add display name
alter table public.relic_defs
  add column if not exists name text not null default '';

-- Game data is public/shared — disable RLS so anon reads work without policies
alter table public.stage_configs  disable row level security;
alter table public.enemy_stats    disable row level security;
alter table public.boss_stats     disable row level security;
alter table public.skill_defs     disable row level security;
alter table public.relic_defs     disable row level security;
alter table public.item_defs      disable row level security;
alter table public.drop_tables    disable row level security;

-- Grant read access to anonymous users for all game data tables
grant select on public.stage_configs to anon;
grant select on public.enemy_stats to anon;
grant select on public.boss_stats to anon;
grant select on public.skill_defs to anon;
grant select on public.relic_defs to anon;
grant select on public.item_defs to anon;
grant select on public.drop_tables to anon;
