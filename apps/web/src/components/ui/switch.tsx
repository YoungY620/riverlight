import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border",
        "bg-input [box-shadow:var(--shadow-inset)]",
        "transition-[background-color,box-shadow,border-color] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "data-checked:bg-primary data-checked:border-primary data-checked:[box-shadow:var(--shadow-primary)]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-foreground",
          "[box-shadow:var(--shadow-s)]",
          "ring-0 transition-transform duration-150",
          "data-checked:translate-x-4 data-checked:bg-primary-foreground",
          "data-unchecked:translate-x-0.5"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
