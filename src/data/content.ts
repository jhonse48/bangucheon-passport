import type {
  CollectionItem,
  Mission,
  Place,
  Service,
  Source,
  TourRoute,
} from "@/lib/types";

const checkedAt = "2026-10-22";
const regionUrl =
  "https://ulsan.go.kr/s/bangucheonpetroglyphs/contents.ulsan?mId=001001004000000000";
const bangudaeUrl =
  "https://www.ulsan.go.kr/s/bangucheonpetroglyphs/contents.ulsan?mId=001001002000000000";
const cheonjeonriUrl =
  "https://www.ulsan.go.kr/s/bangucheonpetroglyphs/contents.ulsan?mId=001001003000000000";
const museumUrl = "https://www.ulsan.go.kr/s/bangudae/main.ulsan";
const exhibitionUrl =
  "https://www.ulsan.go.kr/s/bangudae/contents.ulsan?mId=001002001000000000";
const educationUrl =
  "https://www.ulsan.go.kr/s/bangudae/bbs/list.ulsan?bbsId=BBS_0000000000000095&mId=001003006000000000";
const shuttleUrl = "https://uctf.or.kr/business/tour-mice/smart08";
const qrUrl =
  "https://www.ulsan.go.kr/u/rep/bbs/view.ulsan?bbsId=BBS_0000000000000027&dataId=182222&mId=001004003001000000";
const xrUrl =
  "https://www.ulsan.go.kr/u/rep/bbs/view.do?bbsId=BBS_0000000000000027&dataId=182270&mId=001004003001000000";
const daegokUrl = "https://www.ulsan.go.kr/s/dgmuseum/main.ulsan";
const source = (title: string, url: string): Source => ({
  title,
  url,
  checkedAt,
});
const regionalSource = source("울산광역시 · 반구천 일원", regionUrl);
const photoCredit =
  "울산암각화박물관 / Wikimedia Commons · CC BY-SA 3.0 · 화면에 맞게 잘라 표시";

// Unverified coordinates deliberately remain null. A heritage point is never used as a safe visitor destination.
const place = (
  input: Pick<
    Place,
    | "id"
    | "name"
    | "shortName"
    | "category"
    | "description"
    | "observation"
    | "collectionId"
  > &
    Partial<Place>,
): Place => ({
  zone: "A",
  pilot: false,
  image: "/images/landscape.svg",
  imageAlt: "반구천의 숲과 물을 표현한 일러스트",
  imageCredit: "반구천 탐험여권 자체 제작 일러스트 · 실제 현장 사진 아님",
  heritagePosition: null,
  viewingPosition: null,
  locationStatus: "확인 필요",
  accessNote:
    "관람 위치와 접근 동선은 현장 확인이 필요합니다. 공식 안내판과 지정된 관람 구역을 따라 주세요.",
  officialUrl: regionUrl,
  mapQuery: "울산 울주군 " + input.name,
  serviceIds: ["qr-guide", "shuttle"],
  missionIds: [],
  sources: [regionalSource],
  ...input,
});

