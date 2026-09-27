import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase"
import { registrarAtencionProfesional, BotApiError } from "@/lib/botApi"
import { useAuth } from "@/lib/auth"
import { useEquipo } from "@/lib/equipo"
import { ahoraLimaLocal, aIsoLima, duracionMinutos } from "@/lib/agenda"
import { cn } from "@/lib/utils"
import type { Service, ServiceCategory } from "@/lib/types"
import { CategoryIcon } from "@/lib/categoryIcons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"

type ClientaBreve = { id: string; nombre: string | null }

/**
 * Anotar una atención que no tuvo reserva (llegó sin cita). Solo ofrece los
 * servicios que ella hace y los locales donde atiende; el bot lo vuelve a
 * exigir, así que esto es comodidad y no la barrera de seguridad.
 */
export default function Registrar() {
  const { profesionalId } = useAuth()
  const { sedes } = useEquipo()
  const navigate = useNavigate()

  const [servicios, setServicios] = useState<Service[]>([])
  const [categorias, setCategorias] = useState<ServiceCategory[]>([])
  const [misSedes, setMisSedes] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [intento, setIntento] = useState(0)

  const [busqueda, setBusqueda] = useState("")
  const [resultados, setResultados] = useState<ClientaBreve[]>([])
  const [clienta, setClienta] = useState<ClientaBreve | null>(null)
  const [nombre, setNombre] = useState("")
  const [telefono, setTelefono] = useState("")

  const [sedeId, setSedeId] = useState("")
  const [inicio, setInicio] = useState(ahoraLimaLocal)
  const [servicioIds, setServicioIds] = useState<string[]>([])
  const [filtroCategoria, setFiltroCategoria] = useState("todos")
  const [estado, setEstado] = useState<"completada" | "confirmada">("completada")
  const [comentario, setComentario] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!profesionalId) return
    let activo = true
    setCargando(true)
    Promise.all([
      supabase.from("profesional_servicios").select("servicio_id").eq("profesional_id", profesionalId),
      supabase.from("profesional_sedes").select("sede_id").eq("profesional_id", profesionalId),
      supabase.from("services").select("*").eq("active", true).order("sort_order"),
      supabase.from("service_categories").select("*").eq("active", true).order("sort_order"),
    ]).then(([suyos, sus, svc, cats]) => {
      if (!activo) return
      if (suyos.error || sus.error || svc.error || cats.error) {
        setErrorCarga(true)
        setCargando(false)
        return
      }
      const idsSuyos = new Set((suyos.data ?? []).map((r) => r.servicio_id as string))
      setServicios(((svc.data ?? []) as Service[]).filter((s) => idsSuyos.has(s.id)))
      setCategorias((cats.data ?? []) as ServiceCategory[])
      setMisSedes((sus.data ?? []).map((r) => r.sede_id as string))
      setErrorCarga(false)
      setCargando(false)
    })
    return () => {
      activo = false
    }
  }, [profesionalId, intento])

  const sedesElegibles = useMemo(
    () => sedes.filter((s) => s.activa && misSedes.includes(s.id)),
    [sedes, misSedes],
  )

  // Si atiende en un solo local no hay nada que elegir: queda puesto.
  useEffect(() => {
    if (!sedeId && sedesElegibles.length > 0) setSedeId(sedesElegibles[0].id)
  }, [sedesElegibles, sedeId])

  useEffect(() => {
    const termino = busqueda.trim()
    if (termino.length < 2 || clienta) {
      setResultados([])
      return
    }
    let activo = true
    const id = setTimeout(async () => {
      const { data } = await supabase.rpc("mis_clientas", { p_buscar: termino })
      if (!activo) return
      setResultados(((data ?? []) as ClientaBreve[]).slice(0, 6))
    }, 300)
    return () => {
      activo = false
      clearTimeout(id)
    }
  }, [busqueda, clienta])

  const categoriasConServicios = useMemo(
    () => categorias.filter((c) => servicios.some((s) => s.category_id === c.id)),
    [categorias, servicios],
  )

  const serviciosVisibles = useMemo(
    () => (filtroCategoria === "todos" ? servicios : servicios.filter((s) => s.category_id === filtroCategoria)),
    [servicios, filtroCategoria],
  )

  const elegidosPorCategoria = useMemo(() => {
    const cuenta = new Map<string, number>()
    for (const id of servicioIds) {
      const cat = servicios.find((x) => x.id === id)?.category_id
      if (cat) cuenta.set(cat, (cuenta.get(cat) ?? 0) + 1)
    }
    return cuenta
  }, [servicioIds, servicios])

  const duracionTotal = useMemo(
    () =>
      servicioIds.reduce((suma, id) => {
        const s = servicios.find((x) => x.id === id)
        return suma + duracionMinutos(s?.duration)
      }, 0),
    [servicioIds, servicios],
  )

  const valido =
    (!!clienta || (nombre.trim().length > 1 && telefono.replace(/\D/g, "").length >= 6)) &&
    servicioIds.length > 0 &&
    !!sedeId &&
    !!inicio

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!valido) return
    setGuardando(true)
    try {
      await registrarAtencionProfesional({
        ...(clienta ? { cliente_id: clienta.id } : { telefono: telefono.trim(), nombre: nombre.trim() }),
        servicio_ids: servicioIds,
        sede_id: sedeId,
        inicio: aIsoLima(inicio),
        estado,
        ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
      })
      toast.success("Atención registrada.")
      navigate("/app")
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo registrar la atención.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-5">
      <p className="text-[10.5px] tracking-[0.2em] text-gold-deep uppercase dark:text-gold">Sin reserva</p>
      <h1 className="aura-display mb-5 text-[24px] leading-tight">Registrar una atención</h1>

      {cargando ? (
        <div className="flex flex-col gap-3" aria-busy>
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : errorCarga ? (
        <div className="rounded-2xl border border-status-cancelled/30 bg-status-cancelled-bg/60 p-5 text-center">
          <p className="text-[13.5px] text-status-cancelled">No se pudo cargar el formulario.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </Button>
        </div>
      ) : sedesElegibles.length === 0 || servicios.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-[13.5px] text-muted-foreground">
          Todavía no tienes servicios o locales asignados. Pídele a recepción que los configure.
        </p>
      ) : (
        <form onSubmit={guardar} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label>Clienta</Label>
            {clienta ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-gold bg-gold/10 px-3 py-2.5">
                <span className="text-[14px]">{clienta.nombre?.trim() || "Sin nombre"}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setClienta(null)}>
                  Cambiar
                </Button>
              </div>
            ) : (
              <>
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar entre mis clientas…"
                  className="h-11 rounded-xl"
                />
                {resultados.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {resultados.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setClienta(c)
                          setBusqueda("")
                        }}
                        className="rounded-xl border border-border px-3 py-2.5 text-left text-[13.5px] transition-colors hover:border-gold"
                      >
                        {c.nombre?.trim() || "Sin nombre"}
                      </button>
                    ))}
                  </div>
                ) : null}
                <p className="text-[12px] text-muted-foreground">¿Es nueva? Completa sus datos y se crea sola.</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Nombre"
                    autoComplete="off"
                    className="h-11 rounded-xl"
                  />
                  <Input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    inputMode="tel"
                    placeholder="Celular"
                    autoComplete="off"
                    className="h-11 rounded-xl"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Servicios</Label>
            <div role="tablist" aria-label="Categoría de servicio" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {[{ id: "todos", title: "Todos", icon: "" }, ...categoriasConServicios].map((c) => {
                const activo = filtroCategoria === c.id
                const n = c.id === "todos" ? servicioIds.length : (elegidosPorCategoria.get(c.id) ?? 0)
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={activo}
                    onClick={() => setFiltroCategoria(c.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                      activo
                        ? "border-gold bg-gold/15 text-gold-deep dark:text-gold"
                        : "border-border text-muted-foreground hover:border-gold/50",
                    )}
                  >
                    {c.id !== "todos" ? <CategoryIcon name={c.icon} className="size-3.5" /> : null}
                    {c.title}
                    {n > 0 ? (
                      <span className="tnum rounded-full bg-gold px-1.5 text-[10.5px] leading-4 font-medium text-[#33200f]">
                        {n}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
            <div role="tabpanel" className="max-h-64 overflow-y-auto rounded-xl border border-border p-1.5">
              {serviciosVisibles.map((s) => (
                <label key={s.id} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-[13.5px] active:bg-gold/10">
                  <input
                    type="checkbox"
                    checked={servicioIds.includes(s.id)}
                    onChange={() =>
                      setServicioIds((previos) =>
                        previos.includes(s.id) ? previos.filter((x) => x !== s.id) : [...previos, s.id],
                      )
                    }
                    className="size-4 accent-gold"
                  />
                  <span className="flex-1">{s.name}</span>
                  <span className="text-[12px] text-muted-foreground">{s.duration}</span>
                </label>
              ))}
            </div>
            {servicioIds.length > 0 ? (
              <p className="text-[12px] text-muted-foreground">
                {servicioIds.length} servicio{servicioIds.length === 1 ? "" : "s"} · {duracionTotal} min
              </p>
            ) : null}
          </div>

          {sedesElegibles.length > 1 ? (
            <div className="flex flex-col gap-2">
              <Label>Local</Label>
              <div className="flex flex-wrap gap-2">
                {sedesElegibles.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSedeId(s.id)}
                    aria-pressed={sedeId === s.id}
                    className={cn(
                      "rounded-full border px-4 py-2 text-[13px] transition-colors",
                      sedeId === s.id
                        ? "border-gold bg-gold/15 text-gold-deep dark:text-gold"
                        : "border-border text-muted-foreground hover:border-gold/50",
                    )}
                  >
                    {s.nombre}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="registrar-inicio">Cuándo</Label>
            <Input
              id="registrar-inicio"
              type="datetime-local"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="h-11 rounded-xl"
            />
            <p className="text-[12px] text-muted-foreground">Puedes anotar atenciones de hasta 2 días atrás.</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Estado</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["completada", "Ya la atendí"],
                  ["confirmada", "Está por atenderse"],
                ] as const
              ).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setEstado(valor)}
                  aria-pressed={estado === valor}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-[13px] transition-colors",
                    estado === valor
                      ? "border-gold bg-gold/15 text-gold-deep dark:text-gold"
                      : "border-border text-muted-foreground hover:border-gold/50",
                  )}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="registrar-comentario">Comentario (opcional)</Label>
            <Textarea
              id="registrar-comentario"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Algo que quieras recordar de esta atención"
              className="rounded-xl"
            />
          </div>

          <Button type="submit" variant="gold" size="lg" className="h-12 w-full" disabled={!valido || guardando}>
            {guardando ? "Guardando…" : "Registrar atención"}
          </Button>
        </form>
      )}
    </div>
  )
}
