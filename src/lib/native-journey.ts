import { Capacitor, registerPlugin } from '@capacitor/core';
import type { JourneyTrackingState } from './journey';
import { normalizeJourneyPoints } from './journey';

export interface JourneyListenerHandle { remove(): Promise<void> | void }
export interface JourneyTracker {
  startTracking(options: { journeyId: string }): Promise<JourneyTrackingState>;
  pauseTracking(): Promise<JourneyTrackingState>;
  resumeTracking(): Promise<JourneyTrackingState>;
  stopTracking(): Promise<JourneyTrackingState>;
  clearTracking(): Promise<JourneyTrackingState>;
  getTrackingState(): Promise<JourneyTrackingState>;
  setAutomaticTracking?(options: { enabled: boolean }): Promise<JourneyTrackingState>;
  requestBackgroundAuthorization?(): Promise<JourneyTrackingState>;
  ensureAutomaticJourney?(): Promise<JourneyTrackingState>;
  acknowledgeArchived?(options: { journeyIds: string[] }): Promise<void>;
  addListener(event: 'trackingUpdate', callback: (state: JourneyTrackingState) => void): Promise<JourneyListenerHandle>;
}

export const JourneyNative = registerPlugin<JourneyTracker>('JourneyNative');
export const isNativeJourney = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

/** Browser QA only. No permissions/watch are requested by construction or getTrackingState. */
export function createBrowserJourneyTracker(): JourneyTracker {
  let state: JourneyTrackingState = { journeyId: null, status: 'idle', points: [] };
  let watcher: number | null = null;
  let segment = 0;
  let startedAt = 0;
  const listeners = new Set<(state: JourneyTrackingState) => void>();
  const copy = () => ({ ...state, points: state.points.map((point) => ({ ...point })) });
  const emit = () => { for (const listener of listeners) listener(copy()); };
  const clearWatch = () => {
    if (watcher !== null && typeof navigator !== 'undefined') navigator.geolocation?.clearWatch(watcher);
    watcher = null;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibilityChanged);
  };
  const pause = (message?: string) => {
    clearWatch();
    if (state.status !== 'idle') state = { ...state, status: 'paused', error: message };
    emit();
    return copy();
  };
  function visibilityChanged() {
    if (document.visibilityState === 'hidden' && state.status === 'recording') {
      pause('브라우저 미리보기는 화면이 열려 있을 때만 기록해요. 화면을 떠나 기록을 일시정지했습니다. 재개를 눌러 주세요.');
    }
  }
  const watch = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) throw new Error('위치를 사용할 수 없어요. iPhone 앱에서 여정을 시작해 주세요.');
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') throw new Error('브라우저 화면을 연 뒤 여정을 재개해 주세요.');
    clearWatch();
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibilityChanged);
    watcher = navigator.geolocation.watchPosition((position) => {
      if (state.status !== 'recording') return;
      const now = Date.now();
      // Cached fixes are not evidence of movement after the user starts/resumes.
      if (position.timestamp < now - 30_000 || position.timestamp < startedAt) return;
      state = { ...state, points: normalizeJourneyPoints([...state.points, {
        lat: position.coords.latitude, lng: position.coords.longitude,
        timestamp: position.timestamp, accuracy: position.coords.accuracy, segment,
      }], startedAt, now), error: undefined };
      emit();
    }, (error) => {
      pause(error.code === 1 ? '위치 권한이 없어 여정 기록을 일시정지했어요. 권한을 확인하고 재개해 주세요.'
        : '현재 위치를 찾지 못해 기록을 일시정지했어요. 야외에서 재개해 주세요.');
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
  };
  return {
    async getTrackingState() { return copy(); },
    async startTracking({ journeyId }) {
      if (state.journeyId === journeyId) return copy();
      clearWatch();
      startedAt = Date.now(); segment = 0;
      state = { journeyId, status: 'recording', points: [] };
      try { watch(); } catch (error) { pause(error instanceof Error ? error.message : String(error)); throw error; }
      emit(); return copy();
    },
    async pauseTracking() { return pause(); },
    async resumeTracking() {
      if (!state.journeyId || state.status === 'idle') throw new Error('재개할 여정을 찾지 못했어요.');
      if (state.status === 'recording') return copy();
      segment += 1;
      state = { ...state, status: 'recording', error: undefined };
      try { watch(); } catch (error) { pause(error instanceof Error ? error.message : String(error)); throw error; }
      emit(); return copy();
    },
    async stopTracking() { clearWatch(); state = { ...state, status: 'idle', error: undefined }; emit(); return copy(); },
    async clearTracking() { clearWatch(); state = { journeyId: null, status: 'idle', points: [] }; emit(); return copy(); },
    async addListener(_event, callback) { listeners.add(callback); return { remove() { listeners.delete(callback); } }; },
  };
}

let browserTracker: JourneyTracker | undefined;
export function getJourneyTracker(): JourneyTracker {
  if (isNativeJourney()) return JourneyNative;
  browserTracker ??= createBrowserJourneyTracker();
  return browserTracker;
}

/** Reading/syncing after app activation does not request location permission. */
export async function subscribeJourneyAppActive(refresh: () => void): Promise<() => void> {
  if (isNativeJourney()) {
    const { App } = await import('@capacitor/app');
    const listener = await App.addListener('appStateChange', ({ isActive }) => { if (isActive) refresh(); });
    return () => { void listener.remove(); };
  }
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener('focus', refresh);
  return () => window.removeEventListener('focus', refresh);
}
