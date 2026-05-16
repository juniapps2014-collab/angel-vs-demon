import { _decorator, Component, Node, Vec3 } from 'cc';
import { ProfileService } from '../../auth/ProfileService';

const { ccclass } = _decorator;

@ccclass('AutoAimSystem')
export class AutoAimSystem extends Component {
  getNearestEnemy(): Node | null {
    // 계층: Player → Scene → WorldRoot → EnemyRoot
    const enemyRoot = this.node.parent?.getChildByName('WorldRoot')?.getChildByName('EnemyRoot') ?? null;
    if (!enemyRoot) {
      return null;
    }

    let nearestEnemy: Node | null = null;
    let minDistance = Number.MAX_SAFE_INTEGER;
    const autoAimRange = ProfileService.getAutoAimRange();

    for (const child of enemyRoot.children) {
      const distance = Vec3.distance(this.node.worldPosition, child.worldPosition);
      if (distance <= autoAimRange && distance < minDistance) {
        nearestEnemy = child;
        minDistance = distance;
      }
    }

    return nearestEnemy;
  }
}
