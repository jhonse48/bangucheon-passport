export type Category =
  "세계유산" | "역사문화" | "자연·지질" | "박물관·체험" | "교통·편의";
export interface Source {
  title: string;
  url: string;
  checkedAt: string;
}
export interface Coordinates {
  lat: number;
  lng: number;
}
export interface Place {
  id: string;
  name: string;
  shortName: string;
  category: Category;
  zone: "A" | "B";
  pilot: boolean;
  description: string;
  observation: string[];
  image: string;
  imageAlt: string;
  imageCredit: string;
  heritagePosition: Coordinates | null;
  viewingPosition: Coordinates | null;
  locationStatus: "확인 필요" | "공식 자료 확인";
  accessNote: string;
  officialUrl: string;
  mapQuery: string;
  serviceIds: string[];
  missionIds: string[];
  collectionId: string;
  sources: Source[];
}
export interface TourRoute {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  placeIds: string[];
  active: boolean;
  image: string;
  theme: string;
}
export interface Mission {
  id: string;
  placeId: string;
  type: "관찰형" | "해설 연계형" | "기록형";
  title: string;
  instruction: string;
  question: string;
  options?: string[];
  correctIndex?: number;
  explanation: string;
  collectionId: string;
}
export interface Service {
  id: string;
  title: string;
  type: "해설" | "XR" | "교육" | "교통";
  description: string;
  url: string;
  source: Source;
}
export interface CollectionItem {
  id: string;
  name: string;
  category: "암각화" | "공룡" | "역사문화" | "자연";
  symbol: "whale" | "footprints" | "landmark" | "leaf" | "book";
  description: string;
}
export interface VisitRecord {
  placeId: string;
  visitedAt?: string;
  completedMissionIds: string[];
  note: string;
  photo?: Blob;
  updatedAt: string;
}
export interface UserProgress {
  activeRouteId: string | null;
  startedAt: string | null;
}
