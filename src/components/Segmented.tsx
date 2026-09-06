import { cn } from "@/lib/utils"

/**
 * Control segmentado en píldoras: una fila de opciones donde solo una está
 * activa. Es el filtro que usan Caja y Resumen (rango de fechas) y Reservas
 * (estado de la cita).
 *
 * Vive acá y no dentro de una página porque el objetivo es justamente que
 * las tres pestañas no puedan divergir: si cambia el aspecto, cambia en un
 * solo lugar.
 */
export type OpcionSegmentada<T extends string> = { id: T; label: string }

export function Segmented<T extends string>({
  opciones,
  valor,
  onChange,
  etiquetaAria,
  className,
}: {
  opciones: readonly OpcionSegmentada<T>[]
  valor: T
  onChange: (id: T) => void
  etiquetaAria: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={etiquetaAria}
      className={cn(
        "inline-flex flex-wrap items-center gap-0.5 rounded-full border border-border bg-card/70 p-1",
        className
      )}
    >
      {opciones.map((o) => {
        const activo = o.id === valor
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={activo}
            className={cn(
              "rounded-full px-3 py-1.5 text-[11.5px] tracking-[0.06em] whitespace-nowrap transition-all duration-300",
              "focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none",
              activo
                ? "bg-primary text-primary-foreground shadow-[0_2px_10px_-4px_rgba(58,36,21,0.6)]"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
