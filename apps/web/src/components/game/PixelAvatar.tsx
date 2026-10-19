import { cn } from "@/lib/utils";

export const AVATARS = ["otter", "cat", "frog", "fox", "rabbit", "fish"] as const;
export type AvatarName = (typeof AVATARS)[number];

interface PixelAvatarProps {
  name: AvatarName;
  label: string;
  active?: boolean;
  folded?: boolean;
  className?: string;
}

export function PixelAvatar({ name, label, active = false, folded = false, className }: PixelAvatarProps) {
  return (
    <div
      className={cn(
        "relative flex size-14 items-center justify-center rounded-sm border-2 bg-card p-1 shadow-sm",
        active ? "border-primary [box-shadow:var(--shadow-primary)]" : "border-border",
        folded && "opacity-45 grayscale",
        className,
      )}
    >
      <img
        src={`assets/avatar-${name}.png`}
        alt={label}
        className="pixelated size-full object-contain"
        draggable={false}
      />
      {active && <span className="absolute -bottom-1 -right-1 size-2 bg-primary" aria-hidden="true" />}
    </div>
  );
}
