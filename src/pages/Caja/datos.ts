/** Consultas y agregados del control de caja. */
import { useCallback, useEffect, useMemo, useState } from "react"

import { supabase } from "@/lib/supabase"
import { diaLima } from "@/lib/format"
import {
  METODOS_PAGO,
  METODO_ES_EFECTIVO,
  type CajaSesionResumen,
  type CategoriaMovimiento,
  type MetodoPago,
  type MovimientoCaja,
  type MovimientoTipo,
} from "@/lib/types"
import type { Rango } from "./rango"
import { rangoAnterior } from "./rango"

/** Movimiento con lo que trae el join: nombre del servicio y del cliente. */
export type MovimientoConDetalle = MovimientoCaja & {
  services: { name: string } | null
  clientes: { nombre: string | null; telefono: string } | null
  /**
   * El local sale de la sesión de caja, no del movimiento: el dinero se
   * atribuye a la caja donde se cobró. Va en null si el movimiento no cuelga
   * de ninguna sesión (`sesion_id` es nullable).
   */
  caja_sesiones: { sede_id: string | null } | { sede_id: string | null }[] | null
}

const SELECT_MOVIMIENTO = "*, services(name), clientes(nombre, telefono), caja_sesiones(sede_id)"

/** Lo mínimo que hace falta para filtrar y totalizar; lo cumple tanto el
 *  movimiento completo como la fila recortada del periodo anterior. */
export type MovimientoFiltrable = {
  tipo: MovimientoTipo
  monto: number
  metodo: MetodoPago
  categoria: CategoriaMovimiento
  anulado: boolean
  ocurrido_at: string
  profesional_id: string | null
  caja_sesiones: { sede_id: string | null } | { sede_id: string | null }[] | null
}

/**
 * El local de un movimiento, o null si no cuelga de ninguna sesión.
 *
 * Acepta objeto o arreglo a propósito: PostgREST devuelve un objeto para una
 * relación de muchos-a-uno, pero los tipos generados la declaran como arreglo.
 * Asumir una sola forma haría que el filtro por sede no coincidiera nunca y
 * la pantalla se viera vacía sin ningún error.
 */
export function sedeDeMovimiento(m: MovimientoFiltrable): string | null {
  const rel = m.caja_sesiones
  if (!rel) return null
  return (Array.isArray(rel) ? rel[0]?.sede_id : rel.sede_id) ?? null
}

export type Totales = {
  ingresos: number
  egresos: number
  neto: number
  /** Media por cobro (solo ingresos que son una venta, no propinas ni adelantos). */
  ticketPromedio: number
  ventas: number
}

export function totalizar(movs: Pick<MovimientoCaja, "tipo" | "monto" | "categoria" | "anulado">[]): Totales {
  let ingresos = 0
  let egresos = 0
  let ventasMonto = 0
  let ventas = 0

  for (const m of movs) {
    if (m.anulado) continue
    if (m.tipo === "ingreso") {
      ingresos += Number(m.monto)
      if (m.categoria === "servicio" || m.categoria === "producto" || m.categoria === "curso") {
        ventasMonto += Number(m.monto)
        ventas += 1
      }
    } else {
      egresos += Number(m.monto)
    }
  }

  return {
    ingresos,
    egresos,
    neto: ingresos - egresos,
    ventas,
    ticketPromedio: ventas ? ventasMonto / ventas : 0,
  }
}

/** Serie diaria de ingresos y egresos, con los días vacíos incluidos. */
export function porDia(movs: MovimientoCaja[], dias: string[]) {
  const mapa = new Map(dias.map((d) => [d, { ingresos: 0, egresos: 0 }]))

  for (const m of movs) {
    if (m.anulado) continue
    const dia = diaLima(m.ocurrido_at)
    const celda = mapa.get(dia)
    if (!celda) continue
    if (m.tipo === "ingreso") celda.ingresos += Number(m.monto)
    else celda.egresos += Number(m.monto)
  }

  return dias.map((d) => ({ dia: d, ...mapa.get(d)! }))
}

export function porMetodo(movs: MovimientoCaja[]) {
  const mapa = new Map<MetodoPago, number>(METODOS_PAGO.map((m) => [m, 0]))
  for (const m of movs) {
    if (m.anulado || m.tipo !== "ingreso") continue
    mapa.set(m.metodo, (mapa.get(m.metodo) ?? 0) + Number(m.monto))
  }
  return METODOS_PAGO.map((metodo) => ({ metodo, monto: mapa.get(metodo) ?? 0 })).filter(
    (x) => x.monto > 0
  )
}

/**
 * Ingresos por profesional. Lo cobrado antes de la migración 0014 no tiene a
 * quién acreditarse, así que cae en "Sin asignar" en vez de repartirse o
 * desaparecer — el total del desglose sigue cuadrando con el de ingresos.
 */
export function porProfesional(movs: MovimientoCaja[], nombreDe: (id: string | null) => string) {
  const mapa = new Map<string, { monto: number; n: number }>()
  for (const m of movs) {
    if (m.anulado || m.tipo !== "ingreso") continue
    const nombre = m.profesional_id ? nombreDe(m.profesional_id) : "Sin asignar"
    const prev = mapa.get(nombre) ?? { monto: 0, n: 0 }
    mapa.set(nombre, { monto: prev.monto + Number(m.monto), n: prev.n + 1 })
  }
  return [...mapa.entries()]
    .map(([nombre, v]) => ({ nombre, ...v }))
    .sort((a, b) => b.monto - a.monto)
}

