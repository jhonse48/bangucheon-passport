import type { Coordinates, Source } from '../lib/types';

/** Coordinates are map references; the confidence label is part of their meaning. */
export interface ExplorationPoint {
  number: number;
  position: Coordinates | null;
  kind: 'heritage' | 'facility' | 'viewing' | 'approximate';
  source: Source;
  accuracy: 'official' | 'public-map' | 'approximate' | 'unverified';
  coordinateNote: string;
  qr: {
    status: 'photo-confirmed' | 'needs-location-check' | 'needs-individual-check' | 'not-listed';
    label: string;
    where: string;
    find: string;
    evidence: string;
  };
}

const checkedAt = '2026-10-23';
const source = (title: string, url: string): Source => ({ title, url, checkedAt });
export const DISTRIBUTION_MAP_SOURCE = source('울산광역시 · 반구천 일원 유적 분포도', 'https://www.ulsan.go.kr/s/bangucheonpetroglyphs/contents.ulsan?mId=001001004000000000');
const kakaoSource = (name: string, id: string) => source(`카카오맵 · ${name} 공개 장소 정보`, `https://place.map.kakao.com/${id}`);
const heritageSource = (name: string, id: string) => source(`국가유산포털 · ${name} 위치 정보`, `https://www.heritage.go.kr/heri/cul/culSelectDetail.do?ccbaCpno=${id}`);

/** Official heritage reference points. These are NOT approved visitor standing positions. */
export const HERITAGE_REFERENCE_POSITIONS: Readonly<Record<string, Coordinates>> = {
  bangudae: { lat: 35.6038151324587, lng: 129.177842844766 },
  memorial: { lat: 35.6083730334995, lng: 129.173980935327 },
  dinosaur: { lat: 35.607260534617, lng: 129.174744998746 },
  cheonjeonri: { lat: 35.6143464249842, lng: 129.175090935504 },
  'cheonjeonri-dinosaur': { lat: 35.614398707031, lng: 129.175347420766 },
};
export const HERITAGE_POSITION_SOURCES: Readonly<Record<string, Source>> = {
  bangudae: heritageSource('울주 대곡리 반구대 암각화', '1112602850000'),
  memorial: heritageSource('반고서원유허비', '2112600130000'),
  dinosaur: heritageSource('대곡리공룡발자국화석', '3412600130000'),
  cheonjeonri: heritageSource('울주 천전리 명문과 암각화', '1112601470000'),
  'cheonjeonri-dinosaur': heritageSource('천전리공룡발자국화석', '3412600060000'),
};

const suppliedEvidence = '사용자 제공 A/B 코스·QR 조사표(2026-10-23). 현장 실사나 QR 원본 URL 확인을 대신하지 않음.';
const pendingQR = (where: string, find: string, label = '세부 설치 미확인'): ExplorationPoint['qr'] => ({
  status: 'needs-location-check', label, where, find, evidence: suppliedEvidence,
});
const noListedQR: ExplorationPoint['qr'] = {
  status: 'not-listed', label: '조사표 QR 대상 아님', where: '박물관 안내데스크·전시 안내를 확인하세요.',
  find: '앱 장소 퀴즈로 참여할 수 있습니다. 공식 QR 설치 여부를 의미하지 않습니다.', evidence: suppliedEvidence,
};

