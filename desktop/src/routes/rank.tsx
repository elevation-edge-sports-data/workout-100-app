import { createFileRoute } from "@tanstack/react-router";
import { RankView } from "@/components/views/rank";

export const Route = createFileRoute("/rank")({ component: RankView });
