import type {
  CycloneRow,
  DayScore,
  FlowPoint,
  MatrixSort,
  PointEvent,
  Profile,
  TotalsDay,
  WorkoutIndex,
} from "./types";
import { CYCLONE_DAYS, MATRIX_DAYS, STALE_AFTER_DAYS } from "./types";
import {
  addDaysKey,
  calendarDaysBetween,
  dayKeysInclusive,
  formatDayShort,
  labDayKey,
  localDayKey,
  startOfLocalDay,
  weekdayAllowed,
} from "./dates";

export function emptyDayScore(day: string): DayScore {
  return {
    day,
    rawWorkout: 0,
    incoming: 0,
    towardCap: 0,
    overflowOut: 0,
    work: 0,
    reward: 0,
    byCategory: {},
  };
}

export function milesToPoints(miles: number, milesPerPoint: number | null): number {
  if (!milesPerPoint || milesPerPoint <= 0) return 0;
  return Math.floor(miles / milesPerPoint);
}

export function indexWorkouts(events: PointEvent[]): WorkoutIndex {
  const points = new Map<string, Map<string, number>>();
  const lastAt = new Map<string, number>();
  for (const e of events) {
    if (e.kind !== "workout" || !e.exerciseId || e.points <= 0) continue;
    const day = localDayKey(e.timestamp);
    let m = points.get(e.exerciseId);
    if (!m) {
      m = new Map();
      points.set(e.exerciseId, m);
    }
    m.set(day, (m.get(day) ?? 0) + e.points);
    const prev = lastAt.get(e.exerciseId) ?? 0;
    if (e.timestamp > prev) lastAt.set(e.exerciseId, e.timestamp);
  }
  return { points, lastAt };
}

/** Group events and carry overflow by lab day (Up → Sleep, else wakeTime). */
export function scoreDays(profile: Profile, throughDay?: string): Map<string, DayScore> {
  const cap = Math.max(1, profile.rules.cap);
  const overflowOn = profile.rules.overflow;
  const end = throughDay ?? labDayKey(Date.now(), profile);
  const byDay = new Map<string, PointEvent[]>();
  let minDay: string | null = null;
  for (const e of profile.events) {
    const day = labDayKey(e.timestamp, profile);
    if (day > end) continue;
    const list = byDay.get(day);
    if (list) list.push(e);
    else byDay.set(day, [e]);
    if (!minDay || day < minDay) minDay = day;
  }
  const out = new Map<string, DayScore>();
  if (!minDay) {
    out.set(end, emptyDayScore(end));
    return out;
  }
  let incoming = 0;
  let day = minDay;
  while (day <= end) {
    const s = emptyDayScore(day);
    s.incoming = overflowOn ? incoming : 0;
    const list = byDay.get(day) ?? [];
    for (const e of list) {
      if (e.kind === "workout") {
        s.rawWorkout += e.points;
        if (e.categoryId) s.byCategory[e.categoryId] = (s.byCategory[e.categoryId] ?? 0) + e.points;
      } else if (e.kind === "work") s.work += e.points;
      else s.reward += e.points;
    }
    const total = s.rawWorkout + s.incoming;
    s.towardCap = Math.min(cap, total);
    s.overflowOut = overflowOn ? Math.max(0, total - cap) : 0;
    incoming = s.overflowOut;
    out.set(day, s);
    if (day === end) break;
    day = addDaysKey(day, 1);
    if (out.size > 40000) break;
  }
  if (!out.has(end)) out.set(end, emptyDayScore(end));
  return out;
}

export function scoreToday(profile: Profile, now = Date.now()) {
  return scoreOnDay(profile, labDayKey(now, profile));
}

export function scoreOnDay(profile: Profile, day: string): DayScore {
  const scores = scoreDays(profile, day);
  return scores.get(day) ?? emptyDayScore(day);
}

