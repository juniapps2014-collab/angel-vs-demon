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

const BGM_PATHS = {
  menu: 'audio/bgm/menu_theme',
  battle: 'audio/bgm/battle_theme',
} as const;

type BgmKind = 'none' | 'menu' | 'battle';

type SynthVoice = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gain: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  osc: any;
};

export class SoundManager {
  private static rootNode: Node | null = null;
  private static sfxSource: AudioSource | null = null;
  private static bgmSource: AudioSource | null = null;
  private static clipCache = new Map<string, AudioClip>();
  private static pendingLoads = new Map<string, Promise<AudioClip | null>>();
  private static failedPaths = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static audioContext: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static bgmMasterGain: any = null;
  private static synthVoices: SynthVoice[] = [];
  private static synthPulseTimer: number | null = null;
  private static currentBgm: BgmKind = 'none';
  private static unlockListenersBound = false;

  static initialize(): void {
    this.ensureSfxSource();
    this.ensureBgmSource();
    this.ensureAudioContext();
    this.bindAudioUnlockListeners();
    Object.values(SOUND_PATHS).forEach((path) => {
      void this.loadClip(path);
    });
    Object.values(BGM_PATHS).forEach((path) => {
      void this.loadClip(path);
    });
  }

  static playMenuBgm(): void {
    void this.playBgm('menu');
  }

  static playBattleBgm(): void {
    void this.playBgm('battle');
  }

  static stopBgm(): void {
    this.stopClipBgm();
    this.stopSynthBgm();
    this.currentBgm = 'none';
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
    this.playSwordSynth(Math.max(0.08, volume * 0.22));
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
    const source = this.ensureSfxSource();
    this.resumeAudioContext();
    if (!source) return;

    const clip = this.clipCache.get(path);
    if (clip) {
      source.playOneShot(clip, volume);
      return;
    }

    if (this.failedPaths.has(path)) {
      return;
    }

    void this.loadClip(path).then((loadedClip) => {
      if (!loadedClip) return;
      this.ensureSfxSource()?.playOneShot(loadedClip, volume);
    });
  }

  private static ensureSfxSource(): AudioSource | null {
    this.ensureRootNode();
    if (this.sfxSource?.isValid) return this.sfxSource;

    if (!this.rootNode?.isValid) return null;

    this.sfxSource = this.rootNode.getComponent(AudioSource) ?? this.rootNode.addComponent(AudioSource);
    this.sfxSource.playOnAwake = false;
    return this.sfxSource;
  }

  private static ensureBgmSource(): AudioSource | null {
    this.ensureRootNode();
    if (this.bgmSource?.isValid) return this.bgmSource;
    if (!this.rootNode?.isValid) return null;

    const bgmNode = this.rootNode.getChildByName('BgmSource') ?? new Node('BgmSource');
    if (!bgmNode.parent) {
      this.rootNode.addChild(bgmNode);
    }

    this.bgmSource = bgmNode.getComponent(AudioSource) ?? bgmNode.addComponent(AudioSource);
    this.bgmSource.playOnAwake = false;
    this.bgmSource.loop = true;
    this.bgmSource.volume = 0.42;
    return this.bgmSource;
  }

