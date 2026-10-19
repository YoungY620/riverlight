"use client"

import * as React from "react"
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { Icon } from "@iconify/react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { springStateChange } from "@/lib/motion"

const Accordion = AccordionPrimitive.Root

// Base UI className can be a state function; the wrappers feed it to cn(), so
// narrow it to a plain string (same treatment as the other ported files).
type WithClassName<P> = Omit<P, "className"> & { className?: string }

function AccordionItem({
  className,
  ...props
}: WithClassName<AccordionPrimitive.Item.Props>) {
  return (
    <AccordionPrimitive.Item
      className={cn("border-b border-border last:border-b-0", className)}
      {...props}
    />
  )
}
AccordionItem.displayName = "AccordionItem"

function AccordionTrigger({
  className,
  children,
  ...props
}: WithClassName<AccordionPrimitive.Trigger.Props>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "flex flex-1 items-center justify-between py-4 text-sm font-medium text-foreground",
          "transition-colors duration-150",
          "hover:text-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-sm",
          "[&[data-panel-open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <Icon
          icon="tabler:chevron-down"
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}
AccordionTrigger.displayName = "AccordionTrigger"

function AccordionContent({
  className,
  children,
  ...props
}: WithClassName<AccordionPrimitive.Panel.Props>) {
  return (
    <AccordionPrimitive.Panel
      keepMounted
      className="text-sm text-muted-foreground"
      {...props}
      render={({ hidden: _hidden, ...panelProps }, state) => (
        // hidden is stripped so the close spring can play, but the kept-mounted
        // closed panel must not stay reachable: inert removes it from tab order
        // and the accessibility tree.
        <div {...panelProps} inert={state.open ? undefined : true}>
          <motion.div
            animate={
              state.open
                ? { height: "auto", opacity: 1 }
                : { height: 0, opacity: 0 }
            }
            transition={springStateChange}
            initial={false}
            className="overflow-hidden"
          >
            <div className={cn("pb-4 pt-0 leading-relaxed", className)}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    />
  )
}
AccordionContent.displayName = "AccordionContent"

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
