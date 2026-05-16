import { GAME_CONFIG } from '../core/GameConfig';
import { SupabaseClient } from '../network/SupabaseClient';
import { AuthService } from './AuthService';
import { GameDataRepository } from '../data/GameDataRepository';

export interface PlayerProfile {
  userId: string;
  nickname: string;
  highestStage: number;
  currentStage: number;
  playerLevel: number;
  gold: number;
  totalKills: number;
  weaponId: string;
  weaponLevel: number;
  skillIds: string[];
  skillLevels: Record<string, number>;
  relicIds: string[];
  runState: RunState | null;
}

export interface RunState {
  stageId: number;
  waveIndex: number;
  waveTimer: number;
  battleTimeElapsed: number;
  killCount: number;
  playerHp: number;
  bossSpawned: boolean;
  spawnQueue: Array<{ type: string; spawnArea: string; spawnIn: number }>;
}

export class ProfileService {
  private static profile: PlayerProfile | null = null;
  private static readonly relicPool = [
    'relic_holy_grail',
    'relic_broken_horn',
    'relic_celestial_compass',
    'relic_laughter_mask',
    'relic_guardian_feather',
    'relic_golden_bell',
  ];
  private static readonly skillPool = [
    'skill_star_burst',
    'skill_guardian_aura',
    'skill_heaven_strike',
    'skill_holy_dash',
  ];

  static async bootstrap(): Promise<void> {
    await AuthService.bootstrap();
    if (AuthService.getCurrentUser()) {
      await this.ensureProfile();
    }
  }

  static async ensureProfile(): Promise<PlayerProfile> {
    if (this.profile) {
      return this.profile;
    }

    const user = AuthService.getCurrentUser() ?? await AuthService.signInAnonymously();
    const localProfile = this.loadLocalProfile(user.id);

    if (SupabaseClient.isConfigured() && (user.provider === 'supabase-anon' || user.provider === 'supabase-email')) {
      try {
        this.profile = await this.loadOrCreateRemoteProfile(user.id, localProfile);
        this.persist();
        return this.profile;
      } catch (error) {
        console.warn('[ProfileService] Falling back to local profile cache.', error);
      }
    }

    this.profile = this.normalizeProfile(localProfile ?? this.createDefaultProfile(user.id));

    this.persist();
    return this.profile;
  }

  static getProfile(): PlayerProfile | null {
    return this.profile;
  }

  static resetSession(): void {
    this.profile = null;
  }

  static getWeaponDamage(): number {
    return 24 + ((this.profile?.weaponLevel ?? 1) - 1) * 8;
  }

  static getWeaponUpgradeCost(): number {
    const nextLevel = (this.profile?.weaponLevel ?? 1) + 1;
    return 60 + nextLevel * 40;
  }

  static getRelicName(relicId: string): string {
    return GameDataRepository.getRelicName(relicId);
  }

  static getSkillName(skillId: string): string {
    return GameDataRepository.getSkillName(skillId);
  }

  static hasSkill(skillId: string): boolean {
    return this.profile?.skillIds.includes(skillId) ?? false;
  }

  static hasRelic(relicId: string): boolean {
    return this.profile?.relicIds.includes(relicId) ?? false;
  }

  static getAutoAimRange(): number {
    let range = GAME_CONFIG.autoAimRange;

    if (this.hasRelic('relic_celestial_compass')) {
      range += 120;
    }

    return range;
  }

  static getContactDamageCooldown(): number {
    let cooldown = 0.6;

    if (this.hasRelic('relic_guardian_feather')) {
      cooldown += 0.45;
    }

    return cooldown;
  }

  static getMoveSpeedMultiplier(): number {
    return this.hasRelic('relic_broken_horn') ? 1.25 : 1.0;
  }

  static getSkillLevel(skillId: string): number {
    return this.profile?.skillLevels?.[skillId] ?? 1;
  }

  static getSkillUpgradeCost(skillId: string): number {
    const level = this.getSkillLevel(skillId);
    return 80 + level * 50;
  }

