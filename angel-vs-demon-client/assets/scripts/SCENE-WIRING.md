# Scene Wiring

## 권장 진행 순서

1. `assets/scenes` 폴더를 만든다.
2. `Boot.scene`, `Login.scene`, `Lobby.scene`, `Battle.scene` 를 생성한다.
3. 각 씬의 루트 노드에 아래 컨트롤러 하나만 붙인다.

## Boot.scene

- 루트 노드에 `BootSceneController` 추가

## Login.scene

- 루트 노드에 `LoginSceneController` 추가
- 실행 시 Canvas, 제목, 닉네임 라벨, 시작 버튼을 자동 생성한다.

## Lobby.scene

- 루트 노드에 `LobbySceneController` 추가
- 실행 시 프로필 라벨과 전투 시작 버튼을 자동 생성한다.

## Battle.scene

- 루트 노드에 `BattleSceneController` 추가
- 실행 시 Canvas, HUD, Player, Weapon, EnemyRoot, 적 더미 5개를 자동 생성한다.
- 플레이어 이동은 `WASD` 또는 방향키 기준이다.

## 참고

- 기존 `LoginView`, `LobbyView`, `HudView` 는 수동 UI 구성용으로 유지한다.
- 지금 추가한 `*SceneController` 는 화면을 빠르게 확인하기 위한 프로토타입용이다.
