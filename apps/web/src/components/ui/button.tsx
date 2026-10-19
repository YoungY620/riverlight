import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * TV Style Button — rendered as a split-flap "tile" button.
 *
 * Visual: uppercase, tracking-wide Helvetica text mirrors the character plates
 * on a classic airport terminal board. A thin horizontal pseudo-seam at 50%
 * height simulates the mechanical flip line. Primary variant glows amber like
 * the board's accent bar.
 *
 * Behaviour: on click, if the button label is a plain string, each character
 * scrambles through random characters (with cycling scramble-palette
 * backgrounds) before settling back — the same animation the FlipBoard runs
 * on its tiles. Buttons with JSX children (icon + label, etc.) skip the
 * scramble and fall back to the press transform.
 *
 * Base UI note: Base UI's Button primitive has no asChild; polymorphism is the
 * render prop. The scramble/width-lock logic measures its own inner element, so
 * we render a plain <ButtonPrimitive> and keep the imperative-handle wiring.
 */

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-!?"
const SCRAMBLE_TICKS = 8
const TICK_MS = 40

const pickScramble = () =>
  SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]

// Only filled "tile-face" variants get the mechanical seam. Transparent
// variants (outline, ghost, link) render text directly on the canvas — the
// seam would cut straight through glyph descenders/crossbars and look like
// a strikethrough, not a flip-board seam.
const SEAM =
  "before:pointer-events-none before:absolute before:inset-x-0 before:top-1/2 before:h-px"

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "text-sm font-bold uppercase tracking-[0.06em] leading-none",
    "rounded-[0.1875rem] cursor-pointer select-none",
    "transition-[background-color,box-shadow,transform,color] duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:translate-y-px",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          `${SEAM} before:bg-black/35 ` +
          "bg-card text-foreground " +
          "[box-shadow:var(--shadow-button)] " +
          "hover:bg-accent hover:[box-shadow:var(--shadow-button-hover)]",
        primary:
          `${SEAM} before:bg-black/45 ` +
          "bg-primary text-primary-foreground " +
          "[box-shadow:var(--shadow-primary)] " +
          "hover:brightness-105",
        secondary:
          `${SEAM} before:bg-black/35 ` +
          "bg-secondary text-secondary-foreground " +
          "[box-shadow:var(--shadow-button)] " +
          "hover:bg-accent hover:[box-shadow:var(--shadow-button-hover)]",
        destructive:
          `${SEAM} before:bg-black/40 ` +
          "bg-destructive text-destructive-foreground " +
          "[box-shadow:var(--shadow-button)] " +
          "hover:brightness-105 hover:[box-shadow:var(--shadow-button-hover)]",
        outline:
          "bg-transparent text-foreground border border-border " +
          "hover:bg-accent hover:border-ring/30",
        ghost:
          "bg-transparent text-muted-foreground " +
          "hover:bg-accent hover:text-accent-foreground",
        link:
          "text-primary underline-offset-4 hover:underline normal-case tracking-normal",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-4",
        lg: "h-10 px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends Omit<ButtonPrimitive.Props, "className">,
    VariantProps<typeof buttonVariants> {
  className?: string
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, children, onClick, style, ...props },
    ref
  ) => {
    /** Narrows children to plain text, the only form the marquee can measure. */
    function isTextChild(node: React.ReactNode): node is string {
      return typeof node === "string"
    }

    const label = isTextChild(children) ? children : null

    const [scrambled, setScrambled] = React.useState<string | null>(null)
    const [lockedWidth, setLockedWidth] = React.useState<number | undefined>()
    const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
    const innerRef = React.useRef<HTMLButtonElement | null>(null)

    // SAFETY: the handle is read only after mount, when the element this
    // component renders is attached, so the ref is non-null.
    React.useImperativeHandle(ref, () => innerRef.current as HTMLButtonElement)

    // Measure the natural label width so the scramble (variable-width random
    // chars — Helvetica is proportional, so "OK" and "WM" render different
    // widths) can neither shrink nor GROW the button shell during animation.
    // Follows the "Loading Button Width Stability" rule in
    // docs/interactions.md — the user just clicked and the control must not
    // feel like it's squirming under pressure.
    React.useLayoutEffect(() => {
      if (!innerRef.current || !label || lockedWidth !== undefined) return
      setLockedWidth(innerRef.current.offsetWidth)
    }, [label, lockedWidth])

    React.useEffect(() => {
      return () => {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }, [])

    const triggerScramble = React.useCallback(() => {
      if (!label) return
      if (timerRef.current) clearInterval(timerRef.current)
      let tick = 0
      timerRef.current = setInterval(() => {
        tick += 1
        if (tick >= SCRAMBLE_TICKS) {
          setScrambled(null)
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          return
        }
        const next = Array.from(label, () => pickScramble()).join("")
        setScrambled(next)
      }, TICK_MS)
    }, [label])

    const handleClick: NonNullable<ButtonPrimitive.Props["onClick"]> = (e) => {
      triggerScramble()
      onClick?.(e)
    }

    // Callers written against the Radix API pass the element to become as a
    // child: <Button asChild><Link>…</Link></Button>. Base UI has no asChild,
    // it composes through `render`. Without this the prop reaches the DOM and
    // the anchor nests inside the button instead of replacing it, which stacks
    // the icon above the label and puts a link inside a button.
    //
    // The scramble effect only drives a string label, so an element child skips
    // it and renders as-is.
    if (asChild && React.isValidElement(children)) {
      return (
        <ButtonPrimitive
          ref={innerRef}
          className={cn(buttonVariants({ variant, size, className }))}
          onClick={handleClick}
          style={style}
          {...props}
          // After the spread, so an explicit asChild child wins over a stray
          // render prop rather than being silently replaced by it.
          // SAFETY: this branch runs only when `asChild` is set, and the caller then
          // owns passing a single element for the slot to clone.
          render={children as React.ReactElement}
        />
      )
    }

    // Apply an exact width — not just min-width — so the button shell stays
    // frozen when scramble characters happen to be wider than the original
    // label. min-width alone only prevents shrinking, not growing.
    const mergedStyle =
      lockedWidth !== undefined
        ? { ...style, width: `${lockedWidth}px` }
        : style

    return (
      <ButtonPrimitive
        className={cn(buttonVariants({ variant, size, className }))}
        ref={innerRef}
        onClick={handleClick}
        style={mergedStyle}
        {...props}
      >
        {scrambled ?? children}
      </ButtonPrimitive>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
