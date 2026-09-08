import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { estadoCanales, type EstadoCanales, BotApiError } from "@/lib/botApi"
import { CanalIcon, CANAL_LABEL } from "@/lib/canales"
import { CANALES, type Canal, type CanalConfig, type RespuestaRapida } from "@/lib/types"
import { PageHeader } from "@/components/PageHeader"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RespuestaFormDialog } from "./RespuestaFormDialog"

function fechaHora(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

function CanalCard({
  config,
  estado,
  onChange,
}: {
  config: CanalConfig
  estado: EstadoCanales | null
  onChange: (patch: Partial<CanalConfig>) => Promise<void>
}) {
  const [texto, setTexto] = useState(config.texto_respuesta_privada ?? "")
  const [guardandoTexto, setGuardandoTexto] = useState(false)

  useEffect(() => {
    setTexto(config.texto_respuesta_privada ?? "")
  }, [config.texto_respuesta_privada])

  const salud =
    config.canal === "whatsapp"
      ? estado?.whatsapp
      : config.canal === "messenger"
        ? estado?.messenger
        : estado?.instagram
  const configurado = salud?.configurado ?? false

  async function guardarTexto() {
    if (texto.trim() === (config.texto_respuesta_privada ?? "")) return
    setGuardandoTexto(true)
    await onChange({ texto_respuesta_privada: texto.trim() || null })
    setGuardandoTexto(false)
  }

  return (
    <Card crest>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <CanalIcon canal={config.canal} className="size-5 text-[11px]" />
          {CANAL_LABEL[config.canal]}
        </CardTitle>
        <Badge variant={configurado ? "default" : "outline"}>{configurado ? "Configurado" : "Sin configurar"}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12.5px]">
          <dt className="text-muted-foreground">Cuenta detectada</dt>
          <dd className="text-right text-foreground">
            {config.canal === "messenger"
              ? (estado?.messenger.pagina ?? config.cuenta_nombre ?? "—")
              : config.canal === "instagram"
                ? (estado?.instagram.username ? `@${estado.instagram.username}` : (config.cuenta_nombre ?? "—"))
                : (estado?.whatsapp.numero ?? config.cuenta_nombre ?? "—")}
          </dd>
          {config.canal === "messenger" && (
            <>
              <dt className="text-muted-foreground">Webhook suscrito</dt>
              <dd className="text-right text-foreground">{estado?.messenger.suscrito ? "Sí" : "No"}</dd>
              <dt className="text-muted-foreground">Token vence</dt>
              <dd className="text-right text-foreground">{fechaHora(estado?.messenger.tokenVence ?? null)}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Último evento recibido</dt>
          <dd className="text-right text-foreground">{fechaHora(config.ultimo_webhook_at)}</dd>
        </dl>

        <div className="flex flex-col gap-3 border-t border-border/70 pt-3">
          <label className="flex items-center justify-between gap-3 text-[13px]">
            <span>Canal activo</span>
            <Switch checked={config.activo} onCheckedChange={(v) => onChange({ activo: v })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-[13px]">
            <span>IA responde mensajes nuevos</span>
            <Switch checked={config.ia_activa} onCheckedChange={(v) => onChange({ ia_activa: v })} />
          </label>
          {config.canal !== "whatsapp" && (
            <label className="flex items-center justify-between gap-3 text-[13px]">
              <span>IA responde comentarios (privado)</span>
              <Switch checked={config.ia_comentarios_activa} onCheckedChange={(v) => onChange({ ia_comentarios_activa: v })} />
            </label>
          )}
          <p className="text-[11.5px] text-muted-foreground">
            {config.activo
              ? config.ia_activa
                ? "Con la IA activa, los mensajes nuevos se responden solos."
                : "Con la IA apagada, los mensajes nuevos quedan en la bandeja como sin responder — alguien del equipo tiene que entrar a contestarlos."
              : "Con el canal apagado, el bot recibe los mensajes pero no hace nada con ellos."}
          </p>
        </div>

        {config.canal !== "whatsapp" && (
          <div className="flex flex-col gap-2 border-t border-border/70 pt-3">
            <span className="text-[13px]">Respuesta privada automática al comentario</span>
            <Textarea
              rows={3}
              placeholder="Gracias por tu comentario, te escribimos por acá con los detalles…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onBlur={guardarTexto}
              disabled={guardandoTexto}
            />
            <p className="text-[11.5px] text-muted-foreground">
              Se usa una sola vez por comentario — Meta no deja mandar una segunda. Revísala antes de prender el interruptor de arriba.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function Canales() {
  const [configs, setConfigs] = useState<CanalConfig[]>([])
  const [estado, setEstado] = useState<EstadoCanales | null>(null)
  const [cargando, setCargando] = useState(true)
  const [respuestas, setRespuestas] = useState<RespuestaRapida[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<RespuestaRapida | null>(null)

  async function cargarCanales() {
    const { data, error } = await supabase.from("canales").select("*")
    if (error) toast.error("No se pudieron cargar los canales.")
    else setConfigs((data as CanalConfig[]).sort((a, b) => CANALES.indexOf(a.canal) - CANALES.indexOf(b.canal)))
  }

  async function cargarRespuestas() {
    const { data, error } = await supabase.from("respuestas_rapidas").select("*").order("sort_order")
    if (error) toast.error("No se pudieron cargar las respuestas rápidas.")
    else setRespuestas(data as RespuestaRapida[])
  }

  useEffect(() => {
    setCargando(true)
    Promise.all([
      cargarCanales(),
      cargarRespuestas(),
      estadoCanales()
        .then(setEstado)
        .catch((err) => {
          if (!(err instanceof BotApiError && err.code === "sin_configurar")) {
            toast.error("No se pudo consultar el estado de los canales con el bot.")
          }
        }),
    ]).then(() => setCargando(false))

    const canal = supabase
      .channel("canales-config")
      .on("postgres_changes", { event: "*", schema: "public", table: "canales" }, cargarCanales)
      .on("postgres_changes", { event: "*", schema: "public", table: "respuestas_rapidas" }, cargarRespuestas)
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [])

  async function actualizarCanal(canal: Canal, patch: Partial<CanalConfig>) {
    const previos = configs
    setConfigs((rows) => rows.map((c) => (c.canal === canal ? { ...c, ...patch } : c)))
    const { error } = await supabase.from("canales").update(patch).eq("canal", canal)
    if (error) {
      setConfigs(previos)
      toast.error("No se pudo guardar el cambio.")
    }
  }

  async function moverRespuesta(index: number, direccion: -1 | 1) {
    const destino = index + direccion
    if (destino < 0 || destino >= respuestas.length) return
    const a = respuestas[index]
    const b = respuestas[destino]
    const previas = respuestas
    const reordenadas = [...respuestas]
    reordenadas[index] = { ...b, sort_order: a.sort_order }
    reordenadas[destino] = { ...a, sort_order: b.sort_order }
    reordenadas.sort((x, y) => x.sort_order - y.sort_order)
    setRespuestas(reordenadas)

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("respuestas_rapidas").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("respuestas_rapidas").update({ sort_order: a.sort_order }).eq("id", b.id),
    ])
    if (e1 || e2) {
      setRespuestas(previas)
      toast.error("No se pudo reordenar.")
    }
  }

  async function alternarActiva(respuesta: RespuestaRapida) {
    const previas = respuestas
    setRespuestas((rows) => rows.map((r) => (r.id === respuesta.id ? { ...r, activa: !r.activa } : r)))
    const { error } = await supabase.from("respuestas_rapidas").update({ activa: !respuesta.activa }).eq("id", respuesta.id)
    if (error) {
      setRespuestas(previas)
      toast.error("No se pudo actualizar.")
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
      <PageHeader eyebrow="Operación" titulo="Canales" descripcion="Estado, interruptores y respuestas rápidas de WhatsApp, Messenger e Instagram." />

      {cargando ? (
        <div className="mb-8 grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[360px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="mb-8 grid gap-4 lg:grid-cols-3">
          {configs.map((c) => (
            <CanalCard key={c.canal} config={c} estado={estado} onChange={(patch) => actualizarCanal(c.canal, patch)} />
          ))}
        </div>
      )}

      <PageHeader
        titulo="Respuestas rápidas"
        descripcion={'Se insertan escribiendo "/atajo" en el compositor de la bandeja.'}
        acciones={
          <Button
            variant="gold"
            onClick={() => {
              setEditando(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" />
            Nueva respuesta
          </Button>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        {cargando ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : respuestas.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">Todavía no hay respuestas rápidas.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Atajo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Activa</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {respuestas.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moverRespuesta(i, -1)}
                          disabled={i === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                          aria-label="Subir"
                        >
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moverRespuesta(i, 1)}
                          disabled={i === respuestas.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                          aria-label="Bajar"
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">/{r.atajo}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{r.titulo}</TableCell>
                    <TableCell>
                      {r.canal ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CanalIcon canal={r.canal} />
                          {CANAL_LABEL[r.canal]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Todos</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch checked={r.activa} onCheckedChange={() => alternarActiva(r)} />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditando(r)
                          setDialogOpen(true)
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <RespuestaFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        respuesta={editando}
        nextSortOrder={respuestas.length ? Math.max(...respuestas.map((r) => r.sort_order)) + 1 : 0}
        onSaved={cargarRespuestas}
      />
    </div>
  )
}
