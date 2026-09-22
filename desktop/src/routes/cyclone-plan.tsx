import { createFileRoute } from "@tanstack/react-router";
import { CycloneView } from "@/components/views/cyclone";

export const Route = createFileRoute("/cyclone-plan")({
  component: () => <CycloneView overlay={true} />,
});
