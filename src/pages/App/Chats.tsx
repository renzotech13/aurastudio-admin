import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Bell, BellOff, Megaphone, Search } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { useAvisos } from "@/lib/avisos"
import {
  type Cliente,
  type ClienteEtiqueta,
  type ConversacionResumen,
  type Etiqueta,
  type Profile,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import ConversationList from "@/pages/CRM/ConversationList"
import ChatThread from "@/pages/CRM/ChatThread"
import PromoDialog from "@/pages/CRM/PromoDialog"
import { esperaRespuesta } from "@/pages/CRM/utils"
import type { ModoApp } from "@/components/AppMovilShell"

type FiltroEstado = "todas" | "atencion" | "mias" | "sin_asignar" | "humano" | "cerradas"

const FILTROS_ESTADO: { key: FiltroEstado; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "atencion", label: "Sin responder" },
  { key: "mias", label: "Mías" },
  { key: "sin_asignar", label: "Sin asignar" },
  { key: "humano", label: "Con humano" },
  { key: "cerradas", label: "Cerradas" },
]

/**
 * Las conversaciones del bot en formato app: la lista ocupa toda la pantalla
 * y al tocar un chat se abre el hilo encima, con flecha para volver — en un
 * celular no caben lista + hilo + ficha lado a lado como en el CRM de
 * escritorio.
 *
 * Misma información y los mismos controles (responder yo / dejar al bot,
 * asignar, cambiar etapa, IA sugerida) que en escritorio: se comparten
 * ConversationList, ChatThread y PromoDialog, así que no hay una segunda
 * lógica que mantener — solo cambia el marco.
 */
