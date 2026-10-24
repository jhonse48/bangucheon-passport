'use client';

import { useEffect, useState } from 'react';
import { Camera, ChevronRight, Clock3, Download, Film, Footprints, MapPin, Navigation, Pause, Play, Route, Square, Trash2 } from 'lucide-react';
import type { JourneyPhoto, JourneyRecord } from '@/lib/journey';
import { journeyDisplayEnd, journeyDistanceMeters, journeySegments } from '@/lib/journey';

export function formatJourneyDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}
function journeyDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}
export function JourneyStats({ journey }: { journey: JourneyRecord }) {
  const [now, setNow] = useState(journey.endedAt ?? journey.startedAt);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    if (journey.endedAt) return;
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, [journey.id, journey.endedAt]);
  const minutes = Math.max(0, Math.floor((journeyDisplayEnd(journey, now) - journey.startedAt) / 60000));
  return <div className="journey-stats">
    <span><Footprints size={16} /><b>{formatJourneyDistance(journeyDistanceMeters(journey))}</b><small>기록 거리</small></span>
    <span><Clock3 size={16} /><b>{minutes < 1 ? '1분 미만' : minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`}</b><small>{journey.mode === 'automatic' ? '기록 구간' : '여행 시간'}</small></span>
    <span><Camera size={16} /><b>{journey.photos.length}장</b><small>여정 사진</small></span>
  </div>;
}

/** A diagram of saved GPS points, never a fabricated route or a navigation map. */
export function JourneyMiniMap({ journey }: { journey: JourneyRecord }) {
  const photos = journey.photos.filter((p) => p.lat !== null && p.lng !== null);
  const all = [...journey.points, ...photos.map((p) => ({ lat: p.lat!, lng: p.lng! }))];
  if (!all.length) return <div className="journey-empty-route"><Route size={43} /><span>{journey.status === 'recording' ? '첫 위치를 기다리고 있어요' : '저장된 위치가 없어요'}</span><small>야외에서 위치가 잡히면 경로가 이어져요.</small></div>;
  const meanLat = all.reduce((sum, p) => sum + p.lat, 0) / all.length;
  const cos = Math.cos(meanLat * Math.PI / 180);
  const xs = all.map((p) => p.lng * cos), ys = all.map((p) => p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 0.0004), spanY = Math.max(maxY - minY, 0.0004);
  const scale = Math.min(276 / spanX, 140 / spanY);
  const project = (p: { lat: number; lng: number }) => ({ x: 170 + (p.lng * cos - (minX + maxX) / 2) * scale, y: 104 - (p.lat - (minY + maxY) / 2) * scale });
  const path = journeySegments(journey.points).map((segment) => segment.map((point, index) => {
    const p = project(point), command = index ? 'L' : 'M';
    return `${command}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(' ')).join(' ');
  const start = journey.points[0] ? project(journey.points[0]) : null;
  const end = journey.points.length > 1 ? project(journey.points.at(-1)!) : null;
  return <div className="journey-route-preview">
    <svg viewBox="0 0 340 210" role="img" aria-label={`저장한 이동 경로와 위치가 있는 사진 ${photos.length}장 요약`}>
      <path d="M0 52H340M0 104H340M0 156H340M68 0V210M136 0V210M204 0V210M272 0V210" stroke="#dce7da" strokeWidth="0.7" fill="none" />
      <path d={path} fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d={path} fill="none" stroke="#e57b51" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {start && <g><circle cx={start.x} cy={start.y} r="7" fill="#0b6d53" stroke="white" strokeWidth="3" /><text x={start.x} y={start.y - 13} textAnchor="middle" fontSize="10" fill="#285347">출발</text></g>}
      {end && <circle cx={end.x} cy={end.y} r="6" fill="#e57b51" stroke="white" strokeWidth="3" />}
      {photos.map((photo) => { const p = project({ lat: photo.lat!, lng: photo.lng! }); return <g key={photo.id}><rect x={p.x - 12} y={p.y - 29} width="24" height="24" rx="5" fill="white" stroke="#0b6d53" /><image href={photo.thumbnailDataUrl} x={p.x - 10} y={p.y - 27} width="20" height="20" preserveAspectRatio="xMidYMid slice" /><circle cx={p.x} cy={p.y} r="2" fill="#0b6d53" /></g>; })}
    </svg>
    <span>이동 기록 요약 · 지도에서 자세히 보기</span>
  </div>;
}

