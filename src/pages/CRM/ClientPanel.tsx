import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Bell, History, ImageIcon, Link2, Plus, Search, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useServiceNames } from "@/lib/services"
import { guardarTelefonoCliente, BotApiError } from "@/lib/botApi"
import { CanalIcon, CANAL_LABEL } from "@/lib/canales"
import {
  CITA_ESTADO_LABEL,
  COMPROBANTE_ESTADO_LABEL,
  ETAPA_LABEL,
  ETAPAS,
  ETIQUETA_CLASSES,
  MOTIVO_CIERRE_LABEL,
  MOTIVOS_CIERRE,
  type Cita,
  type ClienteIdentidad,
  type ConversacionResumen,
  type Etapa,
  type EventoConversacion,
  type Etiqueta,
  type MotivoCierre,
  type Notificacion,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { colorPorNombre } from "./utils"

function formatearCita(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const EVENTO_TEXTO: Record<EventoConversacion["tipo"], (detalle: Record<string, unknown>) => string> = {
  asignacion: (d) => (d.a ? "Se asignó la conversación" : "Se quitó la asignación"),
  etapa: (d) => `Etapa: ${ETAPA_LABEL[d.de as Etapa] ?? d.de ?? "—"} → ${ETAPA_LABEL[d.a as Etapa] ?? d.a ?? "—"}`,
  estado: (d) => `Estado: ${d.de ?? "—"} → ${d.a ?? "—"}`,
  cierre: (d) => `Cerrada${d.motivo ? ` · ${MOTIVO_CIERRE_LABEL[d.motivo as MotivoCierre] ?? d.motivo}` : ""}`,
  fusion: () => "Se fusionó con otra clienta",
  respuesta_privada: () => "Respuesta privada enviada",
  escalada: (d) => `Escalada a un humano${d.motivo ? ` · ${d.motivo}` : ""}`,
}

/** Buscador de una clienta existente, para "Vincular con otra clienta". */
function BuscadorClienta({
  excluirId,
  onElegir,
}: {
  excluirId: string
  onElegir: (cliente: { id: string; nombre: string | null; telefono: string | null }) => void
}) {
  const [termino, setTermino] = useState("")
  const [resultados, setResultados] = useState<{ id: string; nombre: string | null; telefono: string | null }[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    const q = termino.trim()
    if (q.length < 2) {
      setResultados([])
      return
    }
    let activo = true
    setBuscando(true)
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nombre, telefono")
        .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`)
        .neq("id", excluirId)
        .limit(8)
      if (!activo) return
      setResultados((data as { id: string; nombre: string | null; telefono: string | null }[]) ?? [])
      setBuscando(false)
    }, 300)
    return () => {
      activo = false
      clearTimeout(timeout)
    }
  }, [termino, excluirId])

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
          placeholder="Buscar por nombre o teléfono…"
          className="h-9 pl-8 text-sm"
          autoFocus
        />
      </div>
      <div className="mt-2 max-h-56 overflow-y-auto">
        {buscando && <p className="py-3 text-center text-xs text-muted-foreground">Buscando…</p>}
        {!buscando && termino.trim().length >= 2 && resultados.length === 0 && (
          <p className="py-3 text-center text-xs text-muted-foreground">Sin resultados.</p>
        )}
        {resultados.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onElegir(c)}
            className="flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent"
          >
            <span className="font-medium">{c.nombre?.trim() || "Sin nombre"}</span>
            {c.telefono && <span className="text-xs text-muted-foreground">{c.telefono}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ClientPanel({
  conversacion,
  etiquetas,
  etiquetasCliente,
}: {
  conversacion: ConversacionResumen | null
  etiquetas: Etiqueta[]
  etiquetasCliente: Etiqueta[]
}) {
  const { serviceName } = useServiceNames()
  const [citas, setCitas] = useState<Cita[]>([])
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [identidades, setIdentidades] = useState<ClienteIdentidad[]>([])
  const [eventos, setEventos] = useState<EventoConversacion[]>([])
  const [notas, setNotas] = useState("")
  const [email, setEmail] = useState<string | null>(null)
  const [guardandoNotas, setGuardandoNotas] = useState(false)
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("")
  const [telefonoNuevo, setTelefonoNuevo] = useState("")
  const [guardandoTelefono, setGuardandoTelefono] = useState(false)
  const [conflictoTelefono, setConflictoTelefono] = useState<{ id: string; nombre: string | null } | null>(null)
  const [vincularAbierto, setVincularAbierto] = useState(false)
  const [candidataFusion, setCandidataFusion] = useState<{ id: string; nombre: string | null; telefono: string | null } | null>(null)
  const [fusionando, setFusionando] = useState(false)
  const [guardandoEtapa, setGuardandoEtapa] = useState(false)

  const clienteId = conversacion?.cliente_id ?? null
  const conversacionId = conversacion?.id ?? null

  useEffect(() => {
    setTelefonoNuevo("")
    setConflictoTelefono(null)
    if (!clienteId) {
      setCitas([])
      setNotificaciones([])
      setIdentidades([])
      setNotas("")
      setEmail(null)
      return
    }
    let activo = true

    async function cargar() {
      const [citasRes, cliente, notifRes, identidadesRes] = await Promise.all([
        supabase.from("citas").select("*").eq("cliente_id", clienteId).order("inicio_utc", { ascending: false }).limit(10),
        supabase.from("clientes").select("notas, email").eq("id", clienteId).maybeSingle(),
        supabase
          .from("notificaciones")
          .select("*")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("cliente_identidades").select("*").eq("cliente_id", clienteId).order("created_at"),
      ])
      if (!activo) return
      if (citasRes.data) setCitas(citasRes.data as Cita[])
      if (notifRes.data) setNotificaciones(notifRes.data as Notificacion[])
      if (identidadesRes.data) setIdentidades(identidadesRes.data as ClienteIdentidad[])
      setNotas((cliente.data?.notas as string | null) ?? "")
      setEmail((cliente.data?.email as string | null) ?? null)
    }
    cargar()

    // El bot escribe el resultado del análisis del comprobante justo
    // después de guardar la imagen — sin esto, el panel se queda con el
    // estado "sin_comprobante" hasta que alguien lo recargue a mano.
    const canal = supabase
      .channel(`crm-citas-${clienteId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "citas", filter: `cliente_id=eq.${clienteId}` },
        (payload) => {
          const actualizada = payload.new as Cita
          setCitas((previas) => previas.map((c) => (c.id === actualizada.id ? actualizada : c)))
        },
      )
      .subscribe()

    return () => {
      activo = false
      supabase.removeChannel(canal)
    }
  }, [clienteId])

  useEffect(() => {
    if (!conversacionId) {
      setEventos([])
      return
    }
    let activo = true

    supabase
      .from("eventos_conversacion")
      .select("*")
      .eq("conversacion_id", conversacionId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (activo) setEventos((data as EventoConversacion[]) ?? [])
      })

    const canal = supabase
      .channel(`crm-eventos-${conversacionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "eventos_conversacion", filter: `conversacion_id=eq.${conversacionId}` },
        (payload) => setEventos((previos) => [payload.new as EventoConversacion, ...previos]),
      )
      .subscribe()

    return () => {
      activo = false
      supabase.removeChannel(canal)
    }
  }, [conversacionId])

  async function verComprobante(path: string) {
    const { data, error } = await supabase.storage.from("comprobantes").createSignedUrl(path, 60)
    if (error || !data) {
      toast.error("No se pudo abrir el comprobante.")
      return
    }
    window.open(data.signedUrl, "_blank", "noreferrer")
  }

  async function guardarNotas() {
    if (!clienteId) return
    setGuardandoNotas(true)
    const { error } = await supabase.from("clientes").update({ notas: notas.trim() || null }).eq("id", clienteId)
    setGuardandoNotas(false)
    if (error) toast.error("No se pudieron guardar las notas.")
    else toast.success("Notas guardadas.")
  }

  async function cambiarEtapa(etapa: Etapa) {
    if (!conversacionId) return
    setGuardandoEtapa(true)
    const patch: { etapa: Etapa; motivo_cierre?: MotivoCierre } = { etapa }
    if (etapa === "cerrado" && !conversacion?.motivo_cierre) patch.motivo_cierre = "otro"
    const { error } = await supabase.from("conversaciones").update(patch).eq("id", conversacionId)
    setGuardandoEtapa(false)
    if (error) toast.error("No se pudo cambiar la etapa.")
  }

  async function cambiarMotivoCierre(motivo: MotivoCierre) {
    if (!conversacionId) return
    const { error } = await supabase.from("conversaciones").update({ motivo_cierre: motivo }).eq("id", conversacionId)
    if (error) toast.error("No se pudo cambiar el motivo.")
  }

  async function guardarTelefono(fusionar?: boolean) {
    if (!clienteId || !telefonoNuevo.trim()) return
    setGuardandoTelefono(true)
    try {
      await guardarTelefonoCliente(clienteId, telefonoNuevo.trim(), fusionar)
      toast.success(fusionar ? "Clientas fusionadas." : "Teléfono guardado.")
      setTelefonoNuevo("")
      setConflictoTelefono(null)
    } catch (err) {
      if (err instanceof BotApiError && err.code === "telefono_en_uso") {
        const existente = err.detalle.clienteExistente as { id: string; nombre: string | null } | undefined
        if (existente) {
          setConflictoTelefono(existente)
          return
        }
      }
      toast.error(err instanceof BotApiError ? err.message : "No se pudo guardar el teléfono.")
    } finally {
      setGuardandoTelefono(false)
    }
  }

  async function confirmarFusionDirecta() {
    if (!clienteId || !candidataFusion) return
    setFusionando(true)
    // fusionar_clientes acepta llamadas directas de un usuario staff (la
    // propia función valida is_staff() cuando hay sesión) — no hace falta
    // pasar por el bot para este camino, a diferencia del campo teléfono.
    const { error } = await supabase.rpc("fusionar_clientes", { p_origen: clienteId, p_destino: candidataFusion.id })
    setFusionando(false)
    if (error) {
      toast.error("No se pudo fusionar. " + error.message)
      return
    }
    toast.success(`Fusionada con ${candidataFusion.nombre?.trim() || "la otra clienta"}.`)
    setCandidataFusion(null)
    setVincularAbierto(false)
  }

  /** Reutiliza la etiqueta si ya existe (por nombre) y si no, la crea. */
  async function agregarEtiqueta(nombreCrudo: string) {
    if (!clienteId) return
    const nombre = nombreCrudo.trim()
    if (!nombre) return

    let etiqueta = etiquetas.find((e) => e.nombre.toLowerCase() === nombre.toLowerCase())

    if (!etiqueta) {
      const { data, error } = await supabase
        .from("etiquetas")
        .insert({ nombre, color: colorPorNombre(nombre) })
        .select("*")
        .single()
      if (error) {
        toast.error("No se pudo crear la etiqueta.")
        return
      }
      etiqueta = data as Etiqueta
    }

    const { error } = await supabase
      .from("cliente_etiquetas")
      .insert({ cliente_id: clienteId, etiqueta_id: etiqueta.id })
    // 23505 = ya la tenía asignada; no es un error que valga la pena mostrar.
    if (error && error.code !== "23505") {
      toast.error("No se pudo asignar la etiqueta.")
      return
    }
    setNuevaEtiqueta("")
  }

  async function quitarEtiqueta(etiquetaId: string) {
    if (!clienteId) return
    const { error } = await supabase
      .from("cliente_etiquetas")
      .delete()
      .eq("cliente_id", clienteId)
      .eq("etiqueta_id", etiquetaId)
    if (error) toast.error("No se pudo quitar la etiqueta.")
  }

  if (!conversacion) return null

  const disponibles = etiquetas.filter((e) => !etiquetasCliente.some((asignada) => asignada.id === e.id))

  return (
    <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-border xl:flex">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold">{conversacion.cliente_nombre?.trim() || "Sin nombre"}</h3>
        {email && <div className="mt-0.5 truncate text-xs text-muted-foreground">{email}</div>}

        {/* Identidades por canal — de dónde escribe esta clienta, con o sin teléfono. */}
        <div className="mt-2 flex flex-col gap-1">
          {identidades.map((id) => (
            <div key={id.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CanalIcon canal={id.canal} />
              <span>
                {id.canal === "instagram" && id.username
                  ? `@${id.username}`
                  : id.nombre_perfil || (id.tipo === "wa_id" ? id.external_id : "Sin nombre")}
              </span>
              <span className="text-[10px] text-muted-foreground/70">
                desde {new Date(id.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
              </span>
            </div>
          ))}
        </div>

        {/* Teléfono: enlace a WhatsApp si ya lo tiene, campo para cargarlo si no. */}
        <div className="mt-2">
          {conversacion.cliente_telefono ? (
            <a
              href={`https://wa.me/${conversacion.cliente_telefono.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-primary"
            >
              {conversacion.cliente_telefono}
            </a>
          ) : (
            <div className="flex gap-1.5">
              <Input
                value={telefonoNuevo}
                onChange={(e) => setTelefonoNuevo(e.target.value)}
                placeholder="Número de WhatsApp…"
                className="h-8 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void guardarTelefono()
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 px-2 text-xs"
                onClick={() => guardarTelefono()}
                disabled={guardandoTelefono || !telefonoNuevo.trim()}
              >
                Guardar
              </Button>
            </div>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-2 h-7 w-full justify-start gap-1.5 px-1.5 text-xs text-muted-foreground"
          onClick={() => setVincularAbierto(true)}
        >
          <Link2 className="size-3.5" />
          Vincular con otra clienta
        </Button>
      </div>

      <section className="border-b border-border px-5 py-4">
        <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Seguimiento</h4>
        <div className="flex flex-col gap-2">
          <Select value={conversacion.etapa} onValueChange={(v) => cambiarEtapa(v as Etapa)} disabled={guardandoEtapa}>
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ETAPAS.map((e) => (
                <SelectItem key={e} value={e} className="text-xs">
                  {ETAPA_LABEL[e]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {conversacion.etapa === "cerrado" && (
            <Select value={conversacion.motivo_cierre ?? "otro"} onValueChange={(v) => cambiarMotivoCierre(v as MotivoCierre)}>
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder="Motivo del cierre" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_CIERRE.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {MOTIVO_CIERRE_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </section>

      <section className="border-b border-border px-5 py-4">
        <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Etiquetas</h4>

        <div className="flex flex-wrap gap-1.5">
          {etiquetasCliente.length === 0 && <p className="text-xs text-muted-foreground">Sin etiquetas todavía.</p>}
          {etiquetasCliente.map((e) => (
            <span
              key={e.id}
              className={cn("flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium", ETIQUETA_CLASSES[e.color])}
            >
              {e.nombre}
              <button
                type="button"
                onClick={() => quitarEtiqueta(e.id)}
                className="opacity-60 hover:opacity-100"
                aria-label={`Quitar etiqueta ${e.nombre}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="mt-3 flex gap-1.5">
          <Input
            value={nuevaEtiqueta}
            onChange={(e) => setNuevaEtiqueta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void agregarEtiqueta(nuevaEtiqueta)
              }
            }}
            placeholder="Nueva etiqueta…"
            className="h-8 text-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={() => agregarEtiqueta(nuevaEtiqueta)}
            disabled={!nuevaEtiqueta.trim()}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>

        {disponibles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {disponibles.slice(0, 8).map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => agregarEtiqueta(e.nombre)}
                className="rounded border border-dashed border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-solid hover:text-foreground"
              >
                + {e.nombre}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="border-b border-border px-5 py-4">
        <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Notas internas</h4>
        <Textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          placeholder="Preferencias, alergias, historial…"
          className="resize-none text-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          onClick={guardarNotas}
          disabled={guardandoNotas}
        >
          Guardar notas
        </Button>
      </section>

      <section className="border-b border-border px-5 py-4">
        <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Citas</h4>
        {citas.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin citas registradas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {citas.map((c) => (
              <li key={c.id} className="text-xs">
                <div className="font-medium">{serviceName(c.servicio_id)}</div>
                <div className="text-muted-foreground">
                  {formatearCita(c.inicio_utc)} · {CITA_ESTADO_LABEL[c.estado]}
                </div>
                {c.comprobante_estado !== "sin_comprobante" && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium",
                        c.comprobante_estado === "confirmado"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
                      )}
                    >
                      {COMPROBANTE_ESTADO_LABEL[c.comprobante_estado]}
                      {c.comprobante_monto_detectado != null && ` · S/ ${c.comprobante_monto_detectado}`}
                    </span>
                    {c.comprobante_path && (
                      <button
                        type="button"
                        onClick={() => verComprobante(c.comprobante_path!)}
                        className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary"
                      >
                        <ImageIcon className="size-3" />
                        Ver
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {notificaciones.length > 0 && (
        <section className="border-b border-border px-5 py-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Bell className="size-3" />
            Notificaciones
          </h4>
          <ul className="flex flex-col gap-2">
            {notificaciones.map((n) => (
              <li key={n.id} className="text-xs">
                <div className="font-medium">
                  {n.tipo === "recordatorio_cita" ? "Recordatorio de cita" : "Promoción"}
                </div>
                <div className={cn("text-muted-foreground", n.estado === "fallida" && "text-destructive")}>
                  {n.estado === "enviada" && n.enviada_at
                    ? `Enviada ${formatearCita(n.enviada_at)}`
                    : n.estado === "fallida"
                      ? `Falló: ${n.error ?? "error desconocido"}`
                      : "Pendiente"}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {eventos.length > 0 && (
        <section className="px-5 py-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <History className="size-3" />
            Actividad
          </h4>
          <ul className="flex flex-col gap-2">
            {eventos.map((ev) => (
              <li key={ev.id} className="text-xs text-muted-foreground">
                <span className="text-foreground">{EVENTO_TEXTO[ev.tipo]?.(ev.detalle) ?? ev.tipo}</span>
                <span className="ml-1.5 text-[10px]">
                  {new Date(ev.created_at).toLocaleString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Fusión detectada al intentar guardar un teléfono que ya es de otra clienta. */}
      <Dialog open={Boolean(conflictoTelefono)} onOpenChange={(open) => !open && setConflictoTelefono(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ese número ya es de otra clienta</DialogTitle>
            <DialogDescription>
              <strong>{conflictoTelefono?.nombre?.trim() || "Sin nombre"}</strong> ya tiene registrado este teléfono. ¿Fusionar
              esta conversación con esa clienta? Se moverá todo el historial (conversaciones, citas, etiquetas) y no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConflictoTelefono(null)}>
              Cancelar
            </Button>
            <Button onClick={() => guardarTelefono(true)} disabled={guardandoTelefono}>
              Fusionar con {conflictoTelefono?.nombre?.trim() || "esta clienta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vincular con otra clienta a mano, sin pasar por el teléfono. */}
      <Dialog
        open={vincularAbierto}
        onOpenChange={(open) => {
          setVincularAbierto(open)
          if (!open) setCandidataFusion(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular con otra clienta</DialogTitle>
            <DialogDescription>
              Busca a la clienta con la que quieres fusionar esta ficha. Útil cuando reconoces que un lead de{" "}
              {CANAL_LABEL[conversacion.canal]} y una clienta que ya conoces son la misma persona.
            </DialogDescription>
          </DialogHeader>

          {candidataFusion ? (
            <>
              <p className="text-sm">
                ¿Fusionar con <strong>{candidataFusion.nombre?.trim() || "Sin nombre"}</strong>
                {candidataFusion.telefono ? ` (${candidataFusion.telefono})` : ""}? Se moverá todo el historial y no se puede
                deshacer.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCandidataFusion(null)}>
                  Volver
                </Button>
                <Button onClick={confirmarFusionDirecta} disabled={fusionando}>
                  Fusionar
                </Button>
              </DialogFooter>
            </>
          ) : (
            <BuscadorClienta excluirId={clienteId!} onElegir={setCandidataFusion} />
          )}
        </DialogContent>
      </Dialog>
    </aside>
  )
}
