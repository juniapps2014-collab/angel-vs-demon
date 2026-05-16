import {
  _decorator,
  Button,
  Canvas,
  Color,
  Component,
  Graphics,
  Label,
  Node,
  UITransform,
  director,
} from 'cc';
import { ProfileService, PlayerProfile } from '../auth/ProfileService';
import { StageRepository } from '../data/StageRepository';
import { SCENE_NAMES } from '../core/GameConfig';
import { AuthService } from '../auth/AuthService';
import { SoundManager } from '../audio/SoundManager';
import { ProceduralBackground } from './ProceduralBackground';

const { ccclass } = _decorator;

// 3개 패널의 X 중심좌표 (캔버스 1280x720 기준)
const PANEL_CX = { weapon: -400, skill: 0, relic: 400 } as const;
const PANEL_W = 340;
const PANEL_H = 240;
const PANEL_Y = 90;  // 패널 노드 Y

@ccclass('LobbySceneController')
export class LobbySceneController extends Component {
  start(): void {
    const profile = ProfileService.getProfile();
    const canvas = this.ensureCanvas();
    SoundManager.playMenuBgm();

    this.createBackground(canvas, profile);
    this.createHeader(canvas, profile);
    this.createWeaponPanel(canvas, profile);
    this.createSkillsPanel(canvas, profile);
    this.createRelicsPanel(canvas, profile);
    this.createStageInfoBar(canvas, profile);
    this.createBottomBar(canvas);
  }

  // ─── 헤더 ─────────────────────────────────────────────────────────

  private createBackground(canvas: Node, profile: PlayerProfile | null): void {
    const stageId = profile?.currentStage ?? profile?.highestStage ?? 1;
    ProceduralBackground.apply(canvas, stageId);

    const accent = new Node('LobbyAccent');
    accent.setPosition(0, 0);
    accent.addComponent(UITransform).setContentSize(1280, 720);
    const g = accent.addComponent(Graphics);
    g.strokeColor = new Color(120, 185, 255, 42);
    g.lineWidth = 2;
    g.roundRect(-608, -328, 1216, 656, 18);
    g.stroke();
    canvas.addChild(accent);
    accent.setSiblingIndex(1);
  }

  private createHeader(canvas: Node, profile: PlayerProfile | null): void {
    const headerBar = new Node('HeaderBar');
    headerBar.setPosition(0, 270);
    headerBar.addComponent(UITransform).setContentSize(1180, 78);
    const headerG = headerBar.addComponent(Graphics);
    headerG.fillColor = new Color(8, 18, 40, 176);
    headerG.roundRect(-590, -39, 1180, 78, 14);
    headerG.fill();
    headerG.strokeColor = new Color(125, 185, 255, 105);
    headerG.lineWidth = 1.5;
    headerG.roundRect(-590, -39, 1180, 78, 14);
    headerG.stroke();
    canvas.addChild(headerBar);

    this.createLabel(canvas, 'ANGEL VS DEMON', 0, 300, 36, new Color(255, 215, 80, 255));

    const level = profile?.playerLevel ?? 1;
    const nickname = profile?.nickname ?? 'Player';
    const gold = profile?.gold ?? 0;
    const highestStage = profile?.highestStage ?? 1;
    const totalKills = profile?.totalKills ?? 0;

    this.createLabel(canvas, `Lv.${level}  ${nickname}`, -370, 253, 20);
    this.createLabel(
      canvas,
      `Gold  ${gold.toLocaleString()} G`,
      0, 253, 20, new Color(255, 205, 50, 255),
    );
    this.createLabel(canvas, `최고 Stage: ${highestStage}`, 240, 253, 20);
    this.createLabel(
      canvas,
      `총 처치: ${totalKills.toLocaleString()}`,
      430, 253, 18, new Color(150, 200, 255, 200),
    );

    const session = AuthService.getCurrentUser();
    const isCloud = !!session && session.provider !== 'local-fallback';
    this.createLabel(
      canvas,
      isCloud ? '● Cloud' : '● Local',
      560, 253, 15,
      isCloud ? new Color(80, 230, 110, 220) : new Color(220, 160, 60, 220),
    );

  }

  // ─── 무기 패널 ────────────────────────────────────────────────────