export const places: Place[] = [
  place({
    id: "museum",
    name: "울산암각화박물관",
    shortName: "암각화박물관",
    category: "박물관·체험",
    pilot: true,
    description:
      "두 암각화의 모형과 선사문화 전시를 만나며 야외 탐방을 준비하는 곳입니다.",
    observation: [
      "두 암각화 모형을 비교해 보세요.",
      "바위에 새긴 그림과 안료로 그린 그림의 차이를 찾아보세요.",
    ],
    image: "/images/museum.jpg",
    imageAlt: "울산암각화박물관의 고래를 닮은 외관",
    imageCredit: photoCredit,
    accessNote:
      "휴관·공사·교육 일정은 출발 전 박물관 공식 공지를 확인해 주세요. 입구의 상세 좌표는 현장 검증 전입니다.",
    officialUrl: museumUrl,
    serviceIds: ["museum-exhibition", "museum-education", "shuttle"],
    missionIds: ["museum-discovery"],
    collectionId: "first-discovery",
    sources: [
      source("울산암각화박물관 · 상설전시", exhibitionUrl),
      source("울산암각화박물관 · 관람 안내", museumUrl),
    ],
  }),
  place({
    id: "jipcheongjeong",
    name: "집청정",
    shortName: "집청정",
    category: "역사문화",
    pilot: true,
    description: "문인들이 시와 학문을 나누던 정자입니다.",
    observation: [
      "정자와 물길이 이루는 풍경을 바라보세요.",
      "오늘의 풍경을 한 문장으로 남겨 보세요.",
    ],
    accessNote:
      "정자 내부 개방과 프로그램 운영 여부는 현장 안내를 확인해 주세요. 사유 공간 출입을 전제로 안내하지 않습니다.",
    missionIds: ["jipcheongjeong-story", "jipcheongjeong-note"],
    collectionId: "clear-landscape",
  }),
  place({
    id: "seowon",
    name: "반구서원",
    shortName: "반구서원",
    category: "역사문화",
    pilot: true,
    description: "정몽주·이언적·정구를 기리는 서원입니다.",
    observation: ["공식 해설에서 서원이 기리는 인물을 확인해 보세요."],
    accessNote:
      "내부 개방 여부는 현장 확인이 필요합니다. 닫혀 있다면 외부 안내판과 공식 해설로 살펴보세요.",
    missionIds: ["seowon-story"],
    collectionId: "three-scholars",
  }),
  place({
    id: "poeundae",
    name: "반구대정자·포은대",
    shortName: "포은대",
    category: "역사문화",
    description: "반구대에는 포은 정몽주와 관련된 이야기가 전합니다.",
    observation: ["공식 안내에서 포은대라는 이름의 배경을 읽어보세요."],
    collectionId: "poeun-landscape",
    officialUrl: "https://www.ulju.ulsan.kr/bulgogi/contents.do?mId=0406000000",
    sources: [
      source(
        "울주군 · 반구대 소개",
        "https://www.ulju.ulsan.kr/bulgogi/contents.do?mId=0406000000",
      ),
      regionalSource,
    ],
  }),
  place({
    id: "moeunjeong",
    name: "모은정",
    shortName: "모은정",
    category: "역사문화",
    description: "정몽주를 추모하며 지은 정자입니다.",
    observation: ["공식 설명에서 건립 배경을 살펴보세요."],
    collectionId: "pavilion-memory",
  }),
  place({
    id: "memorial",
    name: "반고서원 유허비",
    shortName: "반고서원 유허비",
    category: "역사문화",
    description: "정몽주의 자취를 기리는 비석들이 남아 있습니다.",
    observation: ["비각과 비문은 허용된 관람 구역에서 살펴보세요."],
    collectionId: "stone-memory",
  }),
  place({
    id: "old-road",
    name: "울주 대곡리 연로 개수기",
    shortName: "연로 개수기",
    category: "역사문화",
    description: "1655년 옛길 보수의 기록을 바위에 새겼습니다.",
    observation: ["길을 고친 기록이 남겨진 이유를 생각해 보세요."],
    collectionId: "old-road-record",
  }),
  place({
    id: "wetland",
    name: "동매산 자연습지",
    shortName: "동매산 습지",
    category: "자연·지질",
    description: "다양한 식생을 만나는 반구천의 자연습지입니다.",
    observation: ["지정된 길에서 잎의 모양을 비교해 보세요."],
    collectionId: "wetland-life",
  }),
  place({
    id: "dinosaur",
    name: "대곡리 공룡발자국 화석",
    shortName: "대곡리 공룡발자국",
    category: "자연·지질",
    pilot: true,
    description: "공룡발자국과 물결자국이 남은 지질유산입니다.",
    observation: [
      "발자국과 물결자국을 찾아보세요.",
      "암반에 올라가지 않고 안내판을 활용해 관찰하세요.",
    ],
    missionIds: ["dinosaur-observe"],
    collectionId: "dinosaur-trace",
  }),
  place({
    id: "bangudae",
    name: "대곡리 반구대 암각화 조망지점",
    shortName: "반구대 암각화",
    category: "세계유산",
    pilot: true,
    description:
      "강 건너 바위에 새겨진 고래와 육지동물, 사냥 장면을 살펴보세요. 선사인의 세심한 관찰이 담겨 있습니다.",
    observation: [
      "고래의 지느러미와 꼬리 형태를 비교해 보세요.",
      "잘 보이지 않으면 공식 그림 설명이나 박물관 모형을 함께 보세요.",
    ],
    image: "/images/bangudae.jpg",
    imageAlt: "물길과 숲 사이에 자리한 대곡리 반구대 암각화의 바위절벽",
    imageCredit: photoCredit,
    accessNote:
      "암면은 강 건너에서 관람합니다. 하천 횡단이나 암면 접근을 시도하지 마세요. 가시성과 기기 운영은 현장 여건에 따라 달라집니다.",
    officialUrl: bangudaeUrl,
    mapQuery: "울산 울주군 반구대암각화 전망대",
    serviceIds: ["qr-guide", "xr-guide", "shuttle"],
    missionIds: ["bangudae-whale", "bangudae-note"],
    collectionId: "whale-discovery",
    sources: [source("울산광역시 · 대곡리 반구대 암각화", bangudaeUrl)],
  }),
  place({
    id: "daegok-museum",
    name: "울산대곡박물관",
    shortName: "대곡박물관",
    category: "박물관·체험",
    zone: "B",
    description: "대곡천 유역의 역사와 문화를 살펴보는 박물관입니다.",
    observation: ["천전리 탐방 전 지역의 역사와 출토 유물을 살펴보세요."],
    officialUrl: daegokUrl,
    serviceIds: ["daegok-museum", "shuttle"],
    collectionId: "river-history",
    sources: [
      source("울산대곡박물관", daegokUrl),
      source("울주군 웹진 · 반구천 탐방", "https://ulju.wzp.kr/202508/2"),
    ],
  }),
  place({
    id: "cheonjeonri-dinosaur",
    name: "천전리 공룡발자국 화석",
    shortName: "천전리 공룡발자국",
    category: "자연·지질",
    zone: "B",
    description: "천전리 암각화 맞은편에 공룡발자국이 남아 있습니다.",
    observation: ["안내판으로 발자국 모양을 비교해 보세요."],
    accessNote:
      "관람 지점은 현장 확인 전입니다. 화석을 향해 임의로 하천을 건너지 마세요.",
    collectionId: "ancient-footprints",
  }),
  place({
    id: "cheonjeonri",
    name: "천전리 명문과 암각화",
    shortName: "천전리 명문과 암각화",
    category: "세계유산",
    zone: "B",
    pilot: true,
    description:
      "선사시대 그림에서 신라시대 문자까지, 여러 시대의 흔적이 한 바위에 이어집니다.",
    observation: [
      "기하학 문양과 가느다란 문자 획을 구분해 보세요.",
      "모든 그림과 글자가 같은 시대의 기록은 아니라는 점에 주목하세요.",
    ],
    accessNote:
      "허용된 관람 구역에서 살펴보고 암면에 손대지 마세요. 박물관과의 보행 동선·계단·통제 여부는 방문일 공식 안내를 확인해 주세요.",
    officialUrl: cheonjeonriUrl,
    missionIds: ["cheonjeonri-time"],
    collectionId: "layers-of-time",
    sources: [source("울산광역시 · 천전리 명문과 암각화", cheonjeonriUrl)],
  }),
];

