import { Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { AddExerciseDialog, ImportJsonDialog } from "@/components/lab/dialogs";
import { EmptyState } from "@/components/lab/empty-state";
import { CatalogToolbar, useCatalogFilter } from "@/components/lab/catalog-filter";
import { catColor } from "@/components/lab/theme-vars";
import { useActiveProfile } from "@/lib/lab/store";

export function ExercisesView() {
  const child = useChildMatches();
  if (child.length > 0) return <Outlet />;
  return <ExerciseIndex />;
}

function ExerciseIndex() {
  const profile = useActiveProfile();
  const filter = useCatalogFilter(profile.exercises);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Exercises</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.visibility === "public"
              ? "Public (basic) catalog — the list that may ship on GitHub."
              : "Private (expanded) catalog — not for GitHub."}
          </p>
        </div>
        <div className="flex gap-2">
          <AddExerciseDialog />
          <ImportJsonDialog />
        </div>
      </header>
      {profile.exercises.length === 0 ? (
        <EmptyState title="No exercises in this profile yet. Import or add a catalog.">
          <AddExerciseDialog />
          <ImportJsonDialog />
        </EmptyState>
      ) : (
        <>
          <CatalogToolbar
            categories={profile.rules.categories}
            exercises={profile.exercises}
            query={filter.query}
            onQuery={filter.setQuery}
            categoryId={filter.categoryId}
            onCategory={filter.setCategoryId}
            shown={filter.filtered.length}
          />
          <ul className="divide-y divide-border rounded-2xl bg-card shadow-[var(--shadow-border)]">
            {filter.filtered.map((ex) => {
              const color = catColor(profile.rules.categories, ex.categoryId);
              return (
                <li key={ex.id}>
                  <Link
                    to="/exercises/$id"
                    params={{ id: ex.id }}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent"
                  >
                    <span className="size-2 rounded-full" style={{ background: color }} />
                    <span className="flex-1 truncate">{ex.name}</span>
                    {ex.alternateName && ex.alternateName !== ex.name ? (
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {ex.alternateName}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
