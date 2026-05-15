# Guardian Angel Player Spec

## Goal

- 플레이어를 현재 기사형 임시 스프라이트에서 `수호천사` 콘셉트로 교체한다.
- `동/서/남/북` 4방향 이동/대기 애니메이션을 기준으로 작업한다.

## Recommended Sheet Format

- 파일명: `player_guardian_angel.png`
- 배경: 투명
- 시트 구조: `4열 x 4행`
- 프레임 크기: `64 x 64`
- 전체 크기: `256 x 256`

## Row Layout

- `1행`: `south`
- `2행`: `west`
- `3행`: `north`
- `4행`: `east`

## Column Layout

- `1열`: idle frame 1
- `2열`: idle / move transition
- `3열`: move frame 1
- `4열`: move frame 2

## Visual Direction

- `south`
  - 얼굴과 가슴이 정면 쪽
  - 날개는 양옆으로 넓게
- `west`
  - 왼쪽을 보는 측면
  - 검과 날개 실루엣이 확실히 보여야 함
- `north`
  - 등/날개 실루엣이 보이는 후면
- `east`
  - 오른쪽을 보는 측면

## Style Notes

- 밝은 `수호천사` 이미지
- 흰색/금색/하늘색 계열
- 지나치게 사실적이지 않은 `캐주얼 2D 아케이드`
- 작은 해상도에서도 읽히는 굵은 실루엣

## Animation Notes

- idle은 과하게 흔들리지 않게
- move는 발/날개 끝만 짧게 움직이는 정도
- 공격은 현재 `검기 발사형`이므로 별도 공격 프레임 없이도 시작 가능

## Current Engine Status

- 코드상 `4방향 + idle/move` 전환 구조는 이미 준비됨
- 실제 교체 시 [BattleSceneController.ts](/Users/yongjun.choi/WorkSpace/Game/angel-vs-demon/angel-vs-demon-client/assets/scripts/ui/BattleSceneController.ts) 의 플레이어 프레임 좌표만 새 시트 기준으로 바꾸면 됨