  private createWeaponPanel(canvas: Node, profile: PlayerProfile | null): void {
    const cx = PANEL_CX.weapon;
    this.createPanelBg(canvas, cx, PANEL_Y, PANEL_W, PANEL_H, new Color(255, 180, 40, 140));

    this.createLabel(canvas, '⚔  무기', cx, 190, 21, new Color(255, 200, 70, 255));

    const weaponLevel = profile?.weaponLevel ?? 1;
    const currentDmg = 24 + (weaponLevel - 1) * 8;
    const nextDmg = 24 + weaponLevel * 8;
    const cost = ProfileService.getWeaponUpgradeCost();
    const canAfford = (profile?.gold ?? 0) >= cost;

    this.createLabel(canvas, `소드  Lv.${weaponLevel}`, cx, 150, 20);
    this.createWeaponPreview(canvas, cx, 108, profile?.weaponId ?? 'weapon_sword_001', weaponLevel, profile?.relicIds ?? []);
    this.createLabel(
      canvas,
      `데미지  ${currentDmg} → ${nextDmg}`,
      cx, 74, 18, new Color(180, 220, 255, 255),
    );
    this.createLabel(
      canvas,
      `업그레이드 비용: ${cost} G`,
      cx, 46, 17, new Color(255, 215, 70, 255),
    );

    const upgradeBtn = this.createButton(
      canvas, canAfford ? 'UPGRADE' : `Gold ${cost} 필요`,
      cx, 6, 220, 42,
      canAfford ? new Color(40, 110, 55, 230) : new Color(70, 55, 55, 200),
    );
    if (canAfford) {
      upgradeBtn.on('click', () => {
        SoundManager.playUiConfirm();
        ProfileService.tryUpgradeWeapon();
        director.loadScene(SCENE_NAMES.Lobby);
      }, this);
    }
  }

  // ─── 스킬 패널 ────────────────────────────────────────────────────

  private createSkillsPanel(canvas: Node, profile: PlayerProfile | null): void {
    const cx = PANEL_CX.skill;
    this.createPanelBg(canvas, cx, PANEL_Y, PANEL_W, PANEL_H, new Color(80, 150, 255, 130));

    this.createLabel(canvas, '✦  장착 스킬', cx, 190, 21, new Color(140, 195, 255, 255));

    const skillIds = profile?.skillIds ?? [];
    const gold = profile?.gold ?? 0;
    const rows = [150, 105, 60] as const;

    rows.forEach((yPos, i) => {
      const skillId = skillIds[i] ?? '';
      const name = ProfileService.getSkillName(skillId || '-');
      const level = skillId ? ProfileService.getSkillLevel(skillId) : 1;
      const upgradeCost = skillId ? ProfileService.getSkillUpgradeCost(skillId) : 0;
      const canAfford = gold >= upgradeCost && skillId !== '';

      this.createSlotRow(canvas, cx, yPos, `${i + 1}`, `${name} Lv.${level}`, i, 'skill');
      if (skillId) {
        this.createLoadoutBadge(canvas, cx - 82, yPos, skillId, 'skill');
      }

      if (skillId) {
        const lvUpBtn = this.createButton(
          canvas,
          canAfford ? `↑ ${upgradeCost}G` : `${upgradeCost}G 부족`,
          cx + 120, yPos, 80, 26,
          canAfford ? new Color(40, 100, 60, 230) : new Color(60, 50, 50, 180),
        );
        if (canAfford) {
          lvUpBtn.on('click', () => {
            SoundManager.playUiConfirm();
            ProfileService.tryUpgradeSkill(skillId);
            director.loadScene(SCENE_NAMES.Lobby);
          }, this);
        }
      }
    });
  }

  // ─── 유물 패널 ────────────────────────────────────────────────────

  private createRelicsPanel(canvas: Node, profile: PlayerProfile | null): void {
    const cx = PANEL_CX.relic;
    this.createPanelBg(canvas, cx, PANEL_Y, PANEL_W, PANEL_H, new Color(190, 80, 255, 130));

    this.createLabel(canvas, '◈  장착 유물', cx, 190, 21, new Color(210, 155, 255, 255));

    const relicIds = profile?.relicIds ?? [];
    const rows = [150, 105, 60] as const;

    rows.forEach((yPos, i) => {
      const relicId = relicIds[i] ?? '';
      const name = ProfileService.getRelicName(relicId || '-');
      this.createSlotRow(canvas, cx, yPos, `${i + 1}`, name, i, 'relic');
      if (relicId) {
        this.createLoadoutBadge(canvas, cx - 82, yPos, relicId, 'relic');
      }
    });
  }

