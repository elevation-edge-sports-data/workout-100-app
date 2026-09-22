import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CycloneRow, Profile } from "@/lib/lab/types";
import { STALE_AFTER_DAYS } from "@/lib/lab/types";
import { weekdayLetter } from "@/lib/lab/dates";
import { catColor } from "./theme-vars";
import { Button } from "@/components/ui/button";
import { useLabStore } from "@/lib/lab/store";

export function CycloneGrid({
  profile,
  rows,
  overlay,
  days,
}: {
  profile: Profile;
  rows: CycloneRow[];
  overlay: boolean;
  days?: string[];
}) {
  const adjustToday = useLabStore((s) => s.adjustToday);
  const dayKeys = days && days.length > 0 ? days : (rows[0]?.cells.map((c) => c.day) ?? []);

  return (
    <div className="overflow-x-auto rounded-2xl bg-card shadow-[var(--shadow-border)]">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <thead>
          <tr className="text-muted-foreground">
            <th className="sticky left-0 z-10 bg-card px-4 py-3 text-left font-medium">Exercise</th>
            {dayKeys.map((day, i) => {
              const age = dayKeys.length - 1 - i;
              const fresh = age < STALE_AFTER_DAYS;
              return (
                <th
                  key={day}
                  className={cn(
                    "px-0.5 py-3 text-center font-mono text-[10px] font-normal",
                    fresh ? "text-foreground/80" : "text-muted-foreground/70",
                  )}
                  title={day}
                >
                  <div>{weekdayLetter(day)}</div>
                  <div>{day.slice(-2)}</div>
                </th>
              );
            })}
            <th className="px-4 py-3 text-left font-medium">Stale</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const color = catColor(profile.rules.categories, row.exercise.categoryId);
            const fillPct =
              row.daysSince === null ? 100 : Math.min(100, (row.daysSince / 21) * 100);
            return (
              <tr
                key={row.exercise.id}
                className={cn(
                  "border-t border-border/60",
                  row.daysSince === null && "bg-background/40",
                  row.daysSince !== null && row.stale && "bg-stale/60",
                  !row.stale && "bg-fresh/20",
                )}
              >
                <td className="sticky left-0 z-10 bg-inherit px-4 py-1.5">
                  <Link
                    to="/exercises/$id"
                    params={{ id: row.exercise.id }}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: color }}
                      aria-hidden
                    />
                    <span className="truncate">{row.exercise.name}</span>
                    {overlay && row.plannedUnsatisfied ? (
                      <span className="font-mono text-[10px] text-muted-foreground">P</span>
                    ) : null}
                  </Link>
                </td>
                {row.cells.map((cell) => (
                  <td key={cell.day} className="px-0.5 py-1.5">
                    <div
                      className={cn(
                        "ledger-cell mx-auto",
                        cell.planned && "border border-dashed border-foreground/50 bg-transparent",
                      )}
                      data-empty={cell.points === null && !cell.planned ? "true" : "false"}
                      style={
                        cell.points
                          ? { background: color, color: "#0e0f12", boxShadow: "none" }
                          : undefined
                      }
                    >
                      {cell.points && cell.points > 1 ? cell.points : null}
                      {cell.planned && !cell.points ? "P" : null}
                    </div>
                  </td>
                ))}
                <td className="px-4 py-1.5">
                  <div className="stale-track w-24">
                    <div
                      className="stale-fill"
                      data-never={row.daysSince === null ? "true" : "false"}
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {row.daysSince === null
                      ? overlay && row.plannedUnsatisfied
                        ? "P"
                        : "never"
                      : row.daysSince === 0
                        ? "today"
                        : `${row.daysSince}d`}
                  </p>
                </td>
                <td className="pr-3">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Log 1 for ${row.exercise.name}`}
                    onClick={() =>
                      adjustToday({
                        kind: "workout",
                        delta: 1,
                        exerciseId: row.exercise.id,
                        categoryId: row.exercise.categoryId,
                      })
                    }
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
