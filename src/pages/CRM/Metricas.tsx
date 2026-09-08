import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { fechaCorta, numero } from "@/lib/format"
import { CANAL_LABEL } from "@/lib/canales"
import { CANALES, ETAPA_LABEL, ETAPAS, type Canal, type Etapa } from "@/lib/types"
import { PageHeader } from "@/components/PageHeader"
import { Segmented } from "@/components/Segmented"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChartFrame,
  Cifra,
  Columnas,
  Dona,
  Leyenda,
  LineaArea,
  Ranking,
  SinDatos,
  TablaDatos,
  serieColor,
} from "@/components/charts"
import { SelectorRango } from "../Caja/SelectorRango"
import { resolverRango, variacion, type RangoId } from "../Caja/rango"

type Pestana = "atencion" | "contenido"

const CANAL_CHART_COLOR: Record<Canal, string> = {
  whatsapp: serieColor(0),
  messenger: serieColor(1),
  instagram: serieColor(2),
}

/** El embudo no usa colores de estado salvo "cerrado", que sí significa que el lead salió del embudo. */
const ETAPA_COLOR: Record<Etapa, string> = {
  nuevo: serieColor(0),
  en_atencion: serieColor(1),
  calificado: serieColor(2),
  agendado: serieColor(3),
  cerrado: "var(--status-cancelled)",
}

function minutos(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—"
  if (n < 60) return `${Math.round(n)} min`
  return `${(n / 60).toFixed(1)} h`
}

/* ---------------------------------------------------------------------- */
/* Pestaña Atención                                                        */
/* ---------------------------------------------------------------------- */

type MetricasBandeja = {
  total: number
  por_canal: { canal: Canal; conversaciones: number; dm: number; comentario: number; mensajes_entrantes: number }[]
  etapas: Partial<Record<Etapa, number>>
  primera_respuesta: { bot_min: number | null; humana_min: number | null }
  pct_respondidas_15min: number | null
  por_agente: { agente_id: string; nombre: string | null; asignadas: number; respondidas: number; mediana_respuesta_min: number | null }[]
  comentarios: { recibidos: number; respondidos_publico: number; respondidos_privado: number }
  sin_responder_ahora: number
}

