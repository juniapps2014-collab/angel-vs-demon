import { _decorator, Component, director } from 'cc';
import { AuthService } from '../auth/AuthService';
import { ProfileService } from '../auth/ProfileService';
import { SCENE_NAMES } from '../core/GameConfig';
import { SupabaseClient } from '../network/SupabaseClient';
import { SUPABASE_PROJECT_CONFIG } from '../network/SupabaseProjectConfig';
import { StageRepository } from '../data/StageRepository';
import { GameDataRepository } from '../data/GameDataRepository';
import { SoundManager } from '../audio/SoundManager';

const { ccclass } = _decorator;

@ccclass('BootSceneController')
export class BootSceneController extends Component {
  async start(): Promise<void> {
    SupabaseClient.initialize(SUPABASE_PROJECT_CONFIG);
    SoundManager.initialize();
    await Promise.all([
      AuthService.bootstrap(),
      StageRepository.loadAsync(),
      GameDataRepository.loadAsync(),
    ]);
    await ProfileService.bootstrap();
    director.loadScene(AuthService.getCurrentUser() ? SCENE_NAMES.Lobby : SCENE_NAMES.Login);
  }
}
