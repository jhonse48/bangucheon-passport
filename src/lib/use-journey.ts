'use client';

import { useEffect, useState } from 'react';
import { activeJourneyFrom, journeyDayKey, journeyVideoSnapshot, photoCoordinates } from './journey';
import type { JourneyAuthorization, JourneyPhoto, JourneyPhotoLocation, JourneyRecord, JourneyTrackingState } from './journey';
import { journeyStorage } from './journey-storage';
import type { JourneyStorage } from './journey-storage';
import { getJourneyTracker, subscribeJourneyAppActive } from './native-journey';
import type { JourneyTracker } from './native-journey';
import { compressPhoto, storageErrorMessage } from './storage';

export interface JourneyViewState {
  ready: boolean;
  error: string | null;
  journeys: JourneyRecord[];
  activeJourney: JourneyRecord | null;
  automaticEnabled: boolean;
  automaticSupported: boolean;
  authorization: JourneyAuthorization;
}

/** Decode/compress/thumbnail before opening an IndexedDB transaction. */
export async function prepareJourneyPhoto(blob: Blob): Promise<{ blob: Blob; thumbnailDataUrl: string }> {
  const compressed = await compressPhoto(blob);
  const objectUrl = URL.createObjectURL(compressed);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const candidate = new Image();
      candidate.onload = () => resolve(candidate);
      candidate.onerror = () => reject(new Error('사진 미리보기를 만들지 못했어요. 다시 시도해 주세요.'));
      candidate.src = objectUrl;
    });
    const scale = Math.min(1, 240 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('사진 미리보기를 만들 수 없어요.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.72);
    if (!thumbnailDataUrl.startsWith('data:image/jpeg;base64,')) throw new Error('사진 미리보기를 만들지 못했어요.');
    return { blob: compressed, thumbnailDataUrl };
  } finally { URL.revokeObjectURL(objectUrl); }
}