export const routes: TourRoute[] = [
  {
    id: "core",
    name: "반구대 핵심 관광 코스",
    subtitle: "처음 만나는 반구천",
    description:
      "박물관에서 배운 그림을 숲길과 물길 곁에서 다시 만나보세요. 5개 장소를 살펴보는 추천 방문 순서입니다.",
    placeIds: ["museum", "jipcheongjeong", "seowon", "dinosaur", "bangudae"],
    active: true,
    image: "/images/bangudae.jpg",
    theme: "역사와 자연",
  },
  {
    id: "cheonjeon",
    name: "천전리 세계유산 탐방 코스",
    subtitle: "바위에 쌓인 시간",
    description:
      "박물관 모형과 천전리의 그림·문자를 함께 살펴봅니다. 구간 이동은 공식 교통·현장 안내를 확인해 주세요.",
    placeIds: ["museum", "cheonjeonri"],
    active: true,
    image: "/images/museum.jpg",
    theme: "세계유산 이야기",
  },
  {
    id: "nature",
    name: "자연·역사 심화 코스",
    subtitle: "확장 준비 중",
    description:
      "정자·비문·습지로 탐방을 넓히는 코스입니다. 관람 지점과 접근 동선 검증 후 개방합니다.",
    placeIds: [
      "museum",
      "jipcheongjeong",
      "seowon",
      "poeundae",
      "moeunjeong",
      "memorial",
      "old-road",
      "wetland",
      "dinosaur",
      "bangudae",
    ],
    active: false,
    image: "/images/landscape.svg",
    theme: "자연과 옛길",
  },
  {
    id: "all",
    name: "반구천 세계유산 종합 탐방 코스",
    subtitle: "확장 준비 중",
    description:
      "두 구역의 유산과 박물관을 잇는 전체 탐방입니다. 이동 수단과 현장 접근성을 검증한 뒤 제공합니다.",
    placeIds: places.map((item) => item.id),
    active: false,
    image: "/images/petroglyphs.jpg",
    theme: "반구천 전체 탐방",
  },
];

