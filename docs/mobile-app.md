# iPhone 앱

2026-10-23 사용자 요청에 따라 현재 개발·검증·배포 대상은 **iPhone(iOS)만**입니다. Android 프로젝트와 관련 설명은 이전 구현 기록으로 보관합니다. 현재 작업을 위해 Android 도구를 설치하거나 APK를 빌드할 필요는 없습니다.

이 프로젝트는 Capacitor 8 네이티브 프로젝트를 포함합니다. `out`의 정적 앱 자산을 앱 안에 복사하며 원격 사이트 URL을 앱의 시작 화면으로 열지 않습니다. 네이버 지도 타일과 외부 관광 안내에는 인터넷 연결이 필요합니다.

## 현재 여정 기능 — 2026-10-24

지도와 기존 미션·보상을 유지하고 **오늘의 여정**을 날짜별 자동 기록으로 바꿨습니다. 수집함의 사진 발견·여행 메모 목록은 여정 요약으로 교체했고 기존 장소 데이터는 보존합니다. **자동 경로 기록**을 한 번 켜면 한국 날짜(Asia/Seoul)별로 이동을 저장하며 매번 시작·종료하지 않습니다. 끄면 위치 수집만 멈추고 이력은 남습니다. 이전 수동 여정은 기존 방식으로 보관합니다.

- 앱 밖 기록에는 별도 **백그라운드 위치 허용**으로 Always 접근을 요청합니다. 정확한 경로에는 정확한 위치가 필요합니다. 자동 설정은 권한 상태와 구분해 저장하며 처음부터 켜져 있지 않습니다.
- 네이티브 기록 서비스는 AppDelegate에서 복원되어 WebView 없이도 버퍼를 저장합니다. 실제 위치 추적과 저전력 significant-change 복구 신호를 구분합니다. 시스템 종료 뒤 복구를 시도하지만 사용자 강제 종료 뒤 자동 재실행은 보장하지 않습니다.
- 실선·사진 핀은 A/B 점선·장소 묶음과 분리합니다. 120초 초과 공백을 잇지 않고, 위치 없는 사진은 앨범·영상에만 넣습니다. 여정·사진 미션 모두 촬영 전에 대상 기록 ID를 고정합니다.
- **지금까지 영상 만들기 · MP4**는 자동 기록을 계속하면서 사본을 렌더링합니다. H.264·720×1280·24fps·20~45초·무음·사진 최대 60장입니다. 공식 스냅샷은 네이버 로고·출처를 포함한 전체 이미지를 사용하고, 실패하면 기록 좌표 그림이라는 설명을 넣습니다.
- **사진 앱에 동영상 저장**은 Photos 추가 권한을 요청합니다. **파일로 저장 · 공유**는 OS 공유 화면입니다. 앱 영상 캐시는 여정 삭제에 포함하지만 외부로 내보낸 복사본은 삭제하지 않습니다.

여정 DB는 `bangucheon-journeys`, 네이티브 버퍼는 `Application Support/JourneyNative/tracking.json`, 영상 캐시는 `Caches/JourneyVideos`입니다. 현재·지난 날짜 버퍼를 DB에 함께 커밋한 뒤 지난 네이티브 버퍼를 정리합니다. 좌표·사진을 앱 자체 서버에 업로드하지 않습니다. [자동 기록 API·사용법·복구·제한](journeys.md)을 참고하세요.

**자동 기록 변경 후 검증:** Node 테스트 107개, Swift XCTest 15개, 타입·린트·프로덕션 빌드가 통과했습니다. 390×844 브라우저에서 자동 기록 설정·소개·스위치·날짜별 이력, 브라우저의 비활성 스위치와 GPS 권한 요청 없음을 확인했습니다. 최신 iOS 동기화·Xcode 빌드·업데이트 설치·실행이 통과했습니다. 실제 네이버 지도 13곳(12곳 묶음+1곳), 자동 기록 설정 버튼·오른쪽 버튼 3개·기존 스탬프 1개와 이전 수동 기록 보존을 확인했습니다. [자동 기록 iOS 캡처](ios-automatic-overview.png)와 [브라우저 설정 캡처](automatic-recording-preview.png)를 참고하세요. 브라우저 가로 넘침·콘솔 경고/오류는 없었습니다. 네이티브 좌표 터치는 `noWindowsAvailable`로 실패해 실제 권한 토글·기록 전체 흐름을 검증한 것으로 보지 않습니다. 실제 iPhone에서 Always 요청, 잠금·배터리·날짜 변경·강제 종료 뒤 복귀·카메라·Photos 권한은 미검증입니다.

