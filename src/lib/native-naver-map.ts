import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { validJourneyMapPoint, validMapPosition } from './naver-map';
import type { JourneyMapLayer, JourneyMapPoint } from './naver-map';

export interface NativeMapRect { x: number; y: number; width: number; height: number }
export interface NativeMapPosition { lat: number; lng: number }
export interface NativeMapInsets { top: number; right: number; bottom: number; left: number }
export interface NativeMapInsetRegion { rect: NativeMapRect; edge: keyof NativeMapInsets }
export interface NativeMapMarker extends NativeMapPosition {
  id: string;
  title: string;
  label: string;
  kind: 'viewing' | 'heritage' | 'facility' | 'approximate' | 'location';
  completed: boolean;
  selected: boolean;
  number?: number;
  qrStatus?: 'ready' | 'pending' | 'none';
  approximate?: boolean;
}
export interface NativeMapRoute {
  id: string;
  points: NativeMapPosition[];
  kind: 'walking' | 'visit-order';
}
export interface NativeMapBounds { points: NativeMapPosition[]; padding?: number }
export interface JourneySnapshotPhoto extends NativeMapPosition { id: string }
export interface JourneyMapSnapshot {
  dataUrl: string;
  points: { x: number; y: number; segment: number }[];
  photos: { id: string; x: number; y: number }[];
}
export interface NativeMapUpdate {
  rect?: NativeMapRect;
  center?: NativeMapPosition;
  zoom?: number;
  markers?: NativeMapMarker[];
  webTouchRects?: NativeMapRect[];
  interactionEnabled?: boolean;
  contentInsets?: NativeMapInsets;
  route?: NativeMapRoute | null;
  fitBounds?: NativeMapBounds;
  journey?: Omit<JourneyMapLayer, 'focus'> | null;
}
export interface NativeNaverMapPlugin {
  create(options: Required<Omit<NativeMapUpdate, 'route' | 'fitBounds' | 'journey'>> & Pick<NativeMapUpdate, 'route' | 'fitBounds' | 'journey'> & { clientId: string; visible: boolean }): Promise<void>;
  update(options: NativeMapUpdate): Promise<void>;
  setVisible(options: { visible: boolean }): Promise<void>;
  destroy(): Promise<void>;
  captureJourneySnapshot(options: { points: JourneyMapPoint[]; photos: JourneySnapshotPhoto[] }): Promise<JourneyMapSnapshot>;
  addListener(event: 'photoTap', listener: (event: { id: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'clusterTap', listener: (event: { ids: string[] }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'markerTap', listener: (event: { id: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'authState', listener: (event: { authorized: boolean; code?: number; message?: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'mapReady', listener: () => void): Promise<PluginListenerHandle>;
}
export const NaverNativeMap = registerPlugin<NativeNaverMapPlugin>('NaverNativeMap');
export const isNativeNaverMap = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

/** Resolve delayed native group events against the currently visible place list. */
export function resolveNativeMapSelection<T extends { id: string }>(places: readonly T[], ids: unknown): T[] {
  if (!Array.isArray(ids)) return [];
  const selectedIds = new Set(ids.filter((id): id is string => typeof id === 'string'));
  return places.filter((place) => selectedIds.has(place.id));
}

// Keep native create/update/destroy ordered across React effect cleanup/remounts.
let nativeQueue: Promise<unknown> = Promise.resolve();
export function runNativeMapTask<T>(operation: () => Promise<T>): Promise<T> {
  const task = nativeQueue.then(operation, operation);
  nativeQueue = task.catch(() => undefined);
  return task;
}

/** Only an explicitly selected trip is sent to the SDK; never the device location overlay. */
export async function captureJourneyMapSnapshot(points: JourneyMapPoint[], photos: JourneySnapshotPhoto[]): Promise<JourneyMapSnapshot> {
  if (!isNativeNaverMap()) throw new Error('지도 영상 캡처는 iPhone 앱에서 사용할 수 있습니다.');
  if ((!points.length && !photos.length) || !points.every(validJourneyMapPoint)
    || !photos.every((photo) => Boolean(photo.id) && validMapPosition(photo))) {
    throw new Error('지도에 표시할 여행 좌표를 확인해 주세요.');
  }
  return runNativeMapTask(() => NaverNativeMap.captureJourneySnapshot({ points, photos: photos.map(({ id, lat, lng }) => ({ id, lat, lng })) }));
}

function usableRect(rect: NativeMapRect): boolean {
  return [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0;
}
function contains(a: NativeMapRect, b: NativeMapRect): boolean {
  return a.x <= b.x && a.y <= b.y && a.x + a.width >= b.x + b.width && a.y + a.height >= b.y + b.height;
}

/** Keep the entire map visible; only HTML overlay touch regions stay in WKWebView. */
export function nativeMapLayout(bounds: NativeMapRect, controls: NativeMapRect[], insetRegions: NativeMapInsetRegion[] = [], gap = 4): {
  rect: NativeMapRect; webTouchRects: NativeMapRect[]; contentInsets: NativeMapInsets;
} | null {
  if (!usableRect(bounds)) return null;
  const touchGap = Number.isFinite(gap) ? Math.max(0, gap) : 4;
  const clipped = (rect: NativeMapRect, padding = 0): NativeMapRect | null => {
    if (!usableRect(rect)) return null;
    const x = Math.max(bounds.x, rect.x - padding), y = Math.max(bounds.y, rect.y - padding);
    const right = Math.min(bounds.x + bounds.width, rect.x + rect.width + padding);
    const bottom = Math.min(bounds.y + bounds.height, rect.y + rect.height + padding);
    const value = { x, y, width: right - x, height: bottom - y };
    return usableRect(value) ? value : null;
  };
  const webTouchRects = controls.map((rect) => clipped(rect, touchGap)).filter((rect): rect is NativeMapRect => rect !== null)
    .filter((candidate, index, all) => !all.some((other, otherIndex) =>
      otherIndex !== index && contains(other, candidate) && (otherIndex < index || !contains(candidate, other))));
  const contentInsets: NativeMapInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  for (const { rect: source, edge } of insetRegions) {
    const rect = clipped(source, touchGap);
    if (!rect) continue;
    const distance = edge === 'top' ? rect.y + rect.height - bounds.y
      : edge === 'bottom' ? bounds.y + bounds.height - rect.y
      : edge === 'left' ? rect.x + rect.width - bounds.x
      : bounds.x + bounds.width - rect.x;
    contentInsets[edge] = Math.max(contentInsets[edge], distance);
  }
  // A compact/rotated viewport must still leave a valid SDK camera region.
  for (const [first, second, size] of [
    ['top', 'bottom', bounds.height], ['left', 'right', bounds.width],
  ] as const) {
    const total = contentInsets[first] + contentInsets[second];
    const available = Math.max(0, size - Math.min(80, size));
    if (total > available) {
      contentInsets[first] *= available / total;
      contentInsets[second] *= available / total;
    }
  }
  return { rect: { ...bounds }, webTouchRects, contentInsets };
}
