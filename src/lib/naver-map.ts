import type { Coordinates, Place, Source, TourRoute } from './types';
import { EXPLORATION_POINTS, getExplorationPoint } from '../data/exploration';
import type { ExplorationPoint } from '../data/exploration';
import { JOURNEY_MAX_GAP_MS } from './journey';

export interface MapAnchor {
  position: Coordinates;
  kind: 'viewing' | 'heritage' | 'facility' | 'approximate';
  source: Source;
  approximate?: boolean;
  accuracy?: ExplorationPoint['accuracy'];
  coordinateNote?: string;
}

// This official museum reference is a fallback camera center, not an entrance.
export const REGION_MAP_REFERENCE: MapAnchor = {
  position: { lat: 35.6080854, lng: 129.170553 }, kind: 'facility',
  source: { title: '울산관광 · 울산암각화박물관 교통안내', url: 'https://www.ulsan.go.kr/tour/korean/unit/attrctn/view.ulsan?mId=001001000000000000&unqId=127', checkedAt: '2026-10-22' },
};

export function validMapPosition(value: Coordinates | null | undefined): value is Coordinates {
  return Boolean(value && Number.isFinite(value.lat) && Number.isFinite(value.lng)
    && value.lat >= -90 && value.lat <= 90 && value.lng >= -180 && value.lng <= 180);
}
export function explorationMapAnchor(point: ExplorationPoint | null | undefined): MapAnchor | null {
  if (!point || point.accuracy === 'unverified' || !point.source.url || !validMapPosition(point.position)) return null;
  return { position: point.position, kind: point.kind, source: point.source,
    accuracy: point.accuracy, approximate: point.accuracy === 'approximate' || point.kind === 'approximate', coordinateNote: point.coordinateNote };
}
export function getMapAnchor(place: Place | undefined): MapAnchor | null {
  if (!place) return null;
  if (place.locationStatus === '공식 자료 확인' && validMapPosition(place.viewingPosition) && place.sources.length) {
    return { position: place.viewingPosition, kind: 'viewing', source: place.sources[0] };
  }
  return explorationMapAnchor(getExplorationPoint(place.id));
}
export function mapAnchorLabel(anchor: MapAnchor): string {
  if (anchor.approximate || anchor.kind === 'approximate') return '자료 기준 근사 위치 · 현장 위치 확인 필요';
  return anchor.kind === 'viewing' ? (anchor.accuracy === 'public-map' ? '조망 공간 대표 위치 · 현장 확인 필요' : '확인된 관람 위치')
    : anchor.kind === 'heritage' ? '유산 대표 위치 · 관람 지점 아님' : '시설 대표 위치 · 출입구 확인 필요';
}
export function mapMarkerDetails(id: string, route?: TourRoute | null) {
  const point = getExplorationPoint(id);
  const qrStatus = point?.qr.status === 'photo-confirmed' ? 'ready' : !point || point.qr.status === 'not-listed' ? 'none' : 'pending';
  const routeIndex = route?.placeIds.indexOf(id) ?? -1;
  return { number: routeIndex >= 0 ? routeIndex + 1 : point?.number, qrStatus,
    qrLabel: qrStatus === 'ready' ? 'QR 안내판 사진 확인' : qrStatus === 'pending' ? 'QR 위치 확인 중' : '' } as const;
}
export function mapPoints(places: readonly Place[]): Coordinates[] {
  return places.flatMap((place) => { const anchor = getMapAnchor(place); return anchor ? [anchor.position] : []; });
}
export interface MapRoute {
  id: string;
  points: Coordinates[];
  kind: 'visit-order';
  missingCount: number;
  approximate: boolean;
}
/** Visit-order connectors never claim to be a surveyed or walkable route. */
export function getMapRoute(route: TourRoute | null | undefined, points: Readonly<Record<string, ExplorationPoint>> = EXPLORATION_POINTS): MapRoute | null {
  if (!route) return null;
  const anchors = route.placeIds.map((id) => explorationMapAnchor(points[id]));
  return { id: route.id, points: anchors.flatMap((anchor) => anchor ? [anchor.position] : []), kind: 'visit-order',
    missingCount: anchors.filter((anchor) => !anchor).length, approximate: anchors.some((anchor) => anchor?.approximate) };
}
export function mapRouteLine(route: MapRoute | null) {
  return route && route.missingCount === 0 && route.points.length > 1 ? { id: route.id, points: route.points, kind: route.kind } : null;
}
export function mapRouteNotice(route: MapRoute | null): string {
  if (!route) return '';
  return route.missingCount ? `코스 ${route.missingCount}곳 위치 확인 중 · 연결선 준비 중`
    : `점선은 방문 순서 연결선 · 실제 보행 경로 아님${route.approximate ? ' · 근사 위치 포함' : ''}`;
}
export interface MapCameraState { sceneKey: string; selectedId: string | null }
export interface JourneyMapPoint extends Coordinates { timestamp: number; accuracy: number; segment: number }
export interface JourneyMapPhoto extends Coordinates { id: string; thumbnailUrl: string }
export interface JourneyMapLayer { id: string; points: JourneyMapPoint[]; photos: JourneyMapPhoto[]; focus: boolean }
export function validJourneyMapPoint(point: JourneyMapPoint): boolean {
  return validMapPosition(point) && Number.isFinite(point.timestamp) && point.timestamp >= 0
    && Number.isFinite(point.accuracy) && point.accuracy >= 0 && Number.isInteger(point.segment) && point.segment >= 0;
}
/** Pauses, malformed samples and nonconsecutive segments never become connecting lines. */
export function journeyMapSegments(points: readonly JourneyMapPoint[]): JourneyMapPoint[][] {
  const segments: JourneyMapPoint[][] = [];
  let current: JourneyMapPoint[] | null = null;
  for (const point of points) {
    if (!validJourneyMapPoint(point)) { current = null; continue; }
    const previous = current?.at(-1);
    if (!previous || previous.segment !== point.segment || point.timestamp <= previous.timestamp
      || point.timestamp - previous.timestamp > JOURNEY_MAX_GAP_MS) { current = []; segments.push(current); }
    current!.push(point);
  }
  return segments.filter((segment) => segment.length > 1);
}
export function journeyMapBounds(journey: JourneyMapLayer): Coordinates[] {
  return [...journey.points.filter(validJourneyMapPoint), ...journey.photos.filter(validMapPosition)];
}
export function journeyMapFocusKey(journey?: JourneyMapLayer | null): string | null {
  return journey?.focus ? journey.id : null;
}
/** CSS positions are relative to the map stage, while measured chrome uses viewport coordinates. */
export function mapOverlayPlacement(stage: { y: number; height: number }, headerBottom: number, footerTop: number, buttonCount: number, buttonSize = 42) {
  const top = Math.min(Math.max(8, headerBottom - stage.y + 8), Math.max(8, stage.height - buttonSize - 8));
  const height = Math.max(buttonSize, Math.min(stage.height - top - 8, footerTop - stage.y - top - 8));
  const rows = Math.max(1, Math.floor((height + 7) / (buttonSize + 7)));
  return { top, height, columns: Math.max(1, Math.ceil(buttonCount / rows)) };
}
/** Initial/changed courses fit the overview; a later marker selection may focus it. */
export function mapCameraIntent(previous: MapCameraState | null, current: MapCameraState): 'fit' | 'select' | 'none' {
  if (!previous || previous.sceneKey !== current.sceneKey) return 'fit';
  return previous.selectedId !== current.selectedId ? 'select' : 'none';
}
export function mapSceneKey(route: MapRoute | null, points: Coordinates[]): string {
  return JSON.stringify([route?.id ?? null, points]);
}
export function naverSearchUrl(query: string): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(query.trim() || '울산 반구천')}`;
}
export function naverSdkUrl(clientId: string): string {
  const url = new URL('https://oapi.map.naver.com/openapi/v3/maps.js');
  url.searchParams.set('ncpKeyId', clientId);
  url.searchParams.set('callback', '__bangucheonNaverReady');
  return url.toString();
}

export interface NaverLatLng { lat(): number; lng(): number }
export interface NaverPoint { x: number; y: number }
export interface NaverMap {
  panTo(position: NaverLatLng): void;
  setCenter(position: NaverLatLng): void;
  setZoom(zoom: number): void;
  getZoom(): number;
  fitBounds(points: NaverLatLng[], options?: { top: number; right: number; bottom: number; left: number; maxZoom: number }): void;
  setOptions(options: { padding: { top: number; right: number; bottom: number; left: number } }): void;
  autoResize(): void;
  destroy(): void;
}
export interface NaverMarker { setMap(map: NaverMap | null): void }
export interface NaverPolyline { setMap(map: NaverMap | null): void }
/** Authentication may revoke the live namespace after the script has loaded. */
export function isNaverSDKUsable(sdk: NaverSDK | null | undefined): sdk is NaverSDK {
  return typeof sdk?.maps?.Map === 'function';
}

/** Overlay effects may clean up after the map effect. Release them before destroy,
 * exactly once, and avoid SDK calls after asynchronous authentication revocation. */
export function createNaverMapLifecycle(sdk: NaverSDK, map: Pick<NaverMap, 'destroy'>) {
  const cleanups = new Set<(usable: boolean) => void>();
  let disposed = false;
  const release = (cleanup: (usable: boolean) => void) => {
    if (!cleanups.delete(cleanup)) return;
    try { cleanup(isNaverSDKUsable(sdk)); } catch { /* The SDK may already have disposed its internals. */ }
  };
  return {
    add(cleanup: (usable: boolean) => void) {
      if (disposed) { cleanup(false); return () => undefined; }
      cleanups.add(cleanup);
      return () => release(cleanup);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      [...cleanups].reverse().forEach(release);
      if (isNaverSDKUsable(sdk)) {
        try { map.destroy(); } catch { /* A failed map must not take down the rest of the app. */ }
      }
    },
  };
}
export interface NaverSDK {
  maps: {
    LatLng: new (lat: number, lng: number) => NaverLatLng;
    Point: new (x: number, y: number) => NaverPoint;
    Map: new (container: HTMLElement, options: {
      center: NaverLatLng; zoom: number; minZoom: number; maxZoom: number;
      scaleControl: boolean; logoControl: boolean; mapDataControl: boolean;
      logoControlOptions: { position: number }; mapDataControlOptions: { position: number };
      padding: { top: number; right: number; bottom: number; left: number };
    }) => NaverMap;
    Marker: new (options: {
      map: NaverMap; position: NaverLatLng; title: string; zIndex: number;
      icon: { content: HTMLElement; anchor: NaverPoint }; clickable?: boolean;
    }) => NaverMarker;
    Polyline: new (options: {
      map: NaverMap; path: NaverLatLng[]; strokeWeight: number; strokeColor: string;
      strokeOpacity: number; strokeStyle: 'solid' | 'dash'; strokeLineCap: 'round';
      clickable: false; zIndex: number;
    }) => NaverPolyline;
    Event: { addListener(target: NaverMarker, name: string, callback: () => void): object; removeListener(listener: object): void };
    Position: { LEFT_CENTER: number };
  };
}
declare global {
  interface Window {
    naver?: NaverSDK;
    navermap_authFailure?: () => void;
    __bangucheonNaverReady?: () => void;
  }
}

let pendingSDK: Promise<NaverSDK> | null = null;
let loadedKey: string | null = null;
const authFailureListeners = new Set<(error: Error) => void>();
export function subscribeNaverAuthFailure(callback: (error: Error) => void): () => void {
  authFailureListeners.add(callback);
  return () => { authFailureListeners.delete(callback); };
}
/** Uses the current Maps service's public Client ID, never Client Secret. */
export function loadNaverSDK(clientId: string): Promise<NaverSDK> {
  if (typeof window === 'undefined') return Promise.reject(new Error('네이버 지도는 브라우저 또는 앱 화면에서 열 수 있습니다.'));
  if (loadedKey && loadedKey !== clientId) return Promise.reject(new Error('지도 키가 바뀌었습니다. 새로고침해 다시 연결해 주세요.'));
  if (pendingSDK) return pendingSDK;
  loadedKey = clientId;
  pendingSDK = new Promise<NaverSDK>((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    const timer = window.setTimeout(() => fail(new Error('네이버 지도 연결 시간이 초과되었습니다. 네트워크와 등록한 서비스 URL을 확인해 주세요.')), 12000);
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      script.remove();
      pendingSDK = null;
      loadedKey = null;
      reject(error);
    };
    window.navermap_authFailure = () => {
      const error = new Error('네이버 지도 인증에 실패했습니다. 신규 Maps의 Client ID, Dynamic Map 선택, 서비스 URL 등록을 확인해 주세요.');
      authFailureListeners.forEach((listener) => listener(error));
      fail(error);
    };
    const complete = () => {
      if (settled) return;
      if (typeof window.naver?.maps?.Map !== 'function') { fail(new Error('네이버 지도 SDK를 준비하지 못했습니다. 연결 설정을 확인해 주세요.')); return; }
      settled = true;
      window.clearTimeout(timer);
      resolve(window.naver);
    };
    // SDK 3.10.5 calls its callback before assigning window.naver.maps when
    // inserted asynchronously. Wait until that script finishes exporting it.
    window.__bangucheonNaverReady = () => { queueMicrotask(complete); };
    script.id = 'bangucheon-naver-sdk';
    script.async = true;
    script.src = naverSdkUrl(clientId);
    script.onload = complete;
    script.onerror = () => fail(new Error('네이버 지도 파일을 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.'));
    document.head.appendChild(script);
  });
  return pendingSDK;
}