### 이전 검증 — 같은 날의 수동 기록 버전

2026-10-24 복구·사진 재시도·지도 보정 후 **Node 테스트 89개, Swift XCTest 7개, 타입·린트 검사**가 통과했습니다. XCTest는 실제 H.264 MP4·크기·길이·사진 픽셀·GPS 공백·스냅샷 하단·자체 영상 캐시 삭제 등을 검사합니다. 마지막 버튼 배치까지 정적 빌드·iOS 동기화·Xcode 빌드·업데이트 설치·실행을 마쳤고 실제 네이버 지도·13곳 표시(12곳 묶음과 1곳)·여정 바 아래 오른쪽 버튼 3개·기존 스탬프 1개를 확인했습니다. [최종 iOS 시뮬레이터 캡처](ios-journey-overview.png)는 790×1720 실행 화면이며 실제 iPhone 촬영 이미지가 아닙니다.

390px 브라우저에서 수집함의 기존 두 목록을 오늘의 여정으로 바꾼 화면과 여정 소개·이력·가로 넘침 없음을 확인했습니다. [소개 캡처](journey-intro-preview.png)를 참고하세요. localhost:3001의 네이버 인증 거부도 앱 전체 오류 대신 연결 안내로 처리했습니다. 네이티브 좌표 터치는 `noWindowsAvailable`로 실패하여 버튼 전체 흐름은 미확인입니다. 실제 iPhone의 보행·잠금 GPS, 카메라·Photos 권한·파일 공유 화면도 아직 미검증입니다. [구현 현황](implementation-status.md)에 환경을 구분합니다.

## 유지하는 관광·미션 사양 — 2026-10-23 구현

기본 지도는 출처 있는 13개 관광지를 모두 표시하고 화면 범위를 자동으로 맞춥니다. A 코스 10곳/B 코스 3곳을 선택하면 방문 순서 번호와 점선을 표시하고 코스 범위를 맞춥니다. 점선은 실제 도보 경로가 아닙니다. 4개 근사 위치와 현장 QR 상태(사진 확인1·위치/설치 미확인10·조사표 미대상2)를 구분합니다.

13개 장소 퀴즈와 3개 사진 미션을 모두 완료하면 1,400 XP·스탬프13·카드13입니다. 현장 QR 원본 URL이 없어도 장소를 선택해 해설을 스스로 확인하고 퀴즈를 열 수 있습니다. 앱 체험용 QR 13개는 별도 선택 기능입니다. 기존 6개 퀴즈·3개 사진 미션 ID, 앱 origin, 두 IndexedDB를 유지합니다.

**이전 검증 — 2026-10-23:** 클러스터를 포함한 소스의 55개 테스트·타입·린트·차이 형식 검사·프로덕션 빌드·iOS 동기화·Xcode 빌드·업데이트 설치가 통과했습니다. iPhone 17 Pro / iOS 26.5 시뮬레이터에서 13곳의 지도 범위, 9곳·2곳 묶음 마커, 교정된 반구대 위치와 기존 수집 1개 유지를 확인했습니다. [당시 지도 캡처](ios-ab-overview.png)는 시뮬레이터 실행 화면입니다.

A 코스 선택·점선 표시는 클러스터 추가 전 빌드에서 확인했습니다. 최신 네이티브 B 코스와 묶음 마커 터치는 컴퓨터 제어의 `noWindowsAvailable` 오류로 미확인입니다. 브라우저에서는 B 3곳·번호 1~3·점선 안내, QR 대상 11곳·상태, 집청정 관찰 단계·보상 안내·해설 체크에 따른 버튼 활성화를 확인했습니다. 물리적인 iPhone의 카메라·QR·GPS와 현장 검증으로 확대 해석하지 않습니다. [최신 검증 현황](implementation-status.md)에 환경을 구분하며, 아래 3개 마커 캡처와 테스트 수는 과거 이력입니다.

## 과거 기록: 화면 전체 지도 변경 — 2026-10-23, 13곳 확장 전