/** Controller is injectable for transaction/lifecycle regression tests; React only subscribes to its state. */
export function createJourneyController(options: {
  storage?: JourneyStorage;
  tracker?: JourneyTracker;
  now?: () => number;
  id?: () => string;
  preparePhoto?: typeof prepareJourneyPhoto;
  subscribeActive?: typeof subscribeJourneyAppActive;
} = {}) {
  const storage = options.storage ?? journeyStorage;
  const tracker = options.tracker ?? getJourneyTracker();
  const now = options.now ?? Date.now;
  const makeId = options.id ?? (() => crypto.randomUUID());
  const preparePhoto = options.preparePhoto ?? prepareJourneyPhoto;
  let view: JourneyViewState = { ready: false, error: null, journeys: [], activeJourney: null,
    automaticEnabled: false, automaticSupported: Boolean(tracker.setAutomaticTracking), authorization: 'notDetermined' };
  const listeners = new Set<() => void>();
  let queue: Promise<unknown> = Promise.resolve();
  let initialization: Promise<void> | null = null;
  let detachTracking: (() => void) | undefined;
  let detachActive: (() => void) | undefined;
  let disposed = false;
  let syncSuspended = false;
  // The retry sheet retains the same Blob. Reuse its ID if persistence succeeded but refreshing the UI failed.
  const photoRequestIds = new WeakMap<Blob, Map<string, string>>();
  const publish = (patch: Partial<JourneyViewState>) => {
    view = { ...view, ...patch };
    for (const listener of listeners) listener();
  };
  const setJourneys = (journeys: JourneyRecord[]) => publish({ journeys, activeJourney: activeJourneyFrom(journeys) });
  const load = async () => setJourneys(await storage.snapshot());
  const settings = (state: JourneyTrackingState) => {
    if (state.automatic) publish({ automaticEnabled: state.automatic.enabled, authorization: state.automatic.authorization });
  };

  async function haltAfterError(cause: unknown) {
    // A failing save can trigger a pause event. Do not turn that event into an infinite failing-save loop.
    syncSuspended = true;
    let pauseFailed = false;
    try { settings(await tracker.pauseTracking()); } catch {
      try { settings(await tracker.stopTracking()); } catch { pauseFailed = true; }
    }
    const message = storageErrorMessage(cause);
    const current = view.activeJourney;
    if (current?.status === 'recording') {
      const paused: JourneyRecord = { ...current, status: 'paused' };
      // Reflect the recorder stop immediately even if a quota error prevents persisting this status.
      setJourneys(view.journeys.map((journey) => journey.id === current.id ? paused : journey));
    }
    const automatic = view.automaticEnabled || current?.mode === 'automatic';
    const recovery = automatic ? '저장 공간·권한을 확인한 뒤 자동 기록을 껐다가 다시 켜 주세요.' : '저장 공간·권한을 확인한 뒤 재개해 주세요.';
    publish({ error: pauseFailed ? `${message} 위치 기록 중단도 확인하지 못했어요. 앱을 닫고 위치 권한을 확인해 주세요.`
      : current || automatic ? `${message} 위치 기록을 일시정지했어요. ${recovery}` : message });
  }
  function run<T>(operation: () => Promise<T>, clearError = true): Promise<T> {
    const result = queue.catch(() => undefined).then(async () => {
      if (clearError) { syncSuspended = false; publish({ error: null }); }
      try { return await operation(); }
      catch (cause) { await haltAfterError(cause); throw cause; }
    });
    queue = result.catch(() => undefined);
    return result;
  }
  const merge = async (state: JourneyTrackingState) => {
    settings(state);
    const journeys = await storage.reconcileTrackingState(state, now());
    setJourneys(journeys);
    if (state.archived?.length) {
      if (!tracker.acknowledgeArchived) throw new Error('하루 기록을 보관했지만 원본 확인을 마치지 못했어요. 앱을 다시 열어 주세요.');
      // Clearing native archives is authorized only after the whole IDB transaction committed.
      await tracker.acknowledgeArchived({ journeyIds: [...new Set(state.archived.map((archive) => archive.journeyId))] });
    }
    if (state.journeyId && state.status !== 'idle') {
      const saved = journeys.find((journey) => journey.id === state.journeyId);
      // A deleted or already completed session must never keep collecting locations after recovery.
      if (!saved || saved.status === 'completed') {
        if (state.automatic?.enabled && tracker.setAutomaticTracking) settings(await tracker.setAutomaticTracking({ enabled: false }));
        await tracker.stopTracking();
        settings(await tracker.clearTracking());
      }
    }
    if (state.error) publish({ error: state.error });
  };
  const refresh = () => run(async () => { await merge(await tracker.getTrackingState()); }, false);
  const current = () => {
    if (!view.activeJourney) throw new Error('여정을 먼저 시작해 주세요.');
    return view.activeJourney;
  };

  async function initialize(): Promise<void> {
    if (initialization) return initialization;
    initialization = (async () => {
      try {
        // Events schedule a fresh native read rather than replaying an already superseded status payload.
        const listener = await tracker.addListener('trackingUpdate', () => { if (!syncSuspended && !disposed) void refresh().catch(() => undefined); });
        if (disposed) { await listener.remove(); return; }
        detachTracking = () => { void listener.remove(); };
        const removeActive = await (options.subscribeActive ?? subscribeJourneyAppActive)(() => { void refresh().catch(() => undefined); });
        if (disposed) { removeActive(); return; }
        detachActive = removeActive;
        await refresh();
      } catch (error) {
        if (!view.error) await haltAfterError(error);
        throw error;
      } finally { publish({ ready: true }); }
    })();
    return initialization;
  }

  const start = () => run(async () => {
    await merge(await tracker.getTrackingState());
    if (view.automaticEnabled) throw new Error('자동 기록이 켜져 있어요. 오늘의 기록을 확인해 주세요.');
    if (view.activeJourney) throw new Error('진행 중인 여정을 먼저 마쳐 주세요.');
    const record = await storage.create(makeId(), now());
    await load();
    try {
      const state = await tracker.startTracking({ journeyId: record.id });
      await merge(state);
      if (state.status !== 'recording') throw new Error(state.error ?? '위치 기록을 시작하지 못했어요.');
    } catch (error) {
      await storage.setStatus(record.id, 'paused', now());
      await load();
      throw error;
    }
    return view.journeys.find((journey) => journey.id === record.id)!;
  });
  const pause = () => run(async () => {
    const record = current();
    const state = record.mode === 'automatic' && tracker.setAutomaticTracking
      ? await tracker.setAutomaticTracking({ enabled: false }) : await tracker.pauseTracking();
    await merge(state);
    if (!state.journeyId) { await storage.setStatus(record.id, 'paused', now()); await load(); }
    return view.journeys.find((journey) => journey.id === record.id) ?? null;
  });
  const resume = () => run(async () => {
    const record = current();
    if (record.mode === 'automatic' && tracker.setAutomaticTracking) {
      await merge(await tracker.setAutomaticTracking({ enabled: true }));
      return view.activeJourney;
    }
    const state = await tracker.getTrackingState();
    if (state.journeyId === record.id && state.status === 'idle') {
      await merge(state);
      throw new Error('이미 마친 여정을 복구했어요. 기록을 확인하거나 새 여정을 시작해 주세요.');
    }
    if (state.journeyId && state.journeyId !== record.id && state.status !== 'idle') {
      await merge(state);
      throw new Error('다른 여정의 위치 기록을 복구했어요. 현재 여정을 확인해 주세요.');
    }
    if (!state.journeyId || state.journeyId !== record.id) {
      await storage.prepareRestart(record.id, now());
      await merge(await tracker.startTracking({ journeyId: record.id }));
    } else await merge(await tracker.resumeTracking());
    if (view.activeJourney?.status !== 'recording') throw new Error(view.error ?? '위치 기록을 재개하지 못했어요.');
    return view.activeJourney;
  });
  const finish = () => run(async () => {
    const record = current();
    if (record.mode === 'automatic') throw new Error('자동 기록은 날짜별로 보관돼요. 기록을 멈추려면 자동 기록을 꺼 주세요.');
    // Stop and persist the native buffer first; if IDB fails, the idle buffer is recovered at next launch.
    const stopped = await tracker.stopTracking();
    await merge(stopped);
    await storage.setStatus(record.id, 'completed', now());
    await load();
    return view.journeys.find((journey) => journey.id === record.id) ?? null;
  });
  const addPhoto = (blob: Blob, location?: JourneyPhotoLocation, sourceMissionId?: string, expectedJourneyId?: string): Promise<JourneyPhoto> => {
    const createdAt = now();
    const coordinates = photoCoordinates(location, createdAt);
    const targetId = expectedJourneyId ?? view.activeJourney?.id;
    let requestId: string | undefined;
    if (targetId) {
      const targets = photoRequestIds.get(blob) ?? new Map<string, string>();
      requestId = targets.get(targetId) ?? makeId();
      targets.set(targetId, requestId); photoRequestIds.set(blob, targets);
    }
    return run(async () => {
      const record = current();
      if (!targetId || record.id !== targetId) throw new Error('사진을 촬영한 여정이 변경되었어요. 이 사진을 다른 여정에 자동으로 저장하지 않았어요.');
      const existing = record.photos.find((photo) => photo.id === requestId || (sourceMissionId && photo.sourceMissionId === sourceMissionId));
      if (existing) return existing;
      const prepared = await preparePhoto(blob);
      const photo: JourneyPhoto = { id: requestId!, createdAt, ...coordinates, ...prepared, ...(sourceMissionId ? { sourceMissionId } : {}) };
      const saved = await storage.addPhoto(record.id, photo);
      // A storage-error pause may not have reached IDB. Never reload its stale recording flag as active GPS.
      await merge(await tracker.getTrackingState());
      return saved;
    });
  };
  const deleteJourney = (id: string) => run(async () => {
    const native = await tracker.getTrackingState();
    await merge(native);
    if (native.journeyId === id || view.activeJourney?.id === id) {
      if (tracker.setAutomaticTracking) await merge(await tracker.setAutomaticTracking({ enabled: false }));
      await tracker.stopTracking();
      settings(await tracker.clearTracking());
    }
    await storage.deleteJourney(id); await load();
  });
  const clearAll = () => run(async () => {
    if (tracker.setAutomaticTracking) settings(await tracker.setAutomaticTracking({ enabled: false }));
    await tracker.stopTracking();
    settings(await tracker.clearTracking());
    await storage.clearAll(); await load();
  });
  const exportData = () => run(async () => { await merge(await tracker.getTrackingState()); return storage.exportData(); });
  const setAutomatic = (enabled: boolean) => run(async () => {
    if (!tracker.setAutomaticTracking) throw new Error('자동 하루 기록은 iPhone 앱에서 이용해 주세요.');
    // Turning consent off must succeed even when importing history would hit a storage quota error.
    // Native OFF retains all buffers; they can be imported and acknowledged after storage is available again.
    if (enabled) {
      await merge(await tracker.getTrackingState());
      const legacy = view.activeJourney;
      // Old native buffers did not have a start date. IDB can identify a photo-only manual session from a prior day.
      if (legacy && legacy.mode !== 'automatic' && journeyDayKey(legacy.startedAt) !== journeyDayKey(now())) {
        await merge(await tracker.stopTracking());
        await storage.setStatus(legacy.id, 'completed', now());
        await load();
      }
    }
    const state = await tracker.setAutomaticTracking({ enabled });
    await merge(state);
    if (enabled && (state.automatic?.authorization === 'denied' || state.automatic?.authorization === 'restricted')) {
      throw new Error('위치 권한이 없어 자동 기록을 시작하지 못했어요. iPhone 설정에서 위치 접근을 허용해 주세요.');
    }
    return view.activeJourney;
  });
  const requestBackgroundAuthorization = () => run(async () => {
    if (!tracker.requestBackgroundAuthorization) throw new Error('백그라운드 위치 설정은 iPhone 앱에서 이용해 주세요.');
    await merge(await tracker.requestBackgroundAuthorization());
    return view.authorization;
  });
  const ensureAutomaticJourney = () => run(async () => {
    if (!tracker.ensureAutomaticJourney) throw new Error('자동 하루 기록은 iPhone 앱에서 이용해 주세요.');
    await merge(await tracker.getTrackingState());
    if (!view.automaticEnabled) throw new Error('자동 기록을 먼저 켜 주세요.');
    await merge(await tracker.ensureAutomaticJourney());
    return view.activeJourney;
  });
  const videoSnapshot = (id: string) => run(async () => {
    await merge(await tracker.getTrackingState());
    const record = view.journeys.find((journey) => journey.id === id);
    if (!record) throw new Error('영상으로 만들 기록을 찾지 못했어요.');
    return journeyVideoSnapshot(record, now());
  });

  return {
    initialize, refresh, start, pause, resume, finish, addPhoto, deleteJourney, clearAll, exportData,
    setAutomatic, requestBackgroundAuthorization, ensureAutomaticJourney, videoSnapshot,
    getSnapshot: () => view,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispose() { disposed = true; detachTracking?.(); detachActive?.(); listeners.clear(); },
  };
}

let sharedController: ReturnType<typeof createJourneyController> | undefined;
function defaultController() { sharedController ??= createJourneyController(); return sharedController; }

export function useJourney() {
  const [controller] = useState(defaultController);
  const [view, setView] = useState(controller.getSnapshot);
  useEffect(() => {
    const unsubscribe = controller.subscribe(() => setView(controller.getSnapshot()));
    void controller.initialize().catch(() => undefined);
    return unsubscribe;
  }, [controller]);
  return { ...view, start: controller.start, pause: controller.pause, resume: controller.resume, finish: controller.finish,
    addPhoto: controller.addPhoto, deleteJourney: controller.deleteJourney, clearAll: controller.clearAll,
    exportData: controller.exportData, refresh: controller.refresh, setAutomatic: controller.setAutomatic,
    requestBackgroundAuthorization: controller.requestBackgroundAuthorization,
    ensureAutomaticJourney: controller.ensureAutomaticJourney, videoSnapshot: controller.videoSnapshot };
}