  // ─── 슬롯 행 (◀ [이름] ▶) ────────────────────────────────────────

  private createSlotRow(
    canvas: Node,
    cx: number,
    y: number,
    slotLabel: string,
    name: string,
    index: number,
    type: 'skill' | 'relic',
  ): void {
    // 슬롯 번호
    this.createLabel(canvas, slotLabel, cx - 158, y, 15, new Color(140, 140, 160, 220));

    // ◀ 이전 버튼
    const prevBtn = this.createButton(canvas, '◀', cx - 130, y, 34, 30);
    prevBtn.on('click', () => {
      if (type === 'skill') ProfileService.cycleSkillPrev(index);
      else ProfileService.cycleRelicPrev(index);
      SoundManager.playUiConfirm();
      director.loadScene(SCENE_NAMES.Lobby);
    }, this);

    // 이름 레이블
    const nameNode = new Node(name);
    nameNode.setPosition(cx, y);
    nameNode.addComponent(UITransform).setContentSize(190, 30);
    const nameLabel = nameNode.addComponent(Label);
    nameLabel.string = name;
    nameLabel.fontSize = 17;
    nameLabel.color = new Color(225, 225, 225, 255);
    nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    nameLabel.verticalAlign = Label.VerticalAlign.CENTER;
    nameLabel.overflow = Label.Overflow.SHRINK;
    canvas.addChild(nameNode);

    // ▶ 다음 버튼
    const nextBtn = this.createButton(canvas, '▶', cx + 130, y, 34, 30);
    nextBtn.on('click', () => {
      if (type === 'skill') ProfileService.cycleSkill(index);
      else ProfileService.cycleRelic(index);
      SoundManager.playUiConfirm();
      director.loadScene(SCENE_NAMES.Lobby);
    }, this);
  }

  private createWeaponPreview(
    canvas: Node,
    cx: number,
    y: number,
    weaponId: string,
    weaponLevel: number,
    relicIds: string[],
  ): void {
    const preview = new Node('WeaponPreview');
    preview.setPosition(cx, y);
    preview.addComponent(UITransform).setContentSize(188, 50);
    const g = preview.addComponent(Graphics);
    const hasHorn = relicIds.includes('relic_broken_horn');
    const hasGrail = relicIds.includes('relic_holy_grail');
    const bladeColor = hasHorn
      ? new Color(255, 145, 120, 245)
      : hasGrail
        ? new Color(255, 232, 140, 245)
        : new Color(220, 235, 255, 245);
    const guardColor = weaponId === 'weapon_sword_001'
      ? new Color(96, 170, 255, 228)
      : new Color(150, 150, 220, 228);
    const bladeLength = 64 + Math.min(28, weaponLevel * 2);
    const bladeHeight = weaponLevel >= 7 ? 12 : 10;

    g.fillColor = new Color(12, 22, 46, 168);
    g.roundRect(-88, -22, 176, 44, 14);
    g.fill();
    g.strokeColor = new Color(116, 150, 215, 92);
    g.lineWidth = 1;
    g.roundRect(-88, -22, 176, 44, 14);
    g.stroke();
    g.fillColor = new Color(255, 255, 255, 12);
    g.roundRect(-84, 2, 168, 14, 10);
    g.fill();
    g.fillColor = bladeColor;
    g.moveTo(-18, -bladeHeight / 2);
    g.lineTo(-18 + bladeLength, -bladeHeight / 2);
    g.lineTo(-8 + bladeLength, 0);
    g.lineTo(-18 + bladeLength, bladeHeight / 2);
    g.lineTo(-18, bladeHeight / 2);
    g.close();
    g.fill();
    g.fillColor = guardColor;
    g.roundRect(-28, -10, 12, 20, 4);
    g.fill();
    g.roundRect(-40, -4, 18, 8, 3);
    g.fill();
    g.fillColor = new Color(255, 221, 140, 110);
    g.circle(-22, 0, 2.4);
    g.fill();
    g.strokeColor = new Color(255, 190, 70, 220);
    g.lineWidth = 1.4;
    g.moveTo(-18, -bladeHeight / 2);
    g.lineTo(-18 + bladeLength, -bladeHeight / 2);
    g.lineTo(-8 + bladeLength, 0);
    g.lineTo(-18 + bladeLength, bladeHeight / 2);
    g.lineTo(-18, bladeHeight / 2);
    g.close();
    g.stroke();
    canvas.addChild(preview);
  }

