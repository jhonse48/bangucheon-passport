import assert from 'node:assert/strict';
import test from 'node:test';
import { createNaverMapLifecycle, isNaverSDKUsable, explorationMapAnchor, getMapAnchor, getMapRoute, journeyMapBounds, journeyMapFocusKey, journeyMapSegments, mapOverlayPlacement, mapCameraIntent, mapMarkerDetails, mapPoints, mapRouteLine, mapRouteNotice, mapSceneKey, loadNaverSDK, mapAnchorLabel, naverSdkUrl, naverSearchUrl, REGION_MAP_REFERENCE, subscribeNaverAuthFailure, validMapPosition } from '../src/lib/naver-map';
import type { JourneyMapLayer, JourneyMapPoint, NaverSDK } from '../src/lib/naver-map';
import { places, routes } from '../src/data/content';
import { EXPLORATION_POINTS, HERITAGE_REFERENCE_POSITIONS } from '../src/data/exploration';
import type { ExplorationPoint } from '../src/data/exploration';
import type { Place, TourRoute } from '../src/lib/types';

const place = (patch: Partial<Place> = {}): Place => ({ id: 'unknown', viewingPosition: null, heritagePosition: null, locationStatus: '확인 필요', sources: [], ...patch }) as Place;

const sample = (timestamp: number, segment = 0): JourneyMapPoint => ({ lat: 35 + timestamp / 100000, lng: 129, timestamp, accuracy: 5, segment });
test('map buttons follow the measured journey header, including safe-area and added course rows', () => {
  const stage = { y: 100, height: 744 };
  const initial = mapOverlayPlacement(stage, 425, 700, 3, 40);
  assert.deepEqual(initial, { top: 333, height: 259, columns: 1 });
  const withCourse = mapOverlayPlacement(stage, 470, 700, 3, 40);
  assert.equal(withCourse.top, initial.top + 45);
  assert.equal(withCourse.top + stage.y, 478, 'Controls start eight pixels below the entire header border box');
});

test('short exposed map areas reflow buttons into columns and keep fallback content within the viewport', () => {
  const placement = mapOverlayPlacement({ y: 0, height: 667 }, 325, 445, 5, 40);
  assert.deepEqual(placement, { top: 333, height: 104, columns: 3 });
  assert.ok(placement.top + Math.ceil(5 / placement.columns) * 40 + 7 <= 445 - 8);
  const crowded = mapOverlayPlacement({ y: 0, height: 390 }, 500, 300, 3, 40);
  assert.equal(crowded.columns, 3);
  assert.ok(crowded.top >= 0 && crowded.top + crowded.height <= 390);
});

test('web map teardown releases overlays before destroying SDK internals and ignores later effect cleanup', () => {
  const calls: string[] = [];
  const sdk = { maps: { Map: class TestMap {} } } as unknown as NaverSDK;
  const lifecycle = createNaverMapLifecycle(sdk, { destroy() { calls.push('destroy'); Object.assign(sdk, { maps: null }); } });
  const markerCleanup = lifecycle.add((usable) => { calls.push(`markers:${usable}`); });
  const routeCleanup = lifecycle.add((usable) => { calls.push(`route:${usable}`); });
  lifecycle.dispose(); markerCleanup(); routeCleanup(); lifecycle.dispose();
  assert.deepEqual(calls, ['route:true', 'markers:true', 'destroy']);
});

test('late authentication revocation still removes DOM handlers without calling the invalid SDK', () => {
  const calls: string[] = [];
  const sdk = { maps: { Map: class TestMap {} } } as unknown as NaverSDK;
  const lifecycle = createNaverMapLifecycle(sdk, { destroy() { calls.push('unsafe SDK destroy'); } });
  const release = lifecycle.add((usable) => { calls.push(`dom removed:${usable}`); });
  Object.assign(sdk, { maps: null });
  assert.equal(isNaverSDKUsable(sdk), false);
  lifecycle.dispose(); release();
  assert.deepEqual(calls, ['dom removed:false']);
});

