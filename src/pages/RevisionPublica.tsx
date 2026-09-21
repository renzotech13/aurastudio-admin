import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import { Check, ChevronDown, ExternalLink } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { GUIAS_REVISION, type GuiaRevision } from "@/data/guiasRevision"
import type { RespuestasRevision } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

/**
 * Formulario público para que alguien del salón revise las guías desde el
 * celular, sin cuenta ni contraseña: entra con un enlace que lleva un token
 * (/revision/<token>) y cada guía se envía por separado con el RPC
 * `enviar_revision_guia` (migración 0019). Lo enviado aparece en el panel,
 * en «Revisión de guías».
 *
 * Los borradores se guardan en el propio teléfono (localStorage): si se
 * cierra el navegador a medias, no se pierde lo escrito.
 */

type Estado = "ok" | "corregir" | null
type Borrador = { preguntas: string[]; estados: Estado[]; correcciones: string[]; comentario: string }

const CLAVE_NOMBRE = "revision-guias:nombre"
const claveBorrador = (slug: string) => `revision-guias:borrador:${slug}`
const claveEnviada = (slug: string) => `revision-guias:enviada:${slug}`

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}
function guardar(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    /* modo privado o almacenamiento bloqueado: se sigue sin borrador */
  }
}

function borradorVacio(g: GuiaRevision): Borrador {
  return {
    preguntas: g.preguntas.map(() => ""),
    estados: g.afirmaciones.map(() => null),
    correcciones: g.afirmaciones.map(() => ""),
    comentario: "",
  }
}

function cargarBorrador(g: GuiaRevision): Borrador {
  const base = borradorVacio(g)
  const crudo = leer(claveBorrador(g.slug))
  if (!crudo) return base
  try {
    const b = JSON.parse(crudo) as Partial<Borrador>
    // Si la guía cambió de tamaño desde que se guardó, se descarta: mezclar respuestas de otro texto sería peor que empezar de cero.
    if (b.preguntas?.length !== base.preguntas.length || b.estados?.length !== base.estados.length) return base
    return { ...base, ...b } as Borrador
  } catch {
    return base
  }
}

function contarRespondido(b: Borrador): number {
  return b.preguntas.filter((p) => p.trim()).length + b.estados.filter(Boolean).length + (b.comentario.trim() ? 1 : 0)
}

function mensajeDeError(msg: string): string {
  if (msg.includes("enlace_invalido")) return "Este enlace no es válido o ya venció. Pide uno nuevo."
  if (msg.includes("demasiados_envios")) return "Se enviaron muchas respuestas seguidas. Espera un rato e inténtalo de nuevo."
  if (msg.includes("revisor_invalido")) return "Escribe tu nombre arriba antes de enviar."
  return "No se pudo enviar. Revisa tu conexión e inténtalo otra vez."
}

function GuiaLeida({ g }: { g: GuiaRevision }) {
  const t = g.guia
  return (
    <div className="space-y-3 rounded-xl bg-muted/60 p-3.5 text-[13px] leading-relaxed">
      <p className="aura-display text-base">{t.titulo}</p>
      <p>{t.intro}</p>
      <p className="text-xs text-muted-foreground">{t.datos.join("  ·  ")}</p>
      {t.pasos.map((p, i) => (
        <div key={p.titulo}>
          <p className="font-medium">
            {i + 1}. {p.titulo}
          </p>
          {p.parrafos.map((x) => (
            <p key={x} className="mt-0.5">
              {x}
            </p>
          ))}
          {p.familias.length > 0 && <p className="mt-0.5 text-muted-foreground">{p.familias.join("  |  ")}</p>}
          {p.items.map((x) => (
            <p key={x} className="mt-0.5 pl-3">
              • {x}
            </p>
          ))}
          {p.tip && <p className="mt-1 border-l-2 border-gold pl-2.5 text-muted-foreground">{p.tip}</p>}
        </div>
      ))}
      <p className="font-medium">Lleva esto</p>
      {t.lista.map((x) => (
        <p key={x} className="pl-3">
          • {x}
        </p>
      ))}
      <p className="text-muted-foreground">{t.cierre}</p>
      {t.nota && <p className="text-xs text-muted-foreground">{t.nota}</p>}
    </div>
  )
}

