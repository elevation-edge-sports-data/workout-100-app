import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/lab/empty-state";
import { totalsWindow } from "@/lib/lab/engine";
import { useActiveProfile } from "@/lib/lab/store";

export function TotalsView() {
  const profile = useActiveProfile();
  const data = useMemo(() => totalsWindow(profile, 14), [profile]);
  const has = data.some((d) => d.workout || d.work || d.reward);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight">Totals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stacked last 14 days from real events. Workout blue, work orange, reward gray.
        </p>
      </header>
      {!has ? (
        <EmptyState title="No events yet." />
      ) : (
        <div className="h-80 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid stroke="#2a2b31" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#9a958c", fontSize: 11 }} />
              <YAxis tick={{ fill: "#9a958c", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1c1e24", border: "1px solid #2a2b31" }}
                labelStyle={{ color: "#ece8e1" }}
              />
              <Bar dataKey="workout" stackId="a" fill="#0070C0" />
              <Bar dataKey="work" stackId="a" fill="#ED7D31" />
              <Bar dataKey="reward" stackId="a" fill="#8b909a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {has && (
        <p className="text-sm text-muted-foreground">Walk miles are in Today, not in this stack.</p>
      )}
    </div>
  );
}
