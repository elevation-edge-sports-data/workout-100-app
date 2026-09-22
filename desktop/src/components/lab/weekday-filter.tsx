import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { WEEKDAY_CHIPS } from "@/lib/lab/dates";

export function useWeekdayFilter() {
  const [days, setDays] = useState<number[]>([]);
  const selected = useMemo(() => new Set(days), [days]);
  function toggle(id: number) {
    setDays((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }
  function clear() {
    setDays([]);
  }
  return { days, selected, toggle, clear };
}

export function WeekdayFilter({
  days,
  onToggle,
  onClear,
}: {
  days: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
}) {
  const active = days.length > 0;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
        Days
      </span>
      <button
        type="button"
        onClick={onClear}
        className={cn(
          "rounded-full px-2.5 py-1 font-mono text-[11px] tracking-wide uppercase",
          !active ? "bg-accent text-foreground" : "bg-secondary text-muted-foreground hover:bg-accent",
        )}
      >
        Any
      </button>
      {WEEKDAY_CHIPS.map((d) => {
        const on = days.includes(d.id);
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onToggle(d.id)}
            className={cn(
              "min-w-10 rounded-full px-2.5 py-1 font-mono text-[11px] tracking-wide uppercase",
              on ? "bg-accent text-foreground" : "bg-secondary text-muted-foreground hover:bg-accent",
            )}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}
