import { LIMA_OFFSET } from "@/lib/format"
import type { MetodoPago, Profesional, Sede } from "@/lib/types"
import type { MovimientoConDetalle } from "./datos"

/**
 * Movimientos de mentira para ver cómo se comporta el tablero cuando todavía
 * no hay caja real.
 *
 * NO se escribe nada en la base: se generan en memoria y solo viven mientras
 * el interruptor esté puesto. Meter filas de prueba en `movimientos_caja`
 * ensuciaría el arqueo y los reportes de verdad, y separarlas después es un
 * problema que no vale la pena crearse.
 *
 * La secuencia es determinista (generador con semilla): sin eso, cada
 * re-render repintaría los gráficos con otros números y no se podría ni
 * comparar una pantalla con la anterior.
 */

const SERVICIOS = [
  { nombre: "Alisado brasileño", precio: 180 },
  { nombre: "Manicure clásica", precio: 25 },
  { nombre: "Esmaltado en gel", precio: 30 },
  { nombre: "Botox instantáneo", precio: 90 },
  { nombre: "Uñas builder", precio: 65 },
  { nombre: "Pestañas pelo a pelo", precio: 120 },
  { nombre: "Diseño de cejas", precio: 35 },
  { nombre: "Alisado orgánico", precio: 250 },
]

const METODOS: { metodo: MetodoPago; peso: number }[] = [
  { metodo: "yape", peso: 34 },
  { metodo: "efectivo", peso: 30 },
  { metodo: "plin", peso: 14 },
  { metodo: "tarjeta", peso: 16 },
  { metodo: "transferencia", peso: 6 },
]

const EGRESOS = [
  { categoria: "insumo" as const, concepto: "Tintes y decolorante", min: 40, max: 180 },
  { categoria: "proveedor" as const, concepto: "Pedido de insumos", min: 90, max: 320 },
  { categoria: "servicios" as const, concepto: "Luz y agua", min: 60, max: 140 },
  { categoria: "movilidad" as const, concepto: "Movilidad del equipo", min: 15, max: 45 },
]

/** Generador con semilla (mulberry32): mismo rango, mismos números. */
function generador(semilla: number) {
  let a = semilla
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function elegir<T>(azar: () => number, opciones: T[]): T {
  return opciones[Math.floor(azar() * opciones.length)]!
}

function metodoPonderado(azar: () => number): MetodoPago {
  const total = METODOS.reduce((s, m) => s + m.peso, 0)
  let tirada = azar() * total
  for (const m of METODOS) {
    tirada -= m.peso
    if (tirada <= 0) return m.metodo
  }
  return "efectivo"
}

function movimientoBase(id: string, ocurridoAt: string, sedeId: string | null) {
  return {
    id,
    sesion_id: `demo-sesion-${sedeId ?? "sin"}`,
    anulado: false,
    anulado_por: null,
    anulado_at: null,
    anulado_motivo: null,
    registrado_por: "demo",
    ocurrido_at: ocurridoAt,
    created_at: ocurridoAt,
    updated_at: ocurridoAt,
    cita_id: null,
    producto_id: null,
    clientes: null,
    caja_sesiones: { sede_id: sedeId },
  }
}

/**
 * @param dias  Días de Lima del rango visible (los mismos que usa `porDia`).
 */
export function movimientosDeEjemplo(
  dias: string[],
  sedes: Sede[],
  profesionales: Profesional[],
): MovimientoConDetalle[] {
  if (dias.length === 0) return []

  // La semilla sale del rango, así que el mismo rango siempre pinta lo mismo.
  const azar = generador(dias.length * 7919 + Number(dias[0]!.replaceAll("-", "")))
  const sedesUsables = sedes.filter((s) => s.activa)
  const filas: MovimientoConDetalle[] = []
  let n = 0

  for (const dia of dias) {
    // Fin de semana con más movimiento, que es como se comporta un salón.
    const finde = [0, 6].includes(new Date(`${dia}T12:00:00Z`).getUTCDay())
    const cobros = Math.round((finde ? 9 : 6) + azar() * 5)

    for (let i = 0; i < cobros; i++) {
      const sede = sedesUsables.length ? elegir(azar, sedesUsables) : null
      const delLocal = profesionales.filter((p) => !sede || p.sede_id === sede.id)
      const prof = delLocal.length ? elegir(azar, delLocal) : null
      const servicio = elegir(azar, SERVICIOS)
      // 10:00–20:00, con los minutos en punto o y media.
      const hora = 10 + Math.floor(azar() * 11)
      const minuto = azar() < 0.5 ? "00" : "30"
      const cuando = `${dia}T${String(hora).padStart(2, "0")}:${minuto}:00${LIMA_OFFSET}`

      filas.push({
        ...movimientoBase(`demo-i-${n++}`, cuando, sede?.id ?? null),
        tipo: "ingreso",
        categoria: "servicio",
        concepto: servicio.nombre,
        monto: servicio.precio,
        metodo: metodoPonderado(azar),
        servicio_id: null,
        cliente_id: null,
        profesional_id: prof?.id ?? null,
        services: { name: servicio.nombre },
      } as MovimientoConDetalle)
    }

    // Un egreso la mayoría de los días, no todos.
    if (azar() < 0.7) {
      const e = elegir(azar, EGRESOS)
      const sede = sedesUsables.length ? elegir(azar, sedesUsables) : null
      filas.push({
        ...movimientoBase(`demo-e-${n++}`, `${dia}T18:00:00${LIMA_OFFSET}`, sede?.id ?? null),
        tipo: "egreso",
        categoria: e.categoria,
        concepto: e.concepto,
        monto: Math.round(e.min + azar() * (e.max - e.min)),
        metodo: azar() < 0.6 ? "efectivo" : "transferencia",
        servicio_id: null,
        cliente_id: null,
        profesional_id: null,
        services: null,
      } as MovimientoConDetalle)
    }
  }

  return filas
}
