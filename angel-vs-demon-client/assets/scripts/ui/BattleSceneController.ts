import {
  _decorator,
  Button,
  Canvas,
  Color,
  Component,
  Graphics,
  Label,
  Node,
  Sprite,
  SpriteFrame,
  UITransform,
  UIOpacity,
  Vec3,
  director,
  resources,
} from 'cc';
import { AutoAimSystem } from '../game/player/AutoAimSystem';
import { PlayerController } from '../game/player/PlayerController';
import { SwordWeapon } from '../game/player/SwordWeapon';
import { EnemyController } from '../game/enemy/EnemyController';
import { BossController } from '../game/enemy/BossController';
import { StageManager } from '../game/stage/StageManager';
import { StageRepository, Wave } from '../data/StageRepository';
import { DebugShape } from './DebugShape';
import { SCENE_NAMES } from '../core/GameConfig';
import { ProfileService } from '../auth/ProfileService';
import { EventBus } from '../core/EventBus';
import { SoundManager } from '../audio/SoundManager';
import { BackgroundArt } from './BackgroundArt';
import { SpriteArt } from './SpriteArt';
import { SpriteSheetAnimator } from './SpriteSheetAnimator';
import { HoverMotion } from './HoverMotion';
import { DirectionalSpriteAnimator } from './DirectionalSpriteAnimator';
import { ProceduralBackground } from './ProceduralBackground';
import { GameDataRepository } from '../data/GameDataRepository';

const { ccclass } = _decorator;

@ccclass('BattleSceneController')
export class BattleSceneController extends Component {
  private static readonly SPAWN_AREA_VARIANTS: Record<string, string[]> = {
    top: ['top', 'top', 'left', 'right', 'back', 'random'],
    bottom: ['bottom', 'bottom', 'left', 'right', 'front', 'random'],
    left: ['left', 'left', 'top', 'bottom', 'front', 'random'],
    right: ['right', 'right', 'top', 'bottom', 'back', 'random'],
    center: ['left', 'right', 'top', 'bottom', 'front', 'back', 'random'],
    front: ['front', 'bottom', 'left', 'right', 'random'],
    back: ['back', 'top', 'left', 'right', 'random'],
    random: ['top', 'bottom', 'left', 'right', 'front', 'back', 'random'],
  };

  private stageManager: StageManager | null = null;
  private hudLabel: Label | null = null;
  private skillCooldownLabel: Label | null = null;
  private playerController: PlayerController | null = null;
  private swordWeaponRef: SwordWeapon | null = null;
  private baseWeaponDamage = 0;
  private resultShown = false;

  // 스킬 쿨다운: 현재 경과 / 최대 쿨다운
  private readonly SKILL_COOLDOWNS = {
    skill_star_burst:    4,
    skill_guardian_aura: 5,
    skill_heaven_strike: 6,
    skill_holy_dash:     8,
  } as const;

  private starBurstElapsed = 0;
  private guardianAuraElapsed = 0;
  private heavenStrikeElapsed = 0;
  private holyDashElapsed = 0;

  private gameStarted = false;
  private startPromptNode: Node | null = null;
  private spawnQueue: Array<{ type: string; spawnArea: string; spawnIn: number }> = [];

  private waves: Wave[] = [];
  private currentWaveIndex = 0;
  private waveTimer = 0;
  private stageLoaded = false;

  private killCount = 0;
  private killStreak = 0;
  private battleTimeElapsed = 0;
  private rewardGold = 0;
  private bossSpawned = false;
  private screenShakeTimer = 0;
  private screenShakeMagnitude = 0;

  // 보스 HP 바 UI
  private bossController: BossController | null = null;
  private bossHpBarFill: Node | null = null;
  private bossHpBarContainer: Node | null = null;

  private readonly onEnemyKilledHandler = (payload: unknown) => {
    const p = payload as { position: Vec3 };
    this.handleEnemyKilled(p.position);
  };
  private readonly onPlayerDamagedHandler = () => {
    this.handlePlayerDamaged();
  };
  private readonly onBossChargeHandler = (payload: unknown) => {
    const p = payload as { position: Vec3; direction: Vec3 };
    this.showBossChargeWarning(p.position, p.direction);
  };
  private readonly onBossPhaseHandler = (payload: unknown) => {
    const p = payload as { position: Vec3 };
    this.showBossPhaseWarning(p.position);
  };
  private readonly onBossSpecialHandler = (payload: unknown) => {
    const p = payload as { kind: 'nova' | 'summon' | 'frenzy'; position: Vec3; radius?: number; count?: number };
    this.showBossSpecialEffect(p);
  };
  private readonly onEnemySummonHandler = (payload: unknown) => {
    const p = payload as { summonType: string; count: number; position: Vec3; radius?: number };
    this.handleEnemySummon(p);
  };

  start(): void {
    this.ensureCanvas();
    this.ensureEnemyRoot();
    this.stageManager = this.ensureStageManager().getComponent(StageManager);
    this.ensureBackground();
    this.ensureHud();
    this.ensurePlayer();
    this.refreshHud();
    this.loadStageData();
    this.showStartPrompt();
    EventBus.on('enemy:killed', this.onEnemyKilledHandler);
    EventBus.on('player:damaged', this.onPlayerDamagedHandler);
    EventBus.on('boss:charge', this.onBossChargeHandler);
    EventBus.on('boss:phase', this.onBossPhaseHandler);
    EventBus.on('boss:special', this.onBossSpecialHandler);
    EventBus.on('enemy:summon', this.onEnemySummonHandler);
  }

  onDestroy(): void {
    EventBus.off('enemy:killed', this.onEnemyKilledHandler);
    EventBus.off('player:damaged', this.onPlayerDamagedHandler);
    EventBus.off('boss:charge', this.onBossChargeHandler);
    EventBus.off('boss:phase', this.onBossPhaseHandler);
    EventBus.off('boss:special', this.onBossSpecialHandler);
    EventBus.off('enemy:summon', this.onEnemySummonHandler);
  }

  private loadStageData(): void {
    const stageId = this.stageManager?.getCurrentStageId() ?? 1;
    this.waves = StageRepository.getStageWaves(stageId);
    this.currentWaveIndex = 0;
    this.waveTimer = 0;
    this.spawnQueue = [];
    this.stageLoaded = true;
  }

  update(deltaTime: number): void {
    if (!this.stageLoaded || this.resultShown) return;

    if (!this.gameStarted) {
      if (this.playerController?.hasStartedMoving()) {
        this.gameStarted = true;
        if (this.startPromptNode?.isValid) this.startPromptNode.destroy();
        this.startPromptNode = null;
      } else {
        return;
      }
    }

    this.battleTimeElapsed += deltaTime;
    this.waveTimer += deltaTime;
    this.updateScreenShake(deltaTime);
    this.processSpawnQueue(deltaTime);
    this.spawnNextWave();
    this.updateSkills(deltaTime);
    this.refreshHud();
    this.refreshBossHpBar();
    this.checkBattleFailed();
    this.checkStageClear();
  }

  // ─── 웨이브 스폰 ───────────────────────────────────────────────────────

  private spawnNextWave(): void {
    if (this.currentWaveIndex >= this.waves.length) return;

    const currentWave = this.waves[this.currentWaveIndex];
    if (this.waveTimer >= currentWave.spawnDelay) {
      this.spawnWaveEnemies(currentWave);
      this.currentWaveIndex++;
      this.waveTimer = 0;
    }
  }

