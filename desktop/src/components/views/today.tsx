import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { AddExerciseDialog, ImportJsonDialog } from "@/components/lab/dialogs";
import { EmptyState } from "@/components/lab/empty-state";
import { catColor } from "@/components/lab/theme-vars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { scoreToday } from "@/lib/lab/engine";
import { localDayKey } from "@/lib/lab/dates";
import { useActiveProfile, useLabStore } from "@/lib/lab/store";

export function TodayView() {
  const profile = useActiveProfile();
  const adjustToday = useLabStore((s) => s.adjustToday);
  const addExercise = useLabStore((s) => s.addExercise);
  const score = scoreToday(profile);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const today = localDayKey();
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profile.exercises.slice(0, 24);
    return profile.exercises
      .filter((e) => `${e.name} ${e.alternateName ?? ""}`.toLowerCase().includes(q))
      .slice(0, 24);
  }, [profile.exercises, query]);

  const byCat = profile.rules.categories.map((c) => ({
    ...c,
    points: score.byCategory[c.id] ?? 0,
  }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Today</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quick log. Cap {profile.rules.cap}
            {profile.rules.overflow ? " with overflow" : ""}. {today}
          </p>
        </div>
        <div className="flex gap-2">
          <AddExerciseDialog />
          <ImportJsonDialog />
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {byCat.map((c) => (
          <div key={c.id} className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <span className="size-2 rounded-full" style={{ background: c.color }} />
                {c.name}
              </span>
              <span className="font-mono text-lg">{c.points}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() => adjustToday({ kind: "workout", delta: -1, categoryId: c.id })}
              >
                <Minus className="size-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() => adjustToday({ kind: "workout", delta: 1, categoryId: c.id })}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
        <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          Toward cap {score.towardCap} / {profile.rules.cap} · overflow {score.overflowOut}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary"
            style={{ width: `${Math.min(100, (score.towardCap / profile.rules.cap) * 100)}%` }}
          />
        </div>
      </section>

      {profile.exercises.length === 0 ? (
        <EmptyState title="No exercises in this profile yet. Import or add a catalog.">
          <AddExerciseDialog />
          <ImportJsonDialog />
        </EmptyState>
      ) : (
        <section className="space-y-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search to log an exercise"
            className="max-w-md"
          />
          <ul className="divide-y divide-border rounded-2xl bg-card shadow-[var(--shadow-border)]">
            {hits.map((ex) => {
              const color = catColor(profile.rules.categories, ex.categoryId);
              return (
                <li key={ex.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="truncate">{ex.name}</span>
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() =>
                      adjustToday({
                        kind: "workout",
                        delta: 1,
                        exerciseId: ex.id,
                        categoryId: ex.categoryId,
                      })
                    }
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
          <form
            className="flex max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newName.trim();
              if (!name) return;
              addExercise({
                name,
                categoryId: profile.rules.categories[0]?.id ?? "cardio",
              });
              setNewName("");
            }}
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Type a new exercise name"
            />
            <Button type="submit" variant="secondary">
              Add
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}
