import { createFileRoute } from "@tanstack/react-router";
import { ExercisesView } from "@/components/views/exercises";

export const Route = createFileRoute("/exercises")({ component: ExercisesView });
