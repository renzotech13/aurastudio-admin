import { LIMA_OFFSET, diaLima } from "@/lib/format"
import type { CitaEstado } from "@/lib/types"

/**
 * Una cita tal como la pinta la app móvil. La profesional la recibe de la
 * función mi_agenda() y recepción de un join sobre `citas`: las dos se llevan
 * a esta misma forma para que la tarjeta de la agenda sea una sola.
 */
export type CitaApp = {
  id: string
  inicio_utc: string
  fin_utc: string
  estado: CitaEstado
  notas: string | null
  sede_id: string | null
  profesional_id: string | null
  cliente_id: string
  cliente_nombre: string | null
  cliente_notas: string | null
  servicio: string
  servicio_duracion: string | null
}

// Todas las fechas son «YYYY-MM-DD» de Lima. Se calcula sobre el mediodía UTC
// para que sumar días nunca caiga en el borde de un cambio de fecha.
function aFecha(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

export function hoyLima(): string {
  return diaLima(new Date())
}

export function sumarDias(fecha: string, dias: number): string {
  const d = aFecha(fecha)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** 0 = lunes … 6 = domingo. */
export function diaSemana(fecha: string): number {
  return (aFecha(fecha).getUTCDay() + 6) % 7
}

/** Los siete días (lunes a domingo) de la semana que contiene a `fecha`. */
export function semanaDe(fecha: string): string[] {
  const lunes = sumarDias(fecha, -diaSemana(fecha))
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

/** Desde las 00:00 de ese día en Lima hasta las 00:00 del siguiente, en UTC. */
export function rangoUtc(fecha: string): { desde: string; hasta: string } {
  return {
    desde: new Date(`${fecha}T00:00:00${LIMA_OFFSET}`).toISOString(),
    hasta: new Date(`${sumarDias(fecha, 1)}T00:00:00${LIMA_OFFSET}`).toISOString(),
  }
}

export const DIAS_CORTOS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] as const

export function diaDelMes(fecha: string): number {
  return Number(fecha.slice(8, 10))
}

/** «martes 22 de setiembre». */
export function fechaLegible(fecha: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(aFecha(fecha))
}

/** Ahora, en el formato que espera un input datetime-local, en hora de Lima. */
export function ahoraLimaLocal(): string {
  // sv-SE da «2026-09-08 15:30»; el input quiere la T en medio.
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(" ", "T")
}

/** «2026-09-08T15:30» (lo que da un datetime-local) → ISO con la zona de Lima. */
export function aIsoLima(valorLocal: string): string {
  return `${valorLocal}:00${LIMA_OFFSET}`
}

/**
 * «45 min», «1 h 30 min», «2 h» → minutos. La carta escribe las duraciones como
 * texto libre; un `match(/\d+/)` a secas leería «1 h 30 min» como 1.
 */
export function duracionMinutos(texto: string | null | undefined): number {
  const t = (texto ?? "").toLowerCase()
  // Con horas: «1 h 30 min», «2 h», «1h30», «1 hora 15 min».
  const conHoras = t.match(/(\d+(?:[.,]\d+)?)\s*h[a-záéíóú]*\s*(?:y\s*)?(\d+)?/)
  if (conHoras) return Math.round(Number(conHoras[1].replace(",", ".")) * 60) + Number(conHoras[2] ?? 0)
  return Number(t.match(/\d+/)?.[0] ?? 0)
}