export default function Chats({ modo }: { modo: ModoApp }) {
  const { session } = useAuth()
  const { avisosActivos, activar: activarAvisos, desactivar: desactivarAvisos } = useAvisos()

  const [conversaciones, setConversaciones] = useState<ConversacionResumen[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [clienteEtiquetas, setClienteEtiquetas] = useState<ClienteEtiqueta[]>([])
  const [staff, setStaff] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<FiltroEstado>("todas")
  const [busqueda, setBusqueda] = useState("")
  // `?c=<id>` abre ese chat directo: lo usan «Por cerrar» y los enlaces de aviso.
  const [params, setParams] = useSearchParams()
  const [abiertaId, setAbiertaIdEstado] = useState<string | null>(() => params.get("c"))
  const setAbiertaId = (id: string | null) => {
    setAbiertaIdEstado(id)
    if (id === null && params.has("c")) {
      const siguiente = new URLSearchParams(params)
      siguiente.delete("c")
      setParams(siguiente, { replace: true })
    }
  }
  const [promoAbierto, setPromoAbierto] = useState(false)

  useEffect(() => {
    let activo = true

    async function cargar() {
      const [conv, cli, etq, clienteEtq, equipo] = await Promise.all([
        supabase.from("conversaciones_resumen").select("*").order("actividad_at", { ascending: false }).limit(200),
        supabase.from("clientes").select("*").order("nombre"),
        supabase.from("etiquetas").select("*").order("nombre"),
        supabase.from("cliente_etiquetas").select("cliente_id, etiqueta_id"),
        supabase.from("profiles").select("*").eq("role", "staff").order("full_name"),
      ])
      if (!activo) return

      if (conv.error || cli.error || etq.error || clienteEtq.error || equipo.error) {
        toast.error("No se pudieron cargar las conversaciones.")
      } else {
        setConversaciones(conv.data as ConversacionResumen[])
        setClientes(cli.data as Cliente[])
        setEtiquetas(etq.data as Etiqueta[])
        setClienteEtiquetas(clienteEtq.data as ClienteEtiqueta[])
        setStaff(equipo.data as Profile[])
      }
      setLoading(false)
    }
    cargar()

    const canal = supabase
      .channel("app-chats-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "mensajes" }, () => cargar())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversaciones" }, () => cargar())
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, () => cargar())
      .on("postgres_changes", { event: "*", schema: "public", table: "cliente_etiquetas" }, () => cargar())
      .subscribe()

    return () => {
      activo = false
      supabase.removeChannel(canal)
    }
  }, [])

  const etiquetasPorCliente = useMemo(() => {
    const porId = new Map(etiquetas.map((e) => [e.id, e]))
    const mapa = new Map<string, Etiqueta[]>()
    for (const rel of clienteEtiquetas) {
      const etiqueta = porId.get(rel.etiqueta_id)
      if (!etiqueta) continue
      const actuales = mapa.get(rel.cliente_id) ?? []
      actuales.push(etiqueta)
      mapa.set(rel.cliente_id, actuales)
    }
    return mapa
  }, [etiquetas, clienteEtiquetas])

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return conversaciones.filter((c) => {
      if (filtro === "atencion" && !esperaRespuesta(c)) return false
      if (filtro === "mias" && c.asignada_a !== session?.user.id) return false
      if (filtro === "sin_asignar" && c.asignada_a !== null) return false
      if (filtro === "humano" && c.estado !== "escalada") return false
      if (filtro === "cerradas" && c.estado !== "cerrada") return false

      if (!termino) return true
      return (
        (c.cliente_nombre ?? "").toLowerCase().includes(termino) ||
        (c.cliente_telefono ?? "").includes(termino) ||
        (c.identidad_username ?? "").toLowerCase().includes(termino) ||
        (c.ultimo_contenido ?? "").toLowerCase().includes(termino)
      )
    })
  }, [conversaciones, filtro, busqueda, session?.user.id])

  const abierta = conversaciones.find((c) => c.id === abiertaId) ?? null

  // Los avisos (lib/avisos.tsx) leen de acá cuál es el chat abierto, para no
  // interrumpir con un mensaje que ya se está viendo en pantalla.
  useEffect(() => {
    try {
      const clave = "aura-bandeja-filtros"
      const previo = JSON.parse(localStorage.getItem(clave) ?? "{}")
      localStorage.setItem(clave, JSON.stringify({ ...previo, seleccionadaId: abiertaId }))
    } catch {
      // Solo es comodidad: si el almacenamiento falla, se avisa de más y nada se rompe.
    }
  }, [abiertaId])
  const sinResponder = conversaciones.filter(esperaRespuesta).length

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] tracking-[0.2em] text-gold-deep uppercase dark:text-gold">Bandeja</p>
          <h1 className="aura-display text-[24px] leading-tight">Chats</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {loading ? "Cargando…" : `${sinResponder} sin responder`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Avisos de mensajes nuevos: sonido y notificación del navegador.
              Hay que prenderlos a propósito; pedir el permiso sin avisar suele terminar bloqueado. */}
          <button
            type="button"
            onClick={() => (avisosActivos ? desactivarAvisos() : activarAvisos())}
            aria-label={avisosActivos ? "Desactivar avisos de mensajes nuevos" : "Activar avisos de mensajes nuevos"}
            aria-pressed={avisosActivos}
            className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground"
          >
            {avisosActivos ? <Bell className="size-4 text-gold-deep dark:text-gold" /> : <BellOff className="size-4" />}
          </button>
          {/* Las promociones masivas son de la administradora: un vendedor no las manda. */}
          {modo === "admin" ? (
            <button
              type="button"
              onClick={() => setPromoAbierto(true)}
              aria-label="Enviar promoción"
              className="flex items-center gap-1.5 rounded-full border border-gold/50 px-3 py-2 text-[12.5px] text-gold-deep dark:text-gold"
            >
              <Megaphone className="size-3.5" />
              Promo
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative mb-3">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar nombre, teléfono, @usuario o mensaje…"
          aria-label="Buscar conversación"
          className="h-11 rounded-xl pl-9"
        />
      </div>

      <div role="tablist" aria-label="Filtrar chats" className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTROS_ESTADO.map((f) => {
          const activo = filtro === f.key
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setFiltro(f.key)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition-colors",
                activo
                  ? "border-gold bg-gold/15 text-gold-deep dark:text-gold"
                  : "border-border text-muted-foreground hover:border-gold/50",
              )}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      <div className="-mx-4 border-y border-border bg-card">
        <ConversationList
          conversaciones={filtradas}
          etiquetasPorCliente={etiquetasPorCliente}
          seleccionadaId={null}
          onSeleccionar={setAbiertaId}
          loading={loading}
          className="flex w-full flex-col"
        />
      </div>

      {abierta ? (
        <div className="fixed inset-x-0 top-0 z-50 flex h-dvh flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)]">
          <ChatThread conversacion={abierta} staff={staff} onVolver={() => setAbiertaId(null)} />
        </div>
      ) : null}

      {modo === "admin" ? (
        <PromoDialog
          open={promoAbierto}
          onOpenChange={setPromoAbierto}
          etiquetas={etiquetas}
          etiquetasPorCliente={etiquetasPorCliente}
          clientes={clientes}
        />
      ) : null}
    </div>
  )
}
