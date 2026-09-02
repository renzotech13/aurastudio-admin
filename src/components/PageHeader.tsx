import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Encabezado de página con el mismo compás que las secciones del sitio:
 * antetítulo dorado en versalitas, titular serif y una línea de apoyo.
 */
export function PageHeader({
  eyebrow,
  titulo,
  descripcion,
  acciones,
  className,
}: {
  eyebrow?: string
  titulo: string
  descripcion?: string
  acciones?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-border/70 pb-5",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="aura-eyebrow mb-1.5 flex items-center gap-2">
            <span className="aura-diamond" aria-hidden />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="aura-display text-[clamp(22px,2.4vw,30px)] leading-tight text-foreground">
          {titulo}
        </h1>
        {descripcion ? (
          <p className="mt-1.5 max-w-[60ch] text-[13px] text-muted-foreground">{descripcion}</p>
        ) : null}
      </div>
      {acciones ? <div className="flex shrink-0 items-center gap-2">{acciones}</div> : null}
    </header>
  )
}
