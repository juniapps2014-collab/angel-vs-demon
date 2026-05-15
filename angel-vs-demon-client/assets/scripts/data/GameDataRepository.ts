import { SupabaseClient } from '../network/SupabaseClient';

interface EnemyStatRow {
  enemy_id: string;
  name: string;
  hp: number;
  attack: number;
  move_speed: number;
}

interface BossStatRow {
  boss_id: string;
  name: string;
  hp: number;
  attack: number;
  move_speed: number;
  pattern_profile: {
    chargeInterval?: number;
    chargeSpeed?: number;
    minionType?: string;
    minionCount?: number;
    specialPattern?: string;
    specialCooldown?: number;
  };
}

interface SkillDefRow {
  skill_id: string;
  name: string;
  cooldown: number;
}

interface RelicDefRow {
  relic_id: string;
  name: string;
}

export interface BossCombatStat {
  maxHp: number;
  moveSpeed: number;
  contactDamage: number;
  chargeInterval: number;
  chargeSpeed: number;
  minionType: string;
  minionCount: number;
  specialPattern: 'none' | 'nova' | 'summon' | 'frenzy';
  specialCooldown: number;
  displayName: string;
}

const FALLBACK_ENEMY: Record<string, { hp: number; attack: number; move_speed: number }> = {
  smile_zombie:  { hp:  50, attack:  8, move_speed:  60 },
  slime:         { hp:  40, attack: 10, move_speed:  50 },
  bomb_imp:      { hp:  30, attack: 22, move_speed:  70 },
  hellhound:     { hp:  45, attack: 12, move_speed: 120 },
  shield_zombie: { hp:  80, attack:  8, move_speed:  45 },
  elite_jumper:  { hp: 120, attack: 18, move_speed:  90 },
  elite_drummer: { hp: 150, attack: 15, move_speed:  50 },
  pitcher_imp:   { hp:  55, attack: 14, move_speed:  68 },
  toxic_slime:   { hp:  70, attack: 12, move_speed:  44 },
  summoner_priest: { hp: 95, attack: 10, move_speed: 38 },
};

const FALLBACK_BOSS: Record<string, BossStatRow> = {
  boss_clown_zombie:    { boss_id: 'boss_clown_zombie',    name: '광대 좀비',     hp:   400, attack: 25, move_speed:  90, pattern_profile: { chargeInterval: 3.0, chargeSpeed:  600, minionType: 'smile_zombie',  minionCount: 3, specialPattern: 'summon', specialCooldown: 7.2 } },
  boss_hell_drummer:    { boss_id: 'boss_hell_drummer',    name: '지옥 드러머',   hp:   700, attack: 30, move_speed:  80, pattern_profile: { chargeInterval: 2.8, chargeSpeed:  650, minionType: 'smile_zombie',  minionCount: 4, specialPattern: 'summon', specialCooldown: 6.4 } },
  boss_dark_shaman:     { boss_id: 'boss_dark_shaman',     name: '어둠 주술사',   hp:  1000, attack: 28, move_speed:  70, pattern_profile: { chargeInterval: 4.0, chargeSpeed:  500, minionType: 'slime',         minionCount: 5, specialPattern: 'nova',   specialCooldown: 6.8 } },
  boss_abyss_knight:    { boss_id: 'boss_abyss_knight',    name: '심연 기사',     hp:  1400, attack: 35, move_speed:  95, pattern_profile: { chargeInterval: 2.2, chargeSpeed:  750, minionType: 'shield_zombie', minionCount: 3, specialPattern: 'frenzy', specialCooldown: 7.0 } },
  boss_fire_lord:       { boss_id: 'boss_fire_lord',       name: '화염 군주',     hp:  1900, attack: 40, move_speed:  85, pattern_profile: { chargeInterval: 2.5, chargeSpeed:  700, minionType: 'bomb_imp',      minionCount: 4, specialPattern: 'nova',   specialCooldown: 5.8 } },
  boss_ice_witch:       { boss_id: 'boss_ice_witch',       name: '얼음 마녀',     hp:  2500, attack: 35, move_speed:  65, pattern_profile: { chargeInterval: 5.0, chargeSpeed:  400, minionType: 'slime',         minionCount: 6, specialPattern: 'nova',   specialCooldown: 7.4 } },
  boss_thunder_golem:   { boss_id: 'boss_thunder_golem',   name: '번개 골렘',     hp:  3300, attack: 45, move_speed:  75, pattern_profile: { chargeInterval: 2.0, chargeSpeed:  800, minionType: 'hellhound',     minionCount: 4, specialPattern: 'nova',   specialCooldown: 6.0 } },
  boss_shadow_assassin: { boss_id: 'boss_shadow_assassin', name: '그림자 암살자', hp:  4200, attack: 50, move_speed: 130, pattern_profile: { chargeInterval: 1.5, chargeSpeed: 1000, minionType: 'hellhound',     minionCount: 5, specialPattern: 'frenzy', specialCooldown: 5.6 } },
  boss_demon_king:      { boss_id: 'boss_demon_king',      name: '악마왕',        hp:  5500, attack: 55, move_speed:  90, pattern_profile: { chargeInterval: 1.8, chargeSpeed:  900, minionType: 'elite_jumper',  minionCount: 4, specialPattern: 'summon', specialCooldown: 5.4 } },
  boss_avatar_of_void:  { boss_id: 'boss_avatar_of_void',  name: '공허의 화신',   hp:  7000, attack: 60, move_speed: 100, pattern_profile: { chargeInterval: 1.5, chargeSpeed:  950, minionType: 'elite_drummer', minionCount: 3, specialPattern: 'nova',   specialCooldown: 5.2 } },
};

