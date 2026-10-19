import { cn } from "@/lib/utils";

export function Chip({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-3 rounded-full border-2 border-dashed border-primary-foreground bg-primary shadow-xs",
        className,
      )}
    />
  );
}
