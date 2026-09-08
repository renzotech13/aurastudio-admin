import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { supabase } from "./supabase"
import { useAuth } from "./auth"
import { CANAL_LABEL } from "./canales"
import type { ConversacionResumen, EventoConversacion, Mensaje } from "./types"

const AVISOS_KEY = "aura-avisos-activos"
/** Mismo storage que CRM/index.tsx — así el aviso sabe si el mensaje que
 *  acaba de llegar es justo el de la conversación que el staff ya tiene abierta. */
const BANDEJA_KEY = "aura-bandeja-filtros"

function avisosGuardadosActivos(): boolean {
  try {
    return localStorage.getItem(AVISOS_KEY) === "1"
  } catch {
    return false
  }
}

function conversacionAbiertaId(): string | null {
  try {
    const crudo = localStorage.getItem(BANDEJA_KEY)
    return crudo ? (JSON.parse(crudo).seleccionadaId ?? null) : null
  } catch {
    return null
  }
}

/** Beep corto de dos tonos con Web Audio — sin archivos de audio que mantener. */
function reproducirSonido() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const ahora = ctx.currentTime
    for (const [inicio, freq] of [
      [0, 740],
      [0.09, 990],
    ] as const) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.001, ahora + inicio)
      gain.gain.exponentialRampToValueAtTime(0.15, ahora + inicio + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, ahora + inicio + 0.08)
      osc.start(ahora + inicio)
      osc.stop(ahora + inicio + 0.09)
    }
    setTimeout(() => ctx.close(), 400)
  } catch {
    // Web Audio puede fallar (política de autoplay, navegador viejo) — un aviso sin sonido no es grave.
  }
}

const TITULO_BASE = document.title

/**
 * Se monta una sola vez en AppShell. El badge de "sin responder" siempre está
 * activo (es solo informativo); toast + Notification + sonido requieren que
 * el staff los prenda con "Activar avisos" — pedir permiso de notificaciones
 * sin que lo pidan primero suele terminar bloqueado por el navegador.
 */
function useAvisosBandejaInterno() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [sinResponder, setSinResponder] = useState(0)
  const [avisosActivos, setAvisosActivos] = useState(avisosGuardadosActivos)
  const sesionIdRef = useRef(session?.user.id)
  sesionIdRef.current = session?.user.id

  useEffect(() => {
    document.title = sinResponder > 0 ? `(${sinResponder}) ${TITULO_BASE}` : TITULO_BASE
  }, [sinResponder])

  useEffect(() => {
    let activo = true

    async function recalcular() {
      const { count } = await supabase
        .from("conversaciones_resumen")
        .select("id", { count: "exact", head: true })
        .eq("ultimo_rol", "user")
        .neq("estado", "cerrada")
      if (activo) setSinResponder(count ?? 0)
    }
    recalcular()

    async function avisarMensaje(mensaje: Mensaje) {
      if (mensaje.rol !== "user" || mensaje.tipo === "nota") return

      // El staff ya tiene esta conversación abierta y la pestaña está a la
      // vista: no hace falta interrumpir, el mensaje ya aparece en el hilo.
      if (
        document.visibilityState === "visible" &&
        window.location.pathname === "/conversaciones" &&
        conversacionAbiertaId() === mensaje.conversacion_id
      ) {
        return
      }

      const { data } = await supabase
        .from("conversaciones_resumen")
        .select("canal, cliente_nombre, identidad_nombre, identidad_username, cliente_telefono")
        .eq("id", mensaje.conversacion_id)
        .maybeSingle<Pick<ConversacionResumen, "canal" | "cliente_nombre" | "identidad_nombre" | "identidad_username" | "cliente_telefono">>()
      if (!activo) return

      const nombre =
        data?.cliente_nombre?.trim() ||
        (data?.canal === "instagram" && data.identidad_username ? `@${data.identidad_username}` : null) ||
        data?.identidad_nombre?.trim() ||
        data?.cliente_telefono ||
        "Alguien"
      const canalTexto = data ? CANAL_LABEL[data.canal] : "un canal"
      const preview = mensaje.tipo === "comentario" ? `💬 comentó: ${mensaje.contenido}` : mensaje.contenido

      toast.message(`${nombre} · ${canalTexto}`, {
        description: preview,
        action: { label: "Abrir", onClick: () => navigate("/conversaciones") },
      })
      reproducirSonido()

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        if (document.visibilityState === "hidden" || window.location.pathname !== "/conversaciones") {
          const notif = new Notification(`${nombre} (${canalTexto})`, { body: preview })
          notif.onclick = () => {
            window.focus()
            navigate("/conversaciones")
          }
        }
      }
    }

    function avisarEvento(evento: EventoConversacion) {
      const mio = sesionIdRef.current
      if (evento.tipo === "asignacion") {
        const detalle = evento.detalle as { de?: string | null; a?: string | null }
        if (!mio || detalle.a !== mio || detalle.a === detalle.de) return
        toast.message("Te asignaron una conversación", {
          action: { label: "Abrir", onClick: () => navigate("/conversaciones") },
        })
        reproducirSonido()
      } else if (evento.tipo === "escalada") {
        // Relevante para cualquiera en línea: todavía no tiene dueño.
        toast.message("Una clienta pidió hablar con una persona", {
          action: { label: "Abrir", onClick: () => navigate("/conversaciones") },
        })
        reproducirSonido()
      }
    }

    const canal = supabase
      .channel("avisos-bandeja")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes" }, (payload) => {
        recalcular()
        if (avisosGuardadosActivos()) void avisarMensaje(payload.new as Mensaje)
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversaciones" }, () => recalcular())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "eventos_conversacion" }, (payload) => {
        if (avisosGuardadosActivos()) avisarEvento(payload.new as EventoConversacion)
      })
      .subscribe()

    return () => {
      activo = false
      supabase.removeChannel(canal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function activar() {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission()
    }
    try {
      localStorage.setItem(AVISOS_KEY, "1")
    } catch {
      // Sin localStorage el toggle no persiste entre recargas, pero la sesión actual sigue funcionando.
    }
    setAvisosActivos(true)
    toast.success("Avisos activados para esta bandeja.")
  }

  function desactivar() {
    try {
      localStorage.setItem(AVISOS_KEY, "0")
    } catch {
      // Ídem: perder la preferencia guardada no rompe nada, solo hay que volver a activarla.
    }
    setAvisosActivos(false)
  }

  return { sinResponder, avisosActivos, activar, desactivar }
}

type AvisosBandeja = ReturnType<typeof useAvisosBandejaInterno>

const AvisosContext = createContext<AvisosBandeja | null>(null)

/**
 * Se monta una sola vez, en AppShell — envuelve todas las páginas para que
 * el badge y los toasts sigan corriendo aunque el staff no esté en
 * /conversaciones. Un segundo useAvisosBandejaInterno() en otra pantalla
 * abriría un segundo canal de realtime y duplicaría cada toast/sonido.
 */
export function AvisosProvider({ children }: { children: ReactNode }) {
  const valor = useAvisosBandejaInterno()
  return <AvisosContext.Provider value={valor}>{children}</AvisosContext.Provider>
}

export function useAvisos(): AvisosBandeja {
  const ctx = useContext(AvisosContext)
  if (!ctx) throw new Error("useAvisos debe usarse dentro de AvisosProvider")
  return ctx
}
