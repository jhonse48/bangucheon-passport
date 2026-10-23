# 네이버 지도 연결과 위치 자료

확인일: 2026-10-23. 현재 개발 대상은 **iPhone(iOS)**입니다. 브라우저 개발 미리보기는 NAVER Cloud Platform의 신규 **Maps / Dynamic Map** JavaScript SDK, iOS는 공식 **NMapsMap 3.24.0 네이티브 SDK**를 사용합니다. 브라우저와 iPhone 17 Pro / iOS 26.5 시뮬레이터 앱에서 실제 지도 타일 표시를 확인했습니다. Client Secret을 사용하는 서버 API나 임의 지도 이미지를 사용하지 않습니다.

제공받은 Client ID는 Git에서 제외된 `.env.local`에 적용했습니다. 키 값은 이 문서·소스·진단 출력에 기록하지 않습니다. 현재 Ncloud에서 확인한 설정은 다음과 같습니다.

| 항목 | 확인한 값 |
| --- | --- |
| 사용 API | Dynamic Map 활성화 |
| 브라우저 개발 주소 | `http://localhost:3000`, `http://127.0.0.1:3000` |
| iOS Bundle ID | `kr.bangucheon.passport` |
| 지도 연결 검증 | 브라우저 타일 표시, iOS 시뮬레이터 앱의 빌드·설치·인증·실제 타일·공식 마커 3개·축소 동작 확인 |
| 새 레이아웃 | 화면 전체 지도·투명 WebView 통합 빌드·설치 성공. 상태 표시줄부터 홈 표시줄까지 실제 타일·3개 마커 표시 확인. 터치 흐름은 미검증 |

`capacitor://` 주소의 콘솔 입력 시험은 취소했으며 외부 설정을 추가 저장하지 않았습니다. 공식 네이티브 SDK를 사용하는 iPhone 앱에는 해당 주소를 Web 서비스 URL로 추가할 필요가 없습니다.

## 새 환경의 Client ID 설정

현재 작업 폴더는 이미 설정되어 있으므로 아래 절차는 새 체크아웃이나 별도 Application을 준비할 때 사용합니다. iOS 네이티브 SDK와 브라우저 JavaScript SDK의 서비스 환경을 구분합니다. Android는 현재 범위에 포함하지 않습니다.

