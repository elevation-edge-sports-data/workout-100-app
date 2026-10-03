import { ON_FOOT_EXERCISE_ID, type Exercise } from "./types";

const ON_FOOT: Exercise = {
  id: ON_FOOT_EXERCISE_ID,
  name: "On foot",
  categoryId: "cardio",
  tags: ["tracker", "walk", "jog"],
};

/** Public names. Seed On foot when this list is empty or missing that id. */
const PUBLIC_EXERCISES: Exercise[] = [];

export const PUBLIC_CATALOG: Exercise[] = PUBLIC_EXERCISES.some((e) => e.id === ON_FOOT_EXERCISE_ID)
  ? PUBLIC_EXERCISES
  : [ON_FOOT, ...PUBLIC_EXERCISES];
