import { Color, Graphics, Node, Sprite, SpriteFrame, UITransform, resources } from 'cc';

type BackgroundOptions = {
  overlayColor?: Color;
  overlayAlpha?: number;
};

export class BackgroundArt {
  static apply(parent: Node, resourcePath: string, options: BackgroundOptions = {}): void {
    const overlayColor = options.overlayColor ?? new Color(10, 14, 30, 255);
    const overlayAlpha = options.overlayAlpha ?? 110;

    let bgNode = parent.getChildByName('SceneBackground');
    if (!bgNode) {
      bgNode = new Node('SceneBackground');
      bgNode.setPosition(0, 0);
      bgNode.addComponent(UITransform).setContentSize(1280, 720);
      const sprite = bgNode.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      parent.addChild(bgNode);
      bgNode.setSiblingIndex(0);
    }

    let overlay = bgNode.getChildByName('SceneBackgroundOverlay');
    if (!overlay) {
      overlay = new Node('SceneBackgroundOverlay');
      overlay.setPosition(0, 0);
      overlay.addComponent(UITransform).setContentSize(1280, 720);
      bgNode.addChild(overlay);
    }

    const overlayGraphics = overlay.getComponent(Graphics) ?? overlay.addComponent(Graphics);
    overlayGraphics.clear();
    overlayGraphics.fillColor = new Color(
      overlayColor.r,
      overlayColor.g,
      overlayColor.b,
      overlayAlpha,
    );
    overlayGraphics.rect(-640, -360, 1280, 720);
    overlayGraphics.fill();

    this.loadSpriteFrame(resourcePath, (spriteFrame) => {
      if (!spriteFrame || !bgNode?.isValid) return;
      const sprite = bgNode.getComponent(Sprite);
      if (!sprite) return;
      sprite.spriteFrame = spriteFrame;
    });
  }

  private static loadSpriteFrame(
    resourcePath: string,
    onLoad: (spriteFrame: SpriteFrame | null) => void,
  ): void {
    const candidates = [`${resourcePath}/spriteFrame`, resourcePath];
    const tryLoad = (index: number): void => {
      if (index >= candidates.length) {
        console.warn(`[BackgroundArt] Failed to load background: ${resourcePath}`);
        onLoad(null);
        return;
      }

      resources.load(candidates[index], SpriteFrame, (error, spriteFrame) => {
        if (!error && spriteFrame) {
          onLoad(spriteFrame);
          return;
        }
        tryLoad(index + 1);
      });
    };

    tryLoad(0);
  }
}
