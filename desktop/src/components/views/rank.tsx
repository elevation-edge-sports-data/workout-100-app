import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AddExerciseDialog, ImportJsonDialog } from "@/components/lab/dialogs";
import { EmptyState } from "@/components/lab/empty-state";
import { catColor } from "@/components/lab/theme-vars";
import { CatalogToolbar, useCatalogFilter } from "@/components/lab/catalog-filter";
import { WeekdayFilter, useWeekdayFilter } from "@/components/lab/weekday-filter";
import { cn } from "@/lib/cn";
import { rankRows } from "@/lib/lab/engine";
import { RANK_RANGES, type RankRangeId } from "@/lib/lab/types";
import { useActiveProfile } from "@/lib/lab/store";

export function RankView() {
  const profile = useActiveProfile();
  const [rangeId, setRangeId] = useState<RankRangeId>("year");
  const weekdays = useWeekdayFilter();
  const range = RANK_RANGES.find((r) => r.id === rangeId) ?? RANK_RANGES[0]!;
  const filter = useCatalogFilter(profile.exercises);
  const rows = useMemo(
    () => rankRows(profile, { days: range.days, weekdays: weekdays.selected }),
    [profile, range.days, weekdays.selected],
  );
  const visible = useMemo(() => {
    const ids = new Set(filter.filtered.map((e) => e.id));
    return rows.filter((r) => ids.has(r.exercise.id));
  }, [rows, filter.filtered]);
  const max = visible.reduce((n, r) => Math.max(n, r.points), 0);
  const totalPts = visible.reduce((n, r) => n + r.points, 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Rank</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Most to least in the selected window. Bars use category color.
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
          <div className="flex flex-wrap items-center gap-1.5">
            {RANK_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRangeId(r.id)}
                className={cn(
                  "rounded-full px-3 py-1 font-mono text-[11px] tracking-wide uppercase",
                  r.id === rangeId
                    ? "bg-accent text-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-accent",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <WeekdayFilter days={weekdays.days} onToggle={weekdays.toggle} onClear={weekdays.clear} />
          <CatalogToolbar
            categories={profile.rules.categories}
            exercises={profile.exercises}
            query={filter.query}
            onQuery={filter.setQuery}
            categoryId={filter.categoryId}
            onCategory={filter.setCategoryId}
            shown={visible.length}
          />
          <p className="font-mono text-[11px] text-muted-foreground">
            {range.label}
            {weekdays.days.length ? " · filtered weekdays" : ""} · {totalPts} pts across{" "}
            {visible.length}
          </p>
          <div className="rounded-2xl bg-card shadow-[var(--shadow-border)]">
            <ol className="divide-y divide-border/60">
              {visible.map((row, i) => {
                const color = catColor(profile.rules.categories, row.exercise.categoryId);
                const pct = max > 0 ? (row.points / max) * 100 : 0;
                return (
                  <li key={row.exercise.id} className="flex items-center gap-3 px-4 py-2">
                    <span className="w-8 shrink-0 font-mono text-[11px] text-muted-foreground">
                      {i + 1}
                    </span>
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: color }}
                      aria-hidden
                    />
                    <Link
                      to="/exercises/$id"
                      params={{ id: row.exercise.id }}
                      className="w-48 shrink-0 truncate text-sm hover:underline sm:w-64"
                    >
                      {row.exercise.name}
                    </Link>
                    <div className="h-3 min-w-0 flex-1 rounded-sm bg-secondary">
                      <div
                        className="h-full rounded-sm"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right font-mono text-sm tabular-nums">
                      {row.points || "—"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
