import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { CalendarCheck2, Sparkles, TrendingUp, UserPlus } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { diaLima, fechaCorta, horaLima, money, moneyShort, numero } from "@/lib/format"
import { CITA_ESTADO_LABEL, type CitaEstado } from "@/lib/types"
import {
  ChartFrame,
  Cifra,
  Columnas,
  Leyenda,
  LineaArea,
  Ranking,
  TablaDatos,
  SinDatos,
  serieColor,
} from "@/components/charts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/PageHeader"
import { SelectorRango } from "./Caja/SelectorRango"
import { porDia, topServicios, useCaja } from "./Caja/datos"
import { resolverRango, variacion, type RangoId } from "./Caja/rango"

/**
 * Los estados de cita SÍ significan bien/mal (asistió, no asistió), así que
 * llevan los tokens de estado reservados y no colores de serie — un color de
 * estado nunca hace de «serie 4», y al revés tampoco.
 */
const ESTADOS: { id: CitaEstado; color: string }[] = [
  { id: "completada", color: "var(--status-confirmed)" },
  { id: "confirmada", color: "var(--status-completed)" },
  { id: "no_asistio", color: "var(--status-pending)" },
  { id: "cancelada", color: "var(--status-cancelled)" },
]

type CitaFila = {
  id: string
  inicio_utc: string
  estado: CitaEstado
  services: { name: string } | null
  clientes: { nombre: string | null; telefono: string } | null
}

