"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  ExternalLink,
  Footprints,
  Gift,
  Info,
  MapPin,
  Navigation,
  QrCode,
  Search,
  Settings2,
  Sparkles,
  Stamp,
  Telescope,
  Trash2,
  X,
} from "lucide-react";
import { places, routes, services, collectionItems } from "@/data/content";
import {
  gameMissions,
  photoMissions,
  quizMissions,
  GAME_QR_NOTICE,
} from "@/data/game-missions";
import type { GameMission, GameCompletion } from "@/lib/game";
import type { Place, VisitRecord } from "@/lib/types";
import { useGame } from "@/lib/use-game";
import { usePassport } from "@/lib/use-passport";
import { passportStorage, compressPhoto } from "@/lib/storage";
import {
  isNativeApp,
  scanMissionQr,
  takeMissionPhoto,
  shareExplorationData,
  registerBackButtonHandler,
} from "@/lib/native-device";
import TourismMap from "./tourism-map";
import { MissionPanel } from "./mission-panel";

export function Whale({ size = 42 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 70 60"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 33c0-10 9-17 22-16 9 1 13 7 16 14 8 0 14-6 17-13 3 10 0 17-5 20 4 3 5 8 3 12-6-1-12-7-16-11-7 8-23 8-31 2-4-2-6-4-6-8Z"
        fill="currentColor"
        fillOpacity=".15"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="21" cy="28" r="2" fill="currentColor" />
      <path
        d="M29 18v-8m0 0-5-3m5 3 5-5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
const noSubscribe = () => () => {};
export function useNative() {
  return useSyncExternalStore(noSubscribe, isNativeApp, () => false);
}
export function usePhotoUrl(photo?: Blob | null) {
  const url = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}
export function Sheet({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={"sheet " + className}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-handle" />
      <header className="sheet-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="닫고 지도로 돌아가기"
        >
          <X size={21} />
        </button>
      </header>
      <div className="sheet-body">{children}</div>
    </dialog>
  );
}
export function External({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ExternalLink size={15} />
      <span className="sr-only"> (외부 서비스)</span>
    </a>
  );
}
function placeName(id: string) {
  return places.find((p) => p.id === id)?.shortName ?? id;
}
function naverSearch(place: Place) {
  return "https://map.naver.com/p/search/" + encodeURIComponent(place.mapQuery);
}
function PhotoCredit({ place }: { place: Place }) {
  return (
    <details className="source-details">
      <summary>사진과 관광 정보 출처</summary>
      <p>{place.imageCredit}</p>
      {!place.image.endsWith(".svg") && (
        <External
          href={
            place.image.includes("museum")
              ? "https://commons.wikimedia.org/wiki/File:Ulsan_Petroglyph_Museum5.jpg"
              : place.image.includes("petroglyphs")
                ? "https://commons.wikimedia.org/wiki/File:Bangudae3.jpg"
                : "https://commons.wikimedia.org/wiki/File:Bangudae2.jpg"
          }
        >
          사진 원본 · CC BY-SA 3.0 · 잘라 표시
        </External>
      )}
      {place.sources.map((s) => (
        <External key={s.url} href={s.url}>
          {s.title}
        </External>
      ))}
    </details>
  );
}
export function MissionRow({
  mission,
  done,
  unlocked,
  onClick,
}: {
  mission: GameMission;
  done?: boolean;
  unlocked?: boolean;
  onClick: () => void;
}) {
  const Icon = done ? Check : mission.kind === "quiz" ? QrCode : Camera;
  return (
    <button
      className={"mission-row " + (done ? "is-done" : "")}
      onClick={onClick}
    >
      <span className={"mission-symbol " + mission.kind}>
        <Icon size={23} />
      </span>
      <span className="mission-row-copy">
        <small>
          {done
            ? "수집 완료"
            : mission.kind === "quiz"
              ? unlocked
                ? "퀴즈 열림"
                : "QR 퀴즈"
              : "사진 관찰"}
        </small>
        <strong>{mission.title}</strong>
        <span>{placeName(mission.placeId)}</span>
      </span>
      <span className="mission-reward">
        {done ? (
          <CheckCircle2 size={20} />
        ) : (
          <>
            <b>+{mission.xp}</b>
            <small>XP</small>
          </>
        )}
      </span>
      <ChevronRight size={17} />
    </button>
  );
}

type Panel =
  | "missions"
  | "collection"
  | "scan"
  | "routes"
  | "settings"
  | "services"
  | "qr-kit"
  | "photos"
  | null;
type Filter = "all" | "quiz" | "photo" | "done";

export function PassportApp() {
  const game = useGame();
  const passport = usePassport();
  const native = useNative();
  useEffect(() => {
    if (!native) return;
    let disposed = false;
    let remove: (() => void) | undefined;
    void registerBackButtonHandler(() => {
      const dialogs =
        document.querySelectorAll<HTMLDialogElement>("dialog[open]");
      const topmost = dialogs.item(dialogs.length - 1);
      if (!topmost) return false;
      topmost.dispatchEvent(
        new Event("cancel", { bubbles: true, cancelable: true }),
      );
      return true;
    })
      .then((cleanup) => {
        if (disposed) cleanup();
        else remove = cleanup;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      remove?.();
    };
  }, [native]);
  const [panel, setPanel] = useState<Panel>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [mission, setMission] = useState<GameMission | null>(null);
  const [reward, setReward] = useState<GameCompletion | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanError, setScanError] = useState("");
  const [qrText, setQrText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<"all" | string | null>(null);
  const ready = game.ready && passport.ready;
  const activeRoute = routes.find(
    (r) => r.id === passport.progress.activeRouteId,
  );
  const completedPlaces = useMemo(
    () => [
      ...new Set([
        ...game.progress.stampPlaceIds,
        ...Object.values(passport.records)
          .filter((r) => r.completedMissionIds.length)
          .map((r) => r.placeId),
      ]),
    ],
    [game.progress.stampPlaceIds, passport.records],
  );
  const filteredPlaces = useMemo(
    () =>
      places.filter((p) => {
        const missionMatches =
          filter === "quiz"
            ? quizMissions.some((m) => m.placeId === p.id)
            : filter === "photo"
              ? photoMissions.some((m) => m.placeId === p.id)
              : filter === "done"
                ? completedPlaces.includes(p.id)
                : true;
        return (
          missionMatches &&
          (!search.trim() ||
            (
              p.name +
              p.description +
              gameMissions
                .filter((m) => m.placeId === p.id)
                .map((m) => m.title)
                .join(" ")
            ).includes(search.trim())) &&
          (!activeRoute || activeRoute.placeIds.includes(p.id))
        );
      }),
    [filter, search, activeRoute, completedPlaces],
  );
  const collectionIds = useMemo(
    () => [
      ...new Set([
        ...game.progress.collectionIds,
        ...places
          .filter((p) => p.pilot && completedPlaces.includes(p.id))
          .map((p) => p.collectionId),
      ]),
    ],
    [game.progress.collectionIds, completedPlaces],
  );
  const allPilot = places.filter((p) => p.pilot);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  function closePanels() {
    setPanel(null);
    setSelectedPlace(null);
    setMission(null);
  }
  function openPanel(value: Panel) {
    closePanels();
    setPanel(value);
  }
  function openPlace(place: Place) {
    closePanels();
    setSelectedPlace(place);
  }
  function openMission(value: GameMission) {
    closePanels();
    setMission(value);
  }
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      if (message) setToast(message);
      return true;
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "작업을 마치지 못했어요. 다시 시도해 주세요.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function unlock(raw: string) {
    setScanError("");
    setBusy(true);
    try {
      const result = await game.unlockQr(raw);
      const found = gameMissions.find((m) => m.id === result.missionId);
      if (found) {
        setQrText("");
        openMission(found);
      }
    } catch (error) {
      setScanError(
        error instanceof Error ? error.message : "QR을 읽지 못했어요.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function scan() {
    openPanel("scan");
    setScanError("");
    if (!native) return;
    setBusy(true);
    try {
      await unlock(await scanMissionQr());
    } catch (error) {
      setScanError(
        error instanceof Error ? error.message : "카메라를 열지 못했어요.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function exportAll() {
    await run(async () => {
      const [travel, exploration] = await Promise.all([
        passportStorage.exportData(),
        game.exportData(),
      ]);
      await shareExplorationData({
        format: "bangucheon-explorer",
        version: 2,
        exportedAt: new Date().toISOString(),
        travel,
        exploration,
      });
    }, "기록 내보내기를 준비했어요.");
  }
  async function deleteRecords() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    if (
      await run(async () => {
        if (target === "all") {
          await game.clearAll();
          await passport.clearAll();
        } else {
          await game.deletePlaceRecords(target);
          await passport.deleteRecord(target);
        }
      }, "기록을 삭제했어요.")
    ) {
      setDeleteTarget(null);
      closePanels();
      setPanel("collection");
    }
  }
  return (
    <main className="explorer" id="main">
      <h1 className="sr-only">반구천 탐험지도</h1>
      <div className="map-stage" aria-label="네이버 탐험지도">
        <TourismMap
          places={filteredPlaces}
          selectedPlaceId={selectedPlace?.id ?? null}
          completedPlaceIds={completedPlaces}
          onSelect={openPlace}
          nativeMapHidden={Boolean(panel || selectedPlace || mission || reward || deleteTarget || busy)}
        />
      </div>
      <div className="map-top" data-native-map-inset="top">
        <div className="map-topline" data-native-map-occluder>
          <div className="mini-brand">
            <Whale size={27} />
            <span>반구천 탐험지도</span>
            <span className="beta-tag">BETA</span>
          </div>
          <button
            className="icon-button white"
            onClick={() => openPanel("settings")}
            aria-label="앱 안내 및 설정"
          >
            <Settings2 size={20} />
          </button>
        </div>
        <div className="search-row" data-native-map-occluder>
          <label className="search-box">
            <Search size={20} />
            <input
              aria-label="장소 또는 미션 검색"
              placeholder="어디로 탐험할까요?"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="검색 지우기">
                <X size={17} />
              </button>
            )}
          </label>
          <button
            className="level-button"
            onClick={() => openPanel("collection")}
            aria-label={"나의 수집함, 레벨 " + game.progress.level}
          >
            <Whale size={29} />
            <span>LV.{game.progress.level}</span>
          </button>
        </div>
        <div className="filter-row" aria-label="지도 장소 필터" data-native-map-occluder>
          {(
            [
              { id: "all", title: "전체", icon: MapPin },
              { id: "quiz", title: "QR 퀴즈", icon: QrCode },
              { id: "photo", title: "사진 미션", icon: Camera },
              { id: "done", title: "수집 완료", icon: Check },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              aria-pressed={filter === item.id}
              className={filter === item.id ? "selected" : ""}
              onClick={() => setFilter(item.id)}
            >
              <item.icon size={15} />
              {item.title}
            </button>
          ))}
          <button onClick={() => openPanel("routes")}>
            <Footprints size={15} />
            코스
          </button>
        </div>
        {activeRoute && (
          <div className="active-route" data-native-map-occluder>
            <Footprints size={14} />
            <span>{activeRoute.name}</span>
            <button
              disabled={busy}
              onClick={() =>
                run(() => passport.setRoute(null), "전체 장소를 표시해요.")
              }
              aria-label="코스 필터 해제"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
      <div className="map-side-actions" data-native-map-occluder>
        <button
          className="map-action camera-action"
          onClick={() => openPanel("photos")}
          aria-label="사진 미션 고르기"
        >
          <Telescope size={25} />
          <span>사진 미션</span>
        </button>
      </div>
      <section className="map-discovery" aria-label="지도에서 탐험할 장소" data-native-map-occluder data-native-map-inset="bottom">
        <div className="discovery-heading">
          <div>
            <span className="eyebrow">발견할수록 쌓이는 나의 모험</span>
            <h2>
              {search
                ? "검색한 장소"
                : filter === "done"
                  ? "나의 수집 장소"
                  : filter === "photo"
                    ? "바위그림을 사진으로 수집해요"
                    : "오늘의 발견을 시작해요"}
              <small>{filteredPlaces.length}</small>
            </h2>
          </div>
          <button className="text-button" onClick={() => openPanel("missions")}>
            미션 보기
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="place-rail">
          {filteredPlaces.map((p) => {
            const count = gameMissions.filter((m) => m.placeId === p.id).length;
            return (
              <button
                className="map-place-card"
                key={p.id}
                onClick={() => openPlace(p)}
              >
                <div className="map-place-image">
                  {p.image.endsWith(".svg") ? (
                    <span className="place-illustration">
                      <MapPin size={26} />
                    </span>
                  ) : (
                    <img src={p.image} alt={p.imageAlt} />
                  )}
                  <span
                    className={
                      completedPlaces.includes(p.id)
                        ? "place-state done"
                        : "place-state"
                    }
                  >
                    {completedPlaces.includes(p.id) ? (
                      <Check size={12} />
                    ) : p.category === "세계유산" ? (
                      <Sparkles size={12} />
                    ) : (
                      <MapPin size={12} />
                    )}
                  </span>
                </div>
                <span className="map-place-copy">
                  <small>{p.category}</small>
                  <strong>{p.shortName}</strong>
                  <span>
                    {count ? (
                      <>
                        <Gift size={12} />
                        {count}개 미션
                      </>
                    ) : (
                      "장소 안내"
                    )}
                  </span>
                </span>
                <ChevronRight size={16} />
              </button>
            );
          })}
          {!filteredPlaces.length && (
            <div className="empty-inline">
              <Search size={21} />
              <span>조건에 맞는 장소가 없어요.</span>
              <button
                onClick={() => {
                  setFilter("all");
                  setSearch("");
                  void run(() => passport.setRoute(null), "");
                }}
              >
                전체 장소 보기
              </button>
            </div>
          )}
        </div>
      </section>
      <nav className="map-nav" aria-label="주 메뉴" data-native-map-occluder data-native-map-inset="bottom">
        <button
          className={!panel && !selectedPlace && !mission ? "current" : ""}
          onClick={closePanels}
        >
          <Compass size={22} />
          <span>탐험지도</span>
        </button>
        <button className="scan-nav" onClick={scan} disabled={!ready || busy}>
          <span>
            <QrCode size={25} />
          </span>
          <b>QR 찍기</b>
        </button>
        <button
          className={panel === "collection" ? "current" : ""}
          onClick={() => openPanel("collection")}
        >
          <Stamp size={22} />
          <span>나의 수집함</span>
          {completedPlaces.length > 0 && <i>{completedPlaces.length}</i>}
        </button>
      </nav>
      {(game.error || passport.error) && (
        <div className="storage-error" role="alert" data-native-map-occluder>
          {game.error || passport.error}
        </div>
      )}
      {toast && (
        <div className="toast" role="status" data-native-map-occluder>
          <Info size={18} />
          {toast}
        </div>
      )}

      {selectedPlace && (
        <Sheet
          title="발견한 장소"
          onClose={() => setSelectedPlace(null)}
          className="place-sheet"
        >
          <div className="place-intro">
            <div className="place-intro-image">
              {selectedPlace.image.endsWith(".svg") ? (
                <MapPin size={36} />
              ) : (
                <img src={selectedPlace.image} alt={selectedPlace.imageAlt} />
              )}
            </div>
            <div>
              <span className="eyebrow">
                {selectedPlace.category} · {selectedPlace.zone}구역
              </span>
              <h3>{selectedPlace.shortName}</h3>
              <span className="small-status">
                {completedPlaces.includes(selectedPlace.id)
                  ? "스탬프 수집 완료"
                  : "새로운 발견이 기다려요"}
              </span>
            </div>
          </div>
          <p className="place-description">{selectedPlace.description}</p>
          <div className="action-pair">
            <External
              href={naverSearch(selectedPlace)}
              className="button secondary"
            >
              <Navigation size={17} />
              네이버 지도에서 찾기
            </External>
            <External
              href={selectedPlace.officialUrl}
              className="button secondary"
            >
              <BookOpen size={17} />
              공식 해설
            </External>
          </div>
          <div className="section-label">
            <h3>이곳의 미션</h3>
            <span>원하는 것만 즐겨요</span>
          </div>
          <div className="mission-list">
            {gameMissions
              .filter((m) => m.placeId === selectedPlace.id)
              .map((m) => (
                <MissionRow
                  key={m.id}
                  mission={m}
                  done={!!game.completions[m.id]}
                  unlocked={game.unlockedQuizIds.includes(m.id)}
                  onClick={() => openMission(m)}
                />
              ))}
            {!gameMissions.some((m) => m.placeId === selectedPlace.id) && (
              <p className="quiet-message">
                미션은 준비 중이에요. 장소를 둘러보고 기록을 남겨 보세요.
              </p>
            )}
          </div>
          <details className="place-more">
            <summary>
              관찰 포인트와 방문 안내
              <ChevronRight size={16} />
            </summary>
            <ul>
              {selectedPlace.observation.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
            <p>{selectedPlace.accessNote}</p>
            <p>
              지도 표시는 관광안내 대표 위치입니다. 안전한 관람 위치와 이동
              동선은 현장 안내를 확인해 주세요.
            </p>
            {selectedPlace.serviceIds.map((id) => {
              const s = services.find((s) => s.id === id);
              return s ? (
                <External key={id} href={s.url}>
                  {s.title}
                </External>
              ) : null;
            })}
          </details>
          {passport.ready && (
            <RecordEditor
              key={selectedPlace.id}
              place={selectedPlace}
              record={passport.records[selectedPlace.id]}
              disabled={busy}
              save={(note, photo) =>
                run(
                  () => passport.saveNote(selectedPlace.id, note, photo),
                  "나의 발견을 저장했어요.",
                )
              }
            />
          )}
          <button
            className="text-button visit-button"
            disabled={busy || !ready}
            onClick={() =>
              run(
                () => passport.markVisited(selectedPlace.id),
                "방문 기록을 남겼어요. 미션 스탬프는 별도로 모아요.",
              )
            }
          >
            <Footprints size={16} />
            {passport.records[selectedPlace.id]?.visitedAt
              ? "방문 기록 남김"
              : "방문 기록만 남기기"}
          </button>
          <PhotoCredit place={selectedPlace} />
          {(passport.records[selectedPlace.id] ||
            completedPlaces.includes(selectedPlace.id)) && (
            <button
              className="text-button danger"
              onClick={() => setDeleteTarget(selectedPlace.id)}
            >
              <Trash2 size={15} />이 장소의 기록 삭제
            </button>
          )}
        </Sheet>
      )}

      {(panel === "missions" || panel === "photos") && (
        <Sheet
          title={panel === "photos" ? "사진으로 수집해요" : "탐험 미션"}
          onClose={() => setPanel(null)}
        >
          <div className="quest-banner">
            <span className="quest-banner-icon">
              {panel === "photos" ? (
                <Telescope size={32} />
              ) : (
                <Sparkles size={31} />
              )}
            </span>
            <div>
              <span className="eyebrow">작은 발견이 모여 나의 모험이 돼요</span>
              <h3>
                {panel === "photos"
                  ? "망원경 너머, 어떤 그림이 보이나요?"
                  : "퀴즈를 풀고 바위그림을 모아요"}
              </h3>
              <p>
                {panel === "photos"
                  ? "사진 한 장과 관찰한 특징을 남기면 +120 XP"
                  : "QR 퀴즈 +80 XP · 사진 관찰 +120 XP"}
              </p>
            </div>
          </div>
          <div className="mission-list">
            {(panel === "photos" ? photoMissions : gameMissions).map((m) => (
              <MissionRow
                key={m.id}
                mission={m}
                done={!!game.completions[m.id]}
                unlocked={game.unlockedQuizIds.includes(m.id)}
                onClick={() => openMission(m)}
              />
            ))}
          </div>
          <p className="fine-print">
            모든 미션은 선택 사항이에요. 지도와 관광 안내는 미션 없이도 이용할
            수 있어요.
          </p>
        </Sheet>
      )}

      {panel === "scan" && (
        <Sheet title="QR로 퀴즈 열기" onClose={() => setPanel(null)}>
          <div className="scan-frame">
            <div className="scan-corners">
              <QrCode size={84} />
              <span className="scan-line" />
            </div>
            <h3>미션 QR을 비춰 주세요</h3>
            <p>
              장소의 퀴즈를 열고 정답을 맞히면
              <br />
              스탬프와 80 XP를 받아요.
            </p>
          </div>
          <button
            className="button full"
            disabled={!ready || busy}
            onClick={scan}
          >
            <Camera size={19} />
            {busy
              ? "QR을 확인하고 있어요…"
              : native
                ? "카메라로 QR 스캔"
                : "휴대폰 앱에서 카메라 스캔"}
          </button>
          {!native && (
            <p className="fine-print">
              개발 미리보기에서는 아래 코드를 입력하세요. 설치형 앱에서는
              카메라가 열립니다.
            </p>
          )}
          <div className="separator">
            <span>카메라를 사용할 수 없다면</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void unlock(qrText);
            }}
          >
            <label className="field-label" htmlFor="qr-code">
              미션 코드 입력
            </label>
            <div className="code-entry">
              <input
                id="qr-code"
                autoCapitalize="characters"
                autoCorrect="off"
                maxLength={200}
                placeholder="QR 아래의 코드를 입력하세요"
                value={qrText}
                onChange={(e) => setQrText(e.target.value)}
              />
              <button
                className="button"
                disabled={!qrText.trim() || busy || !ready}
              >
                열기
              </button>
            </div>
          </form>
          {scanError && (
            <p className="error-message" role="alert">
              {scanError}
            </p>
          )}
          <p className="fine-print">
            현재는 앱에서 발급한 체험용 QR을 사용해요. 기존 현장 QR과의 연결은
            확인 후 추가됩니다.
          </p>
          <button className="text-button" onClick={() => setPanel("qr-kit")}>
            체험용 QR 보기
            <ChevronRight size={16} />
          </button>
        </Sheet>
      )}

      {mission && (
        <MissionPanel
          key={mission.id}
          mission={mission}
          game={game}
          onClose={() => setMission(null)}
          onScan={scan}
          onDone={(completion, alreadyCompleted) => {
            setMission(null);
            if (alreadyCompleted)
              setToast("이미 수집한 미션이에요. 기존 기록을 유지했어요.");
            else setReward(completion);
          }}
        />
      )}

      {panel === "collection" && (
        <Sheet title="나의 수집함" onClose={() => setPanel(null)}>
          <div className="passport-card">
            <div className="passport-card-top">
              <span>BANGUCHEON EXPLORER</span>
              <Stamp size={23} />
            </div>
            <Whale size={80} />
            <span className="level-pill">LEVEL {game.progress.level}</span>
            <h3>{game.progress.levelName}</h3>
            <p>작은 발견들이 나만의 이야기가 돼요.</p>
            <div className="xp-line">
              <b>{game.progress.xp} XP</b>
              <span>
                {game.progress.nextLevelXp
                  ? game.progress.nextLevelXp + " XP에 다음 레벨"
                  : "최고 레벨 달성!"}
              </span>
            </div>
            <div className="xp-track">
              <span style={{ width: game.progress.levelProgress + "%" }} />
            </div>
          </div>
          <div className="stats">
            <div>
              <strong>
                {
                  completedPlaces.filter((id) =>
                    allPilot.some((p) => p.id === id),
                  ).length
                }
                <small>/6</small>
              </strong>
              <span>장소 스탬프</span>
            </div>
            <div>
              <strong>
                {game.progress.completedCount}
                <small>/9</small>
              </strong>
              <span>완료 미션</span>
            </div>
            <div>
              <strong>{game.progress.photoCount}</strong>
              <span>관찰 사진</span>
            </div>
          </div>
          <div className="section-label">
            <h3>나의 바위그림 도감</h3>
            <span>{collectionIds.length}개 수집</span>
          </div>
          <div className="collection-grid">
            {allPilot.map((p) => {
              const item = collectionItems.find((c) => c.id === p.collectionId);
              const earned =
                collectionIds.includes(p.collectionId) ||
                completedPlaces.includes(p.id);
              return (
                <button
                  key={p.id}
                  className={
                    "collection-cell " + (earned ? "earned" : "locked")
                  }
                  onClick={() => openPlace(p)}
                >
                  <span>
                    {p.id === "bangudae" || p.id === "museum" ? (
                      <Whale size={43} />
                    ) : p.id === "dinosaur" ? (
                      <Footprints size={32} />
                    ) : (
                      <Stamp size={32} />
                    )}
                  </span>
                  {earned && (
                    <i>
                      <Check size={11} />
                    </i>
                  )}
                  <strong>{item?.name ?? p.shortName}</strong>
                  <small>{earned ? "수집 완료" : "발견을 기다리는 중"}</small>
                </button>
              );
            })}
          </div>
          <div className="section-label">
            <h3>사진으로 남긴 발견</h3>
            <span>{game.progress.photoCount}장</span>
          </div>
          <div className="photo-journal">
            {Object.values(game.completions)
              .filter((c) => c.photo)
              .map((c) => (
                <PhotoMemory
                  key={c.missionId}
                  completion={c}
                  onOpen={() => {
                    const m = gameMissions.find((m) => m.id === c.missionId);
                    if (m) openMission(m);
                  }}
                />
              ))}
            {game.progress.photoCount === 0 && (
              <button
                className="photo-empty"
                onClick={() => setPanel("photos")}
              >
                <Camera size={27} />
                <span>첫 바위그림을 수집해 볼까요?</span>
                <b>
                  사진 미션 시작
                  <ArrowRight size={16} />
                </b>
              </button>
            )}
          </div>
          <div className="section-label">
            <h3>나의 여행 메모</h3>
          </div>
          {Object.values(passport.records)
            .filter((r) => r.note || r.photo || r.visitedAt)
            .map((r) => (
              <button
                key={r.placeId}
                className="memo-row"
                onClick={() => {
                  const p = places.find((p) => p.id === r.placeId);
                  if (p) openPlace(p);
                }}
              >
                <BookOpen size={19} />
                <span>
                  <strong>{placeName(r.placeId)}</strong>
                  <small>{r.note || "사진 또는 방문 기록"}</small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          {Object.keys(passport.records).length === 0 && (
            <p className="quiet-message">
              장소 카드에서 자유롭게 메모를 남길 수 있어요.
            </p>
          )}
          <p className="fine-print">
            이 앱에 저장되는 개인 기록이에요. 앱 삭제·기기 변경 전에 내보내
            주세요. 공식 방문 인증이나 실물 보상과는 별개입니다.
          </p>
          <button
            className="button secondary full"
            disabled={!ready || busy}
            onClick={exportAll}
          >
            <ArrowDownToLine size={18} />
            사진과 기록 내보내기
          </button>
          <button
            className="text-button danger centered"
            onClick={() => setDeleteTarget("all")}
            disabled={!ready || busy}
          >
            <Trash2 size={15} />
            전체 기록 삭제
          </button>
        </Sheet>
      )}

      {panel === "routes" && (
        <Sheet title="탐험 코스 고르기" onClose={() => setPanel(null)}>
          <p className="muted">
            코스를 고르면 지도와 장소 목록에 해당 장소만 보여요.
          </p>
          {routes.map((route) => (
            <div className="route-choice" key={route.id}>
              <span className="eyebrow">
                {route.active ? "추천 코스" : "확장 준비 중"}
              </span>
              <h3>{route.name}</h3>
              <p>{route.description}</p>
              <ol>
                {route.placeIds.map((id) => (
                  <li key={id}>{placeName(id)}</li>
                ))}
              </ol>
              <button
                className="button full"
                disabled={!route.active || !ready || busy}
                onClick={async () => {
                  if (
                    await run(
                      () => passport.setRoute(route.id),
                      "지도에서 코스를 둘러보세요.",
                    )
                  ) {
                    setPanel(null);
                    setFilter("all");
                    setSearch("");
                  }
                }}
              >
                <Footprints size={17} />
                {route.active ? "이 코스로 탐험하기" : "현장 확인 후 열려요"}
              </button>
            </div>
          ))}
          <p className="fine-print">
            방문 순서를 제안하는 코스입니다. 지정된 탐방로와 현장 안내를
            따라주세요.
          </p>
        </Sheet>
      )}

      {panel === "settings" && (
        <Sheet title="탐험 안내" onClose={() => setPanel(null)}>
          <div className="settings-brand">
            <Whale size={61} />
            <div>
              <h3>반구천 탐험여권</h3>
              <p>
                {native
                  ? "휴대폰 앱 · 지도에서 시작하는 작은 모험"
                  : "앱 개발 미리보기 · 지도에서 시작하는 작은 모험"}
              </p>
            </div>
          </div>
          <div className="how-it-works">
            <div>
              <MapPin />
              <span>
                <b>지도에서 장소 발견</b>장소를 누르면 미션과 안내가 열려요.
              </span>
            </div>
            <div>
              <QrCode />
              <span>
                <b>QR 찍고 퀴즈 풀기</b>정답을 맞히면 스탬프와 80 XP!
              </span>
            </div>
            <div>
              <Telescope />
              <span>
                <b>바위그림 관찰하고 사진 남기기</b>사진·관찰 기록으로 120 XP를
                모아요.
              </span>
            </div>
          </div>
          <button className="setting-row" onClick={() => setPanel("services")}>
            <BookOpen size={21} />
            <span>공식 해설 · 체험 · 교통 안내</span>
            <ChevronRight size={18} />
          </button>
          <button className="setting-row" onClick={() => setPanel("qr-kit")}>
            <QrCode size={21} />
            <span>체험용 QR · 운영 준비</span>
            <ChevronRight size={18} />
          </button>
          <details className="settings-details">
            <summary>네이버 지도 연결 방법</summary>
            <p>
              네이버 클라우드의 Maps에서 Web Dynamic Map을 신청한 뒤 공개용
              Client ID를 지도 화면의 ‘지도 연결’에 입력하세요. Client Secret은
              사용하지 않습니다.
            </p>
            <p>
              앱의 서비스 주소(iOS capacitor://localhost, Android
              https://localhost)와 개발 주소를 네이버 콘솔 가이드에 맞춰
              등록해야 합니다. 기기에서 인증을 확인해 주세요.
            </p>
            <External href="https://guide.ncloud-docs.com/docs/maps-app">
              네이버 Maps 발급 안내
            </External>
          </details>
          <details className="settings-details">
            <summary>기록과 권한</summary>
            <p>
              사진·메모·스탬프는 이 기기 앱 저장소에 남습니다. 사진은 서버로
              전송하지 않습니다. 카메라와 위치는 관련 버튼을 누를 때만
              요청합니다. 자동 이미지 인식, 현장 방문 또는 XR 이용 인증은
              제공하지 않습니다.
            </p>
            <p>
              기록 내보내기는 수집함에서 할 수 있으며, 가져오기·계정 동기화는
              아직 지원하지 않습니다. 네이버 지도는 온라인 연결이 필요합니다.
            </p>
          </details>
          <details className="settings-details">
            <summary>관광 정보와 사진 출처</summary>
            <p>
              장소별 공식 정보와 사진 출처는 각 장소 카드 하단에서 확인할 수
              있습니다. 지도 대표 위치는 안전 관람지점이나 출입구 좌표와 다를 수
              있습니다.
            </p>
            <External href="https://commons.wikimedia.org/wiki/File:Ulsan_Petroglyph_Museum5.jpg">
              사진: 울산암각화박물관 · CC BY-SA 3.0
            </External>
          </details>
        </Sheet>
      )}

      {panel === "services" && (
        <Sheet title="공식 안내" onClose={() => setPanel(null)}>
          <p className="muted">
            운영시간과 이용 가능 여부는 방문 당일 공식 안내에서 확인해 주세요.
          </p>
          {services.map((service) => (
            <External
              className="service-card"
              key={service.id}
              href={service.url}
            >
              <span>
                <small>{service.type}</small>
                <strong>{service.title}</strong>
                <p>{service.description}</p>
              </span>
            </External>
          ))}
        </Sheet>
      )}

      {panel === "qr-kit" && (
        <Sheet title="체험용 미션 QR" onClose={() => setPanel(null)}>
          <div className="notice">
            <Info size={20} />
            <span>
              {GAME_QR_NOTICE}
              <br />
              별도 화면이나 출력물의 QR을 앱으로 찍어 보세요.
            </span>
          </div>
          <div className="qr-kit">
            {quizMissions.map((m) => (
              <article key={m.id}>
                <img
                  src={"/qr/" + m.id + ".svg"}
                  alt={m.title + " 체험용 QR"}
                />
                <small>{placeName(m.placeId)}</small>
                <h3>{m.title}</h3>
                <code>{m.qrCode}</code>
                <button
                  className="button secondary small"
                  disabled={!ready || busy}
                  onClick={() => {
                    setQrText(m.qrCode);
                    setScanError("");
                    setPanel("scan");
                  }}
                >
                  이 코드로 체험하기
                </button>
              </article>
            ))}
          </div>
          <p className="fine-print">
            현장 부착 전 관리 주체의 승인과 QR 위치 확인이 필요합니다. 위 코드는
            앱 동작 확인용이며 공식 현장 QR을 대체하지 않습니다.
          </p>
        </Sheet>
      )}

      {reward && (
        <Sheet
          title="새로운 발견!"
          onClose={() => setReward(null)}
          className="reward-sheet"
        >
          <div className="reward-sparkles">
            <Sparkles />
            <Sparkles />
            <Sparkles />
          </div>
          <div className="reward-medal">
            <Whale size={87} />
            <i>
              <Check size={24} />
            </i>
          </div>
          <span className="eyebrow">MISSION COMPLETE</span>
          <h3>바위그림 하나를 모았어요!</h3>
          <p>
            {collectionItems.find((c) => c.id === reward.collectionId)?.name ??
              "나의 발견"}
          </p>
          <div className="xp-reward">
            +{reward.xp} <span>XP</span>
          </div>
          <p className="reward-subtitle">
            {game.progress.levelName} · 레벨 {game.progress.level}
          </p>
          <button
            className="button full"
            onClick={() => {
              setReward(null);
              openPanel("collection");
            }}
          >
            <Stamp size={19} />
            나의 수집함 보기
          </button>
          <button
            className="text-button centered"
            onClick={() => {
              setReward(null);
              closePanels();
            }}
          >
            지도에서 계속 탐험
            <ArrowRight size={17} />
          </button>
        </Sheet>
      )}

      {deleteTarget && (
        <Sheet title="기록 삭제" onClose={() => setDeleteTarget(null)}>
          <div className="delete-prompt">
            <Trash2 size={33} />
            <h3>
              {deleteTarget === "all"
                ? "모든 탐험 기록을 삭제할까요?"
                : placeName(deleteTarget) + " 기록을 삭제할까요?"}
            </h3>
            <p>
              사진·메모·방문 기록·미션과 XP가 삭제됩니다. 삭제한 기록은 복구할
              수 없어요. 필요한 기록을 먼저 내보내 주세요.
            </p>
            <div className="action-pair">
              <button
                className="button secondary"
                onClick={() => setDeleteTarget(null)}
              >
                취소
              </button>
              <button
                className="button destructive"
                disabled={busy}
                onClick={deleteRecords}
              >
                기록 삭제
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </main>
  );
}

function PhotoMemory({
  completion,
  onOpen,
}: {
  completion: GameCompletion;
  onOpen: () => void;
}) {
  const url = usePhotoUrl(completion.photo);
  return (
    <button className="photo-memory" onClick={onOpen}>
      {url && <img src={url} alt={completion.subject + " 관찰 사진"} />}
      <span>
        <strong>{completion.subject}</strong>
        <small>{placeName(completion.placeId)}</small>
      </span>
    </button>
  );
}
function RecordEditor({
  place,
  record,
  save,
  disabled,
}: {
  place: Place;
  record?: VisitRecord;
  save: (note: string, photo?: Blob | null) => Promise<boolean>;
  disabled: boolean;
}) {
  const [note, setNote] = useState(record?.note ?? "");
  const [photo, setPhoto] = useState<Blob | null | undefined>();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const native = useNative();
  const url = usePhotoUrl(photo === undefined ? record?.photo : photo);
  async function capture() {
    if (!native) {
      input.current?.click();
      return;
    }
    setWorking(true);
    setError("");
    try {
      setPhoto(await takeMissionPhoto());
    } catch (e) {
      setError(e instanceof Error ? e.message : "촬영을 마치지 못했어요.");
    } finally {
      setWorking(false);
    }
  }
  return (
    <details className="record-editor">
      <summary>
        <BookOpen size={18} />
        자유롭게 사진·메모 남기기
        <ChevronRight size={16} />
      </summary>
      <label className="field-label" htmlFor={"note-" + place.id}>
        나의 발견
      </label>
      <textarea
        id={"note-" + place.id}
        value={note}
        maxLength={5000}
        onChange={(e) => setNote(e.target.value)}
        placeholder="오늘 눈에 들어온 것은 무엇인가요?"
        rows={3}
      />
      {url && (
        <div className="record-photo">
          <img src={url} alt={place.shortName + " 기록 사진"} />
          <button
            className="icon-button"
            onClick={() => setPhoto(null)}
            aria-label="기록 사진 제거"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <input
        type="file"
        ref={input}
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        aria-label="여행 사진 선택"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setWorking(true);
          setError("");
          try {
            setPhoto(await compressPhoto(file));
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "사진을 준비하지 못했어요.",
            );
          } finally {
            setWorking(false);
            e.target.value = "";
          }
        }}
      />
      <div className="action-pair">
        <button
          className="button secondary"
          onClick={capture}
          disabled={working || disabled}
        >
          <Camera size={16} />
          {working ? "사진 준비 중" : url ? "사진 바꾸기" : "사진 추가"}
        </button>
        <button
          className="button"
          disabled={working || disabled}
          onClick={() => save(note, photo)}
        >
          <Check size={17} />
          기록 저장
        </button>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </details>
  );
}
