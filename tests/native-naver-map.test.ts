import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeMapLayout, resolveNativeMapSelection, runNativeMapTask } from '../src/lib/native-naver-map';

test('native tiles fill the viewport while HTML overlays retain separate touch regions', () => {
  const bounds = { x: 0, y: 0, width: 390, height: 844 };
  const controls = [
    { x: 12, y: 60, width: 366, height: 130 },
    { x: 12, y: 600, width: 366, height: 230 },
    { x: 335, y: 250, width: 42, height: 132 },
  ];
  const layout = nativeMapLayout(bounds, controls, [
    { rect: controls[0], edge: 'top' }, { rect: controls[1], edge: 'bottom' },
  ]);
  assert.ok(layout);
  assert.deepEqual(layout.rect, bounds, 'HTML overlays must never carve the visible map down to a small rectangle.');
  assert.equal(layout.webTouchRects.length, 3);
  assert.deepEqual(layout.webTouchRects[0], { x: 8, y: 56, width: 374, height: 138 });
  assert.deepEqual(layout.contentInsets, { top: 194, right: 0, bottom: 248, left: 0 });
  assert.equal(layout.webTouchRects.some((rect) => 160 >= rect.x && 160 <= rect.x + rect.width && 400 >= rect.y && 400 <= rect.y + rect.height), false,
    'The exposed map center must pass touches through to native panning.');
});

test('touch bounds clip at viewport edges and deduplicate nested HTML controls', () => {
  const bounds = { x: 0, y: 0, width: 390, height: 844 };
  const layout = nativeMapLayout(bounds, [
    { x: -20, y: -10, width: 200, height: 100 },
    { x: 10, y: 10, width: 20, height: 20 },
    { x: -20, y: -10, width: 200, height: 100 },
    { x: 380, y: 830, width: 80, height: 40 },
  ]);
  assert.deepEqual(layout?.webTouchRects, [
    { x: 0, y: 0, width: 184, height: 94 },
    { x: 376, y: 826, width: 14, height: 18 },
  ]);
  assert.deepEqual(layout?.rect, bounds);
});

test('short rotated viewports keep a valid camera region without shrinking native tiles', () => {
  const bounds = { x: 0, y: 0, width: 844, height: 390 };
  const layout = nativeMapLayout(bounds, [], [
    { rect: { x: 0, y: 0, width: 390, height: 200 }, edge: 'top' },
    { rect: { x: 0, y: 190, width: 390, height: 200 }, edge: 'bottom' },
  ]);
  assert.deepEqual(layout?.rect, bounds);
  assert.equal(layout!.contentInsets.top + layout!.contentInsets.bottom, 310);
  assert.ok(layout!.contentInsets.top >= 0 && layout!.contentInsets.bottom >= 0);
});

test('invalid and collapsed controls are ignored; an invalid viewport fails closed', () => {
  const bounds = { x: 12, y: 48, width: 390, height: 700 };
  const layout = nativeMapLayout(bounds, [
    { x: 500, y: 50, width: 100, height: 100 },
    { x: 20, y: 50, width: 0, height: 80 },
    { x: NaN, y: 50, width: 100, height: 80 },
  ]);
  assert.deepEqual(layout?.rect, bounds);
  assert.deepEqual(layout?.webTouchRects, []);
  assert.equal(nativeMapLayout({ ...bounds, x: NaN }, []), null);
  assert.equal(nativeMapLayout({ ...bounds, height: 0 }, []), null);
});

test('a full-screen web overlay retains all touches without hiding the underlying map', () => {
  const bounds = { x: 0, y: 0, width: 390, height: 844 };
  const layout = nativeMapLayout(bounds, [bounds]);
  assert.deepEqual(layout?.rect, bounds);
  assert.deepEqual(layout?.webTouchRects, [bounds]);
});

test('native lifecycle operations remain ordered after an earlier bridge failure', async () => {
  const events: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const creating = runNativeMapTask(async () => {
    events.push('create');
    await gate;
    events.push('created');
  });
  const failedUpdate = runNativeMapTask(async () => {
    events.push('update');
    throw new Error('Test bridge failure');
  });
  const rejection = assert.rejects(failedUpdate, /Test bridge failure/);
  const destroying = runNativeMapTask(async () => { events.push('destroy'); });
  await Promise.resolve();
  assert.deepEqual(events, ['create']);
  release();
  await Promise.all([creating, rejection, destroying]);
  assert.deepEqual(events, ['create', 'created', 'update', 'destroy']);
});


test('native cluster selection keeps current route order and ignores stale or duplicate IDs', () => {
  const visible = [{ id: 'museum' }, { id: 'poeundae' }, { id: 'memorial' }];
  assert.deepEqual(resolveNativeMapSelection(visible, ['memorial', 'poeundae', 'poeundae', 'hidden-place', '__current_location']), [visible[1], visible[2]]);
  assert.deepEqual(resolveNativeMapSelection(visible.slice(0, 1), ['poeundae', 'memorial']), []);
  assert.deepEqual(resolveNativeMapSelection(visible, null), []);
  assert.deepEqual(resolveNativeMapSelection(visible, [42, 'museum']), [visible[0]]);
});
