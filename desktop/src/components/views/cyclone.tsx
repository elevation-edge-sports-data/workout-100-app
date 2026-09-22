import { useMemo, useState } from "react";
import { AddExerciseDialog, ImportJsonDialog } from "@/components/lab/dialogs";
import { EmptyState } from "@/components/lab/empty-state";
import { CycloneGrid } from "@/components/lab/cyclone-grid";
import { CatalogToolbar, useCatalogFilter } from "@/components/lab/catalog-filter";
import { cycloneRows } from "@/lib/lab/engine";
import { useActiveProfile, useLabStore } from "@/lib/lab/store";

export function CycloneView({ overlay }: { overlay: boolean }) {
  const profile = useActiveProfile();
  const rows = useMemo(
    () => cycloneRows(profile, { overlayPlan: overlay }),
    [profile, overlay],
  );
  const filter = useCatalogFilter(profile.exercises);
  const visible = useMemo(() => {
    const ids = new Set(filter.filtered.map((e) => e.id));
    return rows.filter((r) => ids.has(r.exercise.id));
  }, [rows, filter.filtered]);
  const pinned = profile.plans.find((p) => p.id === profile.pinnedPlanId);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">
            {overlay ? "Cyclone + Plan" : "Cyclone"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {overlay
              ? "Same recency grid, plus the pinned plan as a preview. Planned-but-not-done cells show a dashed P. Overlay never writes events or overflow."
              : "Live recency from real events only. Least-recent and never-done at the top."}
          </p>
        </div>
        <div className="flex gap-2">
          <AddExerciseDialog />
          <ImportJsonDialog />
        </div>
      </header>

      {overlay ? <PlanBar /> : null}

      {profile.exercises.length === 0 ? (
        <EmptyState title="No exercises in this profile yet. Import or add a catalog.">
          <AddExerciseDialog />
          <ImportJsonDialog />
        </EmptyState>
      ) : (
        <>
          {overlay && !pinned ? (
            <p className="text-sm text-muted-foreground">
              Pin a plan in the bar above to preview remainder. Until then this is real recency only.
            </p>
          ) : null}
          <CatalogToolbar
            categories={profile.rules.categories}
            exercises={profile.exercises}
            query={filter.query}
            onQuery={filter.setQuery}
            categoryId={filter.categoryId}
            onCategory={filter.setCategoryId}
            shown={visible.length}
          />
          <CycloneGrid
            profile={profile}
            rows={visible}
            overlay={overlay}
            days={rows[0]?.cells.map((c) => c.day)}
          />
        </>
      )}
    </div>
  );
}

function PlanBar() {
  const profile = useActiveProfile();
  const addPlan = useLabStore((s) => s.addPlan);
  const pinPlan = useLabStore((s) => s.pinPlan);
  const addPlanItem = useLabStore((s) => s.addPlanItem);
  const removePlanItem = useLabStore((s) => s.removePlanItem);
  const removePlan = useLabStore((s) => s.removePlan);
  const pinned = profile.plans.find((p) => p.id === profile.pinnedPlanId);
  const [planName, setPlanName] = useState("");
  const [addQuery, setAddQuery] = useState("");
  const addMatches = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    const used = new Set(pinned?.items.map((i) => i.exerciseId) ?? []);
    return profile.exercises
      .filter((ex) => !used.has(ex.id))
      .filter((ex) => {
        if (!q) return true;
        return `${ex.name} ${ex.alternateName ?? ""}`.toLowerCase().includes(q);
      })
      .slice(0, 12);
  }, [addQuery, pinned, profile.exercises]);

  return (
    <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
      <p className="mb-3 text-sm text-muted-foreground">
        Type a plan name, hit Create (it pins automatically), then search and add exercises.
        Completing an exercise today clears its P mark. Overlay does not log points.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Pinned plan</span>
          <select
            className="flex h-10 min-w-48 rounded-md bg-secondary px-3 text-sm shadow-[var(--shadow-border)]"
            value={profile.pinnedPlanId ?? ""}
            onChange={(e) => pinPlan(e.target.value || null)}
          >
            <option value="">None</option>
            {profile.plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = planName.trim();
            if (!name) return;
            const id = addPlan(name);
            pinPlan(id);
            setPlanName("");
          }}
        >
          <input
            className="flex h-10 rounded-md bg-secondary px-3 text-sm shadow-[var(--shadow-border)]"
            placeholder="New plan name"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
          />
          <button
            type="submit"
            className="h-10 rounded-md bg-primary px-3 text-sm text-primary-foreground"
          >
            Create
          </button>
        </form>
        {pinned ? (
          <button
            type="button"
            className="h-10 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => removePlan(pinned.id)}
          >
            Delete pinned
          </button>
        ) : null}
      </div>
      {pinned ? (
        <div className="mt-4">
          <ul className="divide-y divide-border">
            {pinned.items.map((item) => {
              const ex = profile.exercises.find((e) => e.id === item.exerciseId);
              return (
                <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{ex?.name ?? item.exerciseId}</span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => removePlanItem(pinned.id, item.id)}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="pt-3">
            <input
              className="flex h-10 w-full max-w-md rounded-md bg-secondary px-3 text-sm shadow-[var(--shadow-border)]"
              placeholder="Search catalog to add…"
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
            />
            {addQuery.trim() ? (
              <ul className="mt-2 max-w-md divide-y divide-border rounded-md bg-secondary">
                {addMatches.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">No match.</li>
                ) : (
                  addMatches.map((ex) => (
                    <li key={ex.id}>
                      <button
                        type="button"
                        className="flex w-full px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => {
                          addPlanItem(pinned.id, { exerciseId: ex.id });
                          setAddQuery("");
                        }}
                      >
                        {ex.name}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Start typing an exercise name to add it to this plan.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
