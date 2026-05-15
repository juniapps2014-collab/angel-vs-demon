import { _decorator, Color, Component, Graphics } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('DebugShape')
export class DebugShape extends Component {
  @property(Color)
  fillColor = new Color(255, 255, 255, 255);

  @property
  width = 48;

  @property
  height = 48;

  @property
  isCircle = false;

  @property
  suppressRendering = false;

  private hitTimer = 0;
  private originalColor = new Color();

  start(): void {
    this.originalColor.set(this.fillColor);
    let graphics = this.getComponent(Graphics);
    if (!graphics) {
      graphics = this.addComponent(Graphics);
    }

    this.drawShape(graphics);
  }

  private drawShape(graphics: Graphics): void {
    graphics.clear();
    if (this.suppressRendering) {
      return;
    }
    graphics.fillColor = this.fillColor;

    if (this.isCircle) {
      graphics.circle(0, 0, this.width * 0.5);
    } else {
      graphics.roundRect(-this.width * 0.5, -this.height * 0.5, this.width, this.height, 8);
    }

    graphics.fill();
    graphics.strokeColor = new Color(255, 255, 255, Math.min(16, this.fillColor.a));
    graphics.lineWidth = 1;
    if (this.isCircle) {
      graphics.circle(0, 0, this.width * 0.5);
    } else {
      graphics.roundRect(-this.width * 0.5, -this.height * 0.5, this.width, this.height, 8);
    }
    graphics.stroke();
  }

  showHitEffect(): void {
    if (this.suppressRendering) {
      return;
    }
    this.hitTimer = 0.18;
    const graphics = this.getComponent(Graphics);
    if (graphics) {
      graphics.clear();
      graphics.fillColor = new Color(255, 255, 255, 210);
      if (this.isCircle) {
        graphics.circle(0, 0, this.width * 0.58);
      } else {
        graphics.roundRect(-this.width * 0.56, -this.height * 0.56, this.width * 1.12, this.height * 1.12, 10);
      }
      graphics.fill();
      graphics.strokeColor = new Color(255, 250, 170, 220);
      graphics.lineWidth = 2;
      if (this.isCircle) {
        graphics.circle(0, 0, this.width * 0.6);
      } else {
        graphics.roundRect(-this.width * 0.58, -this.height * 0.58, this.width * 1.16, this.height * 1.16, 10);
      }
      graphics.stroke();
    }
  }

  update(deltaTime: number): void {
    if (this.hitTimer > 0) {
      this.hitTimer -= deltaTime;
      if (this.hitTimer <= 0) {
        const graphics = this.getComponent(Graphics);
        if (graphics) {
          graphics.fillColor = this.originalColor.clone();
          this.drawShape(graphics);
        }
      }
    }
  }

  setVisible(visible: boolean): void {
    this.node.active = visible;
  }
}
