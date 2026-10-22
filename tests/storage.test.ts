import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import {
  compressPhoto,
  createPassportStorage,
  storageErrorMessage,
} from "../src/lib/storage";

function setup() {
  return createPassportStorage({ indexedDB: new IDBFactory() });
}

test("new storage has empty records and no active route", async () => {
  const storage = setup();
  assert.deepEqual(await storage.snapshot(), {
    records: {},
    progress: { activeRouteId: null, startedAt: null },
  });
  await storage.close();
});

test("photo and note edits persist across connections, preserve omitted photos and remove explicit null", async () => {
  const indexedDB = new IDBFactory();
  const storage = createPassportStorage({ indexedDB });
  const photo = new Blob(["photo-content"], { type: "image/jpeg" });
  await storage.saveNote("place-a", "첫 기록", photo);
  await storage.saveNote("place-a", "수정한 기록");
  await storage.close();
  const reopened = createPassportStorage({ indexedDB });
  const saved = (await reopened.snapshot()).records["place-a"];
  assert.equal(saved.note, "수정한 기록");
  assert.equal(await saved.photo?.text(), "photo-content");
  assert.deepEqual(saved.completedMissionIds, []);
  await reopened.saveNote("place-a", "", null);
  const cleared = (await reopened.snapshot()).records["place-a"];
  assert.equal(cleared.note, "");
  assert.equal(cleared.photo, undefined);
  await reopened.close();
});

test("manual visits remain distinct from mission stamps and repeated actions are idempotent", async () => {
  const storage = setup();
  const firstVisit = await storage.markVisited("place-a");
  assert.ok(firstVisit.visitedAt);
  assert.deepEqual(firstVisit.completedMissionIds, []);
  const nextVisit = await storage.markVisited("place-a");
  assert.equal(nextVisit.visitedAt, firstVisit.visitedAt);
  await storage.completeMission("place-b", "mission-b");
  await storage.completeMission("place-b", "mission-b");
  const records = (await storage.snapshot()).records;
  assert.equal(records["place-b"].visitedAt, undefined);
  assert.deepEqual(records["place-b"].completedMissionIds, ["mission-b"]);
  await storage.close();
});

test("concurrent updates to the same record do not lose notes, visits or mission IDs", async () => {
  const storage = setup();
  await Promise.all([
    storage.saveNote("place-a", "지켜야 할 기록"),
    storage.markVisited("place-a"),
    storage.completeMission("place-a", "mission-a"),
    storage.completeMission("place-a", "mission-b"),
  ]);
  const saved = (await storage.snapshot()).records["place-a"];
  assert.equal(saved.note, "지켜야 할 기록");
  assert.ok(saved.visitedAt);
  assert.deepEqual([...saved.completedMissionIds].sort(), [
    "mission-a",
    "mission-b",
  ]);
  await storage.close();
});

test("selected route persists, reselecting preserves start time and clearing resets progress", async () => {
  const storage = setup();
  const started = await storage.setRoute("route-a");
  assert.equal(started.activeRouteId, "route-a");
  assert.ok(started.startedAt);
  assert.deepEqual(await storage.setRoute("route-a"), started);
  assert.deepEqual((await storage.snapshot()).progress, started);
  await storage.setRoute(null);
  assert.deepEqual((await storage.snapshot()).progress, {
    activeRouteId: null,
    startedAt: null,
  });
  await storage.close();
});

test("export includes exact photo bytes, note, stamps and active route", async () => {
  const storage = setup();
  const bytes = new Uint8Array([0, 1, 127, 128, 254, 255]);
  await storage.saveNote(
    "place-a",
    "고래를 발견했어요 🐋",
    new Blob([bytes], { type: "image/webp" }),
  );
  await storage.completeMission("place-a", "mission-a");
  await storage.setRoute("route-a");
  const exported = await storage.exportData();
  assert.equal(exported.version, 1);
  assert.equal(exported.format, "bangucheon-passport");
  assert.equal(exported.progress.activeRouteId, "route-a");
  assert.equal(exported.records[0].note, "고래를 발견했어요 🐋");
  assert.deepEqual(exported.records[0].completedMissionIds, ["mission-a"]);
  assert.equal(exported.records[0].photo?.mimeType, "image/webp");
  assert.equal(exported.records[0].photo?.byteLength, bytes.length);
  assert.deepEqual(
    new Uint8Array(Buffer.from(exported.records[0].photo!.data, "base64")),
    bytes,
  );
  assert.equal(
    (await storage.snapshot()).records["place-a"].photo?.size,
    bytes.length,
  );
  await storage.close();
});

test("deleting a record removes its photo and stamps; deleting all also removes selected route", async () => {
  const storage = setup();
  await storage.saveNote(
    "place-a",
    "기록",
    new Blob(["photo"], { type: "image/jpeg" }),
  );
  await storage.completeMission("place-a", "mission-a");
  await storage.markVisited("place-b");
  await storage.setRoute("route-a");
  await storage.deleteRecord("place-a");
  const partial = await storage.snapshot();
  assert.equal(partial.records["place-a"], undefined);
  assert.ok(partial.records["place-b"]);
  assert.equal(partial.progress.activeRouteId, "route-a");
  await storage.clearAll();
  assert.deepEqual(await storage.snapshot(), {
    records: {},
    progress: { activeRouteId: null, startedAt: null },
  });
  await storage.close();
});

test("unsupported photo inputs fail with actionable messages before decoding", async () => {
  await assert.rejects(
    () => compressPhoto(new Blob(["heic"], { type: "image/heic" })),
    /JPG/,
  );
  await assert.rejects(
    () => compressPhoto(new Blob([], { type: "image/jpeg" })),
    /비어/,
  );
  await assert.rejects(
    () =>
      compressPhoto(
        new Blob([new Uint8Array(20 * 1024 * 1024 + 1)], { type: "image/png" }),
      ),
    /20MB/,
  );
});

test("storage failures report helpful errors instead of pretending a save succeeded", async () => {
  const storage = createPassportStorage({
    indexedDB: {
      open() {
        throw new DOMException("quota", "QuotaExceededError");
      },
    } as unknown as IDBFactory,
  });
  await assert.rejects(() => storage.saveNote("place-a", "기록"), {
    name: "QuotaExceededError",
  });
  assert.match(
    storageErrorMessage(new DOMException("quota", "QuotaExceededError")),
    /저장 공간/,
  );
  assert.match(
    storageErrorMessage(new DOMException("blocked", "SecurityError")),
    /저장소/,
  );
  assert.match(storageErrorMessage(new Error("원래 오류")), /원래 오류/);
});

test("a quota failure while writing retains the prior record, photo and selected route", async () => {
  const storage = setup();
  await storage.saveNote(
    "place-a",
    "저장된 기록",
    new Blob(["original"], { type: "image/jpeg" }),
  );
  await storage.setRoute("route-a");
  const originalPut = IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Storage is full", "QuotaExceededError");
    };
    await assert.rejects(
      () => storage.saveNote("place-a", "저장되지 않은 기록", null),
      { name: "QuotaExceededError" },
    );
    await assert.rejects(() => storage.setRoute("route-b"), {
      name: "QuotaExceededError",
    });
  } finally {
    IDBObjectStore.prototype.put = originalPut;
  }
  const saved = await storage.snapshot();
  assert.equal(saved.records["place-a"].note, "저장된 기록");
  assert.equal(await saved.records["place-a"].photo?.text(), "original");
  assert.equal(saved.progress.activeRouteId, "route-a");
  await storage.close();
});
