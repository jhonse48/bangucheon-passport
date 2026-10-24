import assert from 'node:assert/strict';
import test from 'node:test';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createJourneyController } from '../src/lib/use-journey';
import { createJourneyStorage } from '../src/lib/journey-storage';
import type { JourneyTracker } from '../src/lib/native-journey';
import type { JourneyTrackingState } from '../src/lib/journey';

const time = 1_800_000_000_000;
function fixture(initial: JourneyTrackingState = { journeyId: null, status: 'idle', points: [] }) {
  let native = structuredClone(initial);
  const calls: string[] = [];
  const listeners = new Set<(state: JourneyTrackingState) => void>();
  const copy = () => structuredClone(native);
  const emit = () => { for (const listener of listeners) listener(copy()); };
  const tracker: JourneyTracker = {
    async getTrackingState() { calls.push('get'); return copy(); },
    async startTracking({ journeyId }) { calls.push('start'); native = { journeyId, status: 'recording', points: [] }; emit(); return copy(); },
    async pauseTracking() { calls.push('pause'); if (native.status !== 'idle') native.status = 'paused'; emit(); return copy(); },
    async resumeTracking() { calls.push('resume'); if (native.status === 'idle') throw new Error('NO_ACTIVE_JOURNEY'); native.status = 'recording'; emit(); return copy(); },
    async stopTracking() { calls.push('stop'); native.status = 'idle'; emit(); return copy(); },
    async clearTracking() { calls.push('clear'); native = { journeyId: null, status: 'idle', points: [] }; emit(); return copy(); },
    async addListener(_event, callback) { calls.push('listen'); listeners.add(callback); return { remove() { listeners.delete(callback); } }; },
  };
  const storage = createJourneyStorage({ indexedDB: new IDBFactory() });
  let clock = time;
  let counter = 0;
  const controller = createJourneyController({ storage, tracker, now: () => clock, id: () => `id-${++counter}`,
    subscribeActive: async () => () => undefined,
    preparePhoto: async (blob) => ({ blob, thumbnailDataUrl: 'data:image/jpeg;base64,AAE=' }),
  });
  return { storage, tracker, controller, calls, get native() { return native; }, setClock(value: number) { clock = value; },
    setNative(value: JourneyTrackingState) { native = value; }, async close() { controller.dispose(); await storage.close(); } };
}
const blob = () => new Blob([new Uint8Array([0, 1])], { type: 'image/jpeg' });

test('mount initialization only reads native state, recovers history and never requests a new recording', async () => {
  const f = fixture({ journeyId: 'recovered', status: 'paused', points: [{ lat: 35.6, lng: 129.17, accuracy: 5, timestamp: time - 5_000, segment: 0 }] });
  await f.controller.initialize();
  assert.deepEqual(f.calls, ['listen', 'get']);
  assert.equal(f.controller.getSnapshot().ready, true);
  assert.equal(f.controller.getSnapshot().activeJourney?.id, 'recovered');
  assert.equal(f.controller.getSnapshot().activeJourney?.status, 'paused');
  await f.close();
});

test('start, pause, photo, resume and finish persist history and stop GPS before completion writes', async () => {
  const f = fixture();
  await f.controller.initialize();
  await f.controller.start(); await f.controller.pause();
  f.setClock(time + 10_000);
  const photo = await f.controller.addPhoto(blob(), { lat: 35.6, lng: 129.17, accuracy: 8, timestamp: time + 9_000 }, 'mission');
  assert.equal(photo.lat, 35.6);
  assert.equal((await f.controller.addPhoto(blob(), undefined, 'mission')).id, photo.id);
  await f.controller.resume();
  f.setClock(time + 20_000);
  const finished = await f.controller.finish();
  assert.equal(finished?.status, 'completed');
  assert.equal(f.native.status, 'idle');
  assert.equal(f.controller.getSnapshot().activeJourney, null);
  assert.equal((await f.storage.snapshot())[0].photos.length, 1);
  assert.ok(f.calls.indexOf('stop') > f.calls.indexOf('resume'));
  await f.close();
});

