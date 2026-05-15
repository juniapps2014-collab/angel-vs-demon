# Supabase 연결 정보

## 프로젝트

- 이름: `juniapps2014-collab's Project`
- URL: `https://libdosgjuqtmrknpquju.supabase.co`
- 인증 방식: 익명 로그인

## 현재 반영 상태

- 클라이언트 프로젝트에 URL 및 publishable key 반영
- 부팅 시 Supabase 설정 초기화
- 로그인 화면에 연결 상태 표기
- Supabase Auth REST API 기반 익명 로그인 우선 시도
- Supabase Data REST API 기반으로 `profiles`, `player_progress`, `player_loadouts` 조회 및 없으면 생성
- `player_loadouts.weapon_level`로 무기 강화 레벨 저장
- `player_loadouts.active_skill_ids`로 장착 스킬 3슬롯 저장
- `player_loadouts.skill_levels`로 스킬 강화 레벨 저장
- `player_loadouts.relic_ids`로 장착 유물 3슬롯 저장
- 네트워크 실패 시 로컬 저장 폴백 사용

## 남은 작업

- 닉네임 중복 예외 처리
- 플레이 데이터 전체 동기화
- 세션 만료 및 재로그인 처리

## 필요한 확인

- Supabase Auth에서 Anonymous sign-ins 활성화 여부
- `profiles`, `player_progress`, `player_loadouts`에 대한 RLS 정책 정상 적용 여부
