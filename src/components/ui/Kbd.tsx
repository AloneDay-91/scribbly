"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Command as CommandIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const KEY_SYMBOLS = {
  "⌘": CommandIcon,
  "↑": ArrowUp,
  "↓": ArrowDown,
  "←": ArrowLeft,
  "→": ArrowRight,
} as const

type KeySymbol = keyof typeof KEY_SYMBOLS

const KEY_SYMBOL_PATTERN = /(⌘|↑|↓|←|→)/

function isKeySymbol(value: string): value is KeySymbol {
  return value in KEY_SYMBOLS
}

/** JetBrains Mono has no command or arrow glyphs, so those characters fall back to a larger face. */
function renderKbdChildren(children: React.ReactNode) {
  return React.Children.map(children, (child) => {
    if (typeof child !== "string" && typeof child !== "number") {
      return child
    }
    const text = String(child)
    if (!KEY_SYMBOL_PATTERN.test(text)) {
      return text
    }
    return text.split(KEY_SYMBOL_PATTERN).map((part, index) => {
      if (!isKeySymbol(part)) {
        return part ? <React.Fragment key={index}>{part}</React.Fragment> : null
      }
      const Icon = KEY_SYMBOLS[part]
      return (
        <React.Fragment key={index}>
          <Icon aria-hidden />
          <span className="sr-only">{part}</span>
        </React.Fragment>
      )
    })
  })
}

const kbdVariants = cva(
  // rounded-sm, not the pill radius the rest of the system uses: a keycap has
  // to read as a key, and the theme radius turns a square key into a circle.
  "relative inline-flex shrink-0 items-center justify-center gap-0.5 rounded-sm font-mono leading-none font-medium whitespace-nowrap select-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      // Icons are sized to the exact em value of the text next to them, so a
      // glyph and an icon key read at the same weight.
      size: {
        default:
          "h-6 min-w-6 px-2 text-xs [&_svg:not([class*='size-'])]:size-[1em]",
        sm: "h-5 min-w-5 px-1.5 text-xs [&_svg:not([class*='size-'])]:size-[1em]",
        lg: "h-7 min-w-7 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-[1em]",
      },
      variant: {
        default: "bg-secondary text-secondary-foreground",
        outline: "border border-border text-foreground",
        ghost: "bg-current/10 text-current",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
)

const kbdGroupVariants = cva("inline-flex items-center", {
  variants: {
    size: {
      default: "gap-1.5 text-xs",
      sm: "gap-1 text-xs",
      lg: "gap-2 text-xs",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

type KbdSize = NonNullable<VariantProps<typeof kbdVariants>["size"]>

const KbdSizeContext = React.createContext<KbdSize | undefined>(undefined)

function Kbd({
  className,
  size,
  variant,
  children,
  ...props
}: React.ComponentProps<"kbd"> & VariantProps<typeof kbdVariants>) {
  const groupSize = React.useContext(KbdSizeContext)

  return (
    <kbd
      data-slot="kbd"
      className={cn(kbdVariants({ size: size ?? groupSize, variant }), className)}
      {...props}
    >
      {renderKbdChildren(children)}
    </kbd>
  )
}

function KbdGroup({
  className,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof kbdGroupVariants>) {
  return (
    <KbdSizeContext.Provider value={size ?? undefined}>
      <span
        data-slot="kbd-group"
        className={cn(kbdGroupVariants({ size }), className)}
        {...props}
      />
    </KbdSizeContext.Provider>
  )
}

export { Kbd, KbdGroup, kbdVariants, kbdGroupVariants }
