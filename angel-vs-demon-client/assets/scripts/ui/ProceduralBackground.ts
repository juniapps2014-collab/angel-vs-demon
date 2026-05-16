import { _decorator, Color, Component, Graphics, Node, UITransform } from 'cc';

const { ccclass } = _decorator;

export type BgTheme = 'city_night' | 'demon_carnival' | 'login_epic' | 'none';

interface FlickerWindow { x: number; y: number; w: number; h: number; lit: Color; isLit: boolean }
interface Lantern { x: number; baseY: number; col: Color; r: number; phase: number; speed: number }
interface Mote { x: number; y: number; vy: number; r: number; alpha: number; col: Color; phase: number }
export interface ProceduralBackgroundSize { width?: number; height?: number }

@ccclass('ProceduralBackground')
export class ProceduralBackground extends Component {
  private static readonly DEFAULT_WIDTH = 1280;
  private static readonly DEFAULT_HEIGHT = 720;

  private theme: BgTheme = 'none';
  private animG: Graphics | null = null;
  private width = ProceduralBackground.DEFAULT_WIDTH;
  private height = ProceduralBackground.DEFAULT_HEIGHT;
  private halfW = ProceduralBackground.DEFAULT_WIDTH / 2;
  private halfH = ProceduralBackground.DEFAULT_HEIGHT / 2;

  // city
  private flickerWins: FlickerWindow[] = [];
  private flickerTimer = 0;
  private flickerInterval = 2.2;

  // carnival
  private lanterns: Lantern[] = [];

  // login
  private motes: Mote[] = [];
  private animTime = 0;

  // ─── public API ─────────────────────────────────────────────

  static getTheme(stageId: number): BgTheme {
    if (stageId >= 1   && stageId <= 100) return 'city_night';
    if (stageId >= 301 && stageId <= 400) return 'demon_carnival';
    return 'none';
  }

  static applyLogin(parent: Node): void {
    if (parent.getChildByName('ProceduralBg')) return;
    const root = new Node('ProceduralBg');
    root.setPosition(0, 0);
    root.addComponent(UITransform).setContentSize(ProceduralBackground.DEFAULT_WIDTH, ProceduralBackground.DEFAULT_HEIGHT);
    parent.addChild(root);
    root.setSiblingIndex(0);
    root.addComponent(ProceduralBackground).initTheme('login_epic');
  }

  static apply(parent: Node, stageId: number, size: ProceduralBackgroundSize = {}): void {
    if (parent.getChildByName('ProceduralBg')) return;
    const root = new Node('ProceduralBg');
    root.setPosition(0, 0);
    root.addComponent(UITransform).setContentSize(
      size.width ?? ProceduralBackground.DEFAULT_WIDTH,
      size.height ?? ProceduralBackground.DEFAULT_HEIGHT,
    );
    parent.addChild(root);
    root.setSiblingIndex(0);
    root.addComponent(ProceduralBackground).init(stageId, size);
  }

  // ─── lifecycle ──────────────────────────────────────────────

  initTheme(theme: BgTheme, size: ProceduralBackgroundSize = {}): void {
    this.configureSize(size);
    this.theme = theme;
    const staticNode = this.makeLayer('BgStatic');
    const animNode   = this.makeLayer('BgAnim');
    this.animG = animNode.getComponent(Graphics);

    if (theme === 'login_epic') {
      this.drawLoginEpic(staticNode.getComponent(Graphics)!);
      this.initLoginAnim();
    }
  }

  init(stageId: number, size: ProceduralBackgroundSize = {}): void {
    this.configureSize(size);
    this.theme = ProceduralBackground.getTheme(stageId);
    if (this.theme === 'none') return;

    const staticNode = this.makeLayer('BgStatic');
    const animNode   = this.makeLayer('BgAnim');
    this.animG = animNode.getComponent(Graphics);

    if (this.theme === 'city_night') {
      this.drawCity(staticNode.getComponent(Graphics)!);
      this.initCityAnim();
    } else {
      this.drawCarnival(staticNode.getComponent(Graphics)!);
      this.initCarnivalAnim();
    }
  }

