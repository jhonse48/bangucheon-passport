import type { Coordinates, Place, Source } from './types';

export interface MapAnchor {
  position: Coordinates;
  kind: 'viewing' | 'heritage' | 'facility';
  source: Source;
}

// Visible 교통안내 links on Ulsan City's tourism pages, read on 2026-10-22.
// Representative locations, NOT certified entrances or safe viewpoints.
export const OFFICIAL_MAP_ANCHORS: Readonly<Record<string, MapAnchor>> = {
  museum: {
    position: { lat: 35.6080854, lng: 129.170553 }, kind: 'facility',
    source: { title: '울산관광 · 울산암각화박물관 교통안내', url: 'https://www.ulsan.go.kr/tour/korean/unit/attrctn/view.ulsan?mId=001001000000000000&unqId=127', checkedAt: '2026-10-22' },
  },
  bangudae: {
    position: { lat: 35.60827, lng: 129.175561 }, kind: 'heritage',
    source: { title: '울산관광 · 울주 대곡리 반구대 암각화 교통안내', url: 'https://www.ulsan.go.kr/tour/korean/unit/attrctn/view.ulsan?mId=001001000000000000&unqId=100&searchGubun=attrctn', checkedAt: '2026-10-22' },
  },
  cheonjeonri: {
    position: { lat: 35.615443, lng: 129.172777 }, kind: 'heritage',
    source: { title: '울산관광 · 울주 천전리 명문과 암각화 교통안내', url: 'https://www.ulsan.go.kr/tour/korean/unit/attrctn/view.ulsan?mId=001001000000000000&unqId=104', checkedAt: '2026-10-22' },
  },
};
export const REGION_MAP_REFERENCE = OFFICIAL_MAP_ANCHORS.museum;

export function validMapPosition(value: Coordinates | null | undefined): value is Coordinates {
  return Boolean(value && Number.isFinite(value.lat) && Number.isFinite(value.lng)
    && value.lat >= -90 && value.lat <= 90 && value.lng >= -180 && value.lng <= 180);
}
export function getMapAnchor(place: Place | undefined): MapAnchor | null {
  if (!place) return null;
  if (place.locationStatus === '공식 자료 확인' && validMapPosition(place.viewingPosition) && place.sources.length) {
    return { position: place.viewingPosition, kind: 'viewing', source: place.sources[0] };
  }
  return OFFICIAL_MAP_ANCHORS[place.id] ?? null;
}
export function mapAnchorLabel(anchor: MapAnchor): string {
  return anchor.kind === 'viewing' ? '확인된 관람 위치'
    : anchor.kind === 'heritage' ? '유산 대표 위치 · 관람 지점 아님' : '시설 대표 위치 · 출입구 확인 필요';
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
  autoResize(): void;
  destroy(): void;
}
export interface NaverMarker { setMap(map: NaverMap | null): void }
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
