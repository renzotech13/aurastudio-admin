import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { BarChart3, Bell, BellOff, Megaphone, UserPlus } from "lucide-react"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { useAvisos } from "@/lib/avisos"
import { CANAL_LABEL } from "@/lib/canales"
import { CANALES, type Canal, type Cliente, type ClienteEtiqueta, type ConversacionResumen, type Etapa, ETAPA_LABEL, ETAPAS, type Etiqueta, type Profile } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Segmented, type OpcionSegmentada } from "@/components/Segmented"
import ConversationList from "./ConversationList"
import ChatThread from "./ChatThread"
import ClientPanel from "./ClientPanel"
import PromoDialog from "./PromoDialog"
import ImportarClientesDialog from "./ImportarClientesDialog"
import { esperaRespuesta } from "./utils"

type FiltroCanal = "todas" | Canal | "comentarios"
type FiltroEstado = "todas" | "atencion" | "mias" | "sin_asignar" | "humano" | "cerradas"
type FiltroEtapa = "todas" | Etapa

const FILTROS_CANAL: OpcionSegmentada<FiltroCanal>[] = [
  { id: "todas", label: "Todas" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "messenger", label: "Messenger" },
  { id: "instagram", label: "Instagram" },
  { id: "comentarios", label: "Comentarios" },
]

const FILTROS_ESTADO: { key: FiltroEstado; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "atencion", label: "Sin responder" },
  { key: "mias", label: "Mías" },
  { key: "sin_asignar", label: "Sin asignar" },
  { key: "humano", label: "Con humano" },
  { key: "cerradas", label: "Cerradas" },
]

/** Filtros + selección: solo comodidad, así que un storage roto no debe tumbar la bandeja. */
const STORAGE_KEY = "aura-bandeja-filtros"

function cargarFiltrosGuardados(): { canal: FiltroCanal; estado: FiltroEstado; etapa: FiltroEtapa; seleccionadaId: string | null } {
  try {
    const crudo = localStorage.getItem(STORAGE_KEY)
    if (!crudo) throw new Error("vacío")
    const datos = JSON.parse(crudo)
    return {
      canal: datos.canal ?? "todas",
      estado: datos.estado ?? "todas",
      etapa: datos.etapa ?? "todas",
      seleccionadaId: datos.seleccionadaId ?? null,
    }
  } catch {
    return { canal: "todas", estado: "todas", etapa: "todas", seleccionadaId: null }
  }
}

