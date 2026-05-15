# 엔젤 vs 데몬 개발 플랜

## 1. 개발 목표

혼자 개발 가능한 범위에서 빠르게 프로토타입을 만들고, 이후 스테이지 1~1000과 밸런스 데이터를 Supabase에서 운영할 수 있는 구조를 준비한다.

## 2. 기술 스택

- 엔진: Cocos Creator
- 언어: TypeScript
- 타깃: Web 우선, 이후 Android/iOS 확장
- 백엔드: Supabase
- 버전관리: Git

## 3. MVP 범위

첫 번째 플레이 가능한 버전에서 반드시 있어야 하는 요소만 포함한다.

- 플레이어 1종
- 시작 무기 1종: 검
- 스킬 4종
- 유물 6종
- 일반 적 5종
- 엘리트 2종
- 보스 2종
- 스테이지 1~20
- 로그인 및 프로필 저장
- 기본 드랍, 강화, 재도전 루프

## 4. 개발 단계

### 1단계: 핵심 전투 프로토타입

목표:
- 이동
- 자동 조준 기반 직접 공격
- 적 추적 및 피격
- 처치와 드랍
- 보스전 1개
- 임시 프로필 저장

완료 기준:
- 5분 이상 플레이해도 기본 루프가 유지됨
- 공격, 피격, 적 스폰, 보스전이 모두 동작함

### 2단계: 성장 시스템

목표:
- 무기 장착
- 스킬 해금 및 강화
- 유물 효과 적용
- 스테이지 종료 보상
- 플레이어 프로필 반영

완료 기준:
- 한 판 내 성장과 판 외 성장 구분이 가능함
- 빌드 차이에 따라 플레이 체감이 달라짐

### 3단계: 스테이지 구조화

목표:
- 스테이지 데이터 테이블 설계
- 스폰 패턴 분리
- 난이도 공식 정리
- 보스 파워 증가 공식 확정

완료 기준:
- 스테이지 데이터를 코드 수정 없이 교체 가능함
- 1~100까지 확장 가능한 구조가 확인됨

### 4단계: Supabase 연동

목표:
- 스테이지 밸런스 데이터 로드
- 아이템 데이터 로드
- 보스 수치 업데이트 반영
- 운영용 테이블 관리
- 로그인 및 유저 진행도 저장

완료 기준:
- 로컬 하드코딩 없이 외부 데이터 갱신이 가능함
- 데이터 버전 관리 정책이 정해짐

### 5단계: 콘텐츠 확장

목표:
- 신규 지역 추가
- 장비 풀 확장
- 보스 다변화
- 스테이지 100 이상 확장

완료 기준:
- 콘텐츠 추가 작업이 시스템 수정 없이 가능함

## 5. 시스템 설계 제안

### 전투 구조

- 직접 조작 이동
- 자동 조준 및 자동 발사형 검 공격
- 짧은 쿨다운 스킬
- 많은 수의 적을 빠르게 처치하는 군중 전투 중심

### 계정 구조

- Supabase Auth 기반 로그인
- `profiles` 테이블로 닉네임과 기초 정보 관리
- `player_progress`로 최고 스테이지, 재화, 영구 강화 저장
- `player_loadouts`로 무기, 스킬, 유물 장착 정보 저장

### 데이터 분리 원칙

코드와 운영 데이터를 분리한다.

- 코드:
  - 전투 로직
  - UI
  - 스킬 처리
  - 애니메이션
- 데이터:
  - 적 수치
  - 보스 수치
  - 스테이지 웨이브
  - 드랍률
  - 아이템 효과 값

## 6. 난이도 및 수치 설계 초안

### 스테이지 파워 공식 예시

- `stage_power = base_power * (1 + stage * 0.08) ^ growth_band`
- 구간별 `growth_band`를 조정해 급격한 점프 구간을 만든다.

### 보스 파워 공식 예시

- 일반 보스: `stage_power * 8`
- 50단위 지역 대장: `stage_power * 15`
- 100단위 챕터 보스: `stage_power * 25`
- 500/1000 특수 보스: 패턴 추가 + 고유 기믹 부여

### 적 구성 증가 예시

- 1~20: 기본 적 2종
- 21~50: 원거리 적 추가
- 51~100: 엘리트 패턴 강화
- 101 이후: 상태이상, 돌진, 소환형 적 추가

## 7. Supabase 데이터 구조 제안

운영 편의성을 위해 아래 테이블을 우선 설계한다.

- `stage_configs`
  - stage_id
  - chapter_id
  - recommended_power
  - wave_pattern_id
  - boss_id
  - reward_group_id

- `enemy_stats`
  - enemy_id
  - name
  - tier
  - hp
  - attack
  - move_speed
  - skill_profile

- `boss_stats`
  - boss_id
  - name
  - hp
  - attack
  - phase_count
  - pattern_profile
  - power_multiplier

- `item_defs`
  - item_id
  - item_type
  - rarity
  - stat_profile
  - effect_profile

- `skill_defs`
  - skill_id
  - category
  - cooldown
  - damage_factor
  - effect_profile

- `relic_defs`
  - relic_id
  - rarity
  - trigger_type
  - effect_profile

- `drop_tables`
  - drop_table_id
  - target_type
  - target_id
  - item_id
  - drop_rate

- `profiles`
  - user_id
  - nickname
  - avatar_id
  - created_at
  - last_login_at

- `player_progress`
  - user_id
  - highest_stage
  - player_level
  - gold
  - gem
  - total_kills
  - boss_kills

- `player_loadouts`
  - user_id
  - weapon_id
  - weapon_level
  - active_skill_ids
  - relic_ids
  - updated_at

## 8. 프로젝트 폴더 구조 제안

추후 Cocos Creator 프로젝트 생성 시 아래 구조를 권장한다.

- `assets/scripts/core`
- `assets/scripts/game`
- `assets/scripts/data`
- `assets/scripts/auth`
- `assets/scripts/ui`
- `assets/scripts/network`
- `assets/resources/data`
- `assets/prefabs`
- `assets/scenes`

## 9. 우선순위 제안

가장 먼저 해야 할 일:

1. 플레이어 조작과 기본 공격
2. 적 2종과 피격 처리
3. 경험치 또는 드랍 보상 루프
4. 보스 1종
5. 스테이지 데이터 분리

## 10. 다음 질문

기획을 더 구체화하려면 다음 질문에 답하면 좋다.

1. 주인공은 천사 1명으로 시작할지, 캐릭터 선택제로 갈지
2. 기본 공격은 검 근접 참격과 검기 원거리 파생 중 어느 비중이 더 큰지
3. 회복 수단을 드랍 아이템으로 할지, 스킬로 할지
4. 패배 시 영구 강화 자원을 얼마나 유지할지
5. 그림체를 2D 일러스트형으로 갈지, SD 캐릭터형으로 갈지
