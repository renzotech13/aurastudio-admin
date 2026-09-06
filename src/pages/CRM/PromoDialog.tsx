import { useEffect, useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { CircleAlert, Info } from "lucide-react"
import { enviarPromocion, listarPlantillas, BotApiError, type PlantillaWhatsapp } from "@/lib/botApi"
import { ETIQUETA_CLASSES, type Cliente, type Etiqueta } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const ESTADO_LABEL: Record<PlantillaWhatsapp["estado"], string> = {
  APPROVED: "Aprobada",
  PENDING: "En revisión",
  REJECTED: "Rechazada",
  PAUSED: "Pausada",
  DISABLED: "Deshabilitada",
}

const CATEGORIA_LABEL: Record<PlantillaWhatsapp["categoria"], string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidad",
  AUTHENTICATION: "Autenticación",
}

export default function PromoDialog({
  open,
  onOpenChange,
  etiquetas,
  etiquetasPorCliente,
  clientes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  etiquetas: Etiqueta[]
  etiquetasPorCliente: Map<string, Etiqueta[]>
  clientes: Cliente[]
}) {
  const [plantillas, setPlantillas] = useState<PlantillaWhatsapp[]>([])
  const [cargandoPlantillas, setCargandoPlantillas] = useState(false)
  const [errorPlantillas, setErrorPlantillas] = useState<string | null>(null)
  const [nombrePlantilla, setNombrePlantilla] = useState("")
  const [parametros, setParametros] = useState<string[]>([])
  const [seleccionadas, setSeleccionadas] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)

  // Se piden recién al abrir, no al montar la página entera: es una llamada
  // a Meta por afuera de Supabase, no hace falta pagarla si nadie va a mandar
  // una promoción en esta sesión.
  useEffect(() => {
    if (!open) return
    let activo = true
    setCargandoPlantillas(true)
    setErrorPlantillas(null)
    listarPlantillas()
      .then(({ plantillas: lista }) => {
        if (activo) setPlantillas(lista)
      })
      .catch((err) => {
        if (activo) {
          setErrorPlantillas(err instanceof BotApiError ? err.message : "No se pudieron cargar las plantillas.")
        }
      })
      .finally(() => {
        if (activo) setCargandoPlantillas(false)
      })
    return () => {
      activo = false
    }
  }, [open])

  const plantilla = plantillas.find((p) => p.nombre === nombrePlantilla) ?? null

  // De marketing y aprobadas: son las únicas que Meta deja usar para una
  // campaña. Las de utilidad (como recordatorio_cita) existen para avisos de
  // una cita puntual — usarlas para promocionar viola la política de Meta y
  // arriesga la calificación de calidad del número.
  const utilizables = useMemo(
    () => plantillas.filter((p) => p.estado === "APPROVED" && p.categoria === "MARKETING"),
    [plantillas],
  )
  const noUtilizables = useMemo(
    () => plantillas.filter((p) => !utilizables.includes(p)),
    [plantillas, utilizables],
  )

  // El número de campos de variable sigue a la plantilla elegida, no a
  // clics de "agregar" — así no se puede mandar con menos o más parámetros
  // de los que el cuerpo aprobado realmente tiene.
  useEffect(() => {
    setParametros(plantilla ? Array.from({ length: plantilla.variables }, () => "") : [])
  }, [plantilla])

  // La lista sale de TODA la base de clientas (haya escrito o no al bot
  // antes) — así se puede targetear también a las importadas offline, no
  // solo a quienes ya tienen una conversación.
  const destinatarios = useMemo(() => {
    if (seleccionadas.length === 0) return clientes.map((c) => c.id)
    return clientes
      .filter((c) => (etiquetasPorCliente.get(c.id) ?? []).some((e) => seleccionadas.includes(e.id)))
      .map((c) => c.id)
  }, [clientes, etiquetasPorCliente, seleccionadas])

  function alternarEtiqueta(id: string) {
    setSeleccionadas((previas) => (previas.includes(id) ? previas.filter((e) => e !== id) : [...previas, id]))
  }

  function reset() {
    setNombrePlantilla("")
    setParametros([])
    setSeleccionadas([])
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!plantilla || destinatarios.length === 0) return
    // Con variables vacías Meta rechaza el envío entero; mejor decirlo antes
    // de gastar la cuota de mensajes que avisar cliente por cliente.
    if (parametros.some((p) => !p.trim())) {
      toast.error("Completa todas las variables de la plantilla antes de enviar.")
      return
    }

    setEnviando(true)
    try {
      const resultado = await enviarPromocion({
        clienteIds: destinatarios,
        plantilla: plantilla.nombre,
        ...(parametros.length > 0 ? { parametros } : {}),
      })

      if (resultado.fallidas.length > 0) {
        toast.warning(`Enviadas ${resultado.enviadas}, fallaron ${resultado.fallidas.length}.`)
      } else {
        toast.success(`Promoción enviada a ${resultado.enviadas} clienta(s).`)
      }
      onOpenChange(false)
      reset()
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo enviar la promoción.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar promoción</DialogTitle>
        </DialogHeader>

        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Solo aparecen las plantillas de <strong>Marketing ya aprobadas</strong> por Meta. Créalas en el
              Administrador de WhatsApp — las de Utilidad (como los recordatorios de cita) no se pueden usar para
              promociones.
            </span>
          </div>

          <div className="grid gap-2">
            <Label>Plantilla</Label>
            {cargandoPlantillas ? (
              <p className="text-xs text-muted-foreground">Consultando el Administrador de WhatsApp…</p>
            ) : errorPlantillas ? (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <CircleAlert className="size-3.5 shrink-0" />
                {errorPlantillas}
              </p>
            ) : utilizables.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Todavía no hay ninguna plantilla de Marketing aprobada. Créala en el Administrador de WhatsApp y
                espera su aprobación antes de mandar una campaña.
              </p>
            ) : (
              <Select value={nombrePlantilla} onValueChange={(v) => setNombrePlantilla(v ?? "")}>
                <SelectTrigger className="h-10 w-full rounded-xl">
                  <SelectValue placeholder="Elegir plantilla">
                    {(v) => utilizables.find((p) => p.nombre === v)?.nombre ?? "Elegir plantilla"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {utilizables.map((p) => (
                    <SelectItem key={p.nombre} value={p.nombre}>
                      {p.nombre} · {p.variables} variable{p.variables === 1 ? "" : "s"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {noUtilizables.length > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                No disponibles todavía:{" "}
                {noUtilizables
                  .map((p) => `${p.nombre} (${CATEGORIA_LABEL[p.categoria]} · ${ESTADO_LABEL[p.estado]})`)
                  .join(", ")}
                .
              </p>
            ) : null}
          </div>

          {plantilla && plantilla.variables > 0 ? (
            <div className="grid gap-2">
              <Label>Variables de la plantilla</Label>
              <p className="text-xs text-muted-foreground">
                En orden, rellenan los {"{{1}}"}, {"{{2}}"}… del cuerpo aprobado.
              </p>
              {parametros.map((valor, i) => (
                <Input
                  key={i}
                  value={valor}
                  onChange={(e) =>
                    setParametros((previos) => previos.map((p, idx) => (idx === i ? e.target.value : p)))
                  }
                  placeholder={`Valor para {{${i + 1}}}`}
                  className="h-9 text-xs"
                />
              ))}
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label>Destinatarias</Label>
            {etiquetas.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aún no hay etiquetas. Se enviará a todas las clientas registradas.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {etiquetas.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => alternarEtiqueta(e.id)}
                    className={cn(
                      "rounded px-2 py-1 text-xs font-medium transition-opacity",
                      ETIQUETA_CLASSES[e.color],
                      !seleccionadas.includes(e.id) && "opacity-40",
                    )}
                  >
                    {e.nombre}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {seleccionadas.length === 0
                ? "Sin filtro: todas las clientas registradas."
                : "Solo quienes tengan alguna de las etiquetas marcadas."}{" "}
              <strong className="text-foreground">{destinatarios.length} destinataria(s).</strong>
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando || !plantilla || destinatarios.length === 0}>
              {enviando ? "Enviando…" : `Enviar a ${destinatarios.length}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