export default function Resumen() {
  const [rangoId, setRangoId] = useState<RangoId>("7d")
  const rango = useMemo(() => resolverRango(rangoId), [rangoId])
  const { vivos, totales, totalesPrevios, cargando } = useCaja(rango)

  const [citas, setCitas] = useState<CitaFila[]>([])
  const [nuevos, setNuevos] = useState(0)
  const [agenda, setAgenda] = useState<CitaFila[]>([])
  const [cargandoCitas, setCargandoCitas] = useState(true)

  useEffect(() => {
    let vigente = true
    setCargandoCitas(true)

    const hoy = diaLima(new Date())
    const desdeHoy = new Date(`${hoy}T00:00:00-05:00`).toISOString()
    const hastaHoy = new Date(`${hoy}T23:59:59-05:00`).toISOString()

    void Promise.all([
      supabase
        .from("citas")
        .select("id, inicio_utc, estado, services(name), clientes(nombre, telefono)")
        .gte("inicio_utc", rango.desde)
        .lt("inicio_utc", rango.hasta),
      supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .gte("created_at", rango.desde)
        .lt("created_at", rango.hasta),
      supabase
        .from("citas")
        .select("id, inicio_utc, estado, services(name), clientes(nombre, telefono)")
        .gte("inicio_utc", desdeHoy)
        .lte("inicio_utc", hastaHoy)
        .neq("estado", "cancelada")
        .order("inicio_utc"),
    ]).then(([enRango, clientesNuevos, hoyCitas]) => {
      if (!vigente) return
      setCitas((enRango.data ?? []) as unknown as CitaFila[])
      setNuevos(clientesNuevos.count ?? 0)
      setAgenda((hoyCitas.data ?? []) as unknown as CitaFila[])
      setCargandoCitas(false)
    })

    return () => {
      vigente = false
    }
  }, [rango])

  const serieIngresos = useMemo(() => porDia(vivos, rango.dias), [vivos, rango.dias])
  const servicios = useMemo(() => topServicios(vivos), [vivos])

  const citasPorDia = useMemo(() => {
    const mapa = new Map(rango.dias.map((d) => [d, ESTADOS.map(() => 0)]))
    for (const c of citas) {
      const fila = mapa.get(diaLima(c.inicio_utc))
      if (!fila) continue
      const i = ESTADOS.findIndex((e) => e.id === c.estado)
      if (i >= 0) fila[i] += 1
    }
    return rango.dias.map((d) => ({ dia: d, valores: mapa.get(d)! }))
  }, [citas, rango.dias])

  const completadas = citas.filter((c) => c.estado === "completada").length
  const noAsistio = citas.filter((c) => c.estado === "no_asistio").length

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
      <PageHeader
        eyebrow="Panel"
        titulo="Resumen"
        descripcion="Cómo va el salón: dinero, agenda y clientas, en el mismo rango."
        acciones={
          <Button variant="gold" render={<Link to="/caja" />}>
            <TrendingUp /> Ir a caja
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <SelectorRango valor={rangoId} onChange={setRangoId} />
        <span className="text-[11.5px] text-muted-foreground">
          {rango.dias.length === 1
            ? fechaCorta(rango.desde)
            : `${fechaCorta(rango.desde)} — ${fechaCorta(rango.dias[rango.dias.length - 1])}`}
        </span>
      </div>

      {cargando ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[124px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Cifra
            destacada
            etiqueta="Ingresos"
            valor={money(totales.ingresos)}
            delta={variacion(totales.ingresos, totalesPrevios.ingresos)}
            deltaEtiqueta="vs. anterior"
            chispa={serieIngresos.map((d) => d.ingresos)}
            color={serieColor(0)}
          />
          <Cifra
            etiqueta="Citas"
            valor={numero(citas.length)}
            deltaEtiqueta={`${completadas} completadas`}
            icono={<CalendarCheck2 className="size-4" />}
          />
          <Cifra
            etiqueta="Ticket promedio"
            valor={money(totales.ticketPromedio)}
            delta={variacion(totales.ticketPromedio, totalesPrevios.ticketPromedio)}
            deltaEtiqueta={`${numero(totales.ventas)} cobros`}
            icono={<Sparkles className="size-4" />}
          />
          <Cifra
            etiqueta="Clientas nuevas"
            valor={numero(nuevos)}
            deltaEtiqueta={noAsistio ? `${noAsistio} no asistieron` : undefined}
            icono={<UserPlus className="size-4" />}
          />
        </div>
      )}

      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <Card crest className="xl:col-span-2">
          <CardContent>
            {/* Una sola serie: sin caja de leyenda, el título ya la nombra. */}
            <ChartFrame
              titulo="Ingresos por día"
              descripcion="Solo movimientos de caja no anulados."
              tabla={
                <TablaDatos
                  columnas={["Día", "Ingresos"]}
                  filas={serieIngresos.map((d) => [
                    fechaCorta(`${d.dia}T12:00:00Z`),
                    money(d.ingresos),
                  ])}
                />
              }
            >
              <LineaArea
                puntos={serieIngresos.map((d) => ({
                  x: fechaCorta(`${d.dia}T12:00:00Z`),
                  valores: [d.ingresos],
                }))}
                series={[{ nombre: "Ingresos", color: serieColor(0) }]}
                formato={moneyShort}
                alto={250}
              />
            </ChartFrame>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agenda de hoy</CardTitle>
          </CardHeader>
          <CardContent>
            {cargandoCitas ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : agenda.length === 0 ? (
              <SinDatos alto={180} mensaje="No hay citas para hoy." />
            ) : (
              <ul className="space-y-2">
                {agenda.slice(0, 7).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5"
                  >
                    <span className="tnum shrink-0 text-[13px] font-medium text-gold-deep dark:text-gold">
                      {horaLima(c.inicio_utc)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">
                        {c.clientes?.nombre ?? c.clientes?.telefono ?? "Sin cliente"}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">
                        {c.services?.name ?? "Servicio"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent>
            <ChartFrame
              titulo="Citas por día"
              descripcion="Apiladas por estado."
              leyenda={
                <Leyenda
                  series={ESTADOS.map((e) => ({
                    nombre: CITA_ESTADO_LABEL[e.id],
                    color: e.color,
                  }))}
                />
              }
              tabla={
                <TablaDatos
                  columnas={["Día", ...ESTADOS.map((e) => CITA_ESTADO_LABEL[e.id])]}
                  filas={citasPorDia.map((d) => [
                    fechaCorta(`${d.dia}T12:00:00Z`),
                    ...d.valores,
                  ])}
                />
              }
            >
              <Columnas
                apiladas
                puntos={citasPorDia.map((d) => ({
                  x: fechaCorta(`${d.dia}T12:00:00Z`),
                  valores: d.valores,
                }))}
                series={ESTADOS.map((e) => ({
                  nombre: CITA_ESTADO_LABEL[e.id],
                  color: e.color,
                }))}
                formato={(n) => numero(Math.round(n))}
                alto={230}
              />
            </ChartFrame>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <ChartFrame
              titulo="Servicios más cobrados"
              descripcion="Por recaudación en el rango."
              tabla={
                <TablaDatos
                  columnas={["Servicio", "Cobros", "Monto"]}
                  filas={servicios.map((s) => [s.nombre, s.n, money(s.monto)])}
                />
              }
            >
              <Ranking
                filas={servicios.map((s) => ({
                  etiqueta: s.nombre,
                  valor: s.monto,
                  detalle: `${s.n}×`,
                }))}
                formato={money}
                color={serieColor(0)}
              />
            </ChartFrame>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
