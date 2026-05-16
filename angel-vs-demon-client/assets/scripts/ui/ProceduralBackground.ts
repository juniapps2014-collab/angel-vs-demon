import { _decorator, Color, Component, Graphics, Node, UITransform } from 'cc';

const { ccclass } = _decorator;

export type BgTheme = 'city_night' | 'demon_carnival' | 'none';

interface FlickerWindow { x: number; y: number; w: number; h: number; lit: Color; isLit: boolean }
interface Lantern { x: number; baseY: number; col: Color; r: number; phase: number; speed: number }

@ccclass('ProceduralBackground')
export class ProceduralBackground extends Component {
  private theme: BgTheme = 'none';
  private animG: Graphics | null = null;

  // city
  private flickerWins: FlickerWindow[] = [];
  private flickerTimer = 0;
  private flickerInterval = 2.2;

  // carnival
  private lanterns: Lantern[] = [];
  private animTime = 0;

  // ─── public API ─────────────────────────────────────────────

  static getTheme(stageId: number): BgTheme {
    if (stageId >= 1   && stageId <= 100) return 'city_night';
    if (stageId >= 301 && stageId <= 400) return 'demon_carnival';
    return 'none';
  }

  static apply(parent: Node, stageId: number): void {
    if (parent.getChildByName('ProceduralBg')) return;
    const root = new Node('ProceduralBg');
    root.setPosition(0, 0);
    root.addComponent(UITransform).setContentSize(1280, 720);
    parent.addChild(root);
    root.setSiblingIndex(0);
    root.addComponent(ProceduralBackground).init(stageId);
  }

  // ─── lifecycle ──────────────────────────────────────────────

  init(stageId: number): void {
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
    } else {
      this.redrawLanterns();
    }
  }

  // ─── CITY NIGHT ─────────────────────────────────────────────

  private drawCity(g: Graphics): void {
    // sky
    g.fillColor = new Color(7, 10, 24, 255);
    g.rect(-640, -360, 1280, 720); g.fill();

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
    for (const [bx, bh] of farB) {
      g.rect(bx, -312, 70, bh); g.fill();
    }

    // near buildings (darker, taller)
    const nearB: [number, number, number, number][] = [
      [-640, -312, 110, 295],[-510, -312, 95, 340],[-390, -312, 85, 265],
      [320, -312, 100, 310],[440, -312, 90, 285],[550, -312, 90, 260],
    ];
    g.fillColor = new Color(9, 10, 20, 255);
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
    g.rect(-640, -360, 1280, 68); g.fill();

    // pavement grid
    g.strokeColor = new Color(20, 24, 40, 255); g.lineWidth = 1;
    for (let x = -640; x <= 640; x += 80) {
      g.moveTo(x, -360); g.lineTo(x, -292); g.stroke();
    }

    // static windows on far buildings
    const warmY = new Color(255, 210, 100, 255);
    const coolB = new Color(160, 215, 255, 255);
    const dimW  = new Color(26, 30, 48, 255);
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

    // arena border
    g.strokeColor = new Color(30, 60, 130, 160); g.lineWidth = 2;
    g.rect(-570, -312, 1140, 624); g.stroke();
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
    g.rect(-640, -360, 1280, 720); g.fill();

    // stars
    const stars: [number, number][] = [
      [-520,280],[-440,220],[-380,300],[-290,180],[-210,255],
      [-140,310],[-70,200],[10,270],[80,195],[170,305],
      [250,225],[330,280],[410,195],[490,260],[555,310],
      [-505,140],[-415,80],[-295,120],[-175,65],[-55,105],
      [65,135],[205,75],[345,110],[485,85],[558,145],
    ];
    g.strokeColor = new Color(195, 165, 255, 150); g.lineWidth = 1;
    for (const [sx, sy] of stars) {
      const r = 2 + (((sx * 7 + sy * 3) & 0xf) > 10 ? 1 : 0);
      g.moveTo(sx - r, sy); g.lineTo(sx + r, sy); g.stroke();
      g.moveTo(sx, sy - r); g.lineTo(sx, sy + r); g.stroke();
    }

    // checkered ground
    const cs = 48;
    for (let cx = -640; cx < 640; cx += cs) {
      for (let cy = -312; cy < -212; cy += cs) {
        const odd = (Math.floor((cx + 640) / cs) + Math.floor((cy + 312) / cs)) % 2;
        g.fillColor = odd ? new Color(26, 9, 46, 255) : new Color(42, 15, 68, 255);
        g.rect(cx, cy, cs, Math.min(cs, -212 - cy)); g.fill();
      }
    }

    // left tent
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
    for (let cx = -600; cx < 620; cx += cw) {
      const steps = 10;
      g.moveTo(cx, 305);
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        g.lineTo(cx + t * cw, 305 - Math.sin(t * Math.PI) * 38);
      }
      g.stroke();
    }
    // tassel dots
    g.fillColor = new Color(235, 195, 55, 220);
    for (let cx = -600; cx <= 600; cx += cw) {
      g.circle(cx, 305, 4); g.fill();
    }

    // arena border – double gold frame
    g.strokeColor = new Color(175, 115, 38, 175); g.lineWidth = 2;
    g.rect(-570, -312, 1140, 624); g.stroke();
    g.strokeColor = new Color(215, 175, 75, 70); g.lineWidth = 1;
    g.rect(-564, -306, 1128, 612); g.stroke();

    // corner ornaments
    for (const [cx2, cy2] of [[-570,312],[570,312],[-570,-312],[570,-312]] as [number,number][]) {
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

  // ─── util ───────────────────────────────────────────────────

  private makeLayer(name: string): Node {
    const n = new Node(name);
    n.setPosition(0, 0);
    n.addComponent(UITransform).setContentSize(1280, 720);
    n.addComponent(Graphics);
    this.node.addChild(n);
    return n;
  }
}
