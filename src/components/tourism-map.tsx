'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { FormEvent } from 'react';
import { LocateFixed, MapPin, Plus, Minus, Settings2, X, ExternalLink, RotateCcw } from 'lucide-react';
import type { Place } from '@/lib/types';
import { getCurrentPosition } from '@/lib/native-device';
import { getMapAnchor, loadNaverSDK, mapAnchorLabel, naverSearchUrl, REGION_MAP_REFERENCE, subscribeNaverAuthFailure, validMapPosition } from '@/lib/naver-map';
import type { NaverMap, NaverMarker, NaverSDK } from '@/lib/naver-map';
import styles from './tourism-map.module.css';
import NativeTourismMap from './native-tourism-map';
import { isNativeNaverMap } from '@/lib/native-naver-map';

export interface TourismMapProps {
  places: Place[];
  selectedPlaceId: string | null;
  completedPlaceIds?: string[];
  onSelect: (place: Place) => void;
  className?: string;
  nativeMapHidden?: boolean;
}
const SESSION_KEY = 'bangucheon:naver-maps-client-id';
const ENV_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID?.trim() ?? '';
const EMPTY_IDS: string[] = [];
const serverKey = () => '';
function storedClientId() { try { return sessionStorage.getItem(SESSION_KEY) || ENV_CLIENT_ID; } catch { return ENV_CLIENT_ID; } }
function subscribeKey(onChange: () => void) { window.addEventListener('storage', onChange); return () => window.removeEventListener('storage', onChange); }

const subscribePlatform = () => () => undefined;
export default function TourismMap(props: TourismMapProps) {
  const native = useSyncExternalStore(subscribePlatform, isNativeNaverMap, () => false);
  return native ? <NativeTourismMap {...props} /> : <WebTourismMap {...props} />;
}

