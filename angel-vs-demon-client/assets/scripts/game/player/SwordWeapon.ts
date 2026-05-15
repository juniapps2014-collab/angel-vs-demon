import { _decorator, Color, Component, Graphics, Node, Sprite, SpriteFrame, UITransform, UIOpacity, Vec3, resources } from 'cc';
import { EnemyController } from '../enemy/EnemyController';
import { BossController } from '../enemy/BossController';
import { ProfileService } from '../../auth/ProfileService';
import { SoundManager } from '../../audio/SoundManager';

const { ccclass, property } = _decorator;

@ccclass('SwordWeapon')
export class SwordWeapon extends Component {
  @property
  damage = 30;

  @property
  attackRange = 150;

  private attackEffect: Node | null = null;
  private attackSpriteNode: Node | null = null;
  private attackTimer = 0;
  private projectileNode: Node | null = null;
  private projectileSprite: Sprite | null = null;
  private projectileFallbackGraphics: Graphics | null = null;
  private projectileRotation = 0;
  private projectilePhase: 'idle' | 'outbound' | 'return' = 'idle';
  private projectileSpeed = 1720;
  private projectileReturnSpeed = 1960;
  private projectileMaxDistance = 180;
  private projectileTravel = 0;
  private projectileDir = new Vec3();
  private projectileBasePosition = new Vec3();
  private returnOrbitTime = 0;
  private projectileHitIds = new Set<string>();
  private queuedShots = 0;
  private queuedDirection: Vec3 | null = null;
  private maxHitsPerThrow = 1;
  private facingDirection: 'north' | 'south' | 'east' | 'west' = 'south';

  onLoad(): void {
    this.maxHitsPerThrow = this.getMaxHitsPerThrow();
    this.createAttackEffect();
    this.ensureProjectileNode();
  }

  private createAttackEffect(): void {
    this.attackEffect = new Node('AttackEffect');
    this.attackEffect.setParent(this.node);
    this.attackEffect.setPosition(0, 0, 0);
    this.attackEffect.addComponent(UITransform).setContentSize(140, 140);
    this.attackEffect.addComponent(Graphics);
    this.attackEffect.addComponent(UIOpacity).opacity = 0;

    const spriteNode = new Node('AttackSprite');
    spriteNode.addComponent(UITransform).setContentSize(96, 96);
    const sprite = spriteNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.attackEffect.addChild(spriteNode);
    this.attackSpriteNode = spriteNode;

    const spritePath = 'images/effects/slash_red';
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
  }

  private ensureProjectileNode(): void {
    if (this.projectileNode?.isValid) {
      return;
    }

    this.projectileNode = new Node('SwordBoomerang');
    this.projectileNode.addComponent(UITransform).setContentSize(68, 68);
    this.projectileNode.addComponent(UIOpacity).opacity = 255;

    const fallbackGraphics = this.projectileNode.addComponent(Graphics);
    this.projectileFallbackGraphics = fallbackGraphics;
    fallbackGraphics.fillColor = new Color(255, 232, 120, 170);
    fallbackGraphics.moveTo(-8, 0);
    fallbackGraphics.lineTo(10, -14);
    fallbackGraphics.lineTo(20, 0);
    fallbackGraphics.lineTo(10, 14);
    fallbackGraphics.close();
    fallbackGraphics.fill();
    fallbackGraphics.strokeColor = new Color(255, 255, 240, 220);
    fallbackGraphics.lineWidth = 1.5;
    fallbackGraphics.moveTo(-8, 0);
    fallbackGraphics.lineTo(10, -14);
    fallbackGraphics.lineTo(20, 0);
    fallbackGraphics.lineTo(10, 14);
    fallbackGraphics.close();
    fallbackGraphics.stroke();

    const spriteNode = new Node('BoomerangSprite');
    spriteNode.addComponent(UITransform).setContentSize(68, 68);
    this.projectileSprite = spriteNode.addComponent(Sprite);
    this.projectileSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.projectileSprite.color = new Color(255, 255, 255, 210);
    this.projectileNode.addChild(spriteNode);

    const spritePath = 'images/effects/slash_red';
    resources.load(`${spritePath}/spriteFrame`, SpriteFrame, (error, spriteFrame) => {
      if (!error && spriteFrame && this.projectileSprite) {
        this.projectileSprite.spriteFrame = spriteFrame;
        this.hideProjectileFallbackGraphics();
        return;
      }
      resources.load(spritePath, SpriteFrame, (fallbackError, fallbackFrame) => {
        if (fallbackError || !fallbackFrame || !this.projectileSprite) return;
        this.projectileSprite.spriteFrame = fallbackFrame;
        this.hideProjectileFallbackGraphics();
      });
    });
  }

