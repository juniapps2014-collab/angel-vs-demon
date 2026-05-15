# Supabase Connection

현재 프로젝트에는 아래 Supabase 정보가 반영되어 있다.

- Project Name: `juniapps2014-collab's Project`
- URL: `https://libdosgjuqtmrknpquju.supabase.co`
- Client Key: publishable key
- Auth Mode: `anonymous`

현재 상태:

- Cocos 프로젝트가 부팅 시 Supabase 설정을 로드한다.
- Supabase Auth REST API로 익명 로그인 시도를 먼저 수행한다.
- Supabase REST API로 `profiles`, `player_progress`, `player_loadouts`를 조회하고 없으면 생성한다.
- `player_loadouts.weapon_level`에 검 강화 레벨을 저장한다.
- `player_loadouts.active_skill_ids`, `player_loadouts.skill_levels`에 스킬 장착/강화 상태를 저장한다.
- `player_loadouts.relic_ids`에 장착 유물 슬롯 데이터를 저장한다.
- 네트워크 실패 시 로컬 폴백 구조를 유지한다.

다음 구현 우선순위:

1. 닉네임 중복 충돌 처리
2. 진행도, 장착 상태, 처치 수 전체 동기화
3. 로그아웃/세션 복구 처리
4. refresh token 갱신 처리
