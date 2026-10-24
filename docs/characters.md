# 도감 캐릭터

사용자가 제공한 캐릭터 카드와 배낭을 멘 탐험가 레퍼런스를 바탕으로, 굵은 손그림 윤곽과 올리브·크림·황토색을 사용한 새 일러스트를 제작했습니다. 모든 이미지는 내장 `image_gen`으로 생성한 투명 배경 PNG이며 앱에 포함되어 오프라인에서도 표시됩니다.

## 저장된 이미지

| 도감 / 화면 | 캐릭터 | 파일 |
| --- | --- | --- |
| 탐험가 레벨 카드 | 모자·배낭·지팡이를 갖춘 탐험가 | [explorer.png](../public/images/characters/explorer.png) |
| 첫 발견 | 지도를 든 고래 탐험가 | [first-discovery.png](../public/images/characters/first-discovery.png) |
| 물길의 시 | 두루마리와 붓을 든 수달 | [clear-landscape.png](../public/images/characters/clear-landscape.png) |
| 서원의 이야기 | 책을 읽는 부엉이 | [three-scholars.png](../public/images/characters/three-scholars.png) |
| 포은의 풍경 | 작은 바위 언덕을 멘 거북 | [poeun-landscape.png](../public/images/characters/poeun-landscape.png) |
| 정자의 기억 | 웃는 정자 | [pavilion-memory.png](../public/images/characters/pavilion-memory.png) |
| 돌에 남긴 마음 | 하트를 품은 돌 | [stone-memory.png](../public/images/characters/stone-memory.png) |
| 옛길의 기록 | 지도를 든 등산화 | [old-road-record.png](../public/images/characters/old-road-record.png) |
| 습지의 숨결 | 연잎 모자를 쓴 개구리 | [wetland-life.png](../public/images/characters/wetland-life.png) |
| 오래된 발걸음 | 발을 살펴보는 아기 공룡 | [dinosaur-trace.png](../public/images/characters/dinosaur-trace.png) |
| 바위 속 고래 | 스카프를 맨 고래 | [whale-discovery.png](../public/images/characters/whale-discovery.png) |
| 강의 역사 | 토기를 안은 수달 | [river-history.png](../public/images/characters/river-history.png) |
| 아주 먼 날의 산책 | 배낭을 멘 아기 트리케라톱스 | [ancient-footprints.png](../public/images/characters/ancient-footprints.png) |
| 겹겹의 시간 | 돋보기를 든 바위 요정 | [layers-of-time.png](../public/images/characters/layers-of-time.png) |

캐릭터는 장소의 이야기를 친근하게 표현한 창작 마스코트이며, 실제 암각화 도상이나 화석의 종을 재현한 자료는 아닙니다. 기존 도감 이름, 수집 조건, XP, 장소 연결을 그대로 사용합니다. 미수집 카드는 연한 색으로, 수집한 카드는 선명한 색과 체크 표시로 구분합니다. 미션 완료 팝업에도 획득한 캐릭터가 나타납니다.

## 최종 생성 프롬프트

- [탐험가와 첫 발견](character-prompts-explorer.json)
- [역사 장소 6종](character-prompts-history.json)
- [자연·유산 6종](character-prompts-nature.json)

각 JSON에 최종 프롬프트와 생성 원본 경로를 기록했습니다. 원본은 유지하고 프로젝트의 `public/images/characters/`로 복사했습니다.

## 확인 결과

- 390px·360px 화면: 13개 도감 이미지와 탐험가 이미지 모두 로드, 가로 넘침 없음.
- 도감의 ‘습지의 숨결’ 선택 시 기존 동매산 습지 안내와 미션 화면으로 연결 확인.
- 타입 검사·ESLint·기존 테스트 107개 통과, 정적 빌드와 iOS 시뮬레이터 빌드 성공.
- iPhone 17 Pro 시뮬레이터의 기존 앱에 업데이트 설치하고 실행 확인. 기존 수집 기록 유지.
- 시뮬레이터의 웹 화면 터치가 자동화 도구에서 작동하지 않아 수집함의 시각 검수는 동일 코드의 모바일 크기 브라우저 미리보기에서 진행.
- [탐험가 화면](character-explorer-preview.png) · [도감 화면](character-collection-preview.png)
