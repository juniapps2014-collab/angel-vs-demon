-- ============================================================
-- Angel vs Demon — game data seed
-- Run AFTER applying all migrations in /migrations/
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- enemy_stats (10 types)
-- ────────────────────────────────────────────────────────────
insert into public.enemy_stats (enemy_id, name, tier, hp, attack, move_speed, skill_profile)
values
  ('smile_zombie',  '스마일 좀비',   'basic',    50,   8,  60, '{}'::jsonb),
  ('slime',         '슬라임',        'basic',    40,  10,  50, '{}'::jsonb),
  ('bomb_imp',      '폭탄 임프',     'mid',      30,  22,  70, '{}'::jsonb),
  ('hellhound',     '지옥 사냥개',   'mid',      45,  12, 120, '{}'::jsonb),
  ('pitcher_imp',   '투척 임프',     'mid',      55,  14,  68, '{"attackStyle":"ranged","projectile":"fireball"}'::jsonb),
  ('shield_zombie', '방패 좀비',     'advanced', 80,   8,  45, '{}'::jsonb),
  ('toxic_slime',   '독안개 슬라임', 'advanced', 70,  12,  44, '{"trail":"poison_pool","trailDuration":2.4}'::jsonb),
  ('summoner_priest','소환 사제',    'advanced', 95,  10,  38, '{"summonType":"smile_zombie","summonCount":2,"summonInterval":5.2}'::jsonb),
  ('elite_jumper',  '엘리트 점퍼',  'elite',   120,  18,  90, '{}'::jsonb),
  ('elite_drummer', '엘리트 드러머','elite',   150,  15,  50, '{}'::jsonb)
on conflict (enemy_id) do update set
  name       = excluded.name,
  tier       = excluded.tier,
  hp         = excluded.hp,
  attack     = excluded.attack,
  move_speed = excluded.move_speed;

-- ────────────────────────────────────────────────────────────
-- boss_stats (10 bosses)
-- ────────────────────────────────────────────────────────────
insert into public.boss_stats (boss_id, name, hp, attack, move_speed, phase_count, power_multiplier, pattern_profile)
values
  ('boss_clown_zombie',
   '광대 좀비', 400, 25, 90, 1, 1.0,
   '{"chargeInterval":3.0,"chargeSpeed":600,"minionType":"smile_zombie","minionCount":3,"specialPattern":"summon","specialCooldown":7.2}'::jsonb),
  ('boss_hell_drummer',
   '지옥 드러머', 700, 30, 80, 1, 1.0,
   '{"chargeInterval":2.8,"chargeSpeed":650,"minionType":"smile_zombie","minionCount":4,"specialPattern":"summon","specialCooldown":6.4}'::jsonb),
  ('boss_dark_shaman',
   '어둠 주술사', 1000, 28, 70, 2, 1.2,
   '{"chargeInterval":4.0,"chargeSpeed":500,"minionType":"slime","minionCount":5,"specialPattern":"nova","specialCooldown":6.8}'::jsonb),
  ('boss_abyss_knight',
   '심연 기사', 1400, 35, 95, 2, 1.3,
   '{"chargeInterval":2.2,"chargeSpeed":750,"minionType":"shield_zombie","minionCount":3,"specialPattern":"frenzy","specialCooldown":7.0}'::jsonb),
  ('boss_fire_lord',
   '화염 군주', 1900, 40, 85, 2, 1.4,
   '{"chargeInterval":2.5,"chargeSpeed":700,"minionType":"bomb_imp","minionCount":4,"specialPattern":"nova","specialCooldown":5.8}'::jsonb),
  ('boss_ice_witch',
   '얼음 마녀', 2500, 35, 65, 2, 1.5,
   '{"chargeInterval":5.0,"chargeSpeed":400,"minionType":"slime","minionCount":6,"specialPattern":"nova","specialCooldown":7.4}'::jsonb),
  ('boss_thunder_golem',
   '번개 골렘', 3300, 45, 75, 3, 1.6,
   '{"chargeInterval":2.0,"chargeSpeed":800,"minionType":"hellhound","minionCount":4,"specialPattern":"nova","specialCooldown":6.0}'::jsonb),
  ('boss_shadow_assassin',
   '그림자 암살자', 4200, 50, 130, 3, 1.8,
   '{"chargeInterval":1.5,"chargeSpeed":1000,"minionType":"hellhound","minionCount":5,"specialPattern":"frenzy","specialCooldown":5.6}'::jsonb),
  ('boss_demon_king',
   '악마왕', 5500, 55, 90, 3, 2.0,
   '{"chargeInterval":1.8,"chargeSpeed":900,"minionType":"elite_jumper","minionCount":4,"specialPattern":"summon","specialCooldown":5.4}'::jsonb),
  ('boss_avatar_of_void',
   '공허의 화신', 7000, 60, 100, 4, 2.5,
   '{"chargeInterval":1.5,"chargeSpeed":950,"minionType":"elite_drummer","minionCount":3,"specialPattern":"nova","specialCooldown":5.2}'::jsonb)
