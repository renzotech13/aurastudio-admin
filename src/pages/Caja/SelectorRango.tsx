import { cn } from "@/lib/utils"
import { RANGOS, type RangoId } from "./rango"

/**
 * Los filtros van en una sola fila sobre el contenido y lo delimitan todo: las
 * cifras, los gráficos y la tabla leen siempre el mismo rango, así que los
 * números nunca se contradicen entre tarjetas.
 */
export function SelectorRango({
  valor,
  onChange,
  className,
}: {
  valor: RangoId
  onChange: (id: RangoId) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Rango de fechas"
      className={cn(
        "inline-flex flex-wrap items-center gap-0.5 rounded-full border border-border bg-card/70 p-1",
        className
      )}
    >
      {RANGOS.map((r) => {
        const activo = r.id === valor
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onChange(r.id)}
            aria-pressed={activo}
            className={cn(
              "rounded-full px-3 py-1.5 text-[11.5px] tracking-[0.06em] whitespace-nowrap transition-all duration-300",
              "focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none",
              activo
                ? "bg-primary text-primary-foreground shadow-[0_2px_10px_-4px_rgba(58,36,21,0.6)]"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
}
