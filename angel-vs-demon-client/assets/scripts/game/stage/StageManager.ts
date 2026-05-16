import { _decorator, Component, Label } from 'cc';
import { ProfileService } from '../../auth/ProfileService';
import { GAME_CONFIG } from '../../core/GameConfig';
import { DEFAULT_STAGE_TIME_LIMIT_SECONDS, StageRepository } from '../../data/StageRepository';

const { ccclass, property } = _decorator;

@ccclass('StageManager')
export class StageManager extends Component {
  @property(Label)
  stageLabel: Label | null = null;

  private currentStageId = GAME_CONFIG.defaultStageId;

  onLoad(): void {
    const profile = ProfileService.getProfile();
    this.currentStageId = profile?.currentStage ?? profile?.highestStage ?? GAME_CONFIG.defaultStageId;
  }

  start(): void {
    this.refreshLabel();
  }

  getCurrentStageId(): number {
    return this.currentStageId;
  }

  getCurrentStageDefinition() {
    try {
      const stage = StageRepository.getStage(this.currentStageId);
      if (stage && stage.id) {
        return stage;
      }
    } catch (e) {
      console.warn('Error getting stage definition:', e);
    }
    return {
      id: this.currentStageId,
      recommendedPower: 100,
      enemyCount: 18,
      rewardGold: 40,
      bossId: null,
      timeLimitSeconds: DEFAULT_STAGE_TIME_LIMIT_SECONDS,
    };
  }

  markStageCleared(): void {
    const nextStageId = this.currentStageId + 1;
    ProfileService.updateHighestStage(nextStageId);
    ProfileService.setCurrentStage(nextStageId);
    ProfileService.clearRunState();
    this.currentStageId = nextStageId;
    this.refreshLabel();
  }

  setCurrentStage(stageId: number): void {
    this.currentStageId = Math.max(1, stageId);
    ProfileService.setCurrentStage(this.currentStageId);
    this.refreshLabel();
  }

  getStageLabelText(): string {
    const stage = this.getCurrentStageDefinition();
    return `Stage ${stage.id} / Power ${stage.recommendedPower} / Reward ${stage.rewardGold}G`;
  }

  private refreshLabel(): void {
    if (!this.stageLabel) {
      return;
    }

    this.stageLabel.string = this.getStageLabelText();
  }
}
