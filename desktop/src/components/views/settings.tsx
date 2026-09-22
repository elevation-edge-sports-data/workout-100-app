import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useActiveProfile, useLabStore } from "@/lib/lab/store";
import type { PresetId } from "@/lib/lab/types";

const PRESETS: { id: PresetId; label: string; blurb: string }[] = [
  { id: "standard-100", label: "100", blurb: "Cap 100, overflow on" },
  { id: "strict-80", label: "80", blurb: "Cap 80, overflow on" },
  { id: "wide-120", label: "120", blurb: "Cap 120, overflow on" },
];

export function SettingsView() {
  const profile = useActiveProfile();
  const store = useLabStore();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Presets, rules, categories, profile switch, export/import. Reset clears events, not
          catalogs.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Active profile</h2>
        <div className="flex flex-wrap gap-2">
          {store.profiles.map((p) => (
            <Button
              key={p.id}
              variant={p.id === store.activeProfileId ? "default" : "secondary"}
              onClick={() => store.switchProfile(p.id)}
            >
              {p.name}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          This GitHub build ships Public (basic) only. Import JSON to load a private pack in this
          browser — never commit it.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Cap presets</h2>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button key={p.id} variant="secondary" onClick={() => store.applyPreset(p.id)}>
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            className="w-24"
            value={profile.rules.cap}
            onChange={(e) => store.setCap(Number(e.target.value))}
          />
          <label className="flex items-center gap-2 text-sm">
            Overflow
            <Switch
              checked={profile.rules.overflow}
              onCheckedChange={(v) => store.setOverflow(!!v)}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Miles per point</span>
          <Input
            type="number"
            step="0.01"
            className="w-24"
            value={profile.rules.milesPerPoint ?? 0.25}
            onChange={(e) => store.setMilesPerPoint(Number(e.target.value) || null)}
          />
          <span className="font-mono text-xs text-muted-foreground">default 0.25 mi = 1 pt</span>
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Categories</h2>
        <ul className="space-y-2">
          {profile.rules.categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span className="size-3 rounded-full" style={{ background: c.color }} />
              <span className="text-sm">{c.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{c.color}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Export / import</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              const blob = new Blob([store.exportJson()], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `workout-lab-100-${profile.id}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export JSON
          </Button>
          <label className="inline-flex h-10 cursor-pointer items-center rounded-md bg-secondary px-4 text-sm">
            Import JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const raw = JSON.parse(await file.text());
                  const res = store.applyImport(raw, "merge");
                  toast(res.ok ? res.summary : res.message);
                } catch {
                  toast.error("Invalid JSON");
                }
              }}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Reset</h2>
        <Button
          variant="secondary"
          onClick={() => {
            if (confirm("Clear all events on this profile? Catalog stays.")) {
              store.resetEvents();
              toast("Events cleared");
            }
          }}
        >
          Reset events
        </Button>
      </section>
    </div>
  );
}
