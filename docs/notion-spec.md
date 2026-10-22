기획안

Source: https://app.notion.com/p/4015258dac4681789b7bc9f7b046d7ac?pvs=204
Last edited: 2026-10-22T10:43:25.734Z

Here is the result of "fetch" for the Page with URL https://app.notion.com/p/4015258dac4681789b7bc9f7b046d7ac as of 2026-10-22T10:43:25.734Z:
<page url="https://app.notion.com/p/4015258dac4681789b7bc9f7b046d7ac">
<ancestor-path>
<parent-page url="https://app.notion.com/p/4015258dac46815eb767e8dba878f00e" title="반구천 스마트 관광 통합 앱 개발을 위한 성공 사례 조사"/>
</ancestor-path>
<properties>
{"title":"기획안"}
</properties>
<iconMetadata>null</iconMetadata>
<content>
# 반구천 스마트 관광 통합 앱 — 구체적 개발 기획안

1차 기획안 · 실제 개발 기준

현재 노션에 정리된 성공 사례, 관광 코스 확장안, 기존 디지털 시설 현황을 모두 확인했습니다.

이번 기획에서는 기존의 선사시대 부족 통일 스토리는 사용하지 않습니다. 대신 <b>실제 관광 경험 자체가 하나의 게임처럼 느껴지는 관광 통합 서비스</b>를 개발합니다.

## 1. 앱의 정체성과 개발 목표

<callout color="gray_bg">
가칭

# 반구천 탐험여권

반구천의 역사·자연·문화유산을 발견하고 체험하고 기록하는 스마트 관광 서비스

<b>어디로 갈지</b>

관광 코스 · 위치 · 주차 · 셔틀

<b>무엇을 볼지</b>

관찰 포인트 · 공식 해설 · 역사 정보

<b>어떻게 체험할지</b>

XR 망원경 · 현장 미션 · 교육 체험

<b>무엇을 기록할지</b>

탐방 여권 · 스탬프 · 사진 · 도감
</callout>

### 앱이 해결하려는 문제

반구천에는 이미 울산시가 제공하는 15개 장소의 QR 해설 30개, 박물관, XR 망원경, 셔틀버스 등 다양한 서비스가 있습니다. 하지만 관광객은 각 서비스를 따로 찾아보고, 동선을 계획하고, 정보를 확인해야 합니다.