test('recorded paths never connect across pauses or malformed location samples', () => {
  const points = [sample(1), sample(2), sample(3, 1), sample(4, 1), { ...sample(5, 1), lat: NaN }, sample(6, 1), sample(7, 1), sample(8, 2)];
  assert.deepEqual(journeyMapSegments(points).map((segment) => segment.map((point) => point.timestamp)), [[1, 2], [3, 4], [6, 7]]);
  assert.deepEqual(journeyMapSegments([{ ...sample(1), accuracy: -1 }, sample(2)]), []);
});

test('recorded paths also split long GPS gaps and non-increasing timestamps', () => {
  const points = [sample(1), sample(120001), sample(240002), sample(240003), sample(240002), sample(240003)];
  assert.deepEqual(journeyMapSegments(points).map((segment) => segment.map((point) => point.timestamp)),
    [[1, 120001], [240002, 240003], [240002, 240003]]);
});

test('trip review bounds include actual photo positions while recording samples do not change focus', () => {
  const journey: JourneyMapLayer = { id: 'trip', points: [sample(1), sample(2)], photos: [{ id: 'photo', lat: 36, lng: 130, thumbnailUrl: 'data:image/jpeg;base64,test' }], focus: true };
  assert.equal(journeyMapBounds(journey).length, 3);
  assert.deepEqual(journeyMapBounds(journey).at(-1), journey.photos[0]);
  assert.equal(journeyMapFocusKey(journey), journeyMapFocusKey({ ...journey, points: [...journey.points, sample(3)] }));
  assert.equal(journeyMapFocusKey({ ...journey, focus: false }), null);
  assert.notEqual(journeyMapFocusKey(journey), journeyMapFocusKey({ ...journey, id: 'another-trip' }));
  assert.equal(journeyMapBounds({ ...journey, points: [{ ...sample(1), lat: NaN }], photos: [] }).length, 0);
});

test('new Naver Maps loader uses ncpKeyId and never adds a secret or legacy client parameter', () => {
  const url = new URL(naverSdkUrl('test-id&callback=other'));
  assert.equal(url.origin, 'https://oapi.map.naver.com');
  assert.equal(url.searchParams.get('ncpKeyId'), 'test-id&callback=other');
  assert.equal(url.searchParams.get('callback'), '__bangucheonNaverReady');
  assert.deepEqual([...url.searchParams.keys()], ['ncpKeyId', 'callback']);
});

const sourcePoint = (patch: Partial<ExplorationPoint> = {}): ExplorationPoint => ({
  number: 1, position: { lat: 35.6, lng: 129.17 }, kind: 'heritage', accuracy: 'official',
  source: { title: 'Location source', url: 'https://www.ulsan.go.kr/', checkedAt: '2026-10-23' }, coordinateNote: 'Representative location only',
  qr: { status: 'needs-location-check', label: 'QR 위치 확인 중', where: '', find: '', evidence: '' }, ...patch,
});

test('map references preserve sourced approximate locations without certifying them as viewpoints', () => {
  assert.equal(validMapPosition(REGION_MAP_REFERENCE.position), true);
  assert.equal(REGION_MAP_REFERENCE.kind, 'facility');
  assert.match(mapAnchorLabel(REGION_MAP_REFERENCE), /출입구 확인 필요/);
  const approximate = explorationMapAnchor(sourcePoint({ accuracy: 'approximate', kind: 'approximate' }));
  assert.ok(approximate);
  assert.equal(approximate.approximate, true);
  const publicViewpoint = explorationMapAnchor(sourcePoint({ accuracy: 'public-map', kind: 'viewing' }));
  assert.ok(publicViewpoint);
  assert.match(mapAnchorLabel(publicViewpoint), /대표 위치.*현장 확인 필요/);
  assert.doesNotMatch(mapAnchorLabel(publicViewpoint), /확인된 관람 위치/);
  assert.match(mapAnchorLabel(approximate), /근사 위치.*확인 필요/);
  assert.equal(explorationMapAnchor(sourcePoint({ accuracy: 'unverified' })), null);
  assert.equal(explorationMapAnchor(sourcePoint({ position: null })), null);
  assert.equal(explorationMapAnchor(sourcePoint({ position: { lat: Infinity, lng: 129 } })), null);
});

