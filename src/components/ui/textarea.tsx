import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-xl border border-input bg-card/70 px-3.5 py-2.5 text-base transition-[border-color,box-shadow,background-color] duration-200 outline-none placeholder:text-muted-foreground/70 hover:border-gold/45 focus-visible:border-gold focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-gold/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