사용자의 가로·세로 전체 지도 요청에 따라 네이티브 `NMFMapView`를 투명 `WKWebView` 아래에 배치합니다. 웹 UI는 간결한 상단 검색·필터와 하단 카드·메뉴로 지도 위에 표시합니다. 웹 컨트롤의 터치는 WebView가 받고, 그 밖의 터치는 네이티브 지도로 전달합니다. 모달·패널·입력 중에는 지도 배경을 유지하면서 지도 조작을 막습니다.

이 레이아웃의 **44개 테스트·타입·린트·Next.js 빌드·iOS 동기화·Xcode 빌드·시뮬레이터 설치가 통과**했습니다. 최종 배치 수정 후 Swift 빌드·업데이트 설치를 완료했고 iPhone 17 Pro / iOS 26.5에서 상태 표시줄 뒤부터 하단 끝까지 실제 지도 타일·3개 마커가 채워지는 것을 확인했습니다. 검색·필터·미션·하단 카드·탭이 지도 위에 표시되고, 확대축소 버튼은 사진 미션과 분리해 왼쪽에 배치했습니다. 네이버 로고와 축척도 겹치지 않습니다. [최종 전체 화면 지도 캡처](ios-fullscreen-map.png)는 시뮬레이터의 실제 실행 화면이며 실제 iPhone 사진은 아닙니다.

좌표 터치 도구의 `noWindowsAvailable` 오류는 재설정 후에도 발생해 지도 드래그·웹 UI 터치·마커 → 미션 흐름의 검증은 완료하지 못했습니다. 아래는 변경 전 SDK 연결 결과입니다.

## 과거 기록: 지도 SDK 연결 — 2026-10-23, 전체 화면 변경 전

제공받은 네이버 Maps Client ID를 Git 제외 `.env.local`에 적용했고 브라우저에서 실제 지도 타일 표시를 확인했습니다. Ncloud에는 Dynamic Map, 개발용 Web 서비스 URL 두 개와 iOS Bundle ID `kr.bangucheon.passport`가 등록되어 있습니다. 키 값은 문서나 로그에 기록하지 않습니다.

기존 iOS WebView의 JavaScript 지도 SDK는 `capacitor://` 환경에서 HTTP 하위 요청을 선택해 ATS의 `-1022` 오류로 차단됐습니다. **공식 iOS NMapsMap 3.24.0 SDK를 Swift Package Manager와 Capacitor 브리지로 통합**했고, iPhone 17 Pro / iOS 26.5 시뮬레이터에서 인증·실제 도로와 하천 타일·당시 대표 마커 3개·유산 위치 보조 설명을 확인했습니다. SDK 축소 버튼으로 축척 200m → 500m 변경도 확인했습니다. `capacitor://` Web 서비스 URL을 추가 저장하거나 ATS를 완화하지 않았습니다. [네이버 지도 설정](map-setup.md)에 환경별 구조를 정리했습니다.

당시 통합 소스의 **43개 테스트·타입·린트·Next.js 정적 빌드·iOS 동기화·Xcode 빌드가 통과**했습니다. 초기 줌 13.5 조정까지 포함한 앱을 설치·실행해 타일과 3개 마커 표시를 확인했습니다. 앱 origin·기존 저장소를 유지했고 수집 배지 1개가 남아 있습니다. [SDK 연결 당시 지도 캡처](ios-naver-map.png)는 전체 화면 변경 전 Device Hub 시뮬레이터 화면이며 실제 iPhone 사진이 아닙니다.

당시 좌표 터치 도구의 `noWindowsAvailable` 오류로 마커 터치 → 미션·모달 흐름 검증은 미완료입니다. 새 구조의 지도·웹 UI 터치 분리와 모달 중 지도 상호작용 차단을 별도로 확인해야 합니다. 실제 iPhone 카메라·QR 스캔·GPS·OS 공유와 반복 재실행도 추가 검증 대상입니다.

## 이전 앱 검증 — 2026-10-22

아래 결과는 지도 키 적용 전 앱의 기록이며, 새 네이티브 지도 SDK의 성공을 의미하지 않습니다.

