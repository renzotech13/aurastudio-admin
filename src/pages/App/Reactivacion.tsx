import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { BellRing, CheckCircle2, ChevronRight, Plus, RefreshCw, TriangleAlert } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { probarPlantillaReactivacion, BotApiError } from "@/lib/botApi"
import { fechaCorta } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * Reactivación de clientas ya atendidas (migración 0022): a quien se atendió
 * hace N días y no volvió, el bot le escribe invitándola con una oferta. Acá la
 * administradora decide cuándo y con qué oferta, y prende o apaga el envío.
 *
 * NACE APAGADO. Prenderlo es a propósito: empieza a escribirle a clientas reales.
 */

const VARIABLES = ["nombre", "servicio", "oferta", "codigo"] as const
type Variable = (typeof VARIABLES)[number]

type Config = {
  activa: boolean
  ventana_dias: number
  separacion_dias: number
  max_por_vuelta: number
  hora_desde: number
  hora_hasta: number
}

type Regla = {
  id: string
  nombre: string
  categoria_id: string | null
  dias: number
  plantilla: string
  cuerpo: string
  variables: Variable[]
  oferta: string
  codigo: string
  activa: boolean
  orden: number
}

type Candidata = {
  regla_id: string
  regla_nombre: string
  cliente_id: string
  cliente_nombre: string | null
  servicio: string
  dias_desde: number
}

type Envio = {
  id: string
  cliente_nombre: string | null
  regla_nombre: string
  oferta: string
  estado: "reservada" | "enviada" | "fallida"
  error: string | null
  created_at: string
  volvio: boolean
}

type Categoria = { id: string; title: string }

/** Las variables que usa un texto: {{1}}…{{n}} seguidas. null si el texto está mal armado. */
function variablesDeCuerpo(cuerpo: string): { variables: Variable[] | null; problema: string | null } {
  const usados = [...cuerpo.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]))
  if (usados.length === 0) return { variables: [], problema: null }
  const max = Math.max(...usados)
  if (max > VARIABLES.length) return { variables: null, problema: `Solo hay ${VARIABLES.length} variables: {{1}} a {{${VARIABLES.length}}}.` }
  for (let n = 1; n <= max; n++) {
    if (!usados.includes(n)) return { variables: null, problema: `Falta {{${n}}}: Meta pide variables seguidas, sin saltos.` }
  }
  return { variables: VARIABLES.slice(0, max) as Variable[], problema: null }
}

