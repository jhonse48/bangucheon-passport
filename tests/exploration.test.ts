import assert from 'node:assert/strict';
import test from 'node:test';
import { places, routes } from '../src/data/content';
import { EXPLORATION_POINTS, EXPLORATION_ROUTES, HERITAGE_REFERENCE_POSITIONS, getExplorationPoint } from '../src/data/exploration';

test('all 13 exploration markers have traceable coordinates and explicit confidence', () => {
  assert.deepEqual(Object.keys(EXPLORATION_POINTS).sort(), places.map((place) => place.id).sort());
  assert.equal(new Set(Object.values(EXPLORATION_POINTS).map((point) => point.number)).size, 13);
  for (const place of places) {
    const point = getExplorationPoint(place.id);
    assert.ok(point?.position, `${place.id}: reference required`);
    assert.ok(point.position.lat > 35.60 && point.position.lat < 35.63, `${place.id}: outside researched area`);
    assert.ok(point.position.lng > 129.16 && point.position.lng < 129.19, `${place.id}: outside researched area`);
    assert.equal(new URL(point.source.url).protocol, 'https:');
    assert.ok(point.coordinateNote.trim());
    assert.notEqual(point.accuracy, 'unverified');
    if (point.accuracy === 'approximate') {
      assert.equal(point.kind, 'approximate');
      assert.match(point.coordinateNote, /근사/);
      assert.equal(place.viewingPosition, null, 'Approximate reference must not certify a safe viewpoint');
    }
  }
  assert.equal(getExplorationPoint('unknown'), null);
});

test('Bangudae corrected heritage position stays separate from its approximate viewing-area marker', () => {
  const heritage = HERITAGE_REFERENCE_POSITIONS.bangudae;
  const marker = EXPLORATION_POINTS.bangudae;
  assert.ok(heritage.lat < 35.605, 'Regression: the former northern tourism coordinate is not the petroglyph');
  assert.ok(marker.position!.lat < 35.605);
  assert.notDeepEqual(marker.position, heritage);
  assert.equal(marker.accuracy, 'approximate');
  assert.equal(places.find((place) => place.id === 'bangudae')?.viewingPosition, null);
  assert.deepEqual(places.find((place) => place.id === 'bangudae')?.heritagePosition, heritage);
  assert.ok(HERITAGE_REFERENCE_POSITIONS.cheonjeonri.lng > 129.174, 'Use the heritage portal point, not the old northwestern tourism reference');
});

test('A/B route data cover ten and three stops without fabricating a walking route', () => {
  assert.deepEqual(EXPLORATION_ROUTES.core.placeIds, ['museum', 'jipcheongjeong', 'seowon', 'poeundae', 'moeunjeong', 'memorial', 'old-road', 'wetland', 'dinosaur', 'bangudae']);
  assert.deepEqual(EXPLORATION_ROUTES.cheonjeon.placeIds, ['cheonjeonri', 'cheonjeonri-dinosaur', 'daegok-museum']);
  const ids = Object.values(EXPLORATION_ROUTES).flatMap((route) => [...route.placeIds]);
  assert.equal(ids.length, 13);
  assert.equal(new Set(ids).size, 13);
  for (const route of Object.values(EXPLORATION_ROUTES)) {
    assert.equal(route.lineKind, 'visit-order');
    assert.equal(route.dashed, true);
    assert.equal(route.label, '방문 순서 연결선');
    assert.deepEqual(routes.find((item) => item.id === route.id)?.placeIds, [...route.placeIds]);
  }
});

test('QR evidence distinguishes one photo, ten pending locations and two unlisted museums', () => {
  const points = Object.entries(EXPLORATION_POINTS);
  assert.deepEqual(points.filter(([, point]) => point.qr.status === 'photo-confirmed').map(([id]) => id), ['bangudae']);
  assert.equal(points.filter(([, point]) => ['needs-location-check', 'needs-individual-check'].includes(point.qr.status)).length, 10);
  assert.deepEqual(points.filter(([, point]) => point.qr.status === 'not-listed').map(([id]) => id).sort(), ['daegok-museum', 'museum']);
  assert.equal(EXPLORATION_POINTS.cheonjeonri.qr.status, 'needs-individual-check');
  for (const [, point] of points) {
    for (const value of [point.qr.label, point.qr.where, point.qr.find, point.qr.evidence]) assert.ok(value.trim());
    assert.match(point.qr.evidence, /ユーザー|사용자/);
  }
});