const FALLBACK_SKILL_NAME: Record<string, string> = {
  skill_star_burst:    '스타 버스트',
  skill_guardian_aura: '가디언 오라',
  skill_heaven_strike: '천벌 낙하',
  skill_holy_dash:     '홀리 대시',
};

const FALLBACK_RELIC_NAME: Record<string, string> = {
  relic_holy_grail:        '빛의 성배',
  relic_broken_horn:       '부서진 악마 뿔',
  relic_celestial_compass: '천계 나침반',
  relic_laughter_mask:     '웃음 가면',
  relic_guardian_feather:  '수호 깃털',
  relic_golden_bell:       '황금 종',
};

export class GameDataRepository {
  private static enemyMap = new Map<string, EnemyStatRow>();
  private static bossMap  = new Map<string, BossStatRow>();
  private static skillMap = new Map<string, SkillDefRow>();
  private static relicMap = new Map<string, RelicDefRow>();
  private static loaded = false;

  static async loadAsync(): Promise<boolean> {
    if (this.loaded) return true;

    if (!SupabaseClient.isConfigured()) {
      this.loaded = true;
      return false;
    }

    try {
      const [enemies, bosses, skills, relics] = await Promise.all([
        SupabaseClient.queryList<EnemyStatRow>('enemy_stats'),
        SupabaseClient.queryList<BossStatRow>('boss_stats'),
        SupabaseClient.queryList<SkillDefRow>('skill_defs'),
        SupabaseClient.queryList<RelicDefRow>('relic_defs'),
      ]);

      enemies.forEach((e) => this.enemyMap.set(e.enemy_id, e));
      bosses.forEach((b)  => this.bossMap.set(b.boss_id, b));
      skills.forEach((s)  => this.skillMap.set(s.skill_id, s));
      relics.forEach((r)  => this.relicMap.set(r.relic_id, r));
      this.loaded = true;
      console.log(`[GameDataRepository] Loaded: ${enemies.length} enemies, ${bosses.length} bosses, ${skills.length} skills, ${relics.length} relics`);
      return true;
    } catch (error) {
      console.warn('[GameDataRepository] Supabase load failed, using fallback data.', error);
      this.loaded = true;
      return false;
    }
  }

  static getEnemyStat(type: string, stageId: number): { hp: number; damage: number; speed: number } {
    const row = this.enemyMap.get(type) ?? FALLBACK_ENEMY[type];
    const base = row
      ? { hp: row.hp, damage: row.attack, speed: row.move_speed }
      : { hp: 50, damage: 10, speed: 65 };

    const scale = 1 + (stageId - 1) * 0.08;
    return {
      hp:     Math.round(base.hp     * scale),
      damage: Math.round(base.damage * scale),
      speed:  Math.round(base.speed  * Math.sqrt(scale)),
    };
  }

  static getBossStat(bossId: string): BossCombatStat {
    const row = this.bossMap.get(bossId) ?? FALLBACK_BOSS[bossId];
    if (!row) {
      return {
        maxHp: 500, moveSpeed: 85, contactDamage: 25,
        chargeInterval: 3.0, chargeSpeed: 600,
        minionType: 'smile_zombie', minionCount: 3,
        specialPattern: 'none', specialCooldown: 7.0,
        displayName: '⚡ BOSS',
      };
    }

    const pp = row.pattern_profile;
    const sp = pp.specialPattern;
    const validSpecial: 'none' | 'nova' | 'summon' | 'frenzy' =
      sp === 'nova' || sp === 'summon' || sp === 'frenzy' ? sp : 'none';

    return {
      maxHp:          row.hp,
      moveSpeed:      row.move_speed,
      contactDamage:  row.attack,
      chargeInterval: pp.chargeInterval  ?? 3.0,
      chargeSpeed:    pp.chargeSpeed     ?? 600,
      minionType:     pp.minionType      ?? 'smile_zombie',
      minionCount:    pp.minionCount     ?? 3,
      specialPattern: validSpecial,
      specialCooldown: pp.specialCooldown ?? 7.0,
      displayName:    `⚡ BOSS: ${row.name}`,
    };
  }

  static getSkillName(skillId: string): string {
    return this.skillMap.get(skillId)?.name ?? FALLBACK_SKILL_NAME[skillId] ?? skillId;
  }

  static getRelicName(relicId: string): string {
    return this.relicMap.get(relicId)?.name ?? FALLBACK_RELIC_NAME[relicId] ?? relicId;
  }
}
