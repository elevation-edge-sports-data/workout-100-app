import { Link, useParams } from "@tanstack/react-router";
import { EmptyState } from "@/components/lab/empty-state";
import { catColor } from "@/components/lab/theme-vars";
import { indexWorkouts } from "@/lib/lab/engine";
import { localDayKey } from "@/lib/lab/dates";
import { useActiveProfile } from "@/lib/lab/store";

export function ExerciseDetailView() {
  const { id } = useParams({ from: "/exercises/$id" });
  const profile = useActiveProfile();
  const ex = profile.exercises.find((e) => e.id === id);
  if (!ex) {
    return (
      <EmptyState title="Exercise not in this profile.">
        <Link to="/exercises" className="text-sm underline">
          Back
        </Link>
      </EmptyState>
    );
  }
  const color = catColor(profile.rules.categories, ex.categoryId);
  const index = indexWorkouts(profile.events);
  const days = [...(index.points.get(ex.id) ?? new Map()).entries()].sort((a, b) =>
    a[0] < b[0] ? 1 : -1,
  );
  const total = days.reduce((n, [, p]) => n + p, 0);
  const shown = days.slice(0, 40);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link to="/exercises" className="text-sm text-muted-foreground hover:text-foreground">
        ← Exercises
      </Link>
      <header>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: color }} />
          {profile.rules.categories.find((c) => c.id === ex.categoryId)?.name}
        </p>
        <h1 className="font-display mt-1 text-3xl font-medium tracking-tight">{ex.name}</h1>
        {ex.alternateName ? (
          <p className="mt-1 text-sm text-muted-foreground">{ex.alternateName}</p>
        ) : null}
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          {days.length} sessions · {total} pts
        </p>
      </header>

      {ex.youtube && ex.youtube.length > 0 ? (
        <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
          <h2 className="text-sm font-medium">Videos</h2>
          <ul className="mt-2 space-y-1">
            {ex.youtube.map((v) => (
              <li key={v.url}>
                <a
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm break-all underline"
                >
                  {v.title ?? v.url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
        <h2 className="text-sm font-medium">Recent sessions</h2>
        {shown.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {shown.map(([day, pts]) => (
              <li key={day} className="flex justify-between py-1.5 font-mono text-sm">
                <span>{day === localDayKey() ? "today" : day}</span>
                <span>{pts}</span>
              </li>
            ))}
          </ul>
        )}
        {days.length > shown.length ? (
          <p className="mt-2 text-xs text-muted-foreground">{days.length - shown.length} older</p>
        ) : null}
      </section>
    </div>
  );
}
