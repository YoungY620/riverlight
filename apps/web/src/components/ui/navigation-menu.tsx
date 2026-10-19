import * as React from "react"
import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu"
import { cva } from "class-variance-authority"
import { Icon } from "@iconify/react"

import { cn } from "@/lib/utils"

// Base UI className can be a state function; the wrappers feed it to cn(), so
// narrow it to a plain string (same treatment as the other ported files).
type WithClassName<P> = Omit<P, "className"> & { className?: string }

function NavigationMenu({
  className,
  children,
  ...props
}: WithClassName<NavigationMenuPrimitive.Root.Props>) {
  return (
    <NavigationMenuPrimitive.Root
      className={cn(
        "relative z-10 flex max-w-max flex-1 items-center justify-center",
        className
      )}
      {...props}
    >
      {children}
      <NavigationMenuViewport />
    </NavigationMenuPrimitive.Root>
  )
}
NavigationMenu.displayName = "NavigationMenu"

const NavigationMenuList = React.forwardRef<
  HTMLUListElement,
  WithClassName<NavigationMenuPrimitive.List.Props>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    ref={ref}
    className={cn(
      "group flex flex-1 list-none items-center justify-center gap-1",
      className
    )}
    {...props}
  />
))
NavigationMenuList.displayName = "NavigationMenuList"

const NavigationMenuItem = NavigationMenuPrimitive.Item

const navigationMenuTriggerStyle = cva(
  "inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium " +
    "transition-[background-color,color] duration-150 " +
    "hover:bg-accent hover:text-accent-foreground " +
    "focus:bg-accent focus:text-accent-foreground focus:outline-none " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "data-[active]:bg-accent/60 data-popup-open:bg-accent"
)

const NavigationMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  WithClassName<NavigationMenuPrimitive.Trigger.Props>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Trigger
    ref={ref}
    className={cn(navigationMenuTriggerStyle(), "group", className)}
    {...props}
  >
    {children}
    <Icon
      icon="tabler:chevron-down"
      className="relative top-[0.0625rem] ml-1 h-3 w-3 transition duration-200 group-data-popup-open:rotate-180"
      aria-hidden="true"
    />
  </NavigationMenuPrimitive.Trigger>
))
NavigationMenuTrigger.displayName = "NavigationMenuTrigger"

const NavigationMenuContent = React.forwardRef<
  HTMLDivElement,
  WithClassName<NavigationMenuPrimitive.Content.Props>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Content
    ref={ref}
    className={cn(
      "left-0 top-0 w-full transition-[opacity,transform,translate] duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0 data-starting-style:data-[activation-direction=left]:-translate-x-52 data-starting-style:data-[activation-direction=right]:translate-x-52 data-ending-style:data-[activation-direction=left]:translate-x-52 data-ending-style:data-[activation-direction=right]:-translate-x-52 md:absolute md:w-auto ",
      className
    )}
    {...props}
  />
))
NavigationMenuContent.displayName = "NavigationMenuContent"

const NavigationMenuLink = NavigationMenuPrimitive.Link

function NavigationMenuViewport({
  className,
  ...props
}: WithClassName<NavigationMenuPrimitive.Viewport.Props>) {
  return (
    <NavigationMenuPrimitive.Portal>
      <NavigationMenuPrimitive.Positioner sideOffset={8} className="isolate z-50">
        <NavigationMenuPrimitive.Popup className="relative h-[var(--popup-height)] w-full origin-[var(--transform-origin)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground [box-shadow:var(--shadow-l)] transition-[opacity,transform,scale,width,height] duration-150 data-starting-style:scale-90 data-ending-style:scale-95 md:w-[var(--popup-width)]">
          <NavigationMenuPrimitive.Viewport
            className={cn("relative h-full w-full overflow-hidden", className)}
            {...props}
          />
        </NavigationMenuPrimitive.Popup>
      </NavigationMenuPrimitive.Positioner>
    </NavigationMenuPrimitive.Portal>
  )
}
NavigationMenuViewport.displayName = "NavigationMenuViewport"

// BEHAVIOR DELTA (flagged): Base UI has no equivalent of the upstream
// NavigationMenu.Indicator (the pointer that tracks the active trigger along
// the list). This is an inert passthrough that renders nothing so existing
// call sites keep compiling. The closest Base UI analogues are
// NavigationMenu.Icon (chevron inside the trigger) and NavigationMenu.Arrow
// (popup-anchored pointer), neither of which tracks the trigger list.
function NavigationMenuIndicator(
  props: React.ComponentPropsWithoutRef<"div">
) {
  void props
  return null
}
NavigationMenuIndicator.displayName = "NavigationMenuIndicator"

export {
  navigationMenuTriggerStyle,
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
}