  private static ensureRootNode(): void {
    if (this.rootNode?.isValid) {
      return;
    }

    const scene = director.getScene();
    if (!scene) {
      return;
    }

    this.rootNode = new Node('SoundManager');
    scene.addChild(this.rootNode);
    game.addPersistRootNode(this.rootNode);
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
          this.failedPaths.add(path);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static ensureAudioContext(): any {
    if (this.audioContext) {
      return this.audioContext;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contextCtor = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
    if (!contextCtor) {
      return null;
    }

    this.audioContext = new contextCtor();
    return this.audioContext;
  }

  private static resumeAudioContext(): void {
    const context = this.ensureAudioContext();
    if (!context) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume();
    }
  }

  private static bindAudioUnlockListeners(): void {
    if (this.unlockListenersBound || typeof window === 'undefined') {
      return;
    }

    this.unlockListenersBound = true;
    const unlock = (): void => {
      this.resumeAudioContext();
      if (this.currentBgm !== 'none') {
        void this.playBgm(this.currentBgm);
      }
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  private static async playBgm(kind: BgmKind): Promise<void> {
    if (kind === 'none') {
      this.stopBgm();
      return;
    }

    this.currentBgm = kind;
    this.resumeAudioContext();

    const bgmPath = kind === 'menu' ? BGM_PATHS.menu : BGM_PATHS.battle;
    const clip = await this.loadClip(bgmPath);
    if (clip) {
      this.playClipBgm(clip);
      this.stopSynthBgm();
      return;
    }

    this.startSynthBgm(kind);
  }

  private static startSynthBgm(kind: BgmKind): void {
    if (kind === 'none') {
      this.stopClipBgm();
      this.stopSynthBgm();
      return;
    }

    this.resumeAudioContext();
    const context = this.ensureAudioContext();
    if (!context) {
      return;
    }

    if (this.currentBgm === kind && this.synthVoices.length > 0) {
      return;
    }

    this.stopClipBgm();
    this.stopSynthBgm();
    this.currentBgm = kind;

    this.bgmMasterGain = context.createGain();
    this.bgmMasterGain.gain.setValueAtTime(kind === 'battle' ? 0.05 : 0.04, context.currentTime);
    this.bgmMasterGain.connect(context.destination);

    const baseFreqs = kind === 'battle'
      ? [55, 82.41, 123.47]
      : [98, 146.83, 220];
    const waveTypes = kind === 'battle'
      ? ['sawtooth', 'triangle', 'triangle']
      : ['triangle', 'sine', 'triangle'];

    this.synthVoices = baseFreqs.map((freq, index) => {
      const osc = context.createOscillator();
      const gainNode = context.createGain();
      osc.type = waveTypes[index] ?? 'sine';
      osc.frequency.setValueAtTime(freq, context.currentTime);
      gainNode.gain.setValueAtTime(kind === 'battle' ? 0.018 : 0.014, context.currentTime);
      osc.connect(gainNode);
      gainNode.connect(this.bgmMasterGain!);
      osc.start();
      return { osc, gain: gainNode.gain };
    });

    this.scheduleBgmPulse(kind);
  }

  private static playClipBgm(clip: AudioClip): void {
    const source = this.ensureBgmSource();
    if (!source) {
      return;
    }

    if (source.clip === clip && source.playing) {
      return;
    }

    source.stop();
    source.clip = clip;
    source.loop = true;
    source.volume = 0.42;
    source.play();
  }

  private static stopClipBgm(): void {
    if (!this.bgmSource?.isValid) {
      return;
    }
    this.bgmSource.stop();
  }

  private static stopSynthBgm(): void {
    if (this.synthPulseTimer !== null) {
      globalThis.clearInterval(this.synthPulseTimer);
      this.synthPulseTimer = null;
    }

    for (const voice of this.synthVoices) {
      try {
        voice.osc.stop();
      } catch {
        // ignore repeated stop
      }
      voice.osc.disconnect();
    }
    this.synthVoices = [];

    if (this.bgmMasterGain) {
      this.bgmMasterGain.disconnect();
      this.bgmMasterGain = null;
    }
  }

  private static scheduleBgmPulse(kind: BgmKind): void {
    const context = this.ensureAudioContext();
    if (!context || this.synthVoices.length === 0) {
      return;
    }

    const progressions = kind === 'battle'
      ? [
          [55, 82.41, 123.47],
          [61.74, 92.5, 138.59],
          [51.91, 77.78, 116.54],
          [65.41, 98, 146.83],
        ]
      : [
          [98, 146.83, 220],
          [110, 164.81, 246.94],
          [87.31, 130.81, 196],
          [123.47, 185, 277.18],
        ];

    let step = 0;
    const applyStep = (): void => {
      const chord = progressions[step % progressions.length];
      const now = context.currentTime;
      this.synthVoices.forEach((voice, index) => {
        const freq = chord[index] ?? chord[chord.length - 1];
        voice.osc.frequency.cancelScheduledValues(now);
        voice.osc.frequency.linearRampToValueAtTime(freq, now + 0.8);
        const pulseGain = kind === 'battle'
          ? (index === 0 ? 0.026 : 0.016)
          : (index === 2 ? 0.02 : 0.013);
        voice.gain.cancelScheduledValues(now);
        voice.gain.linearRampToValueAtTime(pulseGain, now + 0.3);
        voice.gain.linearRampToValueAtTime(pulseGain * 0.75, now + 2.1);
      });

      if (kind === 'menu') {
        this.playTone(659.25, 'sine', 0.018, 0.22, 0.05);
        this.playTone(783.99, 'triangle', 0.012, 0.34, 0.12);
      } else {
        this.playTone(164.81, 'triangle', 0.03, 0.2, 0.02);
        this.playTone(220, 'sawtooth', 0.016, 0.15, 0.12);
      }
      step += 1;
    };

    applyStep();
    this.synthPulseTimer = globalThis.setInterval(applyStep, kind === 'battle' ? 2200 : 2800);
  }

  private static playSwordSynth(volume: number): void {
    const context = this.ensureAudioContext();
    if (!context) {
      return;
    }
    this.resumeAudioContext();

    const now = context.currentTime;
    this.playTone(980, 'sawtooth', volume, 0.08, 0);
    this.playTone(680, 'triangle', volume * 0.75, 0.12, 0.015);
    this.playNoiseBurst(volume * 0.42, 0.06, 0.01);

    const sub = context.createOscillator();
    const subGain = context.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(220, now);
    sub.frequency.exponentialRampToValueAtTime(96, now + 0.12);
    subGain.gain.setValueAtTime(volume * 0.18, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    sub.connect(subGain);
    subGain.connect(context.destination);
    sub.start(now);
    sub.stop(now + 0.13);
  }

  private static playTone(
    frequency: number,
    type: string,
    volume: number,
    duration: number,
    delay: number,
  ): void {
    const context = this.ensureAudioContext();
    if (!context) {
      return;
    }

    const startTime = context.currentTime + delay;
    const osc = context.createOscillator();
    const gainNode = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gainNode);
    gainNode.connect(context.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private static playNoiseBurst(volume: number, duration: number, delay: number): void {
    const context = this.ensureAudioContext();
    if (!context) {
      return;
    }

    const bufferSize = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      const decay = 1 - i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * decay;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;

    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(900, context.currentTime);

    const gainNode = context.createGain();
    const startTime = context.currentTime + delay;
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(context.destination);
    source.start(startTime);
    source.stop(startTime + duration + 0.02);
  }
}
