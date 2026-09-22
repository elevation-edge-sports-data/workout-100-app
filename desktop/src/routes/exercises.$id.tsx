import { createFileRoute } from "@tanstack/react-router";
import { ExerciseDetailView } from "@/components/views/exercise-detail";

export const Route = createFileRoute("/exercises/$id")({ component: ExerciseDetailView });
