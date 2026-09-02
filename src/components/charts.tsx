/* ==========================================================================
   Gráficos del panel — SVG a medida, sin librería.

   Las reglas que sigue este archivo (skill dataviz) y que conviene no romper
   al editarlo:

   · Marcas finas: barras ≤ 24px con el extremo de dato redondeado 4px y la
     base cuadrada; líneas de 2px; marcadores ≥ 8px con anillo de 2px del color
     de la superficie; relleno de área al 10%.
   · Dos separadores hechos de superficie, no de trazo: 2px de hueco entre
     segmentos apilados y entre barras que se tocan.
   · La rejilla es de un paso sobre el fondo, continua (nunca punteada).
   · El texto NUNCA lleva el color de la serie: la identidad la da la marca de
     color que está al lado. Valores y etiquetas van en tinta.
   · Leyenda siempre que haya ≥ 2 series; con una sola, el título ya la nombra.
   · Etiquetas directas selectivas: el extremo, el máximo o la serie que cuenta.
     Nunca un número sobre cada punto.
   · Capa de hover por defecto: crosshair que engancha al X más cercano en
     líneas/áreas, tooltip por marca en barras y dona. El área sensible es
     mayor que la marca (≥ 24px).
   · El tooltip nunca es la única vía: toda cifra está también en la vista de
     tabla que abre el propio encabezado del gráfico.
   · Las etiquetas vienen de la base de datos: se insertan como texto (JSX ya
     escapa), nunca como HTML.

   La paleta (--chart-1..6) está validada en claro y oscuro; el ORDEN de los
   slots es el mecanismo de seguridad para daltonismo. No reordenar sin volver
   a pasar scripts/validate_palette.js del skill dataviz.
   ========================================================================== */
import * as React from "react"

import { cn } from "@/lib/utils"

export const SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const

/** Color de serie por índice. Nunca se cicla: a partir del 7º se agrupa en «Otros». */
export const serieColor = (i: number) => SERIES[i] ?? "var(--chart-ink-muted)"

/* ---------- medida del contenedor ---------- */

function useAncho<T extends HTMLElement>() {
  const ref = React.useRef<T>(null)
  const [ancho, setAncho] = React.useState(0)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setAncho(entry.contentRect.width))
    ro.observe(el)
    setAncho(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  return [ref, ancho] as const
}

/* ---------- utilidades de escala ---------- */

/** Techo "redondo" para el eje: 0 / 500 / 1,000 en vez de 0 / 437 / 874. */
function techoBonito(max: number): number {
  if (max <= 0) return 1
  const exp = Math.floor(Math.log10(max))
  const base = 10 ** exp
  for (const paso of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (max <= paso * base) return paso * base
  }
  return 10 * base
}