  static tryUpgradeSkill(skillId: string): boolean {
    if (!this.profile) return false;
    const cost = this.getSkillUpgradeCost(skillId);
    if (this.profile.gold < cost) return false;
    this.profile.gold -= cost;
    if (!this.profile.skillLevels) this.profile.skillLevels = {};
    this.profile.skillLevels[skillId] = (this.profile.skillLevels[skillId] ?? 1) + 1;
    this.persist();
    void this.syncProfile();
    return true;
  }

  static applyRewardGoldBonus(baseGold: number): number {
    let totalGold = baseGold;

    if (this.hasRelic('relic_golden_bell')) {
      totalGold = Math.floor(totalGold * 1.35);
    }

    return totalGold;
  }

  static updateNickname(nickname: string): void {
    if (!this.profile) {
      return;
    }

    this.profile.nickname = nickname.trim() || this.profile.nickname;
    this.persist();
    void this.syncProfile();
  }

  static updateHighestStage(stageId: number): void {
    if (!this.profile) {
      return;
    }

    this.profile.highestStage = Math.max(this.profile.highestStage, stageId);
    this.profile.currentStage = Math.max(this.profile.currentStage, this.profile.highestStage);
    this.persist();
    void this.syncProfile();
  }

  static setCurrentStage(stageId: number): void {
    if (!this.profile) {
      return;
    }

    this.profile.currentStage = Math.max(1, stageId);
    this.persist();
    void this.syncProfile();
  }

  static getCurrentStage(): number {
    return this.profile?.currentStage ?? this.profile?.highestStage ?? 1;
  }

  static saveRunState(runState: RunState): void {
    if (!this.profile) {
      return;
    }

    this.profile.runState = {
      ...runState,
      spawnQueue: runState.spawnQueue.map((entry) => ({ ...entry })),
    };
    this.profile.currentStage = runState.stageId;
    this.persist();
    void this.syncProfile();
  }

  static getRunState(): RunState | null {
    if (!this.profile?.runState) {
      return null;
    }

    return {
      ...this.profile.runState,
      spawnQueue: this.profile.runState.spawnQueue.map((entry) => ({ ...entry })),
    };
  }

  static hasRunState(): boolean {
    return !!this.profile?.runState;
  }

  static clearRunState(): void {
    if (!this.profile) {
      return;
    }

    this.profile.runState = null;
    this.persist();
    void this.syncProfile();
  }

  static addKills(count: number): void {
    if (!this.profile) return;
    this.profile.totalKills = (this.profile.totalKills ?? 0) + Math.max(0, count);
    this.persist();
    void this.syncProfile();
  }

  static addGold(amount: number): void {
    if (!this.profile) {
      return;
    }

    this.profile.gold += Math.max(0, amount);
    this.persist();
    void this.syncProfile();
  }

  static tryUpgradeWeapon(): boolean {
    if (!this.profile) {
      return false;
    }

    const cost = this.getWeaponUpgradeCost();
    if (this.profile.gold < cost) {
      return false;
    }

    this.profile.gold -= cost;
    this.profile.weaponLevel += 1;
    this.persist();
    void this.syncProfile();
    return true;
  }

  static cycleSkillPrev(slotIndex: number): void {
    if (!this.profile || !this.profile.skillIds || this.profile.skillIds.length === 0) return;
    const currentSkillId = this.profile.skillIds[slotIndex] ?? this.skillPool[0];
    const currentIndex = this.skillPool.indexOf(currentSkillId);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : this.skillPool.length - 1;
    this.profile.skillIds[slotIndex] = this.skillPool[prevIndex];
    this.persist();
    void this.syncProfile();
  }

  static cycleRelicPrev(slotIndex: number): void {
    if (!this.profile || !this.profile.relicIds || this.profile.relicIds.length === 0) return;
    const currentRelicId = this.profile.relicIds[slotIndex] ?? this.relicPool[0];
    const currentIndex = this.relicPool.indexOf(currentRelicId);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : this.relicPool.length - 1;
    this.profile.relicIds[slotIndex] = this.relicPool[prevIndex];
    this.persist();
    void this.syncProfile();
  }

