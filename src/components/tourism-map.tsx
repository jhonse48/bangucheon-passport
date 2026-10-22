"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import type { Coordinates, Place } from "../lib/types";
import {
  getVerifiedViewingPosition,
  isValidPosition,
  kakaoSearchUrl,
  loadKakaoSDK,
  searchUlsanPlaces,
} from "../lib/kakao";
import type {
  KakaoMap,
  KakaoMarker,
  KakaoPlaceResult,
  KakaoSDK,
} from "../lib/kakao";
import styles from "./tourism-map.module.css";

interface TourismMapProps {
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  activePlaceIds: string[];
  onOpenPlace: (id: string) => void;
}

const SESSION_KEY = "bangucheon:kakao-javascript-key";
const configuredKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY?.trim() ?? "";
function getStoredKey() {
  try {
    return sessionStorage.getItem(SESSION_KEY) || configuredKey;
  } catch {
    return configuredKey;
  }
}
function subscribeToStoredKey(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
const getServerKey = () => "";

function LocationIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3v3m0 12v3M3 12h3m12 0h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

export default function TourismMap({
  places,
  selectedId,
  onSelect,
  activePlaceIds,
  onOpenPlace,
}: TourismMapProps) {
  const storedKey = useSyncExternalStore(
    subscribeToStoredKey,
    getStoredKey,
    getServerKey,
  );
  const [overrideKey, setOverrideKey] = useState<string | null>(null);
  const apiKey = overrideKey ?? storedKey;
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [draftKey, setDraftKey] = useState("");
  const [sdk, setSdk] = useState<KakaoSDK | null>(null);
  const [status, setStatus] = useState<
    "missing" | "loading" | "ready" | "empty" | "error"
  >("missing");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<KakaoPlaceResult[]>([]);
  const [positionMessage, setPositionMessage] = useState("");
  const [viewMode, setViewMode] = useState<"place" | "location">("place");
  const [locating, setLocating] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const userMarkerRef = useRef<KakaoMarker | null>(null);
  const selectedCenterRef = useRef<Coordinates | null>(null);
  const locationRequestRef = useRef(0);
  const onSelectRef = useRef(onSelect);
  const selected = places.find((place) => place.id === selectedId) ?? places[0];
  const activeCount = places.filter((place) =>
    activePlaceIds.includes(place.id),
  ).length;

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    if (!apiKey) return;
    loadKakaoSDK(apiKey)
      .then((loaded) => {
        if (!cancelled) setSdk(loaded);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "지도 연결을 확인해 주세요.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, connectionAttempt]);

  useEffect(() => {
    if (!sdk || !canvasRef.current) return;
    let cancelled = false;
    const markers: { marker: KakaoMarker; click: () => void }[] = [];
    const verified = places.filter((place) =>
      getVerifiedViewingPosition(place),
    );

    async function renderMap() {
      if (!sdk || !canvasRef.current) return;
      setStatus("loading");
      setMessage("");
      setResults([]);
      setPositionMessage("");
      setLocating(false);
      selectedCenterRef.current = null;
      try {
        const selectedVerified = getVerifiedViewingPosition(selected);
        const found =
          selected && !selectedVerified
            ? await searchUlsanPlaces(sdk, selected.mapQuery)
            : [];
        if (cancelled) return;
        setResults(found);
        const center =
          selectedVerified ??
          (found[0]
            ? { lat: Number(found[0].y), lng: Number(found[0].x) }
            : null);
        if (!center) {
          setStatus("empty");
          setMessage(
            "이 장소의 지도 검색 결과를 찾지 못했어요. 장소 안내와 외부 지도 검색을 이용해 주세요.",
          );
          return;
        }
        const position = new sdk.maps.LatLng(center.lat, center.lng);
        selectedCenterRef.current = center;
        if (!mapRef.current)
          mapRef.current = new sdk.maps.Map(canvasRef.current, {
            center: position,
            level: 6,
          });
        else {
          mapRef.current.relayout();
          mapRef.current.panTo(position);
        }
        const map = mapRef.current;
        verified.forEach((place) => {
          const coords = place.viewingPosition!;
          const marker = new sdk.maps.Marker({
            map,
            position: new sdk.maps.LatLng(coords.lat, coords.lng),
            title: `${place.name} · 확인된 관람 위치`,
            zIndex: place.id === selected?.id ? 5 : 1,
          });
          const click = () => onSelectRef.current(place.id);
          sdk.maps.event.addListener(marker, "click", click);
          markers.push({ marker, click });
        });
        setViewMode("place");
        setStatus("ready");
      } catch (error: unknown) {
        if (!cancelled) {
          setStatus("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "지도 연결을 확인해 주세요.",
          );
        }
      }
    }
    void renderMap();
    return () => {
      cancelled = true;
      locationRequestRef.current += 1;
      userMarkerRef.current?.setMap(null);
      markers.forEach(({ marker, click }) => {
        sdk.maps.event.removeListener(marker, "click", click);
        marker.setMap(null);
      });
    };
  }, [sdk, places, selected, connectionAttempt]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver(() => mapRef.current?.relayout());
    observer.observe(canvasRef.current);
    return () => {
      observer.disconnect();
      userMarkerRef.current?.setMap(null);
    };
  }, []);

  function locateMe() {
    if (!sdk || !mapRef.current) return;
    if (!navigator.geolocation) {
      setPositionMessage(
        "이 브라우저에서는 현재 위치를 사용할 수 없어요. 장소 목록을 이용해 주세요.",
      );
      return;
    }
    setLocating(true);
    setPositionMessage("현재 위치를 확인하고 있어요…");
    const requestId = ++locationRequestRef.current;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestId !== locationRequestRef.current) return;
        setLocating(false);
        if (!mapRef.current) return;
        if (
          !isValidPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
        ) {
          setPositionMessage(
            "기기에서 유효한 위치를 받지 못했어요. 장소 목록을 이용해 주세요.",
          );
          return;
        }
        const current = new sdk.maps.LatLng(
          position.coords.latitude,
          position.coords.longitude,
        );
        userMarkerRef.current?.setMap(null);
        const label = document.createElement("div");
        label.className = styles.userLocation;
        label.textContent = "내 위치";
        label.setAttribute("aria-label", "현재 위치 · 기기 추정");
        userMarkerRef.current = new sdk.maps.CustomOverlay({
          map: mapRef.current,
          position: current,
          content: label,
          xAnchor: 0.5,
          yAnchor: 0,
          zIndex: 10,
        });
        mapRef.current.panTo(current);
        setViewMode("location");
        const accuracy = Number.isFinite(position.coords.accuracy)
          ? ` 기기 오차는 약 ${Math.round(position.coords.accuracy)}m입니다.`
          : "";
        setPositionMessage(
          `현재 위치를 표시했어요.${accuracy} 방문 인증에 사용하지 않습니다.`,
        );
      },
      (error) => {
        if (requestId !== locationRequestRef.current) return;
        setLocating(false);
        setPositionMessage(
          error.code === 1
            ? "위치 권한이 허용되지 않았어요. 장소 목록과 안내는 계속 이용할 수 있습니다."
            : "현재 위치를 확인하지 못했어요. 장소 목록과 안내를 이용해 주세요.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  function returnToPlace() {
    const center = selectedCenterRef.current;
    if (!sdk || !mapRef.current || !center) return;
    locationRequestRef.current += 1;
    setLocating(false);
    mapRef.current.panTo(new sdk.maps.LatLng(center.lat, center.lng));
    setViewMode("place");
    setPositionMessage("");
  }

  function applyKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextKey = draftKey.trim();
    if (!nextKey || /\s/.test(nextKey)) {
      setSettingsMessage("공백 없이 JavaScript 키를 입력해 주세요.");
      return;
    }
    let saved = true;
    try {
      sessionStorage.setItem(SESSION_KEY, nextKey);
    } catch {
      saved = false;
    }
    if (apiKey && apiKey !== nextKey) {
      if (saved) window.location.reload();
      else
        setSettingsMessage(
          "브라우저의 설정 저장 제한으로 키를 바꾸지 못했습니다. 탭 저장을 허용한 뒤 다시 시도해 주세요.",
        );
      return;
    }
    setStatus("loading");
    setOverrideKey(nextKey);
    setConnectionAttempt((attempt) => attempt + 1);
    setSettingsMessage(
      saved
        ? "이 브라우저 탭에 지도 연결을 적용했습니다."
        : "브라우저가 설정 저장을 제한하고 있습니다. 이 화면에서만 연결합니다.",
    );
  }

  function resetKey() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* Nothing persisted. */
    }
    window.location.reload();
  }

  const hasVerifiedSelection = Boolean(getVerifiedViewingPosition(selected));
  const isReady = status === "ready";
  const displayStatus =
    apiKey && !sdk && status === "missing" ? "loading" : status;

  return (
    <section className={styles.panel} aria-label="반구천 관광 지도">
      <div className={styles.viewport}>
        <div
          ref={canvasRef}
          className={styles.canvas}
          aria-label="카카오 지도"
          aria-hidden={!isReady}
        />
        {!isReady && (
          <div className={styles.illustration}>
            <span className={styles.eyebrow}>BANGUCHEON · ULSAN</span>
            <div className={styles.landscapeLabel}>
              <span>물길을 따라 만나는</span>
              <strong>오랜 시간의 풍경</strong>
            </div>
            <span className={styles.illustrationCaption}>
              반구천을 표현한 일러스트 · 실제 지도가 아닙니다
            </span>
          </div>
        )}
        <div className={styles.topline}>
          <span className={styles.statusPill}>
            <i />
            {isReady ? "카카오 지도" : "반구천 여행 안내"}
          </span>
          {activeCount > 0 && (
            <span className={styles.routePill}>선택 코스 {activeCount}곳</span>
          )}
        </div>
        {isReady && (
          <div className={styles.tools}>
            <button
              type="button"
              aria-label="지도 확대"
              onClick={() =>
                mapRef.current?.setLevel(
                  Math.max(1, mapRef.current.getLevel() - 1),
                )
              }
            >
              +
            </button>
            <button
              type="button"
              aria-label="지도 축소"
              onClick={() =>
                mapRef.current?.setLevel(
                  Math.min(14, mapRef.current.getLevel() + 1),
                )
              }
            >
              −
            </button>
            <button
              type="button"
              aria-label="내 위치 표시"
              title="내 위치 표시"
              disabled={locating}
              onClick={locateMe}
            >
              <LocationIcon />
            </button>
            {viewMode === "location" && (
              <button
                type="button"
                aria-label="선택 장소로 돌아가기"
                title="선택 장소로 돌아가기"
                onClick={returnToPlace}
              >
                ↩
              </button>
            )}
          </div>
        )}
        {!isReady && (
          <div className={styles.notice} role="status">
            <span className={styles.noticeIcon}>
              <LocationIcon />
            </span>
            <div>
              <strong>
                {displayStatus === "loading"
                  ? "지도를 불러오고 있어요"
                  : displayStatus === "error"
                    ? "지도 연결을 확인해 주세요"
                    : "위치 안내 준비 중"}
              </strong>
              <p>
                {message ||
                  "관람 위치를 확인하고 있어요. 먼저 장소의 이야기와 체험을 만나보세요."}
              </p>
            </div>
          </div>
        )}
        {isReady && (viewMode === "location" || !hasVerifiedSelection) && (
          <div className={styles.searchNotice}>
            {viewMode === "location"
              ? "현재 기기 위치를 표시했습니다. 선택한 장소로 돌아가려면 ↩ 버튼을 눌러 주세요."
              : `검색 기준: ${results[0]?.place_name ?? selected?.name ?? "선택 장소"}. 확인된 관람 지점과 도보 경로는 아직 제공하지 않습니다.`}
          </div>
        )}
      </div>

      {positionMessage && (
        <p className={styles.positionMessage} role="status">
          {positionMessage}
        </p>
      )}
      {selected && (
        <div className={styles.selectedCard}>
          <div className={styles.placeIndex}>
            {String(
              places.findIndex((place) => place.id === selected.id) + 1,
            ).padStart(2, "0")}
          </div>
          <div className={styles.placeSummary}>
            <span>{selected.category}</span>
            <strong>{selected.name}</strong>
            <p>
              {hasVerifiedSelection
                ? "공식 자료로 확인된 관람 위치"
                : "관람 위치 확인 필요"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenPlace(selected.id)}
            className={styles.detailButton}
          >
            장소 보기 <span aria-hidden="true">↗</span>
          </button>
        </div>
      )}
      <div className={styles.footer}>
        <span>
          <span className={styles.legendDot} />
          {isReady
            ? "관광지 마커는 확인된 관람 위치만 표시"
            : "장소 목록에서 자유롭게 둘러보세요"}
        </span>
        {selected && (
          <a
            href={kakaoSearchUrl(selected.mapQuery)}
            target="_blank"
            rel="noopener noreferrer"
          >
            카카오맵 검색 <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
      {results.length > 0 && (
        <details className={styles.searchResults}>
          <summary>
            카카오 검색 결과 {results.length}곳 · 관람 위치 미확인
          </summary>
          <ul>
            {results.map((result) => (
              <li key={result.id}>
                <a
                  href={kakaoSearchUrl(
                    `${result.address_name} ${result.place_name}`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {result.place_name}
                  <span aria-hidden="true"> ↗</span>
                </a>
                <span>{result.road_address_name || result.address_name}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className={styles.settings}>
        <summary>지도 연결 설정</summary>
        <form onSubmit={applyKey}>
          <label htmlFor="kakao-javascript-key">카카오 JavaScript 키</label>
          <p>
            배포 시 설정된 키가 없으면 이 탭에서 연결할 수 있습니다. 카카오
            개발자 설정에 현재 사이트 도메인을 등록해 주세요.
          </p>
          <div className={styles.keyInput}>
            <input
              id="kakao-javascript-key"
              type="password"
              value={draftKey}
              onChange={(event) => setDraftKey(event.target.value)}
              placeholder={
                configuredKey
                  ? "배포 환경에 키가 설정되어 있습니다"
                  : "JavaScript 키 입력"
              }
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit">연결</button>
          </div>
          <div className={styles.settingsLinks}>
            <a
              href="https://apis.map.kakao.com/web/guide/"
              target="_blank"
              rel="noopener noreferrer"
            >
              키 발급·도메인 설정 안내 ↗
            </a>
            <button type="button" onClick={resetKey}>
              이 탭의 키 지우기
            </button>
          </div>
          {settingsMessage && <p role="status">{settingsMessage}</p>}
        </form>
      </details>
    </section>
  );
}
