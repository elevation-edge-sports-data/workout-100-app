import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActiveProfile, useLabStore } from "@/lib/lab/store";

export function AddExerciseDialog() {
  const profile = useActiveProfile();
  const addExercise = useLabStore((s) => s.addExercise);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(profile.rules.categories[0]?.id ?? "arms");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          Add exercise
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Add exercise</DialogTitle>
        <DialogDescription>Typed by you — nothing is prefilled.</DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const id = addExercise({ name, categoryId });
            if (!id) return;
            setName("");
            setOpen(false);
            toast("Exercise added");
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Exercise name"
            autoFocus
          />
          <select
            className="flex h-10 w-full rounded-md bg-secondary px-3 text-sm"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {profile.rules.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button type="submit">Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ImportJsonDialog() {
  const applyImport = useLabStore((s) => s.applyImport);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          Import JSON
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Import JSON</DialogTitle>
        <DialogDescription>Rules, profile, exercises, events, plans.</DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const raw = JSON.parse(text);
              const res = applyImport(raw, "merge");
              if (!res.ok) toast.error(res.message);
              else {
                toast(res.summary);
                setText("");
                setOpen(false);
              }
            } catch {
              toast.error("Invalid JSON");
            }
          }}
        >
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="{ … }" />
          <Button type="submit">Merge import</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