  update(deltaTime: number): void {
    this.updateAttackEffect(deltaTime);
    this.updateProjectile(deltaTime);
  }

  private updateAttackEffect(deltaTime: number): void {
    if (this.attackTimer <= 0) return;
    this.attackTimer -= deltaTime;
    const graphics = this.attackEffect?.getComponent(Graphics);
    const opacity = this.attackEffect?.getComponent(UIOpacity);
    if (!graphics || !opacity) return;

    graphics.clear();
    const t = Math.max(0, this.attackTimer / 0.18);
    opacity.opacity = Math.floor(255 * t);
    this.applyAttackEffectTransform();
    graphics.fillColor = new Color(255, 236, 120, Math.floor(120 * t));
    graphics.circle(0, 0, 10 + (1 - t) * 18);
    graphics.fill();
    graphics.strokeColor = new Color(255, 255, 220, Math.floor(180 * t));
    graphics.lineWidth = 2;
    graphics.circle(0, 0, 16 + (1 - t) * 18);
    graphics.stroke();
  }

  private updateProjectile(deltaTime: number): void {
    if (!this.projectileNode || !this.projectileNode.isValid || this.projectilePhase === 'idle') {
      return;
    }

    const anchorPosition = this.getAnchorPosition();
    const currentPosition = this.projectileNode.worldPosition.clone();
    let next = currentPosition.clone();

    if (this.projectilePhase === 'outbound') {
      this.projectileTravel += this.projectileSpeed * deltaTime;
      if (this.projectileTravel >= this.projectileMaxDistance) {
        this.projectilePhase = 'return';
        this.returnOrbitTime = 0;
      }
      next = this.getOutboundPosition();
    } else if (Vec3.distance(currentPosition, anchorPosition) <= 54) {
      this.returnOrbitTime += deltaTime;
      next = this.getReturnOrbitPosition(anchorPosition);
      if (this.returnOrbitTime >= 0.08) {
        this.resetProjectile();
        return;
      }
    } else {
      const moveDir = new Vec3();
      Vec3.subtract(moveDir, anchorPosition, currentPosition);
      if (moveDir.lengthSqr() <= 16) {
        this.resetProjectile();
        return;
      }
      moveDir.normalize();
      next = currentPosition.add(moveDir.multiplyScalar(this.projectileReturnSpeed * deltaTime));
    }
    this.projectileNode.setWorldPosition(next);
    this.projectileRotation += deltaTime * (this.projectilePhase === 'outbound' ? 1180 : 1480);
    this.projectileNode.setRotationFromEuler(0, 0, this.projectileRotation);

    this.applyProjectileHits(next);
  }

  faceTarget(target: Node): void {
    const dir = new Vec3();
    Vec3.subtract(dir, target.worldPosition, this.node.worldPosition);
    dir.normalize();
    this.setFacingDirectionFromVector(dir);
    this.node.setRotationFromEuler(0, 0, Math.atan2(dir.y, dir.x) * (180 / Math.PI));
  }

  attack(target: Node): void {
    const dir = new Vec3();
    Vec3.subtract(dir, target.worldPosition, this.node.worldPosition);
    const distance = dir.length();
    dir.normalize();
    this.setFacingDirectionFromVector(dir);

    // 항상 대상 방향으로 회전
    this.node.setRotationFromEuler(0, 0, Math.atan2(dir.y, dir.x) * (180 / Math.PI));

    // 범위 밖이면 스윙 없음 — "칼이 안 닿았는데 죽는" 현상 방지
    if (distance > this.attackRange) return;

    if (this.projectilePhase !== 'idle') {
      this.queuedShots = Math.min(this.getQueuedShotLimit(), this.queuedShots + 1);
      this.queuedDirection = dir.clone();
      return;
    }

    this.showAttackEffect();
    SoundManager.playSwordSwing();
    this.launchProjectile(dir);
  }

  private showAttackEffect(): void {
    this.attackTimer = 0.18;
    const opacity = this.attackEffect?.getComponent(UIOpacity);
    if (opacity) {
      opacity.opacity = 255;
    }
  }

  private launchProjectile(direction: Vec3): void {
    const sceneNode = this.node.parent?.parent;
    if (!sceneNode) return;

    this.ensureProjectileNode();

    this.projectileNode.setParent(sceneNode);
    this.projectileNode.setWorldPosition(this.getAnchorPosition());
    this.projectileNode.setScale(0.88, 0.88, 1);
    this.projectileDir = direction.clone().normalize();
    this.projectileBasePosition = this.getAnchorPosition();
    this.projectileTravel = 0;
    this.returnOrbitTime = 0;
    this.projectileRotation = Math.atan2(this.projectileDir.y, this.projectileDir.x) * (180 / Math.PI);
    this.projectilePhase = 'outbound';
    this.projectileHitIds.clear();
    this.maxHitsPerThrow = this.getMaxHitsPerThrow();
  }

