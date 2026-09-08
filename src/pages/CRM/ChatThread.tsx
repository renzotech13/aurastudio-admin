import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { toast } from "sonner"
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ExternalLink,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
  StickyNote,
  UserRound,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { useEquipo } from "@/lib/equipo"
import { CanalIcon, CANAL_LABEL, describirIdentidad } from "@/lib/canales"
import {
  enviarMensajeHumano,
  enviarPlantillaMensaje,
  responderComentario,
  sugerirRespuesta,
  marcarVisto,
  estadoCanales,
  BotApiError,
} from "@/lib/botApi"
import {
  ETAPA_LABEL,
  ETAPAS,
  type Cita,
  type ConversacionResumen,
  type Etapa,
  type Mensaje,
  type PlantillaMedia,
  type Profile,
  type RespuestaRapida,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Segmented } from "@/components/Segmented"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useUrlFirmada } from "@/lib/media"
import { horasRestantesVentana, puedeRespuestaPrivada, ventanaAbierta, ventanaMeta } from "./utils"

function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
}

function MediaEnBurbuja({ mensaje }: { mensaje: Mensaje }) {
  // media_url: biblioteca pública (plantillas-media). media_path: adjunto
  // entrante privado (bucket `adjuntos`) — se resuelve con URL firmada.
  const urlFirmada = useUrlFirmada("adjuntos", mensaje.media_path)
  const url = mensaje.media_url ?? urlFirmada
  if (!url) return mensaje.media_path ? <p className="mb-1.5 text-xs italic opacity-70">Cargando adjunto…</p> : null

  if (mensaje.media_type === "image") {
    return <img src={url} alt="" className="mb-1.5 max-h-64 rounded-md object-cover" />
  }
  if (mensaje.media_type === "video") {
    return <video src={url} controls className="mb-1.5 max-h-64 rounded-md" />
  }
  if (mensaje.media_type === "audio") {
    return <audio src={url} controls className="mb-1.5 w-full max-w-64" />
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mb-1.5 block text-xs underline underline-offset-2">
      Ver archivo
    </a>
  )
}

function Burbuja({
  mensaje,
  staffPorId,
  onResponderComentario,
}: {
  mensaje: Mensaje
  staffPorId: Map<string, Profile>
  onResponderComentario: (mensaje: Mensaje, modo: "publico" | "privado") => void
}) {
  if (mensaje.tipo === "sistema") {
    return <p className="py-1 text-center text-[11px] text-muted-foreground">{mensaje.contenido}</p>
  }

  if (mensaje.tipo === "nota") {
    const autor = mensaje.autor_id ? staffPorId.get(mensaje.autor_id)?.full_name : null
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 dark:border-amber-800/60 dark:bg-amber-950">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-medium text-amber-800 dark:text-amber-300">
            <StickyNote className="size-3" />
            Nota interna{autor ? ` · ${autor}` : ""} · {horaCorta(mensaje.created_at)}
          </p>
          <p className="text-sm whitespace-pre-wrap break-words text-amber-950 dark:text-amber-100">{mensaje.contenido}</p>
        </div>
      </div>
    )
  }

  const esCliente = mensaje.rol === "user"
  const esHumano = mensaje.rol === "humano"
  const permalink = typeof mensaje.metadata.permalink === "string" ? mensaje.metadata.permalink : null

  return (
    <div className={cn("flex", esCliente ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[75%] rounded-lg px-3 py-2", esCliente ? "bg-muted" : "bg-primary text-primary-foreground")}>
        {mensaje.tipo === "comentario" && (
          <p className={cn("mb-1 text-[10px] font-medium", esCliente ? "text-muted-foreground" : "text-primary-foreground/70")}>
            💬 Comentario{permalink && (
              <>
                {" · "}
                <a href={permalink} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  Ver publicación <ExternalLink className="inline size-2.5" />
                </a>
              </>
            )}
          </p>
        )}

        <MediaEnBurbuja mensaje={mensaje} />
        <p className="text-sm whitespace-pre-wrap break-words">{mensaje.contenido}</p>

        {mensaje.tipo === "comentario" && esCliente && (
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={() => onResponderComentario(mensaje, "publico")}
              className="text-[10px] font-medium underline underline-offset-2 hover:opacity-80"
            >
              Responder en público
            </button>
            <button
              type="button"
              disabled={!puedeRespuestaPrivada(mensaje)}
              onClick={() => onResponderComentario(mensaje, "privado")}
              title={!puedeRespuestaPrivada(mensaje) ? "Ya se usó la respuesta privada, o pasaron más de 7 días" : undefined}
              className="text-[10px] font-medium underline underline-offset-2 hover:opacity-80 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
            >
              Responder por privado
            </button>
          </div>
        )}

        {mensaje.error_entrega && (
          <p
            className="mt-1 flex items-center gap-1 text-[11px] font-medium text-destructive"
            title={mensaje.error_entrega}
          >
            <AlertTriangle className="size-3 shrink-0" />
            No le llegó a la clienta
          </p>
        )}
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-[10px]",
            esCliente ? "text-muted-foreground" : "text-primary-foreground/70",
          )}
        >
          {!esCliente &&
            (esHumano ? (
              <>
                <UserRound className="size-2.5" /> Staff
              </>
            ) : (
              <>
                <Bot className="size-2.5" /> Bot
              </>
            ))}
          <span className={cn(!esCliente && "ml-auto")}>{horaCorta(mensaje.created_at)}</span>
        </div>
      </div>
    </div>
  )
}

