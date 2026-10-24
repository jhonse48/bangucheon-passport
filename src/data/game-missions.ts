import { missions } from './content';
import type { PhotoGameMission, QuizGameMission } from '../lib/game';

const qrCodes: Record<string, string> = {
  'museum-discovery': 'BG-MUSEUM-26',
  'jipcheongjeong-story': 'BG-JIPCHEONG-26',
  'seowon-story': 'BG-SEOWON-26',
  'dinosaur-observe': 'BG-DINO-26',
  'bangudae-whale': 'BG-WHALE-26',
  'cheonjeonri-time': 'BG-TIME-26',
};

const guideSteps: Record<string, { steps: [string, string, string]; observationHint: string }> = {
  museum: { steps: ['상설전시에서 반구대·천전리 암각화 모형 해설 읽기', '고래 한 마리와 기하학 문양 한 개를 찾아 모양 비교하기', '바위그림을 만든 방법에 관한 문제 풀기'], observationHint: '표면을 쪼거나 새긴 선과 색으로 그린 그림은 어떻게 다를까요?' },
  jipcheongjeong: { steps: ['집청정 안내판에서 정자의 이름과 건립 배경 읽기', '정자 밖 지정 길에서 지붕·물길·산 능선을 함께 바라보기', '문인들이 이곳에 남긴 기록에 관한 문제 풀기'], observationHint: '옛 그림이나 해설 속 풍경과 지금 보이는 물길을 비교해 보세요.' },
  seowon: { steps: ['반구서원 해설에서 모시는 세 인물의 이름 찾기', '정몽주·이언적·정구 가운데 익숙한 이름을 골라 읽기', '서원에서 기리는 인물 문제 풀고 인물 카드 받기'], observationHint: '서원 문이 닫혀 있으면 외부 안내판과 공식 해설로 살펴보세요.' },
  dinosaur: { steps: ['대곡리 화석 안내판에서 발자국과 물결자국 해설 읽기', '관람 구역에서 움푹 팬 발자국과 반복되는 물결 모양 구분하기', '발자국 곁에 남은 흔적에 관한 문제 풀기'], observationHint: '바위 위에 올라가지 말고 안내판 사진과 실제 암반의 무늬를 비교하세요.' },
  bangudae: { steps: ['전망대·XR 망원경 주변 QR 안내판 또는 공식 해설 확인하기', '지정 전망 구역에서 고래 그림의 몸통·지느러미·꼬리 찾아보기', '고래의 특징 문제를 풀고 고래 관찰 카드 받기'], observationHint: 'XR 운영과 가시성은 현장에서 확인하세요. 잘 보이지 않으면 안내판의 고래 그림으로 비교할 수 있어요.' },
  cheonjeonri: { steps: ['천전리 해설에서 선사시대 문양과 신라시대 명문 구분하기', '마름모·동심원 등 문양 한 개와 문자 한 줄 찾아보기', '그림과 문자가 남겨진 시대에 관한 문제 풀기'], observationHint: '암면을 만지지 말고 관람 구역이나 공식 확대 그림에서 선의 차이를 살펴보세요.' },
};