export function JourneySummary({ journeys, ready, automaticEnabled, onOpen }: { journeys: JourneyRecord[]; ready: boolean; automaticEnabled: boolean; onOpen: (id?: string) => void }) {
  const active = journeys.find((j) => j.status !== 'completed');
  const latest = active ?? journeys[0];
  return <section className="journey-summary">
    <div className="section-label"><h3>오늘의 여정</h3><span>{journeys.length ? `${journeys.length}번의 여행` : '나의 발자취'}</span></div>
    <button className="journey-summary-card" disabled={!ready} onClick={() => onOpen(latest?.id)}>
      <div className="journey-summary-icon"><Route size={27} /></div>
      <div><strong>{automaticEnabled ? '날짜별로 쌓이는 나의 발자취' : latest ? '다시 꺼내 보는 나의 여정' : '걸어온 길이 자동으로 기록되도록'}</strong><p>{latest ? `${journeyDate(latest.startedAt)} · ${formatJourneyDistance(journeyDistanceMeters(latest))} · 사진 ${latest.photos.length}장` : '한 번 켜두면 이동 경로와 사진을 날짜별로 모아요.'}</p><b>{latest ? '경로와 사진 보기' : '자동 기록 설정하기'} <ChevronRight size={15} /></b></div>
    </button>
    {journeys.length > 1 && <button className="text-button" onClick={() => onOpen()}>지난 여정 모두 보기 <ChevronRight size={15} /></button>}
  </section>;
}

