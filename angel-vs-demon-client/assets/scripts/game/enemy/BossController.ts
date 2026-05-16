import { _decorator, Vec3, Color } from 'cc';
import { EnemyController } from './EnemyController';
import { DebugShape } from '../../ui/DebugShape';
import { EventBus } from '../../core/EventBus';
import { PlayerController } from '../player/PlayerController';

const { ccclass, property } = _decorator;

@ccclass('BossController')
export class BossController extends EnemyController {
  @property
  phaseCount = 2;

  private chargeTimer = 0;
  private chargeInterval = 3.0;
  private chargeSpeed = 600;
  private isCharging = false;
  private chargeDuration = 0;
  private chargeDirection = new Vec3();
  private phaseTransitionTriggered = false;
  private spawnMinionsCallback: (() => void) | null = null;
  private specialTimer = 0;
  private specialCooldown = 6.5;
  private specialPattern: 'none' | 'nova' | 'summon' | 'frenzy' = 'none';
  private frenzyTimer = 0;

  minionType = 'smile_zombie';
  minionCount = 3;

  configure(opts: {
    chargeInterval?: number;
    chargeSpeed?: number;
    minionType?: string;
    minionCount?: number;
    specialCooldown?: number;
    specialPattern?: 'none' | 'nova' | 'summon' | 'frenzy';
  }): void {
    if (opts.chargeInterval !== undefined) this.chargeInterval = opts.chargeInterval;
    if (opts.chargeSpeed !== undefined) this.chargeSpeed = opts.chargeSpeed;
    if (opts.minionType !== undefined) this.minionType = opts.minionType;
    if (opts.minionCount !== undefined) this.minionCount = opts.minionCount;
    if (opts.specialCooldown !== undefined) this.specialCooldown = opts.specialCooldown;
    if (opts.specialPattern !== undefined) this.specialPattern = opts.specialPattern;
  }

  setSpawnMinionsCallback(cb: () => void): void {
    this.spawnMinionsCallback = cb;
  }

  update(deltaTime: number): void {
    if (this.isDying) {
      super.update(deltaTime);
      return;
    }

    // 50% HP에서 페이즈 2 전환
    if (!this.phaseTransitionTriggered && this.currentHp <= this.maxHp * 0.5) {
      this.phaseTransitionTriggered = true;
      this.chargeInterval = 1.8;
      this.chargeSpeed = 750;
      this.spawnMinionsCallback?.();
      this.showPhaseTransitionEffect();
      EventBus.emit('boss:phase', {
        position: this.node.worldPosition.clone(),
      });
    }

    if (this.frenzyTimer > 0) {
      this.frenzyTimer -= deltaTime;
      if (this.frenzyTimer <= 0) {
        this.chargeSpeed = Math.max(600, this.chargeSpeed - 180);
      }
    }

    this.specialTimer += deltaTime;
    if (this.specialPattern !== 'none' && this.specialTimer >= this.specialCooldown) {
      this.specialTimer = 0;
      this.castSpecial();
    }

    // 차지 공격 타이머
    this.chargeTimer += deltaTime;
    if (!this.isCharging && this.chargeTimer >= this.chargeInterval) {
      // 계층: Boss → EnemyRoot → WorldRoot → Scene → Player
      const playerNode = this.node.parent?.parent?.parent?.getChildByName('Player') ?? null;
      if (playerNode) {
        this.chargeTimer = 0;
        this.isCharging = true;
        this.chargeDuration = 0.4;
        const dir = new Vec3();
        Vec3.subtract(dir, playerNode.worldPosition, this.node.worldPosition);
        dir.normalize();
        this.chargeDirection.set(dir.x * this.chargeSpeed, dir.y * this.chargeSpeed, 0);
        EventBus.emit('boss:charge', {
          position: this.node.worldPosition.clone(),
          direction: dir.clone(),
        });
      }
    }

    // 차지 중 이동 (chargeDirection은 월드 방향이나 WorldRoot에 회전이 없어 로컬과 동일)
    if (this.isCharging) {
      this.chargeDuration -= deltaTime;
      this.overrideMovement = true;
      const pos = this.node.position.clone();
      this.node.setPosition(pos.add(this.chargeDirection.clone().multiplyScalar(deltaTime)));
      if (this.chargeDuration <= 0) {
        this.isCharging = false;
        this.overrideMovement = false;
      }
    } else {
      this.overrideMovement = false;
    }

    super.update(deltaTime);
  }

  private showPhaseTransitionEffect(): void {
    const shape = this.getComponent(DebugShape);
    if (shape) {
      shape.fillColor = new Color(255, 50, 50, 255);
    }
  }

  private castSpecial(): void {
    switch (this.specialPattern) {
      case 'nova':
        this.castNova();
        break;
      case 'summon':
        this.castSummon();
        break;
      case 'frenzy':
        this.castFrenzy();
        break;
      default:
        break;
    }
  }

  private castNova(): void {
    const playerNode = this.node.parent?.parent?.parent?.getChildByName('Player') ?? null;
    const radius = 150;
    if (playerNode && Vec3.distance(playerNode.worldPosition, this.node.worldPosition) <= radius) {
      playerNode.getComponent(PlayerController)?.receiveDamage(this.contactDamage + 12, this.node.worldPosition);
    }
    EventBus.emit('boss:special', {
      kind: 'nova',
      position: this.node.worldPosition.clone(),
      radius,
    });
  }

  private castSummon(): void {
    this.spawnMinionsCallback?.();
    EventBus.emit('boss:special', {
      kind: 'summon',
      position: this.node.worldPosition.clone(),
      count: this.minionCount,
    });
  }

  private castFrenzy(): void {
    this.frenzyTimer = 2.2;
    this.chargeSpeed += 180;
    this.chargeInterval = Math.max(1.1, this.chargeInterval - 0.25);
    EventBus.emit('boss:special', {
      kind: 'frenzy',
      position: this.node.worldPosition.clone(),
    });
  }
}
