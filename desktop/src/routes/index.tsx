import { createFileRoute } from "@tanstack/react-router";
import { TodayView } from "@/components/views/today";

export const Route = createFileRoute("/")({ component: TodayView });