export function porCategoria(movs: MovimientoCaja[], tipo: "ingreso" | "egreso") {
  const mapa = new Map<CategoriaMovimiento, { monto: number; n: number }>()
  for (const m of movs) {
    if (m.anulado || m.tipo !== tipo) continue
    const prev = mapa.get(m.categoria) ?? { monto: 0, n: 0 }
    mapa.set(m.categoria, { monto: prev.monto + Number(m.monto), n: prev.n + 1 })
  }
  return [...mapa.entries()]
    .map(([categoria, v]) => ({ categoria, ...v }))
    .sort((a, b) => b.monto - a.monto)
}

/** Ranking de servicios cobrados, por recaudación. */
export function topServicios(movs: MovimientoConDetalle[]) {
  const mapa = new Map<string, { monto: number; n: number }>()
  for (const m of movs) {
    if (m.anulado || m.tipo !== "ingreso") continue
    const nombre = m.services?.name ?? (m.categoria === "servicio" ? m.concepto : null)
    if (!nombre) continue
    const prev = mapa.get(nombre) ?? { monto: 0, n: 0 }
    mapa.set(nombre, { monto: prev.monto + Number(m.monto), n: prev.n + 1 })
  }
  return [...mapa.entries()]
    .map(([nombre, v]) => ({ nombre, ...v }))
    .sort((a, b) => b.monto - a.monto)
}

/** Reparto por hora del día: dice a qué hora conviene tener más gente. */
export function porHora(movs: MovimientoCaja[]) {
  const horas = Array.from({ length: 24 }, () => 0)
  for (const m of movs) {
    if (m.anulado || m.tipo !== "ingreso") continue
    const h = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "America/Lima",
        hour: "2-digit",
        hour12: false,
      }).format(new Date(m.ocurrido_at))
    )
    if (Number.isFinite(h)) horas[h] += Number(m.monto)
  }
  // El salón abre 9–21: fuera de esa franja el eje es ruido.
  return horas.map((monto, hora) => ({ hora, monto })).slice(8, 22)
}

export function efectivoDe(movs: MovimientoCaja[]) {
  let entra = 0
  let sale = 0
  for (const m of movs) {
    if (m.anulado || !METODO_ES_EFECTIVO(m.metodo)) continue
    if (m.tipo === "ingreso") entra += Number(m.monto)
    else sale += Number(m.monto)
  }
  return { entra, sale, neto: entra - sale }
}

/* ==========================================================================
   Hook principal
   ========================================================================== */

export function useCaja(rango: Rango) {
  const [movimientos, setMovimientos] = useState<MovimientoConDetalle[]>([])
  const [previos, setPrevios] = useState<MovimientoFiltrable[]>([])
  // Desde la migración 0014 puede haber una caja abierta POR SEDE, así que
  // esto es una lista. Antes era `maybeSingle()`, que con dos turnos abiertos
  // a la vez no devuelve la primera: lanza error y la pantalla entera queda
  // sin datos.
  const [abiertas, setAbiertas] = useState<CajaSesionResumen[]>([])
  const [sesiones, setSesiones] = useState<CajaSesionResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    const anterior = rangoAnterior(rango)

    const [actual, previo, abierta, historial] = await Promise.all([
      supabase
        .from("movimientos_caja")
        .select(SELECT_MOVIMIENTO)
        .gte("ocurrido_at", rango.desde)
        .lt("ocurrido_at", rango.hasta)
        .order("ocurrido_at", { ascending: false }),
      supabase
        .from("movimientos_caja")
        .select("tipo, monto, metodo, categoria, anulado, ocurrido_at, profesional_id, caja_sesiones(sede_id)")
        .gte("ocurrido_at", anterior.desde)
        .lt("ocurrido_at", anterior.hasta),
      supabase.from("caja_sesiones_resumen").select("*").eq("estado", "abierta"),
      supabase
        .from("caja_sesiones_resumen")
        .select("*")
        .order("apertura_at", { ascending: false })
        .limit(12),
    ])

    const fallo = actual.error ?? previo.error ?? abierta.error ?? historial.error
    if (fallo) setError(fallo.message)

    setMovimientos((actual.data ?? []) as MovimientoConDetalle[])
    setPrevios((previo.data ?? []) as unknown as MovimientoFiltrable[])
    setAbiertas((abierta.data ?? []) as CajaSesionResumen[])
    setSesiones((historial.data ?? []) as CajaSesionResumen[])
    setCargando(false)
  }, [rango])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const vivos = useMemo(() => movimientos.filter((m) => !m.anulado), [movimientos])

  const totales = useMemo(() => totalizar(vivos), [vivos])
  const previosVivos = useMemo(() => previos.filter((m) => !m.anulado), [previos])
  const totalesPrevios = useMemo(() => totalizar(previosVivos), [previosVivos])

  return {
    movimientos,
    vivos,
    totales,
    totalesPrevios,
    previosVivos,
    abiertas,
    sesiones,
    cargando,
    error,
    recargar: cargar,
  }
}
