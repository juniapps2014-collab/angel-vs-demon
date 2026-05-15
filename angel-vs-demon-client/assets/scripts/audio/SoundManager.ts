import { AudioClip, AudioSource, Node, director, game, resources } from 'cc';

const SOUND_PATHS = {
  uiClick: 'audio/sfx/ui/button_click',
  uiConfirm: 'audio/sfx/ui/button_confirm',
  uiError: 'audio/sfx/ui/button_error',
  swordSwing: 'audio/sfx/game/sword_swing',
  enemyDown: 'audio/sfx/game/enemy_down',
  stageClear: 'audio/sfx/meta/stage_clear',
  gameOver: 'audio/sfx/meta/game_over',
} as const;

export class SoundManager {
  private static rootNode: Node | null = null;
  private static audioSource: AudioSource | null = null;
  private static clipCache = new Map<string, AudioClip>();
  private static pendingLoads = new Map<string, Promise<AudioClip | null>>();

  static initialize(): void {
    this.ensureAudioSource();
    Object.values(SOUND_PATHS).forEach((path) => {
      void this.loadClip(path);
    });
  }

  static playUiClick(volume = 0.55): void {
    this.play(SOUND_PATHS.uiClick, volume);
  }

  static playUiConfirm(volume = 0.65): void {
    this.play(SOUND_PATHS.uiConfirm, volume);
  }

  static playUiError(volume = 0.65): void {
    this.play(SOUND_PATHS.uiError, volume);
  }

  static playSwordSwing(volume = 0.55): void {
    this.play(SOUND_PATHS.swordSwing, volume);
  }

  static playEnemyDown(volume = 0.45): void {
    this.play(SOUND_PATHS.enemyDown, volume);
  }

  static playStageClear(volume = 0.75): void {
    this.play(SOUND_PATHS.stageClear, volume);
  }

  static playGameOver(volume = 0.8): void {
    this.play(SOUND_PATHS.gameOver, volume);
  }

  private static play(path: string, volume: number): void {
    const source = this.ensureAudioSource();
    if (!source) return;

    const clip = this.clipCache.get(path);
    if (clip) {
      source.playOneShot(clip, volume);
      return;
    }

    void this.loadClip(path).then((loadedClip) => {
      if (!loadedClip) return;
      this.ensureAudioSource()?.playOneShot(loadedClip, volume);
    });
  }

  private static ensureAudioSource(): AudioSource | null {
    if (this.audioSource?.isValid) return this.audioSource;

    if (!this.rootNode?.isValid) {
      const scene = director.getScene();
      if (!scene) return null;

      this.rootNode = new Node('SoundManager');
      scene.addChild(this.rootNode);
      game.addPersistRootNode(this.rootNode);
    }

    this.audioSource = this.rootNode.getComponent(AudioSource) ?? this.rootNode.addComponent(AudioSource);
    this.audioSource.playOnAwake = false;
    return this.audioSource;
  }

  private static loadClip(path: string): Promise<AudioClip | null> {
    const cached = this.clipCache.get(path);
    if (cached) return Promise.resolve(cached);

    const pending = this.pendingLoads.get(path);
    if (pending) return pending;

    const request = new Promise<AudioClip | null>((resolve) => {
      resources.load(path, AudioClip, (error, clip) => {
        this.pendingLoads.delete(path);
        if (error || !clip) {
          console.warn(`[SoundManager] Failed to load clip: ${path}`, error);
          resolve(null);
          return;
        }

        this.clipCache.set(path, clip);
        resolve(clip);
      });
    });

    this.pendingLoads.set(path, request);
    return request;
  }
}
