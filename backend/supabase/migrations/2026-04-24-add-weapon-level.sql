alter table public.player_loadouts
add column if not exists weapon_level integer not null default 1;
