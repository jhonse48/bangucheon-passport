import assert from 'node:assert/strict';
import test from 'node:test';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createJourneyController } from '../src/lib/use-journey';
import { createJourneyStorage } from '../src/lib/journey-storage';
import type { JourneyTracker } from '../src/lib/native-journey';
import type { JourneyArchivedSnapshot, JourneyPhoto, JourneyTrackingState } from '../src/lib/journey';

const midnight = Date.parse('2026-10-23T15:00:00.000Z'); // Oct 24 in Asia/Seoul.
const now = midnight + 60_000;
const point = (timestamp: number, segment = 0) => ({ lat: 35.6, lng: 129.17, timestamp, accuracy: 5, segment });
const archive = (journeyId = 'yesterday'): JourneyArchivedSnapshot => ({ journeyId, status: 'idle', mode: 'automatic',
  dayKey: '2026-10-23', startedAt: midnight - 20_000, endedAt: midnight,
  points: [point(midnight - 15_000), point(midnight - 5_000)] });
const daily = (): JourneyTrackingState => ({ journeyId: 'today', status: 'recording', mode: 'automatic',
  dayKey: '2026-10-24', startedAt: midnight + 1_000, endedAt: null, points: [point(midnight + 10_000)],
  automatic: { enabled: true, authorization: 'always' }, archived: [archive()] });
const photo = (): JourneyPhoto => ({ id: 'original-photo', createdAt: midnight - 10_000, lat: null, lng: null, accuracy: null,
  blob: new Blob(['image'], { type: 'image/jpeg' }), thumbnailDataUrl: 'data:image/jpeg;base64,AA==' });

function fixture(initial: JourneyTrackingState = { journeyId: null, status: 'idle', points: [],
  automatic: { enabled: false, authorization: 'notDetermined' }, archived: [] }) {
  let native = structuredClone(initial);
  const calls: string[] = [];
  const copy = () => structuredClone(native);
  const storage = createJourneyStorage({ indexedDB: new IDBFactory() });
  const tracker: JourneyTracker = {
    async getTrackingState() { calls.push('get'); return copy(); },
    async startTracking({ journeyId }) { calls.push('start'); native = { ...native, journeyId, status: 'recording', mode: 'manual', points: [] }; return copy(); },
    async pauseTracking() { calls.push('pause'); if (native.status !== 'idle') native.status = 'paused'; return copy(); },
    async resumeTracking() { calls.push('resume'); native.status = 'recording'; return copy(); },
    async stopTracking() { calls.push('stop'); native.status = 'idle'; return copy(); },
    async clearTracking() { calls.push('clear'); native = { journeyId: null, status: 'idle', points: [], archived: [],
      automatic: { enabled: false, authorization: native.automatic!.authorization } }; return copy(); },
    async addListener() { calls.push('listen'); return { remove() {} }; },
    async setAutomaticTracking({ enabled }) {
      calls.push(enabled ? 'auto-on' : 'auto-off');
      if (enabled && native.status === 'idle' && native.journeyId) native = { ...native, journeyId: null, points: [] };
      native.automatic = { enabled, authorization: native.automatic?.authorization === 'notDetermined' ? 'whenInUse' : native.automatic!.authorization };
      native.mode = 'automatic'; native.status = enabled ? 'recording' : native.journeyId ? 'paused' : 'idle';
      if (native.journeyId) native.dayKey = '2026-10-24';
      return copy();
    },
    async requestBackgroundAuthorization() { calls.push('background-request'); native.automatic!.authorization = 'always'; return copy(); },
    async ensureAutomaticJourney() {
      calls.push('ensure');
      if (!native.automatic?.enabled) throw new Error('Automatic disabled');
      if (!native.journeyId) native = { ...native, journeyId: 'photo-day', mode: 'automatic', dayKey: '2026-10-24', startedAt: now, endedAt: null, points: [] };
      return copy();
    },
    async acknowledgeArchived({ journeyIds }) {
      calls.push(`ack:${journeyIds.join(',')}`);
      native.archived = native.archived?.filter((entry) => !journeyIds.includes(entry.journeyId));
    },
  };
  let id = 0;
  const controller = createJourneyController({ storage, tracker, now: () => now, id: () => `photo-${++id}`,
    subscribeActive: async () => () => undefined,
    preparePhoto: async (blob) => ({ blob, thumbnailDataUrl: 'data:image/jpeg;base64,AA==' }),
  });
  return { storage, tracker, controller, calls, get native() { return native; },
    async close() { controller.dispose(); await storage.close(); } };
}

