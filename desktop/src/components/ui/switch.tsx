import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

export function Switch({
  className,
  ...props
}: SwitchPrimitive.SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "inline-flex h-6 w-10 items-center rounded-full bg-secondary shadow-[var(--shadow-border)] data-[state=checked]:bg-accent",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-1 rounded-full bg-foreground transition-transform data-[state=checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  );
}
