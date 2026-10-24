'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameRuleError, getPhotoMission, summarizeGame, validatePhotoSubmission } from './game';
import type { GameSnapshot, PhotoSubmission } from './game';
import { gameStorage } from './game-storage';
import { compressPhoto, storageErrorMessage } from './storage';

export function useGame() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot>({ unlockedQuizIds: [], completions: {} });
  const mounted = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const run = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.current.catch(() => undefined).then(async () => {
      if (mounted.current) setError(null);
      try { return await operation(); }
      catch (cause) {
        const message = storageErrorMessage(cause);
        if (mounted.current) setError(message);
        if (cause instanceof GameRuleError) throw cause;
        throw new Error(message, { cause });
      }
    });
    queue.current = result.catch(() => undefined);
    return result;
  }, []);

  const reload = useCallback(async () => {
    const saved = await gameStorage.snapshot();
    if (mounted.current) setSnapshot(saved);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void run(reload).catch(() => undefined).finally(() => { if (mounted.current) setReady(true); });
    const refresh = () => { void run(reload).catch(() => undefined); };
    window.addEventListener('focus', refresh);
    return () => { mounted.current = false; window.removeEventListener('focus', refresh); };
  }, [reload, run]);

  const mutate = useCallback(<T,>(operation: () => Promise<T>) => run(async () => {
    const result = await operation();
    await reload();
    return result;
  }), [reload, run]);

  const unlockQr = useCallback((raw: string) => mutate(() => gameStorage.unlockQr(raw)), [mutate]);
  const confirmGuide = useCallback((missionId: string) => mutate(() => gameStorage.confirmGuide(missionId)), [mutate]);
  const completeQuiz = useCallback((missionId: string, answerIndex: number) =>
    mutate(() => gameStorage.completeQuiz(missionId, answerIndex)), [mutate]);
  const completePhoto = useCallback((missionId: string, input: PhotoSubmission) => mutate(async () => {
    const submission = validatePhotoSubmission(getPhotoMission(missionId), input);
    // Decode and compress before the transaction: failed/cancelled photos never earn rewards.
    const photo = await compressPhoto(submission.photo);
    return gameStorage.completePhoto(missionId, { ...submission, photo });
  }), [mutate]);
  const deleteCompletion = useCallback((missionId: string) => mutate(() => gameStorage.deleteCompletion(missionId)), [mutate]);
  const deletePlaceRecords = useCallback((placeId: string) => mutate(() => gameStorage.deletePlaceRecords(placeId)), [mutate]);
  const clearAll = useCallback(() => mutate(() => gameStorage.clearAll()), [mutate]);
  // Return data for a combined passport + game download/native share; do not start a second download.
  const exportData = useCallback(() => run(() => gameStorage.exportData()), [run]);

  return {
    ready, error, unlockedQuizIds: snapshot.unlockedQuizIds, completions: snapshot.completions,
    progress: summarizeGame(snapshot.completions), unlockQr, confirmGuide, completeQuiz, completePhoto,
    deleteCompletion, deletePlaceRecords, clearAll, exportData,
  };
}