on conflict (boss_id) do update set
  name            = excluded.name,
  hp              = excluded.hp,
  attack          = excluded.attack,
  move_speed      = excluded.move_speed,
  phase_count     = excluded.phase_count,
  power_multiplier= excluded.power_multiplier,
  pattern_profile = excluded.pattern_profile;

-- ────────────────────────────────────────────────────────────
-- skill_defs (4 skills)
-- ────────────────────────────────────────────────────────────
insert into public.skill_defs (skill_id, name, category, cooldown, damage_factor, effect_profile)
values
  ('skill_star_burst',    '스타 버스트', 'attack',   4.0, 1.0, '{}'::jsonb),
  ('skill_guardian_aura', '가디언 오라', 'support',  5.0, 0.0, '{}'::jsonb),
  ('skill_heaven_strike', '천벌 낙하',   'attack',   6.0, 1.5, '{}'::jsonb),
  ('skill_holy_dash',     '홀리 대시',   'mobility', 8.0, 1.2, '{}'::jsonb)
on conflict (skill_id) do update set
  name          = excluded.name,
  category      = excluded.category,
  cooldown      = excluded.cooldown,
  damage_factor = excluded.damage_factor;

-- ────────────────────────────────────────────────────────────
-- relic_defs (6 relics)
-- ────────────────────────────────────────────────────────────
insert into public.relic_defs (relic_id, name, rarity, trigger_type, effect_profile)
values
  ('relic_holy_grail',        '빛의 성배',     'rare',      'on_kill',     '{"killStackBonus":0.1,"maxStack":5}'::jsonb),
  ('relic_broken_horn',       '부서진 악마 뿔', 'uncommon',  'passive',     '{"moveSpeedMultiplier":1.25}'::jsonb),
  ('relic_celestial_compass', '천계 나침반',   'uncommon',  'passive',     '{"autoAimRangeBonus":120}'::jsonb),
  ('relic_laughter_mask',     '웃음 가면',     'rare',      'on_kill',     '{"explodeChance":0.15,"explodeRange":100,"explodeDamage":20}'::jsonb),
  ('relic_guardian_feather',  '수호 깃털',     'uncommon',  'on_damage',   '{"contactCooldownBonus":0.45}'::jsonb),
  ('relic_golden_bell',       '황금 종',       'rare',      'on_purchase', '{"goldMultiplier":1.35}'::jsonb)
on conflict (relic_id) do update set
  name         = excluded.name,
  rarity       = excluded.rarity,
  trigger_type = excluded.trigger_type,
  effect_profile = excluded.effect_profile;

-- ────────────────────────────────────────────────────────────
-- stage_configs (100 stages) — generated via PL/pgSQL
-- ────────────────────────────────────────────────────────────
do $$
declare
  s   integer;
  wc  integer;
  ep  text[];
  be  integer;
  epw integer;
  bid text;
  support_enemy text;
  support_wave boolean;
  support_count integer;
  w_arr  jsonb;
  me     text;
  he     boolean;
  et     text;
  w_enemies jsonb;
  w_json    jsonb;
  areas text[] := array['bottom','top','left','right','center','random','front','back'];
  i integer;
