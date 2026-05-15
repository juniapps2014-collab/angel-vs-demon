import { _decorator, Component, Node, Vec3, Graphics, Color, Label, UITransform, UIOpacity, Sprite } from 'cc';
import { PlayerController } from '../player/PlayerController';
import { DebugShape } from '../../ui/DebugShape';
import { EventBus } from '../../core/EventBus';
import { SoundManager } from '../../audio/SoundManager';
import { DirectionalSpriteAnimator } from '../../ui/DirectionalSpriteAnimator';

const { ccclass, property } = _decorator;

@ccclass('EnemyController')
export class EnemyController extends Component {
  @property
  maxHp = 40;

  @property
  moveSpeed = 80;

  @property
  contactDamage = 12;

  @property
  contactRange = 36;

  protected currentHp = 40;
  protected isDying = false;
  protected overrideMovement = false;

  private playerNode: Node | null = null;
  private wanderFreq = 1.0;
  private wanderAmp = 0.4;
  private wanderTime = 0;
  private playerController: PlayerController | null = null;
  private debugShape: DebugShape | null = null;
  private deathTimer = 0;
  private hpBar: Node | null = null;
  private hpBarFill: Node | null = null;
  private enemyType = 'smile_zombie';
  private specialElapsed = 0;
  private summonElapsed = 0;
  private trailElapsed = 0;
  private summonTelegraphElapsed = 0;
  private orbitDirection = 1;
  private directionalAnimator: DirectionalSpriteAnimator | null = null;
  private facingDirection: 'north' | 'south' | 'east' | 'west' = 'south';
  private isMovingState = false;
  private hitPunchTimer = 0;
  private hitSpriteTimer = 0;
  private readonly HIT_DURATION = 0.14;

  onLoad(): void {
    this.currentHp = this.maxHp;
    this.wanderFreq = 0.8 + Math.random() * 1.4;
    this.wanderAmp  = 0.25 + Math.random() * 0.55;
    this.wanderTime = Math.random() * Math.PI * 2;
    // 계층: Enemy → EnemyRoot → BattleScene(Canvas) → Player
    this.playerNode = this.node.parent?.parent?.getChildByName('Player') ?? null;
    this.playerController = this.playerNode?.getComponent(PlayerController) ?? null;
    this.debugShape = this.getComponent(DebugShape);
    this.enemyType = this.resolveEnemyType();
    this.orbitDirection = Math.random() < 0.5 ? -1 : 1;
    this.directionalAnimator = this.node.getChildByName('EnemySprite')?.getComponent(DirectionalSpriteAnimator) ?? null;
    this.createHpBar();
  }

  private createHpBar(): void {
    this.hpBar = new Node('EnemyHpBar');
    this.hpBar.setParent(this.node);
    this.hpBar.setPosition(0, 32, 0);
    const bgTransform = this.hpBar.addComponent(UITransform);
    bgTransform.setContentSize(44, 6);
    const bgGraphics = this.hpBar.addComponent(Graphics);
    bgGraphics.fillColor = new Color(40, 40, 40, 200);
    bgGraphics.roundRect(-22, -3, 44, 6, 3);
    bgGraphics.fill();

    this.hpBarFill = new Node('HpFill');
    this.hpBarFill.setParent(this.hpBar);
    this.hpBarFill.setPosition(-22, 0, 0);
    const fillTransform = this.hpBarFill.addComponent(UITransform);
    fillTransform.setContentSize(40, 4);
    const fillGraphics = this.hpBarFill.addComponent(Graphics);
    fillGraphics.fillColor = new Color(50, 255, 50, 255);
    fillGraphics.roundRect(0, -2, 40, 4, 2);
    fillGraphics.fill();
  }

  private updateHpBar(): void {
    if (!this.hpBarFill) return;
    const ratio = Math.max(0, this.currentHp / this.maxHp);
    const transform = this.hpBarFill.getComponent(UITransform);
    if (transform) {
      transform.setContentSize(40 * ratio, 4);
    }
    const graphics = this.hpBarFill.getComponent(Graphics);
    if (graphics) {
      graphics.clear();
      graphics.fillColor =
        ratio > 0.6
          ? new Color(50, 255, 50, 255)
          : ratio > 0.3
          ? new Color(255, 200, 50, 255)
          : new Color(255, 50, 50, 255);
      graphics.roundRect(0, -2, 40 * ratio, 4, 2);
      graphics.fill();
    }
  }

