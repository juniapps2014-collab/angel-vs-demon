import { SupabaseClient } from '../network/SupabaseClient';

export interface WaveEnemy {
  type: string;
  count: number;
}

export interface Wave {
  spawnDelay: number;
  enemies: WaveEnemy[];
  spawnArea: string;
}

export interface StageDefinition {
  id: number;
  recommendedPower: number;
  enemyCount: number;
  rewardGold: number;
  bossId: string | null;
  waves?: Wave[];
}

export interface StageData {
  stages: StageDefinition[];
}

interface StageConfigRow {
  stage_id: number;
  chapter_id: number;
  recommended_power: number;
  enemy_count: number;
  reward_gold: number;
  boss_id: string | null;
  waves: Wave[];
}

const DEFAULT_SPAWN_AREAS: Record<string, { x: number; y: number }[]> = {
  top: [{ x: 0, y: 200 }],
  bottom: [{ x: 0, y: -200 }],
  left: [{ x: -300, y: 0 }],
  right: [{ x: 300, y: 0 }],
  center: [{ x: 0, y: 0 }],
  front: [
    { x: -150, y: -150 },
    { x: 150, y: -150 },
  ],
  back: [
    { x: -150, y: 150 },
    { x: 150, y: 150 },
  ],
  random: [
    { x: -300, y: 200 },
    { x: 0, y: 200 },
    { x: 300, y: 200 },
    { x: -300, y: 0 },
    { x: 300, y: 0 },
    { x: -300, y: -200 },
    { x: 0, y: -200 },
    { x: 300, y: -200 },
  ],
};

const ENEMY_TYPES = {
  basic: ['smile_zombie', 'slime'],
  mid: ['smile_zombie', 'slime', 'bomb_imp', 'hellhound', 'pitcher_imp'],
  advanced: ['smile_zombie', 'slime', 'bomb_imp', 'hellhound', 'shield_zombie', 'pitcher_imp', 'toxic_slime', 'summoner_priest'],
  elite: ['elite_jumper', 'elite_drummer', 'shield_zombie', 'hellhound', 'pitcher_imp', 'toxic_slime', 'summoner_priest'],
};
const VALID_ENEMY_TYPES = new Set([
  'smile_zombie',
  'slime',
  'bomb_imp',
  'hellhound',
  'shield_zombie',
  'elite_jumper',
  'elite_drummer',
  'pitcher_imp',
  'toxic_slime',
  'summoner_priest',
]);

const BOSS_STAGES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const BOSS_IDS: Record<number, string> = {
  10: 'boss_clown_zombie',
  20: 'boss_hell_drummer',
  30: 'boss_dark_shaman',
  40: 'boss_abyss_knight',
  50: 'boss_fire_lord',
  60: 'boss_ice_witch',
  70: 'boss_thunder_golem',
  80: 'boss_shadow_assassin',
  90: 'boss_demon_king',
  100: 'boss_avatar_of_void',
};

let stageData: StageData | null = null;

function sanitizeStageData(data: StageData): StageData {
  return {
    stages: data.stages.map((stage) => ({
      ...stage,
      waves: stage.waves?.map((wave) => ({
        ...wave,
        enemies: wave.enemies.map((enemy) => ({
          ...enemy,
          type: VALID_ENEMY_TYPES.has(enemy.type) ? enemy.type : 'smile_zombie',
        })),
      })),
    })),
  };
}

function rowToStageDefinition(row: StageConfigRow): StageDefinition {
  return {
    id:               row.stage_id,
    recommendedPower: row.recommended_power,
    enemyCount:       row.enemy_count,
    rewardGold:       row.reward_gold,
    bossId:           row.boss_id,
    waves:            Array.isArray(row.waves) ? row.waves : [],
  };
}

function getEnemyPoolForStage(stageId: number): string[] {
  if (stageId <= 20) return ENEMY_TYPES.basic;
  if (stageId <= 24) return ['smile_zombie', 'slime', 'bomb_imp', 'hellhound', 'pitcher_imp'];
  if (stageId <= 29) return ['smile_zombie', 'slime', 'bomb_imp', 'hellhound', 'shield_zombie', 'pitcher_imp', 'summoner_priest'];
  if (stageId <= 49) return ['smile_zombie', 'slime', 'bomb_imp', 'hellhound', 'shield_zombie', 'pitcher_imp', 'toxic_slime', 'summoner_priest'];
  if (stageId <= 69) return ENEMY_TYPES.advanced;
  return ENEMY_TYPES.elite;
}

function getSupportEnemyForStage(stageId: number): string | null {
  if (stageId >= 25 && stageId < 30) return 'summoner_priest';
  if (stageId >= 30 && stageId < 50) return stageId % 2 === 0 ? 'toxic_slime' : 'summoner_priest';
  if (stageId >= 50) return stageId % 3 === 0 ? 'summoner_priest' : stageId % 2 === 0 ? 'toxic_slime' : 'pitcher_imp';
  return null;
}

