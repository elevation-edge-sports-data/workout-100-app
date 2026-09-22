import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-32 w-full rounded-md bg-secondary px-3 py-2 text-sm shadow-[var(--shadow-border)] placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
