import { useEffect, useState } from "react"
import { Search, Users } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { fechaCorta } from "@/lib/format"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

type Clienta = {
  id: string
  nombre: string | null
  notas: string | null
  visitas: number
  ultima_visita: string | null
}

/**
 * Las clientas de la profesional: solo las que ella atendió. Se leen con
 * mis_clientas() y no con un SELECT sobre `clientes`: la función ya devuelve
 * lo mínimo (nombre, notas, visitas) y nunca el teléfono ni el correo.
 */
export default function Clientas() {
  const [buscar, setBuscar] = useState("")
  const [clientas, setClientas] = useState<Clienta[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  const [abierta, setAbierta] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    // Pausa al escribir para no consultar en cada tecla.
    const id = setTimeout(async () => {
      setCargando(true)
      const termino = buscar.trim()
      const { data, error: fallo } = await supabase.rpc("mis_clientas", {
        p_buscar: termino.length >= 2 ? termino : null,
      })
      if (!activo) return
      if (fallo) {
        setError(true)
      } else {
        setError(false)
        setClientas(
          ((data ?? []) as Clienta[]).map((c) => ({ ...c, visitas: Number(c.visitas) })),
        )
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
      <p className="text-[10.5px] tracking-[0.2em] text-gold-deep uppercase dark:text-gold">Mis clientas</p>
      <h1 className="aura-display mb-4 text-[24px] leading-tight">Clientas que he atendido</h1>

      <div className="relative mb-4">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar por nombre…"
          aria-label="Buscar clienta por nombre"
          className="h-11 rounded-xl pl-9"
        />
      </div>

      {cargando ? (
        <div className="flex flex-col gap-2" aria-busy>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[68px] rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-status-cancelled/30 bg-status-cancelled-bg/60 p-5 text-center">
          <p className="text-[13.5px] text-status-cancelled">No se pudieron cargar tus clientas.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </Button>
        </div>
      ) : clientas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <Users className="size-7 text-muted-foreground/60" strokeWidth={1.5} />
          <p className="text-[13.5px] text-muted-foreground">
            {buscar.trim() ? "Ninguna clienta coincide con esa búsqueda." : "Aún no tienes clientas registradas."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {clientas.map((c) => {
            const nombre = c.nombre?.trim() || "Clienta sin nombre"
            const tieneNotas = !!c.notas?.trim()
            const desplegada = abierta === c.id
            return (
              <li key={c.id} className="rounded-2xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setAbierta(desplegada ? null : c.id)}
                  aria-expanded={desplegada}
                  disabled={!tieneNotas}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none disabled:cursor-default"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-medium">{nombre}</span>
                    <span className="block text-[12px] text-muted-foreground">
                      {c.visitas} {c.visitas === 1 ? "visita" : "visitas"}
                      {c.ultima_visita ? ` · última el ${fechaCorta(c.ultima_visita)}` : ""}
                    </span>
                  </span>
                  {tieneNotas ? (
                    <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 text-[10px] tracking-[0.08em] text-gold-deep uppercase dark:text-gold">
                      Notas
                    </span>
                  ) : null}
                </button>
                {desplegada && tieneNotas ? (
                  <p className="border-t border-border px-4 py-3 text-[13px] leading-snug whitespace-pre-line text-muted-foreground">
                    {c.notas}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
