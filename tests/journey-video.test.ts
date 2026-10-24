import assert from 'node:assert/strict';
import test from 'node:test';
import { newJourney } from '../src/lib/journey';
import type { JourneyRecord } from '../src/lib/journey';
import { validateVideoJourney } from '../src/lib/journey-video';

test('video export requires a finished journey and actual route or photos', () => {
  const journey = newJourney('video-test', 1000);
  assert.throws(() => validateVideoJourney(journey), /종료/);
  const completed: JourneyRecord = { ...journey, status: 'completed', endedAt: 2000 };
  assert.throws(() => validateVideoJourney(completed), /경로나 사진/);
  completed.points = [{ lat: 35.6, lng: 129.17, accuracy: 5, timestamp: 1000, segment: 0 }, { lat: 35.6001, lng: 129.17, accuracy: 5, timestamp: 2000, segment: 0 }];
  assert.doesNotThrow(() => validateVideoJourney(completed));
});

test('photos without GPS can be included in a film, and excess photos are never silently dropped', () => {
  const journey: JourneyRecord = { ...newJourney('photo-video', 1000), status: 'completed', endedAt: 2000 };
  const photo = { id: 'test-photo', createdAt: 1500, lat: null, lng: null, accuracy: null, blob: new Blob(['test-image'], { type: 'image/jpeg' }), thumbnailDataUrl: 'data:image/jpeg;base64,dGVzdA==' };
  journey.photos = [photo];
  assert.doesNotThrow(() => validateVideoJourney(journey));
  journey.photos = Array.from({ length: 61 }, (_, index) => ({ ...photo, id: `photo-${index}` }));
  assert.throws(() => validateVideoJourney(journey), /최대 60장/);
});