test('stale, inaccurate or absent photo GPS remains null even while a journey has recent coordinates', async () => {
  const f = fixture();
  await f.controller.initialize(); await f.controller.start();
  f.setClock(time + 60_000);
  for (const location of [undefined, { lat: 35.6, lng: 129.17, accuracy: 5, timestamp: time },
    { lat: 35.6, lng: 129.17, accuracy: 100, timestamp: time + 60_000 }]) {
    const saved = await f.controller.addPhoto(blob(), location);
    assert.deepEqual([saved.lat, saved.lng, saved.accuracy], [null, null, null]);
  }
  assert.equal(f.controller.getSnapshot().activeJourney?.photos.length, 3);
  await f.close();
});

test('a late camera result cannot attach to a different journey started while GPS was pending', async () => {
  const f = fixture();
  await f.controller.initialize(); const first = await f.controller.start();
  await f.controller.finish(); const second = await f.controller.start();
  await assert.rejects(() => f.controller.addPhoto(blob(), undefined, undefined, first.id), /사진을 촬영한 여정이 변경/);
  const records = await f.storage.snapshot();
  assert.equal(records.find((record) => record.id === first.id)?.photos.length, 0);
  assert.equal(records.find((record) => record.id === second.id)?.photos.length, 0);
  await f.close();
});

test('a queued photo keeps the active journey at invocation instead of the next session', async () => {
  const f = fixture();
  await f.controller.initialize(); await f.controller.start();
  const finishing = f.controller.finish();
  const starting = f.controller.start();
  const saving = f.controller.addPhoto(blob());
  const results = await Promise.allSettled([finishing, starting, saving]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'fulfilled');
  assert.equal(results[2].status, 'rejected');
  assert.equal((await f.storage.snapshot()).flatMap((record) => record.photos).length, 0);
  await f.close();
});

test('retry after a committed photo fails to refresh keeps one photo and the actual paused tracker status', async () => {
  const f = fixture();
  await f.controller.initialize(); const started = await f.controller.start(); await f.controller.refresh();
  const capture = blob();
  const get = f.tracker.getTrackingState;
  f.tracker.getTrackingState = async () => { throw new Error('native refresh unavailable'); };
  await assert.rejects(() => f.controller.addPhoto(capture, undefined, undefined, started.id), /native refresh unavailable/);
  assert.equal((await f.storage.snapshot())[0].photos.length, 1);
  assert.equal(f.native.status, 'paused');
  f.tracker.getTrackingState = get;
  await f.controller.addPhoto(capture, undefined, undefined, started.id);
  assert.equal((await f.storage.snapshot())[0].photos.length, 1);
  assert.equal(f.controller.getSnapshot().activeJourney?.status, 'paused');
  await f.close();
});

test('quota failure pauses native tracking, reports the failure and does not loop on pause events', async () => {
  const f = fixture();
  await f.controller.initialize(); await f.controller.start(); await f.controller.refresh();
  const original = IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'journeys') throw new DOMException('Full', 'QuotaExceededError');
      return original.apply(this, args);
    };
    const pauseBefore = f.calls.filter((call) => call === 'pause').length;
    await assert.rejects(() => f.controller.addPhoto(blob()), { name: 'QuotaExceededError' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(f.native.status, 'paused');
    assert.match(f.controller.getSnapshot().error!, /저장 공간/);
    assert.equal(f.controller.getSnapshot().activeJourney?.status, 'paused');
    assert.equal(f.calls.filter((call) => call === 'pause').length, pauseBefore + 1);
  } finally { IDBObjectStore.prototype.put = original; }
  assert.equal((await f.storage.snapshot())[0].photos.length, 0);
  await f.close();
});

test('a stopped native buffer survives failed final persistence and completes on the next recovery', async () => {
  const f = fixture();
  await f.controller.initialize(); const started = await f.controller.start(); await f.controller.refresh();
  f.setClock(time + 20_000);
  f.setNative({ journeyId: started.id, status: 'recording', points: [{ lat: 35.6, lng: 129.17, accuracy: 5, timestamp: time + 10_000, segment: 0 }] });
  const original = IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'journeys') throw new DOMException('Full', 'QuotaExceededError');
      return original.apply(this, args);
    };
    await assert.rejects(() => f.controller.finish(), { name: 'QuotaExceededError' });
    assert.equal(f.native.status, 'idle');
    assert.equal(f.native.points.length, 1);
  } finally { IDBObjectStore.prototype.put = original; }
  await f.controller.refresh();
  const recovered = (await f.storage.snapshot())[0];
  assert.equal(recovered.status, 'completed');
  assert.equal(recovered.points.length, 1);
  await f.close();
});