  private createLoadoutBadge(
    canvas: Node,
    x: number,
    y: number,
    id: string,
    type: 'skill' | 'relic',
  ): void {
    const badge = new Node(`Badge_${id}`);
    badge.setPosition(x, y);
    badge.addComponent(UITransform).setContentSize(34, 34);
    const g = badge.addComponent(Graphics);
    const frameColor = type === 'skill'
      ? new Color(92, 148, 240, 86)
      : new Color(186, 132, 240, 86);

    g.fillColor = new Color(10, 18, 38, 178);
    g.roundRect(-15, -15, 30, 30, 10);
    g.fill();
    g.strokeColor = frameColor;
    g.lineWidth = 1;
    g.roundRect(-15, -15, 30, 30, 10);
    g.stroke();
    g.fillColor = new Color(255, 255, 255, 10);
    g.roundRect(-12, 1, 24, 10, 8);
    g.fill();

    if (type === 'skill') {
      g.fillColor = new Color(122, 176, 255, 215);
      switch (id) {
        case 'skill_star_burst':
          g.moveTo(0, 12); g.lineTo(4, 4); g.lineTo(12, 0); g.lineTo(4, -4);
          g.lineTo(0, -12); g.lineTo(-4, -4); g.lineTo(-12, 0); g.lineTo(-4, 4); g.close(); g.fill();
          break;
        case 'skill_guardian_aura':
          g.strokeColor = new Color(135, 235, 255, 255);
          g.lineWidth = 2;
          g.circle(0, 0, 10);
          g.stroke();
          g.strokeColor = new Color(230, 248, 255, 160);
          g.lineWidth = 1;
          g.circle(0, 0, 6.5);
          g.stroke();
          break;
        case 'skill_heaven_strike':
          g.fillColor = new Color(255, 231, 170, 215);
          g.rect(-2, -10, 4, 20);
          g.fill();
          g.rect(-10, -2, 20, 4);
          g.fill();
          break;
        case 'skill_holy_dash':
          g.fillColor = new Color(180, 224, 255, 210);
          g.moveTo(-10, 0); g.lineTo(2, 8); g.lineTo(10, 0); g.lineTo(2, -8); g.close(); g.fill();
          break;
        default:
          g.circle(0, 0, 8); g.fill();
          break;
      }
    } else {
      switch (id) {
        case 'relic_holy_grail':
          g.fillColor = new Color(255, 218, 110, 220);
          g.moveTo(-6, 7); g.lineTo(6, 7); g.lineTo(9, -3); g.lineTo(-9, -3); g.close(); g.fill();
          g.rect(-2, -7, 4, 6);
          g.fill();
          break;
        case 'relic_broken_horn':
          g.fillColor = new Color(255, 126, 104, 220);
          g.moveTo(-2, 0); g.lineTo(-10, 10); g.lineTo(-6, -8); g.close(); g.fill();
          g.moveTo(2, 0); g.lineTo(10, 10); g.lineTo(4, -8); g.close(); g.fill();
          break;
        case 'relic_celestial_compass':
          g.strokeColor = new Color(120, 180, 255, 255);
          g.lineWidth = 2;
          g.circle(0, 0, 10); g.stroke();
          g.moveTo(0, 12); g.lineTo(0, 4); g.moveTo(12, 0); g.lineTo(4, 0); g.stroke();
          break;
        case 'relic_laughter_mask':
          g.fillColor = new Color(214, 170, 255, 220);
          g.roundRect(-9, -7, 18, 14, 5); g.fill();
          break;
        case 'relic_guardian_feather':
          g.fillColor = new Color(232, 242, 255, 220);
          g.moveTo(-8, -8); g.lineTo(6, 0); g.lineTo(-4, 10); g.close(); g.fill();
          break;
        case 'relic_golden_bell':
          g.fillColor = new Color(255, 205, 88, 220);
          g.moveTo(-7, 4); g.lineTo(7, 4); g.lineTo(10, -6); g.lineTo(-10, -6); g.close(); g.fill();
          break;
        default:
          g.fillColor = new Color(210, 155, 255, 220);
          g.circle(0, 0, 8); g.fill();
          break;
      }
    }

    canvas.addChild(badge);
  }

  // ─── 스테이지 정보 바 ─────────────────────────────────────────────

