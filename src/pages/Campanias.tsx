import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { BellRing, CheckCircle2, Clock3, Megaphone, RefreshCw, Send, TriangleAlert, XCircle } from "lucide-react"

import {
  BotApiError,
  crearPlantillaCampania,
  enviarCampania,
  listarCampanias,
  type EstadoPlantillaMeta,
  type PlantillaCampania,
} from "@/lib/botApi"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/PageHeader"

/**
 * Campañas de WhatsApp con plantillas de Meta (como en el panel de B&B). Las plantillas viven en el código del bot
 * (bot/src/campanias/plantillas.ts): aquí se ve su estado en Meta, se mandan a aprobar con un botón, se prueban en un
 * número y se envían por lotes de 25 a su audiencia. Nada sale solo, y a nadie se le repite la misma plantilla.
 */

const LOTE = 25

const ESTADO: Record<NonNullable<EstadoPlantillaMeta> | "sin_crear", { texto: string; clase: string; Icono: typeof CheckCircle2 }> = {
  APPROVED: { texto: "Aprobada", clase: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400", Icono: CheckCircle2 },
  PENDING: { texto: "En revisión de Meta", clase: "bg-amber-500/12 text-amber-700 dark:text-amber-400", Icono: Clock3 },
  REJECTED: { texto: "Rechazada", clase: "bg-destructive/10 text-destructive", Icono: XCircle },
  PAUSED: { texto: "Pausada por Meta", clase: "bg-amber-500/12 text-amber-700 dark:text-amber-400", Icono: TriangleAlert },
  DISABLED: { texto: "Desactivada", clase: "bg-destructive/10 text-destructive", Icono: XCircle },
  sin_crear: { texto: "Sin crear en Meta", clase: "bg-muted text-muted-foreground", Icono: Clock3 },
}

function mensajeDe(err: unknown): string {
  return err instanceof BotApiError ? err.message : "No se pudo completar la acción."
}

/** El cuerpo como lo verá la clienta, con «Lucía» en lugar de la variable del nombre. */
function vistaPrevia(p: PlantillaCampania): string {
  const ejemplo = p.automatica ? ["Lucía", "Pestañas 1x1", "sábado 17 de octubre a las 11:00 a. m."] : ["Lucía"]
  return p.cuerpo.replace(/\{\{(\d+)\}\}/g, (_, n: string) => ejemplo[Number(n) - 1] ?? `{{${n}}}`)
}

function TarjetaCampania({ p, alCambiar }: { p: PlantillaCampania; alCambiar: () => void }) {
  const [creando, setCreando] = useState(false)
  const [probando, setProbando] = useState(false)
  const [telefono, setTelefono] = useState("")
  const [confirmar, setConfirmar] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const estado = ESTADO[p.estado ?? "sin_crear"]
  const aprobada = p.estado === "APPROVED"
  const tamLote = Math.min(LOTE, p.alcanza)

  async function crear() {
    setCreando(true)
    try {
      const r = await crearPlantillaCampania(p.clave)
      toast.success(r.creada ? "Enviada a Meta. La aprobación tarda de minutos a unas horas." : `Ya existía en Meta (${r.estado}).`)
      alCambiar()
    } catch (err) {
      toast.error(mensajeDe(err))
    } finally {
      setCreando(false)
    }
  }

  async function probar() {
    if (!telefono.trim()) return void toast.error("Escribe el número donde quieres recibir la prueba.")
    setProbando(true)
    try {
      const r = await enviarCampania({ clave: p.clave, telefonos: [telefono.trim()] })
      if (r.enviados > 0) toast.success("Prueba enviada. Revisa ese WhatsApp.")
      else toast.error(r.fallidos[0]?.motivo ?? "No salió la prueba.")
    } catch (err) {
      toast.error(mensajeDe(err))
    } finally {
      setProbando(false)
    }
  }

  async function enviarLote() {
    setEnviando(true)
    try {
      const r = await enviarCampania({ clave: p.clave, limite: LOTE })
      const extra = r.fallidos.length ? ` · ${r.fallidos.length} no salieron` : ""
      toast.success(`Enviados ${r.enviados}${extra}. Quedan ${r.quedan} por enviar.`)
      if (r.fallidos.length) console.warn("Envíos fallidos de la campaña", r.fallidos)
      alCambiar()
    } catch (err) {
      toast.error(mensajeDe(err))
    } finally {
      setEnviando(false)
      setConfirmar(false)
    }
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-medium">{p.titulo}</h2>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {p.nombre} · {p.categoria === "UTILITY" ? "Utilidad" : "Marketing"}
          </p>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", estado.clase)}>
          <estado.Icono className="size-3.5" />
          {estado.texto}
        </span>
      </header>

      <p className="mt-2 max-w-[70ch] text-[13px] text-muted-foreground">{p.descripcion}</p>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Vista previa como burbuja de WhatsApp */}
        <div className="rounded-xl bg-muted/50 p-3">
          <div className="max-w-[340px] rounded-xl rounded-tl-sm bg-card px-3 py-2.5 shadow-sm">
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{vistaPrevia(p)}</p>
            {p.pie && <p className="mt-1.5 text-[11px] text-muted-foreground">{p.pie}</p>}
          </div>
          {p.botones.length > 0 && (
            <div className="mt-1 flex max-w-[340px] flex-col gap-1">
              {p.botones.map((b) => (
                <span key={b} className="rounded-lg bg-card px-3 py-1.5 text-center text-[13px] text-sky-700 shadow-sm dark:text-sky-400">
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {p.estado === null && (
            <div>
              <Button type="button" variant="gold" onClick={crear} disabled={creando}>
                <Megaphone />
                {creando ? "Enviando…" : "Mandar a Meta para aprobar"}
              </Button>
              <p className="mt-1.5 text-xs text-muted-foreground">Meta la revisa en minutos u horas. Aquí verás cuándo queda aprobada.</p>
            </div>
          )}
          {p.estado === "REJECTED" && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
              Meta la rechazó. Hay que cambiar el texto en el código del bot con otro nombre y volver a mandarla.
            </p>
          )}

          {p.automatica ? (
            <p className="flex items-start gap-2 text-[13px]">
              <BellRing className="mt-0.5 size-4 shrink-0 text-gold-deep dark:text-gold" />
              La manda el bot sola. Aquí solo se puede probar.
            </p>
          ) : (
            <section>
              <h3 className="aura-eyebrow">Audiencia</h3>
              <p className="mt-1.5 text-[13px]">
                <span className="aura-display text-2xl tabular-nums">{p.alcanza}</span>{" "}
                <span className="text-muted-foreground">
                  le{p.alcanza === 1 ? "" : "s"} llega{p.alcanza === 1 ? "" : "n"} de {p.revisadas} revisadas
                </span>
              </p>
              {p.excluidas.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                  {p.excluidas.map((e) => (
                    <li key={e.motivo}>
                      {e.motivo}: <span className="tabular-nums">{e.cantidad}</span>
                    </li>
                  ))}
                </ul>
              )}
              {p.muestra.length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Ver a quiénes (primeras {p.muestra.length})</summary>
                  <ul className="mt-1.5 columns-2 gap-4">
                    {p.muestra.map((m) => (
                      <li key={m.telefono} className="truncate">
                        {m.nombre ?? "Sin nombre"} · <span className="tabular-nums text-muted-foreground">{m.telefono}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}

          <section>
            <h3 className="aura-eyebrow">Probar en un número</h3>
            <div className="mt-1.5 flex gap-2">
              <Input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="999 888 777"
                inputMode="tel"
                className="max-w-[180px]"
                aria-label="Número para la prueba"
              />
              <Button type="button" variant="outline" onClick={probar} disabled={!aprobada || probando}>
                <Send />
                {probando ? "Enviando…" : "Enviar prueba"}
              </Button>
            </div>
            {!aprobada && <p className="mt-1 text-xs text-muted-foreground">Se puede probar cuando Meta la apruebe.</p>}
          </section>

          {!p.automatica && (
            <section>
              <h3 className="aura-eyebrow">Enviar</h3>
              {p.fueraDeFecha ? (
                <p className="mt-1.5 text-[13px] text-muted-foreground">{p.fueraDeFecha}</p>
              ) : !aprobada ? (
                <p className="mt-1.5 text-[13px] text-muted-foreground">Se puede enviar cuando Meta la apruebe.</p>
              ) : p.alcanza === 0 ? (
                <p className="mt-1.5 text-[13px] text-muted-foreground">No queda nadie a quién mandársela.</p>
              ) : !confirmar ? (
                <div className="mt-1.5">
                  <Button type="button" variant="gold" onClick={() => setConfirmar(true)}>
                    Enviar a {tamLote}
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">Por lotes de {LOTE}, para frenar a tiempo si alguien reclama.</p>
                </div>
              ) : (
                <div className="mt-1.5 rounded-lg border border-gold/50 p-3">
                  <p className="text-[13px]">
                    Le llegará a <b>{tamLote}</b> clientas por WhatsApp, a su nombre. Cada mensaje de marketing cuesta ~US$ 0.07 (gratis si
                    llegó por un anuncio en las últimas 72 h).
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button type="button" variant="gold" onClick={enviarLote} disabled={enviando}>
                      {enviando ? "Enviando… no cierres esta página" : `Sí, enviar a ${tamLote}`}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setConfirmar(false)} disabled={enviando}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </article>
  )
}

export default function Campanias() {
  const [plantillas, setPlantillas] = useState<PlantillaCampania[] | null>(null)
  const [metaDisponible, setMetaDisponible] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let activo = true
    listarCampanias()
      .then((r) => {
        if (!activo) return
        setPlantillas(r.plantillas)
        setMetaDisponible(r.metaDisponible)
        setError(null)
      })
      .catch((err) => {
        if (activo) setError(mensajeDe(err))
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [version])

  return (
    <div>
      <PageHeader
        eyebrow="Operación · WhatsApp"
        titulo="Campañas"
        descripcion="Plantillas de WhatsApp aprobadas por Meta para escribirle a clientas fuera de las 24 h: se mandan a aprobar, se prueban y se envían por lotes."
        acciones={
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCargando(true)
              recargar()
            }}
            disabled={cargando}
          >
            <RefreshCw className={cn(cargando && "animate-spin")} />
            Actualizar
          </Button>
        }
      />

      {!metaDisponible && (
        <p className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-[13px] text-amber-800 dark:text-amber-400">
          No se pudo leer el estado de las plantillas en Meta. Lo demás se muestra igual; vuelve a intentar en un momento.
        </p>
      )}

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>
      ) : !plantillas ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-4">
          {plantillas.map((p) => (
            <TarjetaCampania key={p.clave} p={p} alCambiar={recargar} />
          ))}
        </div>
      )}
    </div>
  )
}