/** Miles on a lab day. Tracker walks, and any event that already carries miles. */
export function milesOnDay(profile: Profile, day: string): number {
  let sum = 0;
  for (const event of profile.events) {
    if (labDayKey(event.timestamp, profile) !== day) continue;
    const miles = event.miles;
    const hasMiles = typeof miles === "number" && Number.isFinite(miles) && miles > 0;
    if (event.source !== "tracker" && !hasMiles) continue;
    if (!hasMiles || typeof miles !== "number") continue;
    sum += miles;
  }
  return sum;
}

export function milesToday(profile: Profile, now = Date.now()): number {
  return milesOnDay(profile, labDayKey(now, profile));
}

export function formatMiles(miles: number): string {
  const rounded = Math.round(miles * 100) / 100;
  return String(rounded);
}

export function cycloneRows(
  profile: Profile,
  opts: { now?: number; overlayPlan?: boolean; days?: number } = {},
): CycloneRow[] {
  const now = opts.now ?? Date.now();
  const days = opts.days ?? CYCLONE_DAYS;
  const end = localDayKey(now);
  const start = addDaysKey(end, -(days - 1));
  const window = dayKeysInclusive(start, end);
  const index = indexWorkouts(profile.events);
  const today = end;
  const pinned = opts.overlayPlan
    ? profile.plans.find((p) => p.id === profile.pinnedPlanId)
    : undefined;
  const plannedIds = new Set(pinned?.items.map((i) => i.exerciseId) ?? []);

  const rows: CycloneRow[] = profile.exercises.map((exercise) => {
    const realAt = index.lastAt.get(exercise.id) ?? null;
    const dayMap = index.points.get(exercise.id);
    const neverDone = realAt === null;
    const lastDay = realAt ? localDayKey(realAt) : null;
    const daysSince = lastDay ? calendarDaysBetween(lastDay, today) : null;
    const doneToday = (dayMap?.get(today) ?? 0) > 0;
    const plannedUnsatisfied = plannedIds.has(exercise.id) && !doneToday;
    const effective = plannedUnsatisfied ? now : realAt;
    const stale = neverDone || (daysSince !== null && daysSince >= STALE_AFTER_DAYS);
    const cells = window.map((day) => {
      const pts = dayMap?.get(day) ?? 0;
      return {
        day,
        points: pts > 0 ? pts : null,
        planned: plannedUnsatisfied && day === today && pts === 0,
        categoryId: exercise.categoryId,
      };
    });
    return {
      exercise,
      lastRealAt: realAt,
      lastEffectiveAt: effective,
      neverDone,
      daysSince,
      stale: plannedUnsatisfied ? false : stale,
      plannedUnsatisfied,
      cells,
    };
  });

  rows.sort((a, b) => {
    const aT = a.lastEffectiveAt;
    const bT = b.lastEffectiveAt;
    if (aT === null && bT === null) return a.exercise.name.localeCompare(b.exercise.name);
    if (aT === null) return -1;
    if (bT === null) return 1;
    if (aT !== bT) return aT - bT;
    return a.exercise.name.localeCompare(b.exercise.name);
  });
  return rows;
}