  private createStageInfoBar(canvas: Node, profile: PlayerProfile | null): void {
    const stageId = profile?.currentStage ?? profile?.highestStage ?? 1;
    const stage = StageRepository.getStage(stageId);
    const playerDmg = ProfileService.getWeaponDamage();
    const recPower = stage.recommendedPower;

    // 플레이어 전투력 vs 권장 전투력
    const powerRatio = playerDmg / (recPower * 0.1);
    const readyText = powerRatio >= 1.0 ? '✓ 도전 가능' : `△ 추천 전투력: ${recPower}`;
    const readyColor =
      powerRatio >= 1.0 ? new Color(80, 230, 110, 255) : new Color(255, 180, 50, 255);

    // 배경 바
    const barNode = new Node('StageInfoBar');
    barNode.setPosition(0, -38);
    barNode.addComponent(UITransform).setContentSize(1180, 40);
    const g = barNode.addComponent(Graphics);
    g.fillColor = new Color(10, 18, 36, 208);
    g.roundRect(-590, -20, 1180, 40, 6);
    g.fill();
    g.strokeColor = new Color(60, 90, 140, 150);
    g.lineWidth = 1;
    g.roundRect(-590, -20, 1180, 40, 6);
    g.stroke();
    canvas.addChild(barNode);

    const isBoss = StageRepository.isBossStage(stageId);
    const bossTag = isBoss ? '  ⚠ BOSS 스테이지' : '';
    const infoText =
      `다음 Stage ${stageId}  |  추천 전투력: ${recPower}  |  적 수: ${stage.enemyCount}  |  보상: ${stage.rewardGold}G${bossTag}`;

    const infoNode = new Node('StageInfoText');
    infoNode.setPosition(-200, -38);
    infoNode.addComponent(UITransform).setContentSize(700, 30);
    const infoLabel = infoNode.addComponent(Label);
    infoLabel.string = infoText;
    infoLabel.fontSize = 16;
    infoLabel.color = new Color(190, 210, 240, 255);
    infoLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
    infoLabel.verticalAlign = Label.VerticalAlign.CENTER;
    canvas.addChild(infoNode);

    const readyNode = new Node('ReadyText');
    readyNode.setPosition(450, -38);
    readyNode.addComponent(UITransform).setContentSize(220, 30);
    const readyLabel = readyNode.addComponent(Label);
    readyLabel.string = readyText;
    readyLabel.fontSize = 16;
    readyLabel.color = readyColor;
    readyLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    readyLabel.verticalAlign = Label.VerticalAlign.CENTER;
    canvas.addChild(readyNode);
  }

  // ─── 하단 버튼 ────────────────────────────────────────────────────

  private createBottomBar(canvas: Node): void {
    const hasRunState = ProfileService.hasRunState();
    const BTN_Y = -290;
    const BTN_W = 200;
    const BTN_H = 48;
    const GAP = 24;

    // 하단 공통 바 배경
    const bar = new Node('BottomBar');
    bar.setPosition(0, BTN_Y);
    bar.addComponent(UITransform).setContentSize(1180, 68);
    const bg = bar.addComponent(Graphics);
    bg.fillColor = new Color(8, 16, 36, 200);
    bg.roundRect(-590, -34, 1180, 68, 10);
    bg.fill();
    bg.strokeColor = new Color(80, 120, 200, 85);
    bg.lineWidth = 1;
    bg.roundRect(-590, -34, 1180, 68, 10);
    bg.stroke();
    canvas.addChild(bar);

    // 3개 버튼 X 좌표: 좌, 중, 우 — 동일 간격
    const totalW = BTN_W * 3 + GAP * 2;
    const leftX  = -totalW / 2 + BTN_W / 2;       // -224
    const centerX = 0;
    const rightX  = totalW / 2 - BTN_W / 2;       // 224

    // LOGOUT
    const logoutBtn = this.createButton(
      canvas, 'LOGOUT', leftX, BTN_Y, BTN_W, BTN_H,
      new Color(92, 42, 42, 225),
    );
    logoutBtn.on('click', () => {
      void this.handleLogout();
    }, this);

    // BATTLE / CONTINUE
    const battleBtn = this.createButton(
      canvas, hasRunState ? '▶  CONTINUE' : '⚔  BATTLE', centerX, BTN_Y, BTN_W, BTN_H,
      new Color(190, 50, 50, 235),
    );
    battleBtn.on('click', () => {
      SoundManager.playUiConfirm();
      director.loadScene(SCENE_NAMES.Battle);
    }, this);

    // REFRESH / RESTART
    const refreshBtn = this.createButton(
      canvas, hasRunState ? 'RESTART' : 'REFRESH', rightX, BTN_Y, BTN_W, BTN_H,
      new Color(35, 55, 95, 225),
    );
    refreshBtn.on('click', () => {
      SoundManager.playUiClick();
      if (hasRunState) {
        ProfileService.clearRunState();
      }
      director.loadScene(hasRunState ? SCENE_NAMES.Battle : SCENE_NAMES.Lobby);
    }, this);
  }