test('automatic opt-in and background authorization only change on their explicit actions, never reads', async () => {
  const f = fixture();
  await f.controller.initialize(); await f.controller.refresh();
  assert.deepEqual(f.calls, ['listen', 'get', 'get']);
  assert.equal(f.controller.getSnapshot().automaticSupported, true);
  assert.equal(f.controller.getSnapshot().automaticEnabled, false);
  await f.controller.setAutomatic(true);
  assert.equal(f.controller.getSnapshot().automaticEnabled, true);
  assert.equal(f.controller.getSnapshot().authorization, 'whenInUse');
  assert.equal(f.controller.getSnapshot().activeJourney, null);
  assert.equal((await f.storage.snapshot()).length, 0, 'GPS waiting must not manufacture an empty daily record');
  assert.equal(f.calls.includes('background-request'), false);
  await f.controller.requestBackgroundAuthorization();
  assert.equal(f.controller.getSnapshot().authorization, 'always');
  await f.controller.setAutomatic(false); await f.controller.refresh();
  assert.equal(f.controller.getSnapshot().automaticEnabled, false);
  assert.equal(f.calls.filter((call) => call === 'auto-on').length, 1);
  await f.close();
});

test('archived native days and current day commit before acknowledgment while existing photos survive', async () => {
  const f = fixture(daily());
  await f.storage.create('yesterday', midnight - 20_000);
  await f.storage.addPhoto('yesterday', photo());
  const ack = f.tracker.acknowledgeArchived!;
  f.tracker.acknowledgeArchived = async (options) => {
    const saved = await f.storage.snapshot();
    assert.deepEqual(saved.map((record) => record.id).sort(), ['today', 'yesterday']);
    assert.equal(saved.find((record) => record.id === 'yesterday')?.photos[0].id, 'original-photo');
    assert.equal(saved.find((record) => record.id === 'yesterday')?.endedAt, midnight);
    await ack(options);
  };
  await f.controller.initialize();
  assert.equal(f.native.archived?.length, 0);
  assert.equal(f.controller.getSnapshot().activeJourney?.id, 'today');
  assert.equal(f.controller.getSnapshot().journeys.find((record) => record.id === 'yesterday')?.mode, 'automatic');
  await f.close();
});

test('quota failure rolls back every day, retains native archives, and pauses GPS before retry', async () => {
  const f = fixture(daily());
  const original = IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'journeys' && args[0].id === 'today') throw new DOMException('Full', 'QuotaExceededError');
      return original.apply(this, args);
    };
    await assert.rejects(() => f.controller.initialize(), { name: 'QuotaExceededError' });
  } finally { IDBObjectStore.prototype.put = original; }
  assert.deepEqual(await f.storage.snapshot(), []);
  assert.equal(f.native.archived?.length, 1);
  assert.equal(f.native.status, 'paused');
  assert.equal(f.calls.some((call) => call.startsWith('ack:')), false);
  await f.controller.refresh();
  assert.equal((await f.storage.snapshot()).length, 2);
  assert.equal(f.native.archived?.length, 0);
  await f.close();
});

test('failed native acknowledgment retries already committed archives without duplicate records or photos', async () => {
  const f = fixture(daily());
  await f.storage.create('yesterday', midnight - 20_000); await f.storage.addPhoto('yesterday', photo());
  const ack = f.tracker.acknowledgeArchived!;
  f.tracker.acknowledgeArchived = async () => { throw new Error('archive disk failure'); };
  await assert.rejects(() => f.controller.initialize(), /archive disk failure/);
  assert.equal((await f.storage.snapshot()).length, 2);
  assert.equal(f.native.archived?.length, 1);
  f.tracker.acknowledgeArchived = ack;
  await f.controller.refresh();
  const saved = await f.storage.snapshot();
  assert.equal(saved.length, 2);
  assert.equal(saved.find((record) => record.id === 'yesterday')?.points.length, 2);
  assert.equal(saved.find((record) => record.id === 'yesterday')?.photos.length, 1);
  await f.close();
});

