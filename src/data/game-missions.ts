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

/** App-issued demonstration codes, never official tourism QR codes or proof of presence. */
export const quizMissions: QuizGameMission[] = missions
  .filter((mission) => mission.options && mission.correctIndex !== undefined && qrCodes[mission.id])
  .map((mission) => ({
    id: `qr-${mission.id}`,
    placeId: mission.placeId,
    kind: 'quiz',
    title: mission.title,
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
  }));

export const photoMissions: PhotoGameMission[] = [
  {
    id: 'photo-museum', placeId: 'museum', kind: 'photo', title: '모형 속 바위그림 수집',
    instruction: '박물관의 촬영 허용 구역에서 암각화 모형이나 관찰한 그림을 촬영하고, 눈에 들어온 대상을 골라 보세요.',
    subjects: ['고래', '사슴', '거북', '물고기', '기하학 문양', '기타'],
    explanation: '모형에서 관찰한 대상을 스스로 기록하는 미션입니다. 선택한 동물이 실제 사진에 있는지 자동 판별하지 않습니다.',
    collectionId: 'first-discovery', xp: 120,
  },
  {
    id: 'photo-bangudae', placeId: 'bangudae', kind: 'photo', title: '망원경 너머의 바위그림',
    instruction: '지정 관람 구역에서 망원경이나 공식 설명으로 본 바위그림을 사진과 메모로 남겨 보세요. 접안부 촬영이 허용되지 않거나 잘 보이지 않으면 촬영 허용 안내판·모형의 관찰 기록으로 대신할 수 있어요.',
    subjects: ['고래', '사슴', '거북', '물고기', '기타'],
    explanation: '사진·대상·메모를 보관하는 자기 관찰 기록입니다. AI 동물 인식이나 망원경·XR 이용 인증이 아닙니다. 사진을 위해 강을 건너거나 암면에 접근하지 마세요.',
    collectionId: 'whale-discovery', xp: 120,
  },
  {
    id: 'photo-cheonjeonri', placeId: 'cheonjeonri', kind: 'photo', title: '그림과 문자의 시간 수집',
    instruction: '허용된 관람 구역에서 문양·문자 또는 촬영 가능한 공식 설명을 촬영하고, 관찰한 특징을 남겨 보세요. 촬영을 위해 암면에 다가가거나 손대지 마세요.',
    subjects: ['사슴', '기하학 문양', '문자', '기타'],
    explanation: '선택한 대상은 이용자의 관찰 메모이며 자동 인식 결과가 아닙니다. 현장 촬영 안내와 보호구역 경계를 따라 주세요.',
    collectionId: 'layers-of-time', xp: 120,
  },
];

export const gameMissions = [...quizMissions, ...photoMissions];
export const GAME_QR_NOTICE = '앱 체험용 QR · 테스트/운영자 배포용 · 공식 현장 QR 또는 방문 인증이 아닙니다.';
export const PHOTO_MISSION_NOTICE = '사진과 관찰 내용을 직접 남기는 기록입니다. AI 동물 인식·망원경 이용·현장 방문을 인증하지 않습니다.';
