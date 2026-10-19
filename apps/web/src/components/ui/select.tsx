import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Icon } from "@iconify/react"

import { cn } from "@/lib/utils"

// Base UI className can be a state function; the wrappers feed it to cn(), so
// narrow it to a plain string (same treatment as the other ported files).
type WithClassName<P> = Omit<P, "className"> & { className?: string }

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  WithClassName<SelectPrimitive.Trigger.Props>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between rounded-md px-3 py-1.5 text-sm",
      "bg-input text-foreground border border-border",
      "[box-shadow:var(--shadow-inset)]",
      "transition-[color,box-shadow,border-color] duration-150",
      "placeholder:text-muted-foreground",
      "hover:border-ring/40",
      "focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/40",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "[&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon
      render={
        <Icon
          icon="tabler:chevron-down"
          className="h-4 w-4 text-muted-foreground opacity-70"
        />
      }
    />
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = "SelectTrigger"

const SelectScrollUpButton = React.forwardRef<
  HTMLDivElement,
  WithClassName<SelectPrimitive.ScrollUpArrow.Props>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpArrow
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <Icon icon="tabler:chevron-up" className="h-4 w-4" />
  </SelectPrimitive.ScrollUpArrow>
))
SelectScrollUpButton.displayName = "SelectScrollUpButton"

const SelectScrollDownButton = React.forwardRef<
  HTMLDivElement,
  WithClassName<SelectPrimitive.ScrollDownArrow.Props>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownArrow
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <Icon icon="tabler:chevron-down" className="h-4 w-4" />
  </SelectPrimitive.ScrollDownArrow>
))
SelectScrollDownButton.displayName = "SelectScrollDownButton"

const SelectContent = React.forwardRef<
  HTMLDivElement,
  WithClassName<SelectPrimitive.Popup.Props> &
    Pick<
      SelectPrimitive.Positioner.Props,
      "side" | "sideOffset" | "align" | "alignOffset" | "alignItemWithTrigger"
    >
>(
  (
    {
      className,
      children,
      side,
      sideOffset,
      align,
      alignOffset,
      alignItemWithTrigger = false,
      ...props
    },
    ref
  ) => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
      >
        <SelectPrimitive.Popup
          ref={ref}
          className={cn(
            "relative z-50 max-h-96 min-w-[8rem] overflow-hidden",
            "rounded-lg border border-border",
            "bg-popover text-popover-foreground",
            "[box-shadow:var(--shadow-l)]",
            "transition-[opacity,transform,scale,translate] duration-150",
            "data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0 data-ending-style:scale-95 data-[side=bottom]:data-starting-style:-translate-y-2 data-[side=left]:data-starting-style:translate-x-2 data-[side=right]:data-starting-style:-translate-x-2 data-[side=top]:data-starting-style:translate-y-2",
            !alignItemWithTrigger &&
              "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List
            className={cn(
              "p-1",
              !alignItemWithTrigger &&
                "max-h-[var(--available-height)] w-full min-w-[var(--anchor-width)] overflow-y-auto"
            )}
          >
            {children}
          </SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
)
SelectContent.displayName = "SelectContent"

const SelectLabel = React.forwardRef<
  HTMLDivElement,
  WithClassName<SelectPrimitive.GroupLabel.Props>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.GroupLabel
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
      className
    )}
    {...props}
  />
))
SelectLabel.displayName = "SelectLabel"

const SelectItem = React.forwardRef<
  HTMLElement,
  WithClassName<SelectPrimitive.Item.Props>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none",
      "transition-[background-color,color] duration-150",
      "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Icon icon="tabler:check" className="h-4 w-4 text-primary" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = "SelectItem"

const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  WithClassName<SelectPrimitive.Separator.Props>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
))
SelectSeparator.displayName = "SelectSeparator"

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
