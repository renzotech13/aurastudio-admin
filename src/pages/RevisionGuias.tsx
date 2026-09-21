import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Check, ClipboardCopy, Link2, RotateCcw, Trash2 } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { GUIAS_REVISION } from "@/data/guiasRevision"
import type { GuiaRevisionFila, RevisionToken } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/PageHeader"
import { Segmented } from "@/components/Segmented"

/**
 * Respuestas del salón a la revisión de las guías gratuitas (migración 0019).
 * Llegan desde el formulario público /revision/<token>; acá se ordenan por
 * guía, se marcan como atendidas y se pueden copiar como texto para pegárselo
 * a quien vaya a corregir las guías.
 */

type Filtro = "pendientes" | "atendidas" | "todas"
const FILTROS = [
  { id: "pendientes", label: "Pendientes" },
  { id: "atendidas", label: "Atendidas" },
  { id: "todas", label: "Todas" },
] as const

const nombreGuia = (slug: string) => GUIAS_REVISION.find((g) => g.slug === slug)?.nombre ?? slug

function fecha(iso: string): string {
  return new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

function correccionesDe(f: GuiaRevisionFila) {
  return f.respuestas.afirmaciones.filter((a) => a.estado === "corregir")
}

function tokenAleatorio(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

/** Texto en Markdown con lo pendiente, agrupado por guía, listo para pegarlo en un chat. */
function resumenEnTexto(filas: GuiaRevisionFila[]): string {
  const porGuia = new Map<string, GuiaRevisionFila[]>()
  for (const f of filas) porGuia.set(f.guia, [...(porGuia.get(f.guia) ?? []), f])
  const orden = GUIAS_REVISION.map((g) => g.slug).filter((s) => porGuia.has(s))
  for (const s of porGuia.keys()) if (!orden.includes(s)) orden.push(s)

  const partes = ["# Revisión de guías de Aura Studio — respuestas del salón"]
  for (const slug of orden) {
    partes.push(`\n## ${nombreGuia(slug)}  (guía: ${slug})`)
    for (const f of porGuia.get(slug) ?? []) {
      const r = f.respuestas
      partes.push(`\n### ${f.revisor} · ${fecha(f.created_at)}`)
      if (r.preguntas.length) partes.push("**Datos:**", ...r.preguntas.map((p) => `- ${p.texto}\n  → ${p.respuesta}`))
      const cor = correccionesDe(f)
      if (cor.length) partes.push("**A corregir:**", ...cor.map((a) => `- «${a.texto}»\n  → ${a.correccion ?? "(sin texto: revisar con la persona)"}`))
      const bien = r.afirmaciones.filter((a) => a.estado === "ok").length
      if (bien) partes.push(`Confirmadas como correctas: ${bien}.`)
      if (r.comentario) partes.push(`**Comentario:** ${r.comentario}`)
    }
  }
  return partes.join("\n")
}

function Respuesta({ f, onCambio }: { f: GuiaRevisionFila; onCambio: () => void }) {
  const r = f.respuestas
  const cor = correccionesDe(f)
  const bien = r.afirmaciones.filter((a) => a.estado === "ok")

  async function alternarAtendida() {
    const { error } = await supabase.from("guia_revisiones").update({ atendida: !f.atendida }).eq("id", f.id)
    if (error) toast.error("No se pudo actualizar.")
    else onCambio()
  }
  async function eliminar() {
    if (!window.confirm("¿Eliminar esta respuesta? No se puede deshacer.")) return
    const { error } = await supabase.from("guia_revisiones").delete().eq("id", f.id)
    if (error) toast.error("No se pudo eliminar.")
    else onCambio()
  }

  return (
    <article className={cn("rounded-2xl border bg-card p-4", f.atendida ? "border-border/60 opacity-75" : "border-border")}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-medium leading-snug">{f.revisor}</p>
          <p className="text-xs text-muted-foreground">{fecha(f.created_at)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {cor.length > 0 && <Badge variant="destructive">{cor.length} por corregir</Badge>}
          {r.preguntas.length > 0 && <Badge variant="secondary">{r.preguntas.length} dato{r.preguntas.length === 1 ? "" : "s"}</Badge>}
          {bien.length > 0 && <Badge variant="outline">{bien.length} ok</Badge>}
          {f.atendida && <Badge variant="outline">Atendida</Badge>}
        </div>
      </header>

      {r.preguntas.length > 0 && (
        <section className="mt-3 space-y-2">
          <h4 className="aura-eyebrow">Datos</h4>
          {r.preguntas.map((p) => (
            <div key={p.texto} className="text-sm">
              <p className="text-muted-foreground">{p.texto}</p>
              <p className="mt-0.5 rounded-lg bg-muted/60 px-3 py-1.5">{p.respuesta}</p>
            </div>
          ))}
        </section>
      )}

      {cor.length > 0 && (
        <section className="mt-3 space-y-2">
          <h4 className="aura-eyebrow">A corregir</h4>
          {cor.map((a) => (
            <div key={a.texto} className="text-sm">
              <p className="text-muted-foreground">{a.texto}</p>
              <p className="mt-0.5 rounded-lg border-l-2 border-amber-600 bg-amber-500/10 px-3 py-1.5">
                {a.correccion ?? <span className="text-muted-foreground">(no escribió cómo debe decir)</span>}
              </p>
            </div>
          ))}
        </section>
      )}

      {bien.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Confirmadas como correctas ({bien.length})</summary>
          <ul className="mt-2 space-y-1 pl-4">
            {bien.map((a) => (
              <li key={a.texto} className="list-disc">
                {a.texto}
              </li>
            ))}
          </ul>
        </details>
      )}

      {r.comentario && (
        <section className="mt-3">
          <h4 className="aura-eyebrow">Comentario</h4>
          <p className="mt-1 text-sm">{r.comentario}</p>
        </section>
      )}

      <footer className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={f.atendida ? "outline" : "gold"} onClick={alternarAtendida}>
          {f.atendida ? <RotateCcw /> : <Check />}
          {f.atendida ? "Reabrir" : "Marcar atendida"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={eliminar}>
          <Trash2 />
          Eliminar
        </Button>
      </footer>
    </article>
  )
}

export default function RevisionGuias() {
  const [filas, setFilas] = useState<GuiaRevisionFila[]>([])
  const [tokens, setTokens] = useState<RevisionToken[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>("pendientes")
  const [guiaSel, setGuiaSel] = useState<string>("todas")

  const cargar = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from("guia_revisiones").select("*").order("created_at", { ascending: false }),
      supabase.from("revision_tokens").select("*").order("created_at", { ascending: false }),
    ])
    if (a.error || b.error) toast.error("No se pudo cargar la revisión. ¿Ya se aplicó la migración 0019?")
    else {
      setFilas(a.data as GuiaRevisionFila[])
      setTokens(b.data as RevisionToken[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line -- la carga inicial y la suscripción viven juntas a propósito
    cargar()
    const canal = supabase
      .channel("revision-guias")
      .on("postgres_changes", { event: "*", schema: "public", table: "guia_revisiones" }, () => cargar())
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [cargar])

  const tokenActivo = tokens.find((t) => t.activo)
  const enlace = tokenActivo ? `${window.location.origin}/revision/${tokenActivo.token}` : null

  async function copiar(texto: string, mensaje: string) {
    try {
      await navigator.clipboard.writeText(texto)
      toast.success(mensaje)
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto a mano.")
    }
  }

  async function generarEnlace() {
    if (tokenActivo) {
      const { error } = await supabase.from("revision_tokens").update({ activo: false }).eq("token", tokenActivo.token)
      if (error) return void toast.error("No se pudo desactivar el enlace anterior.")
    }
    const { error } = await supabase.from("revision_tokens").insert({ token: tokenAleatorio(), etiqueta: "Salón" })
    if (error) toast.error("No se pudo generar el enlace.")
    else {
      toast.success("Enlace nuevo generado. El anterior ya no funciona.")
      cargar()
    }
  }

  const visibles = useMemo(
    () =>
      filas.filter(
        (f) =>
          (filtro === "todas" || (filtro === "pendientes" ? !f.atendida : f.atendida)) && (guiaSel === "todas" || f.guia === guiaSel),
      ),
    [filas, filtro, guiaSel],
  )

  const pendientes = filas.filter((f) => !f.atendida)
  const resumen = useMemo(
    () =>
      GUIAS_REVISION.map((g) => {
        const propias = filas.filter((f) => f.guia === g.slug)
        return {
          slug: g.slug,
          nombre: g.nombre,
          total: propias.length,
          pendientes: propias.filter((f) => !f.atendida).length,
          correcciones: propias.filter((f) => !f.atendida).reduce((n, f) => n + correccionesDe(f).length, 0),
        }
      }),
    [filas],
  )

  const grupos = GUIAS_REVISION.map((g) => ({ g, items: visibles.filter((f) => f.guia === g.slug) })).filter((x) => x.items.length > 0)
  const otras = visibles.filter((f) => !GUIAS_REVISION.some((g) => g.slug === f.guia))

  return (
    <div>
      <PageHeader
        eyebrow="Contenido"
        titulo="Revisión de guías"
        descripcion="Lo que responde el salón sobre cada guía gratuita, ordenado por guía. Se llena desde el formulario del celular."
        acciones={
          <Button
            type="button"
            variant="outline"
            disabled={pendientes.length === 0}
            onClick={() => copiar(resumenEnTexto(pendientes), "Resumen copiado. Pégalo donde vayas a corregir las guías.")}
          >
            <ClipboardCopy />
            Copiar pendientes
          </Button>
        }
      />

      <section className="mb-6 rounded-2xl border border-border bg-card p-4">
        <h2 className="aura-eyebrow mb-2 flex items-center gap-2">
          <Link2 className="size-3.5" /> Enlace para el salón
        </h2>
        {loading ? (
          <Skeleton className="h-10 w-full" />
        ) : enlace ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-muted/60 px-3 py-2 text-xs">{enlace}</code>
            <Button type="button" size="sm" variant="gold" onClick={() => copiar(enlace, "Enlace copiado.")}>
              <ClipboardCopy />
              Copiar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={generarEnlace}>
              Generar otro
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">No hay un enlace activo.</p>
            <Button type="button" size="sm" variant="gold" onClick={generarEnlace}>
              Generar enlace
            </Button>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Quien tenga este enlace puede enviar respuestas, sin cuenta. «Generar otro» desactiva el actual.
        </p>
      </section>

      <section className="mb-6 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Guía</th>
              <th className="px-3 py-2.5 text-right font-medium">Respuestas</th>
              <th className="px-3 py-2.5 text-right font-medium">Pendientes</th>
              <th className="px-4 py-2.5 text-right font-medium">Por corregir</th>
            </tr>
          </thead>
          <tbody>
            {resumen.map((r) => (
              <tr
                key={r.slug}
                className={cn("cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/40", guiaSel === r.slug && "bg-muted/60")}
                onClick={() => setGuiaSel(guiaSel === r.slug ? "todas" : r.slug)}
              >
                <td className="px-4 py-2">{r.nombre}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.total}</td>
                <td className={cn("px-3 py-2 text-right tabular-nums", r.pendientes > 0 && "font-medium")}>{r.pendientes}</td>
                <td className={cn("px-4 py-2 text-right tabular-nums", r.correcciones > 0 && "font-medium text-amber-700 dark:text-amber-500")}>
                  {r.correcciones}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented opciones={FILTROS} valor={filtro} onChange={setFiltro} etiquetaAria="Estado de las respuestas" />
        {guiaSel !== "todas" && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setGuiaSel("todas")}>
            Quitar filtro: {nombreGuia(guiaSel)} ✕
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : visibles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {filas.length === 0 ? "Todavía no llegó ninguna respuesta. Comparte el enlace de arriba con el salón." : "No hay respuestas con este filtro."}
        </p>
      ) : (
        <div className="space-y-8">
          {grupos.map(({ g, items }) => (
            <section key={g.slug} className="space-y-3">
              <h2 className="aura-display text-lg">
                {g.nombre} <span className="text-sm text-muted-foreground">· {items.length}</span>
              </h2>
              {items.map((f) => (
                <Respuesta key={f.id} f={f} onCambio={cargar} />
              ))}
            </section>
          ))}
          {otras.length > 0 && (
            <section className="space-y-3">
              <h2 className="aura-display text-lg">Otras guías</h2>
              {otras.map((f) => (
                <Respuesta key={f.id} f={f} onCambio={cargar} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