test('numbered markers retain their source number and physical QR status', () => {
  for (const [id, point] of Object.entries(EXPLORATION_POINTS)) {
    const marker = mapMarkerDetails(id);
    assert.equal(marker.number, point.number);
    assert.equal(marker.qrStatus, point.qr.status === 'photo-confirmed' ? 'ready' : point.qr.status === 'not-listed' ? 'none' : 'pending');
    if (point.position && point.accuracy !== 'unverified') {
      const anchor = getMapAnchor(place({ id }));
      assert.ok(anchor);
      assert.deepEqual(anchor.position, point.position);
      assert.equal(anchor.source.url, point.source.url);
    }
  }
  const course = { id: 'cheonjeon', placeIds: ['cheonjeonri', 'cheonjeonri-dinosaur', 'daegok-museum'] } as TourRoute;
  assert.deepEqual(course.placeIds.map((id) => mapMarkerDetails(id, course).number), [1, 2, 3]);
  assert.equal(mapMarkerDetails('unknown').number, undefined);
  assert.equal(mapMarkerDetails('unknown').qrStatus, 'none');
});

test('all thirteen researched places are on the map, and A/B fit complete independent point sets', () => {
  assert.equal(places.length, 13);
  assert.equal(mapPoints(places).length, 13);
  assert.deepEqual(places.map((item) => mapMarkerDetails(item.id).number).sort((a, b) => a! - b!), Array.from({ length: 13 }, (_, index) => index + 1));
  const statuses = places.map((item) => mapMarkerDetails(item.id).qrStatus);
  assert.equal(statuses.filter((status) => status === 'ready').length, 1);
  assert.equal(statuses.filter((status) => status === 'pending').length, 10);
  assert.equal(statuses.filter((status) => status === 'none').length, 2);
  for (const [id, size] of [['core', 10], ['cheonjeon', 3]] as const) {
    const model = getMapRoute(routes.find((route) => route.id === id));
    assert.ok(model);
    assert.equal(model.points.length, size);
    assert.equal(model.missingCount, 0);
    assert.ok(mapRouteLine(model));
  }
  const bangudae = getMapAnchor(places.find((item) => item.id === 'bangudae'));
  assert.ok(bangudae?.approximate);
  assert.notDeepEqual(bangudae.position, { lat: 35.60827, lng: 129.175561 }, 'Do not restore the old unrelated northern POI');
  assert.notDeepEqual(bangudae.position, HERITAGE_REFERENCE_POSITIONS.bangudae, 'The rock face is not a visitor destination');
});

test('route order uses the full source data independently of filtered marker lists', () => {
  const route = { id: 'test-route', placeIds: ['a', 'b', 'c'] } as TourRoute;
  const points = { a: sourcePoint(), b: sourcePoint({ position: { lat: 35.61, lng: 129.18 }, accuracy: 'approximate' }), c: sourcePoint({ position: { lat: 35.62, lng: 129.19 } }) };
  const model = getMapRoute(route, points);
  assert.ok(model);
  assert.deepEqual(model.points, Object.values(points).map((point) => point.position));
  assert.equal(mapRouteLine(model)?.kind, 'visit-order');
  assert.equal(model.approximate, true);
  assert.match(mapRouteNotice(model), /실제 보행 경로 아님.*근사 위치/);
  assert.equal(getMapRoute(null, points), null);
  assert.equal(mapRouteLine(null), null);
  assert.equal(mapRouteNotice(null), '');
  const incomplete = getMapRoute(route, { ...points, b: sourcePoint({ position: null }) });
  assert.equal(incomplete?.missingCount, 1);
  assert.equal(incomplete?.points.length, 2);
  assert.equal(mapRouteLine(incomplete), null, 'Do not silently bridge over a missing route stop');
  assert.match(mapRouteNotice(incomplete), /1곳 위치 확인 중/);
});

