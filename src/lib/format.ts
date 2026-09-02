/** Formatos del panel: soles peruanos y fechas de Lima. */

/** Lima no tiene horario de verano: el desfase es fijo. */
export const LIMA_OFFSET = "-05:00"

const soles = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const solesEnteros = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** S/ 1,240.50 */
export function money(n: number | null | undefined): string {
  return soles.format(Number(n ?? 0))
}

/** S/ 1,240 — para ejes y cifras grandes, donde los céntimos son ruido. */
export function moneyShort(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  if (Math.abs(v) >= 10_000) return `S/ ${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return solesEnteros.format(v)
}

export function numero(n: number | null | undefined): string {
  return new Intl.NumberFormat("es-PE").format(Number(n ?? 0))
}

/** Fecha local de Lima en formato YYYY-MM-DD a partir de un instante. */
export function diaLima(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

export function horaLima(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d)
}

export function fechaLarga(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
}

export function fechaCorta(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "short",
  }).format(d)
}

export function fechaHora(iso: string | Date): string {
  return `${fechaCorta(iso)} · ${horaLima(iso)}`
}

/**
 * `services.price` es texto libre ("S/ 40", "Consultar", "40 - 80"). Solo un
 * número limpio cuenta como dinero; lo demás lo decide una persona.
 */
export function precioNumerico(price: string | null | undefined): number | null {
  if (!price) return null
  const limpio = price.trim().replace(/^s\/\.?\s*/i, "")
  if (!/^\d+([.,]\d{1,2})?$/.test(limpio)) return null
  const n = Number(limpio.replace(",", "."))
  return Number.isFinite(n) ? n : null
}
