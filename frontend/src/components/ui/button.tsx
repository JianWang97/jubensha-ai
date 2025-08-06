import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-slate-700/80 text-white shadow-xs hover:bg-slate-600/80 focus-visible:ring-slate-500/50",
        destructive:
          "bg-red-600/80 text-white shadow-xs hover:bg-red-500/80 focus-visible:ring-red-500/50",
        outline:
          "border border-slate-600/50 bg-slate-700/30 text-white shadow-xs hover:bg-slate-600/50 focus-visible:ring-slate-500/50",
        secondary:
          "bg-slate-600/80 text-white shadow-xs hover:bg-slate-500/80 focus-visible:ring-slate-400/50",
        ghost:
          "text-white hover:bg-slate-600/50 focus-visible:ring-slate-500/50",
        link: "text-slate-300 underline-offset-4 hover:underline hover:text-white",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
