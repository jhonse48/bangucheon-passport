import assert from "node:assert/strict";
import test from "node:test";
import {
  getCompletedMissionIds,
  getEarnedCollectionIds,
  getRouteProgress,
  isPlaceStamped,
  isPlaceVisited,
} from "../src/lib/progress";
import type { Mission, VisitRecord } from "../src/lib/types";

const record = (
  placeId: string,
  patch: Partial<VisitRecord> = {},
): VisitRecord => ({
  placeId,
  note: "",
  completedMissionIds: [],
  updatedAt: "2026-10-22T00:00:00.000Z",
  ...patch,
});

test("manual visits advance the course without awarding mission stamps", () => {
  const records = { a: record("a", { visitedAt: "2026-10-22T00:00:00.000Z" }) };
  assert.equal(isPlaceVisited("a", records), true);
  assert.equal(isPlaceStamped("a", records), false);
  const progress = getRouteProgress({ placeIds: ["a", "b"] }, records);
  assert.equal(progress.visited, 1);
  assert.equal(progress.stamped, 0);
  assert.equal(progress.percent, 50);
  assert.equal(progress.completed, 1);
  assert.equal(progress.nextPlaceId, "b");
});

test("manual visits and optional missions can complete a course together without double counting", () => {
  const records = {
    a: record("a", {
      visitedAt: "2026-10-22T00:00:00.000Z",
      completedMissionIds: ["m-a"],
    }),
    b: record("b", { visitedAt: "2026-10-22T00:00:00.000Z" }),
    c: record("c", { completedMissionIds: ["m-c"] }),
  };
  const progress = getRouteProgress({ placeIds: ["a", "b", "c"] }, records);
  assert.equal(progress.completed, 3);
  assert.equal(progress.visited, 2);
  assert.equal(progress.stamped, 2);
  assert.equal(progress.percent, 100);
  assert.equal(progress.isComplete, true);
  assert.equal(progress.nextPlaceId, null);
});

test("route progress is scoped to unique course places and follows mission completion", () => {
  const records: Record<string, VisitRecord> = {
    a: record("a", { completedMissionIds: ["m-a"] }),
    outside: record("outside", { completedMissionIds: ["m-outside"] }),
  };
  const progress = getRouteProgress({ placeIds: ["a", "a", "b"] }, records);
  assert.equal(progress.total, 2);
  assert.equal(progress.completed, 1);
  assert.equal(progress.percent, 50);
  assert.equal(progress.isComplete, false);
  assert.equal(progress.nextPlaceId, "b");
  assert.equal(progress.visited, 0);
  records.b = record("b", { completedMissionIds: ["m-b"] });
  const completed = getRouteProgress({ placeIds: ["a", "b"] }, records);
  assert.equal(completed.percent, 100);
  assert.equal(completed.isComplete, true);
  assert.equal(completed.nextPlaceId, null);
});

test("empty and missing routes do not appear complete", () => {
  for (const route of [null, undefined, { placeIds: [] }]) {
    const progress = getRouteProgress(route, {});
    assert.equal(progress.total, 0);
    assert.equal(progress.percent, 0);
    assert.equal(progress.isComplete, false);
    assert.equal(progress.nextPlaceId, null);
  }
});

test("collection rewards require mission completion at its matching place and are deduplicated", () => {
  const missions = [
    { id: "m-a", placeId: "a", collectionId: "whale" },
    { id: "m-a-2", placeId: "a", collectionId: "whale" },
    { id: "m-b", placeId: "b", collectionId: "dino" },
  ] as Mission[];
  const records = {
    a: record("a", { completedMissionIds: ["m-a", "m-a-2", "m-b", "m-a"] }),
  };
  assert.deepEqual(getEarnedCollectionIds(missions, records), ["whale"]);
  assert.deepEqual(getCompletedMissionIds(records), ["m-a", "m-a-2", "m-b"]);
  assert.equal(isPlaceStamped("missing", records), false);
});