- iOS: 당시 지도·게임 UI와 플러그인 6개를 포함한 시뮬레이터용 앱을 Xcode 27.1에서 빌드했고(`BUILD SUCCEEDED`), iOS 26.5의 iPhone 17 Pro 시뮬레이터에 설치했습니다. Device Hub에서 앱 아이콘으로 실행해 지도 메인 화면이 표시되는 것을 확인했습니다. 앱 홈화면 표시명은 **반구천 탐험지도**입니다.
- Android 이전 이력: 패키지 `kr.bangucheon.passport`, Android 8.0(API 26) 이상, target/compile SDK 36으로 프로젝트를 생성했습니다. Java·Android SDK·Android Studio 부재로 APK 빌드는 수행하지 않았습니다. 현재 작업에서는 변경·검증하지 않습니다.
- 카메라 촬영·QR 스캔·현재 위치·파일 내보내기에 공식 Capacitor 플러그인을 연결했습니다. 실제 휴대폰 카메라, 현장 QR, GPS, 지도 인증 성공은 실제 기기에서 별도로 검증해야 합니다.
- 당시 `out/index.html`, 두 플랫폼에 복사한 번들, iOS `.app` 내부 파일의 SHA-256이 동일함을 확인했습니다. 네이티브 설정에 원격 시작 URL은 없습니다.
- Apple 개발자 계정·서명·프로비저닝은 설정하지 않았습니다. iOS 시뮬레이터 앱은 iPhone에 설치하는 IPA가 아닙니다. Google Play 배포는 현재 범위 밖입니다.

## 준비와 동기화

설치된 **Node.js 24 LTS와 pnpm 12.15.0**을 기준으로 합니다. 저장소의 `packageManager`도 `pnpm@12.15.0`입니다. Node·pnpm이 PATH에서 실행되어야 합니다.

```bash
pnpm install --frozen-lockfile
cp -n .env.example .env.local
# 새 환경에서만 .env.local에 네이버 Maps Client ID 입력
pnpm mobile:sync
```

현재 작업 폴더의 `.env.local`에는 제공받은 ID가 이미 설정되어 있으므로 덮어쓰지 않습니다. 공개 Client ID는 빌드된 앱에 포함되며 Client Secret은 사용하지 않습니다.

`mobile:sync`는 `mobile:sync:ios`를 실행하며 **Next.js 정적 빌드 후 iOS에만** 최신 자산과 플러그인을 복사합니다. `pnpm build` → `pnpm exec cap sync ios`와 같습니다. 화면·콘텐츠·환경변수를 수정한 뒤 앱을 다시 빌드하기 전에 실행하세요. 다른 환경에서 ID가 없으면 지도 연결 안내를 표시하며 장소·미션·기록은 이용할 수 있습니다.

## iPhone

Xcode 26 이상이 필요합니다. Swift Package Manager를 사용하므로 CocoaPods 설치는 필요하지 않습니다.

```bash
pnpm mobile:ios
```

Xcode에서 `App` scheme과 연결한 iPhone 또는 iPhone 시뮬레이터를 선택하고 Run을 누릅니다. 실제 iPhone에는 본인의 Apple 개발 팀 선택·서명과 기기의 개발자 모드가 필요합니다. 이 프로젝트는 개발 팀을 임의로 지정하지 않습니다. 앱 ID는 `kr.bangucheon.passport`이며 공개 배포 전 소유한 식별자로 확정하세요.

명령행에서 실행하려면 iOS 동기화 후 `pnpm exec cap run ios`로 대상을 선택합니다. Bundle ID를 변경하면 Ncloud의 iOS 서비스 환경도 동일하게 변경해야 합니다.

### 네이버 네이티브 지도 구성

