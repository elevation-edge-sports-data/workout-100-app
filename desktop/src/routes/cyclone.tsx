import { createFileRoute } from "@tanstack/react-router";
import { CycloneView } from "@/components/views/cyclone";

export const Route = createFileRoute("/cyclone")({
  component: () => <CycloneView overlay={false} />,
});
