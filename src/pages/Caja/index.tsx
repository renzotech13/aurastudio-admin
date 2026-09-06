import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  Coins,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { fechaCorta, fechaHora, horaLima, money, moneyShort, numero } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  CATEGORIA_LABEL,
  METODO_PAGO_LABEL,
  type MovimientoTipo,
} from "@/lib/types"
import {
  ChartFrame,
  Cifra,
  Columnas,
  Dona,
  Leyenda,
  LineaArea,
  Ranking,
  TablaDatos,
  serieColor,
} from "@/components/charts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/PageHeader"
import { MovimientoDialog } from "./MovimientoDialog"
import { SelectorRango } from "./SelectorRango"
import { SesionPanel } from "./SesionPanel"
import {
  efectivoDe,
  porCategoria,
  porDia,
  porHora,
  porMetodo,
  porProfesional,
  sedeDeMovimiento,
  topServicios,
  useCaja,
} from "./datos"
import { resolverRango, variacion, type RangoId } from "./rango"
import { useEquipo } from "@/lib/equipo"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function Caja() {
  const { session } = useAuth()
  const [rangoId, setRangoId] = useState<RangoId>("hoy")
  const rango = useMemo(() => resolverRango(rangoId), [rangoId])
  const { movimientos, vivos, totales, totalesPrevios, abiertas, sesiones, cargando, error, recargar } =
    useCaja(rango)

  const [dialogo, setDialogo] = useState<MovimientoTipo | null>(null)
  const [sedeId, setSedeId] = useState<string>("all")
  const [profesionalId, setProfesionalId] = useState<string>("all")
  const { sedes, profesionales, nombreProfesional } = useEquipo()

  // Con el filtro en un local concreto se muestra SU caja; sin filtro, la
  // única abierta (o ninguna, si hay varias y no se dijo cuál).
  const sesion =
    sedeId === "all"
      ? abiertas.length === 1
        ? abiertas[0]
        : null
      : (abiertas.find((s) => s.sede_id === sedeId) ?? null)

  const profesionalesDeSede =
    sedeId === "all" ? profesionales : profesionales.filter((p) => p.sede_id === sedeId)

  // Local y profesional acotan TODO lo de abajo (gráficos, cifras y tabla),
  // igual que el rango de fechas. Se aplica sobre `vivos` (lo no anulado) para
  // que cada agregador reciba ya lo filtrado y no tenga que saber del filtro.
  const enFoco = useMemo(
    () =>
      vivos.filter((m) => {
        if (sedeId !== "all" && sedeDeMovimiento(m) !== sedeId) return false
        if (profesionalId !== "all" && m.profesional_id !== profesionalId) return false
        return true
      }),
    [vivos, sedeId, profesionalId],
  )

  const serie = useMemo(() => porDia(enFoco, rango.dias), [enFoco, rango.dias])
  const metodos = useMemo(() => porMetodo(enFoco), [enFoco])
  const egresosCat = useMemo(() => porCategoria(enFoco, "egreso"), [enFoco])
  const servicios = useMemo(() => topServicios(enFoco), [enFoco])
  const horas = useMemo(() => porHora(enFoco), [enFoco])
  const efectivo = useMemo(() => efectivoDe(enFoco), [enFoco])
  const equipo = useMemo(
    () => porProfesional(enFoco, nombreProfesional),
    [enFoco, nombreProfesional],
  )

  const SERIES_FLUJO = [
    { nombre: "Ingresos", color: serieColor(0) },
    { nombre: "Egresos", color: serieColor(1) },
  ]

  async function anular(id: string, concepto: string) {
    if (!session) return
    const motivo = window.prompt(`¿Por qué se anula «${concepto}»?`)
    if (motivo === null) return

    const { error: err } = await supabase
      .from("movimientos_caja")
      .update({
        anulado: true,
        anulado_at: new Date().toISOString(),
        anulado_por: session.user.id,
        anulado_motivo: motivo.trim() || null,
      })
      .eq("id", id)

    if (err) {
      toast.error(`No se pudo anular: ${err.message}`)
      return
    }
    toast.success("Movimiento anulado")
    void recargar()
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
      <PageHeader
        eyebrow="Control de caja"
        titulo="Caja"
        descripcion="Lo que entra y lo que sale del salón, turno por turno."
        acciones={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDialogo("egreso")}>
              <ArrowDownRight /> Egreso
            </Button>
            <Button variant="gold" onClick={() => setDialogo("ingreso")}>
              <Plus /> Ingreso
            </Button>
          </div>
        }
      />

      {/* Los filtros van arriba y delimitan todo lo de abajo. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <SelectorRango valor={rangoId} onChange={setRangoId} />
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={sedeId}
            onValueChange={(v) => {
              setSedeId(v ?? "all")
              setProfesionalId("all")
            }}
          >
            <SelectTrigger className="h-9 w-[180px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los locales</SelectItem>
              {sedes.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={profesionalId} onValueChange={(v) => setProfesionalId(v ?? "all")}>
            <SelectTrigger className="h-9 w-[180px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las profesionales</SelectItem>
              {profesionalesDeSede.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-[11.5px] text-muted-foreground">
          {rango.dias.length === 1
            ? fechaCorta(rango.desde)
            : `${fechaCorta(rango.desde)} — ${fechaCorta(rango.dias[rango.dias.length - 1])}`}
        </span>
      </div>

      {error ? (
        <Card className="mb-6 border-destructive/40">
          <CardContent className="text-[13px] text-destructive">
            No se pudieron cargar los movimientos: {error}
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-6">
        <SesionPanel sesion={sesion} onCambio={recargar} />
      </div>

      {/* Cifras. Solo una es la cifra héroe de la vista. */}
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
            chispa={serie.map((d) => d.ingresos)}
            color={serieColor(0)}
            icono={<ArrowUpRight className="size-4" />}
          />
          <Cifra
            etiqueta="Egresos"
            valor={money(totales.egresos)}
            delta={variacion(totales.egresos, totalesPrevios.egresos)}
            deltaEtiqueta="vs. anterior"
            subirEsBueno={false}
            chispa={serie.map((d) => d.egresos)}
            color={serieColor(1)}
            icono={<ArrowDownRight className="size-4" />}
          />
          <Cifra
            etiqueta="Neto"
            valor={money(totales.neto)}
            delta={variacion(totales.neto, totalesPrevios.neto)}
            deltaEtiqueta="vs. anterior"
            icono={<Coins className="size-4" />}
          />
          <Cifra
            etiqueta="Ticket promedio"
            valor={money(totales.ticketPromedio)}
            delta={variacion(totales.ticketPromedio, totalesPrevios.ticketPromedio)}
            deltaEtiqueta={`${numero(totales.ventas)} cobros`}
            icono={<Receipt className="size-4" />}
          />
        </div>
      )}

      {/* Gráficos */}
      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <Card crest className="xl:col-span-2">
          <CardContent>
            <ChartFrame
              titulo="Ingresos y egresos por día"
              descripcion="Cada punto es un día de Lima."
              leyenda={<Leyenda series={SERIES_FLUJO} tipo="line" />}
              tabla={
                <TablaDatos
                  columnas={["Día", "Ingresos", "Egresos", "Neto"]}
                  filas={serie.map((d) => [
                    fechaCorta(`${d.dia}T12:00:00Z`),
                    money(d.ingresos),
                    money(d.egresos),
                    money(d.ingresos - d.egresos),
                  ])}
                />
              }
            >
              <LineaArea
                puntos={serie.map((d) => ({
                  x: fechaCorta(`${d.dia}T12:00:00Z`),
                  valores: [d.ingresos, d.egresos],
                }))}
                series={SERIES_FLUJO}
                formato={moneyShort}
                alto={260}
              />
            </ChartFrame>
          </CardContent>
        </Card>

        <Card crest>
          <CardContent>
            <ChartFrame
              titulo="Cómo pagan"
              descripcion="Reparto de los ingresos por método."
              leyenda={
                <Leyenda
                  series={metodos.map((m, i) => ({
                    nombre: METODO_PAGO_LABEL[m.metodo],
                    color: serieColor(i),
                  }))}
                />
              }
              tabla={
                <TablaDatos
                  columnas={["Método", "Monto", "Parte"]}
                  filas={metodos.map((m) => [
                    METODO_PAGO_LABEL[m.metodo],
                    money(m.monto),
                    `${Math.round((m.monto / (totales.ingresos || 1)) * 100)}%`,
                  ])}
                />
              }
            >
              <div className="flex justify-center py-2">
                <Dona
                  segmentos={metodos.map((m, i) => ({
                    nombre: METODO_PAGO_LABEL[m.metodo],
                    valor: m.monto,
                    color: serieColor(i),
                  }))}
                  formato={money}
                  centroEtiqueta="Ingresos"
                  tamano={196}
                />
              </div>
            </ChartFrame>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
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

        <Card>
          <CardContent>
            <ChartFrame
              titulo="Recaudación por profesional"
              descripcion="Lo cobrado antes de separar por profesional aparece como «Sin asignar»."
              tabla={
                <TablaDatos
                  columnas={["Profesional", "Cobros", "Monto"]}
                  filas={equipo.map((p) => [p.nombre, p.n, money(p.monto)])}
                />
              }
            >
              <Ranking
                filas={equipo.map((p) => ({
                  etiqueta: p.nombre,
                  valor: p.monto,
                  detalle: `${p.n}×`,
                }))}
                formato={money}
                color={serieColor(2)}
              />
            </ChartFrame>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <ChartFrame
              titulo="En qué se va"
              descripcion="Egresos por categoría."
              tabla={
                <TablaDatos
                  columnas={["Categoría", "Movimientos", "Monto"]}
                  filas={egresosCat.map((c) => [
                    CATEGORIA_LABEL[c.categoria] ?? c.categoria,
                    c.n,
                    money(c.monto),
                  ])}
                />
              }
            >
              <Ranking
                filas={egresosCat.map((c) => ({
                  etiqueta: CATEGORIA_LABEL[c.categoria] ?? c.categoria,
                  valor: c.monto,
                  detalle: `${c.n}×`,
                }))}
                formato={money}
                color={serieColor(1)}
              />
            </ChartFrame>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <ChartFrame
              titulo="Ingresos por hora"
              descripcion="De 8:00 a 21:00, hora de Lima."
              tabla={
                <TablaDatos
                  columnas={["Hora", "Ingresos"]}
                  filas={horas.map((h) => [`${String(h.hora).padStart(2, "0")}:00`, money(h.monto)])}
                />
              }
            >
              <Columnas
                puntos={horas.map((h) => ({
                  x: String(h.hora).padStart(2, "0"),
                  valores: [h.monto],
                }))}
                series={[{ nombre: "Ingresos", color: serieColor(0) }]}
                formato={moneyShort}
                alto={200}
              />
            </ChartFrame>
          </CardContent>
        </Card>
      </div>

      {/* Efectivo del rango: el dato con el que se cuadra el cajón. */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <ResumenEfectivo etiqueta="Entró en efectivo" valor={money(efectivo.entra)} />
        <ResumenEfectivo etiqueta="Salió en efectivo" valor={money(efectivo.sale)} />
        <ResumenEfectivo etiqueta="Efectivo neto" valor={money(efectivo.neto)} destacado />
      </div>

      {/* Libro de movimientos */}
      <Card crest className="mb-6">
        <CardHeader>
          <CardTitle>Movimientos del rango</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {cargando ? (
            <div className="space-y-2 px-5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 rounded-xl" />
              ))}
            </div>
          ) : movimientos.length === 0 ? (
            <p className="px-5 text-[13px] text-muted-foreground">
              Todavía no hay movimientos en este rango.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.map((m) => (
                    <TableRow key={m.id} className={cn(m.anulado && "opacity-50")}>
                      <TableCell className="tnum whitespace-nowrap text-muted-foreground">
                        {rango.dias.length > 1 ? fechaHora(m.ocurrido_at) : horaLima(m.ocurrido_at)}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <span className={cn(m.anulado && "line-through")}>{m.concepto}</span>
                        {m.anulado ? (
                          <span className="ml-2 text-[11px] text-muted-foreground">
                            anulado{m.anulado_motivo ? `: ${m.anulado_motivo}` : ""}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {CATEGORIA_LABEL[m.categoria] ?? m.categoria}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {METODO_PAGO_LABEL[m.metodo]}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "tnum text-right font-medium whitespace-nowrap",
                          m.tipo === "ingreso" ? "text-status-confirmed" : "text-status-cancelled"
                        )}
                      >
                        {m.tipo === "ingreso" ? "+" : "−"} {money(m.monto)}
                      </TableCell>
                      <TableCell className="text-right">
                        {m.anulado ? null : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Anular ${m.concepto}`}
                            onClick={() => anular(m.id, m.concepto)}
                          >
                            <Ban />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial de arqueos */}
      <Card>
        <CardHeader>
          <CardTitle>Últimos arqueos</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {sesiones.length === 0 ? (
            <p className="px-5 text-[13px] text-muted-foreground">Aún no se ha cerrado ningún turno.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Turno</TableHead>
                    <TableHead className="text-right">Inicial</TableHead>
                    <TableHead className="text-right">Esperado</TableHead>
                    <TableHead className="text-right">Contado</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sesiones.map((s) => {
                    const cuadra = s.diferencia !== null && Math.abs(s.diferencia) < 0.005
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap">
                          {fechaHora(s.apertura_at)}
                          {s.estado === "abierta" ? (
                            <span className="ml-2 rounded-full bg-status-confirmed-bg px-2 py-0.5 text-[10.5px] text-status-confirmed">
                              abierta
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="tnum text-right">{money(s.monto_inicial)}</TableCell>
                        <TableCell className="tnum text-right">{money(s.efectivo_esperado)}</TableCell>
                        <TableCell className="tnum text-right">
                          {s.monto_declarado === null ? "—" : money(s.monto_declarado)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "tnum text-right font-medium",
                            s.diferencia === null
                              ? "text-muted-foreground"
                              : cuadra
                                ? "text-status-confirmed"
                                : "text-status-pending"
                          )}
                        >
                          {s.diferencia === null
                            ? "—"
                            : cuadra
                              ? "cuadra"
                              : `${s.diferencia > 0 ? "+" : "−"} ${money(Math.abs(s.diferencia))}`}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <MovimientoDialog
        open={dialogo !== null}
        onOpenChange={(v) => setDialogo(v ? (dialogo ?? "ingreso") : null)}
        tipoInicial={dialogo ?? "ingreso"}
        sesionId={sesion?.id ?? null}
        onGuardado={recargar}
      />
    </div>
  )
}

function ResumenEfectivo({
  etiqueta,
  valor,
  destacado = false,
}: {
  etiqueta: string
  valor: string
  destacado?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3",
        destacado && "border-gold/40 bg-gold/5"
      )}
    >
      <span className="flex items-center gap-2 text-[11.5px] tracking-[0.12em] text-muted-foreground uppercase">
        <Wallet className="size-3.5" aria-hidden /> {etiqueta}
      </span>
      <span className="tnum text-[15px] font-medium">{valor}</span>
    </div>
  )
}
