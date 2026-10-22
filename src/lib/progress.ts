import type { Mission, TourRoute, VisitRecord } from "./types";

export type RecordMap = Readonly<Record<string, VisitRecord>>;

/** A manual visit and a completed mission deliberately remain separate facts. */
export function isPlaceVisited(placeId: string, records: RecordMap): boolean {
  return Boolean(records[placeId]?.visitedAt);
}

export function isPlaceStamped(placeId: string, records: RecordMap): boolean {
  return (records[placeId]?.completedMissionIds.length ?? 0) > 0;
}

export function getCompletedMissionIds(records: RecordMap): string[] {
  return [
    ...new Set(
      Object.values(records).flatMap((record) => record.completedMissionIds),
    ),
  ];
}

export function getEarnedCollectionIds(
  missions: readonly Mission[],
  records: RecordMap,
): string[] {
  return [
    ...new Set(
      missions
        .filter((mission) =>
          records[mission.placeId]?.completedMissionIds.includes(mission.id),
        )
        .map((mission) => mission.collectionId),
    ),
  ];
}

export function getRouteProgress(
  route: Pick<TourRoute, "placeIds"> | null | undefined,
  records: RecordMap,
) {
  const placeIds = [...new Set(route?.placeIds ?? [])];
  const visitedPlaceIds = placeIds.filter((id) => isPlaceVisited(id, records));
  const stampedPlaceIds = placeIds.filter((id) => isPlaceStamped(id, records));
  const completedPlaceIds = placeIds.filter(
    (id) => isPlaceVisited(id, records) || isPlaceStamped(id, records),
  );
  return {
    total: placeIds.length,
    visited: visitedPlaceIds.length,
    stamped: stampedPlaceIds.length,
    visitedPlaceIds,
    stampedPlaceIds,
    completedPlaceIds,
    // Missions are optional: self-recorded visits also advance the selected course.
    completed: completedPlaceIds.length,
    percent: placeIds.length
      ? Math.round((completedPlaceIds.length / placeIds.length) * 100)
      : 0,
    isComplete:
      placeIds.length > 0 && completedPlaceIds.length === placeIds.length,
    nextPlaceId:
      placeIds.find(
        (id) => !isPlaceVisited(id, records) && !isPlaceStamped(id, records),
      ) ?? null,
  };
}