begin
  for s in 1..100 loop
    -- wave count (mirrors TypeScript getWaveCount)
    if s <= 30 then
      wc := 3 + s / 10;
    elsif s <= 60 then
      wc := 5 + s / 10;
    else
      wc := least(8 + s / 10, 12);
    end if;

    -- enemy pool (mirrors TypeScript getEnemyPoolForStage)
    if s <= 20 then
      ep := array['smile_zombie','slime'];
    elsif s <= 24 then
      ep := array['smile_zombie','slime','bomb_imp','hellhound','pitcher_imp'];
    elsif s <= 29 then
      ep := array['smile_zombie','slime','bomb_imp','hellhound','shield_zombie','pitcher_imp','summoner_priest'];
    elsif s <= 49 then
      ep := array['smile_zombie','slime','bomb_imp','hellhound','shield_zombie','pitcher_imp','toxic_slime','summoner_priest'];
    elsif s <= 70 then
      ep := array['smile_zombie','slime','bomb_imp','hellhound','shield_zombie','pitcher_imp','toxic_slime','summoner_priest'];
    else
      ep := array['elite_jumper','elite_drummer','shield_zombie','hellhound','pitcher_imp','toxic_slime','summoner_priest'];
    end if;

    support_enemy := case
      when s >= 25 and s < 30 then 'summoner_priest'
      when s >= 30 and s < 50 then case when mod(s, 2) = 0 then 'toxic_slime' else 'summoner_priest' end
      when s >= 50 then case when mod(s, 3) = 0 then 'summoner_priest' when mod(s, 2) = 0 then 'toxic_slime' else 'pitcher_imp' end
      else null
    end;

    be  := 18 + s * 4;
    epw := ceil(be::numeric / wc);

    bid := case s
      when 10  then 'boss_clown_zombie'
      when 20  then 'boss_hell_drummer'
      when 30  then 'boss_dark_shaman'
      when 40  then 'boss_abyss_knight'
      when 50  then 'boss_fire_lord'
      when 60  then 'boss_ice_witch'
      when 70  then 'boss_thunder_golem'
      when 80  then 'boss_shadow_assassin'
      when 90  then 'boss_demon_king'
      when 100 then 'boss_avatar_of_void'
      else null
    end;

    w_arr := '[]'::jsonb;
    i := 0;
    while i < wc loop
      me := ep[((s * 7 + i * 13) % array_length(ep, 1)) + 1];
      he := s >= 15 and (s * 3 + i * 11) % 5 = 0;
      support_wave := support_enemy is not null and s >= 21 and mod(i + s, 3) = 0;

      if s >= 50 then et := 'elite_drummer'; else et := 'elite_jumper'; end if;

      if he and support_wave then
        support_count := case when support_enemy = 'summoner_priest' then 2 else greatest(2, floor(epw * 0.35)::integer) end;
        w_enemies := jsonb_build_array(
          jsonb_build_object('type', support_enemy, 'count', support_count),
          jsonb_build_object('type', me, 'count', greatest(1, epw - support_count - 2)),
          jsonb_build_object('type', et, 'count', 2)
        );
      elsif he then
        w_enemies := jsonb_build_array(
          jsonb_build_object('type', me, 'count', greatest(1, epw - 2)),
          jsonb_build_object('type', et, 'count', 2)
        );
      elsif support_wave then
        support_count := case when support_enemy = 'summoner_priest' then 2 else greatest(2, floor(epw * 0.35)::integer) end;
        w_enemies := jsonb_build_array(
          jsonb_build_object('type', support_enemy, 'count', support_count),
          jsonb_build_object('type', me, 'count', greatest(1, epw - support_count))
        );
      else
        w_enemies := jsonb_build_array(
          jsonb_build_object('type', me, 'count', greatest(1, epw))
        );
      end if;

      w_json := jsonb_build_object(
        'spawnDelay', (0.5 + i * 1.0)::numeric,
        'enemies',    w_enemies,
        'spawnArea',  areas[(i % array_length(areas, 1)) + 1]
      );

      w_arr := w_arr || jsonb_build_array(w_json);
      i := i + 1;
    end loop;

    insert into public.stage_configs (
      stage_id, chapter_id, recommended_power,
      wave_pattern_id, boss_id, reward_group_id, duration_seconds,
      enemy_count, reward_gold, waves
    ) values (
      s,
      ceil(s::numeric / 10),
      floor(100 * power(1.12, s - 1)),
      'auto_wave_' || s,
      bid,
      'reward_tier_' || ceil(s::numeric / 10),
      360,
      be,
      40 + s * 15,
      w_arr
    )
    on conflict (stage_id) do update set
      chapter_id        = excluded.chapter_id,
      recommended_power = excluded.recommended_power,
      wave_pattern_id   = excluded.wave_pattern_id,
      boss_id           = excluded.boss_id,
      reward_group_id   = excluded.reward_group_id,
      enemy_count       = excluded.enemy_count,
      reward_gold       = excluded.reward_gold,
      waves             = excluded.waves;
  end loop;
end;
$$;