const additionalQuizzes: Array<Omit<QuizGameMission, 'kind' | 'xp' | 'qrPayload'>> = [
  { id: 'qr-poeundae-landscape', placeId: 'poeundae', title: '풍경 속 거북을 찾아라!', instruction: '집청정 건너편 반구대 경관을 바라보고, 포은대 해설에서 지형과 이름의 의미를 찾아보세요.',
    steps: ['포은대·반구대 경관 해설 읽기', '지정 관람 구역에서 거북을 닮은 지형과 암벽 글씨 찾아보기', '지형의 별명 문제를 풀고 풍경 카드 수집하기'], observationHint: '바위에 올라가거나 강을 건너지 않고 건너편에서 관찰해요.',
    question: '반구대라는 이름과 연결되는 지형의 모습은 무엇일까요?', options: ['날개를 편 새', '엎드린 거북', '곧게 선 나무'], correctIndex: 1, explanation: '반구대는 거북을 닮은 지형과 포은 정몽주 이야기를 함께 만나는 장소입니다.', collectionId: 'poeun-landscape', qrCode: 'BG-POEUN-26' },
  { id: 'qr-moeunjeong-memory', placeId: 'moeunjeong', title: '정자와 서원, 무엇이 다를까?', instruction: '모은정과 반구서원 해설을 비교하고, 두 장소에 함께 등장하는 인물을 찾아보세요.',
    steps: ['모은정 건립 배경 해설 읽기', '앞서 본 반구서원의 인물 이름과 비교하기', '공통 인물 문제를 풀고 정자의 기억 카드 받기'], observationHint: '건물 형태뿐 아니라 누구를 기억하기 위해 세웠는지도 살펴보세요.',
    question: '모은정이 추모하는 인물은 누구일까요?', options: ['정몽주', '장보고', '이순신'], correctIndex: 0, explanation: '모은정은 정몽주를 추모하는 정자입니다. 반구서원에서도 정몽주의 이야기를 만날 수 있어요.', collectionId: 'pavilion-memory', qrCode: 'BG-MOEUN-26' },
  { id: 'qr-memorial-stones', placeId: 'memorial', title: '세 비석에 남긴 기억', instruction: '반고서원 유허비의 해설에서 비석이 기억하는 인물과 장소의 의미를 찾아보세요.',
    steps: ['유허비 안내판에서 정몽주 관련 기록 읽기', '허용된 관람 위치에서 비석과 비각 형태 살펴보기', '유허비가 남기는 기억에 관한 문제 풀기'], observationHint: '비문이 작아 읽기 어렵다면 해설문을 사용하세요. 비석을 만지거나 탁본하지 않아요.',
    question: '반고서원 유허비가 기리는 인물은 누구일까요?', options: ['세종대왕', '신사임당', '정몽주'], correctIndex: 2, explanation: '유허비는 정몽주의 자취를 기억하는 비석입니다. 오늘 읽은 이야기를 돌에 남긴 기록과 연결해 보세요.', collectionId: 'stone-memory', qrCode: 'BG-MEMORIAL-26' },
  { id: 'qr-old-road-repair', placeId: 'old-road', title: '1655년의 길 수리 기록', instruction: '대곡리 연로 개수기 해설에서 무엇을 고쳤는지 찾아보세요.',
    steps: ['옛길 주변 암벽 명문의 해설 읽기', '해설에서 1655년과 길 보수에 관한 대목 찾기', '기록을 바위에 남긴 목적에 관한 문제 풀기'], observationHint: '암벽에 접근하지 말고 안내판의 풀이에서 기록의 의미를 찾아요.',
    question: '연로 개수기는 어떤 일을 기록한 것일까요?', options: ['옛길을 보수한 일', '새 배를 만든 일', '고래를 사냥한 일'], correctIndex: 0, explanation: '1655년 옛길을 보수한 일을 바위에 새긴 기록입니다. 길을 쓰는 사람들을 위한 일을 오래 기억하게 해요.', collectionId: 'old-road-record', qrCode: 'BG-OLDROAD-26' },
  { id: 'qr-wetland-life', placeId: 'wetland', title: '습지의 서로 다른 두 잎', instruction: '동매산 자연습지 산책로에서 잎 모양이 다른 식물 두 종류를 눈으로 찾아보세요.',
    steps: ['습지와 산책로 현장 안내 확인하기', '길 위에서 길쭉한 잎과 넓은 잎처럼 다른 모양 두 개 찾기', '습지를 지키는 관찰 방법 문제 풀기'], observationHint: '식물 이름을 몰라도 괜찮아요. 잎 모양을 비교하고 채집 대신 메모로 남겨요.',
    question: '습지를 관찰하는 올바른 방법은 무엇일까요?', options: ['식물을 뽑아 비교하기', '지정 길에서 눈으로 관찰하기', '울타리 안으로 들어가기'], correctIndex: 1, explanation: '지정 길에서 관찰하면 식생을 훼손하지 않고 서로 다른 잎과 생태를 만날 수 있습니다.', collectionId: 'wetland-life', qrCode: 'BG-WETLAND-26' },
  { id: 'qr-cheonjeon-dinosaur-track', placeId: 'cheonjeonri-dinosaur', title: '발자국을 따라 상상 산책', instruction: '천전리 공룡발자국 화석 해설을 보고, 발자국이 이어진 방향과 모양을 찾아보세요.',
    steps: ['천전리 공룡발자국 안내판 읽기', '관람 구역에서 연속된 발자국의 방향과 크기 비교하기', '발자국이 알려주는 단서 문제 풀기'], observationHint: '대곡리에서 본 발자국과 다른 점이 있다면 장소 메모에 한 가지 남겨 보세요.',
    question: '여러 발자국이 이어진 흔적에서 살펴볼 수 있는 것은 무엇일까요?', options: ['공룡의 피부색', '공룡이 살던 정확한 날짜', '공룡이 이동한 방향'], correctIndex: 2, explanation: '이어진 발자국의 배열은 이동 방향을 생각해 볼 수 있는 단서입니다. 개별 동물의 모습은 해설과 함께 살펴보세요.', collectionId: 'ancient-footprints', qrCode: 'BG-CHEONDINO-26' },
  { id: 'qr-daegok-river-history', placeId: 'daegok-museum', title: '유물 하나로 만나는 강의 역사', instruction: '대곡박물관 전시에서 대곡천 유역의 생활을 알려주는 유물 하나를 골라보세요.',
    steps: ['상설전시 안내와 촬영 가능 여부 확인하기', '마음에 드는 유물의 이름·용도·발견 장소 읽기', '유물이 전하는 지역 역사에 관한 문제 풀기'], observationHint: '유물 이름과 무엇에 쓰였는지를 여행 메모에 함께 남기면 나만의 도감이 돼요.',
    question: '유물을 관찰할 때 당시 생활을 이해하는 데 도움이 되는 정보는 무엇일까요?', options: ['유물의 이름·용도·발견 장소', '전시실 조명의 개수', '박물관 창문의 색'], correctIndex: 0, explanation: '이름과 용도, 발견 장소를 함께 읽으면 대곡천 유역 사람들이 어떻게 살았는지 연결해 볼 수 있습니다.', collectionId: 'river-history', qrCode: 'BG-DAEGOK-26' },
];

