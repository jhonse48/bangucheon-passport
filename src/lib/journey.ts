export interface JourneyPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy: number;
  segment: number;
}

export interface JourneyPhoto {
  id: string;
  createdAt: number;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  blob: Blob;
  thumbnailDataUrl: string;
  sourceMissionId?: string;
}

export interface JourneyRecord {
  id: string;
  title: string;
  startedAt: number;
  endedAt: number | null;
  status: 'recording' | 'paused' | 'completed';
  points: JourneyPoint[];
  photos: JourneyPhoto[];
  /** Missing on pre-automatic records, which remain manual journeys. */
  mode?: 'manual' | 'automatic';
  /** Calendar day in Asia/Seoul, supplied by the native recorder. */
  dayKey?: string;
}

export interface JourneyPhotoLocation {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export type JourneyAuthorization = 'notDetermined' | 'whenInUse' | 'always' | 'denied' | 'restricted';

export interface JourneyTrackingSnapshot {
  journeyId: string | null;
  status: 'idle' | 'recording' | 'paused';
  points: JourneyPoint[];
  mode?: 'manual' | 'automatic';
  dayKey?: string;
  startedAt?: number;
  endedAt?: number | null;
}

export interface JourneyArchivedSnapshot extends JourneyTrackingSnapshot {
  journeyId: string;
  status: 'idle';
  startedAt: number;
  endedAt: number;
}

export interface JourneyTrackingState extends JourneyTrackingSnapshot {
  automatic?: { enabled: boolean; authorization: JourneyAuthorization };
  archived?: JourneyArchivedSnapshot[];
  error?: string;
}

export const JOURNEY_MAX_ACCURACY_METERS = 50;
export const JOURNEY_PHOTO_LOCATION_MAX_AGE_MS = 30_000;
export const JOURNEY_MAX_GAP_MS = 120_000;
const MAX_FUTURE_MS = 5_000;
// Daily timelines include road and rail travel. This still rejects instantaneous kilometre-scale jumps.
const MAX_TRAVEL_SPEED_MPS = 100;

export function journeyDayKey(timestamp: number): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(timestamp);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function validJourneyCoordinate(value: { lat: number; lng: number }): boolean {
  return Number.isFinite(value.lat) && Number.isFinite(value.lng)
    && value.lat >= -90 && value.lat <= 90 && value.lng >= -180 && value.lng <= 180;
}

export function pointDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const term = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6_371_008.8 * 2 * Math.atan2(Math.sqrt(Math.min(1, term)), Math.sqrt(Math.max(0, 1 - term)));
}

/** Accept historical native buffers; stale means before this journey, not before this JS reload. */
export function normalizeJourneyPoints(points: readonly JourneyPoint[], startedAt = 0, now = Date.now()): JourneyPoint[] {
  const byTimestamp = new Map<number, JourneyPoint>();
  for (const input of points) {
    if (!input || !validJourneyCoordinate(input) || !Number.isFinite(input.timestamp)
      || input.timestamp < startedAt || input.timestamp > now + MAX_FUTURE_MS
      || !Number.isFinite(input.accuracy) || input.accuracy <= 0 || input.accuracy > JOURNEY_MAX_ACCURACY_METERS
      || !Number.isSafeInteger(input.segment) || input.segment < 0) continue;
    const point = { lat: input.lat, lng: input.lng, timestamp: input.timestamp, accuracy: input.accuracy, segment: input.segment };
    const previous = byTimestamp.get(point.timestamp);
    // A location timestamp is a sensor reading, not a new point each time it is replayed.
    if (!previous || point.accuracy < previous.accuracy) byTimestamp.set(point.timestamp, point);
  }
  const accepted: JourneyPoint[] = [];
  for (const point of [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp)) {
    const previous = accepted.at(-1);
    if (previous && point.segment < previous.segment) continue;
    if (previous && point.segment === previous.segment) {
      const elapsed = (point.timestamp - previous.timestamp) / 1000;
      const distance = pointDistanceMeters(previous, point);
      // A single noisy fix must not create a teleport; accepted long gaps are separate polylines.
      if (distance > Math.max(75, elapsed * MAX_TRAVEL_SPEED_MPS + point.accuracy + previous.accuracy)) continue;
    }
    accepted.push(point);
  }
  return accepted;
}

/** Pause/resume segment boundaries and long gaps never become straight connecting paths. */
export function journeySegments(points: readonly JourneyPoint[]): JourneyPoint[][] {
  const segments: JourneyPoint[][] = [];
  for (const point of points) {
    const current = segments.at(-1);
    const previous = current?.at(-1);
    if (!previous || previous.segment !== point.segment || point.timestamp <= previous.timestamp
      || point.timestamp - previous.timestamp > JOURNEY_MAX_GAP_MS) segments.push([point]);
    else current!.push(point);
  }
  return segments;
}

export function distanceMeters(points: readonly JourneyPoint[]): number {
  return journeySegments(points).reduce((total, segment) => total + segment.reduce((distance, point, index) =>
    distance + (index ? pointDistanceMeters(segment[index - 1], point) : 0), 0), 0);
}
export const journeyDistanceMeters = (journey: JourneyRecord): number => distanceMeters(journey.points);

/** Missing, stale, inaccurate and synthetic place coordinates must not be attached to photos. */
export function photoCoordinates(location: JourneyPhotoLocation | undefined, createdAt: number): Pick<JourneyPhoto, 'lat' | 'lng' | 'accuracy'> {
  if (!location || !validJourneyCoordinate(location) || !Number.isFinite(location.timestamp)
    || createdAt - location.timestamp > JOURNEY_PHOTO_LOCATION_MAX_AGE_MS || location.timestamp > createdAt + MAX_FUTURE_MS
    || !Number.isFinite(location.accuracy) || location.accuracy <= 0 || location.accuracy > JOURNEY_MAX_ACCURACY_METERS) {
    return { lat: null, lng: null, accuracy: null };
  }
  return { lat: location.lat, lng: location.lng, accuracy: location.accuracy };
}

export function newJourney(id: string, now = Date.now(), title?: string): JourneyRecord {
  if (!id.trim() || !Number.isFinite(now) || now < 0) throw new Error('여정 정보를 확인해 주세요.');
  return { id, title: title?.trim() || `${new Date(now).toLocaleDateString('ko-KR')} 반구천 여정`, startedAt: now,
    endedAt: null, status: 'recording', points: [], photos: [] };
}

export function activeJourneyFrom(journeys: readonly JourneyRecord[]): JourneyRecord | null {
  return journeys.find((journey) => journey.status === 'recording')
    ?? journeys.find((journey) => journey.status === 'paused') ?? null;
}

/** Automatic timelines show their observed span; an OFF day cannot keep accumulating elapsed time. */
export function journeyDisplayEnd(journey: JourneyRecord, now = Date.now()): number {
  if (journey.endedAt !== null) return journey.endedAt;
  if (journey.mode !== 'automatic') return Math.max(journey.startedAt, now);
  return Math.max(journey.startedAt, journey.points.at(-1)?.timestamp ?? journey.startedAt,
    journey.photos.at(-1)?.createdAt ?? journey.startedAt);
}

/** Export a point-in-time view without stopping automatic recording or mutating saved history. */
export function journeyVideoSnapshot(journey: JourneyRecord, now = Date.now()): JourneyRecord {
  return { ...journey, status: 'completed', endedAt: journeyDisplayEnd(journey, now),
    points: journey.points.map((point) => ({ ...point })), photos: journey.photos.map((photo) => ({ ...photo })) };
}