export const missions: Mission[] = [
  {
    id: "museum-discovery",
    placeId: "museum",
    type: "해설 연계형",
    title: "탐험의 첫 장",
    instruction: "상설전시의 바위그림 설명이나 공식 전시 안내를 살펴보세요.",
    question: "암각화는 어떻게 만든 그림일까요?",
    options: [
      "바위 표면에 새긴 그림",
      "종이에 인쇄한 그림",
      "천에 수놓은 그림",
    ],
    correctIndex: 0,
    explanation:
      "암각화는 바위 표면에 새긴 그림입니다. 안료로 그린 암채화와 구분해 보세요.",
    collectionId: "first-discovery",
  },
  {
    id: "jipcheongjeong-story",
    placeId: "jipcheongjeong",
    type: "해설 연계형",
    title: "정자에 남은 이야기",
    instruction: "공식 반구천 일원 소개에서 집청정 항목을 읽어보세요.",
    question: "문인들은 집청정에서 무엇을 했을까요?",
    options: [
      "배를 만들었어요",
      "시를 짓고 학문을 나눴어요",
      "공룡 화석을 발굴했어요",
    ],
    correctIndex: 1,
    explanation: "집청정은 시와 학문을 나누던 곳입니다.",
    collectionId: "clear-landscape",
  },
  {
    id: "jipcheongjeong-note",
    placeId: "jipcheongjeong",
    type: "기록형",
    title: "나의 한 줄 풍경",
    instruction:
      "풍경을 보고 떠오른 생각을 메모하거나 사진 한 장을 남겨보세요.",
    question: "오늘 마음에 남은 풍경은 무엇인가요?",
    explanation:
      "짧은 기록도 좋아요. 메모나 사진을 여권에 저장하면 이 미션을 마칠 수 있습니다.",
    collectionId: "clear-landscape",
  },
  {
    id: "seowon-story",
    placeId: "seowon",
    type: "해설 연계형",
    title: "서원의 세 사람",
    instruction: "공식 반구서원 설명이나 현장 안내판을 살펴보세요.",
    question: "반구서원이 기리는 인물 중 한 사람은 누구일까요?",
    options: ["정몽주", "장보고", "세종대왕"],
    correctIndex: 0,
    explanation: "정몽주·이언적·정구를 기리는 서원입니다.",
    collectionId: "three-scholars",
  },
  {
    id: "dinosaur-observe",
    placeId: "dinosaur",
    type: "관찰형",
    title: "발자국 곁의 흔적",
    instruction: "안전한 관람 구역에서 화석 또는 공식 설명을 살펴보세요.",
    question: "대곡리 공룡발자국과 함께 관찰되는 흔적은 무엇일까요?",
    options: ["물결자국", "한글 비문", "기와 무늬"],
    correctIndex: 0,
    explanation: "물결자국도 함께 남아 있습니다.",
    collectionId: "dinosaur-trace",
  },
  {
    id: "bangudae-whale",
    placeId: "bangudae",
    type: "관찰형",
    title: "바위 속 고래 찾기",
    instruction: "관람 지점의 망원경이나 공식 그림 설명에서 고래를 찾아보세요.",
    question: "고래를 구분할 때 관찰할 수 있는 특징은 무엇일까요?",
    options: ["지느러미와 꼬리의 형태", "새의 깃털 색깔", "나뭇잎의 잎맥"],
    correctIndex: 0,
    explanation:
      "머리·몸통·지느러미·꼬리의 형태에 고래의 특징이 담겨 있습니다. 이 기록은 XR 이용을 자동 인증하지 않습니다.",
    collectionId: "whale-discovery",
  },
  {
    id: "bangudae-note",
    placeId: "bangudae",
    type: "기록형",
    title: "오늘 만난 바위그림",
    instruction:
      "눈에 들어온 동물이나 풍경을 메모 또는 사진으로 남겨보세요. 잘 보이지 않았다면 그 경험을 적어도 좋아요.",
    question: "가장 오래 바라본 것은 무엇인가요?",
    explanation:
      "관람 경험을 저장하는 선택 미션입니다. 관찰을 위해 보호구역으로 들어가지 마세요.",
    collectionId: "whale-discovery",
  },
  {
    id: "cheonjeonri-time",
    placeId: "cheonjeonri",
    type: "관찰형",
    title: "겹겹이 쌓인 시간",
    instruction: "바위의 문양과 문자 또는 공식 그림 설명을 비교해 보세요.",
    question: "천전리의 그림과 문자를 어떻게 이해하면 좋을까요?",
    options: [
      "모두 하루에 새긴 기록이에요",
      "선사시대부터 신라시대까지 여러 시대의 기록이에요",
      "모두 현대에 새긴 기록이에요",
    ],
    correctIndex: 1,
    explanation:
      "선사시대 문양과 신라시대의 그림·문자가 함께 남아 있습니다. 시대가 다른 흔적을 구분해 살펴보세요.",
    collectionId: "layers-of-time",
  },
];

