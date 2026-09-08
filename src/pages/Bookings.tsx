import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { CalendarCheck2, CalendarX2, ChevronDown, CircleCheck, UserPlus, UserX } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { actualizarEstadoCita as actualizarEstadoCitaBot, BotApiError } from "@/lib/botApi"
import { fechaConDiaSemana, horaLima, numero } from "@/lib/format"
import { cn } from "@/lib/utils"
import { CITA_ESTADO_LABEL, type Cita, type CitaEstado } from "@/lib/types"
import { useEquipo } from "@/lib/equipo"
import FichaClienteDialog from "@/pages/Reservas/FichaClienteDialog"
import WalkInDialog from "@/pages/Reservas/WalkInDialog"
import { Cifra } from "@/components/charts"
import { Segmented, type OpcionSegmentada } from "@/components/Segmented"
import { PageHeader } from "@/components/PageHeader"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** Cita + los datos del cliente y servicio que trae el join de Supabase. */
type CitaConDetalle = Cita & {
  clientes: { nombre: string | null; telefono: string | null }
  services: { name: string }
}

type FiltroEstado = "all" | CitaEstado

const ESTADO_ORDER: CitaEstado[] = ["confirmada", "completada", "no_asistio", "cancelada"]

const FILTROS: readonly OpcionSegmentada<FiltroEstado>[] = [
  { id: "all", label: "Todas" },
  { id: "confirmada", label: "Confirmadas" },
  { id: "completada", label: "Completadas" },
  { id: "no_asistio", label: "No asistió" },
  { id: "cancelada", label: "Canceladas" },
]

// Los tokens de color existentes quedaron nombrados por el enum viejo de
// 'bookings' (pending/confirmed/cancelled/completed) — se reutilizan por
// significado en vez de duplicar tokens de CSS para el enum de citas.
const ESTADO_COLOR_TOKEN: Record<CitaEstado, string> = {
  confirmada: "confirmed",
  completada: "completed",
  cancelada: "cancelled",
  no_asistio: "pending",
}

/** Píldora de estado, con el mismo lenguaje que los estados de Caja. */
function EstadoPill({ estado }: { estado: CitaEstado }) {
  const token = ESTADO_COLOR_TOKEN[estado]
  return (
    <span
      className="inline-block rounded-full px-2.5 py-1 text-[10.5px] tracking-[0.08em] whitespace-nowrap uppercase"
      style={{
        color: `var(--status-${token})`,
        backgroundColor: `var(--status-${token}-bg)`,
      }}
    >
      {CITA_ESTADO_LABEL[estado]}
    </span>
  )
}