  update(dt: number): void {
    if (this.theme === 'none' || !this.animG) return;
    this.animTime += dt;

    if (this.theme === 'city_night') {
      this.flickerTimer += dt;
      if (this.flickerTimer >= this.flickerInterval) {
        this.flickerTimer = 0;
        this.flickerInterval = 1.4 + Math.random() * 2.0;
        const i = Math.floor(Math.random() * this.flickerWins.length);
        this.flickerWins[i].isLit = !this.flickerWins[i].isLit;
        if (Math.random() < 0.35) {
          const j = Math.floor(Math.random() * this.flickerWins.length);
          this.flickerWins[j].isLit = !this.flickerWins[j].isLit;
        }
        this.redrawFlicker();
      }
    } else if (this.theme === 'demon_carnival') {
      this.redrawLanterns();
    } else if (this.theme === 'login_epic') {
      this.updateMotes(dt);
      this.redrawLoginAnim();
    }
  }

  // ─── CITY NIGHT ─────────────────────────────────────────────

  private drawCity(g: Graphics): void {
    // sky
    g.fillColor = new Color(7, 10, 24, 255);
    g.rect(-this.halfW, -this.halfH, this.width, this.height); g.fill();

    for (let y = -this.halfH; y < this.halfH; y += 120) {
      const alpha = 10 + Math.floor(((y + this.halfH) / Math.max(1, this.height)) * 18);
      g.fillColor = new Color(12, 18, 42, alpha);
      g.rect(-this.halfW, y, this.width, 56);
      g.fill();
    }

    // sky glints across the whole scrollable background
    g.strokeColor = new Color(92, 125, 205, 85);
    g.lineWidth = 1;
    for (let sx = -this.halfW + 44, index = 0; sx <= this.halfW - 44; sx += 96, index += 1) {
      const sy = -40 + ((index * 67) % Math.max(1, this.halfH + 40));
      const r = index % 4 === 0 ? 3 : 2;
      g.moveTo(sx - r, sy); g.lineTo(sx + r, sy); g.stroke();
      g.moveTo(sx, sy - r); g.lineTo(sx, sy + r); g.stroke();
    }

    // moon glow layers
    for (const [r, a] of [[60, 18], [42, 50], [28, 120], [16, 200]] as [number, number][]) {
      g.fillColor = new Color(160, 190, 255, a);
      g.circle(210, 210, r); g.fill();
    }

    // distant buildings
    const farB: [number, number, number][] = [
      [-600, 170],[-520, 210],[-440, 160],[-360, 230],[-270, 185],
      [-180, 215],[-90, 170],[0, 200],[90, 185],[180, 220],
      [270, 175],[360, 205],[450, 190],[540, 215],
    ];
    g.fillColor = new Color(14, 16, 34, 255);
    for (let bx = -this.halfW; bx < this.halfW; bx += 82) {
      const index = Math.floor((bx + this.halfW) / 82);
      const bh = 145 + ((index * 37) % 90);
      g.rect(bx, -312, 70, bh); g.fill();
    }
    for (const [bx, bh] of farB) {
      g.rect(bx, -312, 70, bh); g.fill();
    }

    // near buildings (darker, taller)
    const nearB: [number, number, number, number][] = [
      [-640, -312, 110, 295],[-510, -312, 95, 340],[-390, -312, 85, 265],
      [320, -312, 100, 310],[440, -312, 90, 285],[550, -312, 90, 260],
    ];
    g.fillColor = new Color(9, 10, 20, 255);
    for (let bx = -this.halfW; bx < this.halfW; bx += 260) {
      if (Math.abs(bx) < 300) continue;
      const bh = 250 + ((Math.floor((bx + this.halfW) / 260) * 41) % 90);
      g.rect(bx, -312, 92, bh); g.fill();
    }
    for (const [bx, by, bw, bh] of nearB) {
      g.rect(bx, by, bw, bh); g.fill();
    }

    // neon accent lines on two buildings
    const neons: [number, number, number, Color][] = [
      [-590, 18, 50, new Color(40, 120, 255, 200)],
      [-590, 24, 50, new Color(40, 120, 255, 120)],
      [-468, -32, 42, new Color(255, 50, 170, 200)],
      [-468, -38, 42, new Color(255, 50, 170, 110)],
    ];
    for (const [x, y, len, col] of neons) {
      g.strokeColor = col; g.lineWidth = 2;
      g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
    }

    // ground
    g.fillColor = new Color(12, 14, 22, 255);
    g.rect(-this.halfW, -this.halfH, this.width, Math.max(68, this.halfH - 292)); g.fill();

    // pavement grid
    g.strokeColor = new Color(20, 24, 40, 255); g.lineWidth = 1;
    for (let x = -this.halfW; x <= this.halfW; x += 80) {
      g.moveTo(x, -this.halfH); g.lineTo(x, -292); g.stroke();
    }

    // static windows on far buildings
    const warmY = new Color(255, 210, 100, 255);
    const coolB = new Color(160, 215, 255, 255);
    const dimW  = new Color(26, 30, 48, 255);
    for (let bx = -this.halfW; bx < this.halfW; bx += 82) {
      const buildingIndex = Math.floor((bx + this.halfW) / 82);
      const bh = 145 + ((buildingIndex * 37) % 90);
      const rows = Math.floor(bh / 22);
      const cols = Math.floor(70 / 18);
      for (let row = 0; row < rows - 1; row++) {
        for (let col = 0; col < cols; col++) {
          const wx = bx + 3 + col * 18;
          const wy = -312 + bh - 14 - row * 22;
          const rnd = ((buildingIndex * 23 + row * 17 + col * 11) & 0xff) % 100;
          if (rnd < 42) {
            g.fillColor = rnd < 26 ? warmY : coolB;
            g.rect(wx, wy, 7, 5);
            g.fill();
          } else if (rnd < 68) {
            g.fillColor = dimW;
            g.rect(wx, wy, 7, 5);
            g.fill();
          }
        }
      }
    }
    for (let bx = -this.halfW + 28; bx < this.halfW; bx += 260) {
      const index = Math.floor((bx + this.halfW) / 260);
      const y = -54 + (index % 5) * 16;
      const col = index % 2 === 0
        ? new Color(40, 120, 255, 125)
        : new Color(255, 50, 170, 120);
      g.strokeColor = col;
      g.lineWidth = 2;
      g.moveTo(bx, y);
      g.lineTo(bx + 54, y);
      g.stroke();
    }
    for (const [bx, bh] of farB) {
      const rows = Math.floor(bh / 22);
      const cols = Math.floor(70 / 18);
      for (let row = 0; row < rows - 1; row++) {
        for (let col = 0; col < cols; col++) {
          const wx = bx + 3 + col * 18;
          const wy = -312 + bh - 14 - row * 22;
          const rnd = ((wx * 7 + wy * 13 + row * 17) & 0xff) % 100;
          if (rnd < 55) { g.fillColor = rnd < 38 ? warmY : coolB; g.rect(wx, wy, 7, 5); g.fill(); }
          else if (rnd < 75) { g.fillColor = dimW; g.rect(wx, wy, 7, 5); g.fill(); }
        }
      }
    }

    // world border
    g.strokeColor = new Color(30, 60, 130, 160); g.lineWidth = 2;
    g.rect(-this.halfW + 16, -this.halfH + 16, this.width - 32, this.height - 32); g.stroke();
  }