function getBossId(stageId: number): string | null {
  if (BOSS_STAGES.includes(stageId)) {
    return BOSS_IDS[stageId] ?? `boss_stage_${stageId}`;
  }
  return null;
}

function getWaveCount(stageId: number): number {
  if (stageId <= 30) return 3 + Math.floor(stageId / 10);
  if (stageId <= 60) return 5 + Math.floor(stageId / 10);
  return Math.min(8 + Math.floor(stageId / 10), 12);
}

function seededIndex(pool: unknown[], stageId: number, waveIndex: number): number {
  return (stageId * 7 + waveIndex * 13) % pool.length;
}

function generateStageFromId(stageId: number): StageDefinition {
  const basePower = 100 * Math.pow(1.12, stageId - 1);
  const waveCount = getWaveCount(stageId);
  const baseEnemies = 18 + stageId * 4;
  const enemiesPerWave = Math.ceil(baseEnemies / waveCount);
  const enemyPool = getEnemyPoolForStage(stageId);
  const areas = ['bottom', 'top', 'left', 'right', 'center', 'random', 'front', 'back'];
  const supportEnemy = getSupportEnemyForStage(stageId);

  const waveConfigs: Wave[] = [];
  for (let i = 0; i < waveCount; i++) {
    const hasElite = stageId >= 15 && (stageId * 3 + i * 11) % 5 === 0;
    const mainEnemy = enemyPool[seededIndex(enemyPool, stageId, i)];
    const supportWave = !!supportEnemy && stageId >= 21 && (i + stageId) % 3 === 0;
    const enemies: WaveEnemy[] = [];
    let remainingCount = Math.max(1, enemiesPerWave - (hasElite ? 2 : 0));

    if (supportWave && supportEnemy) {
      const supportCount = supportEnemy === 'summoner_priest' ? 2 : Math.max(2, Math.floor(enemiesPerWave * 0.35));
      enemies.push({ type: supportEnemy, count: supportCount });
      remainingCount = Math.max(1, remainingCount - supportCount);
    }

    enemies.push({ type: mainEnemy, count: remainingCount });

    if (hasElite) {
      const eliteType = stageId >= 50 ? 'elite_drummer' : 'elite_jumper';
      enemies.push({ type: eliteType, count: 2 });
    }

    waveConfigs.push({
      spawnDelay: 0.5 + i * 1.0,
      enemies,
      spawnArea: areas[i % areas.length],
    });
  }

  return {
    id: stageId,
    recommendedPower: Math.floor(basePower),
    enemyCount: baseEnemies,
    rewardGold: 40 + stageId * 15,
    bossId: getBossId(stageId),
    waves: waveConfigs,
  };
}

export class StageRepository {
  static loadAsync(): Promise<boolean> {
    return new Promise((resolve) => this.load(resolve));
  }

  static load(callback: (success: boolean) => void): void {
    if (stageData) {
      callback(true);
      return;
    }

    if (!SupabaseClient.isConfigured()) {
      console.warn('[StageRepository] Supabase not configured, using generated stage data');
      callback(false);
      return;
    }

    SupabaseClient.queryList<StageConfigRow>('stage_configs', 'order=stage_id.asc')
      .then((rows) => {
        if (rows && rows.length > 0) {
          stageData = sanitizeStageData({ stages: rows.map(rowToStageDefinition) });
          console.log(`[StageRepository] Loaded ${rows.length} stages from Supabase`);
          callback(true);
        } else {
          console.warn('[StageRepository] No stage data in Supabase, using generated data');
          callback(false);
        }
      })
      .catch((error) => {
        console.warn('[StageRepository] Supabase load failed, using generated data:', error);
        callback(false);
      });
  }

  static getStage(stageId: number): StageDefinition {
    if (stageData && stageData.stages && stageData.stages.length > 0) {
      const stage = stageData.stages.find((s) => s && s.id === stageId);
      if (stage) {
        return stage;
      }
    }
    return generateStageFromId(stageId);
  }

  static getStageWaves(stageId: number): Wave[] {
    const stage = this.getStage(stageId);
    if (stage && stage.waves && stage.waves.length > 0) {
      return stage.waves;
    }
    return generateStageFromId(stageId).waves ?? [];
  }

  static getSpawnPosition(area: string): { x: number; y: number } {
    const positions = DEFAULT_SPAWN_AREAS[area] ?? DEFAULT_SPAWN_AREAS.random;
    const index = Math.floor(Math.random() * positions.length);
    return positions[index];
  }

  static getBossId(stageId: number): string | null {
    return getBossId(stageId);
  }

  static isBossStage(stageId: number): boolean {
    return BOSS_STAGES.includes(stageId);
  }
}
