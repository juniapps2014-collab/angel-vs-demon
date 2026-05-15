import { _decorator, Component, ImageAsset, Rect, Sprite, SpriteFrame, Texture2D, resources } from 'cc';

const { ccclass } = _decorator;

type FrameRect = { x: number; y: number; width: number; height: number };

@ccclass('SpriteSheetAnimator')
export class SpriteSheetAnimator extends Component {
  private sprite: Sprite | null = null;
  private frames: SpriteFrame[] = [];
  private fps = 8;
  private elapsed = 0;
  private frameIndex = 0;
  private playing = false;
  private resourcePath = '';

  onLoad(): void {
    this.sprite = this.getComponent(Sprite);
  }

  setup(resourcePath: string, frameRects: FrameRect[], fps = 8): void {
    this.resourcePath = resourcePath;
    this.fps = fps;
    this.elapsed = 0;
    this.frameIndex = 0;
    this.frames = [];
    this.playing = false;

    resources.load(resourcePath, ImageAsset, (error, imageAsset) => {
      if (error || !imageAsset || !this.node.isValid) {
        console.warn(`[SpriteSheetAnimator] Failed to load image: ${resourcePath}`, error);
        return;
      }

      const texture = new Texture2D();
      texture.image = imageAsset;
      this.frames = frameRects.map((rect) => {
        const frame = new SpriteFrame();
        frame.reset({
          texture,
          rect: new Rect(rect.x, rect.y, rect.width, rect.height),
          originalSize: { width: rect.width, height: rect.height },
        });
        return frame;
      });

      this.frameIndex = 0;
      this.playing = this.frames.length > 1;
      this.applyFrame();
    });
  }

  update(deltaTime: number): void {
    if (!this.playing || this.frames.length <= 1) return;
    this.elapsed += deltaTime;
    const frameDuration = 1 / Math.max(1, this.fps);
    if (this.elapsed < frameDuration) return;
    this.elapsed = 0;
    this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    this.applyFrame();
  }

  private applyFrame(): void {
    this.sprite ??= this.getComponent(Sprite);
    if (!this.sprite || this.frames.length === 0) return;
    this.sprite.spriteFrame = this.frames[this.frameIndex];
  }
}