공식 [`navermaps/SPM-NMapsMap`](https://github.com/navermaps/SPM-NMapsMap)의 **3.24.0**을 정확한 버전으로 지정했으며 `NMapsGeometry` **1.0.2**가 함께 해석됐습니다. 의존성은 앱 수준 Xcode 프로젝트에 등록해 `cap sync ios`가 생성하는 `CapApp-SPM`을 직접 수정하지 않습니다. SDK 바이너리는 Swift Package Manager가 내려받아 체크섬을 검증하며 저장소에 복사하지 않습니다.

| 파일 | 역할 |
| --- | --- |
| `ios/App/App.xcodeproj/project.pbxproj` | 앱 대상의 공식 NMapsMap Swift Package 의존성 |
| `ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` | 해석된 SDK 버전 고정 |
| `ios/App/App/NaverNativeMapPlugin.swift` | 공식 `NMFNaverMapView` 안의 전체 화면 지도·번호/QR 마커·A/B 점선·여정 실선/사진·공식 스냅샷·인증·터치 여백 |
| `ios/App/App/MainViewController.swift` | 투명 `MapOverlayWebView` 생성·`hitTest` 터치 분리·지도와 여정 플러그인 등록 |
| `ios/App/App/SceneDelegate.swift`, `Base.lproj/Main.storyboard` | 앱의 한 WebView와 지도 브리지를 초기화하는 화면 진입점 |
| `src/lib/native-naver-map.ts` | TypeScript 브리지·호출 순서·터치 여백·`captureJourneyMapSnapshot`의 이미지/정규화 좌표 반환 |
| `src/components/native-tourism-map.tsx` | 13곳/코스 화면 맞춤·장소/사진 선택·GPS·점선·여정 레이어·화면 전환 |
| `ios/App/App/JourneyTrackingService.swift`, `AppDelegate.swift` | 자동 날짜별 Core Location·절전·권한·독립 복원·디스크 버퍼 |
| `ios/App/App/JourneyNativePlugin.swift` | 기록 서비스의 Capacitor 연결·MP4·Photos 저장·자체 영상 캐시 삭제 |
| `src/lib/native-journey.ts`, `use-journey.ts`, `journey-video.ts` | 추적 브리지·저장 복구·영상 입력/지도 캡처·공유 |

공개 Client ID는 웹 번들의 설정에서 `create({ clientId, ... })`로 전달합니다. Swift는 신규 Maps 인증용 `NMFNcpKeyClient(ncpKeyId: clientId, beta: false)`를 사용합니다. Client Secret이나 실제 ID를 Swift 소스·Info.plist에 하드코딩하지 않습니다. Naver 로고·저작권 컨트롤은 SDK가 제공하는 표시를 유지하며, 지도 **내 위치**는 버튼에서 한 번 읽고, 자동 여정은 별도로 켠 설정과 위치 권한에 따라 기록합니다.

과거 SDK 연결 당시 인증·타일·3개 마커·축소를 확인했고, 이전 전체 화면 배경과 투명 WebView 통합의 빌드·설치·화면 채움·컨트롤 배치도 확인했습니다. 최신 13곳 확장 실행 검증과 구분합니다. 지도·웹 UI 터치 검증의 남은 범위는 [구현 현황](implementation-status.md)을 따릅니다.

이 작업 환경의 **Xcode 27.1**에서는 시뮬레이터 화면을 **Device Hub**에서 엽니다. 확인한 앱 경로는 `/Applications/Xcode.app/Contents/Applications/DeviceHub.app`이고, 앱 식별자는 `com.apple.dt.Devices`입니다. Device Hub에서 iOS 26.5의 iPhone 17 Pro를 선택하고 홈 화면의 **반구천 탐험지도** 아이콘을 누릅니다. 예전 Xcode에서 사용한 `Contents/Developer/Applications/Simulator.app` 경로는 이 설치에 존재하지 않습니다.

시뮬레이터용 명령행 빌드:

```bash
pnpm mobile:ios:build
```

결과: `.native-build/ios/Build/Products/Debug-iphonesimulator/App.app`

시뮬레이터에는 실제 카메라가 없습니다. QR 스캔·암각화 촬영 미션은 iPhone에서 확인해야 합니다. 사진을 저장했다고 그림의 종류가 자동 인식·검증되는 것은 아닙니다.

10월 22일 검증 중 최초 진입에 검은 화면을 한 번 관찰했으며, 홈 화면으로 돌아갔다 앱을 다시 열자 정상 표시됐습니다. 원인은 확정하지 않았고 이번 ATS 지도 오류와 같은 원인이라고 단정하지 않습니다. 당시 로컬 웹 서버를 중지하고 앱을 완전히 종료한 뒤 홈 화면 아이콘으로 다시 실행하자 지도 메인이 즉시 표시됐습니다. 80 XP·스탬프 1개·완료 미션 1개·수집 카드 1개도 유지돼, 번들 앱의 독립 실행과 종료 후 기록 보존을 확인했습니다. 새 지도 SDK와 실제 기기에서의 반복 재실행 검증은 별도로 필요합니다.

## Android 이전 구현 기록 — 현재 작업 제외

아래는 기존 프로젝트를 나중에 다시 사용할 때의 참고입니다. 현재 iPhone 작업에서는 Android 도구 설치·동기화·빌드를 수행하지 않습니다.

[Android Studio](https://developer.android.com/studio)와 JDK 21, Android SDK Platform 36·Build Tools·Platform Tools를 준비하세요. SDK 다운로드에 필요한 이용약관은 설치자가 검토하고 동의해야 합니다. 이 작업에서는 동의를 대행하지 않았습니다.

```bash
pnpm mobile:android
```

Android Studio에서 SDK를 설정하고 기기 또는 에뮬레이터를 선택한 뒤 Run을 누릅니다. SDK 경로를 인식하지 못하면 로컬 `android/local.properties`에 `sdk.dir`을 설정합니다. 이 파일은 Git에서 제외됩니다.

```bash
pnpm mobile:android:build
```

성공 시 결과: `android/app/build/outputs/apk/debug/app-debug.apk`. 개발용 APK이며 Google Play 업로드용 서명 AAB와는 다릅니다. Gradle Wrapper 8.14.3과 Android Gradle Plugin 8.13.0을 사용합니다.

## 권한과 데이터

- QR 버튼·사진 촬영 버튼을 눌렀을 때만 카메라를 엽니다. 앱 시작 시 카메라 권한을 요청하지 않습니다.
- **내 위치**는 버튼을 누를 때 한 번 읽습니다. **자동 경로 기록**은 사용자가 한 번 켠 뒤 권한·시스템 상태에 따라 이어지며 끄면 중단합니다. 처음 앱 실행 때 위치 권한을 요청하지 않습니다. 켬 설정이 있으면 앱 시작 때 서비스를 복원하며, When In Use와 Always 접근의 차이를 안내합니다.
- 기존 Android 구현에는 열린 미션·패널을 먼저 닫는 시스템 뒤로가기 처리가 있습니다. 현재 iPhone 검증 대상은 아닙니다.
- 카메라 사진은 최대 1600px로 받아 앱의 로컬 기록에 저장합니다. 위치가 확인되지 않으면 좌표 없이 보관합니다. 사진 보관함에 자동 저장하거나 앱 자체 서버로 업로드하지 않습니다. MP4를 사진 앱에 넣는 것은 별도 저장 버튼과 Photos 권한으로 처리합니다.
- 기록 내보내기는 휴대폰의 공유 시트를 엽니다. 공유 대상을 사용자가 선택하며, 공유 종료 뒤 임시 JSON 파일은 삭제를 시도합니다. 외부에 저장한 파일은 앱 기록 삭제와 별개입니다.
- 앱 삭제·앱 데이터 초기화 시 해당 앱에 저장한 탐험 기록이 사라집니다. 계정 동기화는 없습니다.
- iOS 카메라·사진·When In Use/Always 위치 설명, `UIBackgroundModes`의 위치 업데이트, Filesystem 파일 타임스탬프 사용 이유를 네이티브 프로젝트에 포함했습니다. 실제 기기에서 잠금·권한 거부·재개·저장 실패를 확인해야 하며 스토어 제출 전 실제 데이터 처리와 SDK 설정을 기준으로 개인정보 고지를 최종 검토해야 합니다.

## 공식 기술 근거

- [Capacitor 설치 환경](https://capacitorjs.com/docs/getting-started/environment-setup)
- [iOS Swift Package Manager](https://capacitorjs.com/docs/ios/spm)
- [Naver Maps 공식 Swift Package](https://github.com/navermaps/SPM-NMapsMap), [지도 생성](https://navermaps.github.io/ios-map-sdk/guide-ko/2-1.html), [NMFAuthManager 인증](https://navermaps.github.io/ios-map-sdk/reference/Classes/NMFAuthManager.html)
- [Camera](https://capacitorjs.com/docs/apis/camera), [Barcode Scanner](https://capacitorjs.com/docs/apis/barcode-scanner), [Geolocation](https://capacitorjs.com/docs/apis/geolocation)
- [Filesystem](https://capacitorjs.com/docs/apis/filesystem), [Share](https://capacitorjs.com/docs/apis/share)
- [App: Android 뒤로가기](https://capacitorjs.com/docs/apis/app)

자동 위치 기록의 운영체제 근거: [Apple 위치 권한](https://developer.apple.com/documentation/corelocation/requesting-authorization-to-use-location-services), [significant-change 감시](https://developer.apple.com/documentation/corelocation/cllocationmanager/startmonitoringsignificantlocationchanges()), [백그라운드·강제 종료 제한](https://developer.apple.com/forums/thread/685525).
