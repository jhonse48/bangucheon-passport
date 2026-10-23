import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface NativeMapRect { x: number; y: number; width: number; height: number }
export interface NativeMapPosition { lat: number; lng: number }
export interface NativeMapInsets { top: number; right: number; bottom: number; left: number }
export interface NativeMapInsetRegion { rect: NativeMapRect; edge: keyof NativeMapInsets }
export interface NativeMapMarker extends NativeMapPosition {
  id: string;
  title: string;
  label: string;
  kind: 'viewing' | 'heritage' | 'facility' | 'location';
  completed: boolean;
  selected: boolean;
}
export interface NativeMapUpdate {
  rect?: NativeMapRect;
  center?: NativeMapPosition;
  zoom?: number;
  markers?: NativeMapMarker[];
  webTouchRects?: NativeMapRect[];
  interactionEnabled?: boolean;
  contentInsets?: NativeMapInsets;
}
export interface NativeNaverMapPlugin {
  create(options: Required<NativeMapUpdate> & { clientId: string; visible: boolean }): Promise<void>;
  update(options: NativeMapUpdate): Promise<void>;
  setVisible(options: { visible: boolean }): Promise<void>;
  destroy(): Promise<void>;
  addListener(event: 'markerTap', listener: (event: { id: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'authState', listener: (event: { authorized: boolean; code?: number; message?: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'mapReady', listener: () => void): Promise<PluginListenerHandle>;
}
export const NaverNativeMap = registerPlugin<NativeNaverMapPlugin>('NaverNativeMap');
export const isNativeNaverMap = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

// Keep native create/update/destroy ordered across React effect cleanup/remounts.
let nativeQueue: Promise<unknown> = Promise.resolve();
export function runNativeMapTask<T>(operation: () => Promise<T>): Promise<T> {
  const task = nativeQueue.then(operation, operation);
  nativeQueue = task.catch(() => undefined);
  return task;
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