export default function Reactivacion() {
  const [config, setConfig] = useState<Config | null>(null)
  const [reglas, setReglas] = useState<Regla[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [candidatas, setCandidatas] = useState<Candidata[]>([])
  const [envios, setEnvios] = useState<Envio[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<Regla | "nueva" | null>(null)
  const [confirmarPrender, setConfirmarPrender] = useState(false)

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true)
    const desde = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const [cfg, rgl, cat, can, env] = await Promise.all([
      supabase.from("reactivacion_config").select("*").eq("id", true).maybeSingle(),
      supabase.from("reglas_reactivacion").select("*").order("orden").order("dias"),
      supabase.from("service_categories").select("id,title").order("sort_order"),
      supabase.rpc("reactivacion_candidatas"),
      supabase
        .from("reactivaciones_resultado")
        .select("id,cliente_nombre,regla_nombre,oferta,estado,error,created_at,volvio")
        .gte("created_at", desde)
        .order("created_at", { ascending: false })
        .limit(60),
    ])
    if (cfg.error || rgl.error) {
      setError(
        cfg.error?.code === "PGRST205" || rgl.error?.code === "PGRST205" || cfg.error?.code === "42P01"
          ? "Falta activar la reactivación en la base de datos (migración 0022)."
          : "No se pudo cargar la reactivación.",
      )
    } else {
      setError(null)
      setConfig(cfg.data as Config | null)
      setReglas((rgl.data ?? []) as Regla[])
      setCategorias((cat.data ?? []) as Categoria[])
      // Una sola por clienta: es lo que el bot mandaría en su próxima vuelta.
      const vistas = new Set<string>()
      setCandidatas(
        ((can.data ?? []) as Candidata[]).filter((c) => {
          if (vistas.has(c.cliente_id)) return false
          vistas.add(c.cliente_id)
          return true
        }),
      )
      setEnvios((env.data ?? []) as Envio[])
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const reglasActivas = reglas.filter((r) => r.activa).length
  const resumen = useMemo(() => {
    const enviadas = envios.filter((e) => e.estado === "enviada")
    return {
      enviadas: enviadas.length,
      volvieron: enviadas.filter((e) => e.volvio).length,
      fallidas: envios.filter((e) => e.estado === "fallida").length,
    }
  }, [envios])

  async function cambiarInterruptor(activa: boolean) {
    const { error: fallo } = await supabase
      .from("reactivacion_config")
      .update({ activa, updated_at: new Date().toISOString() })
      .eq("id", true)
    if (fallo) return toast.error("No se pudo cambiar el envío automático.")
    toast.success(activa ? "Envío automático prendido." : "Envío automático apagado: no se manda nada.")
    setConfirmarPrender(false)
    void cargar(true)
  }

  async function alternarRegla(r: Regla, activa: boolean) {
    const { error: fallo } = await supabase
      .from("reglas_reactivacion")
      .update({ activa, updated_at: new Date().toISOString() })
      .eq("id", r.id)
    if (fallo) return toast.error("No se pudo cambiar la regla.")
    setReglas((previas) => previas.map((x) => (x.id === r.id ? { ...x, activa } : x)))
    void cargar(true)
  }

  async function noContactar(c: Candidata) {
    const { error: fallo } = await supabase.from("clientes").update({ no_contactar: true }).eq("id", c.cliente_id)
    if (fallo) return toast.error("No se pudo marcar.")
    toast.success(`${c.cliente_nombre ?? "La clienta"} ya no recibirá estos mensajes.`)
    void cargar(true)
  }

  const nombreCategoria = (id: string | null) =>
    id ? (categorias.find((c) => c.id === id)?.title ?? id) : "Cualquier servicio"

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-5 pb-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] tracking-[0.2em] text-gold-deep uppercase dark:text-gold">Retención</p>
          <h1 className="aura-display text-[24px] leading-tight">Reactivación</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Invita a volver a quien ya se atendió.</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Actualizar" onClick={() => void cargar()} disabled={cargando}>
          <RefreshCw className={cn("size-4", cargando && "animate-spin")} />
        </Button>
      </div>

      {cargando ? (
        <div className="flex flex-col gap-3" aria-busy>
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : error || !config ? (
        <div className="rounded-2xl border border-status-cancelled/30 bg-status-cancelled-bg/60 p-5 text-center">
          <p className="text-[13.5px] text-status-cancelled">{error ?? "No se pudo cargar la reactivación."}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void cargar()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Interruptor general */}
          <section
            className={cn(
              "rounded-2xl border p-4",
              config.activa ? "border-gold bg-gold/10" : "border-border bg-card",
            )}
            aria-label="Envío automático"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[14.5px] font-medium">Envío automático</h2>
                <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
                  {config.activa
                    ? `Prendido. El bot revisa cada 20 minutos, de ${config.hora_desde}:00 a ${config.hora_hasta}:00 (hora de Lima), y escribe como máximo a ${config.max_por_vuelta} por vuelta.`
                    : "Apagado: el bot no manda nada, aunque haya reglas activas. Préndelo cuando Meta ya haya aprobado tus plantillas."}
                </p>
              </div>
              <Switch
                checked={config.activa}
                onCheckedChange={(v) => (v ? setConfirmarPrender(true) : void cambiarInterruptor(false))}
                aria-label="Envío automático"
              />
            </div>
            {config.activa && reglasActivas === 0 ? (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-100/70 px-3 py-2 text-[12.5px] text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                No hay ninguna regla activa: no se enviará nada hasta que prendas alguna.
              </p>
            ) : null}
          </section>

          {/* Resultados de los últimos 30 días */}
          <section aria-label="Últimos 30 días">
            <h2 className="mb-2 px-1 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Últimos 30 días</h2>
            <div className="grid grid-cols-3 gap-2">
              <Cifra valor={resumen.enviadas} etiqueta="Enviadas" />
              <Cifra valor={resumen.volvieron} etiqueta="Volvieron" destacar />
              <Cifra valor={resumen.fallidas} etiqueta="No salieron" alerta={resumen.fallidas > 0} />
            </div>
            <p className="mt-2 px-1 text-[12px] text-muted-foreground">
              «Volvieron» cuenta a quien agendó una cita después del mensaje, dentro de los 45 días.
            </p>
          </section>

          {/* Reglas */}
          <section aria-label="Reglas">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Reglas</h2>
              <button
                type="button"
                onClick={() => setEditando("nueva")}
                className="flex items-center gap-1 text-[12.5px] text-gold-deep dark:text-gold"
              >
                <Plus className="size-3.5" /> Nueva
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              {reglas.map((r) => (
                <li key={r.id} className={cn("rounded-2xl border border-border bg-card", !r.activa && "opacity-80")}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button type="button" onClick={() => setEditando(r)} className="min-w-0 flex-1 text-left">
                      <span className="block text-[14px] font-medium">{r.nombre}</span>
                      <span className="block text-[12px] text-muted-foreground">
                        {nombreCategoria(r.categoria_id)} · a los {r.dias} días · {r.oferta || "sin oferta"}
                      </span>
                    </button>
                    <Switch checked={r.activa} onCheckedChange={(v) => void alternarRegla(r, v)} aria-label={`Activar ${r.nombre}`} />
                    <button type="button" aria-label={`Editar ${r.nombre}`} onClick={() => setEditando(r)}>
                      <ChevronRight className="size-4 text-muted-foreground/60" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Vista previa */}
          <section aria-label="A quién se le escribiría">
            <h2 className="mb-1 px-1 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
              Se le escribiría en la próxima vuelta
            </h2>
            <p className="mb-2 px-1 text-[12px] text-muted-foreground">
              Con las reglas que están activas ahora. No se manda nada desde acá.
            </p>
            {candidatas.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
                {reglasActivas === 0 ? "Prende una regla para ver a quién le tocaría." : "Hoy no le toca a nadie."}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {candidatas.slice(0, 25).map((c) => (
                  <li key={c.cliente_id} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{c.cliente_nombre?.trim() || "Sin nombre"}</p>
                      <p className="truncate text-[12px] text-muted-foreground">
                        {c.servicio} · hace {c.dias_desde} días · {c.regla_nombre}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void noContactar(c)}
                      className="shrink-0 text-[12px] text-muted-foreground underline underline-offset-4"
                    >
                      No contactar
                    </button>
                  </li>
                ))}
                {candidatas.length > 25 ? (
                  <li className="px-1 text-[12px] text-muted-foreground">y {candidatas.length - 25} más…</li>
                ) : null}
              </ul>
            )}
          </section>

          {/* Últimos envíos */}
          <section aria-label="Últimos envíos">
            <h2 className="mb-2 px-1 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Últimos envíos</h2>
            {envios.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
                Todavía no se envió ninguno.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {envios.slice(0, 20).map((e) => (
                  <li key={e.id} className="rounded-2xl border border-border bg-card px-4 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[13.5px] font-medium">{e.cliente_nombre?.trim() || "Sin nombre"}</p>
                      <span className="shrink-0 text-[11.5px] text-muted-foreground">{fechaCorta(e.created_at)}</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      {e.regla_nombre} · {e.oferta}
                    </p>
                    <p className="mt-1.5">
                      {e.estado === "fallida" ? (
                        <span className="text-[12px] text-status-cancelled">No salió: {e.error ?? "sin detalle"}</span>
                      ) : e.volvio ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-status-confirmed">
                          <CheckCircle2 className="size-3.5" /> Volvió
                        </span>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">Sin cita todavía</span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <DialogoPrender
        abierto={confirmarPrender}
        onCerrar={() => setConfirmarPrender(false)}
        reglasActivas={reglasActivas}
        candidatas={candidatas.length}
        onConfirmar={() => void cambiarInterruptor(true)}
      />

      <DialogoRegla
        regla={editando}
        categorias={categorias}
        siguienteOrden={(reglas.at(-1)?.orden ?? 0) + 10}
        onCerrar={() => setEditando(null)}
        onGuardado={() => {
          setEditando(null)
          void cargar(true)
        }}
      />
    </div>
  )
}

function Cifra({ valor, etiqueta, destacar, alerta }: { valor: number; etiqueta: string; destacar?: boolean; alerta?: boolean }) {
  return (
    <div className={cn("rounded-2xl border px-3 py-3 text-center", destacar ? "border-gold bg-gold/10" : "border-border bg-card")}>
      <p className={cn("tnum text-[24px] leading-none font-semibold", alerta && "text-status-cancelled")}>{valor}</p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{etiqueta}</p>
    </div>
  )
}

function DialogoPrender({
  abierto,
  onCerrar,
  reglasActivas,
  candidatas,
  onConfirmar,
}: {
  abierto: boolean
  onCerrar: () => void
  reglasActivas: number
  candidatas: number
  onConfirmar: () => void
}) {
  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Prender el envío automático?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-[13.5px] leading-snug">
          <p>
            Desde ahora el bot le escribirá por WhatsApp a clientas reales que ya se atendieron y no volvieron.
          </p>
          <ul className="list-disc pl-5 text-muted-foreground">
            <li>
              Reglas activas: <strong className="text-foreground">{reglasActivas}</strong>
            </li>
            <li>
              Le tocaría a <strong className="text-foreground">{candidatas}</strong> clienta{candidatas === 1 ? "" : "s"} en la próxima vuelta.
            </li>
          </ul>
          <p className="rounded-lg bg-gold/10 px-3 py-2 text-[12.5px]">
            Antes confirma que Meta ya aprobó las plantillas y manda una prueba a tu número desde cada regla.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCerrar}>
            Todavía no
          </Button>
          <Button type="button" variant="gold" onClick={onConfirmar}>
            Sí, prender
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DialogoRegla({
  regla,
  categorias,
  siguienteOrden,
  onCerrar,
  onGuardado,
}: {
  regla: Regla | "nueva" | null
  categorias: Categoria[]
  siguienteOrden: number
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [nombre, setNombre] = useState("")
  const [categoriaId, setCategoriaId] = useState("todas")
  const [dias, setDias] = useState("15")
  const [oferta, setOferta] = useState("")
  const [codigo, setCodigo] = useState("")
  const [plantilla, setPlantilla] = useState("vuelve_aura")
  const [cuerpo, setCuerpo] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [telefono, setTelefono] = useState("")
  const [probando, setProbando] = useState(false)
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false)

  useEffect(() => {
    if (regla === null) return
    if (regla === "nueva") {
      setNombre("")
      setCategoriaId("todas")
      setDias("15")
      setOferta("")
      setCodigo("")
      setPlantilla("vuelve_aura")
      setCuerpo(
        "Hola {{1}} 💛 Gracias por visitarnos en Aura Studio ({{2}}). Para tu próxima cita tienes {{3}} con el código {{4}}. Si quieres separar tu espacio, respóndenos por aquí y te ayudamos.",
      )
    } else {
      setNombre(regla.nombre)
      setCategoriaId(regla.categoria_id ?? "todas")
      setDias(String(regla.dias))
      setOferta(regla.oferta)
      setCodigo(regla.codigo)
      setPlantilla(regla.plantilla)
      setCuerpo(regla.cuerpo)
    }
    setTelefono("")
    setConfirmandoBorrar(false)
  }, [regla])

  const diasNum = Number(dias)
  const { variables, problema: problemaCuerpo } = variablesDeCuerpo(cuerpo)
  const usa = (v: Variable) => variables?.includes(v) ?? false
  const problema =
    nombre.trim().length < 2
      ? "Ponle un nombre a la regla."
      : !Number.isInteger(diasNum) || diasNum < 1 || diasNum > 365
        ? "Los días van de 1 a 365."
        : !plantilla.trim()
          ? "Falta el nombre de la plantilla de Meta."
          : !cuerpo.trim()
            ? "Falta el texto de la plantilla."
            : problemaCuerpo
              ? problemaCuerpo
              : usa("oferta") && !oferta.trim()
                ? "Escribe la oferta: el texto la usa."
                : usa("codigo") && !codigo.trim()
                  ? "Escribe el código: el texto lo usa."
                  : null

  async function guardar() {
    if (problema || !variables || regla === null) return
    setGuardando(true)
    const fila = {
      nombre: nombre.trim(),
      categoria_id: categoriaId === "todas" ? null : categoriaId,
      dias: diasNum,
      plantilla: plantilla.trim(),
      cuerpo: cuerpo.trim(),
      variables,
      oferta: oferta.trim(),
      codigo: codigo.trim(),
      updated_at: new Date().toISOString(),
    }
    const { error } =
      regla === "nueva"
        ? await supabase.from("reglas_reactivacion").insert({ ...fila, orden: siguienteOrden })
        : await supabase.from("reglas_reactivacion").update(fila).eq("id", regla.id)
    setGuardando(false)
    if (error) return toast.error("No se pudo guardar la regla.")
    toast.success("Regla guardada.")
    onGuardado()
  }

  async function probar() {
    if (regla === null || regla === "nueva") return
    setProbando(true)
    try {
      // Se manda lo que está GUARDADO: si cambiaste algo, guarda primero.
      await probarPlantillaReactivacion(regla.id, telefono)
      toast.success("Prueba enviada. Revisa tu WhatsApp.")
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo enviar la prueba.")
    } finally {
      setProbando(false)
    }
  }

  async function eliminar() {
    if (regla === null || regla === "nueva") return
    const { error } = await supabase.from("reglas_reactivacion").delete().eq("id", regla.id)
    if (error) return toast.error("No se pudo eliminar.")
    toast.success("Regla eliminada.")
    onGuardado()
  }

  return (
    <Dialog open={regla !== null} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{regla === "nueva" ? "Nueva regla" : "Editar regla"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="reg-nombre">Nombre</Label>
            <Input id="reg-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-11 rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Servicio</Label>
              <Select value={categoriaId} onValueChange={(v) => setCategoriaId(v ?? "todas")}>
                <SelectTrigger className="h-11 w-full rounded-xl">
                  <SelectValue>
                    {(v) => (v === "todas" ? "Cualquiera" : (categorias.find((c) => c.id === v)?.title ?? "Cualquiera"))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Cualquiera</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-dias">Días después</Label>
              <Input
                id="reg-dias"
                inputMode="numeric"
                value={dias}
                onChange={(e) => setDias(e.target.value.replace(/\D/g, ""))}
                className="h-11 rounded-xl tnum"
              />
            </div>
          </div>
          <p className="-mt-2 text-[12px] text-muted-foreground">
            Cuenta desde el día en que se atendió, y solo si no volvió ni tiene una cita por venir.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-oferta">Oferta</Label>
              <Input id="reg-oferta" value={oferta} onChange={(e) => setOferta(e.target.value)} placeholder="10 % de descuento" className="h-11 rounded-xl" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-codigo">Código</Label>
              <Input id="reg-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="VUELVE10" className="h-11 rounded-xl" />
            </div>
          </div>
          <p className="-mt-2 text-[12px] text-muted-foreground">
            El descuento no se aplica solo: ella dice el código y se descuenta al cobrar.
          </p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reg-plantilla">Plantilla en Meta</Label>
            <Input id="reg-plantilla" value={plantilla} onChange={(e) => setPlantilla(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reg-cuerpo">Texto de la plantilla</Label>
            <Textarea id="reg-cuerpo" value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={5} className="rounded-xl" />
            <p className="text-[12px] text-muted-foreground">
              Tiene que ser igual al aprobado en Meta. {"{{1}}"} nombre · {"{{2}}"} servicio · {"{{3}}"} oferta · {"{{4}}"} código.
            </p>
          </div>

          {regla !== null && regla !== "nueva" ? (
            <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <Label htmlFor="reg-prueba">Enviar una prueba a mi número</Label>
              <div className="flex gap-2">
                <Input
                  id="reg-prueba"
                  inputMode="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="987 654 321"
                  className="h-11 rounded-xl"
                />
                <Button type="button" variant="outline" className="h-11" disabled={probando || telefono.replace(/\D/g, "").length < 9} onClick={() => void probar()}>
                  {probando ? "Enviando…" : "Probar"}
                </Button>
              </div>
              <p className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
                <BellRing className="mt-0.5 size-3.5 shrink-0" />
                Manda la plantilla guardada, con datos de ejemplo. Si Meta todavía no la aprobó, avisará que no salió.
              </p>
            </div>
          ) : null}

          {problema ? (
            <p role="alert" className="text-[12.5px] text-status-cancelled">
              {problema}
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {regla !== null && regla !== "nueva" ? (
            <Button
              type="button"
              variant="ghost"
              className="text-status-cancelled"
              onClick={() => (confirmandoBorrar ? void eliminar() : setConfirmandoBorrar(true))}
            >
              {confirmandoBorrar ? "Sí, eliminar" : "Eliminar"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="button" variant="gold" disabled={guardando || Boolean(problema)} onClick={() => void guardar()}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