  private showDamageNumber(damage: number): void {
    const labelNode = new Node('DamageLabel');
    labelNode.setParent(this.node);
    labelNode.setPosition(0, 45, 0);
    const transform = labelNode.addComponent(UITransform);
    transform.setContentSize(60, 30);
    const label = labelNode.addComponent(Label);
    label.string = `-${damage}`;
    label.fontSize = 20;
    label.color = new Color(255, 50, 50, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.isBold = true;

    let elapsed = 0;
    this.schedule((deltaTime: number) => {
      if (!labelNode.isValid) return;
      elapsed += deltaTime;
      labelNode.setPosition(labelNode.position.x, 45 + elapsed * 36, 0);
      const opacity = labelNode.getComponent(UIOpacity) ?? labelNode.addComponent(UIOpacity);
      opacity.opacity = Math.max(0, 255 - Math.floor((elapsed / 0.45) * 255));
      if (elapsed >= 0.45) {
        labelNode.destroy();
      }
    }, 0, 30, 0);
  }

  update(deltaTime: number): void {
    this.updateHitEffects(deltaTime);

    if (this.isDying) {
      this.deathTimer += deltaTime;
      const alpha = Math.max(0, 1 - this.deathTimer / 0.3);
      const uiOpacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
      uiOpacity.opacity = Math.floor(alpha * 255);
      const scale = 1 + this.deathTimer * 0.35;
      this.node.setScale(scale, scale, 1);
      if (this.deathTimer >= 0.3) {
        this.node.destroy();
      }
      return;
    }

    if (!this.playerNode || !this.playerNode.isValid) {
      this.playerNode = this.node.parent?.parent?.getChildByName('Player') ?? null;
      this.playerController = this.playerNode?.getComponent(PlayerController) ?? null;
      if (!this.playerNode) return;
    }

    if (!this.directionalAnimator) {
      this.directionalAnimator = this.node.getChildByName('EnemySprite')?.getComponent(DirectionalSpriteAnimator) ?? null;
    }

    const currentPosition = this.node.position.clone();
    const direction = new Vec3();
    Vec3.subtract(direction, this.playerNode.position, currentPosition);
    const distance = direction.length();
    this.updateSpecialBehavior(deltaTime, currentPosition, direction.clone(), distance);

    if (direction.lengthSqr() > 4) {
      this.updateFacingFromVector(direction);
    }

    if (this.overrideMovement) {
      this.isMovingState = false;
      this.refreshVisualState();
      return;
    }

    if (direction.lengthSqr() < 4) {
      this.isMovingState = false;
      this.refreshVisualState();
      return;
    }

    direction.normalize();

    const inContact = distance <= this.contactRange;
    if (inContact) {
      this.playerController?.receiveDamage(this.contactDamage, currentPosition);
      this.applyContactOrbit(direction, distance);
    } else {
      this.applyMovementBehavior(direction, distance);
    }

    // 인접 적과의 분리력 — 누적 크기 보존으로 많이 몰릴수록 더 강하게 밀려남
    const sep = this.computeSeparation();
    if (sep.lengthSqr() > 0.01) {
      direction.add(sep.multiplyScalar(inContact ? 2.5 : 1.8));
      direction.normalize();
    }

    // 사인파 방향 변화로 각 적이 다른 경로로 접근
    this.wanderTime += deltaTime * this.wanderFreq;
    const wAngle = Math.sin(this.wanderTime) * this.wanderAmp;
    const cosW = Math.cos(wAngle);
    const sinW = Math.sin(wAngle);
    direction.set(
      direction.x * cosW - direction.y * sinW,
      direction.x * sinW + direction.y * cosW,
      0,
    );

    const movementSpeed = inContact ? this.moveSpeed * 0.8 : this.moveSpeed;
    const movement = direction.multiplyScalar(movementSpeed * deltaTime);
    this.node.setPosition(currentPosition.add(movement));
    this.isMovingState = true;
    this.refreshVisualState();
  }

  private updateFacingFromVector(direction: Vec3): void {
    const absX = Math.abs(direction.x);
    const absY = Math.abs(direction.y);
    if (absX > absY) {
      this.facingDirection = direction.x < 0 ? 'west' : 'east';
    } else {
      this.facingDirection = direction.y < 0 ? 'south' : 'north';
    }
  }

  private refreshVisualState(): void {
    if (!this.directionalAnimator) return;
    const state = this.isMovingState ? 'move' : 'idle';
    this.directionalAnimator.play(`${this.facingDirection}_${state}`);
  }

  private computeSeparation(): Vec3 {
    const sep = new Vec3();
    const minDist = 95;
    const siblings = this.node.parent?.children ?? [];
    for (const sibling of siblings) {
      if (sibling === this.node || !sibling.isValid) continue;
      const diff = new Vec3();
      Vec3.subtract(diff, this.node.position, sibling.position);
      const dist = diff.length();
      if (dist > 0.01 && dist < minDist) {
        // 가까울수록 제곱으로 강해지는 반발력 — 여러 적이 몰릴수록 합산되어 강해짐
        const ratio = (minDist - dist) / minDist;
        sep.add(diff.normalize().multiplyScalar(ratio * ratio * 2.0));
      }
    }
    return sep;
  }

  private resolveEnemyType(): string {
    const raw = this.node.name.startsWith('Enemy_') ? this.node.name.slice(6) : this.node.name;
    const parts = raw.split('_');
    if (parts.length > 2) {
      parts.splice(-2, 2);
    }
    return parts.join('_') || 'smile_zombie';
  }

  private updateSpecialBehavior(deltaTime: number, currentPosition: Vec3, direction: Vec3, distance: number): void {
    this.specialElapsed += deltaTime;

    if (this.enemyType === 'pitcher_imp') {
      const canThrow = distance <= 280 && distance >= 90;
      if (canThrow && this.specialElapsed >= 2.2) {
        this.specialElapsed = 0;
        this.showPitcherCastEffect(currentPosition, direction);
        this.spawnFireball(currentPosition, direction);
      }
      return;
    }

    if (this.enemyType === 'toxic_slime') {
      this.trailElapsed += deltaTime;
      if (this.trailElapsed >= 1.7) {
        this.trailElapsed = 0;
        this.showPoisonPulse(currentPosition);
        this.spawnPoisonPool(currentPosition);
      }
      return;
    }

    if (this.enemyType === 'summoner_priest') {
      this.summonElapsed += deltaTime;
      this.summonTelegraphElapsed += deltaTime;
      if (this.summonElapsed >= 3.8 && this.summonTelegraphElapsed >= 0.7) {
        this.summonTelegraphElapsed = 0;
        this.showSummonTelegraph(currentPosition);
      }
      if (this.summonElapsed >= 5.2) {
        this.summonElapsed = 0;
        this.summonTelegraphElapsed = 0;
        this.showSummonBurst(currentPosition);
        EventBus.emit('enemy:summon', {
          sourceType: this.enemyType,
          summonType: 'smile_zombie',
          count: 2,
          position: currentPosition.clone(),
          radius: 90,
        });
      }
    }
  }

  private applyMovementBehavior(direction: Vec3, distance: number): void {
    if (this.enemyType === 'pitcher_imp') {
      if (distance < 120) {
        direction.multiplyScalar(-1);
        return;
      }
      if (distance < 240) {
        const lateral = new Vec3(-direction.y, direction.x, 0);
        direction.set(lateral.x * 0.8 + direction.x * 0.2, lateral.y * 0.8 + direction.y * 0.2, 0);
        direction.normalize();
      }
      return;
    }

    if (this.enemyType === 'summoner_priest' && distance < 170) {
      direction.multiplyScalar(-1);
      return;
    }

    if (this.enemyType === 'toxic_slime' && distance < 90) {
      direction.multiplyScalar(0.65);
    }
  }

  private applyContactOrbit(direction: Vec3, distance: number): void {
    const tangent = new Vec3(-direction.y, direction.x, 0).multiplyScalar(this.orbitDirection);
    const radialWeight = distance < this.contactRange * 0.78 ? -0.9 : -0.35;

    direction.set(
      tangent.x * 0.82 + direction.x * radialWeight,
      tangent.y * 0.82 + direction.y * radialWeight,
      0,
    );

    if (direction.lengthSqr() < 0.001) {
      direction.set(tangent.x, tangent.y, 0);
    }

    direction.normalize();
  }

  private spawnFireball(position: Vec3, direction: Vec3): void {
    const sceneNode = this.node.parent?.parent;
    if (!sceneNode || !this.playerNode) return;

    const projectile = new Node('PitcherImpFireball');
    projectile.setParent(sceneNode);
    projectile.setPosition(position.x, position.y + 6, 0);
    projectile.addComponent(UITransform).setContentSize(18, 18);
    const graphics = projectile.addComponent(Graphics);
    graphics.fillColor = new Color(255, 150, 50, 220);
    graphics.circle(0, 0, 8);
    graphics.fill();
    graphics.strokeColor = new Color(255, 240, 180, 255);
    graphics.lineWidth = 1.5;
    graphics.circle(0, 0, 8);
    graphics.stroke();

    const velocity = direction.clone().normalize().multiplyScalar(280);
    let elapsed = 0;
    this.schedule((dt: number) => {
      if (!projectile.isValid) return;
      elapsed += dt;
      const next = projectile.position.clone().add(velocity.clone().multiplyScalar(dt));
      projectile.setPosition(next);
      projectile.setScale(1 + Math.sin(elapsed * 18) * 0.08, 1 + Math.sin(elapsed * 18) * 0.08, 1);

      if (Math.floor(elapsed * 18) % 2 === 0) {
        this.showFireballTrail(next);
      }

      if (this.playerNode && this.playerNode.isValid && Vec3.distance(next, this.playerNode.position) <= 26) {
        this.showFireballImpact(next);
        this.playerController?.receiveDamage(Math.max(8, Math.floor(this.contactDamage * 0.8)), next);
        projectile.destroy();
        return;
      }

      if (elapsed >= 2.2) {
        projectile.destroy();
      }
    }, 0, 180, 0);
  }

  private showPitcherCastEffect(position: Vec3, direction: Vec3): void {
    const sceneNode = this.node.parent?.parent;
    if (!sceneNode) return;

    const fx = new Node('PitcherCastFx');
    fx.setParent(sceneNode);
    fx.setPosition(position.x, position.y + 8, 0);
    fx.addComponent(UITransform).setContentSize(48, 48);
    fx.addComponent(UIOpacity).opacity = 180;
    const g = fx.addComponent(Graphics);
    g.strokeColor = new Color(255, 180, 80, 220);
    g.lineWidth = 2;
    g.circle(0, 0, 12);
    g.stroke();
    g.strokeColor = new Color(255, 235, 180, 200);
    g.moveTo(0, 0);
    g.lineTo(direction.clone().normalize().x * 20, direction.clone().normalize().y * 20);
    g.stroke();

    this.scheduleOnce(() => {
      if (!fx.isValid) return;
      fx.destroy();
    }, 0.12);
  }

  private showFireballTrail(position: Vec3): void {
    const sceneNode = this.node.parent?.parent;
    if (!sceneNode) return;

    const trail = new Node('FireballTrailFx');
    trail.setParent(sceneNode);
    trail.setPosition(position.x, position.y, 0);
    trail.addComponent(UITransform).setContentSize(14, 14);
    trail.addComponent(UIOpacity).opacity = 120;
    const g = trail.addComponent(Graphics);
    g.fillColor = new Color(255, 130, 50, 90);
    g.circle(0, 0, 5);
    g.fill();
    this.scheduleOnce(() => {
      if (!trail.isValid) return;
      trail.destroy();
    }, 0.08);
  }

  private showFireballImpact(position: Vec3): void {
    const sceneNode = this.node.parent?.parent;
    if (!sceneNode) return;

    const fx = new Node('FireballImpactFx');
    fx.setParent(sceneNode);
    fx.setPosition(position.x, position.y, 0);
    fx.addComponent(UITransform).setContentSize(48, 48);
    fx.addComponent(UIOpacity).opacity = 200;
    const g = fx.addComponent(Graphics);
    g.fillColor = new Color(255, 170, 70, 95);
    g.circle(0, 0, 14);
    g.fill();
    g.strokeColor = new Color(255, 240, 200, 220);
    g.lineWidth = 2;
    g.circle(0, 0, 14);
    g.stroke();
    this.scheduleOnce(() => {
      if (!fx.isValid) return;
      fx.destroy();
    }, 0.14);
  }

  private spawnPoisonPool(position: Vec3): void {
    const sceneNode = this.node.parent?.parent;
    if (!sceneNode) return;

    const pool = new Node('ToxicPool');
    pool.setParent(sceneNode);
    pool.setPosition(position.x, position.y - 4, 0);
    pool.addComponent(UITransform).setContentSize(84, 84);
    pool.addComponent(UIOpacity).opacity = 170;
    const graphics = pool.addComponent(Graphics);
    graphics.fillColor = new Color(90, 255, 140, 88);
    graphics.circle(0, 0, 28);
    graphics.fill();
    graphics.strokeColor = new Color(170, 255, 190, 180);
    graphics.lineWidth = 1.2;
    graphics.circle(0, 0, 28);
    graphics.stroke();

    let elapsed = 0;
    let damageTickElapsed = 0;
    this.schedule((dt: number) => {
      if (!pool.isValid) return;
      elapsed += dt;
      damageTickElapsed += dt;
      const pulse = 1 + Math.sin(elapsed * 8) * 0.06;
      pool.setScale(pulse, pulse, 1);

      const opacity = pool.getComponent(UIOpacity);
      if (opacity) {
        opacity.opacity = Math.max(0, 170 - Math.floor((elapsed / 2.4) * 140));
      }

      if (damageTickElapsed >= 0.55) {
        damageTickElapsed = 0;
        if (this.playerNode && this.playerNode.isValid && Vec3.distance(pool.position, this.playerNode.position) <= 34) {
          this.playerController?.receiveDamage(Math.max(4, Math.floor(this.contactDamage * 0.45)), pool.position);
        }
      }

      if (elapsed >= 2.4) {
        pool.destroy();
      }
    }, 0, 180, 0);
  }

  private showPoisonPulse(position: Vec3): void {
    const sceneNode = this.node.parent?.parent;
    if (!sceneNode) return;

    const fx = new Node('PoisonPulseFx');
    fx.setParent(sceneNode);
    fx.setPosition(position.x, position.y - 2, 0);
    fx.addComponent(UITransform).setContentSize(64, 64);
    fx.addComponent(UIOpacity).opacity = 140;
    const g = fx.addComponent(Graphics);
    g.strokeColor = new Color(120, 255, 160, 180);
    g.lineWidth = 2;
    g.circle(0, 0, 18);
    g.stroke();
    this.scheduleOnce(() => {
      if (!fx.isValid) return;
      fx.destroy();
    }, 0.12);
  }

  private showSummonTelegraph(position: Vec3): void {
    const telegraph = this.node.getChildByName('SummonTelegraph') ?? new Node('SummonTelegraph');
    if (!telegraph.parent) {
      telegraph.setParent(this.node);
      telegraph.setPosition(0, 34, 0);
      telegraph.addComponent(UITransform).setContentSize(44, 18);
      telegraph.addComponent(UIOpacity).opacity = 170;
      const g = telegraph.addComponent(Graphics);
      g.fillColor = new Color(190, 110, 255, 70);
      g.roundRect(-18, -6, 36, 12, 6);
      g.fill();
      g.strokeColor = new Color(240, 210, 255, 180);
      g.lineWidth = 1.5;
      g.roundRect(-18, -6, 36, 12, 6);
      g.stroke();
    }
    telegraph.setScale(1.08, 1.08, 1);
    this.scheduleOnce(() => {
      if (!telegraph.isValid) return;
      telegraph.setScale(1, 1, 1);
    }, 0.1);
  }

  private showSummonBurst(position: Vec3): void {
    const sceneNode = this.node.parent?.parent;
    if (!sceneNode) return;

    const fx = new Node('SummonBurstFx');
    fx.setParent(sceneNode);
    fx.setPosition(position.x, position.y + 4, 0);
    fx.addComponent(UITransform).setContentSize(90, 90);
    fx.addComponent(UIOpacity).opacity = 200;
    const g = fx.addComponent(Graphics);
    g.strokeColor = new Color(210, 120, 255, 220);
    g.lineWidth = 2;
    g.circle(0, 0, 24);
    g.stroke();
    g.strokeColor = new Color(255, 230, 255, 170);
    g.lineWidth = 1;
    g.circle(0, 0, 12);
    g.stroke();
    this.scheduleOnce(() => {
      if (!fx.isValid) return;
      fx.destroy();
    }, 0.18);
  }

  getHpRatio(): number {
    return Math.max(0, this.currentHp / this.maxHp);
  }

  receiveDamage(value: number): void {
    if (this.isDying) return;

    this.currentHp -= value;
    this.debugShape?.showHitEffect();
    this.updateHpBar();
    this.showDamageNumber(value);
    this.playHitEffects();

    if (this.currentHp <= 0) {
      this.isDying = true;
      this.deathTimer = 0;
      this.node.setScale(1, 1, 1);
      SoundManager.playEnemyDown();
      EventBus.emit('enemy:killed', { position: this.node.position.clone() });
    }
  }

  private playHitEffects(): void {
    // 1. 스케일 펀치
    this.hitPunchTimer = this.HIT_DURATION;

    // 2. 스프라이트 레드 틴트
    const sprite = this.node.getChildByName('EnemySprite')?.getComponent(Sprite);
    if (sprite) {
      sprite.color = new Color(255, 80, 80, 255);
      this.hitSpriteTimer = 0.10;
    }

    const pos = this.node.position;
    this.spawnHitSparks(pos);
    this.spawnHitRing(pos);
  }

  private updateHitEffects(dt: number): void {
    if (this.hitPunchTimer > 0 && !this.isDying) {
      this.hitPunchTimer -= dt;
      const t = Math.max(0, this.hitPunchTimer / this.HIT_DURATION);
      const s = 1 + 0.18 * t;
      this.node.setScale(s, s, 1);
      if (this.hitPunchTimer <= 0) this.node.setScale(1, 1, 1);
    }

    if (this.hitSpriteTimer > 0) {
      this.hitSpriteTimer -= dt;
      if (this.hitSpriteTimer <= 0) {
        const sprite = this.node.getChildByName('EnemySprite')?.getComponent(Sprite);
        if (sprite) sprite.color = new Color(255, 255, 255, 255);
      }
    }
  }

  private spawnHitSparks(pos: Vec3): void {
    const scene = this.node.parent?.parent;
    if (!scene) return;

    const COLORS = [
      new Color(255, 240, 60, 255),
      new Color(255, 160, 40, 255),
      new Color(255, 80, 80, 255),
    ];

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + (Math.random() - 0.5) * 1.0;
      const speed = 110 + Math.random() * 90;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const r = 3 + Math.random() * 2.5;
      const duration = 0.16 + Math.random() * 0.08;

      const spark = new Node('HitSpark');
      spark.setParent(scene);
      spark.setPosition(pos.x + (Math.random() - 0.5) * 10, pos.y + (Math.random() - 0.5) * 10, 0);
      spark.addComponent(UITransform).setContentSize(r * 2 + 4, r * 2 + 4);
      const g = spark.addComponent(Graphics);
      g.fillColor = COLORS[i % COLORS.length];
      g.circle(0, 0, r);
      g.fill();
      const opacity = spark.addComponent(UIOpacity);

      let elapsed = 0;
      this.schedule(function (dt: number) {
        if (!spark.isValid) return;
        elapsed += dt;
        spark.setPosition(spark.position.x + vx * dt, spark.position.y + vy * dt, 0);
        opacity.opacity = Math.max(0, Math.floor((1 - elapsed / duration) * 255));
        if (elapsed >= duration) spark.destroy();
      }, 0, Math.ceil(duration * 60) + 2, 0);
    }
  }

  private spawnHitRing(pos: Vec3): void {
    const scene = this.node.parent?.parent;
    if (!scene) return;

    const ring = new Node('HitRing');
    ring.setParent(scene);
    ring.setPosition(pos.x, pos.y, 0);
    ring.addComponent(UITransform).setContentSize(100, 100);
    const g = ring.addComponent(Graphics);

    const duration = 0.22;
    let elapsed = 0;

    this.schedule(function (dt: number) {
      if (!ring.isValid) return;
      elapsed += dt;
      const t = elapsed / duration;
      const r = 10 + t * 32;
      const alpha = Math.max(0, Math.floor((1 - t) * 210));
      g.clear();
      g.strokeColor = new Color(255, 230, 80, alpha);
      g.lineWidth = 2.5 - t * 1.5;
      g.circle(0, 0, r);
      g.stroke();
      if (elapsed >= duration) ring.destroy();
    }, 0, Math.ceil(duration * 60) + 2, 0);
  }
}
