import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-sm border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:ring-[3px] transition-[color,box-shadow] overflow-hidden shadow-xs",
  {
    variants: {
      variant: {
        default:
          "bg-brass/15 text-brass border border-brass/30 [a&]:hover:bg-brass/25",
        secondary:
          "bg-raised text-mist border border-line [a&]:hover:bg-panel",
        destructive:
          "bg-thread/15 text-thread border border-thread/30 [a&]:hover:bg-thread/25 focus-visible:ring-thread/20",
        outline:
          "border border-line bg-transparent text-mist [a&]:hover:bg-raised/60",
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