export const services: Service[] = [
  {
    id: "qr-guide",
    title: "현장 QR 해설 안내",
    type: "해설",
    description:
      "현장 안내판의 QR로 해설을 들을 수 있어요. 이 링크는 울산시의 서비스 소개이며 개별 음성해설 주소는 현장에서 확인해 주세요.",
    url: qrUrl,
    source: source("울산광역시 · QR 해설서비스 개시", qrUrl),
  },
  {
    id: "xr-guide",
    title: "XR 망원경 도입 안내",
    type: "XR",
    description:
      "울산시의 XR 망원경 도입 소식을 확인해 보세요. 당일 이용 가능 여부·운영시간은 현장 안내를 따라 주세요.",
    url: xrUrl,
    source: source("울산광역시 · 세계유산 관람 환경 개선 안내", xrUrl),
  },
  {
    id: "museum-exhibition",
    title: "박물관 전시 안내",
    type: "해설",
    description: "암각화 모형과 어린이 전시를 공식 페이지에서 미리 만나보세요.",
    url: exhibitionUrl,
    source: source("울산암각화박물관 · 상설전시", exhibitionUrl),
  },
  {
    id: "museum-education",
    title: "교육·체험 프로그램",
    type: "교육",
    description:
      "공식 모집 공고에서 대상·일정·예약 방법을 확인해 주세요. 신청은 운영 기관에서 진행합니다.",
    url: educationUrl,
    source: source("울산암각화박물관 · 교육신청", educationUrl),
  },
  {
    id: "shuttle",
    title: "주차·순환버스 안내",
    type: "교통",
    description:
      "반구대암각화 주차장의 탑승장, 정류장, 공식 시간표를 확인하세요. 출발 전 최신 운행 여부를 다시 확인해 주세요.",
    url: shuttleUrl,
    source: source("울산문화관광재단 · 반구천 암각화 순환버스", shuttleUrl),
  },
  {
    id: "daegok-museum",
    title: "대곡박물관 관람 안내",
    type: "교육",
    description: "관람과 교육 일정은 박물관 공식 안내에서 확인해 주세요.",
    url: daegokUrl,
    source: source("울산대곡박물관", daegokUrl),
  },
];

