"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bus,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  ExternalLink,
  Footprints,
  Home,
  Info,
  Landmark,
  Leaf,
  Map,
  MapPin,
  Navigation,
  Search,
  Settings2,
  ShieldCheck,
  Stamp,
  Trash2,
  Trophy,
  Waves,
  X,
} from "lucide-react";
import {
  places,
  routes,
  missions,
  services,
  collectionItems,
} from "@/data/content";
import type {
  Category,
  CollectionItem,
  Mission,
  Place,
  TourRoute,
  VisitRecord,
} from "@/lib/types";
import { usePassport } from "@/lib/use-passport";
import {
  getEarnedCollectionIds,
  getRouteProgress,
  isPlaceStamped,
} from "@/lib/progress";
import { compressPhoto } from "@/lib/storage";
import TourismMap from "./tourism-map";

type Tab = "home" | "map" | "explore" | "passport";
const tabs = [
  { id: "home" as Tab, label: "홈", icon: Home },
  { id: "map" as Tab, label: "지도", icon: Map },
  { id: "explore" as Tab, label: "탐험", icon: Compass },
  { id: "passport" as Tab, label: "탐방 여권", icon: BookOpen },
];
const categories: ("전체" | Category)[] = [
  "전체",
  "세계유산",
  "역사문화",
  "자연·지질",
  "박물관·체험",
  "교통·편의",
];
const pilotPlaces = places.filter((p) => p.pilot);