1. [네이버 클라우드 플랫폼](https://www.ncloud.com/)에 가입·로그인하고 콘솔을 엽니다.
2. VPC 환경의 **Application Services → Maps**에서 이용 신청 후 **Application**을 등록합니다.
3. 사용할 API로 **Dynamic Map**을 선택합니다.
4. iPhone 앱의 **iOS Bundle ID**로 `kr.bangucheon.passport`를 등록합니다. Xcode의 앱 식별자를 변경하면 콘솔도 일치시켜야 합니다.
5. 브라우저 개발 미리보기도 사용할 경우 **Web 서비스 URL**에 실제 개발 주소를 등록합니다. `localhost`와 `127.0.0.1`은 서로 구분합니다. 현재 설치형 앱 작업에는 별도 웹 호스팅이 필요하지 않습니다.
6. Application의 **인증 정보**에서 **Client ID**를 복사합니다. Client Secret은 앱에 입력하거나 프런트엔드 코드에 넣지 않습니다.
7. `.env.local` 또는 지도 화면의 **지도 연결 설정**에 Client ID를 입력합니다.

등록 절차와 서비스 URL의 세부 형식은 [공식 Application 안내](https://guide.ncloud-docs.com/docs/application-maps-app-vpc), ID 사용법은 [공식 Client ID 발급 가이드](https://navermaps.github.io/maps.js.ncp/docs/tutorial-1-Getting-Client-ID.html)를 따릅니다. Maps 이용 요금과 사용량 한도는 계정 및 설정에 따라 다르므로 콘솔에서 확인합니다.

화면에서 입력한 ID는 현재 세션의 `sessionStorage`에 저장하며 환경변수보다 우선합니다. 브라우저에서는 이미 로드한 SDK의 키를 변경하면 새로고침해 재인증합니다. 저장이 제한된 환경에서는 현재 화면의 연결만 사용할 수 있습니다.

설치 앱의 빌드용 설정은 프로젝트 루트 `.env.local` 또는 빌드 환경 변수에 둡니다. 기존 파일을 덮어쓰지 않도록 새 환경에서만 `cp -n .env.example .env.local`로 준비합니다.

```dotenv
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=your_maps_client_id
```

공개 Client ID는 Next.js 빌드 때 클라이언트 번들에 들어갑니다. 변경 후 개발 서버를 재시작하거나 앱을 재빌드·동기화해야 합니다. `pnpm mobile:sync`와 `pnpm mobile:sync:ios`는 정적 빌드 후 iOS만 동기화합니다. Client Secret을 이 환경변수에 넣지 않습니다.

## 브라우저 JavaScript SDK

브라우저 SDK URL은 `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=...`입니다. 등록한 Web 서비스 URL에서 실행하며 지도 로더는 실제 SDK 로드 완료 여부를 확인합니다. [공식 JavaScript 시작 안내](https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html)

신규 서비스의 로딩 매개변수는 `ncpKeyId`입니다. 기존 `ncpClientId`, `govClientId`, `finClientId`를 사용하지 않습니다. AI NAVER API 종료를 2026년 6월로 단정하지 않습니다. [공식 일정 변경 공지](https://www.ncloud.com/support/notice/all/2200)는 **2026.06.25 → 2026.11.24**로 안내하고 있습니다.

## iOS 네이티브 지도

기존 iOS 앱은 `capacitor://` WebView 안에서 JavaScript SDK를 실행했습니다. 실제 실행에서 SDK가 HTTP 하위 요청을 선택했고, iOS App Transport Security(ATS)가 이를 차단한 `-1022` 오류를 확인했습니다. 브라우저에서 동일한 Client ID로 타일이 표시되는 것과 iOS WebView에서 실패하는 것은 별개의 실행 환경 결과입니다.

**공식 iOS 네이티브 지도 SDK와 Capacitor 브리지**로 전환해 시뮬레이터에서 지도 인증·표시를 확인했습니다. iOS 지도는 등록된 Bundle ID로 인증하며, 브라우저의 JavaScript SDK 경로는 개발 미리보기용으로 유지합니다. 앱의 UI·미션·기록은 계속 번들에 포함합니다. 기존 origin과 저장소를 변경하지 않았고 SDK 교체 후 수집 배지 1개도 유지됐습니다. ATS 완화나 `capacitor://` Web 서비스 URL 추가는 사용하지 않았습니다. [공식 서비스 환경 등록](https://guide.ncloud-docs.com/docs/application-maps-app-vpc)

공식 [`navermaps/SPM-NMapsMap`](https://github.com/navermaps/SPM-NMapsMap) **3.24.0**과 `NMapsGeometry` **1.0.2**를 사용합니다. React가 런타임에 공개 Client ID를 전달하고 Swift는 `NMFNcpKeyClient(ncpKeyId: clientId, beta: false)`로 신규 Maps 인증을 설정합니다. 최종 정적 자산 동기화와 Xcode 빌드·설치 후 앱에서 실제 도로·하천 타일, 공식 대표 마커 3개와 유산 위치 보조 설명, 축소 버튼으로 축척 200m → 500m 변경을 확인했습니다. 초기 줌 13.5 조정 후 재빌드·설치한 최종 화면에서도 실제 타일과 3개 마커가 표시됐습니다. 파일 경로는 [iPhone 앱 안내](mobile-app.md), 실행 결과는 [구현 현황](implementation-status.md)에 있습니다.

현재 위치는 버튼을 눌렀을 때 `native-device.getCurrentPosition()`을 호출합니다. Capacitor Geolocation이 네이티브/웹 실행 환경을 처리합니다. 위치 권한 거부·시간 초과는 안내 메시지로 표시하고 장소와 미션 UI는 유지합니다. 좌표를 서버 또는 방문 인증에 저장하지 않습니다. 실제 기기의 위치 권한 선언과 런타임 동작을 함께 확인해야 합니다.

## 위치 근거와 마커 의미

`src/lib/naver-map.ts`의 `OFFICIAL_MAP_ANCHORS`는 울산관광 공식 상세 페이지의 **교통안내** 링크를 실제로 열람해 얻은 대표 좌표입니다. 웹 검색 요약이나 추측 좌표를 쓰지 않았습니다. 다음 세 위치를 지도 콘텐츠 선택에 사용합니다.

| 장소 | 위도 / 경도 | 근거 | 지도 표시 |
| --- | --- | --- | --- |
| 울산암각화박물관 | 35.6080854 / 129.170553 | [울산관광 상세](https://www.ulsan.go.kr/tour/korean/unit/attrctn/view.ulsan?mId=001001000000000000&unqId=127) | 시설 대표 위치 |
| 울주 대곡리 반구대 암각화 | 35.60827 / 129.175561 | [울산관광 상세](https://www.ulsan.go.kr/tour/korean/unit/attrctn/view.ulsan?mId=001001000000000000&unqId=100&searchGubun=attrctn) | 유산 대표 위치 |
| 울주 천전리 명문과 암각화 | 35.615443 / 129.172777 | [울산관광 상세](https://www.ulsan.go.kr/tour/korean/unit/attrctn/view.ulsan?mId=001001000000000000&unqId=104) | 유산 대표 위치 |

이 좌표들은 확인된 출입구·안전 관람 지점으로 승격하지 않습니다. 문화유산 마커에는 **유산 위치**를 표시하고 선택 시 **관람 지점 아님**을 안내합니다. 박물관은 **공식 안내 위치**이며 상세 출입구 확인이 필요합니다. 대표 좌표를 직접 길찾기 목적지로 보내지 않고 장소명으로 네이버 지도 검색만 연결합니다. 실제 이동은 지정 관람로와 현장 안내를 따릅니다.

브라우저의 초기 지도 중심은 위 박물관 공식 대표 위치이며, iOS는 표시할 공식 마커 범위의 중심을 계산합니다. `viewingPosition`과 공식 확인 상태·출처가 모두 있는 장소만 **확인된 관람 위치**로 표시할 수 있습니다. 나머지 미확인 장소는 목록/검색에서 접근하며 임의 좌표·임의 코스선을 만들지 않습니다.

## 화면 통합과 검증

사용자의 화면 전체 지도 요청에 맞춰 iOS의 **`NMFMapView`를 투명 `WKWebView` 아래에 배치**합니다. 지도는 화면의 가로·세로를 채우고, 작은 상단 검색·필터와 하단 카드·메뉴는 지도 위에 표시합니다. 최종 시뮬레이터 앱에서 상태 표시줄 뒤부터 하단 끝까지 실제 타일·3개 마커 표시와 오른쪽 빈 띠 제거를 확인했습니다. 확대축소 버튼은 왼쪽에 두어 사진 미션과 분리했고 네이버 로고와 축척도 서로 겹치지 않게 배치했습니다. [최종 전체 화면 지도](ios-fullscreen-map.png)에서 확인할 수 있습니다.

`src/lib/native-naver-map.ts`의 `nativeMapLayout`은 전체 지도 `rect`, 웹 UI가 터치를 받을 `webTouchRects`, 로고·컨트롤 배치를 위한 `contentInsets`를 반환합니다. `MainViewController.swift`의 `MapOverlayWebView.hitTest`는 웹 UI 영역의 터치를 그대로 처리하고, 지도 영역의 나머지 터치를 아래 네이티브 지도로 전달합니다. 측정값이 준비되지 않았을 때는 모든 터치를 WebView가 처리합니다.

미션·모달·패널이 열리거나 입력창을 편집할 때는 `interactionEnabled=false`로 지도 드래그·핀치·마커 반응을 막습니다. 지도는 배경에 유지되며 닫은 뒤 상호작용을 복구합니다. `nativeMapHidden`이라는 기존 React prop 이름은 현재 지도 표시 제거가 아닌 이 상호작용 제어에 사용됩니다. 오류·앱 비활성화 등 별도 상태의 표시 제어는 `setVisible`을 사용합니다.

`TourismMap`은 장소·선택 ID·완료 ID·`onSelect`를 전달받고, 부모는 지도 위의 검색·장소·미션 UI를 구성합니다. 지도 마커의 `onSelect`는 장소를 선택합니다. 해당 터치와 패널 전환은 실제 앱에서 별도 확인합니다.

키가 없으면 중립 배경의 연결 안내를 보여줍니다. 실제 지도처럼 보이는 일러스트나 가짜 지도 타일은 표시하지 않습니다. 네이버 로고와 지도 데이터 저작권 컨트롤을 부모 UI가 가리지 않는지 브라우저·iOS에서 각각 확인합니다. `--map-empty-top`, `--map-controls-top`, `--map-controls-right`, `--map-notice-bottom` CSS 변수는 웹 안내와 버튼 위치를 조절합니다.

전체 화면 변경을 포함해 신규 `ncpKeyId`, 검색어 인코딩, 공식 출처, 대표 위치와 관람 위치 구분, 미검증 좌표 미사용, 지도 로더 회귀와 `nativeMapLayout`을 검사한 **44개 테스트·타입·린트·Next.js 빌드·Xcode 빌드**를 통과했습니다. iOS 동기화·설치 후 화면 전체 타일·마커 표시도 확인했습니다. 상세 결과는 [구현 현황](implementation-status.md)에 기록합니다.

이전 좌표 터치 검사 도구가 `noWindowsAvailable` 오류를 반복해 마커 → 미션·모달 흐름은 끝까지 검증하지 못했습니다. SDK 축소 버튼은 접근성 동작으로 확인했습니다. 새 구조에서 지도 드래그·핀치, 메뉴·카드·마커 터치, 모달 중 지도 상호작용 차단과 닫은 뒤 복구를 검증해야 합니다. 실제 iPhone의 GPS 허용·거부·카메라·QR 스캔과 반복 재실행도 남아 있습니다. [SDK 연결 당시 지도 화면](ios-naver-map.png)은 전체 화면 변경 전의 시뮬레이터 캡처입니다.