export const EXPLORATION_POINTS: Readonly<Record<string, ExplorationPoint>> = {
  museum: {
    number: 1, position: { lat: 35.6080854, lng: 129.170553 }, kind: 'facility', accuracy: 'official',
    source: source('울산관광 · 울산암각화박물관 교통안내', 'https://www.ulsan.go.kr/tour/korean/unit/attrctn/view.ulsan?mId=001001000000000000&unqId=127'),
    coordinateNote: '공식 관광 안내의 시설 대표 위치입니다. 실제 출입구·무장애 동선은 확인이 필요합니다.', qr: noListedQR,
  },
  jipcheongjeong: {
    number: 2, position: { lat: 35.60846868, lng: 129.17310043 }, kind: 'facility', accuracy: 'public-map',
    source: kakaoSource('집청정', '1774330395'), coordinateNote: '공개 지도에 등록된 집청정 대표 위치입니다. 관람 구역·출입 가능 여부는 현장 안내를 따릅니다.',
    qr: pendingQR('집청정 외부 관람 구역의 안내판을 확인하세요.', '안내판의 장소명이 집청정인지 확인하세요. 세부 QR 부착 위치는 아직 확인되지 않았습니다.'),
  },
  seowon: {
    number: 3, position: { lat: 35.60919426, lng: 129.17373798 }, kind: 'facility', accuracy: 'public-map',
    source: kakaoSource('반구서원', '11253942'), coordinateNote: '공개 지도에 등록된 반구서원 대표 위치입니다. 외부 관람과 내부 개방 범위는 다를 수 있습니다.',
    qr: pendingQR('반구서원 출입구 주변의 관람 안내를 확인하세요.', '반고서원 유허비 안내판과 구분하세요. 정확한 QR 부착 위치는 확인이 필요합니다.'),
  },
  poeundae: {
    number: 4, position: { lat: 35.60838651, lng: 129.17395886 }, kind: 'heritage', accuracy: 'public-map',
    source: kakaoSource('반구대', '10395608'), coordinateNote: '공개 지도 반구대의 대표 위치입니다. 포은대와 반구대 암각화는 다른 장소이며 바위에 직접 접근하는 목적지가 아닙니다.',
    qr: pendingQR('지정된 탐방로에서 반구대·포은대 설명을 찾아보세요.', '안내판의 정확한 위치와 QR 유무는 현장 확인이 필요합니다. 비문이나 바위를 향해 하천으로 내려가지 마세요.', '안내판 위치 미확인'),
  },
  moeunjeong: {
    number: 5, position: { lat: 35.60958, lng: 129.17419 }, kind: 'approximate', accuracy: 'approximate',
    source: DISTRIBUTION_MAP_SOURCE, coordinateNote: '공식 위성 분포도의 모은정 표식을 기준점과 대조한 근사 위치입니다. 정밀 GPS·출입구 좌표가 아닙니다.',
    qr: pendingQR('모은정 외부 관람 구역의 설명을 확인하세요.', '정자 이름을 먼저 대조하세요. QR의 세부 설치 위치는 아직 확인되지 않았습니다.'),
  },
  memorial: {
    number: 6, position: HERITAGE_REFERENCE_POSITIONS.memorial, kind: 'heritage', accuracy: 'official',
    source: HERITAGE_POSITION_SOURCES.memorial, coordinateNote: '국가유산포털 유허비 대표 위치입니다. 인근 반구대 표식과 매우 가까우며 실제 관람 동선은 안내판을 따릅니다.',
    qr: pendingQR('반고서원 유허비를 설명하는 안내판을 확인하세요.', '서원 건물과 비석의 안내를 구분하세요. QR 부착 위치와 현재 접근 가능 구역은 확인이 필요합니다.'),
  },
  'old-road': {
    number: 7, position: { lat: 35.60854, lng: 129.17497 }, kind: 'approximate', accuracy: 'approximate',
    source: DISTRIBUTION_MAP_SOURCE, coordinateNote: '공식 위성 분포도의 연로 개수기 표식을 대조한 근사 위치입니다. 정확한 안내판 GPS는 확인되지 않았습니다.',
    qr: pendingQR('반구대 암각화 방향의 지정 탐방로에서 연로 개수기 안내를 확인하세요.', '바위 글씨를 설명하는 안내판이 대상입니다. QR 설치 위치는 확인이 필요하며 비문을 만지거나 오르지 않습니다.'),
  },
  wetland: {
    number: 8, position: { lat: 35.60738, lng: 129.17496 }, kind: 'approximate', accuracy: 'approximate',
    source: DISTRIBUTION_MAP_SOURCE, coordinateNote: '공식 위성 분포도의 동매산 자연습지 표식을 대조한 근사 위치입니다. 습지 경계·관람데크 입구·QR 좌표가 아닙니다.',
    qr: pendingQR('지정된 습지 관람로의 동매산 자연습지 안내를 확인하세요.', '습지 안으로 들어가지 말고 관람로에서 안내판을 찾아보세요. 세부 QR 부착 위치는 확인되지 않았습니다.'),
  },
  dinosaur: {
    number: 9, position: HERITAGE_REFERENCE_POSITIONS.dinosaur, kind: 'heritage', accuracy: 'official',
    source: HERITAGE_POSITION_SOURCES.dinosaur, coordinateNote: '국가유산포털 화석 산지 대표 위치입니다. 화석 암반이나 관람객이 서는 위치의 정밀 좌표가 아닙니다.',
    qr: pendingQR('대곡리 공룡발자국 화석의 현장 안내를 확인하세요.', '천전리 화석과 이름을 구분하세요. 안내판 위치와 QR 유무는 아직 확인되지 않았습니다.', '안내판 위치 미확인'),
  },
  bangudae: {
    number: 10, position: { lat: 35.60446, lng: 129.17757 }, kind: 'approximate', accuracy: 'approximate',
    source: DISTRIBUTION_MAP_SOURCE,
    coordinateNote: '국가유산포털 유산 대표점과 공식 분포도의 해설사의 집을 대조한 조망 공간 일대의 근사 위치입니다. 암면·정확한 관람데크·QR 위치와 구분하며 현장 안내를 따르세요.',
    qr: {
      status: 'photo-confirmed', label: '안내판 사진 확인', where: '암각화를 강 건너 바라보는 조망지점의 안내판입니다.',
      find: '조사 자료에서 안내판 사진을 확인한 곳이에요. 정확한 부착 위치·QR 연결 주소·현재 작동 여부는 현장에서 확인해 주세요.', evidence: suppliedEvidence,
    },
  },
  cheonjeonri: {
    number: 11, position: HERITAGE_REFERENCE_POSITIONS.cheonjeonri, kind: 'heritage', accuracy: 'official',
    source: HERITAGE_POSITION_SOURCES.cheonjeonri, coordinateNote: '국가유산포털 암각화 대표 위치입니다. 공식 관광 안내의 종전 북서쪽 좌표를 교정했으며 안전 관람 위치는 별도 확인이 필요합니다.',
    qr: { status: 'needs-individual-check', label: '개별 QR 확인 필요', where: '천전리 명문과 암각화 현장 안내를 확인하세요.', find: '관광 안내 QR과 이 유산에 연결되는 개별 QR을 구분해야 합니다. 실제 연결 주소와 부착 위치는 확인되지 않았습니다.', evidence: suppliedEvidence },
  },
  'cheonjeonri-dinosaur': {
    number: 12, position: HERITAGE_REFERENCE_POSITIONS['cheonjeonri-dinosaur'], kind: 'heritage', accuracy: 'official',
    source: HERITAGE_POSITION_SOURCES['cheonjeonri-dinosaur'], coordinateNote: '국가유산포털 화석 산지 대표 위치입니다. 하천 횡단이나 암반 접근 경로를 뜻하지 않습니다.',
    qr: pendingQR('천전리 공룡발자국 화석의 안내판을 확인하세요.', '암각화 안내판과 구분하세요. 안내판 위치와 QR 유무는 미확인이고 임의로 하천을 건너지 않습니다.', '안내판 위치 미확인'),
  },
  'daegok-museum': {
    number: 13, position: { lat: 35.6190785, lng: 129.16907487 }, kind: 'facility', accuracy: 'public-map',
    source: kakaoSource('울산대곡박물관', '11333564'), coordinateNote: '공개 지도 시설 대표 위치이며 공식 박물관 주소(서하천전로 257)와 대조했습니다. 출입구 위치는 별도입니다.', qr: noListedQR,
  },
};

export function getExplorationPoint(id: string): ExplorationPoint | null {
  return EXPLORATION_POINTS[id] ?? null;
}

export const EXPLORATION_ROUTES = {
  core: {
    id: 'core',
    placeIds: ['museum', 'jipcheongjeong', 'seowon', 'poeundae', 'moeunjeong', 'memorial', 'old-road', 'wetland', 'dinosaur', 'bangudae'],
    lineKind: 'visit-order', label: '방문 순서 연결선', dashed: true,
  },
  cheonjeon: {
    id: 'cheonjeon',
    placeIds: ['cheonjeonri', 'cheonjeonri-dinosaur', 'daegok-museum'],
    lineKind: 'visit-order', label: '방문 순서 연결선', dashed: true,
  },
} as const;