function Whale({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="54"
      height="36"
      viewBox="0 0 70 44"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 24c0-10 9-17 22-16 9 1 13 7 16 14 8 0 14-6 17-13 3 10 0 17-5 20 4 3 5 8 3 12-6-1-12-7-16-11-7 8-23 8-31 2-4-2-6-4-6-8Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx="21" cy="19" r="1.8" fill="currentColor" />
      <path
        d="M29 10V4m0 0-4-2m4 2 4-3M5 33l-3 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
function CollectionIcon({
  symbol,
  size = 26,
}: {
  symbol: CollectionItem["symbol"];
  size?: number;
}) {
  if (symbol === "whale") return <Whale />;
  const Icon =
    symbol === "footprints"
      ? Footprints
      : symbol === "landmark"
        ? Landmark
        : symbol === "leaf"
          ? Leaf
          : BookOpen;
  return <Icon size={size} strokeWidth={1.5} />;
}
function External({
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
      <ExternalLink size={14} />
      <span className="sr-only"> (새 창)</span>
    </a>
  );
}
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-header">
          <span>{title}</span>
          <button className="icon-button" onClick={onClose} aria-label="닫기">
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
function PhotoCredit({ place }: { place?: Place }) {
  return (
    <small className="photo-credit">
      {place?.image.endsWith(".svg") ? (
        "관광 테마 일러스트 · 실제 위치와 다를 수 있습니다"
      ) : (
        <>
          <a
            href={
              place?.image === "/images/museum.jpg"
                ? "https://commons.wikimedia.org/wiki/File:Ulsan_Petroglyph_Museum5.jpg"
                : place?.image === "/images/petroglyphs.jpg"
                  ? "https://commons.wikimedia.org/wiki/File:Bangudae3.jpg"
                  : "https://commons.wikimedia.org/wiki/File:Bangudae2.jpg"
            }
            target="_blank"
            rel="noreferrer"
          >
            사진: 울산암각화박물관
          </a>{" "}
          ·{" "}
          <a
            href="https://creativecommons.org/licenses/by-sa/3.0/"
            target="_blank"
            rel="noreferrer"
          >
            CC BY-SA 3.0
          </a>{" "}
          · 화면에 맞게 잘라 표시
          {!place && (
            <>
              {" "}
              ·{" "}
              <a
                href="https://commons.wikimedia.org/wiki/File:Ulsan_Petroglyph_Museum5.jpg"
                target="_blank"
                rel="noreferrer"
              >
                박물관 사진
              </a>{" "}
              ·{" "}
              <a
                href="https://commons.wikimedia.org/wiki/File:Bangudae3.jpg"
                target="_blank"
                rel="noreferrer"
              >
                암각화 사진
              </a>
            </>
          )}
        </>
      )}
    </small>
  );
}
function RouteCard({
  route,
  onOpen,
}: {
  route: TourRoute;
  onOpen: () => void;
}) {
  return (
    <button className="route-card" onClick={onOpen}>
      <div className="route-photo">
        <img src={route.image} alt={route.name + " 관광 코스 풍경"} />
        <span className="image-pill">{route.theme}</span>
        <span className="round-arrow">
          <ArrowRight size={19} />
        </span>
      </div>
      <div className="route-body">
        <span className="eyebrow">
          {route.active ? "추천 탐방" : "확장 예정"}
        </span>
        <h3>{route.name}</h3>
        <p>{route.subtitle}</p>
        <div className="route-meta">
          <MapPin size={14} />
          {route.placeIds.length}개 장소<span>·</span>
          {route.active ? "자유롭게 둘러보기" : "현장 확인 필요"}
        </div>
      </div>
    </button>
  );
}
function PlaceCard({
  place,
  onOpen,
  stamped = false,
  visited = false,
}: {
  place: Place;
  onOpen: () => void;
  stamped?: boolean;
  visited?: boolean;
}) {
  return (
    <button className="place-card" onClick={onOpen}>
      <div className="place-thumb">
        <img src={place.image} alt={place.imageAlt} loading="lazy" />
        {stamped && (
          <span className="done-dot" aria-label="스탬프 획득">
            <Check size={14} />
          </span>
        )}
      </div>
      <div>
        <span className="eyebrow">
          {place.category} <span className="light">· {place.zone}구역</span>
        </span>
        <h3>{place.shortName}</h3>
        <p>{place.observation[0]}</p>
        <span className={place.pilot ? "place-label" : "place-label pending"}>
          {stamped
            ? "스탬프 획득"
            : visited
              ? "방문 기록됨"
              : place.pilot
                ? "탐험 가능"
                : "현장 확인 필요"}
        </span>
      </div>
      <ChevronRight size={18} className="light" />
    </button>
  );
}

export function PassportApp() {
  const passport = usePassport();
  const [tab, setTab] = useState<Tab>("home");
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<TourRoute | null>(null);
  const [showServices, setShowServices] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [category, setCategory] = useState<"전체" | Category>("전체");
  const [search, setSearch] = useState("");
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState("전체");
  const activeRoute = routes.find(
    (r) => r.id === passport.progress.activeRouteId,
  );
  const activeProgress = getRouteProgress(activeRoute, passport.records);
  const totalProgress = getRouteProgress(
    { placeIds: pilotPlaces.map((p) => p.id) },
    passport.records,
  );
  const stamped = pilotPlaces.filter((p) =>
    isPlaceStamped(p.id, passport.records),
  );
  const earnedIds = getEarnedCollectionIds(missions, passport.records);
  const filtered = useMemo(
    () =>
      places.filter(
        (p) =>
          (category === "전체" || p.category === category) &&
          (!search || `${p.name} ${p.description}`.includes(search)),
      ),
    [category, search],
  );
  const earned = collectionItems.filter((c) => earnedIds.includes(c.id));
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  const navigate = (next: Tab) => {
    setTab(next);
    setCategory("전체");
    setSearch("");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const perform = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      setToast(message);
      return true;
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "저장하지 못했습니다. 다시 시도해 주세요.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const startRoute = async (route: TourRoute) => {
    if (
      await perform(
        () => passport.setRoute(route.id),
        "탐방을 시작했어요. 나의 속도로 둘러보세요.",
      )
    ) {
      setSelectedRoute(null);
      navigate("explore");
    }
  };
  const openPlace = (id: string) => {
    const place = places.find((p) => p.id === id);
    if (place) setSelectedPlace(place);
  };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        본문으로 바로가기
      </a>
      <header className="site-header">
        <button
          className="brand"
          onClick={() => navigate("home")}
          aria-label="반구천 탐험여권 홈"
        >
          <span className="brand-mark">
            <Whale />
          </span>
          <span>
            <strong>반구천 탐험여권</strong>
            <small>BANGUCHEON EXPLORER</small>
          </span>
        </button>
        <nav className="desktop-nav" aria-label="주 메뉴">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => navigate(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
            >
              <t.icon size={17} />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="header-right">
          <span className="local-badge">
            <span />
            나의 작은 여행 기록
          </span>
          <button
            className="icon-button"
            aria-label="앱 안내 및 설정"
            onClick={() => setShowSettings(true)}
          >
            <Settings2 size={20} />
          </button>
        </div>
      </header>
      <main id="main">
        {passport.error && (
          <div className="error-banner" role="alert">
            <Info size={18} />
            {passport.error} 관광 안내는 계속 이용할 수 있습니다.
          </div>
        )}
        {tab === "home" && (
          <>
            <section className="hero">
              <img
                className="hero-image"
                src="/images/bangudae.jpg"
                alt="숲과 물길에 둘러싸인 반구대 암각화 경관"
                fetchPriority="high"
              />
              <div className="hero-shade" />
              <div className="hero-content">
                <span className="hero-kicker">
                  <span />
                  울산, 반구천에서 시작하는 작은 발견
                </span>
                <h1>
                  오래된 이야기를 만나,
                  <br />
                  나만의 여행을 남기다.
                </h1>
                <p>
                  바위에 새겨진 고래부터 숲길의 작은 흔적까지.
                  <br />
                  반구천을 천천히 탐험하고, 나만의 여권을 채워 보세요.
                </p>
                <div className="hero-actions">
                  <button
                    className="button cream"
                    onClick={() => {
                      setSelectedRoute(
                        activeRoute ??
                          routes.find((r) => r.active) ??
                          routes[0],
                      );
                    }}
                  >
                    {activeRoute ? "이어서 탐험하기" : "탐험 시작하기"}
                    <ArrowRight size={19} />
                  </button>
                  <button className="hero-link" onClick={() => navigate("map")}>
                    <Map size={18} />
                    지도로 먼저 둘러보기
                  </button>
                </div>
              </div>
              <div className="hero-caption">
                <MapPin size={14} />
                <span>울주 대곡리 반구대 암각화</span>
              </div>
              <div className="hero-stamp">
                <Waves size={23} />
                <span>자연 속에서 만나는</span>
                <strong>오래된 이야기</strong>
                <small>BANGUCHEON</small>
              </div>
            </section>
            <div className="home-layout">
              <div className="home-main">
                <section className="section">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">CHOOSE YOUR JOURNEY</span>
                      <h2>오늘은 어떤 길을 만나볼까요?</h2>
                      <p>
                        처음이라도 괜찮아요. 마음에 드는 탐방부터 시작하세요.
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("explore")}
                    >
                      전체 코스
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="route-grid">
                    {routes
                      .filter((r) => r.active)
                      .map((r) => (
                        <RouteCard
                          key={r.id}
                          route={r}
                          onOpen={() => setSelectedRoute(r)}
                        />
                      ))}
                  </div>
                  <p className="subtle-note">
                    <Info size={14} />
                    방문 순서는 탐방 제안입니다. 실제 이동은 현장 안내와 공식
                    교통 정보를 확인해 주세요.
                  </p>
                </section>
                <section className="journey-guide">
                  <div className="guide-illustration">
                    <Whale />
                    <span>발견의 즐거움</span>
                  </div>
                  <div>
                    <span className="eyebrow">여행의 순간을 모으는 방법</span>
                    <h3>보고, 발견하고, 기록해요.</h3>
                    <p>
                      짧은 관찰 미션을 즐기고 스탬프를 모아 보세요.
                      <br />
                      미션 없이 둘러보거나 방문 기록만 남겨도 좋아요.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => navigate("passport")}
                    >
                      나의 탐방 여권 보기
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="guide-steps">
                    <span>
                      <MapPin />
                      장소 발견
                    </span>
                    <span>
                      <Compass />
                      자유로운 탐험
                    </span>
                    <span>
                      <Stamp />
                      여권에 기록
                    </span>
                  </div>
                </section>
                <section className="section">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">LITTLE DISCOVERIES</span>
                      <h2>그냥 지나치기 아쉬운 곳</h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("map")}
                    >
                      모두 보기
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="place-grid">
                    {pilotPlaces.slice(0, 4).map((p) => (
                      <PlaceCard
                        key={p.id}
                        place={p}
                        onOpen={() => setSelectedPlace(p)}
                        stamped={isPlaceStamped(p.id, passport.records)}
                        visited={!!passport.records[p.id]?.visitedAt}
                      />
                    ))}
                  </div>
                </section>
              </div>
              <aside className="home-aside">
                <section className="passport-card">
                  <div className="passport-card-top">
                    <span>MY EXPLORER PASSPORT</span>
                    <BookOpen size={20} />
                  </div>
                  <Whale className="passport-whale" />
                  <h2>나의 탐방 여권</h2>
                  <p>오늘의 발견이, 나만의 이야기가 되도록.</p>
                  <div className="passport-stats">
                    <strong>
                      {totalProgress.completed}
                      <small> / {pilotPlaces.length}</small>
                    </strong>
                    <span>시범 관광지 탐방 기록</span>
                  </div>
                  <div className="progress-track">
                    <div style={{ width: totalProgress.percent + "%" }} />
                  </div>
                  <div className="mini-stamps">
                    {pilotPlaces.map((p) => (
                      <span
                        key={p.id}
                        title={p.shortName}
                        className={
                          isPlaceStamped(p.id, passport.records) ? "earned" : ""
                        }
                      >
                        {isPlaceStamped(p.id, passport.records) ? (
                          <Check size={17} />
                        ) : (
                          <Stamp size={17} />
                        )}
                      </span>
                    ))}
                  </div>
                  <button
                    className="passport-card-button"
                    onClick={() => navigate("passport")}
                  >
                    여권 펼쳐보기
                    <ArrowRight size={17} />
                  </button>
                </section>
                <section className="travel-info">
                  <span className="eyebrow">BEFORE YOU GO</span>
                  <h3>가볍게 준비하고 떠나요</h3>
                  {[
                    {
                      icon: Bus,
                      title: "주차 · 셔틀 안내",
                      sub: "공식 교통 정보 확인",
                    },
                    {
                      icon: BookOpen,
                      title: "해설 · 체험 안내",
                      sub: "QR 해설과 박물관 프로그램",
                    },
                    {
                      icon: ShieldCheck,
                      title: "안전한 탐방을 위해",
                      sub: "관람 위치와 현장 안내 확인",
                    },
                  ].map((item, i) => (
                    <button
                      key={item.title}
                      onClick={() =>
                        i === 2 ? setShowSettings(true) : setShowServices(true)
                      }
                    >
                      <span className="info-icon">
                        <item.icon size={19} />
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.sub}</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </section>
                <p className="aside-note">
                  <Leaf size={15} />
                  발자국은 가볍게,
                  <br />
                  여행의 기억은 오래도록.
                </p>
              </aside>
            </div>
          </>
        )}
        {tab === "map" && (
          <div className="page-container">
            <PageHeading
              eyebrow="EXPLORE THE AREA"
              title="발견은 가까운 곳에서"
              description="지도와 장소 목록으로 반구천의 이야기를 만나보세요."
            />
            <div className="map-layout">
              <div>
                <TourismMap
                  places={filtered}
                  selectedId={selectedMapId}
                  onSelect={setSelectedMapId}
                  activePlaceIds={activeRoute?.placeIds ?? []}
                  onOpenPlace={openPlace}
                />
                <button
                  className="transport-strip"
                  onClick={() => setShowServices(true)}
                >
                  <Bus size={20} />
                  <span>
                    <strong>주차 · 셔틀 정보</strong>
                    <small>출발 전 공식 운행 안내를 확인해 주세요.</small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              </div>
              <section className="map-list">
                <label className="search-box">
                  <Search size={18} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="장소나 이야기를 검색해 보세요"
                    aria-label="관광지 검색"
                  />
                </label>
                <div className="filters" aria-label="관광지 카테고리">
                  {categories.map((c) => (
                    <button
                      key={c}
                      aria-pressed={category === c}
                      className={category === c ? "active" : ""}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="list-heading">
                  <strong>
                    {category === "전체" ? "반구천의 장소" : category}
                    <span>{filtered.length}</span>
                  </strong>
                  <small>관람 위치는 현장 확인</small>
                </div>
                {filtered.length ? (
                  filtered.map((p) => (
                    <div
                      className={
                        selectedMapId === p.id
                          ? "map-place selected"
                          : "map-place"
                      }
                      key={p.id}
                    >
                      <PlaceCard
                        place={p}
                        onOpen={() => {
                          setSelectedMapId(p.id);
                          setSelectedPlace(p);
                        }}
                        stamped={isPlaceStamped(p.id, passport.records)}
                        visited={!!passport.records[p.id]?.visitedAt}
                      />
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <Search />
                    <h3>아직 등록된 장소가 없어요</h3>
                    <p>
                      {category === "교통·편의"
                        ? "주차장·셔틀은 아래 공식 안내에서 확인해 주세요."
                        : "검색어 또는 카테고리를 바꿔 보세요."}
                    </p>
                    {category === "교통·편의" && (
                      <button
                        className="button secondary"
                        onClick={() => setShowServices(true)}
                      >
                        공식 교통 안내
                      </button>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
        {tab === "explore" && (
          <div className="page-container">
            <PageHeading
              eyebrow="YOUR NEXT DISCOVERY"
              title="천천히, 나의 속도로 탐험"
              description="안내를 읽고 주변을 둘러보세요. 미션은 원할 때만 참여해도 좋아요."
            />
            {activeRoute && (
              <section className="active-route">
                <span className="active-route-icon">
                  <Compass size={32} />
                </span>
                <div>
                  <span className="eyebrow">지금 탐방 중</span>
                  <h2>{activeRoute.name}</h2>
                  <p>
                    {activeProgress.completed} / {activeProgress.total}곳 기록 ·{" "}
                    {activeProgress.isComplete
                      ? "이 코스의 탐방 기록을 완성했어요!"
                      : "다음 발견을 향해 이어가 볼까요?"}
                  </p>
                  <div className="progress-track">
                    <div style={{ width: activeProgress.percent + "%" }} />
                  </div>
                </div>
                <button
                  className="button"
                  onClick={() =>
                    activeProgress.nextPlaceId
                      ? openPlace(activeProgress.nextPlaceId)
                      : navigate("passport")
                  }
                >
                  {activeProgress.isComplete
                    ? "완주 기록 보기"
                    : "다음 장소 보기"}
                  <ArrowRight size={17} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => setSelectedRoute(activeRoute)}
                  aria-label="진행 중인 코스 상세"
                >
                  <Info size={20} />
                </button>
              </section>
            )}
            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>
                    {activeRoute
                      ? "코스에 담긴 이야기"
                      : "먼저, 마음에 드는 코스를 골라요"}
                  </h2>
                  <p>
                    {activeRoute
                      ? "각 장소의 안내와 선택 미션을 열어보세요."
                      : "두 개의 시범 탐방 코스로 반구천을 만나보세요."}
                  </p>
                </div>
                {activeRoute && (
                  <button
                    className="text-button"
                    onClick={() => setSelectedRoute(activeRoute)}
                  >
                    코스 상세
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
              {activeRoute ? (
                <div className="explore-grid">
                  {activeRoute.placeIds.map((id, index) => {
                    const p = places.find((p) => p.id === id)!;
                    return (
                      <article className="explore-card" key={id}>
                        <button onClick={() => setSelectedPlace(p)}>
                          <div className="explore-photo">
                            <img src={p.image} alt={p.imageAlt} />
                            <span className="step-number">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            {isPlaceStamped(id, passport.records) && (
                              <span className="image-pill">
                                <Check size={13} />
                                스탬프 획득
                              </span>
                            )}
                          </div>
                          <div className="explore-body">
                            <span className="eyebrow">{p.category}</span>
                            <h3>{p.shortName}</h3>
                            <p>{p.observation[0]}</p>
                            <span className="text-button">
                              이야기 만나기
                              <ArrowRight size={16} />
                            </span>
                          </div>
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="route-grid">
                  {routes
                    .filter((r) => r.active)
                    .map((r) => (
                      <RouteCard
                        key={r.id}
                        route={r}
                        onOpen={() => setSelectedRoute(r)}
                      />
                    ))}
                </div>
              )}
            </section>
            <section className="section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">MORE TO EXPLORE</span>
                  <h2>
                    {activeRoute
                      ? "다른 이야기도 만나보세요"
                      : "더 넓게 만나는 반구천"}
                  </h2>
                </div>
              </div>
              <div className="route-grid">
                {routes
                  .filter((r) =>
                    activeRoute ? r.id !== activeRoute.id : !r.active,
                  )
                  .map((r) => (
                    <RouteCard
                      key={r.id}
                      route={r}
                      onOpen={() => setSelectedRoute(r)}
                    />
                  ))}
              </div>
            </section>
          </div>
        )}
        {tab === "passport" && (
          <div className="page-container">
            <PageHeading
              eyebrow="MY EXPLORER PASSPORT"
              title="나만의 발견을 모은 여권"
              description="작은 관찰도 소중한 여행의 한 장면이 됩니다."
            />
            <div className="passport-overview">
              <div>
                <span className="eyebrow">반구천 탐방 기록</span>
                <h2>
                  {totalProgress.completed
                    ? "우리의 여행은 계속돼요."
                    : "첫 번째 이야기를 기다려요."}
                </h2>
                <p>
                  이 기기에 저장되는 나만의 여권 · 공식 방문 인증과는
                  별개입니다.
                </p>
                <div className="overview-stats">
                  <div>
                    <strong>
                      {totalProgress.completed}
                      <small> / 6</small>
                    </strong>
                    <span>탐방 기록</span>
                  </div>
                  <div>
                    <strong>{stamped.length}</strong>
                    <span>미션 스탬프</span>
                  </div>
                  <div>
                    <strong>{earned.length}</strong>
                    <span>수집 카드</span>
                  </div>
                </div>
                <div className="progress-track">
                  <div style={{ width: totalProgress.percent + "%" }} />
                </div>
              </div>
              <div className="passport-emblem">
                <Whale />
                <strong>반구천 탐험여권</strong>
                <span>MY LITTLE DISCOVERIES</span>
              </div>
            </div>
            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>발걸음마다 하나의 스탬프</h2>
                  <p>
                    관찰 미션을 완료하면 스탬프가 채워져요. 방문 체크는 별도로
                    남길 수 있어요.
                  </p>
                </div>
                <span className="count-pill">{stamped.length} / 6</span>
              </div>
              <div className="stamp-grid">
                {pilotPlaces.map((p) => {
                  const got = isPlaceStamped(p.id, passport.records);
                  const item = collectionItems.find(
                    (c) => c.id === p.collectionId,
                  );
                  return (
                    <button
                      className={`stamp-card ${got ? "earned" : ""}`}
                      key={p.id}
                      onClick={() => setSelectedPlace(p)}
                    >
                      <span className="stamp-circle">
                        {item ? (
                          <CollectionIcon symbol={item.symbol} />
                        ) : (
                          <Stamp size={28} />
                        )}
                        <span>{got ? "DISCOVERED" : "EXPLORE"}</span>
                      </span>
                      <strong>{p.shortName}</strong>
                      <small>
                        {got
                          ? "미션 스탬프"
                          : passport.records[p.id]?.visitedAt
                            ? "방문 체크 완료"
                            : "첫 발견을 기다려요"}
                      </small>
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>나의 발견 도감</h2>
                  <p>미션에서 만난 고래, 발자국, 그리고 오래된 이야기들.</p>
                </div>
              </div>
              <div className="filters">
                {["전체", "암각화", "공룡", "역사문화", "자연"].map((c) => (
                  <button
                    key={c}
                    className={c === collectionFilter ? "active" : ""}
                    aria-pressed={c === collectionFilter}
                    onClick={() => setCollectionFilter(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="collection-grid">
                {collectionItems
                  .filter(
                    (c) =>
                      collectionFilter === "전체" ||
                      c.category === collectionFilter,
                  )
                  .map((c) => (
                    <article
                      className={`collection-card ${earnedIds.includes(c.id) ? "unlocked" : ""}`}
                      key={c.id}
                    >
                      <div>
                        <CollectionIcon symbol={c.symbol} />
                        {earnedIds.includes(c.id) && <CheckCircle2 size={16} />}
                      </div>
                      <small>{c.category}</small>
                      <h3>{c.name}</h3>
                      <p>
                        {earnedIds.includes(c.id)
                          ? c.description
                          : missions.some((m) => m.collectionId === c.id)
                            ? "관련 미션을 완료해 수집해 보세요."
                            : c.description}
                      </p>
                    </article>
                  ))}
              </div>
            </section>
            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>다시 꺼내 보는 여행</h2>
                  <p>사진 한 장, 짧은 메모로 오늘을 기억해요.</p>
                </div>
              </div>
              {Object.values(passport.records).filter((r) => r.note || r.photo)
                .length ? (
                <div className="memories-grid">
                  {Object.values(passport.records)
                    .filter((r) => r.note || r.photo)
                    .map((r) => (
                      <MemoryCard
                        key={r.placeId}
                        record={r}
                        onOpen={() => openPlace(r.placeId)}
                      />
                    ))}
                </div>
              ) : (
                <div className="empty-state compact">
                  <Camera size={30} />
                  <h3>아직 남긴 이야기가 없어요</h3>
                  <p>장소 상세에서 사진과 메모를 저장해 보세요.</p>
                  <button
                    className="text-button"
                    onClick={() => navigate("explore")}
                  >
                    기록할 장소 찾기
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </section>
            <section className="badge-section">
              <Trophy size={32} />
              <div>
                <h3>한 걸음씩, 코스 완주 배지</h3>
                <p>
                  방문 체크 또는 미션으로 코스의 모든 장소를 기록하면 완주
                  배지를 받습니다.
                </p>
              </div>
              <div>
                {routes
                  .filter((r) => r.active)
                  .map((r) => (
                    <span
                      className={
                        getRouteProgress(r, passport.records).isComplete
                          ? "badge earned"
                          : "badge"
                      }
                      key={r.id}
                    >
                      <CheckCircle2 size={16} />
                      {r.name}
                    </span>
                  ))}
              </div>
            </section>
            <div className="record-actions">
              <p>
                <ShieldCheck size={16} />
                사진과 메모는 현재 브라우저에만 저장됩니다. 기기 변경·브라우저
                데이터 삭제 전 내보내기 해 주세요.
              </p>
              <button
                className="button secondary"
                disabled={busy || !passport.ready}
                onClick={() =>
                  perform(
                    passport.exportData,
                    "사진과 메모를 포함한 기록을 내보냈어요.",
                  )
                }
              >
                <ArrowDownToLine size={17} />
                기록 내보내기
              </button>
              <button
                className="text-button danger"
                disabled={busy || !passport.ready}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={16} />
                전체 기록 삭제
              </button>
            </div>
          </div>
        )}
      </main>
      <footer className="site-footer">
        <div>
          <Whale />
          <span>
            반구천 탐험여권<small>발견하는 즐거움, 기록하는 여행.</small>
          </span>
        </div>
        <p>
          관광 현장에서는 지정된 관람 위치와 공식 안내를 따라주세요.
          <br />
          <PhotoCredit />
        </p>
        <button className="text-button" onClick={() => setShowSettings(true)}>
          서비스 안내
          <ArrowRight size={14} />
        </button>
      </footer>
      <nav className="bottom-nav" aria-label="하단 메뉴">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => navigate(t.id)}
            className={tab === t.id ? "active" : ""}
            aria-current={tab === t.id ? "page" : undefined}
          >
            <t.icon size={21} />
            <span>{t.label}</span>
            {tab === t.id && <i />}
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {selectedRoute && (
        <Modal title="탐방 코스" onClose={() => setSelectedRoute(null)}>
          <img
            className="modal-cover"
            src={selectedRoute.image}
            alt={selectedRoute.name + " 코스 풍경"}
          />
          <div className="modal-content">
            <span className="eyebrow">{selectedRoute.theme}</span>
            <h2>{selectedRoute.name}</h2>
            <p>{selectedRoute.description}</p>
            <div className="notice">
              <Info size={18} />
              <span>
                콘텐츠를 둘러보는 추천 순서이며, 검증된 보행 경로가 아닙니다.
                거리와 소요시간은 확정하지 않았습니다.
              </span>
            </div>
            <ol className="route-stops">
              {selectedRoute.placeIds.map((id, i) => {
                const p = places.find((p) => p.id === id)!;
                return (
                  <li key={id}>
                    <span>{i + 1}</span>
                    <button
                      onClick={() => {
                        setSelectedRoute(null);
                        setSelectedPlace(p);
                      }}
                    >
                      <strong>{p.shortName}</strong>
                      <small>{p.pilot ? p.category : "현장 확인 필요"}</small>
                      <ChevronRight size={17} />
                    </button>
                  </li>
                );
              })}
            </ol>
            <button
              className="button full"
              disabled={!selectedRoute.active || busy || !passport.ready}
              onClick={() => startRoute(selectedRoute)}
            >
              {selectedRoute.active
                ? selectedRoute.id === activeRoute?.id
                  ? "이 코스 이어서 탐험하기"
                  : "이 코스로 탐험 시작"
                : "현장 확인 후 열릴 코스예요"}
              <ArrowRight size={17} />
            </button>
            <button
              className="text-button centered"
              onClick={() => {
                setSelectedRoute(null);
                setShowServices(true);
              }}
            >
              <Bus size={16} />
              주차·셔틀 공식 안내
            </button>
            <PhotoCredit />
          </div>
        </Modal>
      )}
      {selectedPlace && (
        <PlaceDetail
          place={selectedPlace}
          record={passport.records[selectedPlace.id]}
          onClose={() => setSelectedPlace(null)}
          passport={passport}
          perform={perform}
          busy={busy}
        />
      )}
      {showServices && (
        <Modal
          title="떠나기 전, 공식 안내"
          onClose={() => setShowServices(false)}
        >
          <div className="modal-content">
            <span className="eyebrow">PLAN YOUR VISIT</span>
            <h2>
              정보는 정확하게,
              <br />
              여행은 가볍게.
            </h2>
            <p>
              운행시간과 이용 가능 여부는 방문 당일 공식 안내에서 확인해 주세요.
            </p>
            <div className="service-list">
              {services.map((s) => (
                <External key={s.id} href={s.url} className="service-card">
                  <span className="info-icon">
                    {s.type === "교통" ? (
                      <Bus />
                    ) : s.type === "XR" ? (
                      <Search />
                    ) : (
                      <BookOpen />
                    )}
                  </span>
                  <span>
                    <small>{s.type}</small>
                    <h3>{s.title}</h3>
                    <p>{s.description}</p>
                  </span>
                </External>
              ))}
            </div>
            <div className="notice">
              <Info size={17} />
              <span>
                공식 페이지 연결은 예약 완료나 QR 해설·XR 실제 이용 인증을
                의미하지 않습니다.
              </span>
            </div>
          </div>
        </Modal>
      )}
      {showSettings && (
        <Modal
          title="반구천 탐험여권 안내"
          onClose={() => setShowSettings(false)}
        >
          <div className="modal-content settings-content">
            <Whale />
            <h2>
              발견하는 즐거움,
              <br />
              기록하는 여행.
            </h2>
            <p>반구천의 문화유산과 자연을 연결하는 시범 관광 서비스입니다.</p>
            <h3>안전하게 둘러보기</h3>
            <p>
              앱의 코스는 콘텐츠 방문 제안입니다. 지정 탐방로를 이용하고,
              암면·하천·보호구역에 접근하지 마세요. 안전한 관람 좌표를 확인하지
              못한 지점은 지도의 목적지 핀으로 표시하지 않습니다.
            </p>
            <h3>나의 기록과 개인정보</h3>
            <p>
              가입 없이 사용합니다. 사진·메모·진행 상황은 이 브라우저의
              저장소에만 남습니다. 위치는 지도에서 ‘현재 위치’ 버튼을 눌렀을
              때만 요청하며 저장하지 않습니다. 브라우저 데이터 삭제 시 기록도
              삭제됩니다.
            </p>
            <h3>지도 설정</h3>
            <p>
              지도 화면의 설정에서 Kakao JavaScript 키를 넣을 수 있습니다. 키가
              없어도 장소 목록, 공식 안내, 외부 지도 검색과 모든 미션을 이용할
              수 있습니다.
            </p>
            <h3>알아두세요</h3>
            <p>
              방문 체크는 자기 기록이며, 미션 스탬프도 공식 방문·XR 이용 인증이
              아닙니다. 최신 운영시간·셔틀 운행과 관람 가능 여부는 공식 안내를
              확인해 주세요.
            </p>
            <h3>사진 출처</h3>
            <PhotoCredit />
            <p>
              장소별 정확한 사진 출처는 상세 화면 하단에 표시합니다. 일러스트가
              사용된 곳은 실제 관광지 사진과 구분합니다.
            </p>
            <button
              className="button full"
              onClick={() => {
                setShowSettings(false);
                navigate("map");
              }}
            >
              지도와 장소 둘러보기
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {confirmDelete && (
        <Modal title="전체 기록 삭제" onClose={() => setConfirmDelete(false)}>
          <div className="modal-content">
            <Trash2 size={32} />
            <h2>여행 기록을 모두 삭제할까요?</h2>
            <p>
              이 브라우저에 저장한 사진, 메모, 방문 체크, 스탬프와 진행 코스가
              삭제됩니다. 삭제 후에는 복구할 수 없으니 필요한 기록을 먼저
              내보내세요.
            </p>
            <div className="action-row">
              <button
                className="button secondary"
                onClick={() => setConfirmDelete(false)}
              >
                취소
              </button>
              <button
                className="button destructive"
                disabled={busy}
                onClick={async () => {
                  if (
                    await perform(
                      passport.clearAll,
                      "저장된 탐방 기록을 모두 삭제했습니다.",
                    )
                  )
                    setConfirmDelete(false);
                }}
              >
                전체 기록 삭제
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
function useBlobUrl(blob?: Blob | null) {
  const url = useMemo(
    () => (blob ? URL.createObjectURL(blob) : undefined),
    [blob],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}
function MemoryCard({
  record,
  onOpen,
}: {
  record: VisitRecord;
  onOpen: () => void;
}) {
  const url = useBlobUrl(record.photo);
  const place = places.find((p) => p.id === record.placeId);
  return (
    <button className="memory-card" onClick={onOpen}>
      {url ? (
        <img src={url} alt={place?.shortName + "에 남긴 나의 사진"} />
      ) : (
        <div className="memory-placeholder">
          <BookOpen size={28} />
        </div>
      )}
      <div>
        <span className="eyebrow">{place?.shortName}</span>
        <p>{record.note || "사진으로 남긴 오늘의 발견"}</p>
        <small>
          {new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(
            new Date(record.updatedAt),
          )}
        </small>
      </div>
    </button>
  );
}
type Passport = ReturnType<typeof usePassport>;
type Perform = (
  action: () => Promise<unknown>,
  message: string,
) => Promise<boolean>;
function PlaceDetail({
  place,
  record,
  onClose,
  passport,
  perform,
  busy,
}: {
  place: Place;
  record?: VisitRecord;
  onClose: () => void;
  passport: Passport;
  perform: Perform;
  busy: boolean;
}) {
  const [mission, setMission] = useState<Mission | null>(null);
  const [deleting, setDeleting] = useState(false);
  const placeMissions = missions.filter((m) => m.placeId === place.id);
  if (mission)
    return (
      <Modal title="오늘의 작은 발견" onClose={onClose}>
        <MissionView
          mission={mission}
          completed={record?.completedMissionIds.includes(mission.id) ?? false}
          hasSavedRecord={!!(record?.note.trim() || record?.photo)}
          onBack={() => setMission(null)}
          onComplete={(observation) =>
            perform(async () => {
              if (mission.type === "기록형" && observation?.trim()) {
                await passport.saveNote(
                  place.id,
                  [
                    record?.note,
                    "[" + mission.title + "] " + observation.trim(),
                  ]
                    .filter(Boolean)
                    .join("\n\n"),
                );
              }
              await passport.completeMission(place.id, mission.id);
            }, "발견을 기록했어요. 여권에 스탬프가 채워졌습니다!")
          }
          busy={busy}
        />
      </Modal>
    );
  return (
    <Modal title="장소 이야기" onClose={onClose}>
      <img className="modal-cover" src={place.image} alt={place.imageAlt} />
      <div className="modal-content">
        <span className="eyebrow">
          {place.category} · {place.zone}구역
        </span>
        <h2>{place.name}</h2>
        <p>{place.description}</p>
        <div className="action-row">
          <External href={place.officialUrl} className="button secondary">
            <BookOpen size={17} />
            공식 안내·해설
          </External>
          <External
            href={
              "https://map.kakao.com/link/search/" +
              encodeURIComponent(place.mapQuery)
            }
            className="button secondary"
          >
            <Navigation size={17} />
            외부 지도에서 찾기
          </External>
        </div>
        <div className="notice">
          <MapPin size={18} />
          <span>
            {place.accessNote} 외부 지도에서는 지정 관람 위치를 확인한 후
            길찾기를 선택하세요.
          </span>
        </div>
        <h3 className="detail-heading">
          <Search size={19} />
          이곳에서 발견해 보세요
        </h3>
        <ul className="observations">
          {place.observation.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
        {place.serviceIds.length > 0 && (
          <div className="detail-services">
            {services
              .filter((s) => place.serviceIds.includes(s.id))
              .map((s) => (
                <External key={s.id} href={s.url}>
                  <span>
                    <strong>{s.title}</strong>
                    <small>{s.description}</small>
                  </span>
                </External>
              ))}
          </div>
        )}
        <div className="detail-heading">
          <h3>
            <Compass size={19} />
            짧은 관찰, 작은 발견
          </h3>
          <span className="count-pill">선택 미션</span>
        </div>
        {placeMissions.length ? (
          placeMissions.map((m) => (
            <button
              key={m.id}
              className="mission-card"
              disabled={!passport.ready}
              onClick={() => setMission(m)}
            >
              <span className="mission-icon">
                {record?.completedMissionIds.includes(m.id) ? (
                  <CheckCircle2 size={24} />
                ) : (
                  <Compass size={24} />
                )}
              </span>
              <span>
                <small>{m.type}</small>
                <strong>{m.title}</strong>
              </span>
              <ChevronRight size={18} />
            </button>
          ))
        ) : (
          <p className="muted">
            이 장소의 미션은 현장 정보를 확인한 뒤 열릴 예정이에요.
          </p>
        )}
        <button
          className="manual-visit"
          disabled={busy || !passport.ready || !!record?.visitedAt}
          onClick={() =>
            perform(
              () => passport.markVisited(place.id),
              "방문 체크를 저장했어요. 공식 인증과는 별개의 나의 기록입니다.",
            )
          }
        >
          <CheckCircle2 size={18} />
          {record?.visitedAt
            ? "방문 체크 완료 · 나의 기록"
            : "미션 없이 방문 체크하기"}
          <small>자기 기록</small>
        </button>
        {passport.ready && (
          <RecordEditor
            key={place.id}
            place={place}
            record={record}
            save={async (note, photo) =>
              perform(
                () => passport.saveNote(place.id, note, photo),
                "사진과 메모를 이 기기에 저장했어요.",
              )
            }
            disabled={busy || !passport.ready}
          />
        )}
        {record && (
          <div className="delete-record">
            {deleting ? (
              <div>
                <p>이 장소의 사진·메모·방문·스탬프를 모두 삭제할까요?</p>
                <div className="action-row">
                  <button
                    className="button secondary"
                    onClick={() => setDeleting(false)}
                  >
                    취소
                  </button>
                  <button
                    className="button destructive"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await perform(
                          () => passport.deleteRecord(place.id),
                          "이 장소의 탐방 기록을 삭제했습니다.",
                        )
                      )
                        onClose();
                    }}
                  >
                    이 장소 기록 삭제
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="text-button danger"
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={15} />이 장소 기록 삭제
              </button>
            )}
          </div>
        )}
        <details className="source-details">
          <summary>정보 및 사진 출처</summary>
          <p>{place.imageCredit}</p>
          <PhotoCredit place={place} />
          {place.sources.map((s) => (
            <External href={s.url} key={s.url}>
              <span>
                {s.title}
                <small>자료 확인 {s.checkedAt}</small>
              </span>
            </External>
          ))}
        </details>
      </div>
    </Modal>
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
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [saved, setSaved] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const url = useBlobUrl(photo === undefined ? record?.photo : photo);
  return (
    <section className="record-editor">
      <h3>
        <Camera size={19} />
        오늘의 장면 남기기
      </h3>
      <p>사진과 메모는 현재 브라우저에만 저장돼요.</p>
      <textarea
        aria-label="여행 메모"
        maxLength={5000}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
        placeholder="눈에 들어온 풍경, 새롭게 알게 된 이야기…"
        rows={4}
      />
      <div className="photo-editor">
        {url && (
          <div className="photo-preview">
            <img src={url} alt={place.shortName + " 나의 기록 사진"} />
            <button
              aria-label="사진 제거"
              className="icon-button"
              onClick={() => {
                setPhoto(null);
                setSaved(false);
              }}
            >
              <X size={18} />
            </button>
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="여행 사진 선택"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setProcessing(true);
            setError("");
            setSaved(false);
            try {
              setPhoto(await compressPhoto(file));
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "사진을 처리하지 못했습니다.",
              );
            } finally {
              setProcessing(false);
              e.target.value = "";
            }
          }}
        />
        <button
          className="button secondary small"
          onClick={() => input.current?.click()}
          disabled={processing || disabled}
        >
          <Camera size={16} />
          {processing ? "사진 준비 중…" : url ? "사진 바꾸기" : "사진 추가"}
        </button>
        <small>JPG · PNG · WebP / 장소당 1장</small>
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <button
        className="button full"
        disabled={disabled || processing}
        onClick={async () => {
          if (await save(note, photo)) setSaved(true);
        }}
      >
        <Check size={17} />
        {saved ? "저장 완료" : "기록 저장"}
      </button>
    </section>
  );
}
function MissionView({
  mission,
  completed,
  hasSavedRecord,
  onBack,
  onComplete,
  busy,
}: {
  mission: Mission;
  completed: boolean;
  hasSavedRecord: boolean;
  onBack: () => void;
  onComplete: (observation?: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [answer, setAnswer] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [observation, setObservation] = useState("");
  const collection = collectionItems.find((c) => c.id === mission.collectionId);
  return (
    <div className="modal-content mission-view">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={16} />
        장소 이야기로
      </button>
      <span className="mission-type">
        <Compass size={16} />
        {mission.type}
      </span>
      <h2>{mission.title}</h2>
      <p>{mission.instruction}</p>
      {completed ? (
        <div className="mission-success">
          <div className="stamp-circle earned">
            {collection ? (
              <CollectionIcon symbol={collection.symbol} />
            ) : (
              <Stamp size={34} />
            )}
            <span>DISCOVERED</span>
          </div>
          <h3>하나의 발견이 여권에 담겼어요!</h3>
          <p>{collection?.name} 카드와 탐방 스탬프를 받았습니다.</p>
          <p>{mission.explanation}</p>
          <button className="button full" onClick={onBack}>
            장소로 돌아가기
            <ArrowRight size={16} />
          </button>
          <small>미션 완료 기록이며 공식 방문·시설 이용 인증은 아닙니다.</small>
        </div>
      ) : (
        <>
          <h3>{mission.question}</h3>
          {mission.options ? (
            <div
              className="answer-list"
              role="radiogroup"
              aria-label="미션 정답 선택"
            >
              {mission.options.map((option, i) => (
                <button
                  key={option}
                  role="radio"
                  aria-checked={answer === i}
                  onClick={() => {
                    setAnswer(i);
                    setFeedback("");
                  }}
                  className={answer === i ? "selected" : ""}
                >
                  <span>{i + 1}</span>
                  {option}
                  {answer === i && <Check size={17} />}
                </button>
              ))}
            </div>
          ) : (
            <textarea
              maxLength={1000}
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="발견한 특징을 짧게 적어 보세요"
              aria-label="관찰한 특징"
              rows={4}
            />
          )}
          <p role="status" className="mission-feedback">
            {feedback ||
              (!mission.options && hasSavedRecord
                ? "이미 저장한 사진·메모로도 이 미션을 완료할 수 있어요."
                : "")}
          </p>
          <button
            className="button full"
            disabled={
              busy ||
              (mission.options
                ? answer === null
                : !observation.trim() && !hasSavedRecord)
            }
            onClick={async () => {
              if (mission.options && answer !== mission.correctIndex) {
                setFeedback(
                  "조금 더 관찰해 볼까요? 공식 안내와 주변 풍경을 살펴보고 다시 골라 보세요.",
                );
                return;
              }
              await onComplete(observation);
            }}
          >
            발견 기록하고 스탬프 받기
            <Stamp size={17} />
          </button>
          <button className="text-button centered" onClick={onBack}>
            미션은 다음에 할게요
          </button>
        </>
      )}
    </div>
  );
}