type JourneyPanelProps = {
  journeys: JourneyRecord[]; selectedId: string | null; ready: boolean; busy: boolean; native: boolean;
  automaticEnabled: boolean; automaticSupported: boolean; authorization: string;
  trackingError: string | null;
  onAutomatic: (enabled: boolean) => void; onBackgroundAuthorization: () => void;
  onSelect: (id: string | null) => void; onPause: () => void; onResume: () => void; onFinish: () => void;
  onCapture: () => void; onMap: (journey: JourneyRecord) => void; onVideo: (journey: JourneyRecord) => void;
  onPhoto: (photo: JourneyPhoto, journey: JourneyRecord) => void; onDelete: (id: string) => void;
};
function AutomaticRecordingSettings({ enabled, supported, authorization, disabled, message, onChange, onBackground }: {
  enabled: boolean; supported: boolean; authorization: string; disabled: boolean;
  message: string | null;
  onChange: (enabled: boolean) => void; onBackground: () => void;
}) {
  const denied = authorization === 'denied' || authorization === 'restricted';
  return <section className="journey-auto-settings" aria-label="자동 경로 기록 설정">
    <div className="journey-auto-switch-row"><div><strong>자동 경로 기록</strong><small>{enabled ? '켜짐 · 날짜별 타임라인' : '꺼짐 · 위치를 자동 수집하지 않아요'}</small></div><button type="button" role="switch" aria-label="자동 경로 기록" aria-checked={enabled} className="journey-auto-switch" disabled={disabled || !supported} onClick={() => onChange(!enabled)}><span /></button></div>
    <p>한 번 켜면 매번 시작·종료할 필요 없이 이동 경로를 기기에 저장해요. 날짜가 바뀌면 새 기록으로 이어지고, 끄면 위치 수집이 멈춰요.</p>
    {!supported ? <p className="journey-auto-permission">자동 기록은 iPhone 앱에서 사용할 수 있어요.</p> : <>
      {denied && <p className="journey-auto-permission">iPhone 설정에서 탐험지도의 위치 접근을 허용해 주세요. 정확한 경로를 위해 ‘정확한 위치’도 켜 주세요.</p>}
      {enabled && !denied && authorization !== 'always' && <div className="journey-auto-permission"><p>앱을 사용하지 않을 때도 자동 기록하려면 위치 접근을 ‘항상’으로 허용해 주세요.</p><button className="text-button" disabled={disabled} onClick={onBackground}>백그라운드 위치 허용 <ChevronRight size={15} /></button><small className="journey-auto-note">허용 창이 뜨지 않으면 iPhone 설정에서 앱의 위치 접근을 ‘항상’으로 변경해 주세요.</small></div>}
      {enabled && authorization === 'always' && <span className="journey-auto-authorized"><MapPin size={13} />백그라운드 위치 접근 허용됨</span>}
    </>}
    {message && <p className="journey-auto-permission" role="status">{message}</p>}
    <small className="journey-auto-note">자동 기록 중에는 관광지 밖의 이동도 저장돼요. 앱을 강제로 종료하거나 위치 수신이 약하면 기록이 끊길 수 있어요. 기록은 언제든 삭제할 수 있습니다.</small>
  </section>;
}
export function JourneyPanel({ journeys, selectedId, ready, busy, native, automaticEnabled, automaticSupported, authorization, trackingError, onAutomatic, onBackgroundAuthorization, onSelect, onPause, onResume, onFinish, onCapture, onMap, onVideo, onPhoto, onDelete }: JourneyPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const current = journeys.find((j) => j.id === selectedId);
  const active = journeys.find((j) => j.status !== 'completed');
  const settings = <AutomaticRecordingSettings enabled={automaticEnabled} supported={automaticSupported} authorization={authorization} message={trackingError} disabled={!ready || busy} onChange={onAutomatic} onBackground={onBackgroundAuthorization} />;
  if (!current) return <>
    <div className="journey-intro"><span className="journey-intro-icon"><Route size={34} /></span><span className="eyebrow">MY TIMELINE</span><h3>시작 버튼 없이,<br />쌓이는 오늘의 발자취.</h3><p>한 번만 켜두세요.<br />걸어온 길과 사진이 날짜별로 남아요.</p></div>
    <div className="journey-how"><span><Navigation size={17} />이동 경로</span><i>→</i><span><Camera size={17} />사진 위치</span><i>→</i><span><Film size={17} />여정 영상</span></div>
    {settings}
    {active ? <button className="button secondary full" onClick={() => onSelect(active.id)}>경로와 사진 보기 <ChevronRight size={17} /></button> : automaticEnabled && <div className="journey-auto-wait"><Route size={20} /><span>첫 위치를 기다리고 있어요.<small>위치가 잡히면 오늘의 기록이 자동으로 생겨요.</small></span></div>}
    {automaticEnabled && !active && <button className="button secondary full" disabled={busy} onClick={onCapture}><Camera size={18} />오늘의 사진 남기기</button>}
    <div className="section-label"><h3>날짜별 타임라인</h3><span>{journeys.length}개</span></div>
    <div className="journey-history">{journeys.map((j) => <button key={j.id} onClick={() => onSelect(j.id)}><span className="journey-history-icon"><Route size={21} /></span><span><strong>{j.title}</strong><small>{journeyDate(j.startedAt)} · {formatJourneyDistance(journeyDistanceMeters(j))} · 사진 {j.photos.length}장</small></span><ChevronRight size={17} /></button>)}</div>
    {!journeys.length && <p className="quiet-message">이동한 날의 경로와 사진이 날짜별로 여기에 쌓여요.</p>}
  </>;
  const automatic = current.mode === 'automatic';
  const missingLocation = current.photos.filter((photo) => photo.lat === null || photo.lng === null).length;
  return <>
    <button className="text-button" onClick={() => onSelect(null)}>‹ 전체 여정</button>
    <div className="journey-heading"><div><span className="eyebrow">{journeyDate(current.startedAt)} · {automatic ? 'MY TIMELINE' : 'MY JOURNEY'}</span><h3>{current.title}</h3></div><span className={`journey-state ${current.status}`}><i />{current.status === 'recording' ? automatic ? '자동 기록 중' : '기록 중' : current.status === 'paused' ? automatic ? automaticEnabled ? '위치 확인 중' : '기록 꺼짐' : '일시정지' : '기록 완료'}</span></div>
    <JourneyMiniMap journey={current} />
    <JourneyStats journey={current} />
    <button className="button secondary full" disabled={!current.points.length && !current.photos.some((p) => p.lat !== null && p.lng !== null)} onClick={() => onMap(current)}><MapPin size={18} />지도에서 경로와 사진 보기</button>
    {current.status !== 'completed' && <>
      {settings}
      <button className="button full" disabled={busy || (automatic && !automaticEnabled)} onClick={onCapture}><Camera size={18} />여정 사진 찍기</button>
      {automatic && !automaticEnabled && <p className="fine-print">자동 기록을 켠 뒤 오늘의 사진을 남겨 주세요.</p>}
      {!automatic && <div className="journey-legacy-controls"><p className="fine-print">이전에 직접 시작한 여정이에요. 자동 기록을 켜면 앞으로 시작 버튼 없이 기록할 수 있어요.</p><div className="journey-record-actions"><button className="button secondary" disabled={busy} onClick={current.status === 'recording' ? onPause : onResume}>{current.status === 'recording' ? <Pause size={17} /> : <Play size={17} />}{current.status === 'recording' ? '일시정지' : '다시 기록'}</button><button className="button secondary" disabled={busy} onClick={onFinish}><Square size={14} />기존 여정 보관</button></div></div>}
      <p className="fine-print">사진은 촬영할 때 확인한 위치에 표시돼요. 위치 신호가 약하면 사진만 보관하고 지도에는 표시하지 않아요.</p>
    </>}
    <div className="journey-film-card"><div><Film size={24} /><span><strong>오늘의 여정을 한 편의 영상으로</strong><small>{current.status === 'completed' ? '지나온 경로와 사진을 순서대로 담아요.' : '기록을 멈추지 않고 지금까지의 순간을 담아요.'}</small></span></div><button className="button full" disabled={busy || !native || (current.points.length < 2 && !current.photos.length)} onClick={() => onVideo(current)}><Download size={18} />{busy ? '영상을 만들고 있어요…' : current.status === 'completed' ? '여정 영상 만들기 · MP4' : '지금까지 영상 만들기 · MP4'}</button>{!native && <p className="fine-print">iPhone 앱에서 영상을 만들고 저장할 수 있어요.</p>}</div>
    <div className="section-label"><h3>길 위의 순간들</h3><span>{current.photos.length}장</span></div>
    {!!missingLocation && <p className="journey-location-note">위치가 없는 사진 {missingLocation}장은 아래 앨범과 영상에서 볼 수 있어요.</p>}
    <div className="journey-photo-grid">{current.photos.map((photo, index) => <button key={photo.id} onClick={() => onPhoto(photo, current)}><img src={photo.thumbnailDataUrl} alt={`여정 사진 ${index + 1}`} /><span>{new Date(photo.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span><small><MapPin size={11} />{photo.lat === null || photo.lng === null ? '위치 없음' : '지도에 표시'}</small></button>)}</div>
    {!current.photos.length && <p className="quiet-message">{current.status === 'completed' ? '이 여정에 촬영한 사진이 없어요. 기록한 경로는 그대로 보관돼요.' : '여정 사진 버튼으로 첫 순간을 남겨 보세요. 사진 미션에서 찍은 사진도 함께 담겨요.'}</p>}
    <p className="fine-print">이 기기에 저장된 개인 여행 기록이에요. 기기 변경·앱 삭제 전에 영상이나 기록 파일로 저장해 주세요.</p>
    {(confirmDelete ? <div className="journey-delete-confirm"><p>이 여정의 경로와 사진을 삭제할까요? {current.status !== 'completed' && '진행 중인 자동 기록도 꺼집니다. '}미션 보상과 도감은 유지됩니다.</p><div className="action-pair"><button className="button secondary" disabled={busy} onClick={() => setConfirmDelete(false)}>취소</button><button className="button destructive" disabled={busy} onClick={() => onDelete(current.id)}>여정 삭제</button></div></div> : <button className="text-button danger centered" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={14} />이 여정 삭제</button>)}
  </>;
}
