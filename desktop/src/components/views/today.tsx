import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { AddExerciseDialog, ImportJsonDialog } from "@/components/lab/dialogs";
import { EmptyState } from "@/components/lab/empty-state";
import { catColor } from "@/components/lab/theme-vars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addDaysKey,
  formatClock,
  formatDayLabel,
  labDayKey,
  manualPointTimestamp,
  sleepInstant,
  stampOnDay,
  timeOnDay,
} from "@/lib/lab/dates";
import { formatMiles, milesOnDay, scoreOnDay } from "@/lib/lab/engine";
import { useActiveProfile, useLabStore } from "@/lib/lab/store";
import type { PointEvent } from "@/lib/lab/types";

export function TodayView() {
  const profile = useActiveProfile();
  const addExercise = useLabStore((s) => s.addExercise);
  const addPointsOnDay = useLabStore((s) => s.addPointsOnDay);
  const setDayUp = useLabStore((s) => s.setDayUp);
  const setDaySleep = useLabStore((s) => s.setDaySleep);
  const stampUpNow = useLabStore((s) => s.stampUpNow);
  const stampSleepNow = useLabStore((s) => s.stampSleepNow);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [pointTime, setPointTime] = useState("");
  const liveDay = labDayKey(Date.now(), profile);
  const day = picked ?? liveDay;
  const stamp = stampOnDay(profile, day);
  const score = scoreOnDay(profile, day);
  const miles = milesOnDay(profile, day);
  const upValue = stamp ? formatClock(stamp.upAt) : "";
  const sleepValue = stamp?.sleepAt != null ? formatClock(stamp.sleepAt) : "";
  const dayLabel = formatDayLabel(day);
  const exerciseName = useMemo(() => {
    const names = new Map(profile.exercises.map((exercise) => [exercise.id, exercise.name]));
    return (id?: string) => (id ? names.get(id) : undefined);
  }, [profile.exercises]);
  const categoryName = useMemo(() => {
    const names = new Map(profile.rules.categories.map((category) => [category.id, category.name]));
    return (id?: string) => (id ? names.get(id) : undefined);
  }, [profile.rules.categories]);
  const todayEvents = useMemo(
    () =>
      profile.events
        .filter((event) => labDayKey(event.timestamp, profile) === day)
        .sort((a, b) => b.timestamp - a.timestamp),
    [profile, day],
  );
  function logPoints(points: number, extra: { categoryId?: string; exerciseId?: string }) {
    if (manualPointTimestamp(profile, day, pointTime) == null) {
      toast.error("That time is outside this lab day. Set Up, or pick a time inside the day.");
      return;
    }
    addPointsOnDay({
      day,
      time: pointTime,
      kind: "workout",
      points,
      categoryId: extra.categoryId,
      exerciseId: extra.exerciseId,
    });
  }
  function writeUp(value: string) {
    if (!value) return;
    const upAt = timeOnDay(day, value);
    if (upAt == null) return;
    setDayUp(day, upAt);
  }
  function writeSleep(value: string) {
    if (!value) {
      setDaySleep(day, null);
      return;
    }
    const upAt = stamp?.upAt ?? timeOnDay(day, profile.rules.wakeTime) ?? timeOnDay(day, "06:00");
    if (upAt == null) return;
    const sleepAt = sleepInstant(day, value, upAt);
    if (sleepAt == null) return;
    setDaySleep(day, sleepAt);
  }
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
            {dayLabel}. Cap {profile.rules.cap}
            {profile.rules.overflow ? " with overflow" : ""}. {day}
          </p>
        </div>
        <div className="flex gap-2">
          <AddExerciseDialog />
          <ImportJsonDialog />
        </div>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => setPicked(addDaysKey(day, -1))}>
            Previous
          </Button>
          <div className="min-w-32">
            <p className="font-medium">{dayLabel}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {day}
              {stamp && stamp.sleepAt == null ? " · Open" : ""}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setPicked(addDaysKey(day, 1))}>
            Next
          </Button>
          <Input
            type="date"
            value={day}
            aria-label="Lab day"
            className="w-40"
            onChange={(e) => {
              const value = e.target.value;
              if (/^\d{4}-\d{2}-\d{2}$/.test(value)) setPicked(value);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            Up
            <Input type="time" value={upValue} aria-label="Up" className="w-36" onChange={(e) => writeUp(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            Sleep
            <Input
              type="time"
              value={sleepValue}
              aria-label="Sleep"
              className="w-36"
              onChange={(e) => writeSleep(e.target.value)}
            />
          </label>
          {day === liveDay && (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const next = stampUpNow();
                  if (next !== day) setPicked(next);
                }}
              >
                Up
              </Button>
              <Button type="button" variant="secondary" onClick={() => stampSleepNow()}>
                Sleep
              </Button>
            </>
          )}
        </div>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          Time
          <Input
            type="time"
            value={pointTime}
            aria-label="Time"
            className="w-36"
            onChange={(e) => setPointTime(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">Blank uses noon on this day.</span>
        </label>
      </section>

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
                onClick={() => logPoints(-1, { categoryId: c.id })}
              >
                <Minus className="size-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() => logPoints(1, { categoryId: c.id })}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
        <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          {dayLabel} · toward cap {score.towardCap} / {profile.rules.cap} · overflow {score.overflowOut}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary"
            style={{ width: `${Math.min(100, (score.towardCap / profile.rules.cap) * 100)}%` }}
          />
        </div>
        {miles > 0 && (
          <p className="mt-2 font-mono text-sm text-muted-foreground">{formatMiles(miles)} mi</p>
        )}
      </section>

      <section className="rounded-2xl bg-card shadow-[var(--shadow-border)]">
        {todayEvents.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {day === liveDay ? "No walks or logs today." : "No walks or logs this day."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {todayEvents.map((event) => (
              <li key={event.id} className="px-4 py-2 text-sm">
                {activityLine(event, exerciseName(event.exerciseId), categoryName(event.categoryId))}
              </li>
            ))}
          </ul>
        )}
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
                    onClick={() => logPoints(1, { exerciseId: ex.id, categoryId: ex.categoryId })}
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

function activityLine(event: PointEvent, exerciseName?: string, categoryName?: string): string {
  const pts = `${event.points} pts`;
  if (event.kind === "work" || event.kind === "reward") {
    const kind = event.kind === "work" ? "Work" : "Reward";
    return exerciseName ? `${kind} · ${exerciseName} · ${pts}` : `${kind} · ${pts}`;
  }
  if (event.source === "tracker") {
    const who = exerciseName ?? "On foot";
    const miles =
      typeof event.miles === "number" && Number.isFinite(event.miles) && event.miles > 0
        ? `${formatMiles(event.miles)} mi · `
        : "";
    return `${who} · ${miles}${pts}`;
  }
  return `${exerciseName ?? categoryName ?? "Log"} · ${pts}`;
}
