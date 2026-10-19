import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { cva, type VariantProps } from "class-variance-authority"
import { Icon } from "@iconify/react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitive.Provider

const ToastViewport = React.forwardRef<
  HTMLDivElement,
  ToastPrimitive.Viewport.Props
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Portal>
    <ToastPrimitive.Viewport
      ref={ref}
      className={cn(
        "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[26.25rem]",
        className
      )}
      {...props}
    />
  </ToastPrimitive.Portal>
))
ToastViewport.displayName = "ToastViewport"

const toastVariants = cva(
  [
    "group pointer-events-auto relative flex w-full items-center justify-between gap-3 overflow-hidden p-4",
    "rounded-lg border",
    "[box-shadow:var(--shadow-l)]",
    "transition-all data-swiping:translate-x-[var(--toast-swipe-movement-x)] data-swiping:transition-none data-ending-style:opacity-80 data-ending-style:translate-x-full data-starting-style:-translate-y-full sm:data-starting-style:translate-y-full",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-popover text-popover-foreground border-border",
        destructive: "bg-popover text-destructive border-destructive/40 group",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  HTMLDivElement,
  ToastPrimitive.Root.Props & VariantProps<typeof toastVariants>
>(({ className, variant, swipeDirection = "right", ...props }, ref) => {
  return (
    <ToastPrimitive.Root
      ref={ref}
      swipeDirection={swipeDirection}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = "Toast"

const ToastAction = React.forwardRef<
  HTMLButtonElement,
  ToastPrimitive.Action.Props
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md px-3",
      "border border-border bg-secondary text-secondary-foreground",
      "[box-shadow:var(--shadow-s)]",
      "text-sm font-medium transition-[background-color,box-shadow] duration-150",
      "hover:bg-accent hover:[box-shadow:var(--shadow-m)]",
      "focus:outline-none focus:ring-2 focus:ring-ring/40",
      "disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = "ToastAction"

const ToastClose = React.forwardRef<
  HTMLButtonElement,
  ToastPrimitive.Close.Props
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 transition-[opacity,color,background-color] duration-150",
      "hover:bg-accent hover:text-foreground",
      "focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring/40 group-hover:opacity-100",
      className
    )}
    toast-close=""
    {...props}
  >
    <Icon icon="tabler:x" className="h-4 w-4" />
  </ToastPrimitive.Close>
))
ToastClose.displayName = "ToastClose"

const ToastTitle = React.forwardRef<
  HTMLHeadingElement,
  ToastPrimitive.Title.Props
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={cn("text-sm font-semibold", className)}
    {...props}
  />
))
ToastTitle.displayName = "ToastTitle"

const ToastDescription = React.forwardRef<
  HTMLParagraphElement,
  ToastPrimitive.Description.Props
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    {...props}
  />
))
ToastDescription.displayName = "ToastDescription"

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
