"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  QrCode,
  Sparkles,
  Telescope,
  X,
} from "lucide-react";
import { places, collectionItems } from "@/data/content";
import { QrSiteInfo } from "./qr-site-info";
import type {
  GameCompletion,
  GameMission,
  PhotoGameMission,
  QuizGameMission,
} from "@/lib/game";
import type { useGame } from "@/lib/use-game";
import { takeMissionPhoto } from "@/lib/native-device";
import { compressPhoto } from "@/lib/storage";
import { External, Sheet, Whale, useNative, usePhotoUrl } from "./passport-app";

type Game = ReturnType<typeof useGame>;
type Props = {
  mission: GameMission;
  game: Game;
  onClose: () => void;
  onScan: () => void;
  onDone: (completion: GameCompletion, alreadyCompleted: boolean) => void;
  onPreparePhotoCapture?: () => Promise<((photo: Blob, withLocation: boolean) => Promise<void>) | undefined>;
};
export function MissionPanel({
  mission,
  game,
  onClose,
  onScan,
  onDone,
  onPreparePhotoCapture,
}: Props) {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const finish: Props["onDone"] = (result, alreadyCompleted) => {
    if (active.current) onDone(result, alreadyCompleted);
  };
  const completion = game.completions[mission.id];
  const place = places.find((p) => p.id === mission.placeId)!;
  if (completion)
    return (
      <Sheet title="수집한 발견" onClose={onClose}>
        <CompletedMission completion={completion} mission={mission} />
        <button className="button full" onClick={onClose}>
          <ArrowLeft size={17} />
          지도로 돌아가기
        </button>
      </Sheet>
    );
  return (
    <Sheet
      title={mission.kind === "quiz" ? "QR 퀴즈" : "사진 관찰 미션"}
      onClose={onClose}
      className="mission-sheet"
    >
      <div className="mission-heading">
        <span className={"mission-symbol " + mission.kind}>
          {mission.kind === "quiz" ? (
            <QrCode size={28} />
          ) : (
            <Telescope size={29} />
          )}
        </span>
        <span>
          <small>{place.shortName}</small>
          <h3>{mission.title}</h3>
        </span>
        <b>
          +{mission.xp}
          <small>XP</small>
        </b>
      </div>
      <div className="field-mission-plan">
        {!place.image.endsWith(".svg") && <img src={place.image} alt={place.imageAlt} />}
        <p className="mission-instruction">{mission.instruction}</p>
        <ol>{mission.steps.map((step, index) => <li key={step}><b>{index + 1}</b><span>{step}</span></li>)}</ol>
        <p className="field-observation-tip"><Telescope size={17} />{mission.observationHint}</p>
        <div className="field-reward"><Sparkles size={19} /><span>완료하면 <strong>{collectionItems.find((item) => item.id === mission.collectionId)?.name} 카드</strong>와 장소 스탬프 · {mission.xp} XP</span></div>
      </div>
      <QrSiteInfo placeId={place.id} />
      {mission.kind === "quiz" ? (
        <QuizQuest
          mission={mission}
          game={game}
          onScan={onScan}
          onDone={finish}
        />
      ) : (
        <PhotoQuest mission={mission} game={game} onDone={finish} onPreparePhotoCapture={onPreparePhotoCapture} />
      )}
    </Sheet>
  );
}
function QuizQuest({
  mission,
  game,
  onScan,
  onDone,
}: {
  mission: QuizGameMission;
  game: Game;
  onScan: () => void;
  onDone: Props["onDone"];
}) {
  const [answer, setAnswer] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [guideRead, setGuideRead] = useState(false);
  const place = places.find((p) => p.id === mission.placeId)!;
  const unlocked = game.unlockedQuizIds.includes(mission.id);
  async function startFromGuide() {
    if (!guideRead) return;
    setBusy(true);
    setError("");
    try { await game.confirmGuide(mission.id); }
    catch (e) { setError(e instanceof Error ? e.message : "미션을 열지 못했어요."); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (answer === null) return;
    setBusy(true);
    setError("");
    try {
      const result = await game.completeQuiz(mission.id, answer);
      onDone(result.completion, result.alreadyCompleted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  if (!unlocked)
    return (
      <div className="locked-quest">
        <h3>해설을 읽고 관찰을 시작해요</h3>
        <p>현장 QR로 해설을 보셨다면 이 장소의 미션을 이어가세요. QR을 찾지 못했다면 아래 공식 해설을 이용할 수 있어요.</p>
        <div className="reward-preview">
          <Whale size={43} />
          <span>
            <strong>{collectionItems.find((item) => item.id === mission.collectionId)?.name} 카드</strong>
            <small>스탬프 + 80 XP</small>
          </span>
          <Sparkles size={21} />
        </div>
        <External href={place.officialUrl} className="text-button centered">
          공식 해설 보기
        </External>
        <label className="guide-confirmation"><input type="checkbox" checked={guideRead} onChange={(e) => setGuideRead(e.target.checked)} disabled={busy} /><span>이 장소의 현장 또는 공식 해설을 확인했어요</span></label>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="button full" onClick={startFromGuide} disabled={!game.ready || !guideRead || busy}>{busy ? "미션을 여는 중…" : "관찰 문제 풀기"}<ChevronRight size={18} /></button>
        <button className="text-button centered" onClick={onScan} disabled={!game.ready || busy}><QrCode size={18} />앱 체험용 QR로 열기</button>
        <p className="fine-print">장소를 직접 골라 시작하는 방식이에요. 현장 QR 자동 연결·방문 인증과는 별개입니다.</p>
      </div>
    );
  return (
    <div className="quiz-quest">
      <div className="unlocked-banner">
        <CheckCircle2 size={17} />
        퀴즈가 열렸어요 · 차근차근 관찰해 보세요
      </div>
      <div className="question-heading">
        <span>Q.</span>
        <h3>{mission.question}</h3>
      </div>
      <div className="quiz-answers">
        {mission.options.map((option, i) => (
          <button
            key={option}
            aria-pressed={answer === i}
            className={answer === i ? "selected" : ""}
            onClick={() => {
              setAnswer(i);
              setError("");
            }}
            disabled={busy}
          >
            <span>{String.fromCharCode(65 + i)}</span>
            <strong>{option}</strong>
            {answer === i && <Check size={18} />}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="error-message">
          <CircleHelp size={19} />
          {error}
        </p>
      )}
      <button
        className="button full"
        disabled={answer === null || busy || !game.ready}
        onClick={submit}
      >
        {busy ? "발견을 기록하는 중…" : "정답 확인하기"}
        <ChevronRight size={18} />
      </button>
      <External href={place.officialUrl} className="text-button centered">
        <CircleHelp size={17} />
        공식 해설에서 힌트 찾기
      </External>
    </div>
  );
}
function PhotoQuest({
  mission,
  game,
  onDone,
  onPreparePhotoCapture,
}: {
  mission: PhotoGameMission;
  game: Game;
  onDone: Props["onDone"];
  onPreparePhotoCapture?: Props["onPreparePhotoCapture"];
}) {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pendingPhotoSaver = useRef<((photo: Blob, withLocation: boolean) => Promise<void>) | undefined>(undefined);
  const native = useNative();
  const url = usePhotoUrl(photo);
  async function capture() {
    setBusy(true);
    setError("");
    try {
      // Bind the day/session before opening the camera. A midnight rollover must not move this capture to another day.
      const savePhoto = await onPreparePhotoCapture?.();
      if (!native) {
        pendingPhotoSaver.current = savePhoto;
        input.current?.click();
        return;
      }
      const captured = await takeMissionPhoto();
      setPhoto(captured);
      await savePhoto?.(captured, true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "촬영하지 못했어요. 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!photo) return;
    setBusy(true);
    setError("");
    try {
      const result = await game.completePhoto(mission.id, {
        photo,
        subject,
        note,
      });
      onDone(result.completion, result.alreadyCompleted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "기록을 저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="photo-quest">
      <div className="step-title">
        <b>1</b>
        <h4>눈에 들어온 바위그림 촬영</h4>
      </div>
      {url ? (
        <div className="capture-preview">
          <img src={url} alt="내가 촬영한 관찰 사진" />
          <span>
            <CheckCircle2 size={15} />
            사진 준비 완료
          </span>
          <button
            className="icon-button"
            onClick={() => setPhoto(null)}
            disabled={busy}
            aria-label="관찰 사진 제거"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <button className="capture-box" onClick={capture} disabled={busy}>
          <div>
            <Camera size={38} />
            <Sparkles size={18} />
          </div>
          <strong>
            {busy ? "카메라를 준비하고 있어요" : "사진 찍고 발견 남기기"}
          </strong>
          <span>
            {native
              ? "휴대폰 카메라로 촬영해요"
              : "미리보기에서는 사진 파일을 선택해요"}
          </span>
        </button>
      )}
      {url && (
        <button className="text-button" onClick={capture} disabled={busy}>
          <Camera size={16} />
          다시 촬영하기
        </button>
      )}
      <input
        className="sr-only"
        aria-label="관찰 사진 선택"
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setError("");
          try {
            const selected = await compressPhoto(file);
            setPhoto(selected);
            await pendingPhotoSaver.current?.(selected, false);
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "사진을 준비하지 못했어요.",
            );
          } finally {
            setBusy(false);
            pendingPhotoSaver.current = undefined;
            e.target.value = "";
          }
        }}
      />
      <div className="step-title">
        <b>2</b>
        <h4>무엇을 발견했나요?</h4>
        <span>직접 선택</span>
      </div>
      <div className="subject-choices">
        {mission.subjects.map((s) => (
          <button
            key={s}
            aria-pressed={s === subject}
            className={s === subject ? "selected" : ""}
            onClick={() => setSubject(s)}
          >
            {s === subject && <Check size={14} />} {s}
          </button>
        ))}
      </div>
      <div className="step-title">
        <b>3</b>
        <label htmlFor="observation-note">관찰한 특징 한 줄</label>
      </div>
      <textarea
        id="observation-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder={mission.notePlaceholder}
      />
      <p className="fine-print">
        사진 속 대상을 자동 판별하지 않아요. 직접 관찰한 내용을 수집함에 남기는
        미션입니다.
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <button
        className="button full"
        disabled={!photo || !subject || !note.trim() || busy || !game.ready}
        onClick={submit}
      >
        <Sparkles size={19} />
        {busy ? "발견을 저장하는 중…" : "발견 수집하기 · +120 XP"}
      </button>
    </div>
  );
}
function CompletedMission({
  completion,
  mission,
}: {
  completion: GameCompletion;
  mission: GameMission;
}) {
  const url = usePhotoUrl(completion.photo);
  return (
    <div className="completed-mission">
      <span className="complete-icon">
        <CheckCircle2 size={39} />
      </span>
      <span className="eyebrow">MY DISCOVERY</span>
      <h3>{mission.title}</h3>
      <p className="completed-xp">{completion.xp} XP 수집 완료</p>
      {url && (
        <img
          className="completed-photo"
          src={url}
          alt={completion.subject + " 관찰 기록"}
        />
      )}
      <div className="completed-copy">
        {completion.subject && <strong>{completion.subject}</strong>}
        {completion.note && <p>{completion.note}</p>}
        <p>{mission.explanation}</p>
        <small>
          {new Date(completion.completedAt).toLocaleDateString("ko-KR")} 기록 ·
          동일 미션 보상은 한 번만 지급돼요.
        </small>
      </div>
    </div>
  );
}
