import { _decorator, Component, Vec3 } from 'cc';

const { ccclass } = _decorator;

@ccclass('HoverMotion')
export class HoverMotion extends Component {
  amplitude = 5;
  frequency = 2.2;
  scaleAmplitude = 0.04;

  private basePosition = new Vec3();
  private elapsed = 0;
  private baseScale = new Vec3(1, 1, 1);

  start(): void {
    this.basePosition.set(this.node.position);
    this.baseScale.set(this.node.scale);
    this.elapsed = Math.random() * Math.PI * 2;
  }

  update(deltaTime: number): void {
    this.elapsed += deltaTime * this.frequency;
    const yOffset = Math.sin(this.elapsed) * this.amplitude;
    const scaleOffset = Math.sin(this.elapsed * 0.9) * this.scaleAmplitude;
    this.node.setPosition(this.basePosition.x, this.basePosition.y + yOffset, this.basePosition.z);
    this.node.setScale(
      this.baseScale.x + scaleOffset,
      this.baseScale.y - scaleOffset * 0.35,
      this.baseScale.z,
    );
  }
}
