import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import type { Category, Exercise } from "@/lib/lab/types";

export function exerciseMatches(ex: Exercise, query: string, categoryId: string | "all"): boolean {
  if (categoryId !== "all" && ex.categoryId !== categoryId) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${ex.name} ${ex.alternateName ?? ""} ${ex.tags.join(" ")}`.toLowerCase();
  return hay.includes(q);
}

export function useCatalogFilter(exercises: Exercise[]) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const filtered = useMemo(
    () => exercises.filter((e) => exerciseMatches(e, query, categoryId)),
    [exercises, query, categoryId],
  );
  return { query, setQuery, categoryId, setCategoryId, filtered };
}

export function CatalogToolbar({
  categories,
  exercises,
  query,
  onQuery,
  categoryId,
  onCategory,
  shown,
}: {
  categories: Category[];
  exercises: Exercise[];
  query: string;
  onQuery: (q: string) => void;
  categoryId: string | "all";
  onCategory: (id: string | "all") => void;
  shown: number;
}) {
  const counts = useMemo(() => {
    const map: Record<string, number> = { all: exercises.length };
    for (const c of categories) map[c.id] = 0;
    for (const e of exercises) map[e.categoryId] = (map[e.categoryId] ?? 0) + 1;
    return map;
  }, [categories, exercises]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={categoryId === "all"} onClick={() => onCategory("all")}>
          all {counts.all}
        </Chip>
        {categories.map((c) => (
          <Chip
            key={c.id}
            active={categoryId === c.id}
            color={c.color}
            onClick={() => onCategory(c.id)}
          >
            {c.name} {counts[c.id] ?? 0}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Filter name, alternate, tags"
          className="max-w-sm"
        />
        <p className="font-mono text-[11px] text-muted-foreground">
          {shown} / {exercises.length}
        </p>
      </div>
    </div>
  );
}

function Chip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[11px] tracking-wide uppercase",
        active ? "bg-accent text-foreground" : "bg-secondary text-muted-foreground hover:bg-accent",
      )}
    >
      {color ? (
        <span className="size-1.5 rounded-full" style={{ background: color }} aria-hidden />
      ) : null}
      {children}
    </button>
  );
}
