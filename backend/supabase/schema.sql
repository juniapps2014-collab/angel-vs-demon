create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique,
  avatar_id text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

create table if not exists public.player_progress (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  player_level integer not null default 1,
  highest_stage integer not null default 1,
  gold integer not null default 0,
  gem integer not null default 0,
  total_kills integer not null default 0,
  boss_kills integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.player_loadouts (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  weapon_id text not null default 'weapon_sword_001',
  weapon_level integer not null default 1,
  active_skill_ids jsonb not null default '[]'::jsonb,
  skill_levels jsonb not null default '{}'::jsonb,
  relic_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.stage_configs (
  stage_id integer primary key,
  chapter_id integer not null,
  recommended_power integer not null,
  wave_pattern_id text not null,
  boss_id text not null,
  reward_group_id text not null,
  duration_seconds integer not null default 360
);

create table if not exists public.enemy_stats (
  enemy_id text primary key,
  name text not null,
  tier text not null,
  hp integer not null,
  attack integer not null,
  move_speed numeric not null,
  skill_profile jsonb not null default '{}'::jsonb
);

create table if not exists public.boss_stats (
  boss_id text primary key,
  name text not null,
  hp integer not null,
  attack integer not null,
  phase_count integer not null default 1,
  pattern_profile jsonb not null default '{}'::jsonb,
  power_multiplier numeric not null default 1
);

create table if not exists public.item_defs (
  item_id text primary key,
  item_type text not null,
  rarity text not null,
  stat_profile jsonb not null default '{}'::jsonb,
  effect_profile jsonb not null default '{}'::jsonb
);

create table if not exists public.skill_defs (
  skill_id text primary key,
  category text not null,
  cooldown numeric not null,
  damage_factor numeric not null,
  effect_profile jsonb not null default '{}'::jsonb
);

create table if not exists public.relic_defs (
  relic_id text primary key,
  rarity text not null,
  trigger_type text not null,
  effect_profile jsonb not null default '{}'::jsonb
);

create table if not exists public.drop_tables (
  id bigint generated always as identity primary key,
  drop_table_id text not null,
  target_type text not null,
  target_id text not null,
  item_id text not null,
  drop_rate numeric not null
);

alter table public.profiles enable row level security;
alter table public.player_progress enable row level security;
alter table public.player_loadouts enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = user_id);

create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = user_id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = user_id);

create policy "progress_select_own"
on public.player_progress
for select
using (auth.uid() = user_id);

create policy "progress_insert_own"
on public.player_progress
for insert
with check (auth.uid() = user_id);

create policy "progress_update_own"
on public.player_progress
for update
using (auth.uid() = user_id);

create policy "loadouts_select_own"
on public.player_loadouts
for select
using (auth.uid() = user_id);

create policy "loadouts_insert_own"
on public.player_loadouts
for insert
with check (auth.uid() = user_id);

create policy "loadouts_update_own"
on public.player_loadouts
for update
using (auth.uid() = user_id);
