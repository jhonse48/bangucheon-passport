import assert from 'node:assert/strict';
import test from 'node:test';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createJourneyStorage } from '../src/lib/journey-storage';
import type { JourneyPhoto, JourneyPoint, JourneyTrackingState } from '../src/lib/journey';
import { distanceMeters } from '../src/lib/journey';
import { createPassportStorage } from '../src/lib/storage';

const time = 1_800_000_000_000;
const point = (offset: number, segment = 0): JourneyPoint => ({ lat: 35.6 + offset / 100_000_000, lng: 129.17, timestamp: time + offset, accuracy: 5, segment });
const state = (points: JourneyPoint[], status: JourneyTrackingState['status'] = 'recording'): JourneyTrackingState => ({ journeyId: 'walk', status, points });
const photo = (id = 'photo'): JourneyPhoto => ({ id, createdAt: time + 10_000, lat: null, lng: null, accuracy: null,
  blob: new Blob([new Uint8Array([0, 1, 128, 255])], { type: 'image/jpeg' }), thumbnailDataUrl: 'data:image/jpeg;base64,AAE=' });

test('concurrent native full snapshots merge atomically without point loss or duplicates and survive reopen', async () => {
  const indexedDB = new IDBFactory();
  const first = createJourneyStorage({ indexedDB });
  const second = createJourneyStorage({ indexedDB });
  await first.create('walk', time);
  await Promise.all([
    first.reconcileTrackingState(state([point(1_000), point(11_000)]), time + 50_000),
    second.reconcileTrackingState(state([point(11_000), point(21_000)]), time + 50_000),
    first.reconcileTrackingState(state([point(1_000)]), time + 50_000),
  ]);
  await first.close(); await second.close();
  const reopened = createJourneyStorage({ indexedDB });
  assert.deepEqual((await reopened.snapshot())[0].points, [point(1_000), point(11_000), point(21_000)]);
  await reopened.close();
});

test('native stopped buffer recovers a completed journey and late statuses cannot reopen it', async () => {
  const storage = createJourneyStorage({ indexedDB: new IDBFactory() });
  const recovered = await storage.reconcileTrackingState(state([point(1_000), point(11_000)], 'idle'), time + 20_000);
  assert.equal(recovered[0].status, 'completed');
  assert.equal(recovered[0].startedAt, time + 1_000);
  assert.equal(recovered[0].endedAt, time + 20_000);
  const replayed = await storage.reconcileTrackingState(state([point(1_000), point(11_000), point(30_000)]), time + 40_000);
  assert.equal(replayed[0].status, 'completed');
  assert.equal(replayed[0].points.length, 2);
  await storage.close();
});

test('lost native buffer pauses unfinished history and a restart gets a separate persistent segment', async () => {
  const storage = createJourneyStorage({ indexedDB: new IDBFactory() });
  await storage.create('walk', time);
  await storage.reconcileTrackingState(state([point(1_000), point(11_000)]), time + 12_000);
  const paused = await storage.reconcileTrackingState({ journeyId: null, status: 'idle', points: [] }, time + 13_000);
  assert.equal(paused[0].status, 'paused');
  await storage.prepareRestart('walk', time + 14_000);
  const resumed = await storage.reconcileTrackingState(state([point(15_000), point(25_000)]), time + 26_000);
  assert.deepEqual(resumed[0].points.map((item) => item.segment), [0, 0, 1, 1]);
  assert.ok(distanceMeters(resumed[0].points) < 23);
  // The same full native buffer does not apply the offset twice.
  assert.deepEqual((await storage.reconcileTrackingState(state([point(15_000), point(25_000)]), time + 27_000))[0].points, resumed[0].points);
  await storage.close();
});

test('only one journey can be started across concurrent connections', async () => {
  const indexedDB = new IDBFactory();
  const first = createJourneyStorage({ indexedDB }); const second = createJourneyStorage({ indexedDB });
  const result = await Promise.allSettled([first.create('first', time), second.create('second', time)]);
  assert.equal(result.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal((await first.snapshot()).length, 1);
  await first.close(); await second.close();
});

test('a previous stopped buffer pauses a new session interrupted between local creation and native start', async () => {
  const storage = createJourneyStorage({ indexedDB: new IDBFactory() });
  await storage.reconcileTrackingState(state([point(1_000)], 'idle'), time + 2_000);
  await storage.create('interrupted-start', time + 3_000);
  const recovered = await storage.reconcileTrackingState(state([point(1_000)], 'idle'), time + 4_000);
  assert.equal(recovered.find((record) => record.id === 'interrupted-start')?.status, 'paused');
  assert.equal(recovered.find((record) => record.id === 'walk')?.status, 'completed');
  assert.equal(recovered.find((record) => record.id === 'walk')?.points.length, 1);
  await storage.close();
});

test('paused journeys accept photos exactly once per mission and exports preserve bytes and coordinates', async () => {
  const storage = createJourneyStorage({ indexedDB: new IDBFactory() });
  await storage.create('walk', time); await storage.setStatus('walk', 'paused', time + 5_000);
  const first = await storage.addPhoto('walk', { ...photo(), lat: 35.6, lng: 129.17, accuracy: 5, sourceMissionId: 'museum-photo' });
  const duplicate = await storage.addPhoto('walk', { ...photo('duplicate'), sourceMissionId: 'museum-photo' });
  assert.equal(duplicate.id, first.id);
  await storage.addPhoto('walk', photo('without-location'));
  const exported = await storage.exportData();
  assert.equal(exported.journeys[0].photos.length, 2);
  assert.equal(exported.journeys[0].photos[0].lat, 35.6);
  assert.equal(exported.journeys[0].photos[1].lat, null);
  assert.deepEqual(Buffer.from(exported.journeys[0].photos[0].blob.data, 'base64'), Buffer.from([0, 1, 128, 255]));
  await storage.close();
});

test('quota aborts leave points and photos unchanged instead of acknowledging an uncommitted save', async () => {
  const storage = createJourneyStorage({ indexedDB: new IDBFactory() });
  await storage.create('walk', time); await storage.reconcileTrackingState(state([point(1_000)]), time + 2_000);
  const before = await storage.snapshot();
  const original = IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'journeys') throw new DOMException('Full', 'QuotaExceededError');
      return original.apply(this, args);
    };
    await assert.rejects(() => storage.reconcileTrackingState(state([point(1_000), point(11_000)]), time + 12_000), { name: 'QuotaExceededError' });
    await assert.rejects(() => storage.addPhoto('walk', photo()), { name: 'QuotaExceededError' });
  } finally { IDBObjectStore.prototype.put = original; }
  assert.deepEqual(await storage.snapshot(), before);
  await storage.close();
});

test('deletion cannot be undone by delayed native buffers and journey clearing preserves old passport records', async () => {
  const indexedDB = new IDBFactory();
  const storage = createJourneyStorage({ indexedDB }); const passport = createPassportStorage({ indexedDB });
  await passport.saveNote('museum', '기존 여권');
  await storage.create('walk', time);
  await storage.deleteJourney('walk');
  assert.deepEqual(await storage.reconcileTrackingState(state([point(1_000)]), time + 2_000), []);
  await storage.create('another', time + 3_000);
  await storage.addPhoto('another', photo());
  await storage.clearAll();
  assert.deepEqual(await storage.reconcileTrackingState({ ...state([point(4_000)]), journeyId: 'another' }, time + 5_000), []);
  assert.equal((await passport.snapshot()).records.museum.note, '기존 여권');
  await storage.close(); await passport.close();
});
