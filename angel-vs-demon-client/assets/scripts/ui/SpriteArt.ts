import { Color, Node, Rect, Size, Sprite, SpriteFrame, Texture2D, UITransform, resources } from 'cc';

type SpriteAttachOptions = {
  color?: Color;
  frameRect?: { x: number; y: number; width: number; height: number };
};

export class SpriteArt {
  static attach(
    parent: Node,
    childName: string,
    resourcePath: string,
    width: number,
    height: number,
    y = 0,
    options: SpriteAttachOptions = {},
  ): void {
    let spriteNode = parent.getChildByName(childName);
    if (!spriteNode) {
      spriteNode = new Node(childName);
      spriteNode.addComponent(UITransform).setContentSize(width, height);
      const sprite = spriteNode.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      parent.addChild(spriteNode);
    }

    spriteNode.setPosition(0, y, 0);
    spriteNode.getComponent(UITransform)?.setContentSize(width, height);
    const sprite = spriteNode.getComponent(Sprite);
    if (sprite && options.color) {
      sprite.color = options.color;
    }

    this.loadSpriteFrame(resourcePath, options.frameRect, (spriteFrame) => {
      if (!spriteFrame || !spriteNode?.isValid) return;
      const loadedSprite = spriteNode.getComponent(Sprite);
      if (loadedSprite) {
        loadedSprite.spriteFrame = spriteFrame;
        if (options.color) {
          loadedSprite.color = options.color;
        }
      }
    });
  }

  private static loadSpriteFrame(
    resourcePath: string,
    frameRect: SpriteAttachOptions['frameRect'],
    onLoad: (spriteFrame: SpriteFrame | null) => void,
  ): void {
    if (frameRect) {
      resources.load(`${resourcePath}/texture`, Texture2D, (textureError, texture) => {
        if (textureError || !texture) {
          console.warn(`[SpriteArt] Failed to load texture: ${resourcePath}`, textureError);
          onLoad(null);
          return;
        }

        const spriteFrame = new SpriteFrame();
        spriteFrame.reset({
          texture,
          rect: new Rect(
            frameRect.x,
            frameRect.y,
            frameRect.width,
            frameRect.height,
          ),
          originalSize: new Size(frameRect.width, frameRect.height),
        });
        onLoad(spriteFrame);
      });
      return;
    }

    const candidates = [`${resourcePath}/spriteFrame`, resourcePath];
    const tryLoad = (index: number): void => {
      if (index >= candidates.length) {
        console.warn(`[SpriteArt] Failed to load sprite: ${resourcePath}`);
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