type ModoCompositor = "responder" | "nota"

export default function ChatThread({
  conversacion,
  staff,
}: {
  conversacion: ConversacionResumen | null
  staff: Profile[]
}) {
  const { session } = useAuth()
  const { nombreSede, nombreProfesional } = useEquipo()

  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [loading, setLoading] = useState(false)
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [cambiandoModo, setCambiandoModo] = useState(false)
  const [plantillas, setPlantillas] = useState<PlantillaMedia[]>([])
  const [respuestas, setRespuestas] = useState<RespuestaRapida[]>([])
  const [modoCompositor, setModoCompositor] = useState<ModoCompositor>("responder")
  const [selectorAtajos, setSelectorAtajos] = useState(false)
  const [ultimaCita, setUltimaCita] = useState<Cita | null>(null)
  const [sugiriendo, setSugiriendo] = useState(false)
  const [humanAgentAprobado, setHumanAgentAprobado] = useState(false)
  const finRef = useRef<HTMLDivElement>(null)

  const conversacionId = conversacion?.id ?? null
  const modoHumano = conversacion?.estado === "escalada"
  const staffPorId = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff])

  useEffect(() => {
    if (!conversacionId) {
      setMensajes([])
      return
    }
    let activo = true
    setLoading(true)
    setModoCompositor("responder")

    async function cargar() {
      const { data, error } = await supabase
        .from("mensajes")
        .select("*")
        .eq("conversacion_id", conversacionId)
        .order("created_at", { ascending: true })
      if (!activo) return
      if (error) toast.error("No se pudo cargar la conversación.")
      else setMensajes(data as Mensaje[])
      setLoading(false)
    }
    cargar()

    const canal = supabase
      .channel(`crm-hilo-${conversacionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes", filter: `conversacion_id=eq.${conversacionId}` },
        (payload) => setMensajes((previos) => [...previos, payload.new as Mensaje]),
      )
      // Un eco que pasa de 'humano sin autor' a otra cosa, metadata.respondido_privado
      // que se pone en true, o error_entrega que aparece después de un fallo async:
      // todo eso llega como UPDATE, no como un mensaje nuevo.
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mensajes", filter: `conversacion_id=eq.${conversacionId}` },
        (payload) => {
          const actualizado = payload.new as Mensaje
          setMensajes((previos) => previos.map((m) => (m.id === actualizado.id ? actualizado : m)))
        },
      )
      .subscribe()

    return () => {
      activo = false
      supabase.removeChannel(canal)
    }
  }, [conversacionId])

  // Biblioteca y respuestas rápidas: cambian poco, no ameritan realtime propio.
  useEffect(() => {
    supabase
      .from("plantillas_media")
      .select("*")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setPlantillas((data as PlantillaMedia[]) ?? []))
  }, [])

  useEffect(() => {
    if (!conversacion) return
    supabase
      .from("respuestas_rapidas")
      .select("*")
      .eq("activa", true)
      .or(`canal.is.null,canal.eq.${conversacion.canal}`)
      .order("sort_order")
      .then(({ data }) => setRespuestas((data as RespuestaRapida[]) ?? []))
  }, [conversacion?.canal])

  // Última cita de la clienta, solo para rellenar {{sede}}/{{profesional}} en respuestas rápidas.
  useEffect(() => {
    if (!conversacion) {
      setUltimaCita(null)
      return
    }
    supabase
      .from("citas")
      .select("*")
      .eq("cliente_id", conversacion.cliente_id)
      .order("inicio_utc", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setUltimaCita((data as Cita | null) ?? null))
  }, [conversacion?.cliente_id])

  useEffect(() => {
    estadoCanales()
      .then((estado) => setHumanAgentAprobado(estado.metaHumanAgentAprobado))
      .catch(() => {})
  }, [])

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" })
  }, [mensajes])

  // Marcar visto al abrir una conversación con algo pendiente — cosmético en
  // Meta (sender_action: mark_seen), sin equivalente en WhatsApp.
  useEffect(() => {
    if (conversacion && conversacion.canal !== "whatsapp" && conversacion.ultimo_rol === "user") {
      marcarVisto(conversacion.id).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversacionId])

  async function alternarModo(humano: boolean) {
    if (!conversacion) return
    setCambiandoModo(true)
    const { error } = await supabase
      .from("conversaciones")
      .update({ estado: humano ? "escalada" : "activa" })
      .eq("id", conversacion.id)
    setCambiandoModo(false)

    if (error) {
      toast.error("No se pudo cambiar el modo de la conversación.")
      return
    }
    toast.success(humano ? "El bot dejó de responder en este chat." : "El bot vuelve a responder en este chat.")
  }

  async function cambiarEtapa(etapa: Etapa) {
    if (!conversacion) return
    const { error } = await supabase.from("conversaciones").update({ etapa }).eq("id", conversacion.id)
    if (error) toast.error("No se pudo cambiar la etapa.")
  }

  async function asignar(agenteId: string | null) {
    if (!conversacion) return
    const { error } = await supabase.from("conversaciones").update({ asignada_a: agenteId }).eq("id", conversacion.id)
    if (error) toast.error("No se pudo asignar la conversación.")
  }

  function aplicarVariables(contenido: string): string {
    const nombre = conversacion?.cliente_nombre?.trim() || "clienta"
    return contenido
      .replaceAll("{{nombre}}", nombre)
      .replaceAll("{{sede}}", nombreSede(ultimaCita?.sede_id ?? null))
      .replaceAll("{{profesional}}", nombreProfesional(ultimaCita?.profesional_id ?? null))
  }

  function elegirAtajo(r: RespuestaRapida) {
    setTexto(aplicarVariables(r.contenido))
    setSelectorAtajos(false)
  }

  async function pedirSugerencia() {
    if (!conversacion) return
    setSugiriendo(true)
    try {
      const { texto: borrador } = await sugerirRespuesta(conversacion.id)
      setTexto(borrador)
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo generar la sugerencia.")
    } finally {
      setSugiriendo(false)
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!conversacion || !texto.trim()) return

    if (modoCompositor === "nota") {
      if (!session?.user.id) return
      setEnviando(true)
      const { error } = await supabase
        .from("mensajes")
        .insert({ conversacion_id: conversacion.id, rol: "humano", tipo: "nota", contenido: texto.trim(), autor_id: session.user.id })
      setEnviando(false)
      if (error) toast.error("No se pudo guardar la nota.")
      else setTexto("")
      return
    }

    setEnviando(true)
    try {
      await enviarMensajeHumano(conversacion.id, texto.trim())
      // El INSERT llega por realtime; limpiar acá evita duplicar la burbuja.
      setTexto("")
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo enviar el mensaje.")
    } finally {
      setEnviando(false)
    }
  }

  async function enviarPlantilla(plantillaId: string) {
    if (!conversacion) return
    setEnviando(true)
    try {
      await enviarPlantillaMensaje(conversacion.id, plantillaId)
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo enviar la multimedia.")
    } finally {
      setEnviando(false)
    }
  }

  const [comentarioActivo, setComentarioActivo] = useState<{ mensaje: Mensaje; modo: "publico" | "privado" } | null>(null)
  const [textoComentario, setTextoComentario] = useState("")
  const [respondiendoComentario, setRespondiendoComentario] = useState(false)

  async function confirmarRespuestaComentario() {
    if (!comentarioActivo || !textoComentario.trim()) return
    setRespondiendoComentario(true)
    try {
      const resultado = await responderComentario(comentarioActivo.mensaje.id, {
        modo: comentarioActivo.modo,
        texto: textoComentario.trim(),
      })
      toast.success(comentarioActivo.modo === "publico" ? "Respuesta pública enviada." : "Respuesta privada enviada.")
      if ("conversacionDmId" in resultado) {
        toast.info("Se abrió el DM con esta clienta — búscalo en la bandeja para seguir la conversación ahí.")
      }
      setComentarioActivo(null)
      setTextoComentario("")
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo responder el comentario.")
    } finally {
      setRespondiendoComentario(false)
    }
  }

  if (!conversacion) {
    return (
      <section className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Elige una conversación para verla aquí.</p>
      </section>
    )
  }

  const esComentario = conversacion.origen === "comentario"

  // Aviso de ventana: por canal, y solo aplica a DMs (los comentarios no
  // tienen "ventana", se responde comentario por comentario).
  const ventana = esComentario
    ? { abierta: true as const }
    : conversacion.canal === "whatsapp"
      ? { abierta: ventanaAbierta(conversacion) }
      : ventanaMeta(conversacion, humanAgentAprobado)
  const puedeEnviarTexto = modoCompositor === "nota" || (!esComentario && ventana.abierta)

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <CanalIcon canal={conversacion.canal} className="size-5 text-[11px]" />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">
              {conversacion.cliente_nombre?.trim() || describirIdentidad(conversacion)}
            </h2>
            <p className="text-xs text-muted-foreground">
              {conversacion.canal === "instagram" && conversacion.identidad_username ? (
                <a
                  href={`https://instagram.com/${conversacion.identidad_username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-primary hover:underline"
                >
                  @{conversacion.identidad_username}
                </a>
              ) : (
                describirIdentidad(conversacion)
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Select value={conversacion.etapa} onValueChange={(v) => cambiarEtapa(v as Etapa)}>
            <SelectTrigger className="h-8 w-[132px] text-xs">
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

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-accent">
              {conversacion.asignada_nombre ?? "Sin asignar"}
              <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => asignar(null)}>Sin asignar</DropdownMenuItem>
              {session?.user.id && <DropdownMenuItem onClick={() => asignar(session.user.id)}>Asignarme a mí</DropdownMenuItem>}
              {staff
                .filter((s) => s.id !== session?.user.id)
                .map((s) => (
                  <DropdownMenuItem key={s.id} onClick={() => asignar(s.id)}>
                    {s.full_name ?? "Sin nombre"}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {!esComentario && (
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs">
              <span className={cn("font-medium", !modoHumano && "text-muted-foreground")}>Bot</span>
              <Switch checked={modoHumano} onCheckedChange={alternarModo} disabled={cambiandoModo} />
              <span className={cn("font-medium", !modoHumano && "text-muted-foreground")}>Yo</span>
            </label>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-1/2" />
            <Skeleton className="h-12 w-3/5" />
          </div>
        ) : mensajes.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Todavía no hay mensajes.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {mensajes.map((m) => (
              <Burbuja
                key={m.id}
                mensaje={m}
                staffPorId={staffPorId}
                onResponderComentario={(mensaje, modo) => {
                  setComentarioActivo({ mensaje, modo })
                  setTextoComentario("")
                }}
              />
            ))}
            <div ref={finRef} />
          </div>
        )}
      </div>

      <form onSubmit={enviar} className="relative shrink-0 border-t border-border px-5 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Segmented
            opciones={[
              { id: "responder", label: "Responder" },
              { id: "nota", label: "Nota interna" },
            ]}
            valor={modoCompositor}
            onChange={(v) => setModoCompositor(v as ModoCompositor)}
            etiquetaAria="Modo del compositor"
          />
          {modoCompositor === "responder" && !esComentario && (
            <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={pedirSugerencia} disabled={sugiriendo}>
              {sugiriendo ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              Sugerir con IA
            </Button>
          )}
        </div>

        {modoCompositor === "responder" && !modoHumano && !esComentario && (
          <p className="mb-2 text-xs text-muted-foreground">
            El bot está atendiendo este chat. Puedes escribir igual, pero activa <strong>Yo</strong> para que deje de
            responder por su cuenta.
          </p>
        )}

        {modoCompositor === "responder" && esComentario && (
          <p className="mb-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Esta es una conversación de comentarios: responde directamente desde los botones de cada comentario, arriba.
          </p>
        )}

        {modoCompositor === "responder" && !esComentario && !ventana.abierta && (
          <div className="mb-2 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {conversacion.canal === "whatsapp"
                ? "Pasaron más de 24 horas desde el último mensaje de la clienta. WhatsApp no permite escribirle texto libre; solo se puede retomar con una plantilla aprobada."
                : "motivo" in ventana
                  ? ventana.motivo
                  : "Ventana cerrada."}
            </span>
          </div>
        )}

        {selectorAtajos && respuestas.length > 0 && (
          <div className="absolute bottom-full left-5 z-10 mb-1 max-h-56 w-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
            {respuestas.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => elegirAtajo(r)}
                className="flex w-full flex-col items-start rounded-md px-2.5 py-1.5 text-left hover:bg-accent"
              >
                <span className="text-xs font-medium">/{r.atajo}</span>
                <span className="text-[11px] text-muted-foreground">{r.titulo}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          {modoCompositor === "responder" && !esComentario && (
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={!ventana.abierta || enviando || plantillas.length === 0}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Adjuntar multimedia"
                title={plantillas.length === 0 ? "No hay multimedia en la biblioteca" : "Adjuntar multimedia"}
              >
                <Paperclip className="size-4" />
                <ChevronDown className="size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {plantillas.map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => enviarPlantilla(p.id)}>
                    {p.nombre}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Textarea
            value={texto}
            onChange={(e) => {
              const valor = e.target.value
              setTexto(valor)
              setSelectorAtajos(modoCompositor === "responder" && valor.startsWith("/") && !esComentario)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void enviar(e)
              }
            }}
            placeholder={
              modoCompositor === "nota"
                ? "Escribe una nota interna — nunca se envía…"
                : esComentario
                  ? "Usa los botones de cada comentario para responder"
                  : ventana.abierta
                    ? "Escribe tu respuesta… (/ para respuestas rápidas)"
                    : "Ventana cerrada"
            }
            disabled={!puedeEnviarTexto || enviando || (esComentario && modoCompositor === "responder")}
            rows={2}
            className="min-h-0 resize-none"
          />
          <Button
            type="submit"
            disabled={!puedeEnviarTexto || enviando || !texto.trim() || (esComentario && modoCompositor === "responder")}
            className="gap-1.5"
          >
            <Send className="size-4" />
            {modoCompositor === "nota" ? "Guardar" : "Enviar"}
          </Button>
        </div>

        {modoCompositor === "responder" && !esComentario && ventana.abierta && conversacion.canal === "whatsapp" && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Quedan ~{horasRestantesVentana(conversacion)} h de ventana para escribir libremente.
          </p>
        )}
        {modoCompositor === "responder" && !esComentario && ventana.abierta && "modo" in ventana && ventana.modo === "HUMAN_AGENT" && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Pasaron más de 24 horas — este mensaje sale con la etiqueta Human Agent (quedan hasta 7 días desde el último mensaje).
          </p>
        )}
      </form>

      {comentarioActivo && (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={() => setComentarioActivo(null)}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-sm font-semibold">
              Responder {comentarioActivo.modo === "publico" ? "en público" : "por privado"}
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              {comentarioActivo.modo === "privado"
                ? `Se le manda como DM de ${CANAL_LABEL[conversacion.canal]} — es la única vez que se puede usar para este comentario.`
                : "Queda visible debajo del comentario, para cualquiera que vea la publicación."}
            </p>
            <Textarea
              value={textoComentario}
              onChange={(e) => setTextoComentario(e.target.value)}
              rows={3}
              placeholder="Escribe la respuesta…"
              className="resize-none text-sm"
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setComentarioActivo(null)}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={confirmarRespuestaComentario} disabled={respondiendoComentario || !textoComentario.trim()}>
                Enviar
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
