import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  collectionItems,
  missions,
  places,
  routes,
  services,
} from "../src/data/content";
import type { Source } from "../src/lib/types";

const uniqueIds = (items: readonly { id: string }[], label: string) => {
  assert.equal(
    new Set(items.map((item) => item.id)).size,
    items.length,
    `${label}: IDs must be unique`,
  );
  for (const item of items) assert.ok(item.id.trim(), `${label}: empty ID`);
};

const validSource = (source: Source) => {
  assert.ok(source.title.trim(), "A source requires a descriptive title");
  assert.equal(
    new URL(source.url).protocol,
    "https:",
    `${source.title}: source must use HTTPS`,
  );
  assert.match(
    source.checkedAt,
    /^\d{4}-\d{2}-\d{2}$/,
    `${source.title}: last checked date is required`,
  );
  assert.ok(
    Number.isFinite(Date.parse(source.checkedAt)),
    `${source.title}: invalid checked date`,
  );
};

test("content includes 13 distinct places, six pilot places and the required two pilot routes", () => {
  assert.equal(places.length, 13);
  assert.equal(places.filter((place) => place.pilot).length, 6);
  assert.deepEqual(
    places
      .filter((place) => place.pilot)
      .map((place) => place.id)
      .sort(),
    [
      "museum",
      "jipcheongjeong",
      "seowon",
      "dinosaur",
      "bangudae",
      "cheonjeonri",
    ].sort(),
  );
  assert.equal(places.filter((place) => place.zone === "A").length, 10);
  assert.equal(places.filter((place) => place.zone === "B").length, 3);
  assert.deepEqual(
    routes
      .filter((route) => route.active)
      .map((route) => route.id)
      .sort(),
    ["cheonjeon", "core"],
  );
  for (const [label, items] of Object.entries({
    places,
    routes,
    missions,
    services,
    collectionItems,
  }))
    uniqueIds(items, label);
});

test("route stops refer to real places and A/B routes cover all 13 places", () => {
  const placeById = new Map(places.map((place) => [place.id, place]));
  for (const route of routes) {
    assert.ok(route.placeIds.length > 0, `${route.id}: empty route`);
    assert.equal(
      new Set(route.placeIds).size,
      route.placeIds.length,
      `${route.id}: duplicated stop`,
    );
    for (const id of route.placeIds) {
      const place = placeById.get(id);
      assert.ok(place, `${route.id}: unknown stop ${id}`);
    }
  }
  const activeStops = routes.filter((route) => route.active).flatMap((route) => route.placeIds);
  assert.equal(activeStops.length, 13);
  assert.equal(new Set(activeStops).size, 13);
  assert.ok(
    routes.some(
      (route) => !route.active && route.placeIds.length === places.length,
    ),
    "Full course is represented as an inactive expansion",
  );
});

test("place, mission, service and collection references agree in both directions", () => {
  const placeById = new Map(places.map((place) => [place.id, place]));
  const missionById = new Map(missions.map((mission) => [mission.id, mission]));
  const serviceIds = new Set(services.map((service) => service.id));
  const collectionIds = new Set(collectionItems.map((item) => item.id));
  for (const place of places) {
    assert.ok(
      collectionIds.has(place.collectionId),
      `${place.id}: unknown collection`,
    );
    assert.equal(
      new Set(place.missionIds).size,
      place.missionIds.length,
      `${place.id}: duplicated mission`,
    );
    assert.equal(
      new Set(place.serviceIds).size,
      place.serviceIds.length,
      `${place.id}: duplicated service`,
    );
    for (const id of place.serviceIds)
      assert.ok(serviceIds.has(id), `${place.id}: unknown service ${id}`);
    for (const id of place.missionIds) {
      assert.equal(
        missionById.get(id)?.placeId,
        place.id,
        `${place.id}: mission ${id} belongs to this place`,
      );
    }
    if (place.pilot)
      assert.ok(
        place.missionIds.length > 0,
        `${place.id}: pilot place needs a playable mission`,
      );
  }
  for (const mission of missions) {
    const place = placeById.get(mission.placeId);
    assert.ok(place, `${mission.id}: unknown place`);
    assert.ok(
      place.missionIds.includes(mission.id),
      `${mission.id}: missing reverse place reference`,
    );
    assert.ok(
      collectionIds.has(mission.collectionId),
      `${mission.id}: unknown collection reward`,
    );
    assert.equal(
      mission.collectionId,
      place.collectionId,
      `${mission.id}: place stamp and mission reward should agree`,
    );
  }
});

