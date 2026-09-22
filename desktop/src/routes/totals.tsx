import { createFileRoute } from "@tanstack/react-router";
import { TotalsView } from "@/components/views/totals";

export const Route = createFileRoute("/totals")({ component: TotalsView });