export default function Bookings() {
  const [citas, setCitas] = useState<CitaConDetalle[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<FiltroEstado>("all")
  const [sedeId, setSedeId] = useState<string>("all")
  const [profesionalId, setProfesionalId] = useState<string>("all")
  const [fichaCliente, setFichaCliente] = useState<{ clienteId: string; citaId: string } | null>(null)
  const [walkIn, setWalkIn] = useState(false)
  const { sedes, profesionales, nombreSede, nombreProfesional } = useEquipo()

  // Al cambiar de local, la profesional elegida puede no pertenecer a él: los
  // equipos no se cruzan entre sedes y el filtro quedaría sin resultados sin
  // que se entienda por qué.
  const profesionalesDeSede =
    sedeId === "all" ? profesionales : profesionales.filter((p) => p.sede_id === sedeId)

  useEffect(() => {
    let active = true

    async function load() {
      // Fuente única: citas (WhatsApp y la reserva web escriben acá desde
      // que reserva.html pasó a agendar vía el bot en vez de una tabla
      // 'bookings' aparte sin validación de horario real.
      const { data, error } = await supabase
        .from("citas")
        .select("*, clientes!inner(nombre, telefono), services!inner(name)")
        .order("inicio_utc", { ascending: true })
      if (!active) return
      if (error) {
        toast.error("No se pudieron cargar las reservas.")
      } else {
        setCitas(data as CitaConDetalle[])
      }
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel("citas-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "citas" }, () => {
        load()
      })
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  async function updateStatus(id: string, estado: CitaEstado) {
    const previous = citas
    setCitas((rows) => rows.map((c) => (c.id === id ? { ...c, estado } : c)))
    try {
      // Vía el bot, no un update directo: si se cancela, el bot también
      // borra el evento de Calendar — un update directo a Supabase dejaba
      // el evento huérfano.
      await actualizarEstadoCitaBot(id, estado)
      toast.success(`Cita marcada como ${CITA_ESTADO_LABEL[estado].toLowerCase()}.`)
    } catch (err) {
      setCitas(previous)
      toast.error(err instanceof BotApiError ? err.message : "No se pudo actualizar el estado.")
    }
  }

  const filtradas = useMemo(
    () =>
      citas.filter((c) => {
        if (filtro !== "all" && c.estado !== filtro) return false
        if (sedeId !== "all" && c.sede_id !== sedeId) return false
        if (profesionalId !== "all" && c.profesional_id !== profesionalId) return false
        return true
      }),
    [citas, filtro, sedeId, profesionalId],
  )

  const conteo = useMemo(() => {
    const base: Record<CitaEstado, number> = {
      confirmada: 0,
      completada: 0,
      no_asistio: 0,
      cancelada: 0,
    }
    for (const c of citas) base[c.estado] += 1
    return base
  }, [citas])

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
      <PageHeader
        eyebrow="Operación"
        titulo="Reservas"
        descripcion={
          loading
            ? "Cargando…"
            : `${numero(conteo.confirmada)} cita${conteo.confirmada === 1 ? "" : "s"} confirmada${
                conteo.confirmada === 1 ? "" : "s"
              }, de WhatsApp y la web.`
        }
      />

      {/* Las cifras cuentan SIEMPRE sobre el total, no sobre el filtro: son
          el estado del negocio, no de la vista. */}
      {loading ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[124px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Cifra
            destacada
            etiqueta="Confirmadas"
            valor={numero(conteo.confirmada)}
            icono={<CalendarCheck2 className="size-4 text-status-confirmed" />}
          />
          <Cifra
            etiqueta="Completadas"
            valor={numero(conteo.completada)}
            icono={<CircleCheck className="size-4 text-status-completed" />}
          />
          <Cifra
            etiqueta="No asistió"
            valor={numero(conteo.no_asistio)}
            icono={<UserX className="size-4 text-status-pending" />}
          />
          <Cifra
            etiqueta="Canceladas"
            valor={numero(conteo.cancelada)}
            icono={<CalendarX2 className="size-4 text-status-cancelled" />}
          />
        </div>
      )}

      {/* El filtro va arriba de la tabla y solo la afecta a ella. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          opciones={FILTROS}
          valor={filtro}
          onChange={setFiltro}
          etiquetaAria="Filtrar reservas por estado"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={sedeId}
            onValueChange={(v) => {
              // El Select puede emitir null al deseleccionar; "all" es el
              // equivalente aquí (sin filtro), no un valor vacío.
              setSedeId(v ?? "all")
              setProfesionalId("all")
            }}
          >
            <SelectTrigger className="h-9 w-[190px] rounded-xl">
              {/* Sin esta función, SelectValue pinta el valor crudo: se veía
                  literalmente "all", y en el de profesional se vería el uuid. */}
              <SelectValue>{(v) => sedes.find((x) => x.id === v)?.nombre ?? "Todos los locales"}</SelectValue>
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
            <SelectTrigger className="h-9 w-[190px] rounded-xl">
              <SelectValue>
                {(v) => profesionales.find((x) => x.id === v)?.nombre ?? "Todas las profesionales"}
              </SelectValue>
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

          <span className="text-[11.5px] text-muted-foreground">
            {loading
              ? "—"
              : `${numero(filtradas.length)} de ${numero(citas.length)} en la lista`}
          </span>

          <Button variant="gold" size="sm" onClick={() => setWalkIn(true)}>
            <UserPlus className="size-4" />
            Registrar sin reserva
          </Button>
        </div>
      </div>

      <Card crest>
        <CardHeader>
          <CardTitle>Agenda</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <div className="space-y-2 px-5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 rounded-xl" />
              ))}
            </div>
          ) : filtradas.length === 0 ? (
            <p className="px-5 text-[13px] text-muted-foreground">
              No hay reservas en esta categoría todavía.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha y hora</TableHead>
                    <TableHead>Clienta</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Profesional</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((c) => (
                    <TableRow
                      key={c.id}
                      onClick={() => setFichaCliente({ clienteId: c.cliente_id, citaId: c.id })}
                      className={cn(
                        "cursor-pointer",
                        c.estado === "cancelada" && "opacity-55",
                      )}
                    >
                      <TableCell className="whitespace-nowrap">
                        <span className="capitalize">{fechaConDiaSemana(c.inicio_utc)}</span>
                        <span className="tnum ml-2 text-muted-foreground">{horaLima(c.inicio_utc)}</span>
                      </TableCell>
                      <TableCell>
                        <div>{c.clientes.nombre?.trim() || "Sin nombre"}</div>
                        {c.clientes.telefono ? (
                          <a
                            href={`https://wa.me/${c.clientes.telefono}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="tnum text-[11.5px] text-muted-foreground transition-colors hover:text-gold-deep dark:hover:text-gold"
                          >
                            {c.clientes.telefono}
                          </a>
                        ) : (
                          <span className="text-[11.5px] text-muted-foreground">Sin teléfono</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <span>{c.services.name}</span>
                        {c.notas ? (
                          <div className="mt-0.5 text-[11.5px] text-muted-foreground">{c.notas}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{nombreSede(c.sede_id)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {nombreProfesional(c.profesional_id)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.creada_por === "bot" ? "WhatsApp" : "Web / manual"}
                      </TableCell>
                      <TableCell>
                        <EstadoPill estado={c.estado} />
                      </TableCell>
                      {/* Cambiar estado no debe abrir la ficha: el clic muere acá. */}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="outline" size="sm">
                                Cambiar estado
                                <ChevronDown />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            {ESTADO_ORDER.map((estado) => (
                              <DropdownMenuItem
                                key={estado}
                                disabled={estado === c.estado}
                                onClick={() => updateStatus(c.id, estado)}
                              >
                                {CITA_ESTADO_LABEL[estado]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sin onGuardado que recargue: la suscripción en tiempo real sobre
          `citas` ya trae la nueva sola, y recargar la página entera perdería
          los filtros que el staff tuviera puestos. */}
      <WalkInDialog open={walkIn} onOpenChange={setWalkIn} onGuardado={() => {}} />

      <FichaClienteDialog
        clienteId={fichaCliente?.clienteId ?? null}
        citaDestacadaId={fichaCliente?.citaId ?? null}
        open={!!fichaCliente}
        onOpenChange={(abierto) => {
          if (!abierto) setFichaCliente(null)
        }}
      />
    </div>
  )
}
