import { milesToPoints } from "./engine";
import {
  APP_ID,
  ON_FOOT_EXERCISE_ID,
  SESSION_SCHEMA,
  type PointEvent,
  type Profile,
  type Rules,
} from "./types";

/** International mile. Phone files store workoutDistanceMeters. */
const METERS_PER_MILE = 1609.344;
/** Phone `points[].acc` is meters. Ledger path uses feet. */
const FEET_PER_METER = 3.28084;

export type TrackerSessionV2 = {
  app: "workout-lab-100";
  schema: "session.v2";
  sessionId: string;
  startedAt: number;
  endedAt: number;
  miles: number;
  points?: number;
  exerciseId?: string;
  categoryId?: string;
  finishReason?: string;
  tz?: string;
  path?: { t: number; lat: number; lon: number; accFt?: number }[];
};

export type IngestTrackerResult = {
  profile: Profile;
  status: "added" | "duplicate" | "rejected" | "zero-points";
  event?: PointEvent;
};

export type IngestTrackerBatch = {
  profile: Profile;
  added: number;
  duplicate: number;
  zeroPoints: number;
  rejected: number;
};

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

function finiteNumber(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function nonEmptyString(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalString(raw: unknown): string | undefined {
  return nonEmptyString(raw) ?? undefined;
}

function idString(raw: unknown): string | null {
  const text = nonEmptyString(raw);
  if (text) return text;
  const n = finiteNumber(raw);
  return n == null ? null : String(n);
}

function nonNegative(raw: unknown): number | null {
  const n = finiteNumber(raw);
  if (n == null || n < 0) return null;
  return n;
}

/** Epoch milliseconds, or an ISO-8601 string. */
function epochMs(raw: unknown): number | null {
  const n = finiteNumber(raw);
  if (n != null) return n;
  const text = nonEmptyString(raw);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function readSessionId(raw: Record<string, unknown>): string | null {
  if ("sessionId" in raw && raw.sessionId != null) {
    const id = idString(raw.sessionId);
    if (id) return id;
  }
  if ("id" in raw && raw.id != null) return idString(raw.id);
  return null;
}

function readMiles(raw: Record<string, unknown>): number | null {
  if ("miles" in raw && raw.miles != null) return nonNegative(raw.miles);
  if ("distanceMiles" in raw && raw.distanceMiles != null) return nonNegative(raw.distanceMiles);
  if ("workoutDistanceMeters" in raw && raw.workoutDistanceMeters != null) {
    const meters = nonNegative(raw.workoutDistanceMeters);
    if (meters == null) return null;
    return meters / METERS_PER_MILE;
  }
  return null;
}

function readTrackPoint(item: unknown): { t: number; lat: number; lon: number; accFt?: number } | null {
  if (!isRecord(item)) return null;
  const lat = finiteNumber(item.lat);
  const lon = finiteNumber(item.lon);
  const t = epochMs(item.t) ?? epochMs(item.time);
  if (lat == null || lon == null || t == null) return null;
  const point: { t: number; lat: number; lon: number; accFt?: number } = { t, lat, lon };
  const accFt = finiteNumber(item.accFt);
  if (accFt != null) {
    point.accFt = accFt;
    return point;
  }
  const accMeters = finiteNumber(item.acc);
  if (accMeters != null) point.accFt = accMeters * FEET_PER_METER;
  return point;
}

function readPointList(raw: unknown): NonNullable<TrackerSessionV2["path"]> {
  if (!Array.isArray(raw)) return [];
  const path: NonNullable<TrackerSessionV2["path"]> = [];
  for (const item of raw) {
    const point = readTrackPoint(item);
    if (point) path.push(point);
  }
  return path;
}

function readSessionPath(raw: Record<string, unknown>): TrackerSessionV2["path"] | undefined {
  if (Array.isArray(raw.path)) {
    const path = readPointList(raw.path);
    if (path.length > 0) return path;
  }
  if (Array.isArray(raw.points)) {
    const path = readPointList(raw.points);
    if (path.length > 0) return path;
  }
  return undefined;
}

function listedSessions(raw: Record<string, unknown>): unknown[] | null {
  const lists: unknown[][] = [];
  if (Array.isArray(raw.sessions)) lists.push(raw.sessions);
  if (Array.isArray(raw.profiles)) {
    for (const profile of raw.profiles) {
      if (isRecord(profile) && Array.isArray(profile.sessions)) lists.push(profile.sessions);
    }
  }
  if (isRecord(raw.profile) && Array.isArray(raw.profile.sessions)) lists.push(raw.profile.sessions);
  if (!lists.length) return null;
  return lists.flat();
}

export function parseTrackerSession(raw: unknown): TrackerSessionV2 | null {
  if (!isRecord(raw)) return null;
  if ("schema" in raw && raw.schema != null && raw.schema !== SESSION_SCHEMA) return null;
  const sessionId = readSessionId(raw);
  const miles = readMiles(raw);
  if (!sessionId || miles == null) return null;

  const startedAt = epochMs(raw.startedAtMs) ?? epochMs(raw.startedAt) ?? 0;
  const endedAt = epochMs(raw.endedAtMs) ?? epochMs(raw.endedAt) ?? epochMs(raw.stoppedAt) ?? startedAt;
  const score = finiteNumber(raw.points);
  const path = readSessionPath(raw);

  const session: TrackerSessionV2 = {
    app: APP_ID,
    schema: SESSION_SCHEMA,
    sessionId,
    startedAt,
    endedAt,
    miles,
  };
  if (score != null) session.points = score;
  const exerciseId = optionalString(raw.exerciseId);
  const categoryId = optionalString(raw.categoryId);
  const finishReason = optionalString(raw.finishReason);
  const tz = optionalString(raw.tz);
  if (exerciseId) session.exerciseId = exerciseId;
  if (categoryId) session.categoryId = categoryId;
  if (finishReason) session.finishReason = finishReason;
  if (tz) session.tz = tz;
  if (path) session.path = path;
  return session;
}

function collectTrackerSessions(raw: unknown): { sessions: TrackerSessionV2[]; rejected: number } {
  if (Array.isArray(raw)) {
    const sessions: TrackerSessionV2[] = [];
    let rejected = 0;
    for (const item of raw) {
      const part = collectTrackerSessions(item);
      sessions.push(...part.sessions);
      rejected += part.rejected;
    }
    return { sessions, rejected };
  }
  if (!isRecord(raw)) return { sessions: [], rejected: 1 };
  const listed = listedSessions(raw);
  if (listed) {
    const sessions: TrackerSessionV2[] = [];
    let rejected = 0;
    for (const item of listed) {
      const session = parseTrackerSession(item);
      if (session) sessions.push(session);
      else rejected += 1;
    }
    return { sessions, rejected };
  }
  const session = parseTrackerSession(raw);
  if (!session) return { sessions: [], rejected: 1 };
  return { sessions: [session], rejected: 0 };
}

/** Points follow the profile rule. 1.25 mi at 0.25 mi/pt is 5. See session.test-data.json. */
export function sessionToEvent(
  session: TrackerSessionV2,
  rules: Pick<Rules, "milesPerPoint">,
  fallbackExerciseId = ON_FOOT_EXERCISE_ID,
): PointEvent {
  const points = milesToPoints(session.miles, rules.milesPerPoint);
  const timestamp = Number.isFinite(session.endedAt) ? session.endedAt : session.startedAt;
  const note = session.finishReason
    ? `${session.miles} mi ${session.finishReason}`
    : `${session.miles} mi`;
  return {
    id: `trk_${session.sessionId}`,
    kind: "workout",
    points,
    timestamp,
    source: "tracker",
    sessionId: session.sessionId,
    miles: session.miles,
    exerciseId: session.exerciseId || fallbackExerciseId,
    categoryId: session.categoryId || "cardio",
    note,
  };
}

/** Appends one tracker workout. Does not create catalog rows. */
export function ingestTrackerSession(profile: Profile, rawSession: unknown): IngestTrackerResult {
  const session = parseTrackerSession(rawSession);
  if (!session) return { profile, status: "rejected" };
  const eventId = `trk_${session.sessionId}`;
  const existing = profile.events.find((e) => e.sessionId === session.sessionId || e.id === eventId);
  if (existing) return { profile, status: "duplicate", event: existing };
  const event = sessionToEvent(session, profile.rules);
  if (event.points < 1) return { profile, status: "zero-points", event };
  return {
    profile: { ...profile, events: [...profile.events, event] },
    status: "added",
    event,
  };
}

export function formatIngestBatch(
  batch: Pick<IngestTrackerBatch, "added" | "duplicate" | "zeroPoints" | "rejected">,
): string {
  const parts: string[] = [];
  if (batch.added > 0) parts.push(`Added ${batch.added} ${batch.added === 1 ? "walk" : "walks"}`);
  if (batch.duplicate > 0) parts.push(`${batch.duplicate} duplicate`);
  if (batch.zeroPoints > 0) parts.push(`${batch.zeroPoints} under 1 pt`);
  if (batch.rejected > 0) parts.push(`${batch.rejected} rejected`);
  return parts.join(" · ") || "Nothing to import.";
}

/** One session, an array, `{ sessions }`, or a lab export that carries `sessions`. */
export function ingestTrackerSessions(profile: Profile, raw: unknown): IngestTrackerBatch {
  const collected = collectTrackerSessions(raw);
  let next = profile;
  let added = 0;
  let duplicate = 0;
  let zeroPoints = 0;
  let rejected = collected.rejected;
  for (const session of collected.sessions) {
    const result = ingestTrackerSession(next, session);
    next = result.profile;
    if (result.status === "added") added += 1;
    else if (result.status === "duplicate") duplicate += 1;
    else if (result.status === "zero-points") zeroPoints += 1;
    else rejected += 1;
  }
  return { profile: next, added, duplicate, zeroPoints, rejected };
}
