import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-faint bg-panel text-paper flex field-sizing-content min-h-16 w-full rounded-sm border border-line px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-brass/60 focus-visible:ring-brass/30 focus-visible:ring-[3px] hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