[상세보기](https://www.ulsan.go.kr/u/rep/bbs/view.ulsan?bbsId=BBS_0000000000000027&dataId=182222&mId=001004003001000000&utm_source=chatgpt.com) [+1](https://m.go.seoul.co.kr/news/publicnews/local_govern/news_local/2026/07/16/20260716022001?utm_source=chatgpt.com)

새로운 앱은 이러한 자원을 한 화면과 하나의 탐방 흐름으로 연결합니다.

<table fit-page-width="true" header-row="true">
<tr>
<td>
기존 관광 방식
</td>
<td>
우리가 개발할 앱
</td>
</tr>
<tr>
<td>
관광지 위치를 따로 검색
</td>
<td>
관광 코스와 지도에서 통합 확인
</td>
</tr>
<tr>
<td>
해설판이 있는지 현장에서 발견
</td>
<td>
방문 전 해설·관찰 지점 미리 안내
</td>
</tr>
<tr>
<td>
망원경을 이용하고 체험 종료
</td>
<td>
망원경 관찰 후 미션·기록으로 연결
</td>
</tr>
<tr>
<td>
여러 관광지를 각각 방문
</td>
<td>
코스 진행률과 탐방 여권으로 연결
</td>
</tr>
<tr>
<td>
관광이 끝나면 기록이 남지 않음
</td>
<td>
개인 탐방 기록·사진·도감 보관
</td>
</tr>
</table>

<b>서비스의 핵심 가치:</b> 관광객이 단순히 길을 찾는 것이 아니라, 원래는 지나쳤을 문화유산을 더 발견하고 이해하도록 돕는 것입니다.

## 2. 기존 관광 코스를 앱 구조로 전환

노션에서 확정한 기획상의 주요 장소는 박물관·암각화·서원·정자·습지·공룡발자국 등 13개 정도의 콘텐츠 지점입니다. 실제 개발에서는 13개를 기본 데이터로 준비하고, 검증된 안전한 관람 위치부터 공개하는 방식을 권장합니다.

![걸어서 만나는 선사시대, 울주 대곡리 반구대 암각화> 여행기사 \| 비대면 안심관광지:대한민국 구석구석](https://images.openai.com/static-rsc-4/nm7gM8oLO5x6_iVNWKTRd8aFBtLG0uO07wq0vnJ4br70DN-bulL0GUlosW2RHUIf4UbEP4RKEJw8kGrr2_ZoIGFZ_83uUYVnxtQu8X_u2uqcw15vuz8PTZPE-lj5vXRgiSjPQvV-AUwqBDYq5fwUUCKIh_3dCbpqvS_3l5z2KMw?purpose=inline)

[사진 출처](https://korean.visitkorea.or.kr/detail/rem_detail.do?cotid=392e3b64-25e5-426a-b633-d93876c4369d&utm_source=chatgpt.com)

<b>A구역 — 반구대 역사·자연 탐방</b>

울산암각화박물관, 집청정, 반구서원, 포은대, 모은정, 반고서원 유허비, 연로 개수기, 동매산 습지, 대곡리 공룡발자국, 반구대 암각화 조망지점

![Petroglyphs of Cheonjeon-ri \[UNESCO World Heritage\] (울주 천전리 명문과 암각화 \[유네스코 세계유산\])-  VISITKOREA](https://images.openai.com/static-rsc-4/kWSzai5z7h20fgG2Pydfks9FnhW-Nrqx8BMV_Un5v3Er8bsBKjiFx-lq9NNEecrXk-ZjpAvyU_jTwl-NAQioW66gv7rBmCbmFD1XrSuxB9IQV4MJLvCACWPca9O4V4taqMHNT-SszwCfB50-iJaiXFTBmWQmKliOYibaEtm-LHc?purpose=inline)

[사진 출처](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=75306&utm_source=chatgpt.com)

<b>B구역 — 천전리 세계유산·공룡 탐방</b>

울산대곡박물관, 천전리 공룡발자국 화석, 천전리 명문과 암각화

현재 울산시 공식 유적 분포도에서도 두 박물관, 천전리·대곡리 공룡발자국, 집청정, 반구서원, 모은정, 연로 개수기, 동매산 습지 등이 확인됩니다.

[ulsan.go.kr](https://www.ulsan.go.kr/s/bangucheonpetroglyphs/contents.ulsan?mId=001001004000000000&utm_source=chatgpt.com)

앱에서는 아래 세 종류의 코스를 제공하는 방향입니다.

<table fit-page-width="true" header-row="true">
<tr>
<td>
추천 코스
</td>
<td>
포함 콘텐츠
</td>
<td>
대상
</td>
</tr>
<tr>
<td>
핵심 관광 코스
</td>
<td>
암각화박물관, 집청정·반구서원, 공룡발자국, 반구대 조망지점
</td>
<td>
처음 방문하는 관광객
</td>
</tr>
<tr>
<td>
자연·역사 심화 코스
</td>
<td>
A구역의 서원·정자·비문·습지·공룡발자국·암각화
</td>
<td>
역사·자연에 관심 있는 관광객
</td>
</tr>
<tr>
<td>
세계유산 종합 코스
</td>
<td>
A구역 + B구역의 두 암각화와 박물관
</td>
<td>
충분한 시간을 확보한 방문객
</td>
</tr>
</table>

이 세 코스의 실제 거리와 소요시간은 아직 확정된 값이 아닙니다. 특히 A·B구역 사이를 임의의 직선이나 미검증 산책로로 연결하지 않고, 현장 조사와 공식 셔틀 안내를 기반으로 경로를 확정해야 합니다.

## 3. 앱의 실제 관광 지도 구성

![대체 지도 — 울산광역시 공식 반구천 일원 유적 분포도](https://www.ulsan.go.kr/s/enc/media/data.ulsan?mediaId=RLE5SA9wSu9fEl%2BS2i5th%2F4iPGD7OncvteuIalycLsU%3D)

[지도 출처: 울산광역시 「반구천 일원」](https://www.ulsan.go.kr/s/bangucheonpetroglyphs/contents.ulsan?mId=001001004000000000)

> 변환 안내: 대화의 상호작용 지도 원본을 가져올 수 없어 울산시 공식 유적 분포도로 대체했습니다. 아래 설명은 대화 원문입니다.

개발용 주요 관광 거점 지도입니다. 개별 좌표와 접근 지점이 확인되지 않은 모은정·연로 개수기·동매산 자연습지 등의 세부 위치는 추가 현장조사 후 등록합니다. 표시된 위치는 실제 검증된 보행 경로가 아닙니다.

앱 지도에 표시할 정보는 단순한 관광지 이름만으로 끝나면 안 됩니다. 장소를 누르면 아래 정보가 나와야 합니다.

- 장소 소개와 사진, 역사·자연 관련 핵심 관찰 포인트
- 현재 위치를 기준으로 길찾기 열기, 공식 교통·셔틀 안내
- QR 해설이나 XR·교육 등 이용 가능한 체험시설
- 미션 실행, 방문 체크, 탐방 여권 저장
- 접근 제한, 운영시간, 확인이 필요한 현장 주의사항

또한 장소는 '방문 가능한 관광 거점'과 '멀리서만 관찰할 수 있는 유산'으로 구분해야 합니다.

## 4. 앱 화면 구조

처음에는 모바일 웹으로 제작하고, 향후 스마트폰 홈 화면에 설치할 수 있는 PWA로 확장하는 방향을 권장합니다.

<callout color="gray_bg">
앱 내비게이션 구성

홈

지도

탐험

여권

화면 설계용 주요 메뉴 4개. 셔틀·체험 예약·설정은 관련 화면 안에서 접근하게 합니다.
</callout>

### ① 홈 화면 — 탐험 시작

관광객이 처음 접속하는 화면입니다.

<callout color="gray_bg">
![‘반구천 암각화’ 브랜드 개발 나선 울산시··· “세계적 문화상품으로 육성” - 경향신문](https://images.openai.com/static-rsc-4/mCSanRnp23ZP3ReYCFBUTe4VAtgTAJpst4QxfMqhqQiDF8GF5U19RN0NY6pRWBum9lT-Td5iLHeOdz3-7Opf6i-x4zw8qFLqZSkwP9tkiMNLUjqQf6DwHHanRy1o5SD4lWUT98RGryTNoUbK_MeyCoo9ba_fY_NxI5cqOqkl0LA?purpose=inline)

[khan.co.kr](https://www.khan.co.kr/article/202606091017001?utm_source=chatgpt.com)

## 반구천을 탐험해 보세요!

반구천의 숨은 역사와 자연유산을 발견하고 나만의 탐방 기록을 완성하세요.

<b>나의 탐방 진행 현황</b>

0 / 13곳

이 화면은 앱 출시 전 UI 예시입니다.

추천 코스

교통·셔틀
</callout>

홈에서는 처음부터 관광지 전체 목록을 보여주기보다, <b>코스 선택 → 관광 시작</b>이라는 행동으로 유도합니다.

### ② 지도 화면 — 이동과 장소 발견

앱의 가장 중요한 기능입니다. 실시간으로 본인의 위치를 확인하고, 관광지와 편의시설을 구분해서 볼 수 있어야 합니다.

지도 필터는 '전체', '세계유산', '역사문화', '자연·지질', '박물관·체험', '교통·편의' 정도로 설계합니다.

관광객이 특정 장소를 선택하면 하단에 장소 카드가 열리며, 그곳의 주요 볼거리와 체험, 안전한 길찾기 링크를 볼 수 있습니다.

초기 버전에서는 외부 지도 서비스의 도보 길찾기를 활용하고, <b>현장에서 검증한 길만 앱의 자체 추천 동선으로 표시</b>합니다.

### ③ 탐험 화면 — 관광지별 현장 체험

방문 지점마다 하나의 탐험 카드가 존재합니다.

<callout color="gray_bg">
<b>고래 그림을 찾아라!</b>

관찰형

![Image 219945 - UNESCO World Heritage Centre](https://images.openai.com/static-rsc-4/8qcSVb9KK5q3oZuwCZtkjghcFqao5Xlmoh0P0qUS6OXow5WknIMItFzjzwkoVErWjuRCCc0I2o9of-cNiyShdEYBDYGne1RyPakXPvMAsvWykjv2-XKW56Jgct1qQpDHB92MGoBBonZf7BPBR2IS6UPFNUBLsfvvPzVjzzmZCHs?purpose=inline)

[whc.unesco.org](https://whc.unesco.org/include/tool_image_bootstrap.cfm?gallery=site&id=219945&id_site=1740&utm_source=chatgpt.com)

반구대 암각화 관찰 미션

XR 망원경과 현장 해설을 통해 암각화에 새겨진 동물을 관찰해 보세요.

1단계 · 공식 해설 확인

2단계 · XR 망원경으로 관찰

3단계 · 관찰 문제 풀기

완료 시

고래 관찰 카드와 탐방 스탬프 획득
</callout>

미션은 짧게 구성하는 것이 좋습니다. 관광객이 유적을 보는 대신 휴대폰만 계속 조작하게 만들어서는 안 됩니다.

### ④ 탐방 여권 — 무엇을 발견했는지 기록

관광객이 방문한 장소와 경험을 확인하는 페이지입니다.

![상세 \| 연재 \| 콘텐츠 : K-공감 : 나에게 든든한 정책주간지](https://images.openai.com/static-rsc-4/kJuSVMDGsZBLFXx86WEsqniytZr0t-uiwy3LtRmCOZKvvrh7CyW2dO7qg7Dllge3GMvtzsEKPPafYuE2gPxJjydW7-tZUjeiSY-lNPNZOTCswro-JWo61UqwOBIbz9EvT-B2VfZzVUECXdnZJn32nQzI5VqAAEJ2ubVklS0ufWQ?purpose=inline)

[사진 출처](https://gonggam.korea.kr/newsContentView.es?code_cd=0105000000&content=NC002&mid=a10205000000&news_id=7e287eed-930d-407f-8655-70713f08a7dc&section_id=NCCD_PUBLISH&utm_source=chatgpt.com)

암각화 도감

고래·사슴·호랑이 등

![울산 대곡천 공룡발자국 화석 일반 공개 - 울산제일일보](https://images.openai.com/static-rsc-4/q08aMrKPm3TTDFVlTq5whDtuzi3yEyJxAEkQVxYikf8EdXf89vdyDRmeGkrSHxQ8N9Uqc1bMZL1To_XYjIdJKc-WpEJGbvywtUZ5PAXBV4gKsVGDSXwFIWtQVU5yn3jGb9iGs7HyOHX7Qh2ESIJfotz7lZZVl87JpdHx0DJ1VlQ?purpose=inline)

[사진 출처](https://www.ujeil.com/news/articleView.html?idxno=188324&utm_source=chatgpt.com)

공룡 도감

공룡발자국·지질 기록

![울산반구천의암각화(영문) > About the Heritage > Petroglyphs of Cheonjeon-ri](https://images.openai.com/static-rsc-4/Y6ZHsEvShTFkxlm74kvVsHqTmKgA1QH-jlDdNuJFEPDjNj4j1PAOkZTaMHCbtt5tkANzbJw-R0qJC06mHxhufOs8J-gPhW8m6DcX6m06b0CdFydvHS0D1DNAz4e2wlZaLQsgloLCPiwGMZTS5A1bG7mfdkKCPczhGhlR0NmFBTo?purpose=inline)

[사진 출처](https://ulsan.go.kr/s/bangucheonpetroglyphseng/contents.ulsan?mId=001001002000000000&utm_source=chatgpt.com)

역사 기록

한자 명문·서원·정자

![Green forest road at New Guro Ecological Park in Seoul, Korea](https://images.openai.com/static-rsc-4/-4apQxq9gTeeI10ffY7czoFQG1dBUHbcTtQSgXaB0QWkS0jOQ8M4Ohwggf2D0dhe78EzkZ7qOBSxOrq_PIRwth0KKhBBehs7WT2AFcthOI2DbCSlx0XTSkzvW5cvRQuKprJBIdlf5IzHJ7_FKB-a7N4u93mQcNnunGPT3UuPO1k8DXwz9CAK4SBURV5Sm82q?purpose=inline)

자연 도감

습지·식물 관찰 기록

탐방 여권은 장소별 스탬프, 사진, 메모, 수집 카드, 완주 배지로 구성합니다.

단, 단순히 버튼을 누르는 방식은 '내가 방문했다고 기록함'으로 표시하고, 공식 인증을 받은 기록과 구분해야 합니다.

---

## 5. 각 장소에서 어떤 체험을 제공할 것인가?

이 부분이 가장 중요합니다. 실제 앱이 단순 관광 지도와 달라지는 지점이기 때문입니다.

### 장소별 체험 콘텐츠 기획

<table fit-page-width="true" header-row="true">
<tr>
<td>
장소
</td>
<td>
관광객의 실제 행동
</td>
<td>
앱에 추가할 상호작용
</td>
<td>
수집 결과
</td>
</tr>
<tr>
<td>
암각화박물관
</td>
<td>
전시와 암각화 모형 관람
</td>
<td>
암각화 동물 문양 찾아보기
</td>
<td>
암각화 입문 배지
</td>
</tr>
<tr>
<td>
집청정
</td>
<td>
정자와 주변 경관 관찰
</td>
<td>
옛 반구대 풍경과 현재 모습 비교
</td>
<td>
풍경 카드
</td>
</tr>
<tr>
<td>
반구서원
</td>
<td>
서원 및 역사 안내 관찰
</td>
<td>
정몽주·이언적·정구의 역사 연결
</td>
<td>
역사 인물 카드
</td>
</tr>
<tr>
<td>
반구대정자·포은대
</td>
<td>
지정된 위치에서 한자 글씨와 경관 관찰
</td>
<td>
한자 글씨의 뜻 맞히기
</td>
<td>
한자 카드
</td>
</tr>
<tr>
<td>
모은정
</td>
<td>
정자의 역사 알아보기
</td>
<td>
집청정과 건립 배경 비교
</td>
<td>
정자 카드
</td>
</tr>
<tr>
<td>
반고서원 유허비
</td>
<td>
비석과 공식 해설 관람
</td>
<td>
비석에 기록된 역사 알아보기
</td>
<td>
금석문 카드
</td>
</tr>
<tr>
<td>
연로 개수기
</td>
<td>
옛길 보수 기록 관찰
</td>
<td>
1655년 기록의 의미 알아보기
</td>
<td>
옛길 기록
</td>
</tr>
<tr>
<td>
동매산 습지
</td>
<td>
주변 식생 관찰
</td>
<td>
나뭇잎 모양·습지 생태 체크
</td>
<td>
자연 카드
</td>
</tr>
<tr>
<td>
대곡리 공룡발자국
</td>
<td>
지정 관람 위치에서 화석 관찰
</td>
<td>
발자국 모양 구별하기
</td>
<td>
공룡 카드
</td>
</tr>
<tr>
<td>
반구대 암각화
</td>
<td>
XR 망원경과 QR 해설 이용
</td>
<td>
고래·동물 관찰 퀴즈
</td>
<td>
고래 카드
</td>
</tr>
<tr>
<td>
울산대곡박물관
</td>
<td>
발굴 유물·전시 관람
</td>
<td>
전시 유물과 현장 유산 연결
</td>
<td>
고고학 카드
</td>
</tr>
<tr>
<td>
천전리 공룡발자국
</td>
<td>
현장 화석 관찰
</td>
<td>
대곡리 화석과 비교
</td>
<td>
공룡 탐험 배지
</td>
</tr>
<tr>
<td>
천전리 명문과 암각화
</td>
<td>
그림과 한자 명문 관찰
</td>
<td>
선사 문양과 신라 문자를 구분
</td>
<td>
시대 기록 카드
</td>
</tr>
</table>

참고로 울산시의 기존 QR 해설은 집청정·반구서원·공룡발자국·습지 등의 내용을 이미 제공하므로, 앱에서 동일한 역사 해설을 전부 새로 작성할 필요는 없습니다.

[상세보기](https://www.ulsan.go.kr/u/rep/bbs/view.ulsan?bbsId=BBS_0000000000000027&dataId=182222&mId=001004003001000000&utm_source=chatgpt.com)

실제 개발에서는 체험을 다음 세 유형으로 나누면 제작과 유지보수가 쉬워집니다.

<callout color="gray_bg">
<b>관찰형 미션</b>

고래 문양, 공룡발자국, 습지 식물을 실제로 관찰하고 사진 또는 선택형 질문에 답합니다.

<b>해설 연계형 미션</b>

기존 공식 QR 해설을 읽거나 듣고, 그 내용에 관한 질문 하나를 해결합니다. 집청정·반구서원·연로 개수기 등에 적합합니다.

<b>기록형 미션</b>

풍경 사진, 관찰 소감, 발견한 특징을 남깁니다. 미션을 원하지 않는 관광객도 자유롭게 기록할 수 있습니다.
</callout>

## 6. 앱의 전체 사용자 이용 흐름

1. <b>앱 접속 및 방문 준비</b><br />관광객이 선호하는 코스와 이동 수단을 선택합니다. 주차장·셔틀·관람 가능 여부에 관한 공식 정보를 확인합니다.
2. <b>코스 시작</b><br />관광 지도가 열리고 선택한 코스의 방문 지점과 순서를 확인합니다.
3. <b>관광지 도착</b><br />장소 정보가 표시되고 관련 QR 해설·체험 안내·관찰 포인트를 열어볼 수 있습니다.
4. <b>현장 체험</b><br />관광객이 해설을 듣고, XR 망원경을 사용하거나 자연·문화유산을 관찰합니다.
5. <b>미션 및 스탬프</b><br />관찰 문제를 풀거나 사진·메모를 남기면 해당 관광지의 수집 카드와 탐방 기록을 획득합니다.
6. <b>다음 관광지로 이동</b><br />앱이 다음 장소의 설명과 공식 이동 정보를 제공합니다. 관광객은 코스를 변경하거나 탐방을 종료할 수도 있습니다.
7. <b>탐방 마무리</b><br />방문한 장소, 수집 카드, 사진, 메모를 탐방 여권에 정리하고 다른 코스를 추천합니다.

예를 들어 관광객이 울산암각화박물관에서 시작해 집청정을 거쳐 반구대 암각화까지 방문한다면, 앱은 각 장소의 해설·미션·기록을 계속 이어서 보여줍니다.

반면 관광객이 지도만 이용하려는 경우에도 미션 수행을 강제하지 않습니다. 관광 편의 기능이 게임 진행에 종속되어서는 안 됩니다.

## 7. 실제 구현할 기능과 나중에 개발할 기능

기능 우선순위 표

<table fit-page-width="true" header-row="true">
<tr>
<td>
기능
</td>
<td>
1차 MVP
</td>
<td>
후속 개발
</td>
</tr>
<tr>
<td>
관광지 13곳 기본 정보
</td>
<td>
✓
</td>
<td></td>
</tr>
<tr>
<td>
관광지 카테고리별 지도
</td>
<td>
✓
</td>
<td></td>
</tr>
<tr>
<td>
추천 코스 3종
</td>
<td>
✓
</td>
<td></td>
</tr>
<tr>
<td>
외부 지도 길찾기 연결
</td>
<td>
✓
</td>
<td></td>
</tr>
<tr>
<td>
공식 QR 해설 연결
</td>
<td>
✓
</td>
<td></td>
</tr>
<tr>
<td>
XR 시설 이용 안내
</td>
<td>
✓
</td>
<td></td>
</tr>
<tr>
<td>
장소별 관찰 미션
</td>
<td>
✓
</td>
<td></td>
</tr>
<tr>
<td>
탐방 여권·도감·스탬프
</td>
<td>
✓
</td>
<td></td>
</tr>
<tr>
<td>
박물관 교육·예약 페이지 연결
</td>
<td>
✓
</td>
<td></td>
</tr>
<tr>
<td>
로그인 없이 체험
</td>
<td>
✓
</td>
<td></td>
</tr>
<tr>
<td>
계정 기반 기록 동기화
</td>
<td></td>
<td>
✓
</td>
</tr>
<tr>
<td>
정교한 AR 콘텐츠 직접 제작
</td>
<td></td>
<td>
✓
</td>
</tr>
<tr>
<td>
XR 망원경 자동 이용 인증
</td>
<td></td>
<td>
✓
</td>
</tr>
<tr>
<td>
실시간 셔틀 위치 추적
</td>
<td></td>
<td>
✓
</td>
</tr>
<tr>
<td>
공식 예약 API 연동
</td>
<td></td>
<td>
✓
</td>
</tr>
<tr>
<td>
제휴 보상·관광 상품 혜택
</td>
<td></td>
<td>
✓
</td>
</tr>
</table>

MVP는 출시 가능한 최소 기능 제품을 뜻합니다. 오른쪽 항목은 확정 개발 기능이 아니라 운영기관 협력 및 기술 검토 후 추진할 후보입니다.

초기 버전에서 가장 피해야 할 것은 하나의 앱 안에 모든 시설의 기능을 직접 복제하는 것입니다. 공식 QR·XR·교육 서비스와 연결하는 데 집중하면 제작 범위를 크게 줄일 수 있습니다.

---

## 8. 실제 개발 기술 구성

이 프로젝트는 우선 <b>모바일 중심 웹앱(PWA)</b> 으로 제작하는 것을 권장합니다. 관광객이 앱스토어 설치 없이 QR이나 주소 링크로 들어올 수 있고, 개발 초기에도 수정 사항을 빠르게 배포할 수 있기 때문입니다.

<table fit-page-width="true" header-row="true">
<tr>
<td>
영역
</td>
<td>
추천 기술
</td>
<td>
사용 목적
</td>
</tr>
<tr>
<td>
프론트엔드
</td>
<td>
Next.js + TypeScript
</td>
<td>
웹앱 화면 및 기능 개발
</td>
</tr>
<tr>
<td>
디자인
</td>
<td>
Tailwind CSS
</td>
<td>
모바일 반응형 UI
</td>
</tr>
<tr>
<td>
지도
</td>
<td>
Kakao Maps JavaScript SDK
</td>
<td>
관광지 마커와 지도 표시
</td>
</tr>
<tr>
<td>
데이터 저장
</td>
<td>
Supabase 또는 동등한 DB
</td>
<td>
장소·미션·코스 정보 관리
</td>
</tr>
<tr>
<td>
사용자 기록
</td>
<td>
초기 로컬 저장, 이후 선택적 클라우드 동기화
</td>
<td>
비회원 탐방 기록·여권
</td>
</tr>
<tr>
<td>
배포
</td>
<td>
Vercel 등 웹 호스팅
</td>
<td>
배포 및 테스트
</td>
</tr>
<tr>
<td>
콘텐츠 관리
</td>
<td>
간단한 관리자 페이지
</td>
<td>
관광지 정보·링크·미션 수정
</td>
</tr>
</table>

카카오맵은 웹 지도 SDK와 장소 검색·좌표·경로 관련 API를 제공하며, JavaScript 키와 서비스 도메인 등록이 필요합니다. 실제 API의 이용 조건과 요금은 개발 시 확인해야 합니다.

[문서](https://developers.kakao.com/docs/ko/kakaomap/common?utm_source=chatgpt.com) [+1](https://apis.map.kakao.com/web/guide/?utm_source=chatgpt.com)

### 데이터 구조

개발할 때 관광지 정보와 사용자의 탐방 기록을 분리해야 합니다.

<callout color="gray_bg">
권장 데이터 모델

<b>places — 관광지 정보</b>

ID, 명칭, 분류, 좌표, 안전한 관람 위치, 설명, 공식 링크, 사진, 접근 가능 상태, 확인일

<b>routes</b>

코스 정보 · 방문 순서 · 이동 수단

<b>missions</b>

관찰 질문 · 답 · 보상 · 유형

<b>services</b>

QR 해설 · XR · 예약 · 셔틀 링크

<b>visit\_records</b>

방문 체크 · 미션 완료 · 사진 · 메모
</callout>

중요한 필드는 관광지의 실제 유적 좌표와 <b>관광객이 안전하게 설 수 있는 관람 위치</b>를 별도로 저장하는 것입니다.

또한 셔틀 시간표나 박물관 운영시간에는 확인일과 출처를 넣고, 정보가 오래되었으면 '공식 정보 확인 필요'라고 표시해야 합니다.

## 9. 개발 단계별 실행 계획

## 01

<b>관광 데이터 검증 및 정리</b>

장소 13곳의 실제 위치, 관람 가능 여부, 공식 QR·XR·박물관·셔틀 링크를 정리합니다. 출입 제한, 미끄러운 구간, 이용 불가능한 길을 확인합니다.

결과물: 개발용 관광지 데이터 목록 + 검증된 장소별 관람 지점

## 02

<b>핵심 UI 및 지도 개발</b>

홈·지도·장소 상세·탐험·여권 화면을 만들고, 코스 선택과 장소별 이동 안내를 연결합니다.

결과물: 스마트폰에서 코스를 선택하고 관광지 정보까지 접근 가능한 웹앱

## 03

<b>미션 및 탐방 여권 개발</b>

장소별 관찰 질문, 사진·메모, 디지털 스탬프, 수집 도감과 코스 진행률을 구현합니다.

결과물: 실제 장소를 방문하고 탐방 경험을 기록할 수 있는 MVP

## 04

<b>반구천 현장 테스트</b>

관광객 또는 테스트 참가자가 코스를 따라 이동하면서 GPS 오차, 링크 오류, 길찾기 문제, 미션의 적절성을 확인합니다.

결과물: 현장 테스트 보고서와 수정된 관광 코스

## 05

<b>운영 확장</b>

공식 QR 해설 지점 전체로 확장하고, 다국어 지원, 체험 프로그램 연결, 계정 동기화, 기관 협업 기능을 추가합니다.

결과물: 지속적으로 운영 가능한 반구천 관광 플랫폼

## 10. 실제 개발 전 반드시 확인할 사항

이 앱에서는 편리함과 안전성을 함께 고려해야 합니다.

- <b>코스 검증:</b> 공식 지도상의 위치와 실제 도보로 갈 수 있는 관람 지점을 구분합니다. 강을 건너야 하거나 비공개 구역이 포함된 경로는 자동 추천하지 않습니다.
- <b>현장 환경:</b> 반구대 암각화의 가시성은 수위와 햇빛 조건에 영향을 받습니다. 잘 보이지 않을 때는 공식 해설 자료로 대체 관찰할 수 있게 합니다. [상세보기](https://www.ulsan.go.kr/u/rep/bbs/view.ulsan?bbsId=BBS_0000000000000027&dataId=182222&mId=001004003001000000&utm_source=chatgpt.com)
- <b>QR·XR 연동:</b> 공식 해설 페이지를 열었다고 해서 관광객이 실제로 해설을 완료하거나 XR을 사용했다고 판단하지 않습니다.
- <b>정보 저작권:</b> 지도 데이터, 공식 사진, 전시 이미지 및 음성해설을 재사용하려면 이용 조건을 확인하고 필요한 허가를 받습니다.
- <b>접근성:</b> GPS를 허용하지 않아도 지도와 해설을 이용할 수 있게 하고, 글자 확대·음성 해설·쉬운 미션 건너뛰기를 지원합니다.
- <b>개인정보:</b> 초기에는 로그인 없이 사용하고, 위치는 필요한 순간에만 요청합니다. 사진과 기록은 사용자가 직접 삭제할 수 있게 합니다.

특히 2026년 11월 울산대곡박물관이 안내한 반구천 걷기 행사 코스는 계단과 산길이 포함된 약 2시간 답사로 소개됩니다. 관광객의 체력과 접근성에 따라 코스를 분리할 필요가 있다는 실질적인 근거가 됩니다.

[울산모아 통합예약](https://ulsan.go.kr/y/yes/page.do?mnu_code=F402&rsrcUnqId=EXP_0000000000000060&step=step01&utm_source=chatgpt.com)

## 11. 첫 번째 실제 구현 버전은 어디까지 만들 것인가?

13개 지점을 한꺼번에 완성하기보다는 아래처럼 범위를 축소한 <b>1차 동작 버전</b>부터 만드는 것이 좋겠습니다.

<callout color="gray_bg">
<b>MVP 시범 범위</b>

권장

# 6

시범 관광지

# 2

시범 코스

# 4

주요 메뉴

<b>시범 관광지:</b> 울산암각화박물관, 집청정, 반구서원, 대곡리 공룡발자국 화석, 대곡리 반구대 암각화 조망지점, 천전리 명문과 암각화.

<b>시범 코스:</b> 반구대 핵심 관광 코스, 천전리 세계유산 탐방 코스. 검증된 접근 동선과 교통 정보가 있는 지점부터 실제 지도에 공개합니다.

<b>완료 기준:</b> 관광객이 모바일로 코스를 선택하고, 장소별 공식 해설을 열고, 관찰 미션을 수행하고, 기록을 탐방 여권에 저장할 수 있어야 합니다.
</callout>

시범 운영에서는 앱을 이용한 관광객이 얼마나 많은 장소에 실제로 방문했는지, 해설을 이해했는지, 길을 찾는 데 도움이 되었는지, 관광 도중 불편한 점은 없었는지를 측정합니다.

그 결과를 토대로 나머지 문화유산과 습지, 공룡발자국, 박물관 체험을 단계적으로 추가하면 됩니다.

---

## 최종 기획 방향

이 프로젝트는 일반적인 관광 가이드 앱도 아니고, 미션 수행만을 위한 게임도 아닙니다.

<b>관광객에게 필요한 정보와 실제 문화유산 체험을 통합하고, 관광을 완료하는 과정에서 발견과 수집의 재미를 주는 서비스</b>입니다.

프랑스 샹보르 성에서 현장 해설·시각화 경험을, 영국 바스에서 위치 기반 관광 동선을, 태국 치앙마이에서 미션·탐방 여권·보상을 가져오되, 반구천의 이미 구축된 시설에 맞게 결합합니다.

제가 권장하는 다음 구체화 단계는 <b>앱의 화면별 상세 설계(UI/UX 와이어프레임)</b> 입니다. 특히 홈에서 코스를 선택하는 과정, 지도에서 관광지를 누르는 과정, QR 해설을 보고 미션을 수행하는 과정, 스탬프가 탐방 여권에 저장되는 과정을 실제 스마트폰 화면 단위로 설계하면 Codex로 개발을 시작하기 위한 명확한 기준이 만들어집니다.

기존 자료는 [반구천 스마트 관광 통합 앱 Notion 기획서](https://app.notion.com/p/4015258dac46815eb767e8dba878f00e)를 기준으로 유지하면 됩니다.
</content>
</page>
