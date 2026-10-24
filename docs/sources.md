# 콘텐츠 출처 및 이미지 이용 기록

관광·이미지 확인일: 2026-10-22 (Asia/Seoul). 지도 연결·개발 범위 갱신일: 2026-10-23. 관광 설명은 공식 기관 자료를 짧게 재작성했습니다. 링크 열기만으로 해설 청취·시설 이용·방문이 인증되지는 않습니다.

## 기획 기준

- [상위 조사](https://app.notion.com/p/4015258dac46815eb767e8dba878f00e): 관광 지도 → 해설 → 체험 → 여권의 흐름과 A/B 구역 콘텐츠.
- [개발 기획안](https://app.notion.com/p/4015258dac4681789b7bc9f7b046d7ac): 1~11절, 시범 6곳·2코스와 13곳 기본 데이터. 두 Notion 문서 사이의 차이는 최신 하위 기획안을 우선했습니다.
- 프로젝트의 `notion-research.md`, `notion-spec.md`는 실제 Notion 조회로 확보한 읽기 전용 참고 스냅샷입니다. 원본 Notion은 수정하지 않습니다.
- 이후 사용자의 지도 첫 화면·네이버 지도·QR 퀴즈·사진 수집·설치형 앱 요구를 현재 UI와 기술 구조에 우선 적용했습니다. 2026-10-23부터 개발·검증·배포 대상은 iPhone(iOS)만이며 Android는 이전 작업 이력입니다. Notion의 기존 4메뉴와 이전 웹 V1의 화면을 현재 구조로 설명하지 않습니다.
- 이후 지도 가로·세로를 화면 전체에 채우라는 요청을 반영해 네이티브 지도 위에 투명 WebView의 검색·카드·메뉴를 배치했습니다. 시뮬레이터에서 실제 타일·3개 마커의 전체 화면 표시와 컨트롤 배치를 확인했습니다. [최종 전체 화면 캡처](ios-fullscreen-map.png)는 실제 앱 실행 화면이며 실물 iPhone 사진은 아닙니다. 관광 설명·공식 대표 좌표·사진 출처는 유지하며, 레이아웃의 터치 검증과 지도 연결 성공은 구분합니다.

## 공식 관광·서비스 자료

| 자료 | 앱에서 사용한 범위 | 확인 결과 |
| --- | --- | --- |
| [울산시 반구천 일원](https://ulsan.go.kr/s/bangucheonpetroglyphs/contents.ulsan?mId=001001004000000000) | 집청정·반구서원·모은정·유허비·연로 개수기·습지·두 공룡발자국의 짧은 소개 | 본문 확인. 10월 23일 공식 분포도와 국가유산포털·공개 지도 대조 추가 |
| [대곡리 반구대 암각화](https://www.ulsan.go.kr/s/bangucheonpetroglyphs/contents.ulsan?mId=001001002000000000) | 동물·고래의 형태 관찰, 미션의 근거 | 본문 확인 |
| [천전리 명문과 암각화](https://www.ulsan.go.kr/s/bangucheonpetroglyphs/contents.ulsan?mId=001001003000000000) | 시대가 다른 그림·문자의 구분 | 직접 열기 시 간헐적 타임아웃; 공식 URL의 검색 도구 본문으로 확인 |
| [암각화박물관 상설전시](https://www.ulsan.go.kr/s/bangudae/contents.ulsan?mId=001002001000000000) | 두 유산 모형, 암각화·암채화의 구분 | 직접 열기 시 간헐적 타임아웃; 공식 URL의 검색 도구 본문으로 확인 |
| [암각화박물관](https://www.ulsan.go.kr/s/bangudae/main.ulsan) | 공식 관람·공지로 연결 | 본문과 메뉴 확인. 고정 운영시간은 앱에 복제하지 않음 |
| [암각화박물관 교육신청](https://www.ulsan.go.kr/s/bangudae/bbs/list.ulsan?bbsId=BBS_0000000000000095&mId=001003006000000000) | 공식 모집·신청 안내 | 공식 홈페이지 교육신청 메뉴에서 링크 확인 |
| [울산시 QR 해설서비스 보도자료](https://www.ulsan.go.kr/u/rep/bbs/view.ulsan?bbsId=BBS_0000000000000027&dataId=182222&mId=001004003001000000) | 현장 QR 서비스 소개로 연결 | 2026-07-06 발표 본문 확인. 개별 QR 해설 주소는 미확인 |
| [울산시 세계유산 관람 환경 개선 보도자료](https://www.ulsan.go.kr/u/rep/bbs/view.do?bbsId=BBS_0000000000000027&dataId=182270&mId=001004003001000000) | XR 망원경 **도입 안내** | 공식 도입 계획 확인. 당일 운영·예약 정보로 표현하지 않음 |
| [울산문화관광재단 순환버스](https://uctf.or.kr/business/tour-mice/smart08) | 주차장 탑승 위치·정류장·시간표의 원본 링크 | 현행 공식 안내 본문 확인. 운행시간표는 복제하지 않음 |
| [울산대곡박물관](https://www.ulsan.go.kr/s/dgmuseum/main.ulsan) | 확장 장소와 공식 안내 | 본문 확인 |
| [울주군 웹진](https://ulju.wzp.kr/202508/2) | 대곡박물관의 지역 역사 소개 | 본문 확인 |
| [울주군 반구대 소개](https://www.ulju.ulsan.kr/bulgogi/contents.do?mId=0406000000) | 포은대 명칭과 정몽주 관련 배경 | 본문 확인. 오래된 안내의 주소·운영정보는 채택하지 않음 |

Notion에 기록된 박물관 셔틀 공지 `dataId=57632`는 이번 검증에서 타임아웃/캐시 미스로 본문을 확인하지 못했습니다. 앱에서는 본문이 확인된 울산문화관광재단 안내로 대체했습니다. 운영기관 웹사이트 역시 일시적인 장애나 주소 변경이 있을 수 있어 영구적 접근을 보장하지는 않습니다.

## 사진 자산

아래 세 파일은 Wikimedia Commons의 개별 파일 페이지에서 저작자, 출처, CC BY-SA 3.0 허가를 확인한 뒤 원본을 다운로드했습니다. 사진은 촬영 당시 모습으로 현재 시설·수위·접근 상태를 보증하지 않습니다. 파일 자체는 수정하지 않았으며 카드에서 CSS로 잘라 표시될 수 있습니다. 그 표시를 포함한 사진의 파생 표현에도 동일한 [CC BY-SA 3.0 라이선스](https://creativecommons.org/licenses/by-sa/3.0/)를 적용합니다. 앱 코드 전체의 라이선스와는 별개입니다.

| 로컬 파일 | 작품·저작자·촬영일 | 원본 및 라이선스 |
| --- | --- | --- |
| `public/images/bangudae.jpg` | Bangudae2.jpg — Ulsan Petroglyph Museum (Rockcare), 2013-11-08 | [파일 출처](https://commons.wikimedia.org/wiki/File:Bangudae2.jpg) · [원본](https://upload.wikimedia.org/wikipedia/commons/0/03/Bangudae2.jpg) · [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `public/images/museum.jpg` | Ulsan Petroglyph Museum5.jpg — Ulsan Petroglyph Museum (Rockcare), 2013-10-03 | [파일 출처](https://commons.wikimedia.org/wiki/File:Ulsan_Petroglyph_Museum5.jpg) · [원본](https://upload.wikimedia.org/wikipedia/commons/3/38/Ulsan_Petroglyph_Museum5.jpg) · [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `public/images/petroglyphs.jpg` | Bangudae3.jpg — Ulsan Petroglyph Museum (Rockcare), 2010-12-14 | [파일 출처](https://commons.wikimedia.org/wiki/File:Bangudae3.jpg) · [원본](https://upload.wikimedia.org/wikipedia/commons/6/6c/Bangudae3.jpg) · [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |

앱에 표시할 저작자 문구: **사진: 울산암각화박물관 / Wikimedia Commons · CC BY-SA 3.0 · 화면에 맞게 잘라 표시**. 이용자가 접근할 수 있는 출처·라이선스 링크를 함께 표시합니다. 기관이 이 앱을 보증한다는 의미는 없습니다.

`public/images/landscape.svg`는 앱이 자체 제작한 설명용 일러스트입니다. 사진이 없는 장소에서 사용하며 실제 현장 사진으로 표시하지 않습니다. 네이버 지도 연결 전의 대체 지도 이미지로 사용하지 않습니다. [울산시 사진자료](https://ulsan.go.kr/s/bangucheonpetroglyphs/bbs/list.ulsan?bbsId=BBS_0000000000000381&mId=001004004000000000)는 공공누리 제4유형 조건을 확인했으나 이 앱의 자산에는 포함하지 않았습니다.

## 지도 대표 위치와 관람 좌표

2026-10-23 사용자 제공 A/B 코스 조사표에 따라 `src/data/exploration.ts`에 13개 지도 대표점을 등록했습니다. 지도 핀은 국가유산포털 대표점 4곳, 울산관광 박물관 1곳, 공개 지도 POI 4곳, 공식 위성 분포도와 기준점을 대조한 근사 위치 4곳을 구분합니다. 근사 위치는 확인된 관람 좌표가 아닙니다.

종전 반구대 `35.60827, 129.175561`과 천전리 `35.615443, 129.172777` 관광 좌표는 유산 위치와 맞지 않아 제거했습니다. 반구대 유산 대표점은 [국가유산포털](https://www.heritage.go.kr/heri/cul/culSelectDetail.do?ccbaCpno=1112602850000)의 `35.6038151324587, 129.177842844766`으로 교정했으며, 조망 공간 일대의 근사 지도 핀 `35.60446, 129.17757`과 분리합니다. 안전 관람 위치 `viewingPosition`은 계속 `null`이고 외부 지도에는 장소명 검색만 연결합니다.

13곳의 정확한 원본 링크·좌표 의미·근사 산출식·QR 11곳 확인 수준은 [지도·QR 근거](exploration-evidence.md)에 기록했습니다. A 10곳/B 3곳의 점선은 **방문 순서 연결선**이며 검증된 도보 경로가 아닙니다. 아래 SDK 검증 문단은 3개 마커였던 당시 이력이며 새 13개 마커의 실행 검증과 구분합니다.

2026-10-23 제공받은 Client ID로 브라우저의 실제 네이버 지도 타일 표시를 확인했습니다. 기존 iOS WebView의 HTTP 하위 요청이 ATS에 차단된 `-1022` 오류를 해결하기 위해 공식 iOS 네이티브 SDK **NMapsMap 3.24.0**으로 전환했습니다. iPhone 17 Pro / iOS 26.5 시뮬레이터 앱의 인증·실제 타일·공식 대표 마커 3개·유산 위치 보조 설명·축소 동작을 확인했습니다. 마커 터치 → 미션·모달 흐름과 실제 기기 GPS·카메라는 추가 검증 대상입니다. 연결 구조와 공식 기술 근거는 [map-setup.md](map-setup.md)를 참고하세요.

## 앱 발급 QR와 사진 미션

`src/data/game-missions.ts`의 장소 퀴즈는 13곳으로 확장하며 기존 6개 코드·기록을 유지합니다. 관광 설명과 사용자 제공 조사표를 근거로 질문을 구성합니다. 짧은 코드와 `bangucheon://quiz/v1/...` 페이로드는 이 앱이 만든 **체험·운영자 배포용 식별자**입니다. 울산시의 공식 관광 QR 주소나 현장에 설치된 코드라고 주장하지 않습니다. 공식 현장 QR 해설의 실제 딥링크는 여전히 추가 확인 대상입니다.

사진 관찰 3개는 이용자가 촬영한 사진, 선택한 관찰 대상과 메모를 저장하는 앱 자체 미션입니다. 고래·사슴 등을 자동 인식하거나 XR·망원경 사용·현장 방문을 인증하지 않습니다. XP·레벨·디지털 보상은 앱 내 규칙이며 기관 공인 보상이나 실물 보상이 아닙니다. 상세 코드·검증·보상 규칙은 [qr-missions.md](qr-missions.md)에 있습니다.

## 네이티브 구현 근거

카메라·QR·위치·파일·공유는 Capacitor의 공식 플러그인을 사용합니다. 브라우저 지도는 네이버 JavaScript SDK, iOS 지도는 공식 [`navermaps/SPM-NMapsMap`](https://github.com/navermaps/SPM-NMapsMap)의 NMapsMap 3.24.0을 사용합니다. 실제 네이티브 프로젝트와 공식 문서는 [mobile-app.md](mobile-app.md)에 정리했습니다. 빌드·브라우저·시뮬레이터·실제 기기·스토어 결과는 [implementation-status.md](implementation-status.md)에서 각각 구분합니다.
