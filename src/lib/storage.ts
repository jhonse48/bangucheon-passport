import type { UserProgress, VisitRecord } from "./types";

const DATABASE_NAME = "bangucheon-passport";
const DATABASE_VERSION = 1;
const RECORDS_STORE = "records";
const SETTINGS_STORE = "settings";
const PROGRESS_KEY = "progress";
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const DEFAULT_PROGRESS: UserProgress = {
  activeRouteId: null,
  startedAt: null,
};

export interface PassportSnapshot {
  records: Record<string, VisitRecord>;
  progress: UserProgress;
}

export interface PassportExport {
  format: "bangucheon-passport";
  version: 1;
  exportedAt: string;
  progress: UserProgress;
  records: Array<
    Omit<VisitRecord, "photo"> & {
      photo?: {
        mimeType: string;
        byteLength: number;
        encoding: "base64";
        data: string;
      };
    }
  >;
}

export function storageErrorMessage(error: unknown): string {
  const name =
    error instanceof Error || error instanceof DOMException ? error.name : "";
  if (name === "QuotaExceededError") {
    return "기기의 저장 공간이 부족해 저장하지 못했어요. 기록을 내보낸 뒤 필요 없는 사진을 삭제하고 다시 시도해 주세요.";
  }
  if (
    name === "SecurityError" ||
    name === "InvalidStateError" ||
    name === "NotSupportedError"
  ) {
    return "브라우저에서 기기 저장소를 사용할 수 없어요. 일반 브라우저 창에서 저장소 사용을 허용한 뒤 다시 열어 주세요.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "기록을 저장하거나 읽지 못했어요. 기록이 저장됐는지 확인한 뒤 다시 시도해 주세요.";
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("기록을 읽지 못했어요."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(
        transaction.error ??
          new Error("저장이 취소됐어요. 다시 시도해 주세요."),
      );
    transaction.onerror = () => {
      // Abort carries the final transaction error; never report success on request success alone.
    };
  });
}

function makeRecord(placeId: string): VisitRecord {
  return {
    placeId,
    completedMissionIds: [],
    note: "",
    updatedAt: new Date().toISOString(),
  };
}

function assertId(id: string): void {
  if (!id.trim()) throw new Error("기록할 장소나 미션을 확인할 수 없어요.");
}