  static cycleRelic(slotIndex: number): void {
    if (!this.profile || !this.profile.relicIds || this.profile.relicIds.length === 0) {
      return;
    }

    const currentRelicId = this.profile.relicIds[slotIndex] ?? this.relicPool[0];
    const currentIndex = this.relicPool.indexOf(currentRelicId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % this.relicPool.length : 0;
    this.profile.relicIds[slotIndex] = this.relicPool[nextIndex];
    this.persist();
    void this.syncProfile();
  }

  static cycleSkill(slotIndex: number): void {
    if (!this.profile || !this.profile.skillIds || this.profile.skillIds.length === 0) {
      return;
    }

    const currentSkillId = this.profile.skillIds[slotIndex] ?? this.skillPool[0];
    const currentIndex = this.skillPool.indexOf(currentSkillId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % this.skillPool.length : 0;
    this.profile.skillIds[slotIndex] = this.skillPool[nextIndex];
    this.persist();
    void this.syncProfile();
  }

  private static persist(): void {
    if (!this.profile) {
      return;
    }

    globalThis.localStorage?.setItem(
      `avd.profile.${this.profile.userId}`,
      JSON.stringify(this.profile),
    );
  }

  static getStorageModeLabel(): string {
    return SupabaseClient.isConfigured() ? 'Supabase Connected' : 'Local Only';
  }

  private static loadLocalProfile(userId: string): PlayerProfile | null {
    const savedProfile = globalThis.localStorage?.getItem(`avd.profile.${userId}`);
    return savedProfile ? this.normalizeProfile(JSON.parse(savedProfile) as PlayerProfile) : null;
  }

  private static createDefaultProfile(userId: string): PlayerProfile {
    return {
      userId,
      nickname: `${GAME_CONFIG.defaultNicknamePrefix}-${userId.slice(0, 4)}`,
      highestStage: 1,
      currentStage: 1,
      playerLevel: 1,
      gold: 0,
      totalKills: 0,
      weaponId: GAME_CONFIG.defaultWeaponId,
      weaponLevel: 1,
      skillIds: [
        'skill_star_burst',
        'skill_guardian_aura',
        'skill_heaven_strike',
      ],
      skillLevels: {},
      relicIds: [
        'relic_holy_grail',
        'relic_celestial_compass',
        'relic_guardian_feather',
      ],
      runState: null,
    };
  }

  private static normalizeProfile(profile: PlayerProfile): PlayerProfile {
    const defaults = this.createDefaultProfile(profile.userId);
    return {
      ...defaults,
      ...profile,
      skillIds:
        Array.isArray(profile.skillIds) && profile.skillIds.length > 0
          ? profile.skillIds
          : defaults.skillIds,
      relicIds:
        Array.isArray(profile.relicIds) && profile.relicIds.length > 0
          ? profile.relicIds
          : defaults.relicIds,
      skillLevels: profile.skillLevels ?? defaults.skillLevels,
      totalKills: profile.totalKills ?? defaults.totalKills,
      currentStage: profile.currentStage ?? profile.highestStage ?? defaults.currentStage,
      runState: profile.runState ?? defaults.runState,
    };
  }

  private static async loadOrCreateRemoteProfile(
    userId: string,
    localProfile: PlayerProfile | null,
  ): Promise<PlayerProfile> {
    const defaultProfile = localProfile ?? this.createDefaultProfile(userId);

    const existingProfile = await SupabaseClient.queryMaybeSingle<{
      user_id: string;
      nickname: string;
    }>('profiles', `user_id=eq.${userId}&select=user_id,nickname`);

    if (!existingProfile) {
      const pendingNickname = globalThis.localStorage?.getItem('avd.pendingNickname')?.trim();
      if (pendingNickname) {
        globalThis.localStorage?.removeItem('avd.pendingNickname');
        defaultProfile.nickname = pendingNickname;
      }
      await SupabaseClient.upsert('profiles', {
        user_id: userId,
        nickname: defaultProfile.nickname,
        avatar_id: 'angel_default',
        last_login_at: new Date().toISOString(),
      });
    } else {
      await SupabaseClient.upsert('profiles', {
        user_id: userId,
        nickname: existingProfile.nickname,
        avatar_id: 'angel_default',
        last_login_at: new Date().toISOString(),
      });
    }

    const progress = await SupabaseClient.queryMaybeSingle<{
      player_level: number;
      highest_stage: number;
      current_stage: number;
      gold: number;
      total_kills: number;
      run_state: RunState | null;
    }>('player_progress', `user_id=eq.${userId}&select=player_level,highest_stage,current_stage,gold,total_kills,run_state`);

    if (!progress) {
      await SupabaseClient.upsert('player_progress', {
        user_id: userId,
        player_level: defaultProfile.playerLevel,
        highest_stage: defaultProfile.highestStage,
        current_stage: defaultProfile.currentStage,
        gold: 0,
        gem: 0,
        total_kills: 0,
        boss_kills: 0,
        run_state: null,
      });
    }

    const loadout = await SupabaseClient.queryMaybeSingle<{
      weapon_id: string;
      weapon_level: number;
      active_skill_ids: string[];
      skill_levels: Record<string, number>;
      relic_ids: string[];
    }>('player_loadouts', `user_id=eq.${userId}&select=weapon_id,weapon_level,active_skill_ids,skill_levels,relic_ids`);

    if (!loadout) {
      await SupabaseClient.upsert('player_loadouts', {
        user_id: userId,
        weapon_id: defaultProfile.weaponId,
        weapon_level: defaultProfile.weaponLevel,
        active_skill_ids: defaultProfile.skillIds,
        skill_levels: defaultProfile.skillLevels,
        relic_ids: defaultProfile.relicIds,
      });
    }

    const loadoutRelics = loadout?.relic_ids;
    const validRelics = Array.isArray(loadoutRelics) && loadoutRelics.length > 0
      ? loadoutRelics as string[]
      : defaultProfile.relicIds;

    const loadoutSkills = loadout?.active_skill_ids;
    const validSkills = Array.isArray(loadoutSkills) && loadoutSkills.length > 0
      ? loadoutSkills as string[]
      : defaultProfile.skillIds;
    const validSkillLevels =
      loadout?.skill_levels && typeof loadout.skill_levels === 'object'
        ? loadout.skill_levels
        : defaultProfile.skillLevels;

    return this.normalizeProfile({
      userId,
      nickname: existingProfile?.nickname ?? defaultProfile.nickname,
      highestStage: progress?.highest_stage ?? defaultProfile.highestStage,
      currentStage: progress?.current_stage ?? progress?.highest_stage ?? defaultProfile.currentStage,
      playerLevel: progress?.player_level ?? defaultProfile.playerLevel,
      gold: progress?.gold ?? defaultProfile.gold,
      totalKills: progress?.total_kills ?? defaultProfile.totalKills,
      weaponId: loadout?.weapon_id ?? defaultProfile.weaponId,
      weaponLevel: loadout?.weapon_level ?? defaultProfile.weaponLevel,
      skillIds: validSkills,
      skillLevels: validSkillLevels,
      relicIds: validRelics,
      runState: progress?.run_state ?? defaultProfile.runState,
    });
  }

  private static async syncProfile(): Promise<void> {
    if (!this.profile || !SupabaseClient.isConfigured()) {
      return;
    }

    const user = AuthService.getCurrentUser();
    if (!user || (user.provider !== 'supabase-anon' && user.provider !== 'supabase-email')) {
      return;
    }

    const session = SupabaseClient.getSession();
    if (!session || session.access_token === 'local_fallback_token') {
      return;
    }

    try {
      await SupabaseClient.upsert('profiles', {
        user_id: this.profile.userId,
        nickname: this.profile.nickname,
        avatar_id: 'angel_default',
        last_login_at: new Date().toISOString(),
      });

      await SupabaseClient.upsert('player_progress', {
        user_id: this.profile.userId,
        player_level: this.profile.playerLevel,
        highest_stage: this.profile.highestStage,
        current_stage: this.profile.currentStage,
        gold: this.profile.gold,
        total_kills: this.profile.totalKills ?? 0,
        run_state: this.profile.runState,
      });

      await SupabaseClient.upsert('player_loadouts', {
        user_id: this.profile.userId,
        weapon_id: this.profile.weaponId,
        weapon_level: this.profile.weaponLevel,
        active_skill_ids: this.profile.skillIds,
        skill_levels: this.profile.skillLevels,
        relic_ids: this.profile.relicIds,
      });
    } catch (error) {
      console.warn('[ProfileService] Failed to sync profile data.', error);
    }
  }
}
