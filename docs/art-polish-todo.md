# Art Polish TODO

## Enemy Visual Tuning

- `shield_zombie`: 현재 좀비 스프라이트 재사용이라 방패 느낌이 약함. 별도 아트 또는 오버레이 필요.
- `hellhound`: 임시로 고스트형 아트를 사용 중이라 콘셉트와 완전히 맞지 않음.
- `elite_jumper`: 현재 데빌형 아트를 확대 사용 중이라 발 부분 비율 확인 필요.
- `elite_drummer`: 현재 고스트형 아트 재사용이라 역할 식별성이 약함.
- `pitcher_imp`: 현재 데빌형 아트 재사용 예정이라 투척 포즈 식별성이 약함.
- `toxic_slime`: 일반 슬라임 변형이라 독성 실루엣/색 구분 강화 필요.
- `summoner_priest`: 현재 고스트형 아트 재사용 예정이라 사제 콘셉트가 약함.
- `pitcher_imp`: 투척 전조/탄 꼬리 이펙트가 과하면 opacity 또는 빈도 축소 검토.
- `toxic_slime`: 독 장판 펄스와 반경이 과하면 지속시간보다 먼저 시각 강도 조정.
- `summoner_priest`: 상단 텔레그래프와 소환 마법진이 과하게 겹치면 하나만 남길지 검토.

## Boss Visual Tuning

- `boss_clown_zombie`: 현재 좀비 틴트 버전이라 광대 연출 요소가 없음.
- `boss_hell_drummer`: 현재 고스트 틴트 버전이라 드럼/타악 콘셉트가 약함.
- `boss_abyss_knight`: 현재 플레이어 기사 스프라이트 재사용이라 적대감이 약할 수 있음.
- `boss_ice_witch`: 전용 마녀 아트가 없어 유령형 대체를 쓰는 중.
- `boss_shadow_assassin`: 현재 기사 틴트 재사용이라 민첩형 실루엣 보강 여지 있음.

## Sprite Size / Offset Checks

- `player_knight.png`: 실제 전투 화면에서 검 위치와 몸통 중심 정렬 확인 필요.
- `enemy_slime.png`: 바닥 접지 위치와 HP 바 높이 확인 필요.
- `boss_devil.png`: 보스 HP 바와 겹치지 않는지, 피격 판정 대비 시각 크기 확인 필요.
- `slash_red.png`: 현재 검기 이미지와 그래픽 스윙이 함께 보이므로 강하면 하나를 줄일지 결정 필요.
- `explosion_small.png`: 적 사망 팝 크기가 과하면 10~20% 축소 고려.

## UI And Scene Polish

- 로그인 배경 대비 본문 텍스트 가독성 확인
- 로비 헤더와 패널 간격 미세 조정
- 배틀 HUD 좌측 패널 줄바꿈 길이 확인
- 스킬 쿨다운 바에서 긴 스킬 이름이 잘리는지 확인

## Future Art Upgrades

- 적 타입별 완전 분리 스프라이트로 교체
- 보스별 개별 스프라이트 분리
- 무기 이펙트 프레임 애니메이션 교체
- 적 사망/피격 이펙트 전용 애니메이션 시트 도입