test("mission answers are playable and all three requested mission types are represented", () => {
  assert.deepEqual(
    [...new Set(missions.map((mission) => mission.type))].sort(),
    ["관찰형", "기록형", "해설 연계형"].sort(),
  );
  for (const mission of missions) {
    for (const text of [
      mission.title,
      mission.instruction,
      mission.question,
      mission.explanation,
    ])
      assert.ok(text.trim(), `${mission.id}: missing mission copy`);
    if (mission.options) {
      assert.ok(
        mission.options.length >= 2,
        `${mission.id}: answer choices required`,
      );
      assert.equal(
        new Set(mission.options).size,
        mission.options.length,
        `${mission.id}: duplicated choices`,
      );
      assert.ok(
        mission.options.every((option) => option.trim()),
        `${mission.id}: blank answer`,
      );
      assert.ok(
        Number.isInteger(mission.correctIndex),
        `${mission.id}: answer index must be an integer`,
      );
      assert.ok(
        mission.correctIndex! >= 0 &&
          mission.correctIndex! < mission.options.length,
        `${mission.id}: answer index outside available choices`,
      );
    } else {
      assert.equal(
        mission.type,
        "기록형",
        `${mission.id}: a freeform mission must be a recording mission`,
      );
      assert.equal(
        mission.correctIndex,
        undefined,
        `${mission.id}: freeform mission has no quiz answer`,
      );
    }
  }
});

test("unverified coordinates remain null and all places retain access guidance and sources", () => {
  for (const place of places) {
    if (place.locationStatus === "확인 필요") {
      assert.equal(
        place.heritagePosition,
        null,
        `${place.id}: unverified heritage coordinates must be null`,
      );
      assert.equal(
        place.viewingPosition,
        null,
        `${place.id}: unverified visitor destination must be null`,
      );
    }
    for (const position of [place.heritagePosition, place.viewingPosition]) {
      if (!position) continue;
      assert.ok(
        Number.isFinite(position.lat) &&
          position.lat >= -90 &&
          position.lat <= 90,
        `${place.id}: invalid latitude`,
      );
      assert.ok(
        Number.isFinite(position.lng) &&
          position.lng >= -180 &&
          position.lng <= 180,
        `${place.id}: invalid longitude`,
      );
    }
    assert.ok(place.accessNote.trim(), `${place.id}: missing access guidance`);
    assert.ok(
      place.observation.length > 0 &&
        place.observation.every((text) => text.trim()),
      `${place.id}: missing observation guidance`,
    );
    assert.ok(place.sources.length > 0, `${place.id}: missing sources`);
    place.sources.forEach(validSource);
    assert.equal(
      new URL(place.officialUrl).protocol,
      "https:",
      `${place.id}: official link must use HTTPS`,
    );
  }
  for (const service of services) {
    assert.equal(
      new URL(service.url).protocol,
      "https:",
      `${service.id}: service link must use HTTPS`,
    );
    validSource(service.source);
  }
});

test("all content images exist locally and place imagery includes alt text and credit", () => {
  for (const item of [...places, ...routes]) {
    assert.ok(
      item.image.startsWith("/images/"),
      `${item.id}: image must be a local public asset`,
    );
    const imagePath = fileURLToPath(
      new URL(`../public${item.image}`, import.meta.url),
    );
    assert.ok(existsSync(imagePath), `${item.id}: missing image ${item.image}`);
  }
  for (const place of places) {
    assert.ok(
      place.imageAlt.trim(),
      `${place.id}: image alternative text required`,
    );
    assert.ok(place.imageCredit.trim(), `${place.id}: image credit required`);
  }
});