  private initCityAnim(): void {
    const W = new Color(255, 210, 100, 255);
    const B = new Color(160, 215, 255, 255);
    this.flickerWins = [
      { x: -340, y: 22, w: 7, h: 5, lit: W, isLit: true  },
      { x: -340, y: 0,  w: 7, h: 5, lit: W, isLit: false },
      { x: 100,  y: 50, w: 7, h: 5, lit: B, isLit: true  },
      { x: 100,  y: 28, w: 7, h: 5, lit: B, isLit: false },
      { x: 475,  y: -18,w: 7, h: 5, lit: W, isLit: true  },
      { x: -160, y: 32, w: 7, h: 5, lit: B, isLit: false },
      { x: -510, y: 44, w: 7, h: 5, lit: W, isLit: true  },
      { x: 380,  y: 10, w: 7, h: 5, lit: B, isLit: false },
    ];
    this.redrawFlicker();
  }

  private redrawFlicker(): void {
    if (!this.animG) return;
    const g = this.animG;
    g.clear();
    const off = new Color(26, 30, 48, 255);
    for (const w of this.flickerWins) {
      g.fillColor = w.isLit ? w.lit : off;
      g.rect(w.x, w.y, w.w, w.h); g.fill();
    }
  }

  // ─── DEMON CARNIVAL ─────────────────────────────────────────

