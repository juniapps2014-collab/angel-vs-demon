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
import { AuthService } from '../auth/AuthService';
import { SCENE_NAMES } from '../core/GameConfig';
import { SupabaseClient } from '../network/SupabaseClient';
import { SoundManager } from '../audio/SoundManager';
import { BackgroundArt } from './BackgroundArt';

const { ccclass } = _decorator;

@ccclass('LoginSceneController')
export class LoginSceneController extends Component {
  async start(): Promise<void> {
    const profile = await ProfileService.ensureProfile();
    const canvas = this.ensureCanvas();

    this.createBackground(canvas);
    this.createTitle(canvas);
    this.createProfileCard(canvas, profile);
    this.createBottomArea(canvas);
  }

  private createBackground(canvas: Node): void {
    BackgroundArt.apply(canvas, 'images/backgrounds/login_city', {
      overlayColor: new Color(8, 8, 22, 255),
      overlayAlpha: 110,
    });

    const bg = new Node('Background');
    bg.setPosition(0, 0);
    bg.addComponent(UITransform).setContentSize(1280, 720);
    const g = bg.addComponent(Graphics);
    g.strokeColor = new Color(40, 55, 95, 120);
    g.lineWidth = 1;
    for (let x = -640; x <= 640; x += 80) {
      g.moveTo(x, -360); g.lineTo(x, 360); g.stroke();
    }
    for (let y = -360; y <= 360; y += 80) {
      g.moveTo(-640, y); g.lineTo(640, y); g.stroke();
    }
    canvas.addChild(bg);
    bg.setSiblingIndex(1);
  }

  private createTitle(canvas: Node): void {
    this.createLabel(canvas, 'ANGEL VS DEMON', 2, 218, 46, new Color(120, 70, 0, 160));
    this.createLabel(canvas, 'ANGEL VS DEMON', 0, 220, 46, new Color(255, 215, 80, 255));
    this.createLabel(canvas, '─  Casual Arcade Action  ─', 0, 168, 17, new Color(160, 160, 200, 200));
  }

  private createProfileCard(canvas: Node, profile: PlayerProfile): void {
    const card = new Node('ProfileCard');
    card.setPosition(0, 40);
    card.addComponent(UITransform).setContentSize(500, 210);
    const g = card.addComponent(Graphics);
    g.fillColor = new Color(10, 18, 42, 224);
    g.roundRect(-250, -105, 500, 210, 14);
    g.fill();
    g.fillColor = new Color(255, 220, 90, 24);
    g.roundRect(-250, 54, 500, 36, 14);
    g.fill();
    g.strokeColor = new Color(110, 155, 225, 190);
    g.lineWidth = 1.5;
    g.roundRect(-250, -105, 500, 210, 14);
    g.stroke();
    canvas.addChild(card);

    this.createLabel(canvas, 'HUNTER PROFILE', 0, 132, 13, new Color(255, 224, 120, 220));
    this.createLabel(canvas, profile.nickname, 0, 108, 30, new Color(200, 230, 255, 255));

    const stats = `Lv.${profile.playerLevel}  |  Stage ${profile.highestStage}  |  처치 ${(profile.totalKills ?? 0).toLocaleString()}`;
    this.createLabel(canvas, stats, 0, 66, 18, new Color(155, 185, 230, 230));

    this.createLabel(
      canvas,
      `Gold: ${(profile.gold ?? 0).toLocaleString()} G`,
      0, 30, 16, new Color(255, 205, 50, 220),
    );

    const session = AuthService.getCurrentUser();
    const isCloud = session?.provider === 'supabase-anon';
    const modeText = isCloud ? `● Cloud  (${SupabaseClient.getProjectLabel()})` : '● Local Mode';
    const modeColor = isCloud ? new Color(80, 230, 110, 220) : new Color(220, 160, 60, 220);
    this.createLabel(canvas, modeText, 0, -4, 14, modeColor);

    const renameBtn = this.createButton(
      canvas, '닉네임 변경', 0, -58, 190, 38,
      new Color(30, 50, 95, 215),
    );
    renameBtn.on('click', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newName = (globalThis as any).prompt?.('새 닉네임을 입력하세요:', profile.nickname);
      if (newName && newName.trim()) {
        SoundManager.playUiConfirm();
        ProfileService.updateNickname(newName.trim());
        director.loadScene(SCENE_NAMES.Login);
      } else {
        SoundManager.playUiError();
      }
    }, this);
  }

  private createBottomArea(canvas: Node): void {
    this.createLabel(canvas, '언데드 웨이브를 돌파하고 천계의 칼날을 강화하세요', 0, -112, 15, new Color(212, 224, 240, 205));

    const startBtn = this.createButton(
      canvas, '▶  LOBBY 입장', 0, -158, 300, 52,
      new Color(188, 62, 48, 238),
    );
    startBtn.on('click', () => {
      SoundManager.playUiConfirm();
      director.loadScene(SCENE_NAMES.Lobby);
    }, this);

    this.createLabel(canvas, 'v0.1.0  Web MVP', 0, -210, 13, new Color(100, 100, 130, 150));
  }

  private ensureCanvas(): Node {
    let canvas = this.node.getChildByName('Canvas');
    if (canvas) return canvas;
    canvas = new Node('Canvas');
    canvas.addComponent(UITransform).setContentSize(1280, 720);
    canvas.addComponent(Canvas);
    this.node.addChild(canvas);
    return canvas;
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
    node.addComponent(UITransform).setContentSize(640, fontSize + 14);
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
    glowNode.addComponent(UITransform).setContentSize(width + 14, height + 10);
    const glow = glowNode.addComponent(Graphics);
    glow.fillColor = new Color(bgColor.r, bgColor.g, bgColor.b, 68);
    glow.roundRect(-(width + 14) / 2, -(height + 10) / 2, width + 14, height + 10, 12);
    glow.fill();
    btn.addChild(glowNode);

    const bgNode = new Node('BtnBg');
    bgNode.setPosition(0, 0);
    bgNode.addComponent(UITransform).setContentSize(width, height);
    const g = bgNode.addComponent(Graphics);
    g.fillColor = bgColor;
    g.roundRect(-width / 2, -height / 2, width, height, 8);
    g.fill();
    g.fillColor = new Color(255, 255, 255, 18);
    g.roundRect(-width / 2 + 2, 2, width - 4, height / 2 - 4, 8);
    g.fill();
    g.strokeColor = new Color(126, 176, 245, 170);
    g.lineWidth = 1.5;
    g.roundRect(-width / 2, -height / 2, width, height, 8);
    g.stroke();
    btn.addChild(bgNode);

    const textNode = new Node('BtnText');
    textNode.setPosition(0, 0);
    textNode.addComponent(UITransform).setContentSize(width - 4, height);
    const label = textNode.addComponent(Label);
    label.string = text;
    label.fontSize = Math.min(22, height - 10);
    label.color = new Color(244, 246, 255, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.isBold = true;
    btn.addChild(textNode);

    btn.addComponent(Button);
    parent.addChild(btn);
    return btn;
  }
}
