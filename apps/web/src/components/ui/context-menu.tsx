"use client"

import * as React from "react"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"
import { Icon } from "@iconify/react"

import { cn } from "@/lib/utils"

const ContextMenu = ContextMenuPrimitive.Root
const ContextMenuTrigger = ContextMenuPrimitive.Trigger
const ContextMenuGroup = ContextMenuPrimitive.Group
const ContextMenuPortal = ContextMenuPrimitive.Portal
const ContextMenuSub = ContextMenuPrimitive.SubmenuRoot
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup

const contentStyles =
  "z-50 min-w-[10rem] overflow-hidden p-1 " +
  "rounded-lg border border-border " +
  "bg-popover text-popover-foreground " +
  "[box-shadow:var(--shadow-l)] " +
  "transition-[transform,scale,opacity] data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0 data-ending-style:scale-95"

const itemStyles =
  "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none " +
  "transition-[background-color,color] duration-150 " +
  "focus:bg-accent focus:text-accent-foreground " +
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50"

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: ContextMenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.SubmenuTrigger
      className={cn(
        itemStyles,
        "data-popup-open:bg-accent data-popup-open:text-accent-foreground",
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
      <Icon icon="tabler:chevron-right" className="ml-auto h-4 w-4" />
    </ContextMenuPrimitive.SubmenuTrigger>
  )
}
ContextMenuSubTrigger.displayName = "ContextMenuSubTrigger"

function ContextMenuSubContent({
  className,
  align = "start",
  alignOffset = 4,
  side = "right",
  sideOffset = 0,
  ...props
}: ContextMenuPrimitive.Popup.Props &
  Pick<
    ContextMenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <ContextMenuPrimitive.Popup
          className={cn(contentStyles, className)}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}
ContextMenuSubContent.displayName = "ContextMenuSubContent"

function ContextMenuContent({
  className,
  ...props
}: ContextMenuPrimitive.Popup.Props) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner className="isolate z-50 outline-none">
        <ContextMenuPrimitive.Popup
          className={cn(contentStyles, className)}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}
ContextMenuContent.displayName = "ContextMenuContent"

function ContextMenuItem({
  className,
  inset,
  ...props
}: ContextMenuPrimitive.Item.Props & {
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(itemStyles, inset && "pl-8", className)}
      {...props}
    />
  )
}
ContextMenuItem.displayName = "ContextMenuItem"

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: ContextMenuPrimitive.CheckboxItem.Props) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      className={cn(itemStyles, "pl-8", className)}
      checked={checked}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <ContextMenuPrimitive.CheckboxItemIndicator>
          <Icon icon="tabler:check" className="h-4 w-4 text-primary" />
        </ContextMenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  )
}
ContextMenuCheckboxItem.displayName = "ContextMenuCheckboxItem"

function ContextMenuRadioItem({
  className,
  children,
  ...props
}: ContextMenuPrimitive.RadioItem.Props) {
  return (
    <ContextMenuPrimitive.RadioItem
      className={cn(itemStyles, "pl-8", className)}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <ContextMenuPrimitive.RadioItemIndicator>
          <span className="h-2 w-2 rounded-full bg-primary [box-shadow:var(--shadow-s)]" />
        </ContextMenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  )
}
ContextMenuRadioItem.displayName = "ContextMenuRadioItem"

function ContextMenuLabel({
  className,
  inset,
  ...props
}: ContextMenuPrimitive.GroupLabel.Props & {
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.GroupLabel
      className={cn(
        "px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  )
}
ContextMenuLabel.displayName = "ContextMenuLabel"

function ContextMenuSeparator({
  className,
  ...props
}: ContextMenuPrimitive.Separator.Props) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}
ContextMenuSeparator.displayName = "ContextMenuSeparator"

const ContextMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
    {...props}
  />
)
ContextMenuShortcut.displayName = "ContextMenuShortcut"

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
}
