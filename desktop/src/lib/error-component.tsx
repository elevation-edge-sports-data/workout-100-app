import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: { error: unknown }) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "An unexpected error occurred. Try reloading the page.";
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
      <TriangleAlert className="size-10 text-destructive" strokeWidth={2} />
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-muted-foreground">{message}</p>
    </main>
  );
}