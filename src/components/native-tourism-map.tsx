'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { FormEvent } from 'react';
import type { PluginListenerHandle } from '@capacitor/core';
import { ExternalLink, LocateFixed, MapPin, RotateCcw, Settings2, X } from 'lucide-react';
import { getCurrentPosition } from '@/lib/native-device';
import { getMapAnchor, mapAnchorLabel, naverSearchUrl, REGION_MAP_REFERENCE, validMapPosition } from '@/lib/naver-map';
import { nativeMapLayout, NaverNativeMap, runNativeMapTask } from '@/lib/native-naver-map';
import type { NativeMapInsetRegion, NativeMapInsets, NativeMapMarker, NativeMapPosition, NativeMapRect } from '@/lib/native-naver-map';
import type { TourismMapProps } from './tourism-map';
import styles from './tourism-map.module.css';

const SESSION_KEY = 'bangucheon:naver-maps-client-id';
const ENV_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID?.trim() ?? '';
const EMPTY_IDS: string[] = [];
const subscribeKey = (onChange: () => void) => {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
};
function storedKey() { try { return sessionStorage.getItem(SESSION_KEY) || ENV_CLIENT_ID; } catch { return ENV_CLIENT_ID; } }
function rectOf(element: Element): NativeMapRect {
  const { x, y, width, height } = element.getBoundingClientRect();
  return { x, y, width, height };
}
function readLayout() {
  const insetRegions: NativeMapInsetRegion[] = [...document.querySelectorAll('[data-native-map-inset]')].flatMap((element) => {
    const edge = element.getAttribute('data-native-map-inset');
    return edge && ['top', 'right', 'bottom', 'left'].includes(edge)
      ? [{ rect: rectOf(element), edge: edge as keyof NativeMapInsets }] : [];
  });
  return nativeMapLayout({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
    [...document.querySelectorAll('[data-native-map-occluder]')].map(rectOf), insetRegions);
}
function authMessage(code?: number): string {
  if (code === 401) return '네이버 지도 인증에 실패했습니다. Maps Client ID와 iOS Bundle ID kr.bangucheon.passport 등록을 확인해 주세요.';
  if (code === 429) return '네이버 지도 이용 권한을 확인해 주세요. Dynamic Map 선택과 이용 한도를 확인해야 합니다.';
  if (code === 800) return '네이버 Maps Client ID를 입력해 주세요.';
  return '네이버 지도에 연결하지 못했습니다. 인터넷 연결과 Maps의 iOS 앱 등록을 확인해 주세요.';
}

export default function NativeTourismMap({ places, selectedPlaceId, completedPlaceIds = EMPTY_IDS, onSelect, className = '', nativeMapHidden = false }: TourismMapProps) {
  const key = useSyncExternalStore(subscribeKey, storedKey, () => '');
  const [created, setCreated] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [tilesReady, setTilesReady] = useState(false);
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftKey, setDraftKey] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [location, setLocation] = useState<NativeMapPosition | null>(null);
  const [locationMessage, setLocationMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDialogElement>(null);
  const gpsRequest = useRef(0);
  const onSelectRef = useRef(onSelect);
  const placesRef = useRef(places);
  const markersRef = useRef<NativeMapMarker[]>([]);
  const selected = places.find((place) => place.id === selectedPlaceId);
  const selectedAnchor = getMapAnchor(selected);
  const ready = created && authorized && !error;
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.nativeMapUnderlay;
    root.dataset.nativeMapUnderlay = 'true';
    return () => {
      if (previous === undefined) delete root.dataset.nativeMapUnderlay;
      else root.dataset.nativeMapUnderlay = previous;
    };
  }, []);
  const markers = useMemo<NativeMapMarker[]>(() => {
    const values = places.flatMap((place) => {
      const anchor = getMapAnchor(place);
      return anchor ? [{ id: place.id, ...anchor.position, title: place.name, label: place.shortName, kind: anchor.kind, completed: completedPlaceIds.includes(place.id), selected: place.id === selectedPlaceId }] : [];
    });
    return location ? [...values, { id: '__current_location', ...location, title: '현재 기기 추정 위치', label: '내 위치', kind: 'location', completed: false, selected: false }] : values;
  }, [places, selectedPlaceId, completedPlaceIds, location]);
  useEffect(() => { onSelectRef.current = onSelect; placesRef.current = places; markersRef.current = markers; }, [onSelect, places, markers]);

  useEffect(() => {
    if (!key) return;
    let disposed = false;
    const listeners: PluginListenerHandle[] = [];
    void runNativeMapTask(async () => {
      if (disposed) return;
      const handles = await Promise.all([
        NaverNativeMap.addListener('markerTap', ({ id }) => {
          if (disposed) return;
          const place = placesRef.current.find((item) => item.id === id);
          if (place) onSelectRef.current(place);
        }),
        NaverNativeMap.addListener('authState', ({ authorized: valid, code }) => {
          if (disposed) return;
          setAuthorized(valid);
          setError(valid ? '' : authMessage(code));
        }),
        NaverNativeMap.addListener('mapReady', () => { if (!disposed) setTilesReady(true); }),
      ]);
      listeners.push(...handles);
      if (disposed) return;
      const initialMarkers = markersRef.current;
      const placeMarkers = initialMarkers.filter((marker) => marker.kind !== 'location');
      const latitudes = placeMarkers.map((marker) => marker.lat);
      const longitudes = placeMarkers.map((marker) => marker.lng);
      const center = placeMarkers.length ? {
        lat: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
        lng: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
      } : REGION_MAP_REFERENCE.position;
      const layout = readLayout();
      await NaverNativeMap.create({ clientId: key, visible: false, interactionEnabled: false,
        rect: layout?.rect ?? { x: 0, y: 0, width: 1, height: 1 },
        webTouchRects: layout?.webTouchRects ?? [],
        contentInsets: layout?.contentInsets ?? { top: 0, right: 0, bottom: 0, left: 0 },
        center, zoom: 13.5, markers: initialMarkers });
      if (!disposed) setCreated(true);
    }).catch(() => { if (!disposed) setError('iPhone 지도를 준비하지 못했습니다. 앱을 다시 열어 주세요.'); });
    return () => {
      disposed = true;
      gpsRequest.current += 1;
      void runNativeMapTask(async () => {
        try { await NaverNativeMap.destroy(); }
        finally { await Promise.all(listeners.map((listener) => listener.remove())); }
      }).catch(() => undefined);
    };
  }, [key]);

  // The native map fills the viewport below a transparent WKWebView. HTML
  // controls retain their touches; sheets and focused inputs retain all touches.
  useLayoutEffect(() => {
    if (!created) return;
    let disposed = false;
    let frame = 0;
    let previous = '';
    const syncFrame = () => {
      if (disposed) return;
      const layout = readLayout();
      const editing = document.activeElement?.matches('input,textarea,[contenteditable="true"]');
      const visible = Boolean(layout && !error && document.visibilityState !== 'hidden');
      const interactionEnabled = Boolean(visible && authorized && !nativeMapHidden && !settingsOpen && !editing && !document.querySelector('dialog[open]'));
      const signature = JSON.stringify({ layout, visible, interactionEnabled });
      if (previous === signature) return;
      previous = signature;
      void runNativeMapTask(async () => {
        if (disposed) return;
        if (!visible) await NaverNativeMap.setVisible({ visible: false });
        if (layout) await NaverNativeMap.update({ ...layout, interactionEnabled });
        else await NaverNativeMap.update({ interactionEnabled: false });
        if (visible) await NaverNativeMap.setVisible({ visible: true });
      }).catch(() => { if (!disposed) setError('지도 화면을 조정하지 못했습니다. 앱을 다시 열어 주세요.'); });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(syncFrame); };
    const resize = new ResizeObserver(schedule);
    const observed = new Set<Element>();
    const observeControls = () => {
      const elements = new Set<Element>(document.querySelectorAll('[data-native-map-occluder],[data-native-map-inset]'));
      if (hostRef.current) elements.add(hostRef.current);
      observed.forEach((element) => { if (!elements.has(element)) { resize.unobserve(element); observed.delete(element); } });
      elements.forEach((element) => { if (!observed.has(element)) { resize.observe(element); observed.add(element); } });
    };
    observeControls();
    const mutation = new MutationObserver(() => { observeControls(); schedule(); });
    mutation.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['open', 'hidden', 'class', 'style', 'data-native-map-occluder', 'data-native-map-inset'] });
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    document.addEventListener('scroll', schedule, true);
    document.addEventListener('visibilitychange', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    syncFrame();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect(); mutation.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      document.removeEventListener('scroll', schedule, true);
      document.removeEventListener('visibilitychange', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
    };
  }, [created, authorized, nativeMapHidden, settingsOpen, error]);

  useEffect(() => {
    if (created) void runNativeMapTask(() => NaverNativeMap.update({ markers })).catch(() => setError('지도 장소를 갱신하지 못했습니다. 앱을 다시 열어 주세요.'));
  }, [created, markers]);
  useEffect(() => {
    const request = ++gpsRequest.current;
    if (!created) return;
    const anchor = getMapAnchor(places.find((place) => place.id === selectedPlaceId));
    void runNativeMapTask(async () => {
      if (request !== gpsRequest.current) return;
      setLocation(null); setLocationMessage(''); setLocating(false);
      if (anchor) await NaverNativeMap.update({ center: anchor.position });
    }).catch(() => undefined);
  }, [created, selectedPlaceId, places]);
  useEffect(() => {
    const dialog = settingsRef.current;
    if (settingsOpen) dialog?.showModal(); else dialog?.close();
  }, [settingsOpen]);

  async function locateMe() {
    if (!ready) return;
    const request = ++gpsRequest.current;
    setLocating(true); setLocationMessage('현재 위치를 확인하고 있어요…');
    try {
      const value = await getCurrentPosition();
      if (request !== gpsRequest.current) return;
      const position = { lat: value.latitude, lng: value.longitude };
      if (!validMapPosition(position)) throw new Error('기기의 위치를 확인하지 못했어요. 장소를 직접 골라 주세요.');
      setLocation(position);
      const accuracy = Number.isFinite(value.accuracy) && value.accuracy >= 0 ? ` · 오차 약 ${Math.round(value.accuracy)}m` : '';
      setLocationMessage(`기기 추정 위치${accuracy}. 방문 인증에 사용하지 않습니다.`);
      await runNativeMapTask(() => NaverNativeMap.update({ center: position }));
    } catch (failure) {
      if (request === gpsRequest.current) setLocationMessage(failure instanceof Error ? failure.message : '현재 위치를 확인하지 못했어요.');
    } finally { if (request === gpsRequest.current) setLocating(false); }
  }
  function returnToPlace() {
    gpsRequest.current += 1;
    setLocation(null); setLocationMessage(''); setLocating(false);
    void runNativeMapTask(() => NaverNativeMap.update({ center: selectedAnchor?.position ?? REGION_MAP_REFERENCE.position, zoom: 14 })).catch(() => undefined);
  }
  function applyKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draftKey.trim();
    if (!value || /\s/.test(value)) { setSettingsMessage('공백 없이 Maps Client ID를 입력해 주세요.'); return; }
    try { sessionStorage.setItem(SESSION_KEY, value); window.location.reload(); }
    catch { setSettingsMessage('현재 탭에 설정을 저장하지 못했습니다. 앱을 다시 열어 주세요.'); }
  }
  const notice = locationMessage || (selected && !selectedAnchor ? '선택 장소의 좌표는 확인 중입니다. 장소 안내와 네이버 검색을 이용해 주세요.' : selectedAnchor ? mapAnchorLabel(selectedAnchor) : '울산시 관광안내 대표 위치 · 지정 관람로를 이용해 주세요.');
  return <section className={`${styles.panel} ${styles.nativePanel} ${className}`} aria-label="반구천 네이버 지도">
    <div ref={hostRef} className={styles.canvas} aria-label="iPhone 네이버 지도 영역" />
    {!ready && <div className={styles.emptySurface}><div className={styles.connectionCard} role="status">
      <span className={styles.mapIcon}><MapPin size={24}/></span>
      <h2>{error ? '지도 연결을 확인해 주세요' : key ? '네이버 지도를 연결하고 있어요' : '네이버 지도 연결이 필요해요'}</h2>
      <p>{error || (key ? '반구천의 장소를 지도 위에 준비하고 있습니다.' : 'Maps Client ID를 설정하면 지도를 탐험할 수 있어요.')}</p>
      <div className={styles.connectionActions}><button type="button" onClick={() => setSettingsOpen(true)}><Settings2 size={15}/>지도 연결 설정</button><a href={naverSearchUrl(selected?.mapQuery ?? '울산 반구천 암각화')} target="_blank" rel="noopener noreferrer">네이버 지도에서 보기<ExternalLink size={13}/></a></div>
    </div></div>}
    {key && <>
      <div className={`${styles.controls} ${styles.nativeControls}`} data-native-map-occluder aria-label="지도 조작">
        <button type="button" aria-label="현재 위치" title="현재 위치" onClick={locateMe} disabled={!ready || locating}><LocateFixed size={19}/></button>
        <button type="button" aria-label="선택 장소로 돌아가기" title="선택 장소로 돌아가기" onClick={returnToPlace} disabled={!ready}><RotateCcw size={18}/></button>
        <button type="button" aria-label="네이버 지도 설정" onClick={() => setSettingsOpen(true)}><Settings2 size={18}/></button>
      </div>
      <div className={styles.mapNotice} data-native-map-occluder data-native-map-inset="bottom" role="status">{ready ? notice : error ? '연결 설정을 확인해 주세요.' : '네이버 지도 연결 중…'}{ready && !tilesReady && <span> 지도 화면을 준비하고 있어요.</span>}</div>
    </>}
    <dialog ref={settingsRef} className={styles.settings} aria-label="네이버 지도 연결 설정" onCancel={() => setSettingsOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
      <div className={styles.settingsHeader}><strong>네이버 지도 연결</strong><button type="button" aria-label="지도 설정 닫기" onClick={() => setSettingsOpen(false)}><X size={20}/></button></div>
      <form onSubmit={applyKey}>
        <p>네이버 클라우드 <strong>Maps → Application</strong>에서 Dynamic Map을 선택하고, iOS Bundle ID에 <strong>kr.bangucheon.passport</strong>를 등록해 주세요.</p>
        <label htmlFor="native-naver-client-id">Maps Client ID</label><input id="native-naver-client-id" type="password" autoComplete="off" spellCheck={false} value={draftKey} onChange={(event) => setDraftKey(event.target.value)} placeholder="Client ID 입력"/>
        <small>Client Secret은 입력하지 마세요. 입력한 ID는 현재 앱 화면에 적용됩니다.</small>
        <button type="submit" className={styles.connectButton}>지도 연결하기</button>
        <a href="https://navermaps.github.io/ios-map-sdk/guide-ko/1.html" target="_blank" rel="noopener noreferrer">공식 iOS 발급 안내<ExternalLink size={13}/></a>
        {settingsMessage && <p role="status">{settingsMessage}</p>}
        <button type="button" className={styles.clearKey} onClick={() => { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* Nothing stored. */ } window.location.reload(); }}>이 탭의 연결 설정 지우기</button>
      </form>
    </dialog>
  </section>;
}
