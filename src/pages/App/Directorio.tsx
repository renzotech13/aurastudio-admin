import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ChevronDown, PhoneCall, Search, Users } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { fechaCorta } from "@/lib/format"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import HistorialClienta from "@/components/HistorialClienta"
import { cn } from "@/lib/utils"

type Cliente = {
  id: string
  nombre: string | null
  telefono: string | null
  notas: string | null
  no_contactar: boolean
  created_at: string
}

/**
 * Directorio de clientas para quien atiende (vendedor): buscar a alguien por
 * nombre o teléfono para llamarla, escribirle o ver la nota que dejó el equipo.
 * Lee `clientes` directo: la base ya deja a un vendedor leerla (migración 0021).
 */
export default function Directorio() {
  const [buscar, setBuscar] = useState("")
  const [clientas, setClientas] = useState<Cliente[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  const [abierta, setAbierta] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    // Pausa al escribir para no consultar en cada tecla.
    const id = setTimeout(async () => {
      setCargando(true)
      const termino = buscar.trim().replace(/[,()%]/g, " ")
      let consulta = supabase.from("clientes").select("id,nombre,telefono,notas,no_contactar,created_at").order("created_at", { ascending: false }).limit(40)
      if (termino.length >= 2) consulta = consulta.or(`nombre.ilike.%${termino}%,telefono.ilike.%${termino}%`)
      const { data, error: fallo } = await consulta
      if (!activo) return
      if (fallo) setError(true)
      else {
        setError(false)
        setClientas((data ?? []) as Cliente[])
      }
      setCargando(false)
    }, buscar ? 300 : 0)
    return () => {
      activo = false
      clearTimeout(id)
    }
  }, [buscar, intento])

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-5">
      <p className="text-[10.5px] tracking-[0.2em] text-gold-deep uppercase dark:text-gold">Directorio</p>
      <h1 className="aura-display mb-4 text-[24px] leading-tight">Clientas</h1>

      <div className="relative mb-4">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar por nombre o teléfono…"
          aria-label="Buscar clienta"
          className="h-11 rounded-xl pl-9"
        />
      </div>

      {cargando ? (
        <div className="flex flex-col gap-2" aria-busy>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[76px] rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-status-cancelled/30 bg-status-cancelled-bg/60 p-5 text-center">
          <p className="text-[13.5px] text-status-cancelled">No se pudo cargar el directorio.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </Button>
        </div>
      ) : clientas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <Users className="size-7 text-muted-foreground/60" strokeWidth={1.5} />
          <p className="text-[13.5px] text-muted-foreground">Ninguna clienta coincide con esa búsqueda.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {clientas.map((c) => {
            const tel = c.telefono?.replace(/\D/g, "") ?? null
            return (
              <li key={c.id} className="rounded-2xl border border-border bg-card px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-[14.5px] font-medium break-words">{c.nombre?.trim() || "Sin nombre"}</p>
                    <p className="tnum text-[12.5px] text-muted-foreground">
                      {c.telefono ?? "Sin teléfono"} · desde {fechaCorta(c.created_at)}
                    </p>
                  </div>
                  {tel ? (
                    <div className="flex shrink-0 gap-1.5">
                      <a
                        href={`tel:+${tel}`}
                        aria-label={`Llamar a ${c.nombre ?? "la clienta"}`}
                        className="flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground"
                      >
                        <PhoneCall className="size-4" />
                      </a>
                      <a
                        href={`https://wa.me/${tel}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-10 items-center rounded-full border border-border px-3 text-[12px] text-muted-foreground"
                      >
                        WhatsApp
                      </a>
                    </div>
                  ) : null}
                </div>
                {c.notas?.trim() ? (
                  <p className="mt-2 rounded-lg bg-gold/10 px-2.5 py-1.5 text-[12.5px] leading-snug whitespace-pre-line">{c.notas}</p>
                ) : null}

                <button
                  type="button"
                  onClick={() => setAbierta(abierta === c.id ? null : c.id)}
                  aria-expanded={abierta === c.id}
                  className="mt-2 flex items-center gap-1 text-[12.5px] text-gold-deep dark:text-gold"
                >
                  Historial
                  <ChevronDown className={cn("size-3.5 transition-transform", abierta === c.id && "rotate-180")} />
                </button>
                {abierta === c.id ? (
                  <div className="mt-2 flex flex-col gap-3 border-t border-border pt-3">
                    <HistorialClienta clienteId={c.id} />
                    <label className="flex items-center justify-between gap-3 text-[12.5px]">
                      <span>
                        No enviarle promociones ni recordatorios para volver
                        <span className="block text-[11.5px] text-muted-foreground">Úsalo si ella lo pidió.</span>
                      </span>
                      <Switch
                        checked={c.no_contactar}
                        onCheckedChange={async (v) => {
                          const { error: fallo } = await supabase.from("clientes").update({ no_contactar: v }).eq("id", c.id)
                          if (fallo) return toast.error("No se pudo guardar.")
                          setClientas((previas) => previas.map((x) => (x.id === c.id ? { ...x, no_contactar: v } : x)))
                        }}
                        aria-label="No contactar"
                      />
                    </label>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