export default function CRM() {
  const { session } = useAuth()
  const { avisosActivos, activar: activarAvisos, desactivar: desactivarAvisos } = useAvisos()
  const guardados = useMemo(cargarFiltrosGuardados, [])

  const [conversaciones, setConversaciones] = useState<ConversacionResumen[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [clienteEtiquetas, setClienteEtiquetas] = useState<ClienteEtiqueta[]>([])
  const [staff, setStaff] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroCanal, setFiltroCanal] = useState<FiltroCanal>(guardados.canal)
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>(guardados.estado)
  const [filtroEtapa, setFiltroEtapa] = useState<FiltroEtapa>(guardados.etapa)
  const [busqueda, setBusqueda] = useState("")
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(guardados.seleccionadaId)
  const [promoAbierto, setPromoAbierto] = useState(false)
  const [importarAbierto, setImportarAbierto] = useState(false)

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

    // Un mensaje nuevo cambia el orden y el preview del inbox, y el switch
    // bot/humano cambia el estado: ambos eventos recargan el resumen.
    const canal = supabase
      .channel("crm-inbox")
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ canal: filtroCanal, estado: filtroEstado, etapa: filtroEtapa, seleccionadaId }))
    } catch {
      // localStorage puede fallar (modo privado, cuota) — perder el filtro guardado no es grave.
    }
  }, [filtroCanal, filtroEstado, filtroEtapa, seleccionadaId])

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
      if (filtroCanal === "comentarios" && c.origen !== "comentario") return false
      if (filtroCanal !== "todas" && filtroCanal !== "comentarios" && c.canal !== filtroCanal) return false

      if (filtroEstado === "atencion" && !esperaRespuesta(c)) return false
      if (filtroEstado === "mias" && c.asignada_a !== session?.user.id) return false
      if (filtroEstado === "sin_asignar" && c.asignada_a !== null) return false
      if (filtroEstado === "humano" && c.estado !== "escalada") return false
      if (filtroEstado === "cerradas" && c.estado !== "cerrada") return false

      if (filtroEtapa !== "todas" && c.etapa !== filtroEtapa) return false

      if (!termino) return true
      return (
        (c.cliente_nombre ?? "").toLowerCase().includes(termino) ||
        (c.cliente_telefono ?? "").includes(termino) ||
        (c.identidad_username ?? "").toLowerCase().includes(termino) ||
        (c.ultimo_contenido ?? "").toLowerCase().includes(termino)
      )
    })
  }, [conversaciones, filtroCanal, filtroEstado, filtroEtapa, busqueda, session?.user.id])

  // Si la seleccionada se sale del filtro, se cae a la primera visible en
  // vez de dejar el panel derecho apuntando a algo que ya no está en lista.
  const seleccionada = filtradas.find((c) => c.id === seleccionadaId) ?? filtradas[0] ?? null

  const sinResponder = conversaciones.filter(esperaRespuesta).length
  const porCanal = useMemo(() => {
    const conteo: Record<Canal, number> = { whatsapp: 0, messenger: 0, instagram: 0 }
    for (const c of conversaciones) conteo[c.canal]++
    return conteo
  }, [conversaciones])

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="aura-eyebrow mb-1.5 flex items-center gap-2">
              <span className="aura-diamond" aria-hidden />
              Operación
            </p>
            <h1 className="aura-display text-[clamp(22px,2.4vw,30px)] leading-tight">
              Conversaciones
            </h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {loading
                ? "Cargando…"
                : `${sinResponder} sin responder · ${CANALES.map((canal) => `${porCanal[canal]} ${CANAL_LABEL[canal]}`).join(" · ")}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => (avisosActivos ? desactivarAvisos() : activarAvisos())} className="gap-2">
              {avisosActivos ? <BellOff className="size-4" /> : <Bell className="size-4" />}
              {avisosActivos ? "Avisos activados" : "Activar avisos"}
            </Button>
            <Button variant="outline" render={<Link to="/conversaciones/metricas" />} className="gap-2">
              <BarChart3 className="size-4" />
              Métricas
            </Button>
            <Button variant="outline" onClick={() => setImportarAbierto(true)} className="gap-2">
              <UserPlus className="size-4" />
              Importar clientas
            </Button>
            <Button variant="outline" onClick={() => setPromoAbierto(true)} className="gap-2">
              <Megaphone className="size-4" />
              Enviar promoción
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Segmented opciones={FILTROS_CANAL} valor={filtroCanal} onChange={setFiltroCanal} etiquetaAria="Filtrar por canal" />

          <Tabs value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as FiltroEstado)}>
            <TabsList>
              {FILTROS_ESTADO.map((f) => (
                <TabsTrigger key={f.key} value={f.key}>
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Select value={filtroEtapa} onValueChange={(v) => setFiltroEtapa(v as FiltroEtapa)}>
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas" className="text-xs">
                Toda etapa
              </SelectItem>
              {ETAPAS.map((e) => (
                <SelectItem key={e} value={e} className="text-xs">
                  {ETAPA_LABEL[e]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, teléfono, @usuario o mensaje…"
            className="h-9 max-w-xs"
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <ConversationList
          conversaciones={filtradas}
          etiquetasPorCliente={etiquetasPorCliente}
          seleccionadaId={seleccionada?.id ?? null}
          onSeleccionar={setSeleccionadaId}
          loading={loading}
        />
        <ChatThread conversacion={seleccionada} staff={staff} />
        <ClientPanel
          conversacion={seleccionada}
          etiquetas={etiquetas}
          etiquetasCliente={seleccionada ? (etiquetasPorCliente.get(seleccionada.cliente_id) ?? []) : []}
        />
      </div>

      <PromoDialog
        open={promoAbierto}
        onOpenChange={setPromoAbierto}
        etiquetas={etiquetas}
        etiquetasPorCliente={etiquetasPorCliente}
        clientes={clientes}
      />
      <ImportarClientesDialog open={importarAbierto} onOpenChange={setImportarAbierto} />
    </div>
  )
}