test('initial overview and course changes fit bounds before any selected-place focus', () => {
  const all = { sceneKey: mapSceneKey(null, [{ lat: 35.6, lng: 129.17 }]), selectedId: 'bangudae' };
  assert.equal(mapCameraIntent(null, all), 'fit');
  assert.equal(mapCameraIntent(all, all), 'none');
  assert.equal(mapCameraIntent(all, { ...all, selectedId: 'museum' }), 'select');
  const course = { ...all, sceneKey: 'core' };
  assert.equal(mapCameraIntent(all, course), 'fit');
  assert.equal(mapCameraIntent(course, { ...course, sceneKey: 'cheonjeon', selectedId: 'museum' }), 'fit');
  assert.equal(mapCameraIntent(course, all), 'fit', 'Clearing a course restores the overview');
});

test('unknown or unverified coordinates cannot produce a visitor marker', () => {
  assert.equal(getMapAnchor(place({ heritagePosition: { lat: 35, lng: 129 } })), null);
  assert.equal(getMapAnchor(place({ viewingPosition: { lat: 35, lng: 129 } })), null);
  assert.equal(getMapAnchor(place({ locationStatus: '공식 자료 확인', viewingPosition: { lat: NaN, lng: 129 } })), null);
  assert.equal(getMapAnchor(place({ locationStatus: '공식 자료 확인', viewingPosition: { lat: 35, lng: 129 } })), null);
  const checked = place({ locationStatus: '공식 자료 확인', viewingPosition: { lat: 35, lng: 129 }, sources: [{ title: 'Test official location source', url: 'https://www.ulsan.go.kr/', checkedAt: '2026-10-22' }] });
  assert.equal(getMapAnchor(checked)?.kind, 'viewing');
});

test('external Naver navigation is search-only and preserves an encoded query', () => {
  const query = '울산 장소 /?next=https://example.com#point';
  const url = new URL(naverSearchUrl(query));
  assert.equal(url.origin, 'https://map.naver.com');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  assert.equal(decodeURIComponent(url.pathname.slice('/p/search/'.length)), query);
  assert.match(decodeURIComponent(naverSearchUrl('   ')), /울산 반구천$/);
});

test('SDK callback waits for global exports and keeps authentication failures distinct', async (context) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const scripts: { src: string; onload?: () => void; onerror?: () => void; remove: () => void }[] = [];
  const fakeWindow: {
    setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout;
    naver?: NaverSDK; __bangucheonNaverReady?: () => void; navermap_authFailure?: () => void;
  } = { setTimeout, clearTimeout };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ src: '', remove() {} }),
    head: { appendChild: (script: typeof scripts[number]) => { scripts.push(script); } },
  } });
  context.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  });

  // An actual authentication failure must reject, even if a ready callback
  // was already scheduled. Failure also permits a subsequent clean retry.
  const failures: string[] = [];
  const unsubscribe = subscribeNaverAuthFailure((error) => failures.push(error.message));
  context.after(unsubscribe);
  const rejected = loadNaverSDK('test-client-id');
  const rejection = assert.rejects(rejected, /인증에 실패/);
  fakeWindow.__bangucheonNaverReady?.();
  fakeWindow.navermap_authFailure?.();
  await rejection;
  assert.equal(failures.length, 1);

  const pending = loadNaverSDK('test-client-id');
  assert.equal(loadNaverSDK('test-client-id'), pending);
  assert.equal(scripts.length, 2);
  // Reproduce the real 3.10.5 ordering: invoke the global callback first,
  // then publish window.naver.maps before the same script evaluation ends.
  fakeWindow.__bangucheonNaverReady?.();
  const sdk = { maps: { Map: class TestMap {} } } as unknown as NaverSDK;
  fakeWindow.naver = sdk;
  assert.equal(await pending, sdk);
  scripts.at(-1)?.onload?.();
  assert.equal(await loadNaverSDK('test-client-id'), sdk);
  await assert.rejects(loadNaverSDK('different-client-id'), /키가 바뀌었습니다/);
});
