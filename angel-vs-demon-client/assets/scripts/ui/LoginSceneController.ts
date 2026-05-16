import {
  _decorator,
  Button,
  Canvas,
  Color,
  Component,
  EditBox,
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
import { SUPABASE_PROJECT_CONFIG } from '../network/SupabaseProjectConfig';
import { SoundManager } from '../audio/SoundManager';
import { BackgroundArt } from './BackgroundArt';

const { ccclass } = _decorator;

@ccclass('LoginSceneController')
export class LoginSceneController extends Component {
  private static readonly AUTH_CARD_WIDTH = 560;
  private static readonly INPUT_WIDTH = 364;
  private static readonly LABEL_WIDTH = 96;
  private static readonly FIELD_GAP = 12;
  private static readonly ROW_GAP = 18;

  private authMode: 'login' | 'signup' = 'login';
  private emailInput: EditBox | null = null;
  private passwordInput: EditBox | null = null;
  private nicknameInput: EditBox | null = null;
  private authStatusLabel: Label | null = null;
  private authTitleLabel: Label | null = null;
  private authSubtitleLabel: Label | null = null;
  private submitButtonLabel: Label | null = null;
  private modeLoginButtonLabel: Label | null = null;
  private modeSignupButtonLabel: Label | null = null;
  private nicknameRowNode: Node | null = null;

  async start(): Promise<void> {
    if (!SupabaseClient.isConfigured()) {
      SupabaseClient.initialize(SUPABASE_PROJECT_CONFIG);
    }
    SoundManager.playMenuBgm();

    const canvas = this.ensureCanvas();

    this.createBackground(canvas);
    this.createTitle(canvas);
    const user = AuthService.getCurrentUser();
    if (user) {
      const profile = await ProfileService.ensureProfile();
      this.createProfileCard(canvas, profile);
    } else {
      this.createAuthCard(canvas);
    }
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
    const isCloud = !!session && session.provider !== 'local-fallback';
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
    const bottomInfoY = AuthService.getCurrentUser() ? -112 : -248;
    const bottomActionY = AuthService.getCurrentUser() ? -158 : -300;
    const versionY = AuthService.getCurrentUser() ? -210 : -354;

    if (AuthService.getCurrentUser()) {
      this.createLabel(canvas, '언데드 웨이브를 돌파하고 천계의 칼날을 강화하세요', 0, bottomInfoY, 15, new Color(212, 224, 240, 205));
    } else {
      // Card bottom is at canvas y ≈ -254; keep info panel below with a gap
      const infoPanel = new Node('BottomInfoPanel');
      infoPanel.setPosition(0, -316);
      infoPanel.addComponent(UITransform).setContentSize(460, 80);
      const panelGraphics = infoPanel.addComponent(Graphics);
      panelGraphics.fillColor = new Color(9, 16, 36, 176);
      panelGraphics.roundRect(-230, -40, 460, 80, 16);
      panelGraphics.fill();
      panelGraphics.strokeColor = new Color(108, 148, 216, 90);
      panelGraphics.lineWidth = 1;
      panelGraphics.roundRect(-230, -40, 460, 80, 16);
      panelGraphics.stroke();
      canvas.addChild(infoPanel);

      this.createLabel(infoPanel, '언데드 웨이브를 돌파하고 천계의 칼날을 강화하세요', 0, 10, 15, new Color(225, 234, 246, 228));
      this.createLabel(infoPanel, '이메일 로그인 또는 게스트로 시작할 수 있습니다', 0, -18, 14, new Color(170, 198, 238, 220));
    }

    if (AuthService.getCurrentUser()) {
      const startBtn = this.createButton(
        canvas, '▶  LOBBY 입장', 0, bottomActionY, 300, 52,
        new Color(188, 62, 48, 238),
      );
      startBtn.on('click', () => {
        SoundManager.playUiConfirm();
        director.loadScene(SCENE_NAMES.Lobby);
      }, this);
    }

    this.createLabel(canvas, 'v0.1.0  Web MVP', 0, versionY, 13, new Color(100, 100, 130, 150));
  }

  private createAuthCard(canvas: Node): void {
    const card = new Node('AuthCard');
    card.setPosition(0, 8);
    // Card spans local y: -262 to +178 (top 20px above title, bottom 20px below guest button)
    card.addComponent(UITransform).setContentSize(LoginSceneController.AUTH_CARD_WIDTH, 440);
    const g = card.addComponent(Graphics);
    g.fillColor = new Color(10, 18, 42, 224);
    g.roundRect(-280, -262, 560, 440, 18);
    g.fill();
    g.fillColor = new Color(255, 220, 90, 18);
    g.roundRect(-280, 132, 560, 42, 18);
    g.fill();
    g.strokeColor = new Color(110, 155, 225, 190);
    g.lineWidth = 1.5;
    g.roundRect(-280, -262, 560, 440, 18);
    g.stroke();
    canvas.addChild(card);

    const titleNode = this.createLabel(card, '로그인', 0, 138, 26, new Color(255, 224, 120, 240));
    this.authTitleLabel = titleNode.getComponent(Label);
    const subtitleNode = this.createLabel(card, '이메일과 비밀번호로 저장된 진행 상태를 불러옵니다', 0, 104, 15, new Color(180, 205, 240, 220));
    this.authSubtitleLabel = subtitleNode.getComponent(Label);

    const loginModeBtn = this.createButton(card, '로그인', -92, 68, 132, 34, new Color(48, 82, 140, 220));
    this.modeLoginButtonLabel = loginModeBtn.getChildByName('BtnText')?.getComponent(Label) ?? null;
    loginModeBtn.on('click', () => this.setAuthMode('login'), this);

    const signupModeBtn = this.createButton(card, '회원가입', 92, 68, 132, 34, new Color(42, 78, 112, 180));
    this.modeSignupButtonLabel = signupModeBtn.getChildByName('BtnText')?.getComponent(Label) ?? null;
    signupModeBtn.on('click', () => this.setAuthMode('signup'), this);

    const firstRowY = 12;
    const secondRowY = firstRowY - (42 + LoginSceneController.ROW_GAP);
    const thirdRowY = secondRowY - (42 + LoginSceneController.ROW_GAP);

    this.emailInput = this.createInputRow(card, '이메일', firstRowY, 'you@example.com');
    this.passwordInput = this.createInputRow(card, '비밀번호', secondRowY, 'password', true);

    const nicknameRow = this.createInputRowNode(card, '닉네임', thirdRowY, 'optional nickname');
    this.nicknameRowNode = nicknameRow;
    this.nicknameInput = nicknameRow.getComponentInChildren(EditBox);

    const statusNode = new Node('AuthStatus');
    statusNode.setPosition(0, -138);
    statusNode.addComponent(UITransform).setContentSize(460, 24);
    this.authStatusLabel = statusNode.addComponent(Label);
    this.authStatusLabel.string = '계정 로그인 시 스테이지 진행 상태가 저장됩니다';
    this.authStatusLabel.fontSize = 13;
    this.authStatusLabel.lineHeight = 18;
    this.authStatusLabel.color = new Color(170, 196, 230, 210);
    this.authStatusLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    card.addChild(statusNode);

    const submitBtn = this.createButton(card, '이메일 로그인', 0, -170, 220, 42, new Color(45, 78, 138, 230));
    this.submitButtonLabel = submitBtn.getChildByName('BtnText')?.getComponent(Label) ?? null;
    submitBtn.on('click', () => {
      if (this.authMode === 'signup') {
        void this.handleEmailSignUp();
        return;
      }
      void this.handleEmailLogin();
    }, this);

    const guestBtn = this.createButton(card, '게스트 시작', 0, -222, 220, 40, new Color(120, 84, 40, 220));
    guestBtn.on('click', () => {
      void this.handleGuestStart();
    }, this);

    this.setAuthMode('login');
  }

  private async handleEmailLogin(): Promise<void> {
    const email = this.emailInput?.string.trim() ?? '';
    const password = this.passwordInput?.string.trim() ?? '';
    if (!email || !password) {
      this.setAuthStatus('이메일과 비밀번호를 입력하세요', new Color(255, 150, 120, 255));
      SoundManager.playUiError();
      return;
    }

    try {
      this.setAuthStatus('로그인 중...', new Color(160, 210, 255, 255));
      await AuthService.signInWithEmail(email.trim(), password.trim());
      ProfileService.resetSession();
      await ProfileService.ensureProfile();
      this.setAuthStatus('로그인 성공', new Color(90, 220, 120, 255));
      SoundManager.playUiConfirm();
      director.loadScene(SCENE_NAMES.Lobby);
    } catch (error) {
      console.warn('[LoginSceneController] Email login failed.', error);
      const message = error instanceof Error ? error.message : '로그인에 실패했습니다';
      if (message.toLowerCase().includes('email not confirmed')) {
        this.setAuthStatus('이메일 인증 후 로그인하세요', new Color(255, 220, 120, 255));
      } else {
        this.setAuthStatus(`로그인 실패: ${message}`, new Color(255, 150, 120, 255));
      }
      SoundManager.playUiError();
    }
  }

  private async handleEmailSignUp(): Promise<void> {
    const email = this.emailInput?.string.trim() ?? '';
    const password = this.passwordInput?.string.trim() ?? '';
    const nickname = this.nicknameInput?.string.trim() ?? '';
    if (!email || !password || !nickname) {
      this.setAuthStatus('회원가입에는 이메일과 비밀번호가 필요합니다', new Color(255, 150, 120, 255));
      SoundManager.playUiError();
      return;
    }

    try {
      this.setAuthStatus('회원가입 중...', new Color(160, 210, 255, 255));
      const result = await AuthService.signUpWithEmail(email.trim(), password.trim());
      if (result.needsEmailConfirmation) {
        if (nickname) {
          globalThis.localStorage?.setItem('avd.pendingNickname', nickname.trim());
        }
        this.setAuthMode('login');
        this.setAuthStatus('가입 완료: 이메일 확인 후 로그인하세요', new Color(255, 220, 120, 255));
        SoundManager.playUiConfirm();
        return;
      }
      ProfileService.resetSession();
      await ProfileService.ensureProfile();
      if (nickname) {
        ProfileService.updateNickname(nickname);
      }
      this.setAuthStatus('회원가입 성공', new Color(90, 220, 120, 255));
      SoundManager.playUiConfirm();
      director.loadScene(SCENE_NAMES.Lobby);
    } catch (error) {
      console.warn('[LoginSceneController] Email sign-up failed.', error);
      const message = error instanceof Error ? error.message : '회원가입에 실패했습니다';
      if (message.toLowerCase().includes('email not confirmed')) {
        this.setAuthStatus('회원가입 완료, 이메일 인증 후 로그인하세요', new Color(255, 220, 120, 255));
      } else {
        this.setAuthStatus(`회원가입 실패: ${message}`, new Color(255, 150, 120, 255));
      }
      SoundManager.playUiError();
    }
  }

  private async handleGuestStart(): Promise<void> {
    this.setAuthStatus('게스트 세션 생성 중...', new Color(160, 210, 255, 255));
    await AuthService.signInAnonymously();
    ProfileService.resetSession();
    await ProfileService.ensureProfile();
    SoundManager.playUiConfirm();
    director.loadScene(SCENE_NAMES.Lobby);
  }

  private setAuthStatus(message: string, color: Color): void {
    if (!this.authStatusLabel) {
      return;
    }
    this.authStatusLabel.string = message;
    this.authStatusLabel.color = color;
  }

  private setAuthMode(mode: 'login' | 'signup'): void {
    this.authMode = mode;
    const isSignup = mode === 'signup';
    if (this.authTitleLabel) {
      this.authTitleLabel.string = isSignup ? '회원가입' : '로그인';
    }
    if (this.authSubtitleLabel) {
      this.authSubtitleLabel.string = isSignup
        ? '닉네임까지 입력하면 저장용 계정을 생성합니다'
        : '이메일과 비밀번호로 저장된 진행 상태를 불러옵니다';
    }
    if (this.submitButtonLabel) {
      this.submitButtonLabel.string = isSignup ? '회원가입' : '이메일 로그인';
    }
    if (this.modeLoginButtonLabel) {
      this.modeLoginButtonLabel.color = isSignup ? new Color(180, 200, 225, 255) : new Color(244, 246, 255, 255);
    }
    if (this.modeSignupButtonLabel) {
      this.modeSignupButtonLabel.color = isSignup ? new Color(244, 246, 255, 255) : new Color(180, 200, 225, 255);
    }
    if (this.nicknameRowNode) {
      this.nicknameRowNode.active = isSignup;
    }
    this.setAuthStatus(
      isSignup ? '닉네임은 회원가입 시에만 사용됩니다' : '계정 로그인 시 스테이지 진행 상태가 저장됩니다',
      new Color(170, 196, 230, 210),
    );
  }

  private createInputRow(
    parent: Node,
    caption: string,
    y: number,
    placeholder: string,
    isPassword = false,
  ): EditBox {
    return this.createInputRowNode(parent, caption, y, placeholder, isPassword).getComponentInChildren(EditBox)!;
  }

  private createInputRowNode(
    parent: Node,
    caption: string,
    y: number,
    placeholder: string,
    isPassword = false,
  ): Node {
    const { LABEL_WIDTH, FIELD_GAP, INPUT_WIDTH } = LoginSceneController;
    const rowW = LABEL_WIDTH + FIELD_GAP + INPUT_WIDTH;
    const row = new Node(`Row_${caption}`);
    row.setPosition(0, y);
    row.addComponent(UITransform).setContentSize(rowW, 42);
    parent.addChild(row);

    const labelX = -rowW / 2 + LABEL_WIDTH / 2;
    const inputX = labelX + LABEL_WIDTH / 2 + FIELD_GAP + INPUT_WIDTH / 2;
    this.createFieldCaption(row, caption, labelX, 0);
    this.createInputBoxNode(row, inputX, 0, INPUT_WIDTH, 42, placeholder, isPassword);
    return row;
  }

  private createFieldCaption(parent: Node, text: string, x: number, y: number): Node {
    const node = new Node(`Caption_${text}`);
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(LoginSceneController.LABEL_WIDTH, 18);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = 13;
    label.lineHeight = 16;
    label.color = new Color(188, 206, 232, 220);
    label.horizontalAlign = Label.HorizontalAlign.RIGHT;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    parent.addChild(node);
    return node;
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
  ): Node {
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
    return node;
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

  private createInputBox(
    parent: Node,
    x: number,
    y: number,
    width: number,
    height: number,
    placeholder: string,
    isPassword = false,
  ): EditBox {
    return this.createInputBoxNode(parent, x, y, width, height, placeholder, isPassword).getComponent(EditBox)!;
  }

  private createInputBoxNode(
    parent: Node,
    x: number,
    y: number,
    width: number,
    height: number,
    placeholder: string,
    isPassword = false,
  ): Node {
    const root = new Node(`Input_${placeholder}`);
    root.setPosition(x, y);
    root.addComponent(UITransform).setContentSize(width, height);

    const bg = root.addComponent(Graphics);
    bg.fillColor = new Color(12, 24, 48, 245);
    bg.roundRect(-width / 2, -height / 2, width, height, 8);
    bg.fill();
    bg.fillColor = new Color(255, 255, 255, 10);
    bg.roundRect(-width / 2 + 2, 1, width - 4, height / 2 - 5, 8);
    bg.fill();
    bg.strokeColor = new Color(126, 176, 245, 170);
    bg.lineWidth = 1.5;
    bg.roundRect(-width / 2, -height / 2, width, height, 8);
    bg.stroke();

    // TextLabel/PlaceholderLabel을 contentNode 없이 root에 직접 배치해
    // 네이티브 input과 동일한 위치에 렌더링되도록 함
    const textNode = new Node('TextLabel');
    textNode.setPosition(0, 0);
    textNode.addComponent(UITransform).setContentSize(width - 24, height);
    const textLabel = textNode.addComponent(Label);
    textLabel.fontSize = 18;
    textLabel.lineHeight = height;
    textLabel.color = new Color(244, 246, 255, 255);
    textLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
    textLabel.verticalAlign = Label.VerticalAlign.CENTER;
    textLabel.overflow = Label.Overflow.CLAMP;
    root.addChild(textNode);

    const placeholderNode = new Node('PlaceholderLabel');
    placeholderNode.setPosition(0, 0);
    placeholderNode.addComponent(UITransform).setContentSize(width - 24, height);
    const placeholderLabel = placeholderNode.addComponent(Label);
    placeholderLabel.string = placeholder;
    placeholderLabel.fontSize = 16;
    placeholderLabel.lineHeight = height;
    placeholderLabel.color = new Color(138, 155, 185, 220);
    placeholderLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
    placeholderLabel.verticalAlign = Label.VerticalAlign.CENTER;
    placeholderLabel.overflow = Label.Overflow.CLAMP;
    root.addChild(placeholderNode);

    const editBox = root.addComponent(EditBox);
    editBox.string = '';
    editBox.placeholder = placeholder;
    editBox.maxLength = 64;
    editBox.fontSize = 18;
    editBox.placeholderFontSize = 16;
    editBox.fontColor = new Color(244, 246, 255, 255);
    editBox.placeholderFontColor = new Color(138, 155, 185, 220);
    editBox.textLabel = textLabel;
    editBox.placeholderLabel = placeholderLabel;
    if (isPassword) {
      editBox.inputFlag = EditBox.InputFlag.PASSWORD;
    }

    parent.addChild(root);
    return root;
  }
}