  private async handleLogout(): Promise<void> {
    await AuthService.signOut();
    ProfileService.resetSession();
    director.loadScene(SCENE_NAMES.Login);
  }

  // ─── 헬퍼 ────────────────────────────────────────────────────────

  private ensureCanvas(): Node {
    let canvas = this.node.getChildByName('Canvas');
    if (canvas) return canvas;
    canvas = new Node('Canvas');
    canvas.addComponent(UITransform).setContentSize(1280, 720);
    canvas.addComponent(Canvas);
    this.node.addChild(canvas);
    return canvas;
  }

  private createPanelBg(
    parent: Node,
    cx: number,
    cy: number,
    w: number,
    h: number,
    borderColor: Color,
  ): void {
    const panelNode = new Node('Panel');
    panelNode.setPosition(cx, cy);
    panelNode.addComponent(UITransform).setContentSize(w, h);
    const g = panelNode.addComponent(Graphics);
    g.fillColor = new Color(10, 18, 42, 214);
    g.roundRect(-w / 2, -h / 2, w, h, 12);
    g.fill();
    g.fillColor = new Color(borderColor.r, borderColor.g, borderColor.b, 24);
    g.roundRect(-w / 2, h / 2 - 44, w, 44, 12);
    g.fill();
    g.fillColor = new Color(255, 255, 255, 10);
    g.roundRect(-w / 2 + 4, 20, w - 8, h / 2 - 24, 10);
    g.fill();
    g.strokeColor = borderColor;
    g.lineWidth = 1.5;
    g.roundRect(-w / 2, -h / 2, w, h, 12);
    g.stroke();
    parent.addChild(panelNode);
  }

  private createLabel(
    parent: Node,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: Color = new Color(225, 225, 225, 255),
  ): void {
    const node = new Node(text);
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(360, fontSize + 14);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 8;
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    parent.addChild(node);
  }

  private createButton(
    parent: Node,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    bgColor: Color = new Color(35, 55, 95, 225),
  ): Node {
    const btn = new Node(text);
    btn.setPosition(x, y);
    btn.addComponent(UITransform).setContentSize(width, height);

    const glowNode = new Node('BtnGlow');
    glowNode.setPosition(0, -4);
    glowNode.addComponent(UITransform).setContentSize(width + 12, height + 8);
    const glow = glowNode.addComponent(Graphics);
    glow.fillColor = new Color(bgColor.r, bgColor.g, bgColor.b, 58);
    glow.roundRect(-(width + 12) / 2, -(height + 8) / 2, width + 12, height + 8, 10);
    glow.fill();
    btn.addChild(glowNode);

    const bgNode = new Node('BtnBg');
    bgNode.setPosition(0, 0);
    bgNode.addComponent(UITransform).setContentSize(width, height);
    const g = bgNode.addComponent(Graphics);
    g.fillColor = bgColor;
    g.roundRect(-width / 2, -height / 2, width, height, 7);
    g.fill();
    g.fillColor = new Color(255, 255, 255, 16);
    g.roundRect(-width / 2 + 2, 2, width - 4, height / 2 - 4, 7);
    g.fill();
    g.strokeColor = new Color(140, 190, 255, 150);
    g.lineWidth = 1;
    g.roundRect(-width / 2, -height / 2, width, height, 7);
    g.stroke();
    btn.addChild(bgNode);

    // 텍스트 Label — 자식 노드로 분리해 Graphics 위에 렌더링
    const textNode = new Node('BtnText');
    textNode.setPosition(0, 0);
    textNode.addComponent(UITransform).setContentSize(width - 4, height);
    const label = textNode.addComponent(Label);
    label.string = text;
    label.fontSize = Math.min(17, height - 8);
    label.color = new Color(244, 246, 255, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    btn.addChild(textNode);

    btn.addComponent(Button);
    parent.addChild(btn);
    return btn;
  }
}