/** App-issued demonstration codes, never official tourism QR codes or proof of presence. */
export const quizMissions: QuizGameMission[] = [...missions
  .filter((mission) => mission.options && mission.correctIndex !== undefined && qrCodes[mission.id])
  .map((mission): QuizGameMission => ({
    id: `qr-${mission.id}`,
    placeId: mission.placeId,
    kind: 'quiz',
    title: mission.placeId === 'bangudae' ? '고래 그림을 찾아라!' : mission.title,
    instruction: mission.instruction,
    question: mission.question,
    options: [...mission.options!],
    correctIndex: mission.correctIndex!,
    explanation: mission.explanation,
    collectionId: mission.collectionId,
    xp: 80,
    qrCode: qrCodes[mission.id],
    qrPayload: `bangucheon://quiz/v1/${qrCodes[mission.id]}`,
    sourceMissionId: mission.id,
    ...guideSteps[mission.placeId],
  })), ...additionalQuizzes.map((mission): QuizGameMission => ({ ...mission, kind: 'quiz', xp: 80, qrPayload: `bangucheon://quiz/v1/${mission.qrCode}` }))];

export const photoMissions: PhotoGameMission[] = [
  {
    id: 'photo-museum', placeId: 'museum', kind: 'photo', title: '모형 속 바위그림 수집',
    instruction: '박물관의 촬영 허용 구역에서 암각화 모형이나 관찰한 그림을 촬영하고, 눈에 들어온 대상을 골라 보세요.',
    subjects: ['고래', '사슴', '거북', '물고기', '기하학 문양', '기타'],
    explanation: '모형에서 관찰한 대상을 스스로 기록하는 미션입니다. 선택한 동물이 실제 사진에 있는지 자동 판별하지 않습니다.',
    collectionId: 'first-discovery', xp: 120,
    steps: ['박물관 모형 해설과 촬영 안내 확인하기', '고래·사슴·문양 중 하나를 골라 촬영하기', '대상과 선의 특징을 적고 관찰 카드 받기'],
    observationHint: '모형 전체보다 눈에 들어온 그림 하나를 자세히 살펴보세요.',
    notePlaceholder: '예: 모형의 고래 꼬리가 양쪽으로 펼쳐져 있고 몸통 옆에 지느러미가 있어요.',
  },
  {
    id: 'photo-bangudae', placeId: 'bangudae', kind: 'photo', title: '망원경 너머의 바위그림',
    instruction: '지정 관람 구역에서 망원경이나 공식 설명으로 본 바위그림을 사진과 메모로 남겨 보세요. 접안부 촬영이 허용되지 않거나 잘 보이지 않으면 촬영 허용 안내판·모형의 관찰 기록으로 대신할 수 있어요.',
    subjects: ['고래', '사슴', '거북', '물고기', '기타'],
    explanation: '사진·대상·메모를 보관하는 자기 관찰 기록입니다. AI 동물 인식이나 망원경·XR 이용 인증이 아닙니다. 사진을 위해 강을 건너거나 암면에 접근하지 마세요.',
    collectionId: 'whale-discovery', xp: 120,
    steps: ['전망대 QR 안내판·공식 해설에서 고래 그림 확인하기', '운영 중인 망원경이나 안내판에서 고래를 관찰하고 허용된 사진 남기기', '꼬리·지느러미 등 특징 한 가지를 기록하고 고래 카드 받기'],
    observationHint: '망원경 접안부 촬영이 금지된 경우 촬영 가능한 안내판이나 모형으로 기록하세요.',
    notePlaceholder: '예: 꼬리가 양쪽으로 넓고 몸통 옆에 작은 지느러미가 보여요.',
  },
  {
    id: 'photo-cheonjeonri', placeId: 'cheonjeonri', kind: 'photo', title: '그림과 문자의 시간 수집',
    instruction: '허용된 관람 구역에서 문양·문자 또는 촬영 가능한 공식 설명을 촬영하고, 관찰한 특징을 남겨 보세요. 촬영을 위해 암면에 다가가거나 손대지 마세요.',
    subjects: ['사슴', '기하학 문양', '문자', '기타'],
    explanation: '선택한 대상은 이용자의 관찰 메모이며 자동 인식 결과가 아닙니다. 현장 촬영 안내와 보호구역 경계를 따라 주세요.',
    collectionId: 'layers-of-time', xp: 120,
    steps: ['천전리의 문양·문자 해설 읽기', '기하학 문양 또는 문자를 골라 촬영 가능한 위치에서 사진 남기기', '선의 모양과 차이를 한 줄 적고 시간의 카드 받기'],
    observationHint: '마름모나 동심원과 문자 획의 생김새를 비교해 보세요.',
    notePlaceholder: '예: 마름모 문양은 선이 반복되고 문자에는 다른 방향의 짧은 획이 보여요.',
  },
];

export const gameMissions = [...quizMissions, ...photoMissions];
export const GAME_QR_NOTICE = '앱 체험용 QR · 테스트/운영자 배포용 · 공식 현장 QR 또는 방문 인증이 아닙니다.';
export const PHOTO_MISSION_NOTICE = '사진과 관찰 내용을 직접 남기는 기록입니다. AI 동물 인식·망원경 이용·현장 방문을 인증하지 않습니다.';
