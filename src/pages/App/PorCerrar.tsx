import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { MessageCircle, PhoneCall, RefreshCw, UserRoundCheck } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { CanalIcon } from "@/lib/canales"
import { ETAPA_LABEL, type Canal, type Etapa } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * Leads por cerrar: personas que escribieron, siguen sin agendar y todavía no
 * dijeron que no. Quien atiende las llama o les escribe, y deja el resultado
 * de cada intento (con una nota) para no llamar dos veces a la misma ni perder
 * el hilo cuando hay más de una persona atendiendo.
 *
 * La lista sale de la vista `leads_por_cerrar` y los intentos se guardan en
 * `contactos_lead` (migración 0021).
 */

type Medio = "llamada" | "whatsapp"
type Resultado = "no_contesto" | "hablamos" | "agendara" | "no_le_interesa"

type Lead = {
  conversacion_id: string
  cliente_id: string
  canal: Canal
  etapa: Etapa
  cliente_nombre: string | null
  cliente_telefono: string | null
  identidad_nombre: string | null
  identidad_username: string | null
  ultimo_contenido: string | null
  ultimo_rol: string | null
  actividad_at: string
  ultimo_contacto_at: string | null
  ultimo_contacto_medio: Medio | null
  ultimo_contacto_resultado: Resultado | null
  ultimo_contacto_nota: string | null
}

const RESULTADOS: { id: Resultado; label: string }[] = [
  { id: "no_contesto", label: "No contestó" },
  { id: "hablamos", label: "Hablamos" },
  { id: "agendara", label: "Agendará" },
  { id: "no_le_interesa", label: "No le interesa" },
]

const RESULTADO_LABEL: Record<Resultado, string> = {
  no_contesto: "No contestó",
  hablamos: "Hablamos",
  agendara: "Agendará",
  no_le_interesa: "No le interesa",
}

const REFRESCO_MS = 60_000
/** Pasado este tiempo desde el último intento, vuelve a la lista de «Por contactar». */
const ENFRIAMIENTO_MS = 24 * 60 * 60_000

function nombreDe(l: Lead): string {
  return (
    l.cliente_nombre?.trim() ||
    (l.canal === "instagram" && l.identidad_username ? `@${l.identidad_username}` : null) ||
    l.identidad_nombre?.trim() ||
    l.cliente_telefono ||
    "Sin nombre"
  )
}

