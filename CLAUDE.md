# Angel vs Demon — Project Guide

## 프로젝트 구조

```
angel-vs-demon/
├── angel-vs-demon-client/   # Cocos Creator 3.x 클라이언트
│   ├── assets/scripts/      # TypeScript 소스
│   └── build/web-desktop/   # 빌드 결과물 (Vercel 배포 대상)
├── backend/supabase/        # Supabase 백엔드
├── docs/                    # 기획 문서
└── gen_enemy_sprites.py     # 적 스프라이트 시트 생성 (Python/PIL)
```

## 자주 쓰는 명령어

### Git
```bash
# 상태 확인
git status

# 커밋
git add <파일>
git commit -m "메시지"

# 푸시
git push
```

### Vercel 배포
```bash
# 프로젝트 루트(angel-vs-demon/)에서 실행
vercel deploy --prod --yes
```

> Cocos Creator 빌드 자동화 불가 — 배포 전 에디터에서 수동 빌드 필요:
> **Cocos Creator → 프로젝트 → 빌드 → Web Desktop**

### 전체 배포 흐름
```bash
# 1. Cocos Creator 에디터에서 Web Desktop 빌드

# 2. 빌드 결과물 + 소스 커밋
git add angel-vs-demon-client/build/ angel-vs-demon-client/assets/
git commit -m "build: update"
git push

# 3. Vercel 배포 (프로젝트 루트에서)
vercel deploy --prod --yes
```

### 적 스프라이트 생성
```bash
# Python PIL 필요 (pip install Pillow)
python3 gen_enemy_sprites.py
```

## Vercel 프로젝트 정보

| 항목 | 값 |
|------|-----|
| 프로젝트명 | angel-vs-demon |
| 프로덕션 URL | https://notice-alpha-eight.vercel.app |
| Vercel 계정 | juniapps2014-4084 |
| GitHub 저장소 | https://github.com/juniapps2014-collab/angel-vs-demon |
| 배포 루트 | `angel-vs-demon-client/build/web-desktop` |

## 기술 스택

- **클라이언트**: Cocos Creator 3.x (TypeScript)
- **백엔드**: Supabase
- **배포**: Vercel (정적 호스팅)
- **스프라이트**: Python/PIL 픽셀아트 생성

## 주요 스크립트 경로

| 파일 | 설명 |
|------|------|
| `assets/scripts/ui/BattleSceneController.ts` | 전투 씬 메인 컨트롤러 |
| `assets/scripts/ui/ProceduralBackground.ts` | 절차적 배경 생성 |
| `assets/scripts/game/enemy/EnemyController.ts` | 적 AI 및 이펙트 |
| `assets/scripts/game/player/PlayerController.ts` | 플레이어 이동/공격 |
| `assets/scripts/ui/DirectionalSpriteAnimator.ts` | 4방향 스프라이트 애니메이션 |
