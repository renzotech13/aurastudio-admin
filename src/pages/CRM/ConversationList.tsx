import { useState } from "react"
import { Bot, MessageSquareText, UserRound } from "lucide-react"
import { ETAPA_LABEL, ETIQUETA_CLASSES, type ConversacionResumen, type Etapa, type Etiqueta } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { CanalIcon, describirIdentidad } from "@/lib/canales"
import { esperaRespuesta } from "./utils"

/** "hace 5 min", "14:30", "12 ago" — según qué tan vieja sea la actividad. */
function tiempoRelativo(iso: string): string {
  const fecha = new Date(iso)
  const minutos = Math.floor((Date.now() - fecha.getTime()) / 60_000)
  if (minutos < 1) return "ahora"
  if (minutos < 60) return `${minutos} min`
  const hoy = new Date().toDateString() === fecha.toDateString()
  if (hoy) return fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
  return fecha.toLocaleDateString("es-PE", { day: "numeric", month: "short" })
}

/** Igual criterio que el resto del panel para colorear por significado, no por serie de gráfico. */
const ETAPA_CLASES: Record<Etapa, string> = {
  nuevo: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  en_atencion: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200",
  calificado: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200",
  agendado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  cerrado: "bg-muted text-muted-foreground",
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?"
}

/** Foto de la identidad si carga; si no (o si no hay), inicial del nombre. */
function Avatar({ conv }: { conv: ConversacionResumen }) {
  const [fallo, setFallo] = useState(false)
  const nombre = conv.cliente_nombre?.trim() || conv.identidad_nombre?.trim() || conv.identidad_username || "?"

  return (
    <div className="relative size-9 shrink-0">
      {conv.identidad_foto && !fallo ? (
        <img
          src={conv.identidad_foto}
          alt=""
          className="size-9 rounded-full object-cover"
          onError={() => setFallo(true)}
        />
      ) : (
        <div className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {iniciales(nombre)}
        </div>
      )}
      <CanalIcon canal={conv.canal} className="absolute -right-0.5 -bottom-0.5 ring-2 ring-background" />
    </div>
  )
}

function previewTexto(c: ConversacionResumen): string {
  const contenido = c.ultimo_contenido ?? "Sin mensajes"
  if (c.origen === "comentario" && c.ultimo_tipo === "comentario") return `💬 comentó: ${contenido}`
  if (c.ultimo_tipo === "sistema") return contenido
  return contenido
}

export default function ConversationList({
  conversaciones,
  etiquetasPorCliente,
  seleccionadaId,
  onSeleccionar,
  loading,
}: {
  conversaciones: ConversacionResumen[]
  etiquetasPorCliente: Map<string, Etiqueta[]>
  seleccionadaId: string | null
  onSeleccionar: (id: string) => void
  loading: boolean
}) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border lg:w-80">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : conversaciones.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-muted-foreground">No hay conversaciones en este filtro.</p>
        ) : (
          <ul>
            {conversaciones.map((c) => {
              const activa = c.id === seleccionadaId
              const pendiente = esperaRespuesta(c)
              const etiquetas = etiquetasPorCliente.get(c.cliente_id) ?? []

              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSeleccionar(c.id)}
                    className={cn(
                      "flex w-full gap-2.5 border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent/60",
                      activa && "bg-accent",
                    )}
                  >
                    <Avatar conv={c} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {c.cliente_nombre?.trim() || describirIdentidad(c)}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">{tiempoRelativo(c.actividad_at)}</span>
                      </div>

                      <div className="mt-1 flex items-center gap-1.5">
                        {c.origen === "comentario" ? (
                          <MessageSquareText className="size-3 shrink-0 text-muted-foreground" aria-label="Comentario" />
                        ) : c.estado === "escalada" ? (
                          <UserRound className="size-3 shrink-0 text-amber-600" aria-label="Atendida por una persona" />
                        ) : (
                          <Bot className="size-3 shrink-0 text-muted-foreground" aria-label="Atendida por el bot" />
                        )}
                        <p
                          className={cn(
                            "truncate text-xs",
                            pendiente ? "font-medium text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {previewTexto(c)}
                        </p>
                        {pendiente && <span className="ml-auto size-2 shrink-0 rounded-full bg-primary" />}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", ETAPA_CLASES[c.etapa])}>
                          {ETAPA_LABEL[c.etapa]}
                        </span>
                        {c.asignada_nombre && (
                          <span
                            title={`Asignada a ${c.asignada_nombre}`}
                            className="flex size-4 items-center justify-center rounded-full bg-secondary text-[9px] font-semibold text-secondary-foreground"
                          >
                            {iniciales(c.asignada_nombre)}
                          </span>
                        )}
                        {etiquetas.slice(0, 2).map((e) => (
                          <span
                            key={e.id}
                            className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", ETIQUETA_CLASSES[e.color])}
                          >
                            {e.nombre}
                          </span>
                        ))}
                        {etiquetas.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{etiquetas.length - 2}</span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
