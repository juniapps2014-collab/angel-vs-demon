alter table public.player_loadouts
add column if not exists skill_levels jsonb not null default '{}'::jsonb;