export const collectionItems: CollectionItem[] = [
  {
    id: "first-discovery",
    name: "첫 발견",
    category: "암각화",
    symbol: "book",
    description: "바위그림의 세계로 들어가는 첫 장.",
  },
  {
    id: "clear-landscape",
    name: "물길의 시",
    category: "역사문화",
    symbol: "landmark",
    description: "집청정에서 만난 나만의 풍경.",
  },
  {
    id: "three-scholars",
    name: "서원의 이야기",
    category: "역사문화",
    symbol: "book",
    description: "반구서원에 남은 인물과 기억.",
  },
  {
    id: "poeun-landscape",
    name: "포은의 풍경",
    category: "역사문화",
    symbol: "landmark",
    description: "포은대 이야기 카드 · 확장 예정.",
  },
  {
    id: "pavilion-memory",
    name: "정자의 기억",
    category: "역사문화",
    symbol: "landmark",
    description: "모은정 이야기 카드 · 확장 예정.",
  },
  {
    id: "stone-memory",
    name: "돌에 남긴 마음",
    category: "역사문화",
    symbol: "book",
    description: "유허비 이야기 카드 · 확장 예정.",
  },
  {
    id: "old-road-record",
    name: "옛길의 기록",
    category: "역사문화",
    symbol: "book",
    description: "연로 개수기 카드 · 확장 예정.",
  },
  {
    id: "wetland-life",
    name: "습지의 숨결",
    category: "자연",
    symbol: "leaf",
    description: "자연 관찰 카드 · 확장 예정.",
  },
  {
    id: "dinosaur-trace",
    name: "오래된 발걸음",
    category: "공룡",
    symbol: "footprints",
    description: "대곡리에서 발견한 공룡의 흔적.",
  },
  {
    id: "whale-discovery",
    name: "바위 속 고래",
    category: "암각화",
    symbol: "whale",
    description: "선사인의 눈으로 바라본 고래.",
  },
  {
    id: "river-history",
    name: "강의 역사",
    category: "역사문화",
    symbol: "book",
    description: "대곡천 역사 카드 · 확장 예정.",
  },
  {
    id: "ancient-footprints",
    name: "아주 먼 날의 산책",
    category: "공룡",
    symbol: "footprints",
    description: "천전리 발자국 카드 · 확장 예정.",
  },
  {
    id: "layers-of-time",
    name: "겹겹의 시간",
    category: "암각화",
    symbol: "book",
    description: "한 바위에서 만난 여러 시대의 기록.",
  },
];
