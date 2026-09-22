import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AddExerciseDialog, ImportJsonDialog } from "@/components/lab/dialogs";
import { EmptyState } from "@/components/lab/empty-state";
import { catColor } from "@/components/lab/theme-vars";
import { CatalogToolbar, useCatalogFilter } from "@/components/lab/catalog-filter";
import { WeekdayFilter, useWeekdayFilter } from "@/components/lab/weekday-filter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { weekdayLetter } from "@/lib/lab/dates";
import { matrixRows } from "@/lib/lab/engine";
import { MATRIX_DAYS, type MatrixSort } from "@/lib/lab/types";
import { useActiveProfile } from "@/lib/lab/store";

const SORTS: { id: MatrixSort; label: string }[] = [
  { id: "alpha-cat", label: "A–Z in category" },
  { id: "vol-cat", label: "Most in category" },
  { id: "vol-all", label: "Most overall" },
  { id: "alpha-all", label: "A–Z overall" },
];

export function MatrixView() {
  const profile = useActiveProfile();
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<MatrixSort>("alpha-cat");
  const weekdays = useWeekdayFilter();
  const filter = useCatalogFilter(profile.exercises);
  const grid = useMemo(
    () => matrixRows(profile, { days: MATRIX_DAYS, offset, weekdays: weekdays.selected, sort }),
    [profile, offset, weekdays.selected, sort],
  );
  const visible = useMemo(() => {
    const ids = new Set(filter.filtered.map((e) => e.id));
    return grid.rows.filter((r) => ids.has(r.exercise.id));
  }, [grid.rows, filter.filtered]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Matrix</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Exercise rows × day columns. {MATRIX_DAYS} visible. Sort and weekday filters apply to
            this window.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            onClick={() => setOffset((n) => n + MATRIX_DAYS)}
            aria-label="Older days"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            {grid.start} → {grid.end}
          </span>
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            disabled={offset === 0}
            onClick={() => setOffset((n) => Math.max(0, n - MATRIX_DAYS))}
            aria-label="Newer days"
          >
            <ChevronRight className="size-4" />
          </Button>
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
            shown={visible.length}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <WeekdayFilter days={weekdays.days} onToggle={weekdays.toggle} onClear={weekdays.clear} />
            <label className="flex items-center gap-2 text-sm">
              <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                Sort
              </span>
              <select
                className="flex h-9 rounded-md bg-secondary px-3 text-sm shadow-[var(--shadow-border)]"
                value={sort}
                onChange={(e) => setSort(e.target.value as MatrixSort)}
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="overflow-x-auto rounded-2xl bg-card shadow-[var(--shadow-border)]">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card px-4 py-3 text-left font-medium">
                    Exercise
                  </th>
                  {grid.days.map((day) => (
                    <th
                      key={day}
                      className="px-0.5 py-3 text-center font-mono text-[10px] font-normal text-muted-foreground"
                    >
                      <div>{weekdayLetter(day)}</div>
                      <div>{day.slice(-2)}</div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right font-mono text-[10px] font-normal text-muted-foreground">
                    Σ
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const color = catColor(profile.rules.categories, row.exercise.categoryId);
                  return (
                    <tr key={row.exercise.id} className="border-t border-border/60">
                      <td className="sticky left-0 z-10 bg-card px-4 py-2">
                        <span className="flex items-center gap-2">
                          <span className="size-2 rounded-full" style={{ background: color }} />
                          {row.exercise.name}
                        </span>
                      </td>
                      {row.cells.map((cell) => (
                        <td key={cell.day} className="px-0.5 py-2">
                          <div
                            className={cn("ledger-cell mx-auto")}
                            data-empty={cell.points === null ? "true" : "false"}
                            style={
                              cell.points
                                ? { background: color, color: "#0e0f12", boxShadow: "none" }
                                : undefined
                            }
                          >
                            {cell.points && cell.points > 1 ? cell.points : null}
                          </div>
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {row.volume || ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
