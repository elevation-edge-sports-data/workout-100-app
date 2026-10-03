/**
 * Calendar dates are local and split at midnight (`localDayKey`).
 * Lab days split on Up/Sleep stamps, then `rules.wakeTime`. See `labDayKey`.
 */

import type { DayStamp, Profile } from "./types";

export function localDayKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

export function startOfLocalDay(ts: number = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function noonOnDay(key: string): number {
  const d = parseDayKey(key);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

export function addDaysKey(key: string, n: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + n);
  return localDayKey(d.getTime());
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Minutes since midnight for an `HH:mm` clock. Blank or invalid uses 06:00. */
function wakeMinutes(wakeTime: string | undefined): number {
  const fallback = 6 * 60;
  if (!wakeTime) return fallback;
  const match = /^(\d{1,2}):(\d{2})$/.exec(wakeTime.trim());
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return fallback;
  return hour * 60 + minute;
}

function stampCovers(stamp: DayStamp, ts: number): boolean {
  if (!DAY_KEY.test(stamp.day) || !Number.isFinite(stamp.upAt) || ts < stamp.upAt) return false;
  if (stamp.sleepAt == null) return true;
  if (!Number.isFinite(stamp.sleepAt) || stamp.sleepAt <= stamp.upAt) return false;
  return ts < stamp.sleepAt;
}

/** No stamp covers `ts`. Split at `wakeTime` (default 06:00). Does not write a stamp. */
function fallbackLabDayKey(ts: number, wakeTime: string | undefined): string {
  const d = new Date(ts);
  const minutes = d.getHours() * 60 + d.getMinutes();
  const calendar = localDayKey(ts);
  if (minutes < wakeMinutes(wakeTime)) return addDaysKey(calendar, -1);
  return calendar;
}

/**
 * Lab day of `ts`. Stamp windows win (`upAt <= ts`, and `sleepAt` missing or `ts < sleepAt`).
 * The latest `upAt` wins; a tie keeps the later stamp. Otherwise `wakeTime`.
 */
export function labDayKey(ts: number, profile: Profile): string {
  const stamps = Array.isArray(profile.dayStamps) ? profile.dayStamps : [];
  let best: DayStamp | null = null;
  for (const stamp of stamps) {
    if (!stampCovers(stamp, ts)) continue;
    if (!best || stamp.upAt >= best.upAt) best = stamp;
  }
  if (best) return best.day;
  return fallbackLabDayKey(ts, profile.rules?.wakeTime);
}

/**
 * Set `sleepAt` on every open stamp that has already started (`upAt <= atTs`).
 * Does not create a stamp. A later screen calls this before opening another Up.
 */
export function closeOpenDay(profile: Profile, atTs: number): Profile {
  const stamps = profile.dayStamps;
  if (!Array.isArray(stamps) || stamps.length === 0 || !Number.isFinite(atTs)) return profile;
  let changed = false;
  const next = stamps.map((stamp) => {
    if (stamp.sleepAt != null || !Number.isFinite(stamp.upAt) || stamp.upAt > atTs) return stamp;
    changed = true;
    return { ...stamp, sleepAt: atTs };
  });
  if (!changed) return profile;
  return { ...profile, dayStamps: next };
}

const CLOCK = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

/** `HH:mm` on a calendar day. Invalid clocks return null. */
export function timeOnDay(day: string, hhmm: string | null | undefined): number | null {
  if (!DAY_KEY.test(day) || hhmm == null) return null;
  const match = CLOCK.exec(hhmm.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const d = parseDayKey(day);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

export function formatClock(ts: number): string {
  const d = new Date(ts);
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function latestStampOnDay(stamps: DayStamp[], day: string): DayStamp | undefined {
  let best: DayStamp | undefined;
  for (const stamp of stamps) {
    if (stamp.day !== day) continue;
    if (!best || stamp.upAt >= best.upAt) best = stamp;
  }
  return best;
}

export function stampOnDay(profile: Profile, day: string): DayStamp | undefined {
  return latestStampOnDay(profile.dayStamps ?? [], day);
}

function openStamp(id: string, day: string, upAt: number): DayStamp {
  return { id, day, upAt };
}

/**
 * Write Up for `day`. A new stamp closes any other open day at `upAt`.
 * Editing the day's existing stamp does not close it.
 */
export function setDayUp(profile: Profile, day: string, upAt: number, newId: string): Profile {
  if (!DAY_KEY.test(day) || !Number.isFinite(upAt) || newId.length === 0) return profile;
  const stamps = profile.dayStamps ?? [];
  const existing = latestStampOnDay(stamps, day);
  const dayKey = localDayKey(upAt);
  if (existing) {
    const sleepAt = existing.sleepAt != null && existing.sleepAt > upAt ? existing.sleepAt : undefined;
    if (existing.upAt === upAt && existing.day === dayKey && existing.sleepAt === sleepAt) return profile;
    const updated: DayStamp =
      sleepAt == null ? openStamp(existing.id, dayKey, upAt) : { id: existing.id, day: dayKey, upAt, sleepAt };
    return {
      ...profile,
      dayStamps: stamps.map((stamp) => (stamp.id === existing.id ? updated : stamp)),
    };
  }
  const closed = closeOpenDay(profile, upAt);
  return { ...closed, dayStamps: [...(closed.dayStamps ?? []), openStamp(newId, dayKey, upAt)] };
}

/**
 * Sleep clock on `day`. A clock that is not after Up lands on the next calendar date.
 */
export function sleepInstant(day: string, hhmm: string, upAt: number): number | null {
  const same = timeOnDay(day, hhmm);
  if (same == null || !Number.isFinite(upAt)) return null;
  if (same > upAt) return same;
  const next = timeOnDay(addDaysKey(day, 1), hhmm);
  if (next != null && next > upAt) return next;
  return null;
}

/** `sleepAt` null clears Sleep and leaves the stamp open. No stamp yet uses the fallback wake time as Up. */
export function setDaySleep(profile: Profile, day: string, sleepAt: number | null, newId: string): Profile {
  if (!DAY_KEY.test(day)) return profile;
  const stamps = profile.dayStamps ?? [];
  const existing = latestStampOnDay(stamps, day);
  if (sleepAt == null) {
    if (!existing || existing.sleepAt == null) return profile;
    return {
      ...profile,
      dayStamps: stamps.map((stamp) =>
        stamp.id === existing.id ? openStamp(stamp.id, stamp.day, stamp.upAt) : stamp,
      ),
    };
  }
  if (!Number.isFinite(sleepAt) || newId.length === 0) return profile;
  if (!existing) {
    const upAt = timeOnDay(day, profile.rules?.wakeTime) ?? timeOnDay(day, "06:00");
    if (upAt == null || sleepAt <= upAt) return profile;
    const stamp: DayStamp = { id: newId, day: localDayKey(upAt), upAt, sleepAt };
    return { ...profile, dayStamps: [...stamps, stamp] };
  }
  if (sleepAt <= existing.upAt || existing.sleepAt === sleepAt) return profile;
  return {
    ...profile,
    dayStamps: stamps.map((stamp) => (stamp.id === existing.id ? { ...stamp, sleepAt } : stamp)),
  };
}

/**
 * Up at `now`. The stamp day is the local date of that instant.
 * An earlier open stamp is closed at `now`.
 */
export function applyUpNow(profile: Profile, now: number, newId: string): { profile: Profile; day: string } {
  if (!Number.isFinite(now)) return { profile, day: labDayKey(0, profile) };
  const day = localDayKey(now);
  return { profile: setDayUp(profile, day, now, newId), day };
}

/** Sleep at `now` on the lab day that contains `now`. */
export function applySleepNow(profile: Profile, now: number, newId: string): Profile {
  if (!Number.isFinite(now)) return profile;
  return setDaySleep(profile, labDayKey(now, profile), now, newId);
}

/**
 * Point time on a lab day. Blank uses noon when that noon belongs to `day`,
 * otherwise Up, otherwise the fallback wake time. A clock uses that time on
 * `day`, or the next calendar date when that is the instant on the lab day.
 * Returns null when the instant would score on a different day.
 */
export function manualPointTimestamp(profile: Profile, day: string, hhmm?: string | null): number | null {
  if (!DAY_KEY.test(day)) return null;
  const trimmed = hhmm?.trim() ?? "";
  if (!trimmed) {
    const noon = noonOnDay(day);
    if (labDayKey(noon, profile) === day) return noon;
    const stamp = latestStampOnDay(profile.dayStamps ?? [], day);
    if (stamp && labDayKey(stamp.upAt, profile) === day) return stamp.upAt;
    const wake = timeOnDay(day, profile.rules?.wakeTime) ?? timeOnDay(day, "06:00");
    if (wake != null && labDayKey(wake, profile) === day) return wake;
    return null;
  }
  const same = timeOnDay(day, trimmed);
  if (same == null) return null;
  if (labDayKey(same, profile) === day) return same;
  const next = timeOnDay(addDaysKey(day, 1), trimmed);
  if (next != null && labDayKey(next, profile) === day) return next;
  return null;
}

export function dayKeysInclusive(from: string, to: string): string[] {
  if (from > to) return [];
  const keys: string[] = [];
  let k = from;
  while (k <= to) {
    keys.push(k);
    k = addDaysKey(k, 1);
    if (keys.length > 40000) break;
  }
  return keys;
}

export function calendarDaysBetween(fromKey: string, toKey: string): number {
  const a = parseDayKey(fromKey).getTime();
  const b = parseDayKey(toKey).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function formatDayLabel(key: string): string {
  return parseDayKey(key).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDayShort(key: string): string {
  return parseDayKey(key).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
  });
}

export function weekdayLetter(key: string): string {
  return parseDayKey(key).toLocaleDateString(undefined, { weekday: "narrow" });
}

/** 0 = Sunday … 6 = Saturday, local. */
export function weekdayIndex(key: string): number {
  return parseDayKey(key).getDay();
}

export const WEEKDAY_CHIPS = [
  { id: 1, label: "Mon" },
  { id: 2, label: "Tue" },
  { id: 3, label: "Wed" },
  { id: 4, label: "Thu" },
  { id: 5, label: "Fri" },
  { id: 6, label: "Sat" },
  { id: 0, label: "Sun" },
] as const;

/** Empty set = every weekday. */
export function weekdayAllowed(dayKey: string, selected: ReadonlySet<number>): boolean {
  if (selected.size === 0) return true;
  return selected.has(weekdayIndex(dayKey));
}
