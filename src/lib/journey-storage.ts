import { journeyDayKey, newJourney, normalizeJourneyPoints, photoCoordinates } from './journey';
import type { JourneyPhoto, JourneyRecord, JourneyTrackingSnapshot, JourneyTrackingState } from './journey';

const DB_NAME = 'bangucheon-journeys';
const JOURNEYS = 'journeys';
const META = 'meta';
interface JourneyMeta { id: string; deleted?: boolean; restartAt?: number; segmentOffset?: number }
export interface JourneyExport {
  format: 'bangucheon-journeys'; version: 1; exportedAt: string; notice: string;
  journeys: Array<Omit<JourneyRecord, 'photos'> & { photos: Array<Omit<JourneyPhoto, 'blob'> & {
    blob: { mimeType: string; byteLength: number; encoding: 'base64'; data: string };
  }> }>;
}

export function createJourneyStorage(options: { indexedDB?: IDBFactory; databaseName?: string } = {}) {
  let connection: Promise<IDBDatabase> | null = null;
  function open(): Promise<IDBDatabase> {
    if (connection) return connection;
    const factory = options.indexedDB ?? globalThis.indexedDB;
    if (!factory) return Promise.reject(new DOMException('이 환경에서는 여정 기록 저장소를 사용할 수 없어요.', 'NotSupportedError'));
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(options.databaseName ?? DB_NAME, 1);
      let settled = false;
      request.onupgradeneeded = () => {
        for (const name of [JOURNEYS, META]) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' });
      };
      request.onerror = () => { settled = true; reject(request.error ?? new Error('여정 저장소를 열지 못했어요.')); };
      request.onblocked = () => { settled = true; reject(new Error('다른 탐험지도 탭을 닫고 다시 시도해 주세요.')); };
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

  async function transact<T>(mode: IDBTransactionMode, body: (tx: IDBTransaction, result: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction([JOURNEYS, META], mode);
      let value: T;
      let failure: unknown;
      const fail = (error: unknown) => { failure = error; try { tx.abort(); } catch { reject(error); } };
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('여정 저장을 완료하지 못했어요. 기록을 확인해 주세요.'));
      tx.onerror = () => undefined;
      try { body(tx, (next) => { value = next; }, fail); } catch (error) { fail(error); }
    });
  }
  function read<T>(request: IDBRequest<T>, done: (value: T) => void, fail: (error: unknown) => void) {
    request.onsuccess = () => { try { done(request.result); } catch (error) { fail(error); } };
  }
  const sorted = (records: JourneyRecord[]) => records.sort((a, b) => b.startedAt - a.startedAt);
  const snapshot = (): Promise<JourneyRecord[]> => transact('readonly', (tx, result, fail) => {
    read(tx.objectStore(JOURNEYS).getAll(), (records: JourneyRecord[]) => result(sorted(records)), fail);
  });

  function create(id: string, now = Date.now(), title?: string): Promise<JourneyRecord> {
    const record = newJourney(id, now, title);
    return transact('readwrite', (tx, result, fail) => {
      const store = tx.objectStore(JOURNEYS);
      read(store.getAll(), (records: JourneyRecord[]) => {
        const existing = records.find((item) => item.id === id);
        if (existing) { result(existing); return; }
        if (records.some((item) => item.status !== 'completed')) throw new Error('진행 중인 여정을 먼저 마쳐 주세요.');
        read(tx.objectStore(META).get(id), (meta: JourneyMeta | undefined) => {
          if (meta?.deleted) throw new Error('삭제한 여정은 다시 시작할 수 없어요. 새 여정을 시작해 주세요.');
          store.add(record); result(record);
        }, fail);
      }, fail);
    });
  }

  function setStatus(id: string, status: JourneyRecord['status'], now = Date.now()): Promise<JourneyRecord> {
    return transact('readwrite', (tx, result, fail) => {
      const store = tx.objectStore(JOURNEYS);
      read(store.get(id), (record: JourneyRecord | undefined) => {
        if (!record) throw new Error('여정 기록을 찾지 못했어요.');
        if (record.status === 'completed') { result(record); return; }
        const updated = { ...record, status, endedAt: status === 'completed' ? Math.max(record.startedAt, now) : null };
        store.put(updated); result(updated);
      }, fail);
    });
  }

  /** A lost native buffer restarts at segment zero. Persist an offset before restarting GPS. */
  function prepareRestart(id: string, now = Date.now()): Promise<void> {
    return transact('readwrite', (tx, result, fail) => {
      read(tx.objectStore(JOURNEYS).get(id), (record: JourneyRecord | undefined) => {
        if (!record || record.status === 'completed') throw new Error('재개할 여정을 찾지 못했어요.');
        const segmentOffset = record.points.reduce((maximum, point) => Math.max(maximum, point.segment), -1) + 1;
        tx.objectStore(META).put({ id, restartAt: now, segmentOffset } satisfies JourneyMeta);
        result(undefined);
      }, fail);
    });
  }

  /** Current and archived native buffers commit together before the caller acknowledges any archive. */
  function reconcileTrackingState(state: JourneyTrackingState, now = Date.now()): Promise<JourneyRecord[]> {
    return transact('readwrite', (tx, result, fail) => {
      const store = tx.objectStore(JOURNEYS);
      read(store.getAll(), (records: JourneyRecord[]) => {
        read(tx.objectStore(META).getAll(), (metadata: JourneyMeta[]) => {
          const saved = new Map(records.map((record) => [record.id, record]));
          const metas = new Map(metadata.map((meta) => [meta.id, meta]));
          const write = (record: JourneyRecord) => { store.put(record); saved.set(record.id, record); };
          const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= now + 5_000;
          const mergeSnapshot = (snapshot: JourneyTrackingSnapshot, archived: boolean) => {
            const id = snapshot.journeyId;
            if (!id || metas.get(id)?.deleted) return;
            const meta = metas.get(id);
            const existing = saved.get(id);
            const nativePoints = normalizeJourneyPoints(snapshot.points, 0, now);
            // Empty archived days are not manufactured into history. An existing photo-only day is retained.
            if (!existing && !nativePoints.length && (archived || snapshot.status === 'idle')) return;
            const initialTime = validTime(snapshot.startedAt) ? snapshot.startedAt : nativePoints[0]?.timestamp ?? now;
            const automatic = snapshot.mode === 'automatic' || existing?.mode === 'automatic';
            const record = existing ?? newJourney(id, initialTime,
              automatic && snapshot.dayKey ? `${snapshot.dayKey} 반구천 하루` : '복구된 반구천 여정');
            const nativeEndedAt = validTime(snapshot.endedAt) ? Math.max(record.startedAt, snapshot.endedAt) : null;
            const completed = archived || record.status === 'completed' || snapshot.status === 'idle';
            // A v1 native buffer may lack dates and fill them with its migration time. Never extend a completed local journey.
            const endedAt = completed ? record.endedAt ?? nativeEndedAt ?? Math.max(record.startedAt, now) : null;
            const incoming = nativePoints.filter((point) => (!meta?.restartAt || point.timestamp >= meta.restartAt)
              && (endedAt === null || point.timestamp <= endedAt))
              .map((point) => ({ ...point, segment: point.segment + (meta?.segmentOffset ?? 0) }));
            const dayKey = snapshot.dayKey ?? record.dayKey;
            write({ ...record, status: completed ? 'completed' : snapshot.status as 'recording' | 'paused', endedAt,
              ...(snapshot.mode ? { mode: snapshot.mode } : {}), ...(dayKey ? { dayKey } : {}),
              points: normalizeJourneyPoints([...record.points, ...incoming], record.startedAt, now) });
          };
          for (const archive of state.archived ?? []) {
            if (!archive.journeyId || archive.status !== 'idle' || !validTime(archive.startedAt)
              || !validTime(archive.endedAt) || archive.endedAt < archive.startedAt || archive.journeyId === state.journeyId) {
              throw new Error('보관된 하루 기록 정보를 확인하지 못했어요. 원본 기록은 기기에 유지됩니다.');
            }
            mergeSnapshot(archive, true);
          }
          mergeSnapshot(state, false);
          const current = state.journeyId ? saved.get(state.journeyId) : undefined;
          for (const item of saved.values()) {
            if (item.id === current?.id || item.status === 'completed') continue;
            if (current && current.status !== 'completed' && state.status !== 'idle') {
              // Replacing a recorder preserves previous manual/photos-only history as a finished journey.
              write({ ...item, status: 'completed', endedAt: Math.max(item.startedAt,
                item.points.at(-1)?.timestamp ?? item.startedAt, item.photos.at(-1)?.createdAt ?? item.startedAt) });
            } else if (item.status === 'recording') write({ ...item, status: 'paused' });
          }
          result(sorted([...saved.values()]));
        }, fail);
      }, fail);
    });
  }

  function addPhoto(id: string, photo: JourneyPhoto): Promise<JourneyPhoto> {
    if (!(photo.blob instanceof Blob) || photo.blob.size === 0 || !/^image\/(jpeg|png|webp)$/.test(photo.blob.type)
      || !photo.id.trim() || !Number.isFinite(photo.createdAt) || !/^data:image\/(jpeg|png|webp);base64,/.test(photo.thumbnailDataUrl)) {
      return Promise.reject(new Error('사진 파일을 처리하지 못했어요. 다시 촬영해 주세요.'));
    }
    // Enforce all-null or all-valid location fields even for callers other than the hook.
    const coordinates = photo.lat !== null && photo.lng !== null && photo.accuracy !== null
      ? photoCoordinates({ lat: photo.lat, lng: photo.lng, accuracy: photo.accuracy, timestamp: photo.createdAt }, photo.createdAt)
      : { lat: null, lng: null, accuracy: null };
    const safePhoto = { ...photo, ...coordinates };
    return transact('readwrite', (tx, result, fail) => {
      const store = tx.objectStore(JOURNEYS);
      read(store.get(id), (record: JourneyRecord | undefined) => {
        if (!record) throw new Error('사진을 담을 여정을 먼저 시작해 주세요.');
        const existing = record.photos.find((item) => item.id === photo.id || (photo.sourceMissionId && item.sourceMissionId === photo.sourceMissionId));
        if (existing) { result(existing); return; }
        if (record.status === 'completed') throw new Error('완료한 여정에는 사진을 추가할 수 없어요. 새 여정을 시작해 주세요.');
        if (record.mode === 'automatic' && journeyDayKey(photo.createdAt) !== (record.dayKey ?? journeyDayKey(record.startedAt))) {
          throw new Error('사진을 촬영한 날짜와 기록 날짜가 달라 저장하지 않았어요. 오늘의 자동 기록을 켜거나 사진을 파일로 보관해 주세요.');
        }
        store.put({ ...record, photos: [...record.photos, safePhoto].sort((a, b) => a.createdAt - b.createdAt) });
        result(safePhoto);
      }, fail);
    });
  }

  function deleteJourney(id: string): Promise<void> {
    return transact('readwrite', (tx, result) => {
      tx.objectStore(JOURNEYS).delete(id);
      tx.objectStore(META).put({ id, deleted: true } satisfies JourneyMeta);
      result(undefined);
    });
  }
  function clearAll(): Promise<void> {
    return transact('readwrite', (tx, result, fail) => {
      read(tx.objectStore(JOURNEYS).getAllKeys(), (ids) => {
        tx.objectStore(JOURNEYS).clear();
        // Opaque deletion IDs contain no route/photo data and prevent delayed native events from resurrecting records.
        for (const id of ids) tx.objectStore(META).put({ id: String(id), deleted: true } satisfies JourneyMeta);
        result(undefined);
      }, fail);
    });
  }
  async function exportData(): Promise<JourneyExport> {
    const records = await snapshot();
    const journeys = await Promise.all(records.map(async (record) => ({ ...record, photos: await Promise.all(record.photos.map(async (photo) => {
      const bytes = new Uint8Array(await photo.blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return { ...photo, blob: { mimeType: photo.blob.type, byteLength: photo.blob.size, encoding: 'base64' as const, data: btoa(binary) } };
    })) })));
    return { format: 'bangucheon-journeys', version: 1, exportedAt: new Date().toISOString(),
      notice: '사용자가 시작한 개인 GPS 여정과 사진입니다. 위치에는 오차가 있으며 현장 방문 인증이 아닙니다.', journeys };
  }
  return { snapshot, create, setStatus, prepareRestart, reconcileTrackingState, addPhoto, deleteJourney, clearAll, exportData,
    async close() { const current = connection; connection = null; if (current) (await current).close(); } };
}

export type JourneyStorage = ReturnType<typeof createJourneyStorage>;
export const journeyStorage = createJourneyStorage();
