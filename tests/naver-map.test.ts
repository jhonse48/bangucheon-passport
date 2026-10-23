import assert from 'node:assert/strict';
import test from 'node:test';
import { getMapAnchor, loadNaverSDK, mapAnchorLabel, naverSdkUrl, naverSearchUrl, OFFICIAL_MAP_ANCHORS, REGION_MAP_REFERENCE, subscribeNaverAuthFailure, validMapPosition } from '../src/lib/naver-map';
import type { NaverSDK } from '../src/lib/naver-map';
import type { Place } from '../src/lib/types';

const place = (patch: Partial<Place> = {}): Place => ({ id: 'unknown', viewingPosition: null, heritagePosition: null, locationStatus: '확인 필요', sources: [], ...patch }) as Place;

test('new Naver Maps loader uses ncpKeyId and never adds a secret or legacy client parameter', () => {
  const url = new URL(naverSdkUrl('test-id&callback=other'));
  assert.equal(url.origin, 'https://oapi.map.naver.com');
  assert.equal(url.searchParams.get('ncpKeyId'), 'test-id&callback=other');
  assert.equal(url.searchParams.get('callback'), '__bangucheonNaverReady');
  assert.deepEqual([...url.searchParams.keys()], ['ncpKeyId', 'callback']);
});

test('official representative anchors have sources but never imply safe viewing coordinates', () => {
  assert.equal(REGION_MAP_REFERENCE, OFFICIAL_MAP_ANCHORS.museum);
  for (const [id, anchor] of Object.entries(OFFICIAL_MAP_ANCHORS)) {
    assert.equal(validMapPosition(anchor.position), true);
    assert.equal(new URL(anchor.source.url).hostname, 'www.ulsan.go.kr');
    assert.match(anchor.source.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.notEqual(anchor.kind, 'viewing');
    assert.equal(getMapAnchor(place({ id })), anchor);
  }
  assert.match(mapAnchorLabel(OFFICIAL_MAP_ANCHORS.bangudae), /관람 지점 아님/);
  assert.match(mapAnchorLabel(OFFICIAL_MAP_ANCHORS.museum), /출입구 확인 필요/);
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
