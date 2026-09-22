import type { Category, Exercise, LabData, PresetId, Profile, Rules } from "./types";
import { PUBLIC_CATALOG } from "./catalog";

export const CAT_CARDIO = "#FF3399";
export const CAT_CORE = "#ED7D31";
export const CAT_LEGS = "#009999";
export const CAT_ARMS = "#0070C0";

/** Bump when author palette, categories, or the public catalog change. */
export const AUTHOR_PALETTE_REV = 1;

export function authorCategories(): Category[] {
  return [
    { id: "cardio", name: "cardio", color: CAT_CARDIO },
    { id: "core", name: "core", color: CAT_CORE },
    { id: "legs", name: "legs", color: CAT_LEGS },
    { id: "arms", name: "arms", color: CAT_ARMS },
  ];
}

export function cloneCatalog(src: Exercise[]): Exercise[] {
  return src.map((e) => ({
    ...e,
    tags: [...e.tags],
    youtube: e.youtube?.map((v) => ({ ...v })),
  }));
}

function baseRules(): Rules {
  return {
    cap: 100,
    overflow: true,
    milesPerPoint: 0.25,
    categories: authorCategories(),
    wakeTime: "06:00",
    sleepTime: "22:00",
  };
}

export function presetRules(id: PresetId): Partial<Rules> {
  if (id === "strict-80") return { cap: 80, overflow: true };
  if (id === "wide-120") return { cap: 120, overflow: true };
  return { cap: 100, overflow: true };
}

function emptyShell(id: string, name: string, visibility: Profile["visibility"]): Profile {
  return {
    id,
    name,
    visibility,
    rules: baseRules(),
    exercises: [],
    events: [],
    plans: [],
    pinnedPlanId: null,
  };
}

export function publicProfile(): Profile {
  return emptyShell("public", "Public (basic)", "public");
}

export function emptyLab(): LabData {
  return {
    activeProfileId: "public",
    profiles: [publicProfile()],
  };
}

function seedPublicCatalog(profile: Profile): Profile {
  if (profile.id !== "public") return profile;
  const catalogIds = new Set(PUBLIC_CATALOG.map((e) => e.id));
  const extra = profile.exercises.filter((e) => !catalogIds.has(e.id));
  return { ...profile, exercises: [...cloneCatalog(PUBLIC_CATALOG), ...extra] };
}

function migrateAuthorPalette(profile: Profile): Profile {
  const cats = authorCategories();
  const byId = new Map(cats.map((c) => [c.id, c]));
  const merged = profile.rules.categories
    .filter((c) => c.id !== "misc")
    .map((c) => (byId.has(c.id) ? { ...c, color: byId.get(c.id)!.color, name: byId.get(c.id)!.name } : c));
  const have = new Set(merged.map((c) => c.id));
  for (const c of cats) if (!have.has(c.id)) merged.push(c);
  const miles = profile.rules.milesPerPoint;
  return {
    ...profile,
    rules: {
      ...profile.rules,
      categories: merged,
      milesPerPoint: miles && miles > 0 ? miles : 0.25,
    },
  };
}

export function migrateLabPalette(data: LabData): LabData {
  let profiles = data.profiles.map(migrateAuthorPalette).map(seedPublicCatalog);
  if (!profiles.some((p) => p.id === "public")) profiles = [publicProfile(), ...profiles];
  const active = profiles.some((p) => p.id === data.activeProfileId)
    ? data.activeProfileId
    : "public";
  return { ...data, profiles, activeProfileId: active };
}