export function matrixRows(
  profile: Profile,
  opts: {
    now?: number;
    days?: number;
    offset?: number;
    weekdays?: ReadonlySet<number>;
    sort?: MatrixSort;
  } = {},
) {
  const now = opts.now ?? Date.now();
  const days = opts.days ?? MATRIX_DAYS;
  const offset = Math.max(0, opts.offset ?? 0);
  const end = addDaysKey(localDayKey(now), -offset);
  const start = addDaysKey(end, -(days - 1));
  const weekdays = opts.weekdays ?? new Set<number>();
  const window = dayKeysInclusive(start, end).filter((day) => weekdayAllowed(day, weekdays));
  const catOrder = new Map(profile.rules.categories.map((c, i) => [c.id, i]));
  const index = indexWorkouts(profile.events);

  const rows = profile.exercises.map((exercise) => {
    const cells = window.map((day) => {
      const pts = index.points.get(exercise.id)?.get(day) ?? 0;
      return { day, points: pts > 0 ? pts : null, categoryId: exercise.categoryId };
    });
    const volume = cells.reduce((n, c) => n + (c.points ?? 0), 0);
    return { exercise, cells, volume };
  });

  const sort = opts.sort ?? "alpha-cat";
  rows.sort((a, b) => {
    if (sort === "alpha-all") return a.exercise.name.localeCompare(b.exercise.name);
    if (sort === "vol-all") {
      if (b.volume !== a.volume) return b.volume - a.volume;
      return a.exercise.name.localeCompare(b.exercise.name);
    }
    const ai = catOrder.get(a.exercise.categoryId) ?? 999;
    const bi = catOrder.get(b.exercise.categoryId) ?? 999;
    if (ai !== bi) return ai - bi;
    if (sort === "vol-cat") {
      if (b.volume !== a.volume) return b.volume - a.volume;
      return a.exercise.name.localeCompare(b.exercise.name);
    }
    return a.exercise.name.localeCompare(b.exercise.name);
  });

  return { days: window, rows, start, end };
}

export type RankRow = {
  exercise: Profile["exercises"][number];
  points: number;
};

export function rankRows(
  profile: Profile,
  opts: { now?: number; days: number; weekdays?: ReadonlySet<number> },
): RankRow[] {
  const now = opts.now ?? Date.now();
  const end = localDayKey(now);
  const start = addDaysKey(end, -(opts.days - 1));
  const weekdays = opts.weekdays ?? new Set<number>();
  const index = indexWorkouts(profile.events);
  const rows: RankRow[] = profile.exercises.map((exercise) => {
    let points = 0;
    const m = index.points.get(exercise.id);
    if (m) {
      for (const [day, n] of m) {
        if (day < start || day > end) continue;
        if (!weekdayAllowed(day, weekdays)) continue;
        points += n;
      }
    }
    return { exercise, points };
  });
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.exercise.name.localeCompare(b.exercise.name);
  });
  return rows;
}

export function totalsWindow(profile: Profile, days = 14, now: number = Date.now()): TotalsDay[] {
  const end = localDayKey(now);
  const start = addDaysKey(end, -(days - 1));
  const scores = scoreDays(profile, end);
  return dayKeysInclusive(start, end).map((day) => {
    const s = scores.get(day);
    return {
      day,
      label: formatDayShort(day),
      workout: s?.rawWorkout ?? 0,
      work: s?.work ?? 0,
      reward: s?.reward ?? 0,
      byCategory: s?.byCategory ?? {},
    };
  });
}

export function flowSeries(profile: Profile, now: number = Date.now()): FlowPoint[] {
  const relevant = profile.events
    .filter((e) => e.points > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (relevant.length === 0) return [];
  const origin = startOfLocalDay(relevant[0]!.timestamp);
  const hourOf = (ts: number) => Math.max(0, Math.floor((ts - origin) / 3_600_000));
  const lastHour = hourOf(now);
  let w = 0,
    k = 0,
    r = 0;
  const raw: FlowPoint[] = [{ hour: 0, workout: 0, work: 0, reward: 0 }];
  for (const e of relevant) {
    if (e.timestamp > now) break;
    const h = hourOf(e.timestamp);
    if (e.kind === "workout") w += e.points;
    else if (e.kind === "work") k += e.points;
    else r += e.points;
    const prev = raw[raw.length - 1]!;
    if (prev.hour === h) {
      prev.workout = w;
      prev.work = k;
      prev.reward = r;
    } else {
      raw.push({ hour: h, workout: w, work: k, reward: r });
    }
  }
  if (raw[raw.length - 1]!.hour !== lastHour) {
    raw.push({ hour: lastHour, workout: w, work: k, reward: r });
  }
  if (raw.length <= 400) return raw;
  const step = Math.ceil(raw.length / 400);
  const sampled = raw.filter((_, i) => i % step === 0 || i === raw.length - 1);
  return sampled;
}
