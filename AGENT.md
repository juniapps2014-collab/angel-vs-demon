# Angel vs Demon — Agent Instructions

## 프로젝트 개요

Cocos Creator 3.x 기반 캐주얼 아케이드 게임. 플레이어(천사)가 적(악마 계열)을 물리치는 스테이지 클리어형 게임.

## 코드 작업 규칙

### TypeScript / Cocos Creator
- 컴포넌트는 `@ccclass` 데코레이터 사용
- 노드 생성 시 `UITransform` 컴포넌트 필수 추가
- 씬 내 노드 접근은 `this.node.getChildByName()` 사용
- `onLoad()` → `start()` → `update(dt)` 순서 준수

### 스프라이트 규격
- **플레이어**: 1192×1192, 298×298/frame, 4열×4행
  - 행 순서: row1=south, row2=west, row3=north, row4=east
- **적**: 512×512, 128×128/frame, 4열×4행
  - 행 순서: row1=south, row2=west, row3=north, row4=east
  - 열 순서: col1=idle1, col2=idle2, col3=move1, col4=move2

### DirectionalSpriteAnimator clipMap 패턴
```typescript
const F = 128;
const clipMap = {
  south_idle: [{x:0,   y:0, w:F, h:F}, {x:F,   y:0, w:F, h:F}],
  south_move: [{x:0,   y:0, w:F, h:F}, {x:F,   y:0, w:F, h:F}, {x:2*F, y:0, w:F, h:F}, {x:3*F, y:0, w:F, h:F}],
  west_idle:  [{x:0,   y:F, w:F, h:F}, {x:F,   y:F, w:F, h:F}],
  west_move:  [{x:0,   y:F, w:F, h:F}, {x:F,   y:F, w:F, h:F}, {x:2*F, y:F, w:F, h:F}, {x:3*F, y:F, w:F, h:F}],
  north_idle: [{x:0, y:2*F, w:F, h:F}, {x:F, y:2*F, w:F, h:F}],
  north_move: [{x:0, y:2*F, w:F, h:F}, {x:F, y:2*F, w:F, h:F}, {x:2*F, y:2*F, w:F, h:F}, {x:3*F, y:2*F, w:F, h:F}],
  east_idle:  [{x:0, y:3*F, w:F, h:F}, {x:F, y:3*F, w:F, h:F}],
  east_move:  [{x:0, y:3*F, w:F, h:F}, {x:F, y:3*F, w:F, h:F}, {x:2*F, y:3*F, w:F, h:F}, {x:3*F, y:3*F, w:F, h:F}],
};
```

### ProceduralBackground 테마 범위
| 스테이지 | 테마 |
|----------|------|
| 1–100    | city_night |
| 301–400  | demon_carnival |
| 그 외    | none (이미지 배경 폴백) |

## 배포

```bash
# 반드시 프로젝트 루트(angel-vs-demon/)에서 실행
vercel deploy --prod --yes
```

배포 전 Cocos Creator 에디터에서 **Web Desktop 빌드** 선행 필요.

## Git

```bash
git remote    # origin: https://github.com/juniapps2014-collab/angel-vs-demon.git
git push      # main 브랜치
```

## 참고 문서

- `docs/player-guardian-angel-spec.md` — 플레이어 스프라이트 시트 스펙
- `docs/scenario.md` — 스테이지 시나리오 및 테마
- `docs/development-plan.md` — 개발 로드맵
- `docs/stage-balance-1-20.md` — 스테이지 밸런스 데이터
