/** All day math is local-time. Days split at local midnight. */

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