test('resume after a failed completion recovers the stopped buffer instead of asking idle native tracking to resume', async () => {
  const f = fixture();
  // Exercise the direct user action before an app-active or native event can recover the stopped buffer.
  f.tracker.addListener = async () => ({ remove() {} });
  await f.controller.initialize(); const started = await f.controller.start(); await f.controller.refresh();
  f.setNative({ journeyId: started.id, status: 'recording', points: [{ lat: 35.6, lng: 129.17, accuracy: 5, timestamp: time, segment: 0 }] });
  const original = IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'journeys') throw new DOMException('Full', 'QuotaExceededError');
      return original.apply(this, args);
    };
    await assert.rejects(() => f.controller.finish(), { name: 'QuotaExceededError' });
  } finally { IDBObjectStore.prototype.put = original; }
  await assert.rejects(() => f.controller.resume(), /이미 마친 여정을 복구/);
  assert.equal(f.calls.includes('resume'), false);
  assert.equal(f.controller.getSnapshot().activeJourney, null);
  assert.equal((await f.storage.snapshot())[0].status, 'completed');
  assert.equal((await f.storage.snapshot())[0].points.length, 1);
  assert.doesNotMatch(f.controller.getSnapshot().error!, /재개해 주세요/);
  await f.close();
});

test('native stop failure cannot mark a journey completed and native clear failure cannot delete history', async () => {
  const f = fixture();
  await f.controller.initialize(); await f.controller.start(); await f.controller.refresh();
  const stop = f.tracker.stopTracking;
  f.tracker.stopTracking = async () => { throw new Error('stop failed'); };
  await assert.rejects(() => f.controller.finish(), /stop failed/);
  assert.notEqual((await f.storage.snapshot())[0].status, 'completed');
  f.tracker.stopTracking = stop;
  f.tracker.clearTracking = async () => { throw new Error('clear failed'); };
  await assert.rejects(() => f.controller.clearAll(), /clear failed/);
  assert.equal((await f.storage.snapshot()).length, 1);
  await f.close();
});

test('clearing an active journey stops and erases the native buffer before deleting local history', async () => {
  const f = fixture();
  await f.controller.initialize(); await f.controller.start(); await f.controller.refresh();
  await f.controller.clearAll();
  assert.deepEqual(f.native, { journeyId: null, status: 'idle', points: [] });
  assert.deepEqual(await f.storage.snapshot(), []);
  assert.equal(f.controller.getSnapshot().activeJourney, null);
  assert.ok(f.calls.indexOf('stop') < f.calls.indexOf('clear'));
  await f.close();
});

test('a deleted native session found on launch is stopped instead of silently collecting unowned points', async () => {
  const f = fixture({ journeyId: 'deleted', status: 'recording', points: [] });
  await f.storage.deleteJourney('deleted');
  await f.controller.initialize();
  assert.equal(f.native.status, 'idle');
  assert.equal(f.native.journeyId, null);
  assert.deepEqual(f.controller.getSnapshot().journeys, []);
  assert.equal(f.calls.includes('start'), false);
  await f.close();
});

test('location permission failure leaves a resumable paused record and an explicit error', async () => {
  const f = fixture();
  f.tracker.startTracking = async ({ journeyId }) => {
    f.setNative({ journeyId, status: 'paused', points: [], error: '위치 권한을 허용해 주세요.' });
    throw new Error('위치 권한을 허용해 주세요.');
  };
  await f.controller.initialize();
  await assert.rejects(() => f.controller.start(), /위치 권한/);
  assert.equal(f.controller.getSnapshot().activeJourney?.status, 'paused');
  assert.equal((await f.storage.snapshot())[0].points.length, 0);
  assert.match(f.controller.getSnapshot().error!, /위치 권한/);
  await f.close();
});
