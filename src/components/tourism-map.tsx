'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { FormEvent } from 'react';
import { LocateFixed, MapPin, Plus, Minus, Settings2, X, ExternalLink, RotateCcw } from 'lucide-react';
import type { Place, TourRoute } from '@/lib/types';
import { getCurrentPosition } from '@/lib/native-device';
import { createNaverMapLifecycle, isNaverSDKUsable, getMapAnchor, getMapRoute, journeyMapBounds, journeyMapFocusKey, journeyMapSegments, mapOverlayPlacement, mapCameraIntent, mapMarkerDetails, mapPoints, mapRouteLine, mapRouteNotice, mapSceneKey, loadNaverSDK, mapAnchorLabel, naverSearchUrl, REGION_MAP_REFERENCE, subscribeNaverAuthFailure, validMapPosition } from '@/lib/naver-map';
import type { JourneyMapLayer, MapCameraState, NaverMap, NaverMarker, NaverSDK } from '@/lib/naver-map';
import styles from './tourism-map.module.css';
import NativeTourismMap from './native-tourism-map';
import { isNativeNaverMap, nativeMapLayout } from '@/lib/native-naver-map';

export interface TourismMapProps {
  places: Place[];
  selectedPlaceId: string | null;
  completedPlaceIds?: string[];
  onSelect: (place: Place) => void;
  onSelectGroup?: (places: Place[]) => void;
  className?: string;
  nativeMapHidden?: boolean;
  route?: TourRoute | null;
  journey?: JourneyMapLayer;
  onSelectJourneyPhoto?: (id: string) => void;
}
const SESSION_KEY = 'bangucheon:naver-maps-client-id';
const ENV_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID?.trim() ?? '';
const EMPTY_IDS: string[] = [];
const serverKey = () => '';
function storedClientId() { try { return sessionStorage.getItem(SESSION_KEY) || ENV_CLIENT_ID; } catch { return ENV_CLIENT_ID; } }
function subscribeKey(onChange: () => void) { window.addEventListener('storage', onChange); return () => window.removeEventListener('storage', onChange); }

function fitScene(map: NaverMap, sdk: NaverSDK, points: { lat: number; lng: number }[]) {
  const insetRegions = [...document.querySelectorAll('[data-native-map-inset]')].flatMap((element) => {
    const edge = element.getAttribute('data-native-map-inset');
    const rect = element.getBoundingClientRect();
    return edge && ['top', 'right', 'bottom', 'left'].includes(edge) ? [{
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      edge: edge as 'top' | 'right' | 'bottom' | 'left',
    }] : [];
  });
  const layout = nativeMapLayout({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }, [], insetRegions);
  if (layout) map.setOptions({ padding: layout.contentInsets });
  if (points.length > 1) map.fitBounds(points.map((point) => new sdk.maps.LatLng(point.lat, point.lng)), { top: 50, right: 50, bottom: 70, left: 50, maxZoom: 16 });
  else { const center = points[0] ?? REGION_MAP_REFERENCE.position; map.setCenter(new sdk.maps.LatLng(center.lat, center.lng)); map.setZoom(14); }
}

