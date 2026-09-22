import { useMemo } from "react";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/lab/empty-state";
import { flowSeries } from "@/lib/lab/engine";
import { useActiveProfile } from "@/lib/lab/store";

export function FlowView() {
  const profile = useActiveProfile();
  const data = useMemo(() => flowSeries(profile), [profile]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight">Flow</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cumulative Workout / Work / Reward by hour from first event. Axis may exceed 24.
        </p>
      </header>
      {data.length === 0 ? (
        <EmptyState title="No events yet." />
      ) : (
        <div className="h-80 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="#2a2b31" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: "#9a958c", fontSize: 11 }} />
              <YAxis tick={{ fill: "#9a958c", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1c1e24", border: "1px solid #2a2b31" }}
                labelStyle={{ color: "#ece8e1" }}
              />
              <Line type="stepAfter" dataKey="workout" stroke="#0070C0" dot={false} strokeWidth={2} />
              <Line type="stepAfter" dataKey="work" stroke="#ED7D31" dot={false} strokeWidth={2} />
              <Line type="stepAfter" dataKey="reward" stroke="#8b909a" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
