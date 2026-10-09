import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { CalendarX2, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { actualizarEstadoCita, marcarCitaComoProfesional, BotApiError } from "@/lib/botApi"
import {
  DIAS_CORTOS,
  diaDelMes,
  fechaLegible,
  hoyLima,
  rangoUtc,
  semanaDe,
  sumarDias,
  type CitaApp,
} from "@/lib/agenda"
import { useEquipo } from "@/lib/equipo"
import { horaLima } from "@/lib/format"
import { cn } from "@/lib/utils"
import { CITA_ESTADO_LABEL, type CitaEstado } from "@/lib/types"
import { EVENTO_CITA_GUARDADA, type ModoApp } from "@/components/AppMovilShell"
import FichaClienteDialog from "@/pages/Reservas/FichaClienteDialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Los tokens de color quedaron nombrados por el enum viejo de `bookings`
// (pending/confirmed/cancelled/completed): se reutilizan por significado.
const COLOR_ESTADO: Record<CitaEstado, string> = {
  confirmada: "confirmed",
  completada: "completed",
  cancelada: "cancelled",
  no_asistio: "pending",
}

const REFRESCO_MS = 60_000

/** Fila cruda del join que trae recepción; lo demás lo pone useEquipo(). */
type FilaAdmin = {
  id: string
  inicio_utc: string
  fin_utc: string
  estado: CitaEstado
  notas: string | null
  sede_id: string | null
  profesional_id: string | null
  cliente_id: string
  clientes: { nombre: string | null; notas: string | null } | null
  services: { name: string; duration: string | null } | null
}

export default function Agenda({ modo }: { modo: ModoApp }) {
  const { sedes, profesionales, nombreSede, nombreProfesional } = useEquipo()

  const [fecha, setFecha] = useState(hoyLima)
  const [citas, setCitas] = useState<CitaApp[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [ocupadaId, setOcupadaId] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [fichaClienteId, setFichaClienteId] = useState<string | null>(null)

  // Filtros de recepción. La profesional no los tiene: ya ve solo lo suyo.
  const [filtroProf, setFiltroProf] = useState("all")
  const [filtroSede, setFiltroSede] = useState("all")

  const cargar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCargando(true)
      const { desde, hasta } = rangoUtc(fecha)

      if (modo === "profesional") {
        const { data, error: fallo } = await supabase.rpc("mi_agenda", { p_desde: desde, p_hasta: hasta })
        if (fallo) {
          setError(true)
        } else {
          setError(false)
          setCitas(((data ?? []) as Array<Omit<CitaApp, "profesional_id">>).map((c) => ({ ...c, profesional_id: null })))
        }
      } else {
        const { data, error: fallo } = await supabase
          .from("citas")
          .select(
            "id,inicio_utc,fin_utc,estado,notas,sede_id,profesional_id,cliente_id,clientes(nombre,notas),services(name,duration)",
          )
          .gte("inicio_utc", desde)
          .lt("inicio_utc", hasta)
          .order("inicio_utc")
        if (fallo) {
          setError(true)
        } else {
          setError(false)
          setCitas(
            ((data ?? []) as unknown as FilaAdmin[]).map((f) => ({
              id: f.id,
              inicio_utc: f.inicio_utc,
              fin_utc: f.fin_utc,
              estado: f.estado,
              notas: f.notas,
              sede_id: f.sede_id,
              profesional_id: f.profesional_id,
              cliente_id: f.cliente_id,
              cliente_nombre: f.clientes?.nombre ?? null,
              cliente_notas: f.clientes?.notas ?? null,
              servicio: f.services?.name ?? "Servicio",
              servicio_duracion: f.services?.duration ?? null,
            })),
          )
        }
      }
      setCargando(false)
    },
    [fecha, modo],
  )

  useEffect(() => {
    void cargar()
  }, [cargar])

  // Se mantiene al día sola: al volver a la app, al guardar una reserva desde
  // el botón central, y cada minuto mientras está a la vista. Sin esto, quien
  // deja la app abierta toda la mañana mira una agenda de hace horas.
  useEffect(() => {
    const refrescar = () => void cargar(true)
    const alVolver = () => {
      if (document.visibilityState === "visible") refrescar()
    }
    document.addEventListener("visibilitychange", alVolver)
    window.addEventListener(EVENTO_CITA_GUARDADA, refrescar)
    const id = setInterval(alVolver, REFRESCO_MS)
    return () => {
      document.removeEventListener("visibilitychange", alVolver)
      window.removeEventListener(EVENTO_CITA_GUARDADA, refrescar)
      clearInterval(id)
    }
  }, [cargar])

  async function cambiarEstado(id: string, estado: CitaEstado) {
    setOcupadaId(id)
    setCancelando(null)
    try {
      if (modo === "profesional") await marcarCitaComoProfesional(id, estado)
      else await actualizarEstadoCita(id, estado)
      setCitas((previas) => previas.map((c) => (c.id === id ? { ...c, estado } : c)))
      toast.success(`Cita marcada como ${CITA_ESTADO_LABEL[estado].toLowerCase()}.`)
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo actualizar la cita.")
    } finally {
      setOcupadaId(null)
    }
  }

  const visibles = useMemo(
    () =>
      citas.filter(
        (c) =>
          (filtroProf === "all" || c.profesional_id === filtroProf) &&
          (filtroSede === "all" || c.sede_id === filtroSede),
      ),
    [citas, filtroProf, filtroSede],
  )

  const resumen = useMemo(() => {
    const vigentes = visibles.filter((c) => c.estado !== "cancelada")
    return {
      total: vigentes.length,
      pendientes: vigentes.filter((c) => c.estado === "confirmada").length,
    }
  }, [visibles])

  const hoy = hoyLima()
  const semana = semanaDe(fecha)

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] tracking-[0.2em] text-gold-deep uppercase dark:text-gold">
            {fecha === hoy ? "Hoy" : "Agenda"}
          </p>
          <h1 className="aura-display text-[21px] leading-tight">{fechaLegible(fecha)}</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Actualizar"
          onClick={() => void cargar()}
          disabled={cargando}
        >
          <RefreshCw className={cn("size-4", cargando && "animate-spin")} />
        </Button>
      </div>

      {/* Tira de la semana: tocar un día lo abre; las flechas saltan de a semana. */}
      <div className="mb-4 flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Semana anterior" onClick={() => setFecha(sumarDias(fecha, -7))}>
          <ChevronLeft className="size-4" />
        </Button>
        <ul className="grid flex-1 grid-cols-7 gap-1">
          {semana.map((dia, i) => {
            const activo = dia === fecha
            return (
              <li key={dia}>
                <button
                  type="button"
                  onClick={() => setFecha(dia)}
                  aria-pressed={activo}
                  aria-label={fechaLegible(dia)}
                  className={cn(
                    "flex w-full flex-col items-center rounded-xl border py-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none",
                    activo
                      ? "border-gold bg-gold/15 text-gold-deep dark:text-gold"
                      : "border-transparent text-muted-foreground hover:border-border",
                  )}
                >
                  <span className="text-[10px] tracking-wide uppercase">{DIAS_CORTOS[i]}</span>
                  <span className={cn("tnum text-[15px]", dia === hoy && "font-semibold text-foreground")}>
                    {diaDelMes(dia)}
                  </span>
                  <span aria-hidden className={cn("mt-0.5 size-1 rounded-full", dia === hoy ? "bg-gold" : "bg-transparent")} />
                </button>
              </li>
            )
          })}
        </ul>
        <Button variant="ghost" size="icon" aria-label="Semana siguiente" onClick={() => setFecha(sumarDias(fecha, 7))}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {fecha !== hoy ? (
        <button
          type="button"
          onClick={() => setFecha(hoy)}
          className="mb-4 text-[12.5px] text-gold-deep underline-offset-4 hover:underline dark:text-gold"
        >
          Volver a hoy
        </button>
      ) : null}

      {modo !== "profesional" ? (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <Select value={filtroProf} onValueChange={(v) => setFiltroProf(v ?? "all")}>
            <SelectTrigger className="h-10 w-full rounded-xl">
              <SelectValue>
                {(v) => (v === "all" ? "Todo el equipo" : nombreProfesional(v as string))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el equipo</SelectItem>
              {profesionales
                .filter((p) => p.activa)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={filtroSede} onValueChange={(v) => setFiltroSede(v ?? "all")}>
            <SelectTrigger className="h-10 w-full rounded-xl">
              <SelectValue>{(v) => (v === "all" ? "Todos los locales" : nombreSede(v as string))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los locales</SelectItem>
              {sedes
                .filter((s) => s.activa)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nombre}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {!cargando && !error ? (
        <p className="mb-3 text-[12.5px] text-muted-foreground">
          {resumen.total === 0
            ? "Sin citas"
            : `${resumen.total} cita${resumen.total === 1 ? "" : "s"} · ${resumen.pendientes} por atender`}
        </p>
      ) : null}

      {cargando ? (
        <div className="flex flex-col gap-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[112px] rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-status-cancelled/30 bg-status-cancelled-bg/60 p-5 text-center">
          <p className="text-[13.5px] text-status-cancelled">No se pudo cargar la agenda.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void cargar()}>
            Reintentar
          </Button>
        </div>
      ) : visibles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <CalendarX2 className="size-7 text-muted-foreground/60" strokeWidth={1.5} />
          <p className="text-[13.5px] text-muted-foreground">
            {modo === "profesional" ? "No tienes citas este día." : "No hay reservas este día."}
          </p>
          {modo === "profesional" ? (
            <Link
              to="/app/registrar"
              className="text-[12.5px] text-gold-deep underline-offset-4 hover:underline dark:text-gold"
            >
              Registrar una atención sin reserva
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibles.map((c) => (
            <TarjetaCita
              key={c.id}
              cita={c}
              modo={modo}
              profesional={modo === "admin" ? nombreProfesional(c.profesional_id) : null}
              sede={c.sede_id && sedes.length > 1 ? nombreSede(c.sede_id) : null}
              ocupada={ocupadaId === c.id}
              confirmandoCancelar={cancelando === c.id}
              onEstado={(estado) => void cambiarEstado(c.id, estado)}
              onPedirCancelar={() => setCancelando(cancelando === c.id ? null : c.id)}
              onVerClienta={() => setFichaClienteId(c.cliente_id)}
            />
          ))}
        </ul>
      )}

      {modo === "admin" ? (
        <FichaClienteDialog
          clienteId={fichaClienteId}
          open={fichaClienteId !== null}
          onOpenChange={(abierto) => !abierto && setFichaClienteId(null)}
        />
      ) : null}
    </div>
  )
}

function TarjetaCita({
  cita,
  modo,
  profesional,
  sede,
  ocupada,
  confirmandoCancelar,
  onEstado,
  onPedirCancelar,
  onVerClienta,
}: {
  cita: CitaApp
  modo: ModoApp
  profesional: string | null
  sede: string | null
  ocupada: boolean
  confirmandoCancelar: boolean
  onEstado: (estado: CitaEstado) => void
  onPedirCancelar: () => void
  onVerClienta: () => void
}) {
  const token = COLOR_ESTADO[cita.estado]
  const cancelada = cita.estado === "cancelada"
  const nombre = cita.cliente_nombre?.trim() || "Clienta sin nombre"

  return (
    <li className={cn("rounded-2xl border border-border bg-card p-4", cancelada && "opacity-60")}>
      <div className="flex items-start gap-3">
        <div className="w-14 shrink-0 text-center">
          <p className="tnum font-heading text-[18px] leading-none">{horaLima(cita.inicio_utc)}</p>
          <p className="tnum mt-1 text-[11px] text-muted-foreground">{horaLima(cita.fin_utc)}</p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {modo === "admin" ? (
              <button
                type="button"
                onClick={onVerClienta}
                className="line-clamp-2 text-left text-[14.5px] font-medium break-words underline-offset-4 hover:underline"
              >
                {nombre}
              </button>
            ) : (
              <p className="line-clamp-2 text-[14.5px] font-medium break-words">{nombre}</p>
            )}
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[10px] tracking-[0.08em] whitespace-nowrap uppercase"
              style={{ color: `var(--status-${token})`, backgroundColor: `var(--status-${token}-bg)` }}
            >
              {CITA_ESTADO_LABEL[cita.estado]}
            </span>
          </div>

          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {cita.servicio}
            {cita.servicio_duracion ? ` · ${cita.servicio_duracion}` : ""}
          </p>
          {profesional || sede ? (
            <p className="mt-0.5 text-[12px] text-muted-foreground/80">
              {[profesional, sede].filter(Boolean).join(" · ")}
            </p>
          ) : null}

          {cita.notas ? (
            <p className="mt-2 rounded-lg bg-gold/10 px-2.5 py-1.5 text-[12.5px] leading-snug">{cita.notas}</p>
          ) : null}

          {/* Lo que necesita en la silla: una alergia, un tono que no le gusta.
              Va plegado para que la agenda siga siendo una lista y no un muro de texto. */}
          {modo === "profesional" && cita.cliente_notas?.trim() ? (
            <details className="mt-2 text-[12.5px]">
              <summary className="cursor-pointer text-gold-deep dark:text-gold">Notas de la clienta</summary>
              <p className="mt-1.5 leading-snug whitespace-pre-line text-muted-foreground">{cita.cliente_notas}</p>
            </details>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {cita.estado === "confirmada" ? (
          <>
            {/* Registrar lo que pasó en el salón (atendida / no vino) es de la
                profesional o la administradora; un vendedor solo agenda y cancela. */}
            {modo !== "vendedor" ? (
              <>
                <Button variant="gold" size="sm" className="flex-1" disabled={ocupada} onClick={() => onEstado("completada")}>
                  Atendida
                </Button>
                <Button variant="outline" size="sm" className="flex-1" disabled={ocupada} onClick={() => onEstado("no_asistio")}>
                  No vino
                </Button>
              </>
            ) : null}
            {confirmandoCancelar ? (
              <Button variant="destructive" size="sm" disabled={ocupada} onClick={() => onEstado("cancelada")}>
                Sí, cancelar
              </Button>
            ) : (
              <Button variant="ghost" size="sm" disabled={ocupada} onClick={onPedirCancelar}>
                Cancelar
              </Button>
            )}
          </>
        ) : modo === "vendedor" && cita.estado !== "cancelada" ? (
          <p className="text-[12px] text-muted-foreground">Ya quedó registrada por quien atendió.</p>
        ) : cita.estado === "cancelada" && modo === "profesional" ? (
          // Una cita cancelada la pudo cancelar la clienta: reabrirla es cosa de
          // recepción, que puede avisarle y revisar que el horario siga libre.
          <p className="text-[12px] text-muted-foreground">Para reabrirla, avisa a recepción.</p>
        ) : (
          <Button variant="outline" size="sm" disabled={ocupada} onClick={() => onEstado("confirmada")}>
            Volver a confirmada
          </Button>
        )}
      </div>
    </li>
  )
}