  private getAnchorPosition(): Vec3 {
    return this.node.worldPosition.clone();
  }

  private applyProjectileHits(projectilePosition: Vec3): void {
    const enemyRoot = this.node.parent?.parent?.getChildByName('EnemyRoot') ?? null;
    if (!enemyRoot) return;

    for (const child of enemyRoot.children) {
      if (!child.isValid) continue;
      if (Vec3.distance(projectilePosition, child.worldPosition) > 34) continue;
      if (this.projectileHitIds.has(child.uuid)) continue;
      if (this.projectileHitIds.size >= this.maxHitsPerThrow) break;

      const enemyController = child.getComponent(EnemyController);
      if (!enemyController) continue;

      let finalDamage = this.damage;
      if (child.getComponent(BossController) && ProfileService.hasRelic('relic_broken_horn')) {
        finalDamage = Math.floor(finalDamage * 1.5);
      }
      enemyController.receiveDamage(finalDamage);
      this.projectileHitIds.add(child.uuid);
    }
  }

  private resetProjectile(): void {
    this.projectilePhase = 'idle';
    this.projectileTravel = 0;
    this.returnOrbitTime = 0;
    this.projectileHitIds.clear();
    if (this.projectileNode?.isValid) {
      this.projectileNode.removeFromParent();
    }
    if (this.queuedShots > 0) {
      const nextDirection = this.queuedDirection?.clone() ?? this.projectileDir.clone();
      this.queuedShots -= 1;
      this.queuedDirection = this.queuedShots > 0 ? nextDirection.clone() : null;
      this.showAttackEffect();
      SoundManager.playSwordSwing();
      this.launchProjectile(nextDirection);
      return;
    }
    this.queuedDirection = null;
  }

  private getMaxHitsPerThrow(): number {
    const weaponLevel = ProfileService.getProfile()?.weaponLevel ?? 1;
    if (weaponLevel >= 8) return 4;
    if (weaponLevel >= 5) return 2;
    return 1;
  }

  private getQueuedShotLimit(): number {
    const weaponLevel = ProfileService.getProfile()?.weaponLevel ?? 1;
    if (weaponLevel >= 10) return 3;
    if (weaponLevel >= 6) return 2;
    return 1;
  }

  setFacingDirection(direction: 'north' | 'south' | 'east' | 'west'): void {
    this.facingDirection = direction;
    this.applyAttackEffectTransform();
  }

  clearQueuedAttack(): void {
    this.queuedShots = 0;
    this.queuedDirection = null;
  }

  private setFacingDirectionFromVector(direction: Vec3): void {
    const absX = Math.abs(direction.x);
    const absY = Math.abs(direction.y);
    if (absX > absY) {
      this.setFacingDirection(direction.x < 0 ? 'west' : 'east');
    } else {
      this.setFacingDirection(direction.y < 0 ? 'south' : 'north');
    }
  }

  private applyAttackEffectTransform(): void {
    if (!this.attackEffect?.isValid || !this.attackSpriteNode?.isValid) return;
    // 무기 노드 자체가 타깃 방향으로 회전하므로, 이펙트는 항상 로컬 전방(+X)에만 둔다.
    this.attackEffect.setPosition(34, 0, 0);
    this.attackEffect.setRotationFromEuler(0, 0, 0);
    this.attackSpriteNode.setPosition(20, 0, 0);
    this.attackSpriteNode.setScale(1, 1, 1);
  }

  private hideProjectileFallbackGraphics(): void {
    if (!this.projectileFallbackGraphics) {
      return;
    }

    this.projectileFallbackGraphics.clear();
    this.projectileFallbackGraphics.enabled = false;
  }

  private getOutboundPosition(): Vec3 {
    const forward = this.projectileDir.clone().multiplyScalar(this.projectileTravel);
    return this.projectileBasePosition.clone().add(forward);
  }

  private getReturnOrbitPosition(anchorPosition: Vec3): Vec3 {
    const orbitRadius = 16 - Math.min(8, this.returnOrbitTime * 96);
    const baseAngle = Math.atan2(this.projectileDir.y, this.projectileDir.x);
    const angle = baseAngle + (Math.PI * 1.9 * this.returnOrbitTime / 0.08);
    return new Vec3(
      anchorPosition.x + Math.cos(angle) * orbitRadius,
      anchorPosition.y + Math.sin(angle) * orbitRadius,
      0,
    );
  }
}