/** Barra con el extremo de dato redondeado y la base cuadrada. */
function barraVertical(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, w / 2, Math.max(h, 0))
  if (h <= 0.5) return ""
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`
}

/* ==========================================================================
   Envoltura: título, leyenda, conmutador de tabla
   ========================================================================== */

export type SerieDef = { nombre: string; color: string }

export function Leyenda({
  series,
  tipo = "rect",
  activa,
  onToggle,
  className,
}: {
  series: SerieDef[]
  /** La leyenda espeja la marca: barra/área → rectángulo, línea → trazo. */
  tipo?: "rect" | "line"
  activa?: Set<string>
  onToggle?: (nombre: string) => void
  className?: string
}) {
  if (series.length < 2) return null

  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {series.map((s) => {
        const apagada = activa ? !activa.has(s.nombre) : false
        const contenido = (
          <>
            {tipo === "rect" ? (
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: s.color }}
              />
            ) : (
              <span
                aria-hidden
                className="h-0.5 w-4 shrink-0 rounded-full"
                style={{ background: s.color }}
              />
            )}
            <span className="text-[11.5px] text-muted-foreground">{s.nombre}</span>
          </>
        )
        return (
          <li key={s.nombre}>
            {onToggle ? (
              <button
                type="button"
                onClick={() => onToggle(s.nombre)}
                aria-pressed={!apagada}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-1.5 py-0.5 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
                  apagada && "opacity-40"
                )}
              >
                {contenido}
              </button>
            ) : (
              <span className="flex items-center gap-1.5">{contenido}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Tooltip: el valor manda, el nombre de la serie acompaña. */
function Tooltip({
  x,
  y,
  ancho,
  titulo,
  filas,
}: {
  x: number
  y: number
  ancho: number
  titulo: string
  filas: { nombre: string; valor: string; color: string }[]
}) {
  const ANCHO_TT = 168
  const izq = Math.min(Math.max(x + 12, 4), Math.max(ancho - ANCHO_TT - 4, 4))

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute z-20 rounded-xl border border-border bg-popover/97 px-3 py-2 shadow-[0_10px_30px_-12px_rgba(58,36,21,0.45)] backdrop-blur-sm"
      style={{ left: izq, top: Math.max(y - 8, 4), width: ANCHO_TT }}
    >
      <div className="mb-1.5 text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">
        {titulo}
      </div>
      <ul className="space-y-1">
        {filas.map((f) => (
          <li key={f.nombre} className="flex items-baseline gap-2">
            <span
              aria-hidden
              className="mt-1 h-0.5 w-3 shrink-0 rounded-full"
              style={{ background: f.color }}
            />
            <span className="tnum text-[13px] font-medium text-foreground">{f.valor}</span>
            <span className="ml-auto truncate text-[11px] text-muted-foreground">{f.nombre}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Encabezado con conmutador de tabla. La tabla no es un extra de
 * accesibilidad: es el canal que sostiene los valores que el gráfico no
 * etiqueta directamente.
 */
export function ChartFrame({
  titulo,
  descripcion,
  leyenda,
  tabla,
  accion,
  children,
  className,
}: {
  titulo: string
  descripcion?: string
  leyenda?: React.ReactNode
  tabla?: React.ReactNode
  accion?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const [verTabla, setVerTabla] = React.useState(false)

  return (
    <section className={cn("flex min-w-0 flex-col", className)}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="font-heading text-[14px] leading-snug font-normal">{titulo}</h3>
          {descripcion ? (
            <p className="mt-0.5 text-[12px] text-muted-foreground">{descripcion}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {accion}
          {tabla ? (
            <button
              type="button"
              onClick={() => setVerTabla((v) => !v)}
              aria-pressed={verTabla}
              className="rounded-full border border-border px-2.5 py-1 text-[10.5px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:border-gold/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none"
            >
              {verTabla ? "Gráfico" : "Tabla"}
            </button>
          ) : null}
        </div>
      </header>

      {leyenda ? <div className="mb-3">{leyenda}</div> : null}

      {verTabla && tabla ? <div className="overflow-x-auto">{tabla}</div> : children}
    </section>
  )
}

/** Tabla estándar para la vista alternativa de cualquier gráfico. */
export function TablaDatos({
  columnas,
  filas,
}: {
  columnas: string[]
  filas: (string | number)[][]
}) {
  return (
    <table className="w-full text-[12.5px]">
      <thead>
        <tr className="border-b border-border">
          {columnas.map((c, i) => (
            <th
              key={c}
              scope="col"
              className={cn(
                "py-1.5 font-medium text-muted-foreground",
                i === 0 ? "text-left" : "text-right"
              )}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((fila, i) => (
          <tr key={i} className="border-b border-border/50 last:border-0">
            {fila.map((celda, j) => (
              <td
                key={j}
                className={cn("py-1.5", j === 0 ? "text-left" : "tnum text-right tabular-nums")}
              >
                {celda}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ==========================================================================
   Línea / área con crosshair
   ========================================================================== */

export type PuntoSerie = { x: string; valores: number[] }

export function LineaArea({
  puntos,
  series,
  formato,
  alto = 240,
  area = true,
  etiquetaFinal = true,
}: {
  /** Cada punto trae un valor por serie, en el mismo orden que `series`. */
  puntos: PuntoSerie[]
  series: SerieDef[]
  formato: (n: number) => string
  alto?: number
  area?: boolean
  /** Etiqueta directa sobre el último punto (selectiva, no en cada punto). */
  etiquetaFinal?: boolean
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>()
  const [activo, setActivo] = React.useState<number | null>(null)

  const M = { top: 16, right: etiquetaFinal ? 56 : 16, bottom: 26, left: 46 }
  const w = Math.max(ancho, 240)
  const innerW = Math.max(w - M.left - M.right, 10)
  const innerH = Math.max(alto - M.top - M.bottom, 10)

  const max = React.useMemo(
    () => techoBonito(Math.max(...puntos.flatMap((p) => p.valores), 0)),
    [puntos]
  )

  const px = (i: number) =>
    M.left + (puntos.length <= 1 ? innerW / 2 : (i / (puntos.length - 1)) * innerW)
  const py = (v: number) => M.top + innerH - (v / max) * innerH

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f)

  /** Etiquetas del eje X: como mucho seis, para que no se pisen. */
  const pasoX = Math.max(1, Math.ceil(puntos.length / 6))

  function mover(e: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const rel = e.clientX - rect.left - M.left
    const i = Math.round((rel / innerW) * (puntos.length - 1))
    setActivo(Math.min(Math.max(i, 0), puntos.length - 1))
  }

  if (!puntos.length) return <SinDatos alto={alto} />

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width="100%"
        height={alto}
        viewBox={`0 0 ${w} ${alto}`}
        role="img"
        aria-label={`${series.map((s) => s.nombre).join(", ")} por periodo`}
        onPointerMove={mover}
        onPointerLeave={() => setActivo(null)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setActivo((a) => Math.min((a ?? -1) + 1, puntos.length - 1))
          if (e.key === "ArrowLeft") setActivo((a) => Math.max((a ?? puntos.length) - 1, 0))
          if (e.key === "Escape") setActivo(null)
        }}
        className="touch-none outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
      >
        {/* rejilla: un paso sobre el fondo, continua */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={M.left}
              x2={M.left + innerW}
              y1={py(t)}
              y2={py(t)}
              stroke="var(--chart-grid)"
              strokeWidth={1}
            />
            <text
              x={M.left - 8}
              y={py(t) + 3.5}
              textAnchor="end"
              className="tnum fill-[var(--chart-ink-muted)] text-[10px]"
            >
              {formato(t)}
            </text>
          </g>
        ))}

        {/* eje X */}
        {puntos.map((p, i) =>
          i % pasoX === 0 || i === puntos.length - 1 ? (
            <text
              key={p.x + i}
              x={px(i)}
              y={alto - 8}
              textAnchor={i === 0 ? "start" : i === puntos.length - 1 ? "end" : "middle"}
              className="fill-[var(--chart-ink-muted)] text-[10px]"
            >
              {p.x}
            </text>
          ) : null
        )}

        {series.map((s, si) => {
          const d = puntos.map((p, i) => `${i ? "L" : "M"}${px(i)},${py(p.valores[si] ?? 0)}`).join(" ")
          const dArea = `${d} L${px(puntos.length - 1)},${M.top + innerH} L${px(0)},${M.top + innerH} Z`
          return (
            <g key={s.nombre}>
              {area ? <path d={dArea} fill={s.color} opacity={0.1} /> : null}
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )
        })}

        {/* crosshair: engancha al X más cercano */}
        {activo !== null ? (
          <g>
            <line
              x1={px(activo)}
              x2={px(activo)}
              y1={M.top}
              y2={M.top + innerH}
              stroke="var(--chart-axis)"
              strokeWidth={1}
            />
            {series.map((s, si) => (
              <circle
                key={s.nombre}
                cx={px(activo)}
                cy={py(puntos[activo].valores[si] ?? 0)}
                r={4.5}
                fill={s.color}
                stroke="var(--card)"
                strokeWidth={2}
              />
            ))}
          </g>
        ) : null}

        {/* etiqueta directa: solo el último punto de cada serie */}
        {etiquetaFinal
          ? series.map((s, si) => {
              const v = puntos[puntos.length - 1].valores[si] ?? 0
              return (
                <g key={s.nombre}>
                  <circle
                    cx={px(puntos.length - 1)}
                    cy={py(v)}
                    r={4}
                    fill={s.color}
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                  <text
                    x={px(puntos.length - 1) + 9}
                    y={py(v) + 3.5}
                    className="tnum fill-foreground text-[10.5px] font-medium"
                  >
                    {formato(v)}
                  </text>
                </g>
              )
            })
          : null}
      </svg>

      {activo !== null ? (
        <Tooltip
          x={px(activo)}
          y={M.top}
          ancho={w}
          titulo={puntos[activo].x}
          filas={series.map((s, si) => ({
            nombre: s.nombre,
            color: s.color,
            valor: formato(puntos[activo].valores[si] ?? 0),
          }))}
        />
      ) : null}
    </div>
  )
}

/* ==========================================================================
   Columnas (simples o apiladas)
   ========================================================================== */

export function Columnas({
  puntos,
  series,
  formato,
  alto = 220,
  apiladas = false,
}: {
  puntos: PuntoSerie[]
  series: SerieDef[]
  formato: (n: number) => string
  alto?: number
  apiladas?: boolean
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>()
  const [activo, setActivo] = React.useState<number | null>(null)

  const M = { top: 16, right: 12, bottom: 26, left: 46 }
  const w = Math.max(ancho, 240)
  const innerW = Math.max(w - M.left - M.right, 10)
  const innerH = Math.max(alto - M.top - M.bottom, 10)

  const totales = puntos.map((p) =>
    apiladas ? p.valores.reduce((a, b) => a + b, 0) : Math.max(...p.valores, 0)
  )
  const max = techoBonito(Math.max(...totales, 0))
  const py = (v: number) => M.top + innerH - (v / max) * innerH

  const banda = innerW / Math.max(puntos.length, 1)
  // Barras finas: nunca llenan la banda, y como mucho 24px.
  const anchoBarra = Math.min(24, banda * 0.62)
  const anchoGrupo = apiladas ? anchoBarra : Math.min(anchoBarra, (banda * 0.72) / series.length)

  const ticks = [0, 0.5, 1].map((f) => max * f)
  const pasoX = Math.max(1, Math.ceil(puntos.length / 8))

  if (!puntos.length) return <SinDatos alto={alto} />

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width="100%"
        height={alto}
        viewBox={`0 0 ${w} ${alto}`}
        role="img"
        aria-label={`${series.map((s) => s.nombre).join(", ")} por periodo`}
        className="outline-none"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={M.left}
              x2={M.left + innerW}
              y1={py(t)}
              y2={py(t)}
              stroke="var(--chart-grid)"
              strokeWidth={1}
            />
            <text
              x={M.left - 8}
              y={py(t) + 3.5}
              textAnchor="end"
              className="tnum fill-[var(--chart-ink-muted)] text-[10px]"
            >
              {formato(t)}
            </text>
          </g>
        ))}

        {puntos.map((p, i) => {
          const centro = M.left + banda * i + banda / 2
          let acumulado = 0

          return (
            <g key={p.x + i}>
              {/* Objetivo de puntero de toda la banda: mayor que la marca. */}
              <rect
                x={M.left + banda * i}
                y={M.top}
                width={banda}
                height={innerH}
                fill="transparent"
                onPointerEnter={() => setActivo(i)}
                onPointerLeave={() => setActivo(null)}
                tabIndex={0}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
                className="outline-none"
              >
                <title>{`${p.x}: ${p.valores.map((v, si) => `${series[si]?.nombre ?? ""} ${formato(v)}`).join(", ")}`}</title>
              </rect>

              {series.map((s, si) => {
                const v = p.valores[si] ?? 0
                if (apiladas) {
                  const y = py(acumulado + v)
                  const altura = py(acumulado) - py(acumulado + v)
                  acumulado += v
                  // 2px de hueco de superficie entre segmentos apilados.
                  const hueco = si === 0 ? 0 : 2
                  return (
                    <path
                      key={s.nombre}
                      d={
                        si === series.length - 1
                          ? barraVertical(centro - anchoGrupo / 2, y + hueco, anchoGrupo, Math.max(altura - hueco, 0))
                          : `M${centro - anchoGrupo / 2},${y + hueco} h${anchoGrupo} v${Math.max(altura - hueco, 0)} h${-anchoGrupo} Z`
                      }
                      fill={s.color}
                      opacity={activo === null || activo === i ? 1 : 0.45}
                      style={{ transition: "opacity .2s" }}
                    />
                  )
                }
                const total = series.length
                // 2px de hueco entre barras vecinas del mismo grupo.
                const x = centro - (anchoGrupo * total + 2 * (total - 1)) / 2 + si * (anchoGrupo + 2)
                return (
                  <path
                    key={s.nombre}
                    d={barraVertical(x, py(v), anchoGrupo, M.top + innerH - py(v))}
                    fill={s.color}
                    opacity={activo === null || activo === i ? 1 : 0.45}
                    style={{ transition: "opacity .2s" }}
                  />
                )
              })}
            </g>
          )
        })}

        {puntos.map((p, i) =>
          i % pasoX === 0 || i === puntos.length - 1 ? (
            <text
              key={p.x + i}
              x={M.left + banda * i + banda / 2}
              y={alto - 8}
              textAnchor="middle"
              className="fill-[var(--chart-ink-muted)] text-[10px]"
            >
              {p.x}
            </text>
          ) : null
        )}
      </svg>

      {activo !== null ? (
        <Tooltip
          x={M.left + banda * activo + banda / 2}
          y={M.top}
          ancho={w}
          titulo={puntos[activo].x}
          filas={series.map((s, si) => ({
            nombre: s.nombre,
            color: s.color,
            valor: formato(puntos[activo].valores[si] ?? 0),
          }))}
        />
      ) : null}
    </div>
  )
}

/* ==========================================================================
   Ranking horizontal (una sola serie: sin leyenda, el título la nombra)
   ========================================================================== */

export function Ranking({
  filas,
  formato,
  color = "var(--chart-1)",
  maxFilas = 6,
}: {
  filas: { etiqueta: string; valor: number; detalle?: string }[]
  formato: (n: number) => string
  color?: string
  maxFilas?: number
}) {
  const datos = filas.slice(0, maxFilas)
  const max = Math.max(...datos.map((f) => f.valor), 1)

  if (!datos.length) return <SinDatos alto={140} />

  return (
    <ul className="space-y-2.5">
      {datos.map((f) => (
        <li key={f.etiqueta} className="group/fila">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-[12.5px] text-foreground">{f.etiqueta}</span>
            <span className="tnum shrink-0 text-[12.5px] font-medium text-foreground">
              {formato(f.valor)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 min-w-0 flex-1 rounded-full bg-muted">
              <div
                className="h-2 rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max((f.valor / max) * 100, 2)}%`, background: color }}
              />
            </div>
            {f.detalle ? (
              <span className="shrink-0 text-[11px] text-muted-foreground">{f.detalle}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ==========================================================================
   Dona — reparto de un total (los segmentos se tocan: pares adyacentes)
   ========================================================================== */

export function Dona({
  segmentos,
  formato,
  centroEtiqueta,
  tamano = 200,
}: {
  segmentos: { nombre: string; valor: number; color: string }[]
  formato: (n: number) => string
  centroEtiqueta?: string
  tamano?: number
}) {
  const [activo, setActivo] = React.useState<number | null>(null)
  const datos = segmentos.filter((s) => s.valor > 0)
  const total = datos.reduce((a, b) => a + b.valor, 0)

  if (!total) return <SinDatos alto={tamano} />

  const R = tamano / 2
  const grosor = 26
  const r = R - grosor / 2 - 2
  // El hueco de 2px entre segmentos se hace con la superficie, no con un trazo.
  const huecoRad = 2 / r

  let angulo = -Math.PI / 2
  const arcos = datos.map((s) => {
    const barrido = (s.valor / total) * Math.PI * 2
    const desde = angulo + huecoRad / 2
    const hasta = angulo + barrido - huecoRad / 2
    angulo += barrido
    return { ...s, desde, hasta, barrido }
  })

  const punto = (ang: number, radio: number) => [R + radio * Math.cos(ang), R + radio * Math.sin(ang)]

  const activoDato = activo !== null ? arcos[activo] : null

  return (
    <div className="relative" style={{ width: tamano, height: tamano }}>
      <svg
        width={tamano}
        height={tamano}
        viewBox={`0 0 ${tamano} ${tamano}`}
        role="img"
        aria-label="Reparto por método de pago"
      >
        {arcos.map((a, i) => {
          const [x1, y1] = punto(a.desde, r)
          const [x2, y2] = punto(a.hasta, r)
          const grande = a.hasta - a.desde > Math.PI ? 1 : 0
          return (
            <path
              key={a.nombre}
              d={`M${x1},${y1} A${r},${r} 0 ${grande} 1 ${x2},${y2}`}
              fill="none"
              stroke={a.color}
              strokeWidth={activo === i ? grosor + 5 : grosor}
              strokeLinecap="butt"
              opacity={activo === null || activo === i ? 1 : 0.5}
              style={{ transition: "stroke-width .2s, opacity .2s" }}
              onPointerEnter={() => setActivo(i)}
              onPointerLeave={() => setActivo(null)}
              tabIndex={0}
              onFocus={() => setActivo(i)}
              onBlur={() => setActivo(null)}
              className="cursor-default outline-none"
            >
              <title>{`${a.nombre}: ${formato(a.valor)}`}</title>
            </path>
          )
        })}
      </svg>

      {/* Centro: el total, o el segmento señalado. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[10.5px] tracking-[0.16em] text-muted-foreground uppercase">
          {activoDato ? activoDato.nombre : (centroEtiqueta ?? "Total")}
        </span>
        <span className="mt-0.5 text-[20px] leading-tight font-medium text-foreground">
          {formato(activoDato ? activoDato.valor : total)}
        </span>
        {activoDato ? (
          <span className="tnum text-[11px] text-muted-foreground">
            {Math.round((activoDato.valor / total) * 100)}%
          </span>
        ) : null}
      </div>
    </div>
  )
}

/* ==========================================================================
   Sparkline y tarjeta de cifra
   ========================================================================== */

export function Sparkline({
  valores,
  color = "var(--chart-1)",
  ancho = 96,
  alto = 28,
}: {
  valores: number[]
  color?: string
  ancho?: number
  alto?: number
}) {
  if (valores.length < 2) return null
  const max = Math.max(...valores, 1)
  const min = Math.min(...valores, 0)
  const rango = max - min || 1
  const px = (i: number) => (i / (valores.length - 1)) * ancho
  const py = (v: number) => alto - 2 - ((v - min) / rango) * (alto - 4)
  const d = valores.map((v, i) => `${i ? "L" : "M"}${px(i)},${py(v)}`).join(" ")

  return (
    <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} aria-hidden className="overflow-visible">
      <path d={`${d} L${ancho},${alto} L0,${alto} Z`} fill={color} opacity={0.1} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={px(valores.length - 1)} cy={py(valores[valores.length - 1])} r={3} fill={color} stroke="var(--card)" strokeWidth={2} />
    </svg>
  )
}

export function Cifra({
  etiqueta,
  valor,
  delta,
  deltaEtiqueta,
  subirEsBueno = true,
  chispa,
  color = "var(--chart-1)",
  icono,
  destacada = false,
  className,
}: {
  etiqueta: string
  valor: string
  /** Variación relativa en % contra un periodo con nombre. */
  delta?: number | null
  deltaEtiqueta?: string
  subirEsBueno?: boolean
  chispa?: number[]
  color?: string
  icono?: React.ReactNode
  /** La cifra que encabeza la vista: una sola por pantalla. */
  destacada?: boolean
  className?: string
}) {
  const hayDelta = delta !== null && delta !== undefined && Number.isFinite(delta)
  const bueno = hayDelta ? (delta! >= 0) === subirEsBueno : true

  return (
    <div
      className={cn(
        "aura-crest relative flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-4",
        "shadow-[0_1px_2px_rgba(58,36,21,0.04),0_8px_24px_-18px_rgba(58,36,21,0.3)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          {etiqueta}
        </span>
        {icono ? <span className="text-gold-deep dark:text-gold">{icono}</span> : null}
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {/* Cifras proporcionales: `tabular-nums` afea los números grandes. */}
          <div
            className={cn(
              "leading-none font-medium text-foreground",
              destacada ? "text-[clamp(30px,4vw,44px)]" : "text-[24px]"
            )}
          >
            {valor}
          </div>
          {hayDelta ? (
            <div className="mt-1.5 flex items-center gap-1 text-[11.5px]">
              <span
                aria-hidden
                className={cn(bueno ? "text-status-confirmed" : "text-status-cancelled")}
              >
                {delta! >= 0 ? "▲" : "▼"}
              </span>
              <span className={cn("tnum font-medium", bueno ? "text-status-confirmed" : "text-status-cancelled")}>
                {delta! >= 0 ? "+" : ""}
                {delta!.toFixed(0)}%
              </span>
              {deltaEtiqueta ? (
                <span className="text-muted-foreground">{deltaEtiqueta}</span>
              ) : null}
            </div>
          ) : deltaEtiqueta ? (
            <div className="mt-1.5 text-[11.5px] text-muted-foreground">{deltaEtiqueta}</div>
          ) : null}
        </div>
        {chispa && chispa.length > 1 ? (
          <Sparkline valores={chispa} color={color} ancho={destacada ? 120 : 84} alto={destacada ? 36 : 28} />
        ) : null}
      </div>
    </div>
  )
}

/* ---------- vacío ---------- */

export function SinDatos({ alto = 200, mensaje = "Sin movimientos en este rango" }: { alto?: number; mensaje?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center"
      style={{ height: alto }}
    >
      <span className="aura-diamond opacity-40" aria-hidden />
      <p className="max-w-[24ch] text-[12px] text-muted-foreground">{mensaje}</p>
    </div>
  )
}