  private drawCarnival(g: Graphics): void {
    // sky
    g.fillColor = new Color(16, 3, 32, 255);
    g.rect(-this.halfW, -this.halfH, this.width, this.height); g.fill();

    // stars
    const stars: [number, number][] = [
      [-520,280],[-440,220],[-380,300],[-290,180],[-210,255],
      [-140,310],[-70,200],[10,270],[80,195],[170,305],
      [250,225],[330,280],[410,195],[490,260],[555,310],
      [-505,140],[-415,80],[-295,120],[-175,65],[-55,105],
      [65,135],[205,75],[345,110],[485,85],[558,145],
    ];
    g.strokeColor = new Color(195, 165, 255, 150); g.lineWidth = 1;
    for (let sx = -this.halfW + 48; sx <= this.halfW - 48; sx += 92) {
      const row = Math.floor((sx + this.halfW) / 92);
      const sy = 70 + ((row * 53) % Math.max(1, this.halfH - 120));
      const r = 2 + (row % 3 === 0 ? 1 : 0);
      g.moveTo(sx - r, sy); g.lineTo(sx + r, sy); g.stroke();
      g.moveTo(sx, sy - r); g.lineTo(sx, sy + r); g.stroke();
    }
    for (const [sx, sy] of stars) {
      const r = 2 + (((sx * 7 + sy * 3) & 0xf) > 10 ? 1 : 0);
      g.moveTo(sx - r, sy); g.lineTo(sx + r, sy); g.stroke();
      g.moveTo(sx, sy - r); g.lineTo(sx, sy + r); g.stroke();
    }

    // checkered ground
    const cs = 48;
    for (let cx = -this.halfW; cx < this.halfW; cx += cs) {
      for (let cy = -this.halfH; cy < -212; cy += cs) {
        const odd = (Math.floor((cx + this.halfW) / cs) + Math.floor((cy + this.halfH) / cs)) % 2;
        g.fillColor = odd ? new Color(26, 9, 46, 255) : new Color(42, 15, 68, 255);
        g.rect(cx, cy, cs, Math.min(cs, -212 - cy)); g.fill();
      }
    }

    // left tent
    for (let tx = -this.halfW + 72, index = 0; tx < this.halfW - 60; tx += 260, index += 1) {
      if (tx > -680 && tx < 640) continue;
      this.drawTent(
        g,
        tx,
        -250 + (index % 2) * 10,
        130 + (index % 3) * 18,
        86 + (index % 2) * 16,
        new Color(90 + (index % 3) * 25, 8, 28, 210),
        new Color(180, 145 + (index % 2) * 20, 36, 205),
      );
    }

    this.drawTent(g, -530, -240, 170, 110,
      new Color(155, 12, 28, 255), new Color(215, 175, 38, 255));
    // right tent
    this.drawTent(g, 370, -240, 150, 100,
      new Color(110, 8, 26, 255), new Color(195, 18, 45, 255));
    // far right tent (smaller)
    this.drawTent(g, 530, -255, 110, 90,
      new Color(95, 6, 20, 255), new Color(175, 145, 28, 255));

    // curtain drape along top
    g.strokeColor = new Color(195, 28, 56, 170); g.lineWidth = 3;
    const cw = 100;
    const curtainRows = [305, this.halfH - 96];
    for (const curtainY of curtainRows) {
      for (let cx = -this.halfW + 40; cx < this.halfW - 20; cx += cw) {
        const steps = 10;
        g.moveTo(cx, curtainY);
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          g.lineTo(cx + t * cw, curtainY - Math.sin(t * Math.PI) * 38);
        }
        g.stroke();
      }
      // tassel dots
      g.fillColor = new Color(235, 195, 55, 220);
      for (let cx = -this.halfW + 40; cx <= this.halfW - 40; cx += cw) {
        g.circle(cx, curtainY, 4); g.fill();
      }
    }

