import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"

import { cn } from "@/lib/utils"

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive data-slot="radio-group" className={cn("grid gap-2", className)} {...props} />
  )
}
RadioGroup.displayName = "RadioGroup"

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "aspect-square h-4 w-4 shrink-0 rounded-full border border-border",
        "bg-input [box-shadow:var(--shadow-inset)]",
        "transition-[background-color,box-shadow,border-color] duration-150",
        "hover:border-ring/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "data-checked:border-primary",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator data-slot="radio-group-indicator" className="size-full flex items-center justify-center">
        <span className="h-2 w-2 rounded-full bg-primary [box-shadow:var(--shadow-primary)]" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  )
}
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