function TarjetaGuia({
  g,
  numero,
  token,
  nombre,
  onEnviada,
  enviadaAntes,
}: {
  g: GuiaRevision
  numero: number
  token: string
  nombre: string
  onEnviada: (slug: string) => void
  enviadaAntes: boolean
}) {
  const [b, setB] = useState<Borrador>(() => cargarBorrador(g))
  const [enviando, setEnviando] = useState(false)
  const [enviada, setEnviada] = useState(enviadaAntes)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  useEffect(() => {
    guardar(claveBorrador(g.slug), JSON.stringify(b))
  }, [b, g.slug])

  function cambiar(parcial: Partial<Borrador>) {
    setEnviada(false)
    setErrorEnvio(null)
    setB((prev) => ({ ...prev, ...parcial }))
  }

  const respondido = contarRespondido(b)

  async function enviar() {
    if (nombre.trim().length < 2) {
      setErrorEnvio("Escribe tu nombre arriba antes de enviar.")
      return
    }
    if (respondido === 0) {
      setErrorEnvio("Responde al menos una pregunta o marca una afirmación.")
      return
    }
    const respuestas: RespuestasRevision = {
      version: 1,
      preguntas: g.preguntas.map((texto, i) => ({ texto, respuesta: (b.preguntas[i] ?? "").trim() })).filter((p) => p.respuesta),
      afirmaciones: g.afirmaciones.flatMap((texto, i) => {
        const estado = b.estados[i]
        if (!estado) return []
        const correccion = (b.correcciones[i] ?? "").trim()
        return [{ texto, estado, ...(estado === "corregir" && correccion ? { correccion } : {}) }]
      }),
      ...(b.comentario.trim() ? { comentario: b.comentario.trim() } : {}),
    }

    setEnviando(true)
    setErrorEnvio(null)
    const { error } = await supabase.rpc("enviar_revision_guia", {
      p_token: token,
      p_guia: g.slug,
      p_revisor: nombre.trim(),
      p_respuestas: respuestas,
    })
    setEnviando(false)
    if (error) {
      setErrorEnvio(mensajeDeError(error.message))
      return
    }
    setEnviada(true)
    guardar(claveEnviada(g.slug), new Date().toISOString())
    onEnviada(g.slug)
    toast.success(`Guía «${g.nombre}» enviada. ¡Gracias!`)
  }

  return (
    <details className="group rounded-2xl border border-border bg-card open:shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="aura-display text-lg text-gold-deep dark:text-gold">{String(numero).padStart(2, "0")}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium leading-snug">{g.nombre}</span>
          <span className="block text-xs text-muted-foreground">
            {enviada ? "Enviada" : respondido > 0 ? `${respondido} respondida${respondido === 1 ? "" : "s"} · sin enviar` : `Puede confirmar: ${g.quien}`}
          </span>
        </span>
        {enviada && <Check className="size-5 shrink-0 text-emerald-600" aria-label="Enviada" />}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-6 border-t border-border/70 px-4 pb-5 pt-4">
        {g.preguntas.length > 0 && (
          <section className="space-y-4">
            <h3 className="aura-eyebrow">Datos que faltan</h3>
            {g.preguntas.map((q, i) => (
              <label key={q} className="block space-y-1.5">
                <span className="block text-sm leading-snug">{q}</span>
                <Textarea
                  value={b.preguntas[i] ?? ""}
                  onChange={(e) => cambiar({ preguntas: b.preguntas.map((v, j) => (j === i ? e.target.value : v)) })}
                  placeholder="Tu respuesta"
                  rows={2}
                />
              </label>
            ))}
          </section>
        )}

        <section className="space-y-4">
          <h3 className="aura-eyebrow">¿Está bien lo que dice la guía?</h3>
          {g.afirmaciones.map((a, i) => {
            const estado = b.estados[i] ?? null
            return (
              <div key={a} className="space-y-2">
                <p className="text-sm leading-snug">{a}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["ok", "corregir"] as const).map((opcion) => (
                    <button
                      key={opcion}
                      type="button"
                      aria-pressed={estado === opcion}
                      onClick={() =>
                        cambiar({ estados: b.estados.map((v, j) => (j === i ? (v === opcion ? null : opcion) : v)) })
                      }
                      className={cn(
                        "h-11 rounded-xl border text-sm font-medium transition-colors",
                        estado === opcion && opcion === "ok" && "border-emerald-600 bg-emerald-600 text-white",
                        estado === opcion && opcion === "corregir" && "border-amber-600 bg-amber-600 text-white",
                        estado !== opcion && "border-input bg-card hover:border-gold/60",
                      )}
                    >
                      {opcion === "ok" ? "Está bien" : "Corregir"}
                    </button>
                  ))}
                </div>
                {estado === "corregir" && (
                  <Input
                    value={b.correcciones[i] ?? ""}
                    onChange={(e) => cambiar({ correcciones: b.correcciones.map((v, j) => (j === i ? e.target.value : v)) })}
                    placeholder="¿Cómo debe decir?"
                    aria-label={`Corrección de: ${a}`}
                  />
                )}
              </div>
            )
          })}
        </section>

        <label className="block space-y-1.5">
          <span className="aura-eyebrow block">Algo más que quieras agregar</span>
          <Textarea value={b.comentario} onChange={(e) => cambiar({ comentario: e.target.value })} placeholder="Opcional" rows={2} />
        </label>

        <details className="rounded-xl border border-border/70 px-3.5 py-2.5">
          <summary className="cursor-pointer text-sm text-muted-foreground">Leer la guía completa</summary>
          <div className="mt-3">
            <GuiaLeida g={g} />
            {g.publicada && (
              <a
                href={`https://aurastudio.pe/guias/${g.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-gold-deep underline-offset-4 hover:underline dark:text-gold"
              >
                Abrirla como la ve la clienta <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </details>

        {errorEnvio && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
            {errorEnvio}
          </p>
        )}
        <Button type="button" variant="gold" size="lg" className="h-12 w-full text-base" disabled={enviando} onClick={enviar}>
          {enviando ? "Enviando…" : enviada ? "Enviada ✓ · Enviar de nuevo" : "Enviar esta guía"}
        </Button>
      </div>
    </details>
  )
}

export default function RevisionPublica() {
  const { token = "" } = useParams()
  const [nombre, setNombre] = useState(() => leer(CLAVE_NOMBRE) ?? "")
  const [enviadas, setEnviadas] = useState<Set<string>>(
    () => new Set(GUIAS_REVISION.filter((g) => leer(claveEnviada(g.slug))).map((g) => g.slug)),
  )

  useEffect(() => {
    // Página privada: que no la indexe ningún buscador.
    const meta = document.createElement("meta")
    meta.name = "robots"
    meta.content = "noindex, nofollow"
    document.head.appendChild(meta)
    const titulo = document.title
    document.title = "Revisión de guías · Aura Studio"
    return () => {
      document.head.removeChild(meta)
      document.title = titulo
    }
  }, [])

  useEffect(() => {
    guardar(CLAVE_NOMBRE, nombre)
  }, [nombre])

  const progreso = useMemo(() => `${enviadas.size} de ${GUIAS_REVISION.length} enviadas`, [enviadas])

  return (
    <main className="mx-auto min-h-svh w-full max-w-xl bg-background px-4 pb-20 pt-7 text-foreground">
      <header className="mb-6">
        <p className="aura-eyebrow mb-2 flex items-center gap-2">
          <span className="aura-diamond" aria-hidden />
          Aura Studio
        </p>
        <h1 className="aura-display text-[28px] leading-tight">Revisión de guías</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Aura va a compartir guías gratuitas por cada servicio. Antes de publicarlas necesitamos que alguien que trabaja en el salón confirme que lo
          que dicen es correcto. Abre las que conozcas, responde lo que puedas y toca «Enviar». No hace falta responder todo.
        </p>
      </header>

      <label className="mb-5 block space-y-1.5">
        <span className="aura-eyebrow block">Tu nombre</span>
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y, si quieres, tu especialidad" maxLength={80} autoComplete="name" />
      </label>

      <p className="mb-3 text-xs text-muted-foreground">{progreso} · lo que escribes se guarda en este teléfono</p>

      <div className="space-y-3">
        {GUIAS_REVISION.map((g, i) => (
          <TarjetaGuia
            key={g.slug}
            g={g}
            numero={i + 1}
            token={token}
            nombre={nombre}
            enviadaAntes={enviadas.has(g.slug)}
            onEnviada={(slug) => setEnviadas((prev) => new Set(prev).add(slug))}
          />
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">Gracias por tu tiempo.</p>
    </main>
  )
}
