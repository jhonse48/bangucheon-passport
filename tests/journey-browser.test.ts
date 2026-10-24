import assert from 'node:assert/strict';
import test from 'node:test';
import { createBrowserJourneyTracker } from '../src/lib/native-journey';

test('browser QA requests GPS only after start and pauses visibly when its page is hidden', async () => {
  const savedNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const documentMock = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  let watches = 0;
  let clears = 0;
  const geolocation = { watchPosition() { watches += 1; return watches; }, clearWatch() { clears += 1; } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: documentMock });
  try {
    const tracker = createBrowserJourneyTracker();
    const listener = await tracker.addListener('trackingUpdate', () => undefined);
    await tracker.getTrackingState();
    assert.equal(watches, 0);
    await tracker.startTracking({ journeyId: 'browser-walk' });
    assert.equal(watches, 1);
    documentMock.visibilityState = 'hidden';
    documentMock.dispatchEvent(new Event('visibilitychange'));
    const hidden = await tracker.getTrackingState();
    assert.equal(hidden.status, 'paused');
    assert.match(hidden.error!, /브라우저.*일시정지/);
    assert.equal(clears, 1);
    documentMock.visibilityState = 'visible';
    documentMock.dispatchEvent(new Event('visibilitychange'));
    assert.equal(watches, 1, 'Visibility alone never resumes GPS');
    await tracker.resumeTracking();
    assert.equal(watches, 2);
    await tracker.stopTracking();
    assert.equal(clears, 2);
    await tracker.clearTracking();
    assert.deepEqual(await tracker.getTrackingState(), { journeyId: null, status: 'idle', points: [] });
    await listener.remove();
  } finally {
    if (savedNavigator) Object.defineProperty(globalThis, 'navigator', savedNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
    if (savedDocument) Object.defineProperty(globalThis, 'document', savedDocument); else Reflect.deleteProperty(globalThis, 'document');
  }
});
