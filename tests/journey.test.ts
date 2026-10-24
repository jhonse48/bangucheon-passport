import assert from 'node:assert/strict';
import test from 'node:test';
import { distanceMeters, journeyDayKey, journeyDisplayEnd, journeySegments, journeyVideoSnapshot, newJourney, normalizeJourneyPoints, photoCoordinates } from '../src/lib/journey';
import type { JourneyPoint } from '../src/lib/journey';

const time = 1_800_000_000_000;
const point = (offset: number, lat = 35.6, segment = 0): JourneyPoint => ({ lat, lng: 129.17, timestamp: time + offset, accuracy: 5, segment });

test('journey fixes deduplicate sensor timestamps and reject poor, pre-start, future and jumping locations', () => {
  const good = [point(1_000), point(11_000, 35.6001), point(21_000, 35.6002)];
  const normalized = normalizeJourneyPoints([
    good[2], good[0], good[1], { ...good[1], accuracy: 20 }, good[0],
    { ...point(500), accuracy: 100 }, point(-1), point(100_000),
    point(12_000, 36.6), { ...point(13_000), lat: NaN }, { ...point(14_000), segment: -1 },
  ], time, time + 30_000);
  assert.deepEqual(normalized, good);
  // A persisted native buffer is valid after JS was suspended for hours.
  assert.deepEqual(normalizeJourneyPoints(good, time, time + 10_000_000), good);
});

test('distance excludes paused segments and long sensor gaps instead of drawing fictitious connecting lines', () => {
  const points = [point(0), point(10_000, 35.6001), point(20_000, 35.61, 1), point(30_000, 35.6101, 1),
    point(300_000, 35.62, 1), point(310_000, 35.6201, 1)];
  assert.equal(journeySegments(points).length, 3);
  assert.ok(distanceMeters(points) > 33 && distanceMeters(points) < 34);
  assert.equal(distanceMeters([]), 0);
  assert.equal(distanceMeters([point(0)]), 0);
});

test('photo location requires a fresh accurate sensor reading; no reading never inherits a place or route point', () => {
  const valid = { lat: 35.6, lng: 129.17, timestamp: time, accuracy: 8 };
  assert.deepEqual(photoCoordinates(valid, time + 15_000), { lat: 35.6, lng: 129.17, accuracy: 8 });
  for (const location of [undefined, { ...valid, timestamp: time - 31_000 }, { ...valid, accuracy: 80 },
    { ...valid, timestamp: time + 10_000 }, { ...valid, lat: 999 }, { ...valid, accuracy: 0 }]) {
    assert.deepEqual(photoCoordinates(location, time), { lat: null, lng: null, accuracy: null });
  }
});

test('daily timeline accepts road and fast rail movement but still rejects an instantaneous teleport', () => {
  const fixes = [point(0), point(30_000, 35.6075), point(60_000, 35.63)];
  assert.deepEqual(normalizeJourneyPoints([...fixes, point(61_000, 36.63)], time, time + 61_000), fixes);
});

test('automatic day keys cross midnight in Korea independently of the browser timezone', () => {
  assert.equal(journeyDayKey(Date.parse('2026-10-23T14:59:59Z')), '2026-10-23');
  assert.equal(journeyDayKey(Date.parse('2026-10-23T15:00:00Z')), '2026-10-24');
});

test('an old paused automatic day displays and exports only its observed span while manual elapsed time is unchanged', () => {
  const automatic = { ...newJourney('daily', time), mode: 'automatic' as const, status: 'paused' as const,
    points: [point(1_000), point(11_000)] };
  const later = time + 3 * 86_400_000;
  assert.equal(journeyDisplayEnd(automatic, later), time + 11_000);
  assert.equal(journeyVideoSnapshot(automatic, later).endedAt, time + 11_000);
  assert.equal(automatic.endedAt, null);
  assert.equal(journeyDisplayEnd({ ...automatic, mode: 'manual' }, later), later);
  assert.equal(journeyDisplayEnd({ ...automatic, endedAt: time + 20_000 }, later), time + 20_000);
});