function PestanaAtencion() {
  const [rangoId, setRangoId] = useState<RangoId>("7d")
  const rango = useMemo(() => resolverRango(rangoId), [rangoId])
  const [datos, setDatos] = useState<MetricasBandeja | null>(null)
  const [porDia, setPorDia] = useState<{ dia: string; valores: number[] }[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    setCargando(true)

    Promise.all([
      supabase.rpc("metricas_bandeja", { p_desde: rango.desde, p_hasta: rango.hasta }),
      supabase.from("conversaciones_resumen").select("canal, created_at").gte("created_at", rango.desde).lt("created_at", rango.hasta),
    ]).then(([rpc, conv]) => {
      if (!vigente) return
      if (rpc.error || conv.error) {
        toast.error("No se pudieron cargar las métricas de atención.")
      } else {
        setDatos(rpc.data as MetricasBandeja)
        const mapa = new Map(rango.dias.map((d) => [d, CANALES.map(() => 0)]))
        for (const c of (conv.data ?? []) as { canal: Canal; created_at: string }[]) {
          const dia = c.created_at.slice(0, 10)
          const fila = mapa.get(dia)
          if (!fila) continue
          const i = CANALES.indexOf(c.canal)
          if (i >= 0) fila[i] += 1
        }
        setPorDia(rango.dias.map((d) => ({ dia: d, valores: mapa.get(d)! })))
      }
      setCargando(false)
    })

    return () => {
      vigente = false
    }
  }, [rango])

  const etapasDona = ETAPAS.map((e) => ({ nombre: ETAPA_LABEL[e], valor: datos?.etapas[e] ?? 0, color: ETAPA_COLOR[e] }))

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <SelectorRango valor={rangoId} onChange={setRangoId} />
        <span className="text-[11.5px] text-muted-foreground">
          {fechaCorta(rango.desde)} — {fechaCorta(rango.dias[rango.dias.length - 1])}
        </span>
      </div>

      {cargando ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[124px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Cifra destacada etiqueta="Leads nuevos" valor={numero(datos?.total ?? 0)} deltaEtiqueta="conversaciones creadas en el rango" />
          <Cifra etiqueta="1ra respuesta del bot" valor={minutos(datos?.primera_respuesta.bot_min)} deltaEtiqueta="mediana" />
          <Cifra etiqueta="1ra respuesta humana" valor={minutos(datos?.primera_respuesta.humana_min)} deltaEtiqueta="mediana" />
          <Cifra
            etiqueta="Respondidas en <15 min"
            valor={datos?.pct_respondidas_15min !== null && datos?.pct_respondidas_15min !== undefined ? `${datos.pct_respondidas_15min}%` : "—"}
            deltaEtiqueta={`${numero(datos?.sin_responder_ahora ?? 0)} sin responder ahora mismo`}
          />
        </div>
      )}

      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <Card crest className="xl:col-span-2">
          <CardContent>
            <ChartFrame
              titulo="Conversaciones por día y canal"
              leyenda={<Leyenda series={CANALES.map((c) => ({ nombre: CANAL_LABEL[c], color: CANAL_CHART_COLOR[c] }))} />}
              tabla={
                <TablaDatos
                  columnas={["Día", ...CANALES.map((c) => CANAL_LABEL[c])]}
                  filas={porDia.map((d) => [fechaCorta(`${d.dia}T12:00:00Z`), ...d.valores])}
                />
              }
            >
              <Columnas
                apiladas
                puntos={porDia.map((d) => ({ x: fechaCorta(`${d.dia}T12:00:00Z`), valores: d.valores }))}
                series={CANALES.map((c) => ({ nombre: CANAL_LABEL[c], color: CANAL_CHART_COLOR[c] }))}
                formato={(n) => numero(Math.round(n))}
                alto={250}
              />
            </ChartFrame>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <ChartFrame
              titulo="Embudo por etapa"
              tabla={<TablaDatos columnas={["Etapa", "Conversaciones"]} filas={etapasDona.map((e) => [e.nombre, e.valor])} />}
            >
              <Dona segmentos={etapasDona} formato={numero} centroEtiqueta={numero(datos?.total ?? 0)} />
            </ChartFrame>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent>
            <ChartFrame
              titulo="Ranking por agente"
              descripcion="Conversaciones respondidas por una persona, sobre las asignadas."
              tabla={
                <TablaDatos
                  columnas={["Agente", "Asignadas", "Respondidas", "Mediana"]}
                  filas={(datos?.por_agente ?? []).map((a) => [a.nombre ?? "Sin nombre", a.asignadas, a.respondidas, minutos(a.mediana_respuesta_min)])}
                />
              }
            >
              <Ranking
                filas={(datos?.por_agente ?? []).map((a) => ({
                  etiqueta: a.nombre ?? "Sin nombre",
                  valor: a.respondidas,
                  detalle: `${a.asignadas} asignadas`,
                }))}
                formato={numero}
                color={serieColor(0)}
              />
            </ChartFrame>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <ChartFrame titulo="Comentarios" descripcion="De publicaciones de Facebook e Instagram, en el rango.">
              <div className="grid grid-cols-3 gap-3 py-2">
                <div className="text-center">
                  <div className="text-[24px] font-medium text-foreground">{numero(datos?.comentarios.recibidos ?? 0)}</div>
                  <div className="mt-1 text-[11px] tracking-[0.08em] text-muted-foreground uppercase">Recibidos</div>
                </div>
                <div className="text-center">
                  <div className="text-[24px] font-medium text-foreground">{numero(datos?.comentarios.respondidos_publico ?? 0)}</div>
                  <div className="mt-1 text-[11px] tracking-[0.08em] text-muted-foreground uppercase">En público</div>
                </div>
                <div className="text-center">
                  <div className="text-[24px] font-medium text-foreground">{numero(datos?.comentarios.respondidos_privado ?? 0)}</div>
                  <div className="mt-1 text-[11px] tracking-[0.08em] text-muted-foreground uppercase">En privado</div>
                </div>
              </div>
            </ChartFrame>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

