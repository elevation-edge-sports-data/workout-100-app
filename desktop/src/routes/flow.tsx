import { createFileRoute } from "@tanstack/react-router";
import { FlowView } from "@/components/views/flow";

export const Route = createFileRoute("/flow")({ component: FlowView });
