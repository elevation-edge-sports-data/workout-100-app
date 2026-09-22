import { createFileRoute } from "@tanstack/react-router";
import { MatrixView } from "@/components/views/matrix";

export const Route = createFileRoute("/matrix")({ component: MatrixView });
