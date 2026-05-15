import { _decorator, Component, EventKeyboard, Input, KeyCode, Node, Vec3, input, Label, UITransform, Graphics, Color, UIOpacity } from 'cc';
import { ProfileService } from '../../auth/ProfileService';
import { GAME_CONFIG } from '../../core/GameConfig';
import { AutoAimSystem } from './AutoAimSystem';
import { SwordWeapon } from './SwordWeapon';
import { EventBus } from '../../core/EventBus';
import { DebugShape } from '../../ui/DebugShape';
import { DirectionalSpriteAnimator } from '../../ui/DirectionalSpriteAnimator';

const { ccclass, property } = _decorator;

@ccclass('PlayerController')
export class PlayerController extends Component {
  @property
  moveSpeed = 260;

  @property
  maxHp = 120;

  @property
  contactDamageCooldown = 0.6;

  @property
  damageKnockbackDistance = 72;

  @property(Node)
  weaponNode: Node | null = null;

  private moveAxis = new Vec3();
  private hasMovedOnce = false;
  private attackElapsed = 0;
  private attackQueued = false;
  private currentHp = 120;
  private damageCooldownElapsed = 0;
  private autoAimSystem: AutoAimSystem | null = null;
  private swordWeapon: SwordWeapon | null = null;
  private hpBar: Node | null = null;
  private hpBarFill: Node | null = null;
  private hitTimer = 0;
  private originalColor = new Color(100, 180, 255, 255);
  private showBodyHitBox = false;
  private facingDirection: 'north' | 'south' | 'east' | 'west' = 'south';
  private directionalAnimator: DirectionalSpriteAnimator | null = null;

  onLoad(): void {
    this.currentHp = this.maxHp;
    this.moveSpeed *= ProfileService.getMoveSpeedMultiplier();
    this.contactDamageCooldown = ProfileService.getContactDamageCooldown();
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    this.autoAimSystem = this.getComponent(AutoAimSystem);
    this.swordWeapon = this.weaponNode?.getComponent(SwordWeapon) ?? null;
    const debugShape = this.getComponent(DebugShape);
    this.originalColor.set(debugShape?.fillColor ?? this.getComponent(Graphics)?.fillColor ?? new Color(100, 180, 255, 255));
    this.showBodyHitBox = !debugShape?.suppressRendering && this.originalColor.a > 0;
    this.directionalAnimator = this.node.getChildByName('PlayerSprite')?.getComponent(DirectionalSpriteAnimator) ?? null;
    this.createHpBar();
  }

  onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
  }

  private createHpBar(): void {
    const graphics = this.getComponent(Graphics);
    if (!graphics) return;

    this.hpBar = new Node('PlayerHpBar');
    this.hpBar.setParent(this.node);
    this.hpBar.setPosition(0, 60, 0);
    const bgTransform = this.hpBar.addComponent(UITransform);
    bgTransform.setContentSize(80, 10);
    const bgGraphics = this.hpBar.addComponent(Graphics);
    bgGraphics.fillColor = new Color(40, 40, 40, 220);
    bgGraphics.roundRect(-40, -5, 80, 10, 5);
    bgGraphics.fill();

    this.hpBarFill = new Node('HpBarFill');
    this.hpBarFill.setParent(this.hpBar);
    this.hpBarFill.setPosition(-40, 0, 0);
    const fillTransform = this.hpBarFill.addComponent(UITransform);
    fillTransform.setContentSize(76, 6);
    const fillGraphics = this.hpBarFill.addComponent(Graphics);
    fillGraphics.fillColor = new Color(50, 200, 255, 255);
    fillGraphics.roundRect(0, -3, 76, 6, 3);
    fillGraphics.fill();
  }

  private updateHpBar(): void {
    if (!this.hpBarFill) return;
    const ratio = this.currentHp / this.maxHp;
    const transform = this.hpBarFill.getComponent(UITransform);
    if (transform) {
      transform.setContentSize(76 * ratio, 6);
    }
    const graphics = this.hpBarFill.getComponent(Graphics);
    if (graphics) {
      graphics.clear();
      graphics.fillColor = ratio > 0.6 ? new Color(50, 200, 255, 255) : ratio > 0.3 ? new Color(255, 200, 50, 255) : new Color(255, 50, 50, 255);
      graphics.roundRect(0, -3, 76 * ratio, 6, 3);
      graphics.fill();
    }
  }

  update(deltaTime: number): void {
    this.damageCooldownElapsed += deltaTime;

    if (this.hitTimer > 0) {
      this.hitTimer -= deltaTime;
      const graphics = this.getComponent(Graphics);
      if (graphics && this.showBodyHitBox) {
        graphics.fillColor = this.hitTimer > 0 ? new Color(255, 100, 100, 255) : this.originalColor.clone();
        graphics.clear();
        graphics.roundRect(-24, -24, 48, 48, 8);
        graphics.fill();
      }
    }

    this.movePlayer(deltaTime);
    this.updateManualAttack(deltaTime);
    this.refreshVisualState();
  }

  getCurrentHp(): number {
    return this.currentHp;
  }

  getMaxHp(): number {
    return this.maxHp;
  }

  getMoveDirection(): Vec3 {
    if (this.moveAxis.lengthSqr() > 0) {
      return this.moveAxis.clone().normalize();
    }
    return new Vec3(0, 1, 0);
  }

  applyDash(direction: Vec3, distance: number): void {
    const normalized = direction.clone().normalize();
    const dashPos = this.node.position.clone().add(normalized.multiplyScalar(distance));
    this.node.setPosition(this.clampToArena(dashPos));
  }

  heal(amount: number): void {
    if (this.isDead()) {
      return;
    }

    this.currentHp = Math.min(this.maxHp, this.currentHp + Math.max(0, amount));
    this.updateHpBar();
  }

  isDead(): boolean {
    return this.currentHp <= 0;
  }

  hasStartedMoving(): boolean {
    return this.hasMovedOnce;
  }

  receiveDamage(value: number, sourcePosition?: Vec3): boolean {
    if (this.isDead()) {
      return true;
    }

    if (this.damageCooldownElapsed < this.contactDamageCooldown) {
      return false;
    }

    this.damageCooldownElapsed = 0;
    this.hitTimer = this.showBodyHitBox ? 0.15 : 0;
    this.currentHp = Math.max(0, this.currentHp - value);
    this.applyDamageKnockback(sourcePosition);
    this.updateHpBar();
    this.showDamageNumber(value);
    EventBus.emit('player:damaged', { damage: value });
    return this.currentHp <= 0;
  }

  private showDamageNumber(damage: number): void {
    const labelNode = new Node('DamageLabel');
    labelNode.setParent(this.node);
    labelNode.setPosition(0, 50, 0);
    const transform = labelNode.addComponent(UITransform);
    transform.setContentSize(80, 30);
    const label = labelNode.addComponent(Label);
    label.string = `HP -${damage}`;
    label.fontSize = 22;
    label.color = new Color(255, 80, 80, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.isBold = true;

    let elapsed = 0;
    this.schedule((deltaTime: number) => {
      if (!labelNode.isValid) return;
      elapsed += deltaTime;
      labelNode.setPosition(labelNode.position.x, 50 + elapsed * 42, 0);
      const opacity = labelNode.getComponent(UIOpacity) ?? labelNode.addComponent(UIOpacity);
      opacity.opacity = Math.max(0, 255 - Math.floor((elapsed / 0.45) * 255));
      if (elapsed >= 0.45) {
        labelNode.destroy();
      }
    }, 0, 30, 0);
  }

  private readonly ARENA_HALF_W = 570;
  private readonly ARENA_HALF_H = 305;

  private movePlayer(deltaTime: number): void {
    if (this.moveAxis.lengthSqr() === 0) return;

    const normalized = this.moveAxis.clone().normalize();
    this.updateFacingFromVector(normalized);
    const frameMove = normalized.multiplyScalar(this.moveSpeed * deltaTime);
    const next = this.node.position.clone().add(frameMove);

    this.node.setPosition(this.clampToArena(next));
  }

  private applyDamageKnockback(sourcePosition?: Vec3): void {
    const escapeDirection = this.computeEscapeDirection(sourcePosition);
    if (escapeDirection.lengthSqr() < 0.001) {
      return;
    }

    const next = this.node.position.clone().add(escapeDirection.multiplyScalar(this.damageKnockbackDistance));
    this.node.setPosition(this.clampToArena(next));
    this.updateFacingFromVector(escapeDirection);
  }

  private computeEscapeDirection(sourcePosition?: Vec3): Vec3 {
    const escape = new Vec3();

    if (sourcePosition) {
      Vec3.subtract(escape, this.node.position, sourcePosition);
    }

    const enemyRoot = this.node.parent?.getChildByName('EnemyRoot');
    const enemies = enemyRoot?.children ?? [];
    for (const enemy of enemies) {
      if (!enemy.isValid) continue;
      const diff = new Vec3();
      Vec3.subtract(diff, this.node.position, enemy.position);
      const dist = diff.length();
      if (dist < 0.01 || dist > 120) continue;
      const weight = (120 - dist) / 120;
      escape.add(diff.normalize().multiplyScalar(weight * weight * 1.6));
    }

    if (escape.lengthSqr() < 0.001) {
      if (this.moveAxis.lengthSqr() > 0.01) {
        return this.moveAxis.clone().normalize();
      }
      return new Vec3(0, 1, 0);
    }

    return escape.normalize();
  }

  private clampToArena(position: Vec3): Vec3 {
    position.x = Math.max(-this.ARENA_HALF_W, Math.min(this.ARENA_HALF_W, position.x));
    position.y = Math.max(-this.ARENA_HALF_H, Math.min(this.ARENA_HALF_H, position.y));
    return position;
  }

  private updateManualAttack(deltaTime: number): void {
    this.attackElapsed += deltaTime;

    const isAttackHeld = this.keysHeld.has(KeyCode.SPACE);
    const target = this.autoAimSystem?.getNearestEnemy();
    if (!target || !this.swordWeapon) {
      this.attackQueued = false;
      this.swordWeapon?.clearQueuedAttack();
      return;
    }

    // 범위 밖이면 방향만 보정하고 입력은 유지
    const dist = Vec3.distance(this.node.worldPosition, target.worldPosition);
    const attackDir = new Vec3();
    Vec3.subtract(attackDir, target.worldPosition, this.node.worldPosition);
    this.updateFacingFromVector(attackDir);
    if (dist > this.swordWeapon.attackRange) {
      this.swordWeapon.faceTarget(target);
      return;
    }

    if (!isAttackHeld && !this.attackQueued) {
      return;
    }

    if (this.attackElapsed < GAME_CONFIG.baseAttackInterval) {
      return;
    }

    this.attackElapsed = 0;
    this.attackQueued = isAttackHeld;
    this.swordWeapon.attack(target);
  }

  private updateFacingFromVector(direction: Vec3): void {
    if (direction.lengthSqr() < 0.01) return;
    const absX = Math.abs(direction.x);
    const absY = Math.abs(direction.y);

    if (absX > absY) {
      this.facingDirection = direction.x < 0 ? 'west' : 'east';
    } else {
      this.facingDirection = direction.y < 0 ? 'south' : 'north';
    }

    this.swordWeapon?.setFacingDirection(this.facingDirection);
  }

  private refreshVisualState(): void {
    if (!this.directionalAnimator) return;
    const state = this.moveAxis.lengthSqr() > 0.001 ? 'move' : 'idle';
    this.directionalAnimator.play(`${this.facingDirection}_${state}`);
  }

  private readonly keysHeld = new Set<number>();

  private onKeyDown(event: EventKeyboard): void {
    this.keysHeld.add(event.keyCode);
    this.updateMoveAxis();
    const k = event.keyCode;
    if (k === KeyCode.SPACE) {
      this.attackQueued = true;
    }
    if (k === KeyCode.KEY_A || k === KeyCode.ARROW_LEFT ||
        k === KeyCode.KEY_D || k === KeyCode.ARROW_RIGHT ||
        k === KeyCode.KEY_W || k === KeyCode.ARROW_UP ||
        k === KeyCode.KEY_S || k === KeyCode.ARROW_DOWN) {
      this.hasMovedOnce = true;
    }
  }

  private onKeyUp(event: EventKeyboard): void {
    this.keysHeld.delete(event.keyCode);
    this.updateMoveAxis();
    if (event.keyCode === KeyCode.SPACE) {
      this.attackQueued = false;
    }
  }

  private updateMoveAxis(): void {
    const left  = this.keysHeld.has(KeyCode.KEY_A)    || this.keysHeld.has(KeyCode.ARROW_LEFT);
    const right = this.keysHeld.has(KeyCode.KEY_D)    || this.keysHeld.has(KeyCode.ARROW_RIGHT);
    const up    = this.keysHeld.has(KeyCode.KEY_W)    || this.keysHeld.has(KeyCode.ARROW_UP);
    const down  = this.keysHeld.has(KeyCode.KEY_S)    || this.keysHeld.has(KeyCode.ARROW_DOWN);
    this.moveAxis.x = right ? 1 : left ? -1 : 0;
    this.moveAxis.y = up    ? 1 : down ? -1 : 0;
  }
}
