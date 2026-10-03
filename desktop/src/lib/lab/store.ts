import { create } from "zustand";
import { emptyLab, migrateLabPalette, presetRules, AUTHOR_PALETTE_REV } from "./defaults";
import { exportLab, parseImport, parseProfile, serializeProfile } from "./io";
import { milesToPoints, scoreToday } from "./engine";
import {
  applySleepNow,
  applyUpNow,
  localDayKey,
  manualPointTimestamp,
  setDaySleep as writeSleep,
  setDayUp as writeUp,
} from "./dates";
import {
  formatIngestBatch,
  ingestTrackerSession as ingestTrackerSessionIntoProfile,
  ingestTrackerSessions as ingestTrackerSessionsIntoProfile,
  type IngestTrackerResult,
} from "./session";
import {
  STORAGE_KEY,
  type Category,
  type EventKind,
  type EventSource,
  type Exercise,
  type LabData,
  type PlanItem,
  type PointEvent,
  type PresetId,
  type Profile,
} from "./types";

type LabState = LabData & { hydrated: boolean };

type LabActions = {
  hydrate: () => void;
  persist: () => void;
  switchProfile: (id: string) => void;
  renameProfile: (name: string) => void;
  applyPreset: (preset: PresetId) => void;
  setCap: (cap: number) => void;
  setOverflow: (overflow: boolean) => void;
  setMilesPerPoint: (value: number | null) => void;
  addCategory: (input: { name: string; color: string }) => void;
  updateCategory: (id: string, patch: Partial<Pick<Category, "name" | "color">>) => void;
  removeCategory: (id: string) => void;
  addExercise: (input: {
    name: string;
    alternateName?: string;
    categoryId: string;
    tags?: string[];
    youtube?: Exercise["youtube"];
  }) => string | null;
  updateExercise: (id: string, patch: Partial<Exercise>) => void;
  removeExercise: (id: string) => void;
  addEvent: (input: {
    kind: EventKind;
    points: number;
    categoryId?: string;
    exerciseId?: string;
    note?: string;
    timestamp?: number;
    source?: EventSource;
    sessionId?: string;
    miles?: number;
  }) => void;
  adjustToday: (input: {
    kind: EventKind;
    delta: number;
    categoryId?: string;
    exerciseId?: string;
  }) => void;
  addPointsOnDay: (input: {
    day: string;
    time?: string | null;
    kind: EventKind;
    points: number;
    categoryId?: string;
    exerciseId?: string;
  }) => void;
  setDayUp: (day: string, upAt: number) => void;
  setDaySleep: (day: string, sleepAt: number | null) => void;
  stampUpNow: () => string;
  stampSleepNow: () => void;
  logMiles: (miles: number, categoryId?: string) => void;
  ingestTrackerSession: (raw: unknown) => { status: IngestTrackerResult["status"]; summary: string };
  ingestTrackerSessions: (raw: unknown) => string;
  addPlan: (name: string) => string;
  renamePlan: (id: string, name: string) => void;
  removePlan: (id: string) => void;
  pinPlan: (id: string | null) => void;
  addPlanItem: (planId: string, input: Omit<PlanItem, "id">) => void;
  removePlanItem: (planId: string, itemId: string) => void;
  setWakeSleep: (wakeTime: string, sleepTime: string) => void;
  resetEvents: () => void;
  applyImport: (
    raw: unknown,
    mode: "replace" | "merge",
  ) => { ok: true; summary: string } | { ok: false; message: string };
  exportJson: () => string;
};

function newId() {
  return crypto.randomUUID();
}

function ingestSummary(result: IngestTrackerResult): string {
  const id = result.event?.sessionId;
  const label = id ? `Session ${id}` : "Session";
  switch (result.status) {
    case "added":
      return `Added ${result.event?.points ?? 0} pt (${result.event?.miles ?? 0} mi) from session ${id}.`;
    case "duplicate":
      return `${label} is already in the ledger.`;
    case "zero-points":
      return `${label} is under 1 point.`;
    default:
      return "Rejected: not a valid tracker session.";
  }
}

function patchActive(profiles: Profile[], id: string, fn: (p: Profile) => Profile): Profile[] {
  return profiles.map((p) => (p.id === id ? fn(p) : p));
}

function persistable(data: LabData) {
  return {
    rev: AUTHOR_PALETTE_REV,
    activeProfileId: data.activeProfileId,
    profiles: data.profiles.map(serializeProfile),
  };
}

