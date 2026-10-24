import { gameMissions, quizMissions } from '../data/game-missions';
import { assertQuizAnswer, GameRuleError, getGameMission, getPhotoMission, getQuizMission, makeCompletion, parseQrPayload, summarizeGame, validatePhotoSubmission } from './game';
import type { CompletionResult, GameCompletion, GameSnapshot, GameUnlock, PhotoSubmission, UnlockResult } from './game';

const DB_NAME = 'bangucheon-game';
const COMPLETIONS = 'completions';
const UNLOCKS = 'unlocks';

export interface GameExport {
  format: 'bangucheon-game';
  version: 1;
  exportedAt: string;
  notice: string;
  unlockedQuizIds: string[];
  progress: ReturnType<typeof summarizeGame>;
  completions: Array<Omit<GameCompletion, 'photo'> & {
    photo?: { mimeType: string; byteLength: number; encoding: 'base64'; data: string };
  }>;
}

export function createGameStorage(options: { indexedDB?: IDBFactory; databaseName?: string } = {}) {
  let connection: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    if (connection) return connection;
    const factory = options.indexedDB ?? globalThis.indexedDB;
    if (!factory) return Promise.reject(new DOMException('이 환경에서는 게임 기록 저장소를 사용할 수 없어요.', 'NotSupportedError'));
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(options.databaseName ?? DB_NAME, 1);
      let settled = false;
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(COMPLETIONS)) db.createObjectStore(COMPLETIONS, { keyPath: 'missionId' });
        if (!db.objectStoreNames.contains(UNLOCKS)) db.createObjectStore(UNLOCKS, { keyPath: 'missionId' });
      };
      request.onerror = () => { settled = true; reject(request.error ?? new Error('게임 기록 저장소를 열지 못했어요.')); };
      request.onblocked = () => { settled = true; reject(new Error('다른 탐험여권 탭을 닫고 게임 기록을 다시 열어 주세요.')); };
      request.onsuccess = () => {
        const db = request.result;
        if (settled) { db.close(); return; }
        db.onversionchange = () => { db.close(); connection = null; };
        db.onclose = () => { connection = null; };
        resolve(db);
      };
    }).catch((error: unknown) => { connection = null; throw error; });
    return connection;
  }

  async function transact<T>(storeNames: string[], mode: IDBTransactionMode,
    body: (transaction: IDBTransaction, result: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeNames, mode);
      let result: T;
      let failure: unknown;
      const fail = (error: unknown) => {
        failure = error;
        try { transaction.abort(); } catch { reject(error); }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('게임 기록 저장이 취소됐어요. 다시 시도해 주세요.'));
      // Request success alone is not a committed save. Resolve only on transaction completion.
      transaction.onerror = () => undefined;
      try { body(transaction, (value) => { result = value; }, fail); }
      catch (error) { fail(error); }
    });
  }

  function read<T>(request: IDBRequest<T>, success: (value: T) => void, fail: (error: unknown) => void) {
    request.onsuccess = () => { try { success(request.result); } catch (error) { fail(error); } };
  }

  async function snapshot(): Promise<GameSnapshot> {
    return transact([COMPLETIONS, UNLOCKS], 'readonly', (transaction, result, fail) => {
      let savedCompletions: GameCompletion[] | undefined;
      let savedUnlocks: GameUnlock[] | undefined;
      const finish = () => {
        if (!savedCompletions || !savedUnlocks) return;
        result({
          completions: Object.fromEntries(savedCompletions.map((item) => [item.missionId, item])),
          unlockedQuizIds: savedUnlocks.map((item) => item.missionId).filter((id) => quizMissions.some((mission) => mission.id === id)),
        });
      };
      read(transaction.objectStore(COMPLETIONS).getAll(), (value: GameCompletion[]) => { savedCompletions = value; finish(); }, fail);
      read(transaction.objectStore(UNLOCKS).getAll(), (value: GameUnlock[]) => { savedUnlocks = value; finish(); }, fail);
    });
  }

  async function unlockQr(raw: string): Promise<UnlockResult> {
    const mission = parseQrPayload(raw);
    return unlockMission(mission.id, 'app-qr');
  }

  // Reading a guide is a self-confirmed learning step, never proof of scanning or visiting.
  async function confirmGuide(missionId: string): Promise<UnlockResult> {
    const mission = getQuizMission(missionId);
    return unlockMission(mission.id, 'guide-confirmation');
  }

  async function unlockMission(missionId: string, source: GameUnlock['source']): Promise<UnlockResult> {
    return transact([UNLOCKS], 'readwrite', (transaction, result, fail) => {
      const store = transaction.objectStore(UNLOCKS);
      read(store.get(missionId), (existing: GameUnlock | undefined) => {
        if (!existing) store.add({ missionId, unlockedAt: new Date().toISOString(), source } satisfies GameUnlock);
        result({ missionId, alreadyUnlocked: Boolean(existing) });
      }, fail);
    });
  }

  async function completeQuiz(missionId: string, answerIndex: number): Promise<CompletionResult> {
    const mission = getQuizMission(missionId);
    assertQuizAnswer(mission, answerIndex);
    return transact([COMPLETIONS, UNLOCKS], 'readwrite', (transaction, result, fail) => {
      const completions = transaction.objectStore(COMPLETIONS);
      read(completions.get(mission.id), (existing: GameCompletion | undefined) => {
        if (existing) { result({ completion: existing, alreadyCompleted: true }); return; }
        read(transaction.objectStore(UNLOCKS).get(mission.id), (unlocked: GameUnlock | undefined) => {
          if (!unlocked) throw new GameRuleError('LOCKED', '장소의 해설 확인을 마치거나 앱 미션 QR로 퀴즈를 먼저 열어 주세요.');
          const completion: GameCompletion = { ...makeCompletion(mission), answerIndex };
          completions.add(completion);
          result({ completion, alreadyCompleted: false });
        }, fail);
      }, fail);
    });
  }

  async function completePhoto(missionId: string, input: PhotoSubmission): Promise<CompletionResult> {
    const mission = getPhotoMission(missionId);
    const submission = validatePhotoSubmission(mission, input);
    return transact([COMPLETIONS], 'readwrite', (transaction, result, fail) => {
      const store = transaction.objectStore(COMPLETIONS);
      read(store.get(mission.id), (existing: GameCompletion | undefined) => {
        if (existing) { result({ completion: existing, alreadyCompleted: true }); return; }
        const completion: GameCompletion = { ...makeCompletion(mission), ...submission };
        store.add(completion);
        result({ completion, alreadyCompleted: false });
      }, fail);
    });
  }

  async function deleteCompletion(missionId: string): Promise<void> {
    getGameMission(missionId);
    return transact([COMPLETIONS], 'readwrite', (transaction, result) => {
      transaction.objectStore(COMPLETIONS).delete(missionId);
      result(undefined);
    });
  }

  async function deletePlaceRecords(placeId: string): Promise<void> {
    const placeMissions = gameMissions.filter((mission) => mission.placeId === placeId);
    if (!placeMissions.length) return;
    return transact([COMPLETIONS, UNLOCKS], 'readwrite', (transaction, result) => {
      for (const mission of placeMissions) {
        transaction.objectStore(COMPLETIONS).delete(mission.id);
        transaction.objectStore(UNLOCKS).delete(mission.id);
      }
      result(undefined);
    });
  }

  async function clearAll(): Promise<void> {
    return transact([COMPLETIONS, UNLOCKS], 'readwrite', (transaction, result) => {
      transaction.objectStore(COMPLETIONS).clear();
      transaction.objectStore(UNLOCKS).clear();
      result(undefined);
    });
  }

  async function exportData(): Promise<GameExport> {
    const saved = await snapshot();
    const completions = await Promise.all(Object.values(saved.completions).map(async (completion) => {
      const { photo, ...rest } = completion;
      if (!photo) return rest;
      const bytes = new Uint8Array(await photo.arrayBuffer());
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      return { ...rest, photo: { mimeType: photo.type, byteLength: photo.size, encoding: 'base64' as const, data: btoa(binary) } };
    }));
    return {
      format: 'bangucheon-game', version: 1, exportedAt: new Date().toISOString(),
      notice: '앱 체험용 퀴즈와 자기 관찰 기록입니다. 공식 방문·QR·망원경 인증이나 AI 사진 인식 결과가 아닙니다.',
      unlockedQuizIds: saved.unlockedQuizIds, progress: summarizeGame(saved.completions), completions,
    };
  }

  return {
    snapshot, unlockQr, confirmGuide, completeQuiz, completePhoto, deleteCompletion, deletePlaceRecords, clearAll, exportData,
    async close() {
      const current = connection;
      connection = null;
      if (current) (await current).close();
    },
  };
}

export const gameStorage = createGameStorage();
