import { Capacitor } from '@capacitor/core';
import type { JourneyRecord } from './journey';
import { journeyDistanceMeters } from './journey';
import { captureJourneyMapSnapshot } from './native-naver-map';
import { JourneyNative } from './native-journey';

export interface JourneyVideo { uri: string; fileName: string; mapStyle: 'naver' | 'route' }
interface VideoInput {
  journeyId: string; title: string; startedAt: number; distanceMeters: number; durationSeconds: number;
  points: JourneyRecord['points'];
  photos: { id: string; timestamp: number; lat?: number; lng?: number; dataUrl: string }[];
  mapSnapshot?: { dataUrl: string; points: { x: number; y: number; segment: number }[]; photos: { id: string; x: number; y: number }[] };
}
// Tracking and export share one Capacitor registration and native plugin instance.
const videoPlugin = JourneyNative as unknown as {
  renderVideo(input: VideoInput): Promise<{ uri: string; fileName: string }>;
  saveVideo(input: { uri: string }): Promise<{ saved: boolean }>;
  deleteJourneyVideos(input: { journeyId: string }): Promise<void>;
  clearVideos(): Promise<void>;
};

export function validateVideoJourney(journey: JourneyRecord) {
  if (journey.status !== 'completed') throw new Error('여정을 종료한 뒤 영상으로 만들어 주세요.');
  if (journey.points.length < 2 && !journey.photos.length) throw new Error('기록된 경로나 사진이 있어야 영상을 만들 수 있어요.');
  if (journey.photos.length > 60) throw new Error('한 영상에는 사진을 최대 60장 담을 수 있어요. 전체 기록은 파일로 내보낼 수 있어요.');
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('사진을 읽지 못했어요.'));
    reader.onerror = () => reject(new Error('사진을 읽지 못했어요.'));
    reader.readAsDataURL(blob);
  });
}

/** Only called by the video button. Media renders on-device; the map SDK may request tiles. */
export async function createJourneyVideo(journey: JourneyRecord): Promise<JourneyVideo> {
  validateVideoJourney(journey);
  if (Capacitor.getPlatform() !== 'ios' || !Capacitor.isNativePlatform()) {
    throw new Error('여정 영상은 iPhone 앱에서 MP4로 만들 수 있어요.');
  }
  let mapSnapshot: VideoInput['mapSnapshot'];
  const located = journey.photos.filter((p) => p.lat !== null && p.lng !== null)
    .map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng! }));
  if (journey.points.length || located.length) {
    // A map outage must not prevent exporting already saved private memories.
    try { mapSnapshot = await captureJourneyMapSnapshot(journey.points, located); }
    catch { /* The renderer labels its own route illustration when tiles are unavailable. */ }
  }
  const photos: VideoInput['photos'] = [];
  for (const photo of [...journey.photos].sort((a, b) => a.createdAt - b.createdAt)) {
    photos.push({ id: photo.id, timestamp: photo.createdAt,
      ...(photo.lat !== null && photo.lng !== null ? { lat: photo.lat, lng: photo.lng } : {}),
      dataUrl: await blobDataUrl(photo.blob) });
  }
  const result = await videoPlugin.renderVideo({
    journeyId: journey.id, title: journey.title, startedAt: journey.startedAt,
    distanceMeters: journeyDistanceMeters(journey),
    durationSeconds: Math.max(0, ((journey.endedAt ?? journey.startedAt) - journey.startedAt) / 1000),
    points: journey.points, photos, mapSnapshot,
  });
  return { ...result, mapStyle: mapSnapshot ? 'naver' : 'route' };
}

export async function saveJourneyVideo(video: JourneyVideo) {
  const result = await videoPlugin.saveVideo({ uri: video.uri });
  if (!result.saved) throw new Error('영상이 저장되지 않았어요. 사진 접근 권한을 확인해 주세요.');
}
export async function shareJourneyVideo(video: JourneyVideo) {
  const { Share } = await import('@capacitor/share');
  try {
    await Share.share({ title: '반구천, 오늘의 여정', dialogTitle: '여정 영상 파일 저장 또는 공유', files: [video.uri] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/cancel|dismiss/i.test(message)) return;
    throw new Error('영상 파일 저장 화면을 열지 못했어요. 다시 시도해 주세요.', { cause: error });
  }
}
export const journeyVideoUrl = (video: JourneyVideo) => Capacitor.convertFileSrc(video.uri);

export async function clearJourneyVideos(journeyId?: string) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return;
  if (journeyId) await videoPlugin.deleteJourneyVideos({ journeyId });
  else await videoPlugin.clearVideos();
}

/** An unsaved capture stays recoverable even if its journey ended in another window. */
export async function shareJourneyPhoto(photo: Blob) {
  const extension = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
  const filename = `bangucheon-photo-${Date.now()}.${extension}`;
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(photo), link = document.createElement('a');
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const dataUrl = await blobDataUrl(photo);
  const file = await Filesystem.writeFile({ path: filename, directory: Directory.Cache, data: dataUrl.slice(dataUrl.indexOf(',') + 1) });
  try { await Share.share({ title: '반구천 여정 사진', files: [file.uri] }); }
  catch (error) { if (!/cancel|dismiss/i.test(String(error))) throw error; }
  finally { await Filesystem.deleteFile({ path: filename, directory: Directory.Cache }).catch(() => undefined); }
}