const subscribePlatform = () => () => undefined;
function useMapOverlayLayout(native: boolean) {
  useLayoutEffect(() => {
    const stage = document.querySelector<HTMLElement>('.map-stage');
    const root = stage?.closest('.explorer');
    const topBar = root?.querySelector<HTMLElement>('.map-top');
    if (!stage || !root || !topBar) return;
    const properties = ['--map-controls-top', '--map-empty-top', '--map-overlay-height', '--map-controls-columns'];
    const previous = properties.map((property) => stage.style.getPropertyValue(property));
    let frame = 0;
    let signature = '';
    const observed = new Set<Element>();
    const update = () => {
      const bounds = stage.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const bottomRegions = [...root.querySelectorAll('[data-native-map-inset="bottom"],.map-side-actions')];
      const footerTop = Math.min(bounds.bottom, ...bottomRegions.map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0).map((rect) => rect.top));
      const placement = mapOverlayPlacement(bounds, topBar.getBoundingClientRect().bottom, footerTop, native ? 3 : 5, window.innerWidth <= 600 ? 40 : 42);
      const next = JSON.stringify(placement);
      if (signature === next) return;
      signature = next;
      stage.style.setProperty('--map-controls-top', `${placement.top}px`);
      stage.style.setProperty('--map-empty-top', `${placement.top}px`);
      stage.style.setProperty('--map-overlay-height', `${placement.height}px`);
      stage.style.setProperty('--map-controls-columns', String(placement.columns));
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    const resize = new ResizeObserver(schedule);
    const observe = () => {
      const elements = new Set<Element>([stage, topBar, ...root.querySelectorAll('[data-native-map-inset="bottom"],.map-side-actions')]);
      observed.forEach((element) => { if (!elements.has(element)) { resize.unobserve(element); observed.delete(element); } });
      elements.forEach((element) => { if (!observed.has(element)) { resize.observe(element, { box: 'border-box' }); observed.add(element); } });
    };
    // Watch chrome and direct panel children, not the SDK's moving tile subtree.
    const mutation = new MutationObserver(() => { observe(); observePanel(); schedule(); });
    let panel: Element | null = null;
    const observePanel = () => {
      if (stage.firstElementChild && stage.firstElementChild !== panel) {
        panel = stage.firstElementChild; mutation.observe(panel, { childList: true });
      }
    };
    mutation.observe(stage, { childList: true });
    mutation.observe(topBar, { childList: true, subtree: true, characterData: true });
    observe(); observePanel(); update();
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); mutation.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      properties.forEach((property, index) => { if (previous[index]) stage.style.setProperty(property, previous[index]); else stage.style.removeProperty(property); });
    };
  }, [native]);
}
export default function TourismMap(props: TourismMapProps) {
  const native = useSyncExternalStore(subscribePlatform, isNativeNaverMap, () => false);
  useMapOverlayLayout(native);
  return native ? <NativeTourismMap {...props} /> : <WebTourismMap {...props} />;
}