    // world border - double gold frame
    const borderX = -this.halfW + 16;
    const borderY = -this.halfH + 16;
    const borderW = this.width - 32;
    const borderH = this.height - 32;
    g.strokeColor = new Color(175, 115, 38, 175); g.lineWidth = 2;
    g.rect(borderX, borderY, borderW, borderH); g.stroke();
    g.strokeColor = new Color(215, 175, 75, 70); g.lineWidth = 1;
    g.rect(borderX + 6, borderY + 6, borderW - 12, borderH - 12); g.stroke();

    // corner ornaments
    for (const [cx2, cy2] of [
      [borderX, borderY + borderH],
      [borderX + borderW, borderY + borderH],
      [borderX, borderY],
      [borderX + borderW, borderY],
    ] as [number,number][]) {
      g.strokeColor = new Color(215, 175, 75, 200); g.lineWidth = 2;
      g.circle(cx2, cy2, 12); g.stroke();
      g.fillColor = new Color(175, 115, 38, 180); g.circle(cx2, cy2, 6); g.fill();
    }
  }

  private drawTent(
    g: Graphics,
    x: number, baseY: number, w: number, h: number,
    c1: Color, c2: Color,
  ): void {
    // body
    g.fillColor = c1; g.rect(x, baseY, w, h); g.fill();
    // stripes
    g.fillColor = c2;
    for (let sx = x; sx < x + w; sx += 20) {
      g.rect(sx, baseY, 10, h); g.fill();
    }
    // peaked top (3 triangles)
    const peaks = 3;
    const pw = w / peaks;
    for (let i = 0; i < peaks; i++) {
      const px = x + i * pw;
      const ph = 38 + (i % 2) * 10;
      g.fillColor = i % 2 === 0 ? c2 : c1;
      g.moveTo(px, baseY + h);
      g.lineTo(px + pw / 2, baseY + h + ph);
      g.lineTo(px + pw, baseY + h);
      g.close(); g.fill();
    }
    // flag pole + pennant at center peak
    const flagX = x + w / 2;
    const flagBase = baseY + h + 48;
    g.strokeColor = new Color(195, 175, 80, 210); g.lineWidth = 1;
    g.moveTo(flagX, flagBase); g.lineTo(flagX, flagBase + 28); g.stroke();
    g.fillColor = new Color(245, 235, 78, 240);
    g.moveTo(flagX, flagBase + 28);
    g.lineTo(flagX, flagBase + 14);
    g.lineTo(flagX + 14, flagBase + 21);
    g.close(); g.fill();
  }

  private initCarnivalAnim(): void {
    const cols = [
      new Color(255, 158, 38, 220),
      new Color(218, 58, 58, 220),
      new Color(255, 228, 78, 220),
      new Color(198, 78, 255, 220),
      new Color(78, 198, 255, 220),
      new Color(255, 118, 178, 220),
    ];
    this.lanterns = [
      { x: -370, baseY: 180, col: cols[0], r: 10, phase: 0.0, speed: 1.2 },
      { x: -230, baseY: 215, col: cols[1], r:  8, phase: 1.5, speed: 0.9 },
      { x:  -75, baseY: 200, col: cols[2], r: 11, phase: 0.8, speed: 1.5 },
      { x:   85, baseY: 218, col: cols[3], r:  9, phase: 2.1, speed: 1.1 },
      { x:  245, baseY: 192, col: cols[4], r: 10, phase: 3.0, speed: 0.8 },
      { x:  385, baseY: 205, col: cols[5], r:  8, phase: 1.2, speed: 1.4 },
    ];
    this.redrawLanterns();
  }

  private redrawLanterns(): void {
    if (!this.animG) return;
    const g = this.animG;
    g.clear();
    for (const ln of this.lanterns) {
      const cy = ln.baseY + Math.sin(this.animTime * ln.speed + ln.phase) * 6;
      const { r, col } = ln;
      // glow rings
      g.fillColor = new Color(col.r, col.g, col.b, 28); g.circle(ln.x, cy, r * 2.6); g.fill();
      g.fillColor = new Color(col.r, col.g, col.b, 75); g.circle(ln.x, cy, r * 1.7); g.fill();
      // core
      g.fillColor = col; g.circle(ln.x, cy, r); g.fill();
      // bright spot
      g.fillColor = new Color(
        Math.min(255, col.r + 85), Math.min(255, col.g + 85),
        Math.min(255, col.b + 85), 195,
      );
      g.circle(ln.x - r * 0.28, cy + r * 0.28, r * 0.38); g.fill();
      // string
      g.strokeColor = new Color(200, 178, 115, 90); g.lineWidth = 1;
      g.moveTo(ln.x, cy + r); g.lineTo(ln.x, cy + r + 18); g.stroke();
    }
  }

  // ─── LOGIN EPIC ─────────────────────────────────────────────

  private drawLoginEpic(g: Graphics): void {
    // deep space sky – multiple gradient bands
    const skyBands: [number, number, number, number, number][] = [
      [4, 2, 18, 255, 360],
      [7, 4, 28, 255, 260],
      [10, 6, 38, 255, 160],
      [16, 8, 52, 255, 60],
    ];
    let bandY = 360;
    for (const [r, gg, b, a, h] of skyBands) {
      g.fillColor = new Color(r, gg, b, a);
      g.rect(-640, bandY - h, 1280, h); g.fill();
      bandY -= h;
    }

    // divine light cone from top-center (angelic)
    for (const [spread, alpha] of [[320, 8], [220, 14], [140, 20], [80, 28]] as [number, number][]) {
      g.fillColor = new Color(220, 210, 160, alpha);
      g.moveTo(0, 360);
      g.lineTo(-spread, -50);
      g.lineTo(spread, -50);
      g.close(); g.fill();
    }

    // moon – large, top-right
    const mx = 340, my = 240;
    for (const [r, a] of [[90, 8], [68, 16], [48, 32], [32, 65], [20, 150]] as [number, number][]) {
      g.fillColor = new Color(195, 210, 255, a);
      g.circle(mx, my, r); g.fill();
    }
    g.fillColor = new Color(230, 238, 255, 240);
    g.circle(mx, my, 20); g.fill();
    // moon crescent shadow
    g.fillColor = new Color(8, 6, 22, 180);
    g.circle(mx + 8, my - 6, 15); g.fill();

    // stars – cross shaped, varied sizes
    const stars: [number, number, number][] = [
      [-560, 290, 3],[-490, 240, 2],[-420, 310, 4],[-340, 195, 2],[-270, 270, 3],
      [-195, 235, 2],[-120, 295, 3],[-50, 215, 2],[20, 280, 3],[130, 195, 2],
      [200, 260, 4],[440, 310, 2],[490, 260, 3],[555, 295, 2],
      [-540, 150, 2],[-430, 95, 3],[-310, 130, 2],[-185, 80, 4],[-70, 115, 2],
      [55, 140, 3],[175, 90, 2],[295, 120, 4],[415, 100, 2],[540, 155, 3],
      [-600, 60, 2],[-480, 30, 3],[80, 45, 2],[310, 60, 3],[560, 40, 2],[-240, 180, 2],
    ];
    for (const [sx, sy, r] of stars) {
      const bright = r >= 4 ? 255 : r >= 3 ? 220 : 180;
      const alpha  = r >= 4 ? 230 : 180;
      g.strokeColor = new Color(bright, bright, bright + 20, alpha); g.lineWidth = 1;
      g.moveTo(sx - r, sy); g.lineTo(sx + r, sy); g.stroke();
      g.moveTo(sx, sy - r); g.lineTo(sx, sy + r); g.stroke();
      if (r >= 3) {
        const d = r * 0.55;
        g.strokeColor = new Color(bright, bright, bright + 20, alpha * 0.5); g.lineWidth = 1;
        g.moveTo(sx - d, sy - d); g.lineTo(sx + d, sy + d); g.stroke();
        g.moveTo(sx + d, sy - d); g.lineTo(sx - d, sy + d); g.stroke();
      }
    }

    // demonic ground glow – crimson rising from below
    for (const [r, gg2, b, a, h] of [
      [80, 4, 8, 40, 80], [120, 8, 12, 28, 140], [160, 12, 16, 16, 200],
    ] as [number, number, number, number, number][]) {
      g.fillColor = new Color(r, gg2, b, a);
      g.rect(-640, -360, 1280, h); g.fill();
    }

    // far city silhouette
    const farB: [number, number, number][] = [
      [-630,150],[-560,195],[-480,160],[-400,210],[-315,175],[-235,205],
      [-150,165],[-65,195],[20,175],[110,200],[200,165],[295,195],[385,170],
      [470,205],[550,180],[620,155],
    ];
    g.fillColor = new Color(6, 6, 16, 255);
    for (const [bx, bh] of farB) { g.rect(bx, -312, 68, bh); g.fill(); }

    // two tall dark towers flanking
    g.fillColor = new Color(4, 4, 10, 255);
    g.rect(-640, -360, 100, 330); g.fill();
    g.rect(540, -360, 100, 310); g.fill();
    // tower spires
    g.fillColor = new Color(4, 4, 10, 255);
    g.moveTo(-640, -30); g.lineTo(-590, 20); g.lineTo(-540, -30); g.close(); g.fill();
    g.moveTo(540, -50); g.lineTo(590, 10); g.lineTo(640, -50); g.close(); g.fill();

    // glowing windows on towers
    g.fillColor = new Color(255, 80, 40, 180);
    for (let wy = -310; wy < -60; wy += 28) {
      g.rect(-622, wy, 6, 4); g.fill();
      g.rect(-598, wy + 14, 6, 4); g.fill();
    }
    g.fillColor = new Color(200, 220, 255, 160);
    for (let wy = -300; wy < -70; wy += 28) {
      g.rect(558, wy, 6, 4); g.fill();
      g.rect(582, wy + 14, 6, 4); g.fill();
    }

    // ground
    g.fillColor = new Color(5, 5, 14, 255);
    g.rect(-640, -360, 1280, 58); g.fill();

    // ground crack glow lines
    g.strokeColor = new Color(180, 20, 20, 60); g.lineWidth = 1;
    for (const [x1, x2, y] of [[-400,-280,-340],[-100,60,-330],[200,350,-345],[-560,-470,-350],[400,520,-338]] as [number,number,number][]) {
      g.moveTo(x1, y); g.lineTo(x2, y); g.stroke();
    }

    // center title glow bloom
    for (const [r, a] of [[200, 6], [140, 12], [90, 20], [55, 35]] as [number, number][]) {
      g.fillColor = new Color(200, 185, 100, a);
      g.circle(0, 220, r); g.fill();
    }
  }

  private initLoginAnim(): void {
    const angelCols = [
      new Color(220, 235, 255, 200),
      new Color(255, 240, 180, 200),
      new Color(180, 210, 255, 200),
    ];
    const demonCols = [
      new Color(255, 80, 60, 180),
      new Color(255, 120, 40, 160),
      new Color(220, 50, 80, 170),
    ];
    this.motes = [];
    for (let i = 0; i < 18; i++) {
      const isAngel = i < 11;
      const cols = isAngel ? angelCols : demonCols;
      this.motes.push({
        x: -580 + Math.random() * 1160,
        y: -360 + Math.random() * 720,
        vy: isAngel ? (0.18 + Math.random() * 0.28) : -(0.15 + Math.random() * 0.22),
        r: 1.5 + Math.random() * 2.5,
        alpha: 80 + Math.random() * 120,
        col: cols[Math.floor(Math.random() * cols.length)],
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private updateMotes(dt: number): void {
    for (const m of this.motes) {
      m.y += m.vy;
      m.x += Math.sin(this.animTime * 0.6 + m.phase) * 0.4;
      if (m.vy > 0 && m.y > 380) m.y = -380;
      if (m.vy < 0 && m.y < -380) m.y = 380;
    }
  }

  private redrawLoginAnim(): void {
    if (!this.animG) return;
    const g = this.animG;
    g.clear();

    // pulsing center bloom
    const pulse = 0.5 + Math.sin(this.animTime * 1.2) * 0.5;
    g.fillColor = new Color(200, 185, 100, Math.floor(8 + pulse * 14));
    g.circle(0, 220, 160 + pulse * 20); g.fill();

    // floating motes
    for (const m of this.motes) {
      const flicker = 0.6 + Math.sin(this.animTime * 2.2 + m.phase) * 0.4;
      const a = Math.floor(m.alpha * flicker);
      // glow ring
      g.fillColor = new Color(m.col.r, m.col.g, m.col.b, Math.floor(a * 0.25));
      g.circle(m.x, m.y, m.r * 2.4); g.fill();
      // core
      g.fillColor = new Color(m.col.r, m.col.g, m.col.b, a);
      g.circle(m.x, m.y, m.r); g.fill();
    }

    // ground fire wisps (3 columns)
    const fireX = [-280, 0, 280];
    for (const fx of fireX) {
      for (let h = 0; h < 4; h++) {
        const wy = -360 + h * 14 + Math.sin(this.animTime * 3.5 + fx * 0.02 + h) * 5;
        const alpha = Math.floor((3 - h) * 18 * (0.6 + Math.sin(this.animTime * 2 + h) * 0.4));
        g.fillColor = new Color(220, 40 + h * 12, 10, alpha);
        g.circle(fx + Math.sin(this.animTime * 2 + h) * 8, wy, 10 - h * 2); g.fill();
      }
    }
  }

  // ─── util ───────────────────────────────────────────────────

  private makeLayer(name: string): Node {
    const n = new Node(name);
    n.setPosition(0, 0);
    n.addComponent(UITransform).setContentSize(this.width, this.height);
    n.addComponent(Graphics);
    this.node.addChild(n);
    return n;
  }

  private configureSize(size: ProceduralBackgroundSize): void {
    this.width = size.width ?? ProceduralBackground.DEFAULT_WIDTH;
    this.height = size.height ?? ProceduralBackground.DEFAULT_HEIGHT;
    this.halfW = this.width / 2;
    this.halfH = this.height / 2;
  }
}
