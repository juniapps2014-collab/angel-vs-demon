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
  private worldRoot: Node | null = null;
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

  setCurrentHp(value: number): void {
    this.currentHp = Math.max(0, Math.min(this.maxHp, value));
    this.updateHpBar();
  }

  getMoveDirection(): Vec3 {
    if (this.moveAxis.lengthSqr() > 0) {
      return this.moveAxis.clone().normalize();
    }
    return new Vec3(0, 1, 0);
  }

  applyDash(direction: Vec3, distance: number): void {
    if (!this.worldRoot) return;
    const normalized = direction.clone().normalize();
    this.applyWorldMovement(normalized.multiplyScalar(distance));
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

  setWorldRoot(node: Node): void {
    this.worldRoot = node;
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

  private readonly WORLD_HALF_W = 1400;
  private readonly WORLD_HALF_H = 800;
  private readonly VIEW_HALF_W = 640;
  private readonly VIEW_HALF_H = 360;
  private readonly SCREEN_EDGE_PADDING_X = 88;
  private readonly SCREEN_EDGE_PADDING_Y = 78;

  private clampWorldRoot(position: Vec3): Vec3 {
    const maxScrollX = this.WORLD_HALF_W - this.VIEW_HALF_W;
    const maxScrollY = this.WORLD_HALF_H - this.VIEW_HALF_H;
    position.x = Math.max(-maxScrollX, Math.min(maxScrollX, position.x));
    position.y = Math.max(-maxScrollY, Math.min(maxScrollY, position.y));
    return position;
  }

  private clampPlayerScreenPosition(position: Vec3): Vec3 {
    const maxX = this.VIEW_HALF_W - this.SCREEN_EDGE_PADDING_X;
    const maxY = this.VIEW_HALF_H - this.SCREEN_EDGE_PADDING_Y;
    position.x = Math.max(-maxX, Math.min(maxX, position.x));
    position.y = Math.max(-maxY, Math.min(maxY, position.y));
    return position;
  }

  private movePlayer(deltaTime: number): void {
    if (this.moveAxis.lengthSqr() === 0 || !this.worldRoot) return;

    const normalized = this.moveAxis.clone().normalize();
    this.updateFacingFromVector(normalized);
    const frameMove = normalized.multiplyScalar(this.moveSpeed * deltaTime);
    this.applyWorldMovement(frameMove);
  }

  private applyDamageKnockback(sourcePosition?: Vec3): void {
    const escapeDirection = this.computeEscapeDirection(sourcePosition);
    if (escapeDirection.lengthSqr() < 0.001 || !this.worldRoot) return;

    this.applyWorldMovement(escapeDirection.multiplyScalar(this.damageKnockbackDistance));
    this.updateFacingFromVector(escapeDirection);
  }

  private applyWorldMovement(worldDelta: Vec3): void {
    if (!this.worldRoot) return;

    const playerPos = this.node.position.clone();
    const recenteredDelta = this.consumePlayerOffsetTowardCenter(playerPos, worldDelta);
    const remainingDelta = worldDelta.clone().subtract(recenteredDelta);

    const currentWorldRootPos = this.worldRoot.position.clone();
    const desiredWorldRootPos = currentWorldRootPos.clone().subtract(remainingDelta);
    const clampedWorldRootPos = this.clampWorldRoot(desiredWorldRootPos);
    const consumedByWorld = currentWorldRootPos.clone().subtract(clampedWorldRootPos);
    const leftover = remainingDelta.clone().subtract(consumedByWorld);

    this.worldRoot.setPosition(clampedWorldRootPos);

    if (leftover.lengthSqr() > 0.0001) {
      const nextPlayerPos = playerPos.add(leftover);
      this.node.setPosition(this.clampPlayerScreenPosition(nextPlayerPos));
    } else if (recenteredDelta.lengthSqr() > 0.0001) {
      this.node.setPosition(this.clampPlayerScreenPosition(playerPos));
    }
  }

  private consumePlayerOffsetTowardCenter(playerPos: Vec3, worldDelta: Vec3): Vec3 {
    const consumed = new Vec3();
    this.consumeAxisOffsetTowardCenter(playerPos, worldDelta, consumed, 'x');
    this.consumeAxisOffsetTowardCenter(playerPos, worldDelta, consumed, 'y');
    return consumed;
  }

  private consumeAxisOffsetTowardCenter(
    playerPos: Vec3,
    worldDelta: Vec3,
    consumed: Vec3,
    axis: 'x' | 'y',
  ): void {
    const offset = playerPos[axis];
    const delta = worldDelta[axis];
    if (Math.abs(offset) < 0.001 || Math.abs(delta) < 0.001) {
      return;
    }
    if (Math.sign(offset) === Math.sign(delta)) {
      return;
    }

    const amount = Math.min(Math.abs(offset), Math.abs(delta));
    const movement = Math.sign(delta) * amount;
    playerPos[axis] += movement;
    consumed[axis] = movement;
  }

  private computeEscapeDirection(sourcePosition?: Vec3): Vec3 {
    const escape = new Vec3();

    if (sourcePosition) {
      Vec3.subtract(escape, this.node.worldPosition, sourcePosition);
    }

    // Player → Scene → WorldRoot → EnemyRoot
    const worldRoot = this.node.parent?.getChildByName('WorldRoot');
    const enemyRoot = worldRoot?.getChildByName('EnemyRoot');
    const enemies = enemyRoot?.children ?? [];
    for (const enemy of enemies) {
      if (!enemy.isValid) continue;
      const diff = new Vec3();
      Vec3.subtract(diff, this.node.worldPosition, enemy.worldPosition);
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