function WebTourismMap({ places, selectedPlaceId, completedPlaceIds = EMPTY_IDS, onSelect, className = '', route = null, journey, onSelectJourneyPhoto }: TourismMapProps) {
  const storedKey = useSyncExternalStore(subscribeKey, storedClientId, serverKey);
  const [temporaryKey, setTemporaryKey] = useState<string | null>(null);
  const key = temporaryKey ?? storedKey;
  const [sdk, setSdk] = useState<NaverSDK | null>(null);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftKey, setDraftKey] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [locationMode, setLocationMode] = useState(false);
  const [locationContext, setLocationContext] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDialogElement>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const lifecycleRef = useRef<ReturnType<typeof createNaverMapLifecycle> | null>(null);
  const userMarkerRef = useRef<NaverMarker | null>(null);
  const locationRequestRef = useRef(0);
  const onSelectRef = useRef(onSelect);
  const onSelectJourneyPhotoRef = useRef(onSelectJourneyPhoto);
  const journeyRef = useRef(journey);
  const journeyFocusKey = journeyMapFocusKey(journey);
  const cameraStateRef = useRef<MapCameraState | null>(null);
  const routeModel = useMemo(() => getMapRoute(route), [route]);
  const scenePoints = useMemo(() => routeModel?.points.length ? routeModel.points : mapPoints(places), [routeModel, places]);
  const sceneKey = mapSceneKey(routeModel, scenePoints);
  const selected = places.find((place) => place.id === selectedPlaceId);
  const selectedAnchor = getMapAnchor(selected);
  const selectionContext = `${selectedPlaceId ?? ''}:${sceneKey}`;
  const activeLocationContext = locationContext === selectionContext;
  const ready = Boolean(sdk && mapInitialized && !error);

  useEffect(() => { onSelectRef.current = onSelect; onSelectJourneyPhotoRef.current = onSelectJourneyPhoto; journeyRef.current = journey; }, [onSelect, onSelectJourneyPhoto, journey]);
  useEffect(() => subscribeNaverAuthFailure((failure) => {
    setError(failure.message); setSdk(null); setMapInitialized(false);
  }), []);
  useEffect(() => {
    // The server renders the web shell before Capacitor's platform snapshot is
    // hydrated. Never start the JavaScript SDK on iOS during that transition.
    if (!key || isNativeNaverMap()) return;
    let cancelled = false;
    loadNaverSDK(key).then((loaded) => { if (!cancelled) setSdk(loaded); })
      .catch((failure: unknown) => { if (!cancelled) setError(failure instanceof Error ? failure.message : '네이버 지도 연결을 확인해 주세요.'); });
    return () => { cancelled = true; };
  }, [key, attempt]);

  useEffect(() => {
    if (!isNaverSDKUsable(sdk) || !canvasRef.current) return;
    const container = canvasRef.current;
    let cancelled = false;
    let map: NaverMap | null = null;
    let observer: ResizeObserver | null = null;
    let lifecycle: ReturnType<typeof createNaverMapLifecycle> | null = null;
    void Promise.resolve().then(() => {
      if (cancelled || !isNaverSDKUsable(sdk)) return;
      const center = REGION_MAP_REFERENCE.position;
      map = new sdk.maps.Map(container, {
      center: new sdk.maps.LatLng(center.lat, center.lng), zoom: 15, minZoom: 7, maxZoom: 20,
      scaleControl: false, logoControl: true, mapDataControl: true,
      logoControlOptions: { position: sdk.maps.Position.LEFT_CENTER },
      mapDataControlOptions: { position: sdk.maps.Position.LEFT_CENTER },
      padding: { top: 120, right: 54, bottom: 240, left: 24 },
      });
      mapRef.current = map;
      lifecycle = createNaverMapLifecycle(sdk, map);
      lifecycleRef.current = lifecycle;
      lifecycle.add((usable) => { if (usable) userMarkerRef.current?.setMap(null); userMarkerRef.current = null; });
      cameraStateRef.current = null;
      observer = new ResizeObserver(() => { if (!cancelled && isNaverSDKUsable(sdk)) map?.autoResize(); });
      observer.observe(container);
      setMapInitialized(true);
    }).catch(() => {
      if (!cancelled) setError('네이버 지도를 표시하지 못했습니다. 연결 설정과 등록한 서비스 URL을 확인해 주세요.');
    });
    return () => {
      cancelled = true;
      locationRequestRef.current += 1;
      observer?.disconnect();
      lifecycle?.dispose();
      if (lifecycleRef.current === lifecycle) lifecycleRef.current = null;
      if (mapRef.current === map) mapRef.current = null;
      container.replaceChildren();
    };
  }, [sdk]);

  useEffect(() => {
    if (!isNaverSDKUsable(sdk) || !mapRef.current || !lifecycleRef.current) return;
    const markers: { marker: NaverMarker; listener: object; node: HTMLElement; keydown: (event: KeyboardEvent) => void }[] = [];
    places.forEach((place) => {
      const anchor = getMapAnchor(place);
      if (!anchor) return;
      const detail = mapMarkerDetails(place.id, route);
      const node = document.createElement('button');
      node.type = 'button';
      node.className = `${styles.marker} ${place.id === selectedPlaceId ? styles.selectedMarker : ''} ${completedPlaceIds.includes(place.id) ? styles.completedMarker : ''}`;
      node.setAttribute('aria-label', `${detail.number ?? ""} ${place.name}, ${mapAnchorLabel(anchor)}, ${detail.qrLabel}, ${completedPlaceIds.includes(place.id) ? "미션 완료, " : ""}장소와 미션 보기`);
      const pin = document.createElement('span');
      pin.className = styles.pin;
      pin.textContent = detail.number === undefined ? '·' : String(detail.number).padStart(2, '0');
      if (detail.qrStatus !== 'none') {
        const qr = document.createElement('span');
        qr.className = `${styles.qrBadge} ${detail.qrStatus === 'pending' ? styles.qrPending : ''}`;
        qr.textContent = detail.qrStatus === 'ready' ? 'QR' : 'QR?';
        qr.title = detail.qrLabel; pin.appendChild(qr);
      }
      if (completedPlaceIds.includes(place.id)) {
        const check = document.createElement('span'); check.className = styles.completedBadge; check.textContent = '✓'; pin.appendChild(check);
      }
      const label = document.createElement('span');
      label.className = styles.pinLabel;
      label.textContent = place.shortName;
      const kind = document.createElement('small');
      kind.textContent = anchor.approximate ? '근사 위치' : anchor.kind === 'heritage' ? '유산 위치' : anchor.kind === 'viewing' ? '관람 위치' : '시설 위치';
      if (place.id === selectedPlaceId && detail.qrLabel) kind.textContent += ` · ${detail.qrLabel}`;
      label.appendChild(kind);
      node.append(pin, label);
      const marker = new sdk.maps.Marker({
        map: mapRef.current!, position: new sdk.maps.LatLng(anchor.position.lat, anchor.position.lng),
        title: `${place.name} · ${mapAnchorLabel(anchor)}`, zIndex: place.id === selectedPlaceId ? 20 : 5,
        icon: { content: node, anchor: new sdk.maps.Point(80, 19) },
      });
      const listener = sdk.maps.Event.addListener(marker, 'click', () => onSelectRef.current(place));
      const keydown = (event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectRef.current(place); } };
      node.addEventListener('keydown', keydown);
      markers.push({ marker, listener, node, keydown });
    });
    return lifecycleRef.current.add((usable) => markers.forEach(({ marker, listener, node, keydown }) => {
      node.removeEventListener('keydown', keydown);
      if (usable) { sdk.maps.Event.removeListener(listener); marker.setMap(null); }
    }));
  }, [sdk, mapInitialized, places, selectedPlaceId, completedPlaceIds, route]);

  useEffect(() => {
    if (!isNaverSDKUsable(sdk) || !mapRef.current || !lifecycleRef.current) return;
    const line = mapRouteLine(routeModel);
    if (!line) return;
    const polyline = new sdk.maps.Polyline({ map: mapRef.current,
      path: line.points.map((point) => new sdk.maps.LatLng(point.lat, point.lng)),
      strokeWeight: 5, strokeColor: '#397c6b', strokeOpacity: 0.9,
      strokeStyle: 'dash', strokeLineCap: 'round', clickable: false, zIndex: 1 });
    return lifecycleRef.current.add((usable) => { if (usable) polyline.setMap(null); });
  }, [sdk, mapInitialized, routeModel]);

  useEffect(() => {
    const requestId = ++locationRequestRef.current;
    if (!isNaverSDKUsable(sdk) || !mapRef.current) return;
    const state = { sceneKey, selectedId: selectedPlaceId };
    const intent = mapCameraIntent(cameraStateRef.current, state);
    cameraStateRef.current = state;
    userMarkerRef.current?.setMap(null);
    if (intent === 'fit') fitScene(mapRef.current, sdk, scenePoints);
    else if (intent === 'select') {
      const anchor = getMapAnchor(places.find((place) => place.id === selectedPlaceId));
      if (anchor) mapRef.current.panTo(new sdk.maps.LatLng(anchor.position.lat, anchor.position.lng));
    }
    const frame = requestAnimationFrame(() => {
      if (requestId !== locationRequestRef.current) return;
      setLocating(false); setLocationMode(false); setLocationMessage(''); setLocationContext(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [sdk, mapInitialized, places, selectedPlaceId, sceneKey, scenePoints]);

  useEffect(() => {
    if (!isNaverSDKUsable(sdk) || !mapRef.current || !lifecycleRef.current || !journey) return;
    const map = mapRef.current;
    const lines = journeyMapSegments(journey.points).map((segment) => new sdk.maps.Polyline({ map,
      path: segment.map((point) => new sdk.maps.LatLng(point.lat, point.lng)),
      strokeWeight: 5, strokeColor: '#e5694f', strokeOpacity: 0.95,
      strokeStyle: 'solid', strokeLineCap: 'round', clickable: false, zIndex: 3 }));
    const photos = journey.photos.filter(validMapPosition).map((photo, index) => {
      const node = document.createElement('button');
      node.type = 'button'; node.className = styles.journeyPhoto;
      node.setAttribute('aria-label', `여행 사진 ${index + 1} 보기`);
      if (photo.thumbnailUrl.startsWith('data:image/jpeg;base64,')) {
        const thumbnail = document.createElement('img');
        thumbnail.src = photo.thumbnailUrl; thumbnail.alt = ''; node.appendChild(thumbnail);
      } else node.textContent = '사진';
      const marker = new sdk.maps.Marker({ map, position: new sdk.maps.LatLng(photo.lat, photo.lng),
        title: `여행 사진 ${index + 1}`, zIndex: 35, icon: { content: node, anchor: new sdk.maps.Point(26, 52) } });
      const open = () => onSelectJourneyPhotoRef.current?.(photo.id);
      const listener = sdk.maps.Event.addListener(marker, 'click', open);
      const keydown = (event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } };
      node.addEventListener('keydown', keydown);
      return { marker, listener, node, keydown };
    });
    return lifecycleRef.current.add((usable) => {
      if (usable) lines.forEach((line) => line.setMap(null));
      photos.forEach(({ marker, listener, node, keydown }) => {
        node.removeEventListener('keydown', keydown);
        if (usable) { sdk.maps.Event.removeListener(listener); marker.setMap(null); }
      });
    });
  }, [sdk, mapInitialized, journey]);

  // A new GPS sample updates overlays only. Review focus is an explicit transition.
  useEffect(() => {
    if (!journeyFocusKey || !isNaverSDKUsable(sdk) || !mapRef.current || !journeyRef.current) return;
    const points = journeyMapBounds(journeyRef.current);
    if (points.length) fitScene(mapRef.current, sdk, points);
  }, [sdk, mapInitialized, journeyFocusKey]);

  useEffect(() => {
    const dialog = settingsRef.current;
    if (!dialog) return;
    if (settingsOpen) dialog.showModal(); else dialog.close();
  }, [settingsOpen]);

  async function locateMe() {
    if (!isNaverSDKUsable(sdk) || !mapRef.current) return;
    const requestId = ++locationRequestRef.current;
    setLocationContext(selectionContext);
    setLocating(true);
    setLocationMessage('현재 위치를 확인하고 있어요…');
    try {
      const position = await getCurrentPosition();
      if (requestId !== locationRequestRef.current || !isNaverSDKUsable(sdk) || !mapRef.current) return;
      if (!validMapPosition({ lat: position.latitude, lng: position.longitude })) throw new Error('기기에서 유효한 위치를 받지 못했어요. 장소를 직접 선택해 주세요.');
      const current = new sdk.maps.LatLng(position.latitude, position.longitude);
      const node = document.createElement('div');
      node.className = styles.userLocation;
      node.textContent = '내 위치';
      userMarkerRef.current?.setMap(null);
      userMarkerRef.current = new sdk.maps.Marker({ map: mapRef.current, position: current, title: '현재 기기 추정 위치', zIndex: 30, icon: { content: node, anchor: new sdk.maps.Point(42, 8) }, clickable: false });
      mapRef.current.panTo(current);
      setLocationMode(true);
      setLocationMessage(`기기 추정 위치${Number.isFinite(position.accuracy) ? ` · 오차 약 ${Math.round(position.accuracy)}m` : ''}. 방문 인증에 사용하지 않습니다.`);
    } catch (failure: unknown) {
      if (requestId === locationRequestRef.current) setLocationMessage(failure instanceof Error ? failure.message : '현재 위치를 확인하지 못했어요. 장소를 직접 선택해 주세요.');
    } finally { if (requestId === locationRequestRef.current) setLocating(false); }
  }
  function returnToPlace() {
    if (!isNaverSDKUsable(sdk) || !mapRef.current) return;
    locationRequestRef.current += 1;
    setLocating(false);
    setLocationMode(false);
    setLocationMessage('');
    userMarkerRef.current?.setMap(null);
    if (selectedAnchor) mapRef.current.panTo(new sdk.maps.LatLng(selectedAnchor.position.lat, selectedAnchor.position.lng));
    else fitScene(mapRef.current, sdk, scenePoints);
  }
  function applyClientId(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = draftKey.trim();
    if (!next || /\s/.test(next)) { setSettingsMessage('공백 없이 Maps의 Client ID를 입력해 주세요.'); return; }
    let saved = true;
    try { sessionStorage.setItem(SESSION_KEY, next); } catch { saved = false; }
    if (key) {
      if (saved) window.location.reload();
      else setSettingsMessage('이 탭의 저장이 제한되어 키를 변경하지 못했습니다. 브라우저 저장 설정을 확인해 주세요.');
      return;
    }
    setError('');
    setTemporaryKey(next);
    setAttempt((value) => value + 1);
    setSettingsMessage(saved ? '이 탭에 적용했습니다. 지도 연결을 확인하고 있어요.' : '저장이 제한되어 현재 화면에만 적용했습니다.');
    setSettingsOpen(false);
  }

  return <section className={`${styles.panel} ${className}`} aria-label="반구천 네이버 지도">
    <div ref={canvasRef} className={styles.canvas} aria-label="네이버 지도 영역" aria-hidden={!ready} />
    {!ready && <div className={styles.emptySurface}><div className={styles.connectionCard} role="status">
      <span className={styles.mapIcon}><MapPin size={24} strokeWidth={1.6}/></span>
      <h2>{error ? '지도 연결을 확인해 주세요' : key ? '네이버 지도를 연결하고 있어요' : '네이버 지도 연결이 필요해요'}</h2>
      <p>{error || (key ? '반구천의 장소를 지도 위에 준비하고 있습니다.' : 'Client ID를 설정하면 실제 지도에서 장소와 미션을 바로 만날 수 있어요.')}</p>
      <div className={styles.connectionActions}><button type="button" onClick={() => setSettingsOpen(true)}><Settings2 size={15}/>지도 연결 설정</button><a href={naverSearchUrl(selected?.mapQuery ?? '울산 반구천 암각화')} target="_blank" rel="noopener noreferrer">네이버 지도에서 보기<ExternalLink size={13}/></a></div>
    </div></div>}
    {ready && <>
      <div className={styles.controls} aria-label="지도 조작">
        <button type="button" aria-label="지도 확대" onClick={() => mapRef.current?.setZoom(Math.min(20, mapRef.current.getZoom() + 1))}><Plus size={19}/></button>
        <button type="button" aria-label="지도 축소" onClick={() => mapRef.current?.setZoom(Math.max(7, mapRef.current.getZoom() - 1))}><Minus size={19}/></button>
        <button type="button" aria-label="현재 위치" title="현재 위치" onClick={locateMe} disabled={locating && activeLocationContext}><LocateFixed size={19}/></button>
        <button type="button" aria-label="선택 장소로 돌아가기" title="선택 장소로 돌아가기" onClick={returnToPlace}><RotateCcw size={18}/></button>
        <button type="button" aria-label="네이버 지도 설정" onClick={() => setSettingsOpen(true)}><Settings2 size={18}/></button>
      </div>
      <div className={styles.mapNotice} data-native-map-inset="bottom" role="status">{(activeLocationContext && locationMessage) || (selected && !selectedAnchor ? '선택 장소의 좌표는 확인 중입니다. 장소 안내와 네이버 검색을 이용해 주세요.' : selectedAnchor ? mapAnchorLabel(selectedAnchor) : '장소 번호 · QR?는 안내판 위치 확인 중 · 지정 관람로 이용')}{routeModel && <span className={styles.routeNotice}>{mapRouteNotice(routeModel)}</span>}{locationMode && activeLocationContext && <button type="button" onClick={returnToPlace}>장소로 복귀</button>}</div>
    </>}
    <dialog ref={settingsRef} className={styles.settings} aria-label="네이버 지도 연결 설정" onCancel={() => setSettingsOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
      <div className={styles.settingsHeader}><strong>네이버 지도 연결</strong><button type="button" aria-label="지도 설정 닫기" onClick={() => setSettingsOpen(false)}><X size={20}/></button></div>
      <form onSubmit={applyClientId}>
        <p>네이버 클라우드의 <strong>Maps → Application</strong>에서 발급한 Client ID를 입력해 주세요. Dynamic Map을 선택하고 현재 서비스 URL을 등록해야 합니다.</p>
        <label htmlFor="naver-map-client-id">Maps Client ID</label><input id="naver-map-client-id" type="password" autoComplete="off" spellCheck={false} value={draftKey} onChange={(event) => setDraftKey(event.target.value)} placeholder={key ? '새 Client ID 입력' : 'Client ID 입력'}/>
        <small>Client Secret은 입력하지 마세요. 입력한 ID는 이 탭에서만 저장합니다.</small>
        <button type="submit" className={styles.connectButton}>지도 연결하기</button>
        <a href="https://navermaps.github.io/maps.js.ncp/docs/tutorial-1-Getting-Client-ID.html" target="_blank" rel="noopener noreferrer">공식 발급 안내<ExternalLink size={13}/></a>
        {settingsMessage && <p role="status">{settingsMessage}</p>}
        <button type="button" className={styles.clearKey} onClick={() => { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* No stored key. */ } window.location.reload(); }}>이 탭의 연결 설정 지우기</button>
      </form>
    </dialog>
  </section>;
}