/* ---------------------------------------------------------------------- */
/* Pestaña Contenido                                                        */
/* ---------------------------------------------------------------------- */

type MetricaContenidoFila = {
  canal: "facebook" | "instagram"
  fecha: string
  alcance: number | null
  impresiones: number | null
  interacciones: number | null
  seguidores: number | null
  visitas_perfil: number | null
}

const CANAL_CONTENIDO_LABEL: Record<"facebook" | "instagram", string> = { facebook: "Facebook", instagram: "Instagram" }
const CANAL_CONTENIDO_COLOR: Record<"facebook" | "instagram", string> = { facebook: serieColor(0), instagram: serieColor(1) }

function PestanaContenido() {
  const [filas, setFilas] = useState<MetricaContenidoFila[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    supabase
      .from("metricas_contenido_diarias")
      .select("canal, fecha, alcance, impresiones, interacciones, seguidores, visitas_perfil")
      .order("fecha")
      .then(({ data, error }) => {
        if (!vigente) return
        if (error) toast.error("No se pudieron cargar las métricas de contenido.")
        else setFilas((data as MetricaContenidoFila[]) ?? [])
        setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [])

  const fechas = useMemo(() => Array.from(new Set(filas.map((f) => f.fecha))).sort(), [filas])
  const porCanal = useMemo(() => {
    const mapa: Record<"facebook" | "instagram", Map<string, MetricaContenidoFila>> = { facebook: new Map(), instagram: new Map() }
    for (const f of filas) mapa[f.canal].set(f.fecha, f)
    return mapa
  }, [filas])

  const ultimaFecha = fechas.at(-1)
  const penultimaFecha = fechas.at(-2)
  const seguidoresHoy = ultimaFecha
    ? (porCanal.facebook.get(ultimaFecha)?.seguidores ?? 0) + (porCanal.instagram.get(ultimaFecha)?.seguidores ?? 0)
    : 0
  const seguidoresAyer = penultimaFecha
    ? (porCanal.facebook.get(penultimaFecha)?.seguidores ?? 0) + (porCanal.instagram.get(penultimaFecha)?.seguidores ?? 0)
    : 0

  const ultimos7 = fechas.slice(-7)
  const alcance7dias = ultimos7.reduce(
    (acc, f) => acc + (porCanal.facebook.get(f)?.alcance ?? 0) + (porCanal.instagram.get(f)?.alcance ?? 0),
    0,
  )
  const visitas7dias = ultimos7.reduce((acc, f) => acc + (porCanal.instagram.get(f)?.visitas_perfil ?? 0), 0)

  // Seguidores no viene todos los días si un barrido falló: se arrastra el
  // último valor conocido para que la línea no caiga a cero por un hueco.
  function serieSeguidores(canal: "facebook" | "instagram"): number[] {
    let ultimo = 0
    return fechas.map((f) => {
      const v = porCanal[canal].get(f)?.seguidores
      if (v !== null && v !== undefined) ultimo = v
      return ultimo
    })
  }

  if (cargando) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[124px] rounded-2xl" />
        ))}
      </div>
    )
  }

  if (fechas.length === 0) {
    return (
      <Card>
        <CardContent>
          <SinDatos
            alto={220}
            mensaje="Todavía no hay datos de contenido — recién se prendió el canal, o el barrido diario no corrió ni una vez. La primera foto puede tardar hasta 24 h en aparecer."
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Cifra
          destacada
          etiqueta="Seguidores (hoy)"
          valor={numero(seguidoresHoy)}
          delta={penultimaFecha ? variacion(seguidoresHoy, seguidoresAyer) : null}
          deltaEtiqueta="vs. ayer"
        />
        <Cifra etiqueta="Alcance (7 días)" valor={numero(alcance7dias)} deltaEtiqueta="Facebook + Instagram" />
        <Cifra etiqueta="Visitas al perfil de Instagram (7 días)" valor={numero(visitas7dias)} />
      </div>

      <div className="mb-6">
        <Card crest>
          <CardContent>
            <ChartFrame
              titulo="Seguidores en el tiempo"
              leyenda={<Leyenda series={(["facebook", "instagram"] as const).map((c) => ({ nombre: CANAL_CONTENIDO_LABEL[c], color: CANAL_CONTENIDO_COLOR[c] }))} />}
              tabla={
                <TablaDatos
                  columnas={["Día", "Facebook", "Instagram"]}
                  filas={fechas.map((f, i) => [fechaCorta(`${f}T12:00:00Z`), serieSeguidores("facebook")[i], serieSeguidores("instagram")[i]])}
                />
              }
            >
              <LineaArea
                puntos={fechas.map((f, i) => ({
                  x: fechaCorta(`${f}T12:00:00Z`),
                  valores: [serieSeguidores("facebook")[i], serieSeguidores("instagram")[i]],
                }))}
                series={(["facebook", "instagram"] as const).map((c) => ({ nombre: CANAL_CONTENIDO_LABEL[c], color: CANAL_CONTENIDO_COLOR[c] }))}
                formato={numero}
                alto={260}
              />
            </ChartFrame>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent>
            <ChartFrame
              titulo="Alcance por día y canal"
              leyenda={<Leyenda series={(["facebook", "instagram"] as const).map((c) => ({ nombre: CANAL_CONTENIDO_LABEL[c], color: CANAL_CONTENIDO_COLOR[c] }))} />}
            >
              <Columnas
                puntos={fechas.map((f) => ({
                  x: fechaCorta(`${f}T12:00:00Z`),
                  valores: [porCanal.facebook.get(f)?.alcance ?? 0, porCanal.instagram.get(f)?.alcance ?? 0],
                }))}
                series={(["facebook", "instagram"] as const).map((c) => ({ nombre: CANAL_CONTENIDO_LABEL[c], color: CANAL_CONTENIDO_COLOR[c] }))}
                formato={numero}
                alto={230}
              />
            </ChartFrame>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <ChartFrame
              titulo="Impresiones por día y canal"
              leyenda={<Leyenda series={(["facebook", "instagram"] as const).map((c) => ({ nombre: CANAL_CONTENIDO_LABEL[c], color: CANAL_CONTENIDO_COLOR[c] }))} />}
            >
              <Columnas
                puntos={fechas.map((f) => ({
                  x: fechaCorta(`${f}T12:00:00Z`),
                  valores: [porCanal.facebook.get(f)?.impresiones ?? 0, porCanal.instagram.get(f)?.impresiones ?? 0],
                }))}
                series={(["facebook", "instagram"] as const).map((c) => ({ nombre: CANAL_CONTENIDO_LABEL[c], color: CANAL_CONTENIDO_COLOR[c] }))}
                formato={numero}
                alto={230}
              />
            </ChartFrame>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

/* ---------------------------------------------------------------------- */

export default function Metricas() {
  const [pestana, setPestana] = useState<Pestana>("atencion")

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
      <PageHeader
        eyebrow="Operación"
        titulo="Métricas"
        descripcion="Qué tan rápido respondemos, y qué tan lejos llega lo que publicamos."
      />

      <div className="mb-6">
        <Segmented
          opciones={[
            { id: "atencion", label: "Atención" },
            { id: "contenido", label: "Contenido" },
          ]}
          valor={pestana}
          onChange={setPestana}
          etiquetaAria="Tipo de métrica"
        />
      </div>

      {pestana === "atencion" ? <PestanaAtencion /> : <PestanaContenido />}
    </div>
  )
}
