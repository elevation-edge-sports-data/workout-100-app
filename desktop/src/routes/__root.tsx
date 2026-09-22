import { Outlet, createRootRoute } from "@tanstack/react-router";
import { LabShell } from "@/components/lab/shell";
import { AppErrorComponent } from "@/lib/error-component";

export const Route = createRootRoute({
  component: () => (
    <LabShell>
      <Outlet />
    </LabShell>
  ),
  errorComponent: AppErrorComponent,
});