function WebTourismMap({ places, selectedPlaceId, completedPlaceIds = EMPTY_IDS, onSelect, className = '' }: TourismMapProps) {
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
  const userMarkerRef = useRef<NaverMarker | null>(null);
  const locationRequestRef = useRef(0);
  const onSelectRef = useRef(onSelect);
  const selected = places.find((place) => place.id === selectedPlaceId);
  const selectedAnchor = getMapAnchor(selected);
  const selectionContext = `${selectedPlaceId ?? ''}:${places.map((place) => place.id).join(',')}`;
  const activeLocationContext = locationContext === selectionContext;
  const ready = Boolean(sdk && mapInitialized && !error);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => subscribeNaverAuthFailure((failure) => setError(failure.message)), []);
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
    if (!sdk || !canvasRef.current) return;
    const container = canvasRef.current;
    let cancelled = false;
    let map: NaverMap | null = null;
    let observer: ResizeObserver | null = null;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const center = REGION_MAP_REFERENCE.position;
      map = new sdk.maps.Map(container, {
      center: new sdk.maps.LatLng(center.lat, center.lng), zoom: 15, minZoom: 7, maxZoom: 20,
      scaleControl: false, logoControl: true, mapDataControl: true,
      logoControlOptions: { position: sdk.maps.Position.LEFT_CENTER },
      mapDataControlOptions: { position: sdk.maps.Position.LEFT_CENTER },
      padding: { top: 120, right: 54, bottom: 240, left: 24 },
      });
      mapRef.current = map;
      observer = new ResizeObserver(() => map?.autoResize());
      observer.observe(container);
      setMapInitialized(true);
    }).catch(() => {
      if (!cancelled) setError('네이버 지도를 표시하지 못했습니다. 연결 설정과 등록한 서비스 URL을 확인해 주세요.');
    });
    return () => {
      cancelled = true;
      locationRequestRef.current += 1;
      observer?.disconnect();
      userMarkerRef.current?.setMap(null);
      map?.destroy();
      mapRef.current = null;
    };
  }, [sdk]);

  useEffect(() => {
    if (!sdk || !mapRef.current) return;
    const markers: { marker: NaverMarker; listener: object; node: HTMLElement; keydown: (event: KeyboardEvent) => void }[] = [];
    places.forEach((place, index) => {
      const anchor = getMapAnchor(place);
      if (!anchor) return;
      const node = document.createElement('button');
      node.type = 'button';
      node.className = `${styles.marker} ${place.id === selectedPlaceId ? styles.selectedMarker : ''} ${completedPlaceIds.includes(place.id) ? styles.completedMarker : ''}`;
      node.setAttribute('aria-label', `${place.name}, ${mapAnchorLabel(anchor)}, 장소와 미션 보기`);
      const pin = document.createElement('span');
      pin.className = styles.pin;
      pin.textContent = completedPlaceIds.includes(place.id) ? '✓' : String(index + 1).padStart(2, '0');
      const label = document.createElement('span');
      label.className = styles.pinLabel;
      label.textContent = place.shortName;
      const kind = document.createElement('small');
      kind.textContent = anchor.kind === 'heritage' ? '유산 위치' : anchor.kind === 'viewing' ? '관람 위치' : '공식 안내 위치';
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
    return () => markers.forEach(({ marker, listener, node, keydown }) => {
      node.removeEventListener('keydown', keydown);
      sdk.maps.Event.removeListener(listener);
      marker.setMap(null);
    });
  }, [sdk, mapInitialized, places, selectedPlaceId, completedPlaceIds]);

  useEffect(() => {
    const requestId = ++locationRequestRef.current;
    if (!sdk || !mapRef.current) return;
    userMarkerRef.current?.setMap(null);
    const anchor = getMapAnchor(places.find((place) => place.id === selectedPlaceId));
    if (anchor) mapRef.current.panTo(new sdk.maps.LatLng(anchor.position.lat, anchor.position.lng));
    // Synchronize the GPS notice on the next map paint, while invalidating late readings immediately.
    const frame = requestAnimationFrame(() => {
      if (requestId !== locationRequestRef.current) return;
      setLocating(false);
      setLocationMode(false);
      setLocationMessage('');
      setLocationContext(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [sdk, mapInitialized, places, selectedPlaceId]);

  useEffect(() => {
    const dialog = settingsRef.current;
    if (!dialog) return;
    if (settingsOpen) dialog.showModal(); else dialog.close();
  }, [settingsOpen]);

  async function locateMe() {
    if (!sdk || !mapRef.current) return;
    const requestId = ++locationRequestRef.current;
    setLocationContext(selectionContext);
    setLocating(true);
    setLocationMessage('현재 위치를 확인하고 있어요…');
    try {
      const position = await getCurrentPosition();
      if (requestId !== locationRequestRef.current || !mapRef.current) return;
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
    if (!sdk || !mapRef.current) return;
    locationRequestRef.current += 1;
    setLocating(false);
    setLocationMode(false);
    setLocationMessage('');
    const center = selectedAnchor?.position ?? REGION_MAP_REFERENCE.position;
    mapRef.current.panTo(new sdk.maps.LatLng(center.lat, center.lng));
  }
  function applyClientId(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = draftKey.trim();
    if (!next || /\s/.test(next)) { setSettingsMessage('공백 없이 Maps의 Client ID를 입력해 주세요.'); return; }
    let saved = true;
    try { sessionStorage.setItem(SESSION_KEY, next); } catch { saved = false; }
    if (key && (next !== key || sdk)) {
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
      <div className={styles.mapNotice} role="status">{(activeLocationContext && locationMessage) || (selected && !selectedAnchor ? '선택 장소의 좌표는 확인 중입니다. 장소 안내와 네이버 검색을 이용해 주세요.' : selectedAnchor ? mapAnchorLabel(selectedAnchor) : '울산시 관광안내 대표 위치 · 지정 관람로를 이용해 주세요.')}{locationMode && activeLocationContext && <button type="button" onClick={returnToPlace}>장소로 복귀</button>}</div>
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