export function createPassportStorage(
  options: { databaseName?: string; indexedDB?: IDBFactory } = {},
) {
  let connection: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    if (connection) return connection;
    const factory = options.indexedDB ?? globalThis.indexedDB;
    if (!factory)
      return Promise.reject(
        new DOMException(
          "이 브라우저는 기기 저장소를 지원하지 않아요.",
          "NotSupportedError",
        ),
      );
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(
        options.databaseName ?? DATABASE_NAME,
        DATABASE_VERSION,
      );
      let settled = false;
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(RECORDS_STORE))
          db.createObjectStore(RECORDS_STORE, { keyPath: "placeId" });
        if (!db.objectStoreNames.contains(SETTINGS_STORE))
          db.createObjectStore(SETTINGS_STORE);
      };
      request.onerror = () => {
        settled = true;
        reject(request.error ?? new Error("기기 저장소를 열지 못했어요."));
      };
      request.onblocked = () => {
        settled = true;
        reject(
          new Error(
            "다른 탭에서 이전 저장소를 사용 중이에요. 반구천 앱의 다른 탭을 닫고 다시 시도해 주세요.",
          ),
        );
      };
      request.onsuccess = () => {
        const db = request.result;
        if (settled) {
          db.close();
          return;
        }
        db.onversionchange = () => {
          db.close();
          connection = null;
        };
        db.onclose = () => {
          connection = null;
        };
        resolve(db);
      };
    }).catch((error: unknown) => {
      connection = null;
      throw error;
    });
    return connection;
  }

  async function snapshot(): Promise<PassportSnapshot> {
    const db = await open();
    const transaction = db.transaction(
      [RECORDS_STORE, SETTINGS_STORE],
      "readonly",
    );
    const done = transactionDone(transaction);
    const records = requestResult<VisitRecord[]>(
      transaction.objectStore(RECORDS_STORE).getAll(),
    );
    const progress = requestResult<UserProgress | undefined>(
      transaction.objectStore(SETTINGS_STORE).get(PROGRESS_KEY),
    );
    const [savedRecords, savedProgress] = await Promise.all([
      records,
      progress,
      done,
    ]);
    return {
      records: Object.fromEntries(
        savedRecords.map((record) => [record.placeId, record]),
      ),
      progress: savedProgress ?? { ...DEFAULT_PROGRESS },
    };
  }

  async function mutateRecord(
    placeId: string,
    update: (record: VisitRecord) => VisitRecord,
  ): Promise<VisitRecord> {
    assertId(placeId);
    const db = await open();
    const transaction = db.transaction(RECORDS_STORE, "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(RECORDS_STORE);
    let updated: VisitRecord | undefined;
    let mutationError: unknown;
    const request = store.get(placeId);
    request.onsuccess = () => {
      try {
        updated = update(
          (request.result as VisitRecord | undefined) ?? makeRecord(placeId),
        );
        updated.updatedAt = new Date().toISOString();
        store.put(updated);
      } catch (error) {
        mutationError = error;
        transaction.abort();
      }
    };
    try {
      await done;
    } catch (error) {
      throw mutationError ?? error;
    }
    if (!updated) throw new Error("기록 저장을 확인하지 못했어요.");
    return updated;
  }

  async function setRoute(routeId: string | null): Promise<UserProgress> {
    if (routeId !== null) assertId(routeId);
    const db = await open();
    const transaction = db.transaction(SETTINGS_STORE, "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(SETTINGS_STORE);
    let updated: UserProgress = { ...DEFAULT_PROGRESS };
    let mutationError: unknown;
    const request = store.get(PROGRESS_KEY);
    request.onsuccess = () => {
      try {
        const current = request.result as UserProgress | undefined;
        updated = {
          activeRouteId: routeId,
          startedAt:
            routeId === null
              ? null
              : current?.activeRouteId === routeId && current.startedAt
                ? current.startedAt
                : new Date().toISOString(),
        };
        store.put(updated, PROGRESS_KEY);
      } catch (error) {
        mutationError = error;
        transaction.abort();
      }
    };
    try {
      await done;
    } catch (error) {
      throw mutationError ?? error;
    }
    return updated;
  }

  async function deleteRecord(placeId: string): Promise<void> {
    assertId(placeId);
    const db = await open();
    const transaction = db.transaction(RECORDS_STORE, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(RECORDS_STORE).delete(placeId);
    await done;
  }

  async function clearAll(): Promise<void> {
    const db = await open();
    const transaction = db.transaction(
      [RECORDS_STORE, SETTINGS_STORE],
      "readwrite",
    );
    const done = transactionDone(transaction);
    transaction.objectStore(RECORDS_STORE).clear();
    transaction.objectStore(SETTINGS_STORE).clear();
    await done;
  }

  async function exportData(): Promise<PassportExport> {
    const saved = await snapshot();
    const records = await Promise.all(
      Object.values(saved.records).map(async (record) => {
        const { photo, ...rest } = record;
        if (!photo) return rest;
        const bytes = new Uint8Array(await photo.arrayBuffer());
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 8192) {
          binary += String.fromCharCode(
            ...bytes.subarray(offset, offset + 8192),
          );
        }
        return {
          ...rest,
          photo: {
            mimeType: photo.type,
            byteLength: photo.size,
            encoding: "base64" as const,
            data: btoa(binary),
          },
        };
      }),
    );
    return {
      format: "bangucheon-passport",
      version: 1,
      exportedAt: new Date().toISOString(),
      progress: saved.progress,
      records,
    };
  }

  return {
    snapshot,
    setRoute,
    saveNote(placeId: string, note: string, photo?: Blob | null) {
      return mutateRecord(placeId, (record) => {
        const updated = { ...record, note };
        if (photo === null) delete updated.photo;
        else if (photo !== undefined) updated.photo = photo;
        return updated;
      });
    },
    markVisited(placeId: string) {
      return mutateRecord(placeId, (record) => ({
        ...record,
        visitedAt: record.visitedAt ?? new Date().toISOString(),
      }));
    },
    completeMission(placeId: string, missionId: string) {
      assertId(missionId);
      return mutateRecord(placeId, (record) => ({
        ...record,
        completedMissionIds: [
          ...new Set([...record.completedMissionIds, missionId]),
        ],
      }));
    },
    deleteRecord,
    clearAll,
    exportData,
    async close() {
      const current = connection;
      connection = null;
      if (current) (await current).close();
    },
  };
}

export const passportStorage = createPassportStorage();

/** Photos are compressed before persistence; failure never replaces an existing photo. */
export async function compressPhoto(file: Blob): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error(
      "JPG, PNG, WebP 사진을 선택해 주세요. HEIC 사진은 JPG로 변환한 뒤 등록할 수 있어요.",
    );
  }
  if (file.size === 0)
    throw new Error("비어 있는 사진 파일이에요. 다른 사진을 선택해 주세요.");
  if (file.size > MAX_PHOTO_BYTES)
    throw new Error("사진은 20MB 이하로 선택해 주세요.");
  if (typeof document === "undefined")
    throw new Error("사진 등록은 브라우저에서 사용할 수 있어요.");
  let source: ImageBitmap | HTMLImageElement;
  let objectUrl: string | undefined;
  try {
    if (typeof createImageBitmap === "function")
      source = await createImageBitmap(file);
    else {
      objectUrl = URL.createObjectURL(file);
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () =>
          reject(new Error("사진을 읽지 못했어요. 다른 사진을 선택해 주세요."));
        image.src = objectUrl!;
      });
    }
  } catch {
    throw new Error(
      "사진을 읽지 못했어요. JPG, PNG, WebP 형식의 다른 사진을 선택해 주세요.",
    );
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
  try {
    const width = "naturalWidth" in source ? source.naturalWidth : source.width;
    const height =
      "naturalHeight" in source ? source.naturalHeight : source.height;
    if (!width || !height || width * height > 50_000_000)
      throw new Error(
        "사진 해상도가 너무 크거나 올바르지 않아요. 크기를 줄인 뒤 다시 선택해 주세요.",
      );
    const scale = Math.min(1, 1600 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이 브라우저에서 사진을 처리할 수 없어요.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else
            reject(
              new Error("사진을 압축하지 못했어요. 다른 사진을 선택해 주세요."),
            );
        },
        "image/jpeg",
        0.82,
      ),
    );
  } finally {
    if ("close" in source) source.close();
  }
}
