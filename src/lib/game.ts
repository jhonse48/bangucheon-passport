import { gameMissions, quizMissions } from '../data/game-missions';

interface BaseGameMission {
  id: string;
  placeId: string;
  title: string;
  instruction: string;
  explanation: string;
  collectionId: string;
  xp: number;
  steps: [string, string, string];
  observationHint: string;
}
export interface QuizGameMission extends BaseGameMission {
  kind: 'quiz';
  question: string;
  options: string[];
  correctIndex: number;
  qrCode: string;
  qrPayload: string;
  sourceMissionId?: string;
}
export interface PhotoGameMission extends BaseGameMission {
  kind: 'photo';
  subjects: string[];
  notePlaceholder: string;
}
export type GameMission = QuizGameMission | PhotoGameMission;
export type QuizMission = QuizGameMission;
export type PhotoMission = PhotoGameMission;
export interface PhotoSubmission {
  photo: Blob;
  subject: string;
  note: string;
}
export interface GameCompletion {
  missionId: string;
  placeId: string;
  kind: GameMission['kind'];
  completedAt: string;
  xp: number;
  collectionId: string;
  answerIndex?: number;
  photo?: Blob;
  subject?: string;
  note?: string;
}
export interface GameUnlock {
  missionId: string;
  unlockedAt: string;
  source: 'app-qr' | 'guide-confirmation';
}
export interface GameSnapshot {
  unlockedQuizIds: string[];
  completions: Record<string, GameCompletion>;
}
export interface CompletionResult {
  completion: GameCompletion;
  alreadyCompleted: boolean;
}
export interface UnlockResult {
  missionId: string;
  alreadyUnlocked: boolean;
}

export class GameRuleError extends Error {
  constructor(public readonly code: 'INVALID_QR' | 'UNKNOWN_MISSION' | 'LOCKED' | 'WRONG_ANSWER' | 'INVALID_PHOTO' | 'INVALID_SUBJECT' | 'INVALID_NOTE', message: string) {
    super(message);
    this.name = 'GameRuleError';
  }
}

export function getGameMission(missionId: string): GameMission {
  const mission = gameMissions.find((item) => item.id === missionId);
  if (!mission) throw new GameRuleError('UNKNOWN_MISSION', '등록되지 않은 미션이에요. 장소에서 미션을 다시 열어 주세요.');
  return mission;
}

export function getQuizMission(missionId: string): QuizGameMission {
  const mission = getGameMission(missionId);
  if (mission.kind !== 'quiz') throw new GameRuleError('UNKNOWN_MISSION', 'QR 퀴즈 미션을 선택해 주세요.');
  return mission;
}

export function getPhotoMission(missionId: string): PhotoGameMission {
  const mission = getGameMission(missionId);
  if (mission.kind !== 'photo') throw new GameRuleError('UNKNOWN_MISSION', '사진 관찰 미션을 선택해 주세요.');
  return mission;
}

export function getQrPayload(missionId: string): string { return getQuizMission(missionId).qrPayload; }
export function getQrInputCode(missionId: string): string { return getQuizMission(missionId).qrCode; }

/** Exact allowlist only. Do not follow links, decode nested URLs or trust arbitrary official QR URLs. */
export function parseQrPayload(raw: string): QuizGameMission {
  if (typeof raw !== 'string' || raw.length > 200) throw invalidQr();
  const value = raw.trim();
  const mission = quizMissions.find((item) => value === item.qrPayload || value.toUpperCase() === item.qrCode);
  if (!mission) throw invalidQr();
  return mission;
}

function invalidQr() {
  return new GameRuleError('INVALID_QR', '이 앱의 체험용 QR 또는 짧은 코드가 아니에요. 공식 현장 안내 QR은 자동 인증하지 않으며, 지도와 관광 안내는 QR 없이 이용할 수 있어요.');
}

export function assertQuizAnswer(mission: QuizGameMission, answerIndex: number): void {
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= mission.options.length || answerIndex !== mission.correctIndex) {
    throw new GameRuleError('WRONG_ANSWER', '조금 더 관찰해 볼까요? 공식 설명을 살펴보고 다시 골라 주세요. 아직 XP나 스탬프는 지급되지 않았어요.');
  }
}

export function validatePhotoSubmission(mission: PhotoGameMission, input: PhotoSubmission): PhotoSubmission {
  if (!input || !(input.photo instanceof Blob) || input.photo.size === 0 || !['image/jpeg', 'image/png', 'image/webp'].includes(input.photo.type)) {
    throw new GameRuleError('INVALID_PHOTO', '촬영한 JPG·PNG·WebP 사진을 먼저 준비해 주세요. 촬영을 취소하면 보상 없이 미션으로 돌아갑니다.');
  }
  if (input.photo.size > 20 * 1024 * 1024) throw new GameRuleError('INVALID_PHOTO', '사진은 20MB 이하로 준비해 주세요.');
  if (!mission.subjects.includes(input.subject)) throw new GameRuleError('INVALID_SUBJECT', '이 미션에서 관찰한 대상을 목록에서 선택해 주세요.');
  if (typeof input.note !== 'string' || !input.note.trim() || input.note.length > 2000) {
    throw new GameRuleError('INVALID_NOTE', '관찰한 특징을 1~2,000자 메모로 남겨 주세요.');
  }
  return { photo: input.photo, subject: input.subject, note: input.note.trim() };
}

export function makeCompletion(mission: GameMission, now = new Date().toISOString()): GameCompletion {
  return { missionId: mission.id, placeId: mission.placeId, kind: mission.kind, completedAt: now, xp: mission.xp, collectionId: mission.collectionId };
}

export const GAME_LEVELS = [
  { xp: 0, name: '새싹 탐험가' },
  { xp: 120, name: '바위그림 관찰자' },
  { xp: 300, name: '반구천 길잡이' },
  { xp: 540, name: '유산 탐험가' },
  { xp: 840, name: '반구천 수집가' },
] as const;

/** Rewards are derived from unique known mission completions, never a mutable XP counter. */
export function summarizeGame(completions: Readonly<Record<string, GameCompletion>>) {
  const completedMissions = gameMissions.filter((mission) => {
    const completion = completions[mission.id];
    return completion?.missionId === mission.id && completion.placeId === mission.placeId && completion.kind === mission.kind;
  });
  const xp = completedMissions.reduce((sum, mission) => sum + mission.xp, 0);
  let levelIndex = 0;
  for (let index = 1; index < GAME_LEVELS.length; index += 1) if (xp >= GAME_LEVELS[index].xp) levelIndex = index;
  const current = GAME_LEVELS[levelIndex];
  const next = GAME_LEVELS[levelIndex + 1];
  return {
    xp,
    level: levelIndex + 1,
    levelName: current.name,
    nextLevelXp: next?.xp ?? null,
    xpToNextLevel: next ? Math.max(0, next.xp - xp) : 0,
    levelProgress: next ? Math.round((xp - current.xp) / (next.xp - current.xp) * 100) : 100,
    stampPlaceIds: [...new Set(completedMissions.map((mission) => mission.placeId))],
    collectionIds: [...new Set(completedMissions.map((mission) => mission.collectionId))],
    completedCount: completedMissions.length,
    quizCount: completedMissions.filter((mission) => mission.kind === 'quiz').length,
    photoCount: completedMissions.filter((mission) => mission.kind === 'photo').length,
  };
}

export type GameProgress = ReturnType<typeof summarizeGame>;