test('opting out preserves today and photos, and a same-day legacy journey can be adopted without replacement', async () => {
  const f = fixture({ journeyId: 'legacy', status: 'paused', points: [], startedAt: midnight + 1_000,
    automatic: { enabled: false, authorization: 'whenInUse' }, archived: [] });
  await f.storage.create('legacy', midnight + 1_000);
  await f.storage.addPhoto('legacy', { ...photo(), createdAt: midnight + 2_000 });
  await f.controller.initialize(); await f.controller.setAutomatic(true);
  assert.equal(f.controller.getSnapshot().activeJourney?.id, 'legacy');
  assert.equal(f.controller.getSnapshot().activeJourney?.mode, 'automatic');
  await f.controller.setAutomatic(false);
  assert.equal(f.controller.getSnapshot().automaticEnabled, false);
  assert.equal(f.controller.getSnapshot().activeJourney?.status, 'paused');
  assert.equal((await f.storage.snapshot())[0].photos.length, 1);
  await f.close();
});

test('an explicit photo action can create a photo-only automatic day without asking for more permission', async () => {
  const f = fixture();
  await f.controller.initialize(); await f.controller.setAutomatic(true);
  const current = await f.controller.ensureAutomaticJourney();
  assert.equal(current?.dayKey, '2026-10-24');
  await f.controller.addPhoto(photo().blob, undefined, undefined, current!.id);
  assert.equal(f.controller.getSnapshot().activeJourney?.photos[0].lat, null);
  assert.equal(f.controller.getSnapshot().activeJourney?.points.length, 0);
  assert.equal(f.calls.includes('background-request'), false);
  await f.close();
});

test('empty archived days are skipped but known photo-only days and deleted tombstones are respected', async () => {
  const f = fixture({ journeyId: null, status: 'recording', mode: 'automatic', points: [],
    automatic: { enabled: true, authorization: 'always' }, archived: [
      { ...archive('empty'), points: [] }, { ...archive('photo-only'), points: [] }, archive('deleted'),
    ] });
  await f.storage.create('photo-only', midnight - 20_000); await f.storage.addPhoto('photo-only', photo());
  await f.storage.deleteJourney('deleted');
  await f.controller.initialize();
  const saved = await f.storage.snapshot();
  assert.deepEqual(saved.map((record) => record.id), ['photo-only']);
  assert.equal(saved[0].status, 'completed');
  assert.equal(saved[0].photos.length, 1);
  assert.equal(f.native.archived?.length, 0);
  await f.close();
});

test('today video snapshot uses fresh GPS without ending or pausing automatic collection', async () => {
  const f = fixture({ ...daily(), archived: [] });
  await f.controller.initialize();
  f.native.points.push(point(midnight + 30_000));
  const snapshot = await f.controller.videoSnapshot('today');
  assert.equal(snapshot.status, 'completed'); assert.equal(snapshot.endedAt, midnight + 30_000); assert.equal(snapshot.points.length, 2);
  assert.equal(f.native.status, 'recording');
  assert.equal(f.controller.getSnapshot().activeJourney?.status, 'recording');
  assert.equal((await f.storage.snapshot())[0].endedAt, null);
  snapshot.points.length = 0;
  assert.equal(f.controller.getSnapshot().activeJourney?.points.length, 2);
  assert.equal(f.calls.includes('stop'), false); assert.equal(f.calls.includes('pause'), false);
  await f.close();
});

test('deleting the active day disables automatic tracking without dropping unimported previous days', async () => {
  const f = fixture({ ...daily(), archived: [] });
  await f.controller.initialize();
  f.native.archived = [archive()];
  await f.controller.deleteJourney('today');
  assert.equal(f.controller.getSnapshot().automaticEnabled, false);
  assert.equal(f.native.automatic?.enabled, false);
  assert.deepEqual((await f.storage.snapshot()).map((record) => record.id), ['yesterday']);
  assert.ok(f.calls.indexOf('auto-off') < f.calls.indexOf('clear'));
  await f.close();
});

test('clear all revokes automatic recording before clearing current and archived native buffers', async () => {
  const f = fixture(daily());
  await f.controller.initialize();
  await f.controller.clearAll();
  assert.equal(f.native.automatic?.enabled, false);
  assert.equal(f.native.journeyId, null); assert.deepEqual(f.native.archived, []);
  assert.deepEqual(await f.storage.snapshot(), []);
  assert.ok(f.calls.indexOf('auto-off') < f.calls.indexOf('stop'));
  await f.controller.refresh();
  assert.equal(f.controller.getSnapshot().automaticEnabled, false);
  assert.equal(f.calls.filter((call) => call === 'auto-on').length, 0);
  await f.close();
});

