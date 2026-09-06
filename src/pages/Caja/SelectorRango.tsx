import { Segmented } from "@/components/Segmented"
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
    <Segmented
      opciones={RANGOS}
      valor={valor}
      onChange={onChange}
      etiquetaAria="Rango de fechas"
      className={className}
    />
  )
}
