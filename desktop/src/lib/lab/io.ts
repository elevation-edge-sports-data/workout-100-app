import { noonOnDay, localDayKey } from "./dates";
import {
  LAB_EXPORT_VERSION,
  type DayStamp,
  type Exercise,
  type PointEvent,
  type Profile,
} from "./types";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Keep valid stamps. Absent field stays absent. Does not invent stamps. */
function parseDayStamps(raw: unknown): DayStamp[] | undefined {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const stamps: DayStamp[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Partial<DayStamp>;
    if (typeof s.id !== "string" || s.id.length === 0) continue;
    if (typeof s.day !== "string" || !DAY_KEY.test(s.day)) continue;
    if (typeof s.upAt !== "number" || !Number.isFinite(s.upAt)) continue;
    const stamp: DayStamp = { id: s.id, day: s.day, upAt: s.upAt };
    if (s.sleepAt != null) {
      if (typeof s.sleepAt !== "number" || !Number.isFinite(s.sleepAt)) continue;
      stamp.sleepAt = s.sleepAt;
    }
    stamps.push(stamp);
  }
  return stamps;
}

export type EventPack = {
  ids: string[];
  days: string[];
  triples: number[];
};

/** Rows that must keep their id through export. Packing rewrites workout ids. */
function isAtomicEvent(e: PointEvent): boolean {
  if (e.source === "tracker") return true;
  if (typeof e.sessionId === "string" && e.sessionId.length > 0) return true;
  return typeof e.miles === "number" && Number.isFinite(e.miles) && e.miles > 0;
}

export function packWorkoutEvents(events: PointEvent[]): {
  pack: EventPack;
  rest: PointEvent[];
} {
  const ids: string[] = [];
  const idIndex = new Map<string, number>();
  const days: string[] = [];
  const dayIndex = new Map<string, number>();
  const byExDay = new Map<string, number>();
  const rest: PointEvent[] = [];
  for (const e of events) {
    // Tracker rows keep their own id. Packing would rewrite them as hist-<exercise>-<day>.
    if (e.kind !== "workout" || !e.exerciseId || e.points <= 0 || isAtomicEvent(e)) {
      rest.push(e);
      continue;
    }
    const day = localDayKey(e.timestamp);
    if (!idIndex.has(e.exerciseId)) {
      idIndex.set(e.exerciseId, ids.length);
      ids.push(e.exerciseId);
    }
    if (!dayIndex.has(day)) {
      dayIndex.set(day, days.length);
      days.push(day);
    }
    const key = `${e.exerciseId}\t${day}`;
    byExDay.set(key, (byExDay.get(key) ?? 0) + e.points);
  }
  const triples: number[] = [];
  for (const [key, pts] of byExDay) {
    const [exId, day] = key.split("\t");
    triples.push(idIndex.get(exId!)!, dayIndex.get(day!)!, pts);
  }
  return { pack: { ids, days, triples }, rest };
}

export function unpackWorkoutEvents(
  pack: EventPack,
  exercises: Exercise[],
  rest: PointEvent[],
): PointEvent[] {
  const cat = new Map(exercises.map((e) => [e.id, e.categoryId]));
  const events: PointEvent[] = [...rest];
  const t = pack.triples;
  for (let i = 0; i < t.length; i += 3) {
    const exId = pack.ids[t[i]!];
    const day = pack.days[t[i + 1]!];
    const pts = t[i + 2]!;
    if (!exId || !day || pts <= 0) continue;
    events.push({
      id: `hist-${exId}-${day}`,
      kind: "workout",
      points: pts,
      timestamp: noonOnDay(day),
      exerciseId: exId,
      categoryId: cat.get(exId),
    });
  }
  return events;
}

export function serializeProfile(profile: Profile) {
  const { pack, rest } = packWorkoutEvents(profile.events);
  return { ...profile, events: rest, eventPack: pack };
}

export function parseProfile(raw: unknown, fallback: Profile): Profile {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Partial<Profile> & { eventPack?: EventPack };
  const exercises = Array.isArray(o.exercises) ? (o.exercises as Exercise[]) : fallback.exercises;
  const rest = Array.isArray(o.events) ? (o.events as PointEvent[]) : [];
  const events = o.eventPack ? unpackWorkoutEvents(o.eventPack, exercises, rest) : rest;
  return {
    ...fallback,
    ...o,
    exercises,
    events,
    rules: { ...fallback.rules, ...(o.rules ?? {}) },
    plans: Array.isArray(o.plans) ? o.plans : fallback.plans,
    dayStamps: parseDayStamps(o.dayStamps),
  };
}

export function exportLab(data: { activeProfileId: string; profiles: Profile[] }) {
  return JSON.stringify(
    {
      version: LAB_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      activeProfileId: data.activeProfileId,
      profiles: data.profiles.map(serializeProfile),
    },
    null,
    2,
  );
}

export function parseImport(raw: unknown): {
  activeProfileId?: string;
  profiles: unknown[];
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { profiles?: unknown; profile?: unknown; activeProfileId?: string };
  if (Array.isArray(o.profiles)) return { activeProfileId: o.activeProfileId, profiles: o.profiles };
  if (o.profile) return { profiles: [o.profile] };
  return null;
}
