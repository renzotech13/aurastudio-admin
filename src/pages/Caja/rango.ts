/**
 * Rangos de fecha del panel, siempre en días de Lima.
 *
 * El navegador del staff está en Lima, pero no se asume: los límites se
 * construyen con el desfase fijo -05:00 (Perú no cambia de hora), así que
 * "hoy" es el mismo día vea quien lo vea y desde donde lo vea.
 */
import { LIMA_OFFSET, diaLima } from "@/lib/format"

export type RangoId = "hoy" | "ayer" | "7d" | "quincena" | "mes" | "mes_anterior" | "30d"

export const RANGOS: { id: RangoId; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "ayer", label: "Ayer" },
  { id: "7d", label: "7 días" },
  { id: "quincena", label: "Quincena" },
  { id: "mes", label: "Este mes" },
  { id: "mes_anterior", label: "Mes anterior" },
  { id: "30d", label: "30 días" },
]

export type Rango = {
  id: RangoId
  /** Instante inicial inclusivo, en ISO. */
  desde: string
  /** Instante final exclusivo, en ISO. */
  hasta: string
  /** Días de Lima que abarca, en orden, como YYYY-MM-DD. */
  dias: string[]
  etiqueta: string
}

/** Medianoche de Lima de un día YYYY-MM-DD, como instante ISO. */
export function inicioDeDia(dia: string): string {
  return new Date(`${dia}T00:00:00${LIMA_OFFSET}`).toISOString()
}

/** Suma días a un YYYY-MM-DD sin salir del calendario (sin husos de por medio). */
export function sumarDias(dia: string, n: number): string {
  const [y, m, d] = dia.split("-").map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  base.setUTCDate(base.getUTCDate() + n)
  return base.toISOString().slice(0, 10)
}

function listaDias(desde: string, hastaInclusive: string): string[] {
  const out: string[] = []
  let cursor = desde
  // Tope de seguridad: ningún rango del panel pasa de un año.
  for (let i = 0; i < 400 && cursor <= hastaInclusive; i++) {
    out.push(cursor)
    cursor = sumarDias(cursor, 1)
  }
  return out
}

export function resolverRango(id: RangoId, ahora = new Date()): Rango {
  const hoy = diaLima(ahora)
  const [anio, mes, dia] = hoy.split("-").map(Number)

  let primero: string
  let ultimo: string

  switch (id) {
    case "hoy":
      primero = ultimo = hoy
      break
    case "ayer":
      primero = ultimo = sumarDias(hoy, -1)
      break
    case "7d":
      primero = sumarDias(hoy, -6)
      ultimo = hoy
      break
    case "30d":
      primero = sumarDias(hoy, -29)
      ultimo = hoy
      break
    case "quincena": {
      // El negocio liquida por quincenas: 1–15 y 16–fin de mes.
      const mm = String(mes).padStart(2, "0")
      if (dia <= 15) {
        primero = `${anio}-${mm}-01`
        ultimo = `${anio}-${mm}-15`
      } else {
        primero = `${anio}-${mm}-16`
        ultimo = finDeMes(anio, mes)
      }
      break
    }
    case "mes": {
      const mm = String(mes).padStart(2, "0")
      primero = `${anio}-${mm}-01`
      ultimo = finDeMes(anio, mes)
      break
    }
    case "mes_anterior": {
      const anioAnt = mes === 1 ? anio - 1 : anio
      const mesAnt = mes === 1 ? 12 : mes - 1
      const mm = String(mesAnt).padStart(2, "0")
      primero = `${anioAnt}-${mm}-01`
      ultimo = finDeMes(anioAnt, mesAnt)
      break
    }
  }

  return {
    id,
    desde: inicioDeDia(primero),
    hasta: inicioDeDia(sumarDias(ultimo, 1)),
    dias: listaDias(primero, ultimo),
    etiqueta: RANGOS.find((r) => r.id === id)?.label ?? "",
  }
}

function finDeMes(anio: number, mes: number): string {
  const d = new Date(Date.UTC(anio, mes, 0))
  return d.toISOString().slice(0, 10)
}

/**
 * El mismo rango, desplazado hacia atrás su propia duración: es contra esto
 * que se calculan las variaciones ("+18% vs. periodo anterior").
 */
export function rangoAnterior(rango: Rango): { desde: string; hasta: string } {
  const dias = rango.dias.length
  const primero = rango.dias[0]
  const desde = sumarDias(primero, -dias)
  return { desde: inicioDeDia(desde), hasta: inicioDeDia(primero) }
}

export function variacion(actual: number, previo: number): number | null {
  if (!previo) return null
  return ((actual - previo) / previo) * 100
}