test('opting out still revokes native consent when local history cannot be saved', async () => {
  const f = fixture(daily());
  await f.controller.initialize();
  f.native.archived = [archive('unsynced')];
  const original = IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'journeys') throw new DOMException('Full', 'QuotaExceededError');
      return original.apply(this, args);
    };
    await assert.rejects(() => f.controller.setAutomatic(false), { name: 'QuotaExceededError' });
  } finally { IDBObjectStore.prototype.put = original; }
  assert.equal(f.native.automatic?.enabled, false);
  assert.equal(f.native.status, 'paused');
  assert.equal(f.native.archived?.length, 1);
  assert.equal(f.controller.getSnapshot().automaticEnabled, false);
  await f.close();
});

test('denied permission retains explicit preference but rejects the success path and never fabricates a day', async () => {
  const f = fixture({ journeyId: null, status: 'idle', points: [], archived: [],
    automatic: { enabled: false, authorization: 'denied' } });
  await f.controller.initialize();
  assert.equal(f.calls.includes('auto-on'), false);
  await assert.rejects(() => f.controller.setAutomatic(true), /위치 권한이 없어/);
  assert.equal(f.controller.getSnapshot().automaticEnabled, true);
  assert.equal(f.controller.getSnapshot().authorization, 'denied');
  assert.equal(f.native.status, 'paused');
  assert.deepEqual(await f.storage.snapshot(), []);
  await f.controller.setAutomatic(false);
  assert.equal(f.controller.getSnapshot().automaticEnabled, false);
  await f.close();
});

test('a photo-only legacy manual journey from yesterday is preserved instead of being relabelled as today', async () => {
  const f = fixture({ journeyId: 'old-manual', status: 'paused', points: [],
    automatic: { enabled: false, authorization: 'whenInUse' }, archived: [] });
  await f.storage.create('old-manual', midnight - 20_000); await f.storage.addPhoto('old-manual', photo());
  await f.controller.initialize(); await f.controller.setAutomatic(true);
  const [saved] = await f.storage.snapshot();
  assert.equal(saved.id, 'old-manual'); assert.equal(saved.status, 'completed'); assert.notEqual(saved.mode, 'automatic');
  assert.equal(saved.photos.length, 1); assert.equal(saved.startedAt, midnight - 20_000);
  assert.equal(f.native.journeyId, null, 'the next real GPS fix creates a new automatic day');
  assert.ok(f.calls.indexOf('stop') < f.calls.indexOf('auto-on'));
  await f.close();
});

test('automatic OFF cannot attach a new-day photo to yesterday while explicit manual sessions remain unrestricted', async () => {
  const f = fixture({ ...archive('paused-yesterday'), status: 'paused', endedAt: null,
    automatic: { enabled: false, authorization: 'always' }, archived: [] });
  await f.controller.initialize();
  await assert.rejects(() => f.controller.addPhoto(photo().blob, undefined, undefined, 'paused-yesterday'), /날짜와 기록 날짜가 달라/);
  assert.equal((await f.storage.snapshot())[0].photos.length, 0);
  assert.match(f.controller.getSnapshot().error!, /자동 기록을 껐다가 다시 켜/);
  await f.storage.setStatus('paused-yesterday', 'completed', now);
  await f.storage.create('explicit-manual', midnight - 20_000);
  await f.storage.addPhoto('explicit-manual', { ...photo(), createdAt: now });
  assert.equal((await f.storage.snapshot()).find((record) => record.id === 'explicit-manual')?.photos.length, 1);
  await f.close();
});

test('migrated native archives cannot extend the original end time of an already completed manual journey', async () => {
  const f = fixture({ journeyId: null, status: 'recording', points: [], mode: 'automatic',
    automatic: { enabled: true, authorization: 'always' }, archived: [{
      journeyId: 'finished-manual', status: 'idle', mode: 'manual', points: [], startedAt: now, endedAt: now,
    }] });
  await f.storage.create('finished-manual', midnight - 20_000); await f.storage.addPhoto('finished-manual', photo());
  await f.storage.setStatus('finished-manual', 'completed', midnight - 5_000);
  await f.controller.initialize();
  const [saved] = await f.storage.snapshot();
  assert.equal(saved.startedAt, midnight - 20_000); assert.equal(saved.endedAt, midnight - 5_000);
  assert.equal(saved.photos.length, 1); assert.equal(saved.mode, 'manual');
  assert.equal(f.native.archived?.length, 0);
  await f.close();
});
