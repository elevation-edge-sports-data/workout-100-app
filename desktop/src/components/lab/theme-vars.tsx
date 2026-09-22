import type { Category } from "@/lib/lab/types";
import { useActiveProfile } from "@/lib/lab/store";

export function catColor(categories: Category[], id: string): string {
  return categories.find((c) => c.id === id)?.color ?? "#9a958c";
}

export function CategoryTheme() {
  const profile = useActiveProfile();
  const vars = profile.rules.categories
    .map((c, i) => `--cat-${i}: ${c.color}; --cat-${c.id}: ${c.color};`)
    .join(" ");
  return <style>{`:root { ${vars} }`}</style>;
}
