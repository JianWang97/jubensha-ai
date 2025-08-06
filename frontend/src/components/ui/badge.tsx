import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border-0 px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:ring-[3px] transition-[color,box-shadow] overflow-hidden shadow-xs",
  {
    variants: {
      variant: {
        default:
          "bg-slate-700/80 text-white [a&]:hover:bg-slate-600/80",
        secondary:
          "bg-slate-600/60 text-white [a&]:hover:bg-slate-600/80",
        destructive:
          "bg-red-600/80 text-white [a&]:hover:bg-red-600/90 focus-visible:ring-red-500/20",
        outline:
          "border border-slate-600 bg-transparent text-white [a&]:hover:bg-slate-700/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
