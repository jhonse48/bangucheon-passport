"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UserProgress, VisitRecord } from "./types";
import {
  DEFAULT_PROGRESS,
  passportStorage,
  storageErrorMessage,
} from "./storage";

export function usePassport() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<Record<string, VisitRecord>>({});
  const [progress, setProgress] = useState<UserProgress>({
    ...DEFAULT_PROGRESS,
  });
  const mounted = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  // Serialize mutations and refreshes so a slow old read cannot overwrite a newer edit.
  const run = useCallback(<T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.current
      .catch(() => undefined)
      .then(async () => {
        if (mounted.current) setError(null);
        try {
          return await operation();
        } catch (cause) {
          const message = storageErrorMessage(cause);
          if (mounted.current) setError(message);
          throw new Error(message, { cause });
        }
      });
    queue.current = result.catch(() => undefined);
    return result;
  }, []);

  const refresh = useCallback(
    () =>
      run(async () => {
        const saved = await passportStorage.snapshot();
        if (mounted.current) {
          setRecords(saved.records);
          setProgress(saved.progress);
        }
      }),
    [run],
  );

  useEffect(() => {
    mounted.current = true;
    void refresh()
      .catch(() => undefined)
      .finally(() => {
        if (mounted.current) setReady(true);
      });
    const onFocus = () => {
      void refresh().catch(() => undefined);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      mounted.current = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const saveRecord = useCallback(
    (operation: () => Promise<VisitRecord>) =>
      run(async () => {
        const record = await operation();
        if (mounted.current)
          setRecords((previous) => ({ ...previous, [record.placeId]: record }));
        return record;
      }),
    [run],
  );

  const setRoute = useCallback(
    (routeId: string | null) =>
      run(async () => {
        const updated = await passportStorage.setRoute(routeId);
        if (mounted.current) setProgress(updated);
        return updated;
      }),
    [run],
  );

  const saveNote = useCallback(
    (placeId: string, note: string, photo?: Blob | null) =>
      saveRecord(() => passportStorage.saveNote(placeId, note, photo)),
    [saveRecord],
  );
  const markVisited = useCallback(
    (placeId: string) => saveRecord(() => passportStorage.markVisited(placeId)),
    [saveRecord],
  );
  const completeMission = useCallback(
    (placeId: string, missionId: string) =>
      saveRecord(() => passportStorage.completeMission(placeId, missionId)),
    [saveRecord],
  );

  const deleteRecord = useCallback(
    (placeId: string) =>
      run(async () => {
        await passportStorage.deleteRecord(placeId);
        if (mounted.current)
          setRecords((previous) => {
            const updated = { ...previous };
            delete updated[placeId];
            return updated;
          });
      }),
    [run],
  );

  const clearAll = useCallback(
    () =>
      run(async () => {
        await passportStorage.clearAll();
        if (mounted.current) {
          setRecords({});
          setProgress({ ...DEFAULT_PROGRESS });
        }
      }),
    [run],
  );

  const exportData = useCallback(
    () =>
      run(async () => {
        const exported = await passportStorage.exportData();
        const blob = new Blob([JSON.stringify(exported, null, 2)], {
          type: "application/json;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `반구천-여행기록-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        try {
          link.click();
        } finally {
          link.remove();
          // A delayed release lets mobile browsers consume the download first.
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
        return exported;
      }),
    [run],
  );

  return {
    ready,
    error,
    records,
    progress,
    setRoute,
    saveNote,
    markVisited,
    completeMission,
    deleteRecord,
    clearAll,
    exportData,
  };
}
