import type { Coordinates, Place } from "./types";

export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}
export interface KakaoBounds {
  extend(position: KakaoLatLng): void;
}
export interface KakaoMap {
  setCenter(position: KakaoLatLng): void;
  panTo(position: KakaoLatLng): void;
  setBounds(bounds: KakaoBounds): void;
  setLevel(level: number): void;
  getLevel(): number;
  relayout(): void;
}
export interface KakaoMarker {
  setMap(map: KakaoMap | null): void;
}
export interface KakaoPlaceResult {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  place_url: string;
  x: string;
  y: string;
}
export interface KakaoSDK {
  maps: {
    load(callback: () => void): void;
    LatLng: new (lat: number, lng: number) => KakaoLatLng;
    LatLngBounds: new () => KakaoBounds;
    Map: new (
      container: HTMLElement,
      options: { center: KakaoLatLng; level: number },
    ) => KakaoMap;
    Marker: new (options: {
      map: KakaoMap;
      position: KakaoLatLng;
      title: string;
      zIndex?: number;
    }) => KakaoMarker;
    CustomOverlay: new (options: {
      map: KakaoMap;
      position: KakaoLatLng;
      content: HTMLElement;
      xAnchor: number;
      yAnchor: number;
      zIndex: number;
    }) => KakaoMarker;
    event: {
      addListener(
        target: KakaoMarker,
        event: string,
        callback: () => void,
      ): void;
      removeListener(
        target: KakaoMarker,
        event: string,
        callback: () => void,
      ): void;
    };
    services: {
      Status: { OK: string; ZERO_RESULT: string; ERROR: string };
      Places: new () => {
        keywordSearch(
          query: string,
          callback: (results: KakaoPlaceResult[], status: string) => void,
          options?: { size: number },
        ): void;
      };
    };
  };
}

declare global {
  interface Window {
    kakao?: KakaoSDK;
  }
}

let pendingSDK: Promise<KakaoSDK> | null = null;
let currentKey: string | null = null;

/** JavaScript SDK keys are public browser credentials. Never supply a REST or Admin key. */
export function loadKakaoSDK(key: string): Promise<KakaoSDK> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("지도는 브라우저에서 열 수 있습니다."));
  if (currentKey && currentKey !== key)
    return Promise.reject(
      new Error("지도 연결 설정이 바뀌었습니다. 페이지를 새로고침해 주세요."),
    );
  if (pendingSDK) return pendingSDK;
  currentKey = key;
  pendingSDK = new Promise<KakaoSDK>((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const timer = window.setTimeout(
      () =>
        fail(
          "지도 연결 시간이 초과되었습니다. 네트워크와 허용 도메인 설정을 확인해 주세요.",
        ),
      12000,
    );
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      script.remove();
      pendingSDK = null;
      currentKey = null;
      reject(new Error(message));
    };
    const finish = () => {
      const sdk = window.kakao;
      if (!sdk?.maps?.load) {
        fail(
          "지도 SDK를 사용할 수 없습니다. JavaScript 키와 허용 도메인을 확인해 주세요.",
        );
        return;
      }
      sdk.maps.load(() => {
        if (settled) return;
        if (!sdk.maps.services?.Places) {
          fail(
            "지도 검색 서비스를 불러오지 못했습니다. 페이지를 새로고침해 주세요.",
          );
          return;
        }
        settled = true;
        window.clearTimeout(timer);
        resolve(sdk);
      });
    };
    script.id = "bangucheon-kakao-sdk";
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`;
    script.onload = finish;
    script.onerror = () =>
      fail(
        "지도를 불러오지 못했습니다. JavaScript 키, 등록 도메인, 네트워크 연결을 확인해 주세요.",
      );
    document.head.appendChild(script);
  });
  return pendingSDK;
}

export function isValidPosition(
  value: Coordinates | null,
): value is Coordinates {
  return Boolean(
    value &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng) &&
    value.lat >= -90 &&
    value.lat <= 90 &&
    value.lng >= -180 &&
    value.lng <= 180,
  );
}

/** A heritage coordinate alone never establishes a safe visitor destination. */
export function getVerifiedViewingPosition(
  place: Pick<Place, "viewingPosition" | "locationStatus"> | undefined,
): Coordinates | null {
  return place?.locationStatus === "공식 자료 확인" &&
    isValidPosition(place.viewingPosition)
    ? place.viewingPosition
    : null;
}

/** Service results are reference locations, never certified visitor access points. */
export function searchUlsanPlaces(
  sdk: KakaoSDK,
  query: string,
): Promise<KakaoPlaceResult[]> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(
      () =>
        reject(
          new Error(
            "장소 검색이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.",
          ),
        ),
      10000,
    );
    new sdk.maps.services.Places().keywordSearch(
      query,
      (results, status) => {
        globalThis.clearTimeout(timer);
        if (status === sdk.maps.services.Status.ZERO_RESULT) return resolve([]);
        if (status !== sdk.maps.services.Status.OK)
          return reject(
            new Error(
              "장소 검색에 연결하지 못했습니다. 카카오맵에서 직접 검색할 수 있습니다.",
            ),
          );
        resolve(
          results
            .filter((result) => {
              const address = `${result.address_name} ${result.road_address_name}`;
              return (
                /울산(?:광역시)?\s+울주군/.test(address) &&
                result.x.trim() !== "" &&
                result.y.trim() !== "" &&
                isValidPosition({
                  lat: Number(result.y),
                  lng: Number(result.x),
                })
              );
            })
            .slice(0, 5),
        );
      },
      { size: 10 },
    );
  });
}

export function kakaoSearchUrl(query: string): string {
  return `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;
}