function hace(iso: string, ahora: number): string {
  const min = Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60_000))
  if (min < 1) return "ahora"
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} ${d === 1 ? "día" : "días"}`
}

function soloDigitos(tel: string): string {
  return tel.replace(/\D/g, "")
}

export default function PorCerrar() {
  const { session } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [ahora, setAhora] = useState(() => Date.now())
  const [vista, setVista] = useState<"pendientes" | "contactadas">("pendientes")
  // Lead al que se le acaba de tocar Llamar / WhatsApp y falta anotar cómo le fue.
  const [anotando, setAnotando] = useState<{ lead: Lead; medio: Medio } | null>(null)

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true)
    const { data, error: fallo } = await supabase
      .from("leads_por_cerrar")
      .select("*")
      .order("actividad_at", { ascending: false })
      .limit(200)
    setAhora(Date.now())
    if (fallo) setError(true)
    else {
      setError(false)
      setLeads((data ?? []) as Lead[])
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    const refrescar = () => void cargar(true)
    const alVolver = () => {
      if (document.visibilityState === "visible") refrescar()
    }
    document.addEventListener("visibilitychange", alVolver)
    const id = setInterval(alVolver, REFRESCO_MS)
    return () => {
      document.removeEventListener("visibilitychange", alVolver)
      clearInterval(id)
    }
  }, [cargar])

  const { pendientes, contactadas } = useMemo(() => {
    const reciente = (l: Lead) =>
      l.ultimo_contacto_at !== null && ahora - new Date(l.ultimo_contacto_at).getTime() < ENFRIAMIENTO_MS
    // Primero las más avanzadas en la conversación: ya dieron sus datos o preguntaron precio.
    const peso: Record<Etapa, number> = { calificado: 0, en_atencion: 1, nuevo: 2, agendado: 3, cerrado: 4 }
    const orden = (a: Lead, b: Lead) => peso[a.etapa] - peso[b.etapa] || b.actividad_at.localeCompare(a.actividad_at)
    return {
      pendientes: leads.filter((l) => !reciente(l)).sort(orden),
      contactadas: leads.filter(reciente).sort(orden),
    }
  }, [leads, ahora])

  const lista = vista === "pendientes" ? pendientes : contactadas

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] tracking-[0.2em] text-gold-deep uppercase dark:text-gold">Seguimiento</p>
          <h1 className="aura-display text-[24px] leading-tight">Por cerrar</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {cargando ? "Cargando…" : `${pendientes.length} por contactar · ${contactadas.length} contactadas hoy`}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Actualizar" onClick={() => void cargar()} disabled={cargando}>
          <RefreshCw className={cn("size-4", cargando && "animate-spin")} />
        </Button>
      </div>

      <div role="tablist" aria-label="Estado del seguimiento" className="mb-4 grid grid-cols-2 gap-2">
        {(
          [
            ["pendientes", "Por contactar", pendientes.length],
            ["contactadas", "Contactadas", contactadas.length],
          ] as const
        ).map(([id, etiqueta, n]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={vista === id}
            onClick={() => setVista(id)}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-[13px] transition-colors",
              vista === id
                ? "border-gold bg-gold/15 text-gold-deep dark:text-gold"
                : "border-border text-muted-foreground hover:border-gold/50",
            )}
          >
            {etiqueta} <span className="tnum opacity-70">({n})</span>
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="flex flex-col gap-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[150px] rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-status-cancelled/30 bg-status-cancelled-bg/60 p-5 text-center">
          <p className="text-[13.5px] text-status-cancelled">No se pudo cargar el seguimiento.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void cargar()}>
            Reintentar
          </Button>
        </div>
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <UserRoundCheck className="size-7 text-muted-foreground/60" strokeWidth={1.5} />
          <p className="text-[13.5px] text-muted-foreground">
            {vista === "pendientes" ? "No queda nadie por contactar. Buen trabajo." : "Todavía no contactaste a nadie hoy."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map((l) => (
            <TarjetaLead key={l.conversacion_id} lead={l} ahora={ahora} onContactar={(medio) => setAnotando({ lead: l, medio })} />
          ))}
        </ul>
      )}

      <NotaContacto
        anotando={anotando}
        usuarioId={session?.user.id ?? null}
        onCerrar={() => setAnotando(null)}
        onGuardado={() => {
          setAnotando(null)
          void cargar(true)
        }}
      />
    </div>
  )
}

function TarjetaLead({ lead, ahora, onContactar }: { lead: Lead; ahora: number; onContactar: (medio: Medio) => void }) {
  const tel = lead.cliente_telefono ? soloDigitos(lead.cliente_telefono) : null
  const nombre = nombreDe(lead)
  const botonBase =
    "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border text-[13px] transition-colors active:bg-gold/10 focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none"

  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="relative mt-0.5 shrink-0">
          <CanalIcon canal={lead.canal} className="size-6 text-[12px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="line-clamp-1 text-[14.5px] font-medium break-words">{nombre}</p>
            <span className="shrink-0 text-[11.5px] text-muted-foreground">{hace(lead.actividad_at, ahora)}</span>
          </div>
          {lead.ultimo_contenido ? (
            <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground/80">{lead.ultimo_rol === "user" ? "Ella: " : "Tú: "}</span>
              {lead.ultimo_contenido}
            </p>
          ) : null}
          <p className="mt-1.5">
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10.5px] tracking-wide text-gold-deep uppercase dark:text-gold">
              {ETAPA_LABEL[lead.etapa]}
            </span>
          </p>
        </div>
      </div>

      {lead.ultimo_contacto_at ? (
        <div className="mt-3 rounded-lg bg-gold/10 px-3 py-2 text-[12.5px] leading-snug">
          <span className="font-medium">
            {lead.ultimo_contacto_medio === "llamada" ? "Llamada" : "WhatsApp"} ·{" "}
            {lead.ultimo_contacto_resultado ? RESULTADO_LABEL[lead.ultimo_contacto_resultado] : ""}
          </span>{" "}
          <span className="text-muted-foreground">{hace(lead.ultimo_contacto_at, ahora)}</span>
          {lead.ultimo_contacto_nota ? <p className="mt-0.5 text-muted-foreground">{lead.ultimo_contacto_nota}</p> : null}
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Link to={`/app/chats?c=${lead.conversacion_id}`} className={cn(botonBase, "border-gold/60 text-gold-deep dark:text-gold")}>
          <MessageCircle className="size-4" />
          Chat
        </Link>
        {tel ? (
          <>
            <a href={`tel:+${tel}`} onClick={() => onContactar("llamada")} className={botonBase}>
              <PhoneCall className="size-4" />
              Llamar
            </a>
            <a
              href={`https://wa.me/${tel}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => onContactar("whatsapp")}
              className={botonBase}
            >
              WhatsApp
            </a>
          </>
        ) : (
          <p className="flex flex-1 items-center text-[12px] text-muted-foreground">Sin teléfono: solo por el chat.</p>
        )}
      </div>
    </li>
  )
}

/** Después de tocar Llamar o WhatsApp: cómo le fue, y una nota para quien siga. */
function NotaContacto({
  anotando,
  usuarioId,
  onCerrar,
  onGuardado,
}: {
  anotando: { lead: Lead; medio: Medio } | null
  usuarioId: string | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [nota, setNota] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!anotando) return
    setResultado(null)
    setNota("")
  }, [anotando])

  async function guardar() {
    if (!anotando || !resultado || !usuarioId || nota.trim().length < 2) return
    setGuardando(true)
    const { error } = await supabase.from("contactos_lead").insert({
      cliente_id: anotando.lead.cliente_id,
      conversacion_id: anotando.lead.conversacion_id,
      medio: anotando.medio,
      resultado,
      nota: nota.trim(),
      staff_id: usuarioId,
    })
    setGuardando(false)
    if (error) {
      toast.error("No se pudo guardar. Vuelve a intentarlo.")
      return
    }
    toast.success("Anotado.")
    onGuardado()
  }

  return (
    <Dialog open={anotando !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Cómo te fue?</DialogTitle>
        </DialogHeader>
        {anotando ? (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-muted-foreground">
              {anotando.medio === "llamada" ? "Llamada" : "WhatsApp"} a <strong className="text-foreground">{nombreDe(anotando.lead)}</strong>
            </p>
            <div role="group" aria-label="Resultado" className="grid grid-cols-2 gap-2">
              {RESULTADOS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={resultado === r.id}
                  onClick={() => setResultado(r.id)}
                  className={cn(
                    "min-h-11 rounded-xl border px-3 text-[13px] transition-colors",
                    resultado === r.id
                      ? "border-gold bg-gold/15 text-gold-deep dark:text-gold"
                      : "border-border text-muted-foreground hover:border-gold/50",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contacto-nota">Nota para quien siga</Label>
              <Textarea
                id="contacto-nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Qué le interesa, cuándo volver a llamarla…"
                className="rounded-xl"
              />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCerrar}>
            Ahora no
          </Button>
          <Button
            type="button"
            variant="gold"
            disabled={guardando || !resultado || nota.trim().length < 2}
            onClick={() => void guardar()}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
