export const SCENE_NAMES = {
  Boot: 'Boot',
  Login: 'Login',
  Lobby: 'Lobby',
  Battle: 'Battle',
} as const;

export const GAME_CONFIG = {
  version: '0.1.0',
  defaultNicknamePrefix: 'Angel',
  defaultWeaponId: 'weapon_sword_001',
  defaultStageId: 1,
  autoAimRange: 320,
  baseAttackInterval: 0.22,
};

export type SceneName = (typeof SCENE_NAMES)[keyof typeof SCENE_NAMES];