export const useLabStore = create<LabState & LabActions>((set, get) => ({
  ...emptyLab(),
  hydrated: false,

  hydrate: () => {
    let data = emptyLab();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { profiles?: unknown[]; activeProfileId?: string };
        if (Array.isArray(parsed.profiles) && parsed.profiles.length) {
          const base = emptyLab();
          const profiles = parsed.profiles.map((p, i) =>
            parseProfile(p, base.profiles[i] ?? base.profiles[0]!),
          );
          data = { activeProfileId: parsed.activeProfileId ?? "public", profiles };
        }
      }
    } catch {
      data = emptyLab();
    }
    data = migrateLabPalette(data);
    set({ ...data, hydrated: true });
    get().persist();
  },

  persist: () => {
    if (typeof localStorage === "undefined") return;
    const s = get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable(s)));
  },

  switchProfile: (id) => {
    set({ activeProfileId: id });
    get().persist();
  },

  renameProfile: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({ ...p, name: trimmed })),
    }));
    get().persist();
  },

  applyPreset: (preset) => {
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        rules: { ...p.rules, ...presetRules(preset) },
      })),
    }));
    get().persist();
  },

  setCap: (cap) => {
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        rules: { ...p.rules, cap: Math.max(1, Math.floor(cap)) },
      })),
    }));
    get().persist();
  },

  setOverflow: (overflow) => {
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        rules: { ...p.rules, overflow },
      })),
    }));
    get().persist();
  },

  setMilesPerPoint: (value) => {
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        rules: { ...p.rules, milesPerPoint: value && value > 0 ? value : null },
      })),
    }));
    get().persist();
  },

  addCategory: ({ name, color }) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        rules: {
          ...p.rules,
          categories: [...p.rules.categories, { id: newId(), name: trimmed.toLowerCase(), color }],
        },
      })),
    }));
    get().persist();
  },

  updateCategory: (id, patch) => {
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        rules: {
          ...p.rules,
          categories: p.rules.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        },
      })),
    }));
    get().persist();
  },

  removeCategory: (id) => {
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        rules: { ...p.rules, categories: p.rules.categories.filter((c) => c.id !== id) },
      })),
    }));
    get().persist();
  },

  addExercise: (input) => {
    const name = input.name.trim();
    if (!name) return null;
    const id = newId();
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        exercises: [
          ...p.exercises,
          {
            id,
            name,
            categoryId: input.categoryId,
            tags: input.tags ?? [],
            alternateName: input.alternateName,
            youtube: input.youtube,
          },
        ],
      })),
    }));
    get().persist();
    return id;
  },

  updateExercise: (id, patch) => {
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        exercises: p.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      })),
    }));
    get().persist();
  },

  removeExercise: (id) => {
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        exercises: p.exercises.filter((e) => e.id !== id),
      })),
    }));
    get().persist();
  },

  addEvent: (input) => {
    if (input.points === 0) return;
    const ev: PointEvent = {
      id: newId(),
      kind: input.kind,
      points: input.points,
      timestamp: input.timestamp ?? Date.now(),
      categoryId: input.categoryId,
      exerciseId: input.exerciseId,
      note: input.note,
    };
    if (input.source !== undefined) ev.source = input.source;
    if (input.sessionId !== undefined) ev.sessionId = input.sessionId;
    if (input.miles !== undefined) ev.miles = input.miles;
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        events: [...p.events, ev],
      })),
    }));
    get().persist();
  },

  adjustToday: (input) => {
    if (input.delta === 0) return;
    get().addEvent({
      kind: input.kind,
      points: input.delta,
      categoryId: input.categoryId,
      exerciseId: input.exerciseId,
    });
  },

  addPointsOnDay: (input) => {
    if (!Number.isFinite(input.points) || input.points === 0) return;
    const active = get();
    const profile = active.profiles.find((p) => p.id === active.activeProfileId);
    if (!profile) return;
    const timestamp = manualPointTimestamp(profile, input.day, input.time);
    if (timestamp == null) return;
    get().addEvent({
      kind: input.kind,
      points: input.points,
      categoryId: input.categoryId,
      exerciseId: input.exerciseId,
      timestamp,
      source: "manual",
    });
  },

  setDayUp: (day, upAt) => {
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => writeUp(p, day, upAt, newId())),
    }));
    get().persist();
  },

  setDaySleep: (day, sleepAt) => {
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => writeSleep(p, day, sleepAt, newId())),
    }));
    get().persist();
  },

  stampUpNow: () => {
    const now = Date.now();
    let day = localDayKey(now);
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => {
        const result = applyUpNow(p, now, newId());
        day = result.day;
        return result.profile;
      }),
    }));
    get().persist();
    return day;
  },

  stampSleepNow: () => {
    const now = Date.now();
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => applySleepNow(p, now, newId())),
    }));
    get().persist();
  },

  logMiles: (miles, categoryId) => {
    const s = get();
    const profile = s.profiles.find((p) => p.id === s.activeProfileId);
    if (!profile) return;
    const points = milesToPoints(miles, profile.rules.milesPerPoint);
    if (points < 1) return;
    const cat =
      categoryId ??
      profile.rules.categories.find((c) => c.id === "cardio")?.id ??
      profile.rules.categories[0]?.id;
    get().addEvent({
      kind: "workout",
      points,
      categoryId: cat,
      note: `${miles} mi`,
      source: "manual",
      miles,
    });
  },

  ingestTrackerSession: (raw) => {
    const activeId = get().activeProfileId;
    const profile = get().profiles.find((p) => p.id === activeId);
    if (!profile) return { status: "rejected", summary: "No active profile." };
    const result = ingestTrackerSessionIntoProfile(profile, raw);
    if (result.status === "added") {
      const next = result.profile;
      set((s) => ({
        profiles: s.profiles.map((p) => (p.id === activeId ? next : p)),
      }));
      get().persist();
    }
    return { status: result.status, summary: ingestSummary(result) };
  },

  ingestTrackerSessions: (raw) => {
    const activeId = get().activeProfileId;
    const profile = get().profiles.find((p) => p.id === activeId);
    if (!profile) return "No active profile.";
    const result = ingestTrackerSessionsIntoProfile(profile, raw);
    if (result.added > 0) {
      const next = result.profile;
      set((s) => ({
        profiles: s.profiles.map((p) => (p.id === activeId ? next : p)),
      }));
      get().persist();
    }
    return formatIngestBatch(result);
  },

  addPlan: (name) => {
    const id = newId();
    const trimmed = name.trim() || "Untitled plan";
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        plans: [...p.plans, { id, name: trimmed, items: [] }],
        pinnedPlanId: p.pinnedPlanId ?? id,
      })),
    }));
    get().persist();
    return id;
  },

  renamePlan: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        plans: p.plans.map((plan) => (plan.id === id ? { ...plan, name: trimmed } : plan)),
      })),
    }));
    get().persist();
  },

  removePlan: (id) => {
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        plans: p.plans.filter((plan) => plan.id !== id),
        pinnedPlanId: p.pinnedPlanId === id ? null : p.pinnedPlanId,
      })),
    }));
    get().persist();
  },

  pinPlan: (id) => {
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({ ...p, pinnedPlanId: id })),
    }));
    get().persist();
  },

  addPlanItem: (planId, input) => {
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        plans: p.plans.map((plan) =>
          plan.id === planId ? { ...plan, items: [...plan.items, { ...input, id: newId() }] } : plan,
        ),
      })),
    }));
    get().persist();
  },

  removePlanItem: (planId, itemId) => {
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        plans: p.plans.map((plan) =>
          plan.id === planId
            ? { ...plan, items: plan.items.filter((item) => item.id !== itemId) }
            : plan,
        ),
      })),
    }));
    get().persist();
  },

  setWakeSleep: (wakeTime, sleepTime) => {
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        rules: { ...p.rules, wakeTime, sleepTime },
      })),
    }));
    get().persist();
  },

  resetEvents: () => {
    set((s) => ({
      profiles: patchActive(s.profiles, s.activeProfileId, (p) => ({
        ...p,
        events: [],
        historyCleared: true,
      })),
    }));
    get().persist();
  },

  applyImport: (raw, mode) => {
    const parsed = parseImport(raw);
    if (!parsed) return { ok: false, message: "Not a Workout Lab export." };
    const base = emptyLab();
    const incoming = parsed.profiles.map((p, i) =>
      parseProfile(p, base.profiles[i] ?? base.profiles[0]!),
    );
    set((s) => {
      if (mode === "replace") {
        return {
          profiles: incoming.length ? incoming : s.profiles,
          activeProfileId: parsed.activeProfileId ?? s.activeProfileId,
        };
      }
      const byId = new Map(s.profiles.map((p) => [p.id, p]));
      for (const p of incoming) byId.set(p.id, p);
      return { profiles: [...byId.values()] };
    });
    get().persist();
    return { ok: true, summary: `Imported ${incoming.length} profile(s).` };
  },

  exportJson: () => exportLab(get()),
}));

export function useActiveProfile(): Profile {
  return useLabStore((s) => s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0]!);
}

export function useTodayScore() {
  const profile = useActiveProfile();
  return scoreToday(profile);
}

void AUTHOR_PALETTE_REV;
