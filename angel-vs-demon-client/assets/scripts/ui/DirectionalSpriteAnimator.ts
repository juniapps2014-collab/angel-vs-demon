import { _decorator, Component, Rect, Size, Sprite, SpriteFrame, Texture2D, resources } from 'cc';

const { ccclass } = _decorator;

type FrameRect = { x: number; y: number; width: number; height: number };
type ClipMap = Record<string, FrameRect[]>;

@ccclass('DirectionalSpriteAnimator')
export class DirectionalSpriteAnimator extends Component {
  private sprite: Sprite | null = null;
  private texture: Texture2D | null = null;
  private clips = new Map<string, SpriteFrame[]>();
  private currentClip = '';
  private currentFrames: SpriteFrame[] = [];
  private fps = 8;
  private elapsed = 0;
  private frameIndex = 0;
  private loaded = false;

  onLoad(): void {
    this.sprite = this.getComponent(Sprite);
  }

  setup(resourcePath: string, clipMap: ClipMap, fps = 8): void {
    this.fps = fps;
    this.currentClip = '';
    this.currentFrames = [];
    this.frameIndex = 0;
    this.elapsed = 0;
    this.loaded = false;
    this.clips.clear();

    resources.load(`${resourcePath}/texture`, Texture2D, (error, texture) => {
      if (error || !texture || !this.node.isValid) {
        console.warn(`[DirectionalSpriteAnimator] Failed to load texture: ${resourcePath}`, error);
        return;
      }

      this.texture = texture;

      Object.entries(clipMap).forEach(([clipName, rects]) => {
        const frames = rects.map((rect) => {
          const frame = new SpriteFrame();
          frame.reset({
            texture,
            rect: new Rect(rect.x, rect.y, rect.width, rect.height),
            originalSize: new Size(rect.width, rect.height),
          });
          return frame;
        });
        this.clips.set(clipName, frames);
      });

      this.loaded = true;
      const firstClip = Object.keys(clipMap)[0];
      if (firstClip) {
        this.play(firstClip);
      }
    });
  }

  play(clipName: string): void {
    if (!this.loaded) {
      this.currentClip = clipName;
      return;
    }

    if (this.currentClip === clipName && this.currentFrames.length > 0) {
      return;
    }

    const frames = this.clips.get(clipName);
    if (!frames || frames.length === 0) {
      return;
    }

    this.currentClip = clipName;
    this.currentFrames = frames;
    this.frameIndex = 0;
    this.elapsed = 0;
    this.applyFrame();
  }

  update(deltaTime: number): void {
    if (this.currentFrames.length <= 1) return;
    this.elapsed += deltaTime;
    const frameDuration = 1 / Math.max(1, this.fps);
    if (this.elapsed < frameDuration) return;
    this.elapsed = 0;
    this.frameIndex = (this.frameIndex + 1) % this.currentFrames.length;
    this.applyFrame();
  }

  private applyFrame(): void {
    this.sprite ??= this.getComponent(Sprite);
    if (!this.sprite || this.currentFrames.length === 0) return;
    this.sprite.spriteFrame = this.currentFrames[this.frameIndex];
  }
}