  private showStartPrompt(): void {
    const canvas = this.ensureCanvas();
    const node = new Node('StartPrompt');
    node.addComponent(UITransform).setContentSize(600, 50);
    node.setPosition(0, 0);
    const label = node.addComponent(Label);
    label.string = 'WASD / 방향키 이동, SPACE 공격';
    label.fontSize = 26;
    label.color = new Color(255, 240, 120, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    canvas.addChild(node);
    this.startPromptNode = node;
  }

  private processSpawnQueue(deltaTime: number): void {
    if (this.spawnQueue.length === 0) return;

    for (const entry of this.spawnQueue) {
      entry.spawnIn -= deltaTime;
    }

    const readyEntries = this.spawnQueue
      .filter((entry) => entry.spawnIn <= 0)
      .sort((a, b) => a.spawnIn - b.spawnIn)
      .slice(0, 3);

    if (readyEntries.length === 0) {
      return;
    }

    this.spawnQueue = this.spawnQueue.filter((entry) => entry.spawnIn > 0);
    for (const entry of readyEntries) {
      this.spawnEnemy(entry.type, this.createSpawnPosition(entry.spawnArea));
    }
  }

  private spawnWaveEnemies(wave: Wave): void {
    const entries = wave.enemies.flatMap((waveEnemy) =>
      Array.from({ length: waveEnemy.count }, (_, index) => ({
        type: waveEnemy.type,
        enemyIndex: index,
      })),
    );

    const randomizedEntries = entries
      .map((entry, index) => ({
        ...entry,
        sortKey: Math.random() + index * 0.03,
      }))
      .sort((a, b) => a.sortKey - b.sortKey);

    let cumulativeDelay = 0;
    randomizedEntries.forEach((entry, index) => {
      cumulativeDelay += this.getSpawnInterval(index, randomizedEntries.length);
      this.spawnQueue.push({
        type: entry.type,
        spawnArea: this.pickSpawnAreaVariant(wave.spawnArea, index),
        spawnIn: cumulativeDelay,
      });
    });
  }

  private getSpawnInterval(index: number, total: number): number {
    const densityBias = total >= 10 ? 0.05 : total >= 6 ? 0.08 : 0.1;
    const pulse = index > 0 && index % 4 === 0 ? 0.24 : 0;
    return densityBias + Math.random() * 0.16 + pulse;
  }

  private pickSpawnAreaVariant(baseArea: string, index: number): string {
    const variants = BattleSceneController.SPAWN_AREA_VARIANTS[baseArea] ?? BattleSceneController.SPAWN_AREA_VARIANTS.random;
    const seeded = variants[index % variants.length];
    if (Math.random() < 0.35) {
      return variants[Math.floor(Math.random() * variants.length)];
    }
    return seeded;
  }

  private createSpawnPosition(area: string): Vec3 {
    const pos = StageRepository.getSpawnPosition(area);
    const spread = area === 'center' ? 200 : area === 'random' ? 180 : 120;
    const skewX = area === 'left' ? -24 : area === 'right' ? 24 : 0;
    const skewY = area === 'top' || area === 'back' ? 24 : area === 'bottom' || area === 'front' ? -24 : 0;
    return new Vec3(
      pos.x + skewX + (Math.random() - 0.5) * spread,
      pos.y + skewY + (Math.random() - 0.5) * spread,
      0,
    );
  }

  private spawnEnemy(enemyType: string, position: Vec3): void {
    const enemyRoot = this.ensureEnemyRoot();
    const enemy = new Node(`Enemy_${enemyType}_${Date.now()}_${Math.random()}`);
    enemy.setPosition(position);

    const baseColorMap: Record<string, Color> = {
      smile_zombie:  new Color(255,  80,  80, 255),
      slime:         new Color( 60, 230,  90, 255),
      bomb_imp:      new Color(255, 130,  20, 255),
      hellhound:     new Color(160,  50, 210, 255),
      shield_zombie: new Color(120, 140, 200, 255),
      elite_jumper:  new Color(240, 200,  30, 255),
      elite_drummer: new Color(210,  50, 200, 255),
      pitcher_imp:   new Color(255, 170,  50, 255),
      toxic_slime:   new Color( 80, 255, 140, 255),
      summoner_priest: new Color(190, 120, 255, 255),
    };
    const base = baseColorMap[enemyType] ?? new Color(255, 120, 120, 255);
    const jitter = () => Math.floor((Math.random() - 0.5) * 30);
    const color = new Color(
      Math.max(30, Math.min(255, base.r + jitter())),
      Math.max(30, Math.min(255, base.g + jitter())),
      Math.max(30, Math.min(255, base.b + jitter())),
      255,
    );

    const stageId = this.stageManager?.getCurrentStageId() ?? 1;
    const stats = GameDataRepository.getEnemyStat(enemyType, stageId);

    const sizeMap: Record<string, [number, number]> = {
      smile_zombie:  [38, 38],
      slime:         [42, 34],
      bomb_imp:      [32, 32],
      hellhound:     [40, 44],
      shield_zombie: [52, 44],
      elite_jumper:  [36, 52],
      elite_drummer: [54, 42],
      pitcher_imp:   [38, 42],
      toxic_slime:   [46, 36],
      summoner_priest: [40, 54],
    };
    const [sw, sh] = sizeMap[enemyType] ?? [40, 40];

    const circleTypes = new Set(['smile_zombie', 'slime', 'bomb_imp', 'hellhound', 'elite_jumper', 'pitcher_imp', 'toxic_slime']);
    const isCircle = circleTypes.has(enemyType);

    enemy.addComponent(UITransform).setContentSize(sw, sh);
    const shape = enemy.addComponent(DebugShape);
    shape.fillColor = new Color(color.r, color.g, color.b, 24);
    shape.width = sw;
    shape.height = sh;
    shape.isCircle = isCircle;
    shape.suppressRendering = true;

    const artMap: Record<string, { path: string; width: number; height: number; y: number }> = {
      smile_zombie:    { path: 'images/characters/enemy_smile_zombie',    width: 64, height: 64, y: 4 },
      shield_zombie:   { path: 'images/characters/enemy_shield_zombie',   width: 72, height: 72, y: 6 },
      slime:           { path: 'images/characters/enemy_slime',           width: 52, height: 44, y: -2 },
      bomb_imp:        { path: 'images/characters/enemy_bomb_imp',        width: 64, height: 64, y: 4 },
      hellhound:       { path: 'images/characters/enemy_hellhound',       width: 76, height: 68, y: 6 },
      elite_jumper:    { path: 'images/characters/enemy_elite_jumper',    width: 72, height: 84, y: 8 },
      elite_drummer:   { path: 'images/characters/enemy_elite_drummer',   width: 72, height: 74, y: 6 },
      pitcher_imp:     { path: 'images/characters/enemy_pitcher_imp',     width: 64, height: 68, y: 4 },
      toxic_slime:     { path: 'images/characters/enemy_toxic_slime',     width: 60, height: 52, y: -2 },
      summoner_priest: { path: 'images/characters/enemy_summoner_priest', width: 72, height: 86, y: 8 },
    };
    const art = artMap[enemyType] ?? artMap['smile_zombie'];
    SpriteArt.attach(enemy, 'EnemySprite', art.path, art.width, art.height, art.y, {
      frameRect: { x: 0, y: 0, width: 128, height: 128 },
    });
    const enemySpriteNode = enemy.getChildByName('EnemySprite');
    if (enemySpriteNode) {
      const F = 128;
      const animator = enemySpriteNode.getComponent(DirectionalSpriteAnimator)
        ?? enemySpriteNode.addComponent(DirectionalSpriteAnimator);
      animator.setup(art.path, {
        south_idle:  [{ x: 0, y: 0, width: F, height: F }, { x: F, y: 0, width: F, height: F }],
        south_move:  [{ x: 0, y: 0, width: F, height: F }, { x: F, y: 0, width: F, height: F },
                      { x: 2*F, y: 0, width: F, height: F }, { x: 3*F, y: 0, width: F, height: F }],
        west_idle:   [{ x: 0, y: F, width: F, height: F }, { x: F, y: F, width: F, height: F }],
        west_move:   [{ x: 0, y: F, width: F, height: F }, { x: F, y: F, width: F, height: F },
                      { x: 2*F, y: F, width: F, height: F }, { x: 3*F, y: F, width: F, height: F }],
        north_idle:  [{ x: 0, y: 2*F, width: F, height: F }, { x: F, y: 2*F, width: F, height: F }],
        north_move:  [{ x: 0, y: 2*F, width: F, height: F }, { x: F, y: 2*F, width: F, height: F },
                      { x: 2*F, y: 2*F, width: F, height: F }, { x: 3*F, y: 2*F, width: F, height: F }],
        east_idle:   [{ x: 0, y: 3*F, width: F, height: F }, { x: F, y: 3*F, width: F, height: F }],
        east_move:   [{ x: 0, y: 3*F, width: F, height: F }, { x: F, y: 3*F, width: F, height: F },
                      { x: 2*F, y: 3*F, width: F, height: F }, { x: 3*F, y: 3*F, width: F, height: F }],
      }, 8);
    }

    const ctrl = enemy.addComponent(EnemyController);
    ctrl.maxHp         = stats.hp;
    ctrl.contactDamage = stats.damage;
    ctrl.moveSpeed     = Math.round(stats.speed * (0.85 + Math.random() * 0.3));

    enemyRoot.addChild(enemy);
  }

  private spawnBoss(bossId: string): void {
    const enemyRoot = this.ensureEnemyRoot();
    const boss = new Node(`Boss_${bossId}`);
    boss.setPosition(new Vec3(0, 220, 0));

    const bossData = GameDataRepository.getBossStat(bossId);

    boss.addComponent(UITransform).setContentSize(64, 64);
    const shape = boss.addComponent(DebugShape);
    shape.fillColor = new Color(200, 50, 220, 24);
    shape.width = 64;
    shape.height = 64;
    shape.isCircle = true;
    shape.suppressRendering = true;

    const bossArtMap: Record<string, { path: string; width: number; height: number; y: number; color?: Color }> = {
      boss_clown_zombie: { path: 'images/characters/enemy_zombie', width: 112, height: 112, y: 10, color: new Color(255, 170, 170, 255) },
      boss_hell_drummer: { path: 'images/characters/enemy_ghost', width: 118, height: 118, y: 14, color: new Color(220, 130, 255, 255) },
      boss_dark_shaman: { path: 'images/characters/enemy_ghost', width: 114, height: 120, y: 12, color: new Color(165, 110, 255, 255) },
      boss_abyss_knight: { path: 'images/characters/player_knight', width: 120, height: 120, y: 12, color: new Color(205, 175, 255, 255) },
      boss_fire_lord: { path: 'images/characters/boss_devil', width: 126, height: 126, y: 12, color: new Color(255, 170, 90, 255) },
      boss_ice_witch: { path: 'images/characters/enemy_ghost', width: 116, height: 124, y: 12, color: new Color(170, 230, 255, 255) },
      boss_thunder_golem: { path: 'images/characters/enemy_demonario', width: 132, height: 132, y: 10, color: new Color(255, 220, 110, 255) },
      boss_shadow_assassin: { path: 'images/characters/player_knight', width: 116, height: 116, y: 10, color: new Color(165, 165, 215, 255) },
      boss_demon_king: { path: 'images/characters/boss_devil', width: 144, height: 144, y: 14, color: new Color(255, 110, 110, 255) },
      boss_avatar_of_void: { path: 'images/characters/boss_devil', width: 152, height: 152, y: 18, color: new Color(180, 110, 255, 255) },
    };
    const bossArt = bossArtMap[bossId] ?? {
      path: 'images/characters/boss_devil',
      width: 120,
      height: 120,
      y: 12,
      color: new Color(255, 255, 255, 255),
    };
    SpriteArt.attach(boss, 'BossSprite', bossArt.path, bossArt.width, bossArt.height, bossArt.y, {
      color: bossArt.color,
      frameRect:
        bossArt.path === 'images/characters/player_knight'
          ? { x: 0, y: 144, width: 64, height: 48 }
        : bossArt.path === 'images/characters/enemy_zombie'
          ? { x: 0, y: 192, width: 64, height: 64 }
        : bossArt.path === 'images/characters/enemy_ghost'
          ? { x: 86, y: 86, width: 86, height: 86 }
        : bossArt.path === 'images/characters/enemy_demonario'
          ? { x: 0, y: 249, width: 81, height: 83 }
          : undefined,
    });
    const bossSpriteNode = boss.getChildByName('BossSprite');
    if (bossSpriteNode && bossArt.path === 'images/characters/enemy_ghost') {
      const hover = bossSpriteNode.getComponent(HoverMotion) ?? bossSpriteNode.addComponent(HoverMotion);
      hover.amplitude = 8;
      hover.frequency = 1.8;
      hover.scaleAmplitude = 0.03;
    }

    const bossController = boss.addComponent(BossController);
    bossController.maxHp        = bossData.maxHp;
    bossController.moveSpeed    = bossData.moveSpeed;
    bossController.contactDamage = bossData.contactDamage;
    bossController.contactRange = 50;

    bossController.configure({
      chargeInterval:  bossData.chargeInterval,
      chargeSpeed:     bossData.chargeSpeed,
      minionType:      bossData.minionType,
      minionCount:     bossData.minionCount,
      specialPattern:  bossData.specialPattern,
      specialCooldown: bossData.specialCooldown,
    });
    bossController.setSpawnMinionsCallback(() => {
      for (let i = 0; i < bossController.minionCount; i++) {
        const offset = new Vec3((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, 0);
        const minionPos = boss.position.clone().add(offset);
        this.spawnEnemy(bossController.minionType, minionPos);
      }
    });

    enemyRoot.addChild(boss);

    this.bossController = bossController;
    this.createBossHpBar(bossId);
  }

  // ─── 스킬 ──────────────────────────────────────────────────────────────

  private updateSkills(deltaTime: number): void {
    if (this.playerController?.isDead()) return;

    this.starBurstElapsed += deltaTime;
    this.guardianAuraElapsed += deltaTime;
    this.heavenStrikeElapsed += deltaTime;
    this.holyDashElapsed += deltaTime;

    if (ProfileService.hasSkill('skill_star_burst') && this.starBurstElapsed >= 4) {
      this.starBurstElapsed = 0;
      this.castStarBurst();
    }
    if (ProfileService.hasSkill('skill_guardian_aura') && this.guardianAuraElapsed >= 5) {
      this.guardianAuraElapsed = 0;
      const auraLv = ProfileService.getSkillLevel('skill_guardian_aura');
      this.playerController?.heal(18 + (auraLv - 1) * 6);
    }
    if (ProfileService.hasSkill('skill_heaven_strike') && this.heavenStrikeElapsed >= 6) {
      this.heavenStrikeElapsed = 0;
      this.castHeavenStrike();
    }
    if (ProfileService.hasSkill('skill_holy_dash') && this.holyDashElapsed >= 8) {
      this.holyDashElapsed = 0;
      this.castHolyDash();
    }
  }

  private castStarBurst(): void {
    const weaponLv = ProfileService.getProfile()?.weaponLevel ?? 1;
    const skillLv = ProfileService.getSkillLevel('skill_star_burst');
    const burstDamage = 12 + weaponLv * 4 + (skillLv - 1) * 8;
    const burstRange = 280 + (skillLv - 1) * 30;
    const playerPos = this.playerController?.node.position ?? new Vec3(0, 0, 0);
    // 가까운 순으로 정렬 후 최대 히트 수 제한 — 전 범위 동시 사망 방지
    const maxHits = 3 + skillLv;
    const inRange = this.ensureEnemyRoot().children
      .filter(e => e.isValid && Vec3.distance(playerPos, e.position) <= burstRange)
      .sort((a, b) => Vec3.distance(playerPos, a.position) - Vec3.distance(playerPos, b.position));
    for (let i = 0; i < Math.min(inRange.length, maxHits); i++) {
      inRange[i].getComponent(EnemyController)?.receiveDamage(burstDamage);
    }
    this.showSkillBurst(playerPos, burstRange);
    this.triggerScreenShake(0.08, 7);
  }

  private castHeavenStrike(): void {
    const target = this.node.getChildByName('Player')?.getComponent(AutoAimSystem)?.getNearestEnemy();
    if (!target) return;
    const weaponLv = ProfileService.getProfile()?.weaponLevel ?? 1;
    const skillLv = ProfileService.getSkillLevel('skill_heaven_strike');
    const strikeDamage = 28 + weaponLv * 6 + (skillLv - 1) * 12;
    target.getComponent(EnemyController)?.receiveDamage(strikeDamage);
    this.showHeavenStrikeEffect(target.position.clone());
    this.triggerScreenShake(0.1, 9);
  }

  private castHolyDash(): void {
    if (!this.playerController) return;

    let direction = this.playerController.getMoveDirection();

    if (direction.lengthSqr() < 0.01) {
      const nearest = this.node
        .getChildByName('Player')
        ?.getComponent(AutoAimSystem)
        ?.getNearestEnemy();
      if (nearest) {
        const dir = new Vec3();
        Vec3.subtract(dir, nearest.position, this.playerController.node.position);
        direction = dir.normalize();
      }
    }

    this.playerController.applyDash(direction, 200);

    const weaponLv = ProfileService.getProfile()?.weaponLevel ?? 1;
    const skillLv = ProfileService.getSkillLevel('skill_holy_dash');
    const dashDamage = 20 + weaponLv * 5 + (skillLv - 1) * 8;
    const dashRange = 110 + (skillLv - 1) * 15;
    const playerPos = this.playerController.node.position;
    this.ensureEnemyRoot().children.forEach((enemyNode) => {
      if (Vec3.distance(playerPos, enemyNode.position) <= dashRange) {
        enemyNode.getComponent(EnemyController)?.receiveDamage(dashDamage);
      }
    });
    this.showHolyDashTrail(playerPos.clone(), dashRange);
    this.triggerScreenShake(0.06, 6);
  }

  // ─── 유물 이벤트 핸들러 ────────────────────────────────────────────────

  private handleEnemyKilled(position: Vec3): void {
    this.killCount++;
    this.killStreak++;
    this.showDeathPop(position);
    if (this.killStreak > 0 && this.killStreak % 8 === 0) {
      this.triggerScreenShake(0.05, 4);
    }

    // 빛의 성배: 5킬마다 무기 데미지 +10% (최대 50%)
    if (ProfileService.hasRelic('relic_holy_grail') && this.swordWeaponRef) {
      const streakBonus = Math.min(Math.floor(this.killStreak / 5) * 0.1, 0.5);
      this.swordWeaponRef.damage = Math.floor(this.baseWeaponDamage * (1 + streakBonus));
    }

    // 웃음 가면: 15% 확률로 주변 폭발
    if (ProfileService.hasRelic('relic_laughter_mask') && Math.random() < 0.15) {
      this.castLaughterMaskExplosion(position);
    }
  }

  private handlePlayerDamaged(): void {
    this.killStreak = 0;
    if (this.swordWeaponRef) {
      this.swordWeaponRef.damage = this.baseWeaponDamage;
    }
    this.showDamageFlash();
    this.triggerScreenShake(0.12, 10);
  }

  private castLaughterMaskExplosion(position: Vec3): void {
    const range = 100;
    const damage = 20;
    this.ensureEnemyRoot().children.forEach((enemyNode) => {
      if (Vec3.distance(position, enemyNode.position) <= range) {
        enemyNode.getComponent(EnemyController)?.receiveDamage(damage);
      }
    });
  }

  // ─── 전투 종료 ─────────────────────────────────────────────────────────

  private checkBattleFailed(): void {
    if (!this.playerController?.isDead()) return;

    this.freezeBattle();
    this.resultShown = true;
    SoundManager.playGameOver();
    this.showResultOverlay(false);
  }

  private checkStageClear(): void {
    if (this.playerController?.isDead()) return;
    if (!this.waves || this.waves.length === 0) return;
    if (this.currentWaveIndex < this.waves.length) return;
    if (this.spawnQueue.length > 0) return;

    const stageDef = this.stageManager?.getCurrentStageDefinition();

    // 보스 스테이지: 일반 적 전멸 후 보스 등장
    if (stageDef?.bossId && !this.bossSpawned) {
      if (this.ensureEnemyRoot().children.length === 0) {
        this.bossSpawned = true;
        this.spawnBoss(stageDef.bossId);
        if (this.hudLabel) {
          this.hudLabel.string += '\n⚠️ BOSS 등장!';
        }
        this.showBossSpawnWarning();
      }
      return;
    }

    if (this.ensureEnemyRoot().children.length > 0) return;

    // 클리어 처리
    this.freezeBattle();
    this.resultShown = true;
    this.stageManager?.markStageCleared();
    const baseGold = stageDef?.rewardGold ?? 0;
    this.rewardGold = ProfileService.applyRewardGoldBonus(baseGold);
    ProfileService.addGold(this.rewardGold);
    ProfileService.addKills(this.killCount);
    SoundManager.playStageClear();
    this.showResultOverlay(true);
  }

  private freezeBattle(): void {
    this.spawnQueue = [];
    this.spawnQueueTimer = 0;
    this.stageLoaded = false;
    this.gameStarted = false;

    if (this.playerController) {
      this.playerController.enabled = false;
      this.playerController.getComponent(AutoAimSystem)!.enabled = false;
      if (this.swordWeaponRef) {
        this.swordWeaponRef.enabled = false;
      }
    }

    this.ensureEnemyRoot().children.forEach((enemyNode) => {
      const enemy = enemyNode.getComponent(EnemyController);
      if (enemy) enemy.enabled = false;
      const boss = enemyNode.getComponent(BossController);
      if (boss) boss.enabled = false;
    });
  }

  // ─── 결과 오버레이 ─────────────────────────────────────────────────────

  private showResultOverlay(isVictory: boolean): void {
    const canvas = this.ensureCanvas();

    const overlay = new Node('ResultOverlay');
    overlay.addComponent(UITransform).setContentSize(1280, 720);
    const bgGraphics = overlay.addComponent(Graphics);
    bgGraphics.fillColor = new Color(0, 0, 0, 160);
    bgGraphics.rect(-640, -360, 1280, 720);
    bgGraphics.fill();
    canvas.addChild(overlay);

    const panel = new Node('ResultPanel');
    panel.setPosition(0, 0);
    panel.addComponent(UITransform).setContentSize(420, 340);
    const panelGraphics = panel.addComponent(Graphics);
    panelGraphics.fillColor = new Color(10, 18, 40, 236);
    panelGraphics.roundRect(-210, -170, 420, 340, 14);
    panelGraphics.fill();
    panelGraphics.fillColor = new Color(255, 255, 255, 12);
    panelGraphics.roundRect(-206, 24, 412, 140, 12);
    panelGraphics.fill();
    panelGraphics.strokeColor = isVictory ? new Color(255, 210, 50, 200) : new Color(200, 50, 50, 200);
    panelGraphics.lineWidth = 2;
    panelGraphics.roundRect(-210, -170, 420, 340, 14);
    panelGraphics.stroke();
    overlay.addChild(panel);

    let yPos = 130;
    const lineH = 34;

    this.addResultLabel(
      panel,
      isVictory ? 'STAGE CLEAR!' : 'GAME OVER',
      isVictory ? new Color(255, 210, 50, 255) : new Color(255, 70, 70, 255),
      yPos,
      32,
    );
    yPos -= lineH + 8;

    this.addResultLabel(
      panel,
      `Stage ${this.stageManager?.getCurrentStageId() ?? '?'}`,
      new Color(180, 180, 200, 255),
      yPos,
      20,
    );
    yPos -= lineH;

    const mins = Math.floor(this.battleTimeElapsed / 60);
    const secs = Math.floor(this.battleTimeElapsed % 60);
    this.addResultLabel(
      panel,
      `시간  ${mins}:${secs.toString().padStart(2, '0')}`,
      new Color(180, 180, 200, 255),
      yPos,
      20,
    );
    yPos -= lineH;

    this.addResultLabel(
      panel,
      `처치  ${this.killCount}`,
      new Color(180, 180, 200, 255),
      yPos,
      20,
    );
    yPos -= lineH;

    if (isVictory) {
      this.addResultLabel(
        panel,
        `골드 +${this.rewardGold}`,
        new Color(255, 200, 50, 255),
        yPos,
        20,
      );
      yPos -= lineH;
    }

    yPos -= 8;

    const btnY = yPos - 28;
    if (isVictory) {
      const nextBtn = this.createResultButton(panel, 'NEXT STAGE', -108, btnY);
      nextBtn.on('click', () => director.loadScene(SCENE_NAMES.Battle), this);
    } else {
      const retryBtn = this.createResultButton(panel, 'RETRY', -108, btnY);
      retryBtn.on('click', () => director.loadScene(SCENE_NAMES.Battle), this);
    }

    const lobbyBtn = this.createResultButton(panel, 'LOBBY', 108, btnY);
    lobbyBtn.on('click', () => director.loadScene(SCENE_NAMES.Lobby), this);
  }

  private addResultLabel(
    parent: Node,
    text: string,
    color: Color,
    y: number,
    fontSize: number,
  ): void {
    const node = new Node(text);
    node.addComponent(UITransform).setContentSize(380, fontSize + 10);
    node.setPosition(0, y);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 6;
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    parent.addChild(node);
  }

  private createResultButton(parent: Node, text: string, x: number, y: number): Node {
    const btn = new Node(text);
    btn.addComponent(UITransform).setContentSize(160, 44);
    btn.setPosition(x, y);

    const glowNode = new Node('BtnGlow');
    glowNode.setPosition(0, -4);
    glowNode.addComponent(UITransform).setContentSize(174, 54);
    const glow = glowNode.addComponent(Graphics);
    glow.fillColor = new Color(55, 95, 140, 60);
    glow.roundRect(-87, -27, 174, 54, 10);
    glow.fill();
    btn.addChild(glowNode);

    const bgNode = new Node('BtnBg');
    bgNode.setPosition(0, 0);
    bgNode.addComponent(UITransform).setContentSize(160, 44);
    const g = bgNode.addComponent(Graphics);
    g.fillColor = new Color(38, 72, 118, 224);
    g.roundRect(-80, -22, 160, 44, 8);
    g.fill();
    g.fillColor = new Color(255, 255, 255, 16);
    g.roundRect(-78, 1, 156, 16, 8);
    g.fill();
    g.strokeColor = new Color(120, 190, 245, 186);
    g.lineWidth = 1;
    g.roundRect(-80, -22, 160, 44, 8);
    g.stroke();
    btn.addChild(bgNode);

    const textNode = new Node('BtnText');
    textNode.setPosition(0, 0);
    textNode.addComponent(UITransform).setContentSize(156, 44);
    const label = textNode.addComponent(Label);
    label.string = text;
    label.fontSize = 16;
    label.color = new Color(244, 246, 255, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    btn.addChild(textNode);

    btn.addComponent(Button);
    btn.on('click', () => SoundManager.playUiClick(), this);
    parent.addChild(btn);
    return btn;
  }

  // ─── HUD ──────────────────────────────────────────────────────────────

  private refreshHud(): void {
    if (!this.hudLabel || !this.stageManager) return;

    const remaining = this.ensureEnemyRoot().children.length;
    const hp = this.playerController?.getCurrentHp() ?? 0;
    const maxHp = this.playerController?.getMaxHp() ?? 0;
    const stageId = this.stageManager.getCurrentStageId();
    const mins = Math.floor(this.battleTimeElapsed / 60);
    const secs = Math.floor(this.battleTimeElapsed % 60);

    const streakText =
      ProfileService.hasRelic('relic_holy_grail') && this.killStreak > 0
        ? `  스트릭: ${this.killStreak}`
        : '';

    this.hudLabel.string = [
      `Stage ${stageId}  Wave: ${this.currentWaveIndex}/${this.waves.length}  ${mins}:${secs.toString().padStart(2, '0')}`,
      `HP: ${hp}/${maxHp}  적: ${remaining}  처치: ${this.killCount}${streakText}`,
    ].join('\n');

    this.refreshSkillCooldownHud();
  }

  private refreshSkillCooldownHud(): void {
    if (!this.skillCooldownLabel) return;

    const profile = ProfileService.getProfile();
    if (!profile) return;

    const elapsedMap: Record<string, number> = {
      skill_star_burst:    this.starBurstElapsed,
      skill_guardian_aura: this.guardianAuraElapsed,
      skill_heaven_strike: this.heavenStrikeElapsed,
      skill_holy_dash:     this.holyDashElapsed,
    };
    const nameMap: Record<string, string> = {
      skill_star_burst:    '스타버스트',
      skill_guardian_aura: '가디언오라',
      skill_heaven_strike: '천벌낙하',
      skill_holy_dash:     '홀리대시',
    };

    const parts = profile.skillIds.map((id) => {
      const cd = this.SKILL_COOLDOWNS[id as keyof typeof this.SKILL_COOLDOWNS] ?? 0;
      const elapsed = elapsedMap[id] ?? 0;
      const remaining = Math.max(0, cd - elapsed);
      const name = nameMap[id] ?? id;
      return remaining <= 0 ? `[${name} ✓]` : `[${name} ${remaining.toFixed(1)}s]`;
    });

    this.skillCooldownLabel.string = parts.join('   ');
  }

  // ─── 시각 효과 ────────────────────────────────────────────────────────

  private ensureBackground(): void {
    if (this.node.getChildByName('Background') || this.node.getChildByName('ProceduralBg')) return;

    const stageId = this.stageManager?.getCurrentStageId() ?? 1;
    const theme = ProceduralBackground.getTheme(stageId);

    if (theme !== 'none') {
      // 절차적 배경 (이미지 없음)
      ProceduralBackground.apply(this.node, stageId);
    } else {
      // 기존 이미지 배경 (stage 101~300, 401~1000)
      BackgroundArt.apply(this.node, 'images/backgrounds/battle_forest', {
        overlayColor: new Color(6, 10, 16, 255),
        overlayAlpha: 96,
      });

      // 아레나 그리드 오버레이 (이미지 배경에만 추가)
      const bg = new Node('Background');
      bg.setPosition(0, 0);
      bg.addComponent(UITransform).setContentSize(1280, 720);
      const g = bg.addComponent(Graphics);

      g.strokeColor = new Color(32, 48, 72, 115);
      g.lineWidth = 1;
      for (let x = -640; x <= 640; x += 80) {
        g.moveTo(x, -360); g.lineTo(x, 360); g.stroke();
      }
      for (let y = -360; y <= 360; y += 80) {
        g.moveTo(-640, y); g.lineTo(640, y); g.stroke();
      }

      g.strokeColor = new Color(55, 55, 110, 210);
      g.lineWidth = 2;
      g.rect(-575, -312, 1150, 624);
      g.stroke();

      this.node.addChild(bg);
      bg.setSiblingIndex(1);
    }
  }

  private createBossHpBar(bossId: string): void {
    const canvas = this.ensureCanvas();

    // HUD(x=-430, w=360) 오른쪽: x=150 에 배치 → 겹침 없음
    const container = new Node('BossHpBar');
    container.setPosition(150, 325);
    container.addComponent(UITransform).setContentSize(480, 52);
    canvas.addChild(container);
    this.bossHpBarContainer = container;

    const nameNode = new Node('BossName');
    nameNode.setPosition(0, 20);
    nameNode.addComponent(UITransform).setContentSize(440, 20);
    const nameLabel = nameNode.addComponent(Label);
    nameLabel.string = this.getBossDisplayName(bossId);
    nameLabel.fontSize = 16;
    nameLabel.color = new Color(255, 100, 100, 255);
    nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    container.addChild(nameNode);

    const barBg = new Node('BarBg');
    barBg.setPosition(0, -4);
    barBg.addComponent(UITransform).setContentSize(440, 16);
    const bgG = barBg.addComponent(Graphics);
    bgG.fillColor = new Color(40, 10, 10, 230);
    bgG.roundRect(-220, -8, 440, 16, 4);
    bgG.fill();
    bgG.strokeColor = new Color(120, 20, 20, 180);
    bgG.lineWidth = 1;
    bgG.roundRect(-220, -8, 440, 16, 4);
    bgG.stroke();
    container.addChild(barBg);

    const barFill = new Node('BarFill');
    barFill.setPosition(-220, 0);
    barFill.addComponent(UITransform).setContentSize(436, 12);
    const fillG = barFill.addComponent(Graphics);
    fillG.fillColor = new Color(220, 50, 50, 255);
    fillG.roundRect(0, -6, 436, 12, 3);
    fillG.fill();
    barBg.addChild(barFill);

    this.bossHpBarFill = barFill;
  }

  private getBossDisplayName(bossId: string): string {
    return GameDataRepository.getBossStat(bossId).displayName;
  }

  private refreshBossHpBar(): void {
    if (!this.bossController || !this.bossHpBarFill) return;

    if (!this.bossController.isValid || !this.bossController.node.isValid) {
      this.bossHpBarContainer?.destroy();
      this.bossHpBarContainer = null;
      this.bossHpBarFill = null;
      this.bossController = null;
      return;
    }

    const ratio = this.bossController.getHpRatio();
    const fillWidth = Math.max(0, 436 * ratio);
    const transform = this.bossHpBarFill.getComponent(UITransform);
    if (transform) transform.setContentSize(fillWidth, 12);

    const g = this.bossHpBarFill.getComponent(Graphics);
    if (g && fillWidth > 0) {
      g.clear();
      g.fillColor = ratio > 0.5
        ? new Color(220, 50, 50, 255)
        : new Color(255, 80, 20, 255);
      g.roundRect(0, -6, fillWidth, 12, 3);
      g.fill();
    }
  }

  private showDamageFlash(): void {
    const canvas = this.ensureCanvas();
    const flash = new Node('DmgFlash');
    flash.setPosition(0, 0);
    flash.addComponent(UITransform).setContentSize(1280, 720);
    const g = flash.addComponent(Graphics);
    g.fillColor = new Color(255, 20, 20, 65);
    g.rect(-640, -360, 1280, 720);
    g.fill();
    canvas.addChild(flash);
    this.scheduleOnce(() => { if (flash.isValid) flash.destroy(); }, 0.1);
  }

  private showBossSpawnWarning(): void {
    this.showTopWarning('BOSS INCOMING', new Color(255, 90, 90, 255));
    this.triggerScreenShake(0.18, 12);
  }

  private showBossPhaseWarning(position: Vec3): void {
    this.showTopWarning('PHASE SHIFT', new Color(255, 180, 80, 255));
    const fx = new Node('BossPhaseFx');
    fx.setParent(this.node);
    fx.setPosition(position.x, position.y, 0);
    fx.addComponent(UITransform).setContentSize(220, 220);
    const g = fx.addComponent(Graphics);
    g.strokeColor = new Color(255, 120, 80, 190);
    g.lineWidth = 6;
    g.circle(0, 0, 76);
    g.stroke();
    g.strokeColor = new Color(255, 220, 120, 160);
    g.lineWidth = 3;
    g.circle(0, 0, 104);
    g.stroke();
    this.scheduleOnce(() => { if (fx.isValid) fx.destroy(); }, 0.25);
    this.triggerScreenShake(0.16, 11);
  }

  private showBossChargeWarning(position: Vec3, direction: Vec3): void {
    this.showTopWarning('DANGER', new Color(255, 120, 120, 255));
    const fx = new Node('BossChargeFx');
    fx.setParent(this.node);
    fx.setPosition(position.x, position.y, 0);
    fx.addComponent(UITransform).setContentSize(360, 60);
    fx.setRotationFromEuler(0, 0, Math.atan2(direction.y, direction.x) * (180 / Math.PI));
    const g = fx.addComponent(Graphics);
    g.fillColor = new Color(255, 80, 80, 58);
    g.roundRect(0, -18, 260, 36, 14);
    g.fill();
    g.strokeColor = new Color(255, 190, 190, 200);
    g.lineWidth = 2;
    g.roundRect(0, -18, 260, 36, 14);
    g.stroke();
    this.scheduleOnce(() => { if (fx.isValid) fx.destroy(); }, 0.2);
    this.triggerScreenShake(0.08, 7);
  }

  private showBossSpecialEffect(payload: { kind: 'nova' | 'summon' | 'frenzy'; position: Vec3; radius?: number; count?: number }): void {
    if (payload.kind === 'nova') {
      this.showTopWarning('VOID NOVA', new Color(255, 180, 100, 255));
      const fx = new Node('BossNovaFx');
      fx.setParent(this.node);
      fx.setPosition(payload.position.x, payload.position.y, 0);
      const radius = payload.radius ?? 150;
      fx.addComponent(UITransform).setContentSize(radius * 2, radius * 2);
      const g = fx.addComponent(Graphics);
      g.strokeColor = new Color(255, 140, 80, 180);
      g.lineWidth = 6;
      g.circle(0, 0, radius * 0.55);
      g.stroke();
      g.strokeColor = new Color(255, 240, 180, 120);
      g.lineWidth = 2;
      g.circle(0, 0, radius * 0.8);
      g.stroke();
      this.scheduleOnce(() => { if (fx.isValid) fx.destroy(); }, 0.24);
      this.triggerScreenShake(0.1, 9);
      return;
    }

    if (payload.kind === 'summon') {
      this.showTopWarning(`SUMMON x${payload.count ?? 0}`, new Color(180, 255, 120, 255));
      const fx = new Node('BossSummonFx');
      fx.setParent(this.node);
      fx.setPosition(payload.position.x, payload.position.y, 0);
      fx.addComponent(UITransform).setContentSize(180, 180);
      const g = fx.addComponent(Graphics);
      g.strokeColor = new Color(170, 255, 140, 180);
      g.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const r = 28 + i * 18;
        g.circle(0, 0, r);
        g.stroke();
      }
      this.scheduleOnce(() => { if (fx.isValid) fx.destroy(); }, 0.24);
      return;
    }

    this.showTopWarning('BERSERK', new Color(255, 120, 220, 255));
    const fx = new Node('BossFrenzyFx');
    fx.setParent(this.node);
    fx.setPosition(payload.position.x, payload.position.y, 0);
    fx.addComponent(UITransform).setContentSize(220, 100);
    const g = fx.addComponent(Graphics);
    g.strokeColor = new Color(255, 120, 220, 180);
    g.lineWidth = 4;
    g.moveTo(-90, 0);
    g.lineTo(-20, -20);
    g.lineTo(10, 12);
    g.lineTo(78, -8);
    g.stroke();
    g.moveTo(-82, 24);
    g.lineTo(-12, 2);
    g.lineTo(16, 34);
    g.lineTo(88, 14);
    g.stroke();
    this.scheduleOnce(() => { if (fx.isValid) fx.destroy(); }, 0.22);
    this.triggerScreenShake(0.12, 10);
  }

  private showTopWarning(text: string, color: Color): void {
    const canvas = this.ensureCanvas();
    const warning = new Node(`Warning_${text}`);
    warning.setPosition(0, 180, 0);
    warning.addComponent(UITransform).setContentSize(520, 62);
    warning.addComponent(UIOpacity).opacity = 240;

    const g = warning.addComponent(Graphics);
    g.fillColor = new Color(12, 8, 8, 180);
    g.roundRect(-260, -31, 520, 62, 14);
    g.fill();
    g.strokeColor = color;
    g.lineWidth = 2;
    g.roundRect(-260, -31, 520, 62, 14);
    g.stroke();

    const labelNode = new Node('WarningText');
    labelNode.setPosition(0, 0, 0);
    labelNode.addComponent(UITransform).setContentSize(500, 48);
    const label = labelNode.addComponent(Label);
    label.string = text;
    label.fontSize = 30;
    label.lineHeight = 34;
    label.color = color;
    label.isBold = true;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    warning.addChild(labelNode);

    canvas.addChild(warning);
    this.scheduleOnce(() => { if (warning.isValid) warning.destroy(); }, 0.55);
  }

  private triggerScreenShake(duration: number, magnitude: number): void {
    this.screenShakeTimer = Math.max(this.screenShakeTimer, duration);
    this.screenShakeMagnitude = Math.max(this.screenShakeMagnitude, magnitude);
  }

  private updateScreenShake(deltaTime: number): void {
    const canvas = this.node.getChildByName('Canvas');
    if (!canvas) return;

    if (this.screenShakeTimer <= 0) {
      if (canvas.position.x !== 0 || canvas.position.y !== 0) {
        canvas.setPosition(0, 0, 0);
      }
      return;
    }

    this.screenShakeTimer -= deltaTime;
    const power = Math.max(0, this.screenShakeTimer / 0.12);
    const x = (Math.random() - 0.5) * 2 * this.screenShakeMagnitude * power;
    const y = (Math.random() - 0.5) * 2 * this.screenShakeMagnitude * power;
    canvas.setPosition(x, y, 0);

    if (this.screenShakeTimer <= 0) {
      this.screenShakeMagnitude = 0;
      canvas.setPosition(0, 0, 0);
    }
  }

  private showSkillBurst(position: Vec3, radius: number): void {
    const burst = new Node('SkillBurst');
    burst.setParent(this.node);
    burst.setPosition(position.x, position.y, 0);
    burst.addComponent(UITransform).setContentSize(radius * 2, radius * 2);
    burst.addComponent(UIOpacity).opacity = 210;
    const g = burst.addComponent(Graphics);
    g.strokeColor = new Color(255, 240, 120, 180);
    g.lineWidth = 5;
    g.circle(0, 0, radius * 0.6);
    g.stroke();
    g.fillColor = new Color(255, 235, 120, 40);
    g.circle(0, 0, radius * 0.45);
    g.fill();
    this.scheduleOnce(() => { if (burst.isValid) burst.destroy(); }, 0.18);
  }

  private showHeavenStrikeEffect(position: Vec3): void {
    const strike = new Node('HeavenStrikeFx');
    strike.setParent(this.node);
    strike.setPosition(position.x, position.y + 45, 0);
    strike.addComponent(UITransform).setContentSize(60, 180);
    const g = strike.addComponent(Graphics);
    g.fillColor = new Color(255, 250, 180, 110);
    g.roundRect(-12, -90, 24, 180, 12);
    g.fill();
    g.fillColor = new Color(255, 255, 255, 165);
    g.roundRect(-5, -90, 10, 180, 6);
    g.fill();
    this.scheduleOnce(() => { if (strike.isValid) strike.destroy(); }, 0.16);
  }

  private showHolyDashTrail(position: Vec3, range: number): void {
    const trail = new Node('HolyDashFx');
    trail.setParent(this.node);
    trail.setPosition(position.x, position.y, 0);
    trail.addComponent(UITransform).setContentSize(range * 2, 50);
    const g = trail.addComponent(Graphics);
    g.fillColor = new Color(110, 220, 255, 70);
    g.roundRect(-range * 0.6, -12, range * 1.2, 24, 12);
    g.fill();
    g.strokeColor = new Color(220, 255, 255, 145);
    g.lineWidth = 2;
    g.roundRect(-range * 0.6, -12, range * 1.2, 24, 12);
    g.stroke();
    this.scheduleOnce(() => { if (trail.isValid) trail.destroy(); }, 0.14);
  }

  private showDeathPop(position: Vec3): void {
    const pop = new Node('DeathPop');
    pop.setParent(this.node);
    pop.setPosition(position.x, position.y);
    pop.addComponent(UITransform).setContentSize(64, 64);
    pop.addComponent(UIOpacity).opacity = 220;
    const g = pop.addComponent(Graphics);
    g.fillColor = new Color(255, 220, 60, 72);
    g.circle(0, 0, 22);
    g.fill();

    const spriteNode = new Node('ExplosionSprite');
    spriteNode.setPosition(0, 0, 0);
    spriteNode.addComponent(UITransform).setContentSize(72, 72);
    const sprite = spriteNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    pop.addChild(spriteNode);
    const spritePath = 'images/effects/explosion_small';
    resources.load(`${spritePath}/spriteFrame`, SpriteFrame, (error, spriteFrame) => {
      if (!error && spriteFrame && spriteNode.isValid) {
        sprite.spriteFrame = spriteFrame;
        return;
      }
      resources.load(spritePath, SpriteFrame, (fallbackError, fallbackFrame) => {
        if (fallbackError || !fallbackFrame || !spriteNode.isValid) return;
        sprite.spriteFrame = fallbackFrame;
      });
    });

    this.scheduleOnce(() => {
      if (!pop.isValid) return;
      const opacity = pop.getComponent(UIOpacity);
      if (opacity) opacity.opacity = 0;
      pop.destroy();
    }, 0.18);
  }

  private handleEnemySummon(payload: { summonType: string; count: number; position: Vec3; radius?: number }): void {
    const count = Math.max(1, Math.min(4, payload.count));
    const radius = payload.radius ?? 80;
    this.showEnemySummonEffect(payload.position, radius);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
      const distance = radius * (0.45 + Math.random() * 0.35);
      const spawnPos = new Vec3(
        payload.position.x + Math.cos(angle) * distance,
        payload.position.y + Math.sin(angle) * distance,
        0,
      );
      this.spawnEnemy(payload.summonType, spawnPos);
    }
  }

  private showEnemySummonEffect(position: Vec3, radius: number): void {
    const fx = new Node('EnemySummonFx');
    fx.setParent(this.node);
    fx.setPosition(position.x, position.y, 0);
    fx.addComponent(UITransform).setContentSize(radius * 2, radius * 2);
    fx.addComponent(UIOpacity).opacity = 190;
    const g = fx.addComponent(Graphics);
    g.strokeColor = new Color(200, 120, 255, 220);
    g.lineWidth = 2;
    g.circle(0, 0, Math.max(20, radius * 0.42));
    g.stroke();
    g.strokeColor = new Color(255, 220, 255, 120);
    g.lineWidth = 1;
    g.circle(0, 0, Math.max(14, radius * 0.24));
    g.stroke();

    this.scheduleOnce(() => {
      if (!fx.isValid) return;
      const opacity = fx.getComponent(UIOpacity);
      if (opacity) opacity.opacity = 0;
      fx.destroy();
    }, 0.22);
  }

  // ─── 씬 구성 헬퍼 ─────────────────────────────────────────────────────

  private ensureCanvas(): Node {
    let canvas = this.node.getChildByName('Canvas');
    if (canvas) return canvas;
    canvas = new Node('Canvas');
    canvas.addComponent(UITransform).setContentSize(1280, 720);
    canvas.addComponent(Canvas);
    this.node.addChild(canvas);
    return canvas;
  }

  private ensureEnemyRoot(): Node {
    let root = this.node.getChildByName('EnemyRoot');
    if (!root) {
      root = new Node('EnemyRoot');
      this.node.addChild(root);
    }
    return root;
  }

  private ensureStageManager(): Node {
    let smNode = this.node.getChildByName('StageManager');
    if (smNode) return smNode;
    smNode = new Node('StageManager');
    smNode.addComponent(StageManager);
    this.node.addChild(smNode);
    return smNode;
  }

  private ensureHud(): void {
    const canvas = this.ensureCanvas();

    if (canvas.getChildByName('HudLabel')) {
      this.hudLabel = canvas.getChildByName('HudLabel')?.getComponent(Label) ?? null;
      this.skillCooldownLabel = canvas.getChildByName('SkillCooldownLabel')?.getComponent(Label) ?? null;
      return;
    }

    // 상단 정보 HUD — 왼쪽에만 배치 (보스 HP바와 겹침 방지)
    const hudPanel = new Node('HudPanel');
    hudPanel.setPosition(-430, 325);
    hudPanel.addComponent(UITransform).setContentSize(392, 78);
    const hudG = hudPanel.addComponent(Graphics);
    hudG.fillColor = new Color(8, 18, 40, 205);
    hudG.roundRect(-196, -39, 392, 78, 12);
    hudG.fill();
    hudG.fillColor = new Color(255, 255, 255, 12);
    hudG.roundRect(-192, 3, 384, 28, 10);
    hudG.fill();
    hudG.strokeColor = new Color(95, 145, 205, 145);
    hudG.lineWidth = 1.2;
    hudG.roundRect(-196, -39, 392, 78, 12);
    hudG.stroke();
    canvas.addChild(hudPanel);

    const hudNode = new Node('HudLabel');
    this.hudLabel = hudNode.addComponent(Label);
    this.hudLabel.string = '';
    this.hudLabel.fontSize = 18;
    this.hudLabel.lineHeight = 26;
    this.hudLabel.color = new Color(255, 255, 255, 255);
    hudNode.addComponent(UITransform).setContentSize(360, 62);
    hudNode.setPosition(-430, 325);
    canvas.addChild(hudNode);

    const cdPanel = new Node('SkillCooldownPanel');
    cdPanel.setPosition(0, -310);
    cdPanel.addComponent(UITransform).setContentSize(620, 40);
    const cdG = cdPanel.addComponent(Graphics);
    cdG.fillColor = new Color(8, 18, 40, 186);
    cdG.roundRect(-310, -20, 620, 40, 12);
    cdG.fill();
    cdG.strokeColor = new Color(95, 145, 205, 126);
    cdG.lineWidth = 1;
    cdG.roundRect(-310, -20, 620, 40, 12);
    cdG.stroke();
    canvas.addChild(cdPanel);

    const cdNode = new Node('SkillCooldownLabel');
    this.skillCooldownLabel = cdNode.addComponent(Label);
    this.skillCooldownLabel.string = '';
    this.skillCooldownLabel.fontSize = 17;
    this.skillCooldownLabel.lineHeight = 24;
    this.skillCooldownLabel.color = new Color(200, 230, 255, 255);
    cdNode.addComponent(UITransform).setContentSize(580, 28);
    cdNode.setPosition(0, -310);
    canvas.addChild(cdNode);
  }

  private ensurePlayer(): void {
    const existing = this.node.getChildByName('Player');
    if (existing) {
      this.playerController = existing.getComponent(PlayerController);
      this.swordWeaponRef = existing.getChildByName('Weapon')?.getComponent(SwordWeapon) ?? null;
      this.baseWeaponDamage = this.swordWeaponRef?.damage ?? ProfileService.getWeaponDamage();
      return;
    }

    const player = new Node('Player');
    player.setPosition(new Vec3(0, -120, 0));
    const shape = player.addComponent(DebugShape);
    shape.fillColor = new Color(120, 200, 255, 0);
    shape.width = 44;
    shape.height = 44;
    shape.suppressRendering = true;
    SpriteArt.attach(player, 'PlayerSprite', 'images/characters/player_guardian_angel', 112, 112, 10, {
      frameRect: { x: 8, y: 8, width: 298, height: 298 },
    });
    const playerSpriteNode = player.getChildByName('PlayerSprite');
    if (playerSpriteNode) {
      const animator = playerSpriteNode.getComponent(DirectionalSpriteAnimator) ?? playerSpriteNode.addComponent(DirectionalSpriteAnimator);
      animator.setup('images/characters/player_guardian_angel', {
        south_idle: [
          { x: 8, y: 8, width: 298, height: 298 },
          { x: 321, y: 8, width: 298, height: 298 },
        ],
        south_move: [
          { x: 8, y: 8, width: 298, height: 298 },
          { x: 321, y: 8, width: 298, height: 298 },
          { x: 634, y: 8, width: 298, height: 298 },
          { x: 947, y: 8, width: 298, height: 298 },
        ],
        west_idle: [
          { x: 8, y: 322, width: 298, height: 298 },
          { x: 321, y: 322, width: 298, height: 298 },
        ],
        west_move: [
          { x: 8, y: 322, width: 298, height: 298 },
          { x: 321, y: 322, width: 298, height: 298 },
          { x: 634, y: 322, width: 298, height: 298 },
          { x: 947, y: 322, width: 298, height: 298 },
        ],
        north_idle: [
          { x: 8, y: 635, width: 298, height: 298 },
          { x: 321, y: 635, width: 298, height: 298 },
        ],
        north_move: [
          { x: 8, y: 635, width: 298, height: 298 },
          { x: 321, y: 635, width: 298, height: 298 },
          { x: 634, y: 635, width: 298, height: 298 },
          { x: 947, y: 635, width: 298, height: 298 },
        ],
        east_idle: [
          { x: 8, y: 948, width: 298, height: 298 },
          { x: 321, y: 948, width: 298, height: 298 },
        ],
        east_move: [
          { x: 8, y: 948, width: 298, height: 298 },
          { x: 321, y: 948, width: 298, height: 298 },
          { x: 634, y: 948, width: 298, height: 298 },
          { x: 947, y: 948, width: 298, height: 298 },
        ],
      }, 8);
    }

    player.addComponent(AutoAimSystem);
    const playerController = player.addComponent(PlayerController);
    player.addComponent(UITransform).setContentSize(60, 60);

    const weapon = new Node('Weapon');
    weapon.setPosition(new Vec3(0, 0, 0));
    weapon.addComponent(UITransform).setContentSize(80, 16);
    // 비대칭 칼날: 중심에서 오른쪽으로 뻗는 형태 → 회전 시 360도 방향으로 향함
    const weaponG = weapon.addComponent(Graphics);
    weaponG.fillColor = new Color(255, 235, 80, 0);
    weaponG.roundRect(6, -4, 58, 8, 4);
    weaponG.fill();
    weaponG.strokeColor = new Color(255, 180, 40, 0);
    weaponG.lineWidth = 1;
    weaponG.roundRect(6, -4, 58, 8, 4);
    weaponG.stroke();
    const swordWeapon = weapon.addComponent(SwordWeapon);
    swordWeapon.damage = ProfileService.getWeaponDamage();
    player.addChild(weapon);

    playerController.weaponNode = weapon;
    this.playerController = playerController;
    this.swordWeaponRef = swordWeapon;
    this.baseWeaponDamage = swordWeapon.damage;
    this.node.addChild(player);
  }
}
