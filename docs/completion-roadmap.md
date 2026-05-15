# Completion Roadmap

## Current Status

- `전투 코어`: 구현됨
- `사운드/기본 아트`: 1차 적용됨
- `보스 경고/패턴 차별화`: 적용됨
- `Supabase 기본 저장`: 적용됨
- `1~20 스테이지 데이터`: 초안에서 1차 튜닝 진행됨

## Done When

아래 항목이 충족되면 `프로토타입 완료`로 판단한다.

1. `1~20 스테이지`가 막힘 없이 한 사이클 플레이 가능
2. `Stage 10`, `Stage 20` 보스가 일반 스테이지와 체감 차이를 줌
3. `골드 -> 무기/스킬 강화 -> 다음 스테이지` 루프가 자연스럽게 이어짐
4. 재실행 후 `닉네임`, `최고 스테이지`, `골드`, `무기 레벨`, `스킬 레벨`, `장착값`이 유지됨
5. 로그인, 로비, 배틀 화면이 임시라도 게임처럼 보임

## Remaining Work

### 1. Prototype Lock

- `1~20` 실제 플레이 밸런스 최종 조정
- 보스 패턴 데미지/빈도 미세조정
- Stage clear / retry 흐름 점검

### 2. Persistence Lock

- 남은 성장값 저장 점검
- 예외 케이스: 네트워크 실패, 닉네임 충돌, 빈 프로필 복구 확인

### 3. Content Readiness

- `21~100` 구간 데이터 품질 확인
- 적/보스 타입별 아트 및 패턴 추가 분리
- 신규 적 `pitcher_imp`, `toxic_slime`, `summoner_priest` 패턴 실제 구현
- 신규 적 첫 등장 구간 체감 검증
  - `21`: 투척 임프
  - `30`: 독안개 슬라임
  - `25~35`: 소환 사제
- `21~40` 밸런스 리뷰 문서화
  - [stage-balance-21-40.md](/Users/yongjun.choi/WorkSpace/Game/angel-vs-demon/docs/stage-balance-21-40.md)
  - [playtest-checklist-21-40.md](/Users/yongjun.choi/WorkSpace/Game/angel-vs-demon/docs/playtest-checklist-21-40.md)

### 4. Polish

- [art-polish-todo.md](/Users/yongjun.choi/WorkSpace/Game/angel-vs-demon/docs/art-polish-todo.md) 항목 일괄 조정
- 사운드 볼륨 밸런스
- UI spacing / readability 최종 점검

## Next Review Questions

- Stage 6~10이 너무 급격하게 어려워지는가
- Stage 11~15의 강화 보상이 충분한가
- Stage 20 보스 진입 전 피로도가 과한가
