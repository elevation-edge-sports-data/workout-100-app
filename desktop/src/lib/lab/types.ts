export type EventKind = "workout" | "work" | "reward";

export type YoutubeRef = {
  url: string;
  title?: string;
  channel?: string;
};

export type Category = {
  id: string;
  name: string;
  color: string;
};

export type Exercise = {
  id: string;
  name: string;
  categoryId: string;
  tags: string[];
  alternateName?: string;
  youtube?: YoutubeRef[];
};

export type EventSource = "manual" | "tracker";

export type PointEvent = {
  id: string;
  kind: EventKind;
  points: number;
  timestamp: number;
  categoryId?: string;
  exerciseId?: string;
  note?: string;
  source?: EventSource;
  sessionId?: string;
  miles?: number;
};

export type PlanItem = {
  id: string;
  exerciseId: string;
};

export type Plan = {
  id: string;
  name: string;
  items: PlanItem[];
};

export type Rules = {
  cap: number;
  overflow: boolean;
  milesPerPoint: number | null;
  categories: Category[];
  wakeTime: string;
  sleepTime: string;
};

/** One lab day, from Up to Sleep. `day` is the local date of `upAt`. */
export type DayStamp = {
  id: string;
  day: string;
  upAt: number;
  sleepAt?: number;
};

export type ProfileVisibility = "public" | "private";

export type Profile = {
  id: string;
  name: string;
  visibility: ProfileVisibility;
  rules: Rules;
  exercises: Exercise[];
  events: PointEvent[];
  plans: Plan[];
  pinnedPlanId: string | null;
  historyCleared?: boolean;
  dayStamps?: DayStamp[];
};

export type LabData = {
  activeProfileId: string;
  profiles: Profile[];
};

export type PresetId = "standard-100" | "strict-80" | "wide-120";

export type DayScore = {
  day: string;
  rawWorkout: number;
  incoming: number;
  towardCap: number;
  overflowOut: number;
  work: number;
  reward: number;
  byCategory: Record<string, number>;
};

export type CycloneCell = {
  day: string;
  points: number | null;
  planned: boolean;
  categoryId: string;
};

export type CycloneRow = {
  exercise: Exercise;
  lastRealAt: number | null;
  lastEffectiveAt: number | null;
  neverDone: boolean;
  daysSince: number | null;
  stale: boolean;
  plannedUnsatisfied: boolean;
  cells: CycloneCell[];
};

export type FlowPoint = {
  hour: number;
  workout: number;
  work: number;
  reward: number;
};

export type TotalsDay = {
  day: string;
  label: string;
  workout: number;
  work: number;
  reward: number;
  byCategory: Record<string, number>;
};

export type WorkoutIndex = {
  points: Map<string, Map<string, number>>;
  lastAt: Map<string, number>;
};

export type MatrixSort = "alpha-cat" | "vol-cat" | "vol-all" | "alpha-all";
export type RankRangeId = "year" | "6m" | "3m" | "1m";

export const RANK_RANGES: { id: RankRangeId; label: string; days: number }[] = [
  { id: "year", label: "Past year", days: 365 },
  { id: "6m", label: "6 months", days: 182 },
  { id: "3m", label: "3 months", days: 90 },
  { id: "1m", label: "1 month", days: 30 },
];

export const STORAGE_KEY = "workout-lab-100.v1";
export const APP_ID = "workout-lab-100";
export const ON_FOOT_EXERCISE_ID = "on-foot";
export const SESSION_SCHEMA = "session.v2";
export const LAB_EXPORT_VERSION = 1;
export const STALE_AFTER_DAYS = 7;
export const CYCLONE_DAYS = 14;
export const MATRIX_DAYS = 14;
