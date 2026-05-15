# Cocos Creator 프로젝트 셋업 가이드

## 권장 프로젝트명

- `angel-vs-demon-client`

## 생성 방식

Cocos Creator에서 새 TypeScript 프로젝트를 `project/angel-vs-demon-client` 경로에 생성하는 것을 권장한다.

## 권장 초기 씬

- `Boot.scene`
- `Login.scene`
- `Lobby.scene`
- `Battle.scene`

## 권장 스크립트 구조

- `assets/scripts/core`
  - `AppRoot.ts`
  - `EventBus.ts`
  - `GameConfig.ts`
- `assets/scripts/auth`
  - `AuthService.ts`
  - `ProfileService.ts`
- `assets/scripts/game/player`
  - `PlayerController.ts`
  - `AutoAimSystem.ts`
  - `SwordWeapon.ts`
- `assets/scripts/game/enemy`
  - `EnemyController.ts`
  - `BossController.ts`
- `assets/scripts/game/stage`
  - `StageManager.ts`
  - `WaveSpawner.ts`
- `assets/scripts/game/combat`
  - `DamageSystem.ts`
  - `ProjectileSystem.ts`
- `assets/scripts/data`
  - `StageRepository.ts`
  - `ItemRepository.ts`
  - `ProfileRepository.ts`
- `assets/scripts/network`
  - `SupabaseClient.ts`
- `assets/scripts/ui`
  - `LoginView.ts`
  - `LobbyView.ts`
  - `HudView.ts`
  - `ResultView.ts`

## 구현 우선순위

1. `Boot.scene`에서 게임 설정 로드
2. `Login.scene`에서 익명 로그인 또는 이메일 로그인
3. `Lobby.scene`에서 프로필과 장착 정보 확인
4. `Battle.scene`에서 이동, 자동 조준, 자동 공격 구현
5. 전투 종료 후 진행도 저장

