import { useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowDownWideNarrow,
  BarChart3,
  CircleDot,
  Grid3x3,
  Layers,
  List,
  Settings,
  Tornado,
} from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/cn";
import { formatMiles, milesToday, scoreToday } from "@/lib/lab/engine";
import { AUTHOR_PALETTE_REV } from "@/lib/lab/defaults";
import { useActiveProfile, useLabStore } from "@/lib/lab/store";
import { CategoryTheme } from "./theme-vars";

const NAV = [
  { to: "/", label: "Today", icon: CircleDot },
  { to: "/cyclone", label: "Cyclone", icon: Tornado },
  { to: "/cyclone-plan", label: "Cyclone + Plan", icon: Layers },
  { to: "/matrix", label: "Matrix", icon: Grid3x3 },
  { to: "/rank", label: "Rank", icon: ArrowDownWideNarrow },
  { to: "/totals", label: "Totals", icon: BarChart3 },
  { to: "/flow", label: "Flow", icon: Activity },
  { to: "/exercises", label: "Exercises", icon: List },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function LabShell({ children }: { children: ReactNode }) {
  const hydrate = useLabStore((s) => s.hydrate);
  const hydrated = useLabStore((s) => s.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate, AUTHOR_PALETTE_REV]);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
        <p className="font-mono text-sm tracking-widest">WORKOUT LAB 100</p>
      </div>
    );
  }

  return (
    <>
      <CategoryTheme />
      <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-border lg:flex">
          <Brand />
          <NavList />
          <ProfileChip />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-1 w-full">
            <Stripe />
          </div>
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 lg:px-8">
            <div className="min-w-0">
              <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                Workout Lab 100
              </p>
              <Scoreline />
            </div>
          </header>
          <div className="border-b border-border lg:hidden">
            <NavList compact />
          </div>
          <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#1c1e24",
            border: "1px solid #2a2b31",
            color: "#ece8e1",
          },
        }}
      />
    </>
  );
}

function Stripe() {
  const profile = useActiveProfile();
  return (
    <>
      {profile.rules.categories.map((c) => (
        <span key={c.id} className="h-full flex-1" style={{ background: c.color }} />
      ))}
    </>
  );
}

function Brand() {
  return (
    <div className="border-b border-border px-5 py-5">
      <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">Ledger</p>
      <h1 className="font-display mt-1 text-lg font-medium tracking-tight">Workout Lab 100</h1>
    </div>
  );
}

function NavList({ compact = false }: { compact?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className={cn("flex flex-col gap-0.5 p-3", compact && "flex-row overflow-x-auto p-2")}>
      {NAV.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap",
              active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ProfileChip() {
  const profiles = useLabStore((s) => s.profiles);
  const activeId = useLabStore((s) => s.activeProfileId);
  const switchProfile = useLabStore((s) => s.switchProfile);
  return (
    <div className="mt-auto space-y-1 border-t border-border p-3">
      {profiles.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => switchProfile(p.id)}
          className={cn(
            "flex w-full flex-col rounded-md px-3 py-2 text-left text-sm",
            p.id === activeId ? "bg-accent" : "hover:bg-accent",
          )}
        >
          <span>{p.name}</span>
          <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
            {p.visibility === "public" ? "public catalog" : "local only — not for git"}
          </span>
        </button>
      ))}
    </div>
  );
}

function Scoreline() {
  const profile = useActiveProfile();
  const score = scoreToday(profile);
  const miles = milesToday(profile);
  return (
    <p className="mt-0.5 text-sm">
      <span className="font-medium">{profile.name}</span>
      <span className="text-muted-foreground">
        {" "}
        / {score.towardCap}/{profile.rules.cap}
        {miles > 0 ? ` · ${formatMiles(miles)} mi` : ""}
        {profile.rules.overflow ? ` overflow ${score.overflowOut}` : ""}
      </span>
    </p>
  );
}
