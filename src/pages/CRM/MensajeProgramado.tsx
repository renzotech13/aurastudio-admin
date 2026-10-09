import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase"
import { aIsoLima, hoyLima, sumarDias } from "@/lib/agenda"
import { cn } from "@/lib/utils"
import type { ConversacionResumen } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * «Programar un mensaje»: alguien del equipo deja escrito el texto y la hora
 * (hora de Lima) y el bot lo manda solo, como si lo hubiera escrito esa
 * persona desde el panel. Lo envía bot/src/seguimientos/programados.ts, que
 * lee la tabla `mensajes_programados` (migración 0021).
 *
 * El canal solo deja escribir texto libre hasta 24 h después del último mensaje
 * de ella: más allá no se puede programar. Se avisa antes de guardar, no
 * después de que el mensaje falle sin que nadie se entere.
 */

type Programado = {
  id: string
  texto: string
  programado_para: string
  cancelar_si_responde: boolean
  estado: "pendiente" | "enviando" | "enviado" | "fallido" | "cancelado"
  detalle: string | null
  enviado_at: string | null
}

const VENTANA_MS = 24 * 60 * 60_000
/** Margen para que el mensaje no salga justo cuando la ventana se cierra. */
const MARGEN_VENTANA_MS = 10 * 60_000

const ESTADO_TEXTO: Record<Programado["estado"], string> = {
  pendiente: "Programado",
  enviando: "Saliendo…",
  enviado: "Enviado",
  fallido: "No salió",
  cancelado: "Cancelado",
}

const ESTADO_COLOR: Record<Programado["estado"], string> = {
  pendiente: "text-gold-deep dark:text-gold",
  enviando: "text-muted-foreground",
  enviado: "text-status-confirmed",
  fallido: "text-status-cancelled",
  cancelado: "text-muted-foreground",
}

function instante(fecha: string, hora: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return null
  const d = new Date(aIsoLima(`${fecha}T${hora}`))
  return Number.isNaN(d.getTime()) ? null : d
}

/** «hoy 4:30 p. m.», «mañana 10:00 a. m.» o «mié 7 oct, 3:00 p. m.». */
function cuando(iso: string): string {
  const d = new Date(iso)
  const hora = d.toLocaleTimeString("es-PE", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Lima" })
  const dia = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima" }).format(d)
  const hoy = hoyLima()
  if (dia === hoy) return `hoy ${hora}`
  if (dia === sumarDias(hoy, 1)) return `mañana ${hora}`
  const fecha = d.toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Lima" })
  return `${fecha}, ${hora}`
}

function primerNombre(nombre: string | null): string {
  const n = (nombre ?? "").trim().split(/\s+/)[0] ?? ""
  // Nombres de perfil raros («comienza ser tu misma ☺») no van en el saludo.
  return /^[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}$/.test(n) ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : ""
}

function textoSugerido(nombre: string | null): string {
  const n = primerNombre(nombre)
  return `Hola${n ? ` ${n}` : ""} 💛 Te escribo como quedamos. ¿Te ayudo a separar tu cita? Tenemos espacios esta semana.`
}

export default function MensajeProgramado({
  conversacion,
  open,
  onOpenChange,
}: {
  conversacion: ConversacionResumen
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [lista, setLista] = useState<Programado[]>([])
  const [errorTabla, setErrorTabla] = useState(false)
  // «Ahora» vive en el estado: el render no puede leer el reloj.
  const [ahora, setAhora] = useState(() => Date.now())
  const [version, setVersion] = useState(0)
  const [texto, setTexto] = useState("")
  const [fecha, setFecha] = useState(hoyLima)
  const [hora, setHora] = useState("16:30")
  const [cancelarSiResponde, setCancelarSiResponde] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const conversacionId = conversacion.id

  // Cada vez que se abre arranca limpio, con un texto sugerido que se puede borrar.
  useEffect(() => {
    if (!open) return
    setTexto(textoSugerido(conversacion.cliente_nombre))
    setFecha(hoyLima())
    setHora("16:30")
    setCancelarSiResponde(true)
    setAhora(Date.now())
  }, [open, conversacion.cliente_nombre])

  useEffect(() => {
    if (!open) return
    let activo = true
    supabase
      .from("mensajes_programados")
      .select("id, texto, programado_para, cancelar_si_responde, estado, detalle, enviado_at")
      .eq("conversacion_id", conversacionId)
      .order("programado_para", { ascending: false })
      .limit(6)
      .then(({ data, error }) => {
        if (!activo) return
        setErrorTabla(Boolean(error))
        if (!error) setLista((data ?? []) as Programado[])
      })
    return () => {
      activo = false
    }
  }, [open, conversacionId, version])

  const recargar = useCallback(() => setVersion((v) => v + 1), [])

  // Mientras haya uno por salir se vuelve a leer la lista para ver cuándo sale (o por qué no).
  const hayPendientes = lista.some((p) => p.estado === "pendiente" || p.estado === "enviando")
  useEffect(() => {
    if (!open) return
    const t = setInterval(() => {
      setAhora(Date.now())
      if (hayPendientes) recargar()
    }, 30_000)
    return () => clearInterval(t)
  }, [open, hayPendientes, recargar])

  const momento = instante(fecha, hora)
  const cierreVentana = new Date(conversacion.ultimo_mensaje_at).getTime() + VENTANA_MS - MARGEN_VENTANA_MS
  const problema = !momento
    ? "Elige el día y la hora."
    : momento.getTime() < ahora + 60_000
      ? "Esa hora ya pasó."
      : momento.getTime() > cierreVentana
        ? `Para esa hora ya se cierra la ventana de 24 h de ${conversacion.canal === "whatsapp" ? "WhatsApp" : "este canal"} (se cierra ${cuando(new Date(cierreVentana).toISOString())}). Programa antes.`
        : !texto.trim()
          ? "Escribe el mensaje."
          : null

  function elegir(dias: number, hhmm: string) {
    setAhora(Date.now())
    setFecha(sumarDias(hoyLima(), dias))
    setHora(hhmm)
  }

  async function programar() {
    if (problema || !momento) return
    setGuardando(true)
    const { error } = await supabase.from("mensajes_programados").insert({
      conversacion_id: conversacionId,
      texto: texto.trim(),
      programado_para: momento.toISOString(),
      cancelar_si_responde: cancelarSiResponde,
    })
    setGuardando(false)
    if (error) {
      toast.error("No se pudo programar el mensaje. Vuelve a intentarlo.")
      return
    }
    toast.success(`Listo: sale ${cuando(momento.toISOString())}.`)
    recargar()
    onOpenChange(false)
  }

  async function cancelar(id: string) {
    const { error } = await supabase
      .from("mensajes_programados")
      .update({ estado: "cancelado", detalle: "Cancelado desde el panel." })
      .eq("id", id)
      .eq("estado", "pendiente")
    if (error) toast.error("No se pudo cancelar.")
    else toast.success("Cancelado: no se va a mandar.")
    recargar()
  }

  const chip =
    "min-h-9 rounded-full border border-border px-3 text-[12px] text-muted-foreground transition-colors hover:border-gold/60 hover:text-foreground"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Programar un mensaje</DialogTitle>
        </DialogHeader>

        {errorTabla ? (
          <p className="text-[13px] text-muted-foreground">
            Falta activar los mensajes programados en la base de datos (migración 0021).
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {lista.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {lista.map((p) => (
                  <li key={p.id} className="rounded-xl border border-border p-3 text-[13px]">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn("text-[10.5px] font-semibold tracking-[0.12em] uppercase", ESTADO_COLOR[p.estado])}>
                        {ESTADO_TEXTO[p.estado]} ·{" "}
                        {cuando(p.estado === "enviado" && p.enviado_at ? p.enviado_at : p.programado_para)}
                      </span>
                      {p.estado === "pendiente" ? (
                        <button
                          type="button"
                          onClick={() => void cancelar(p.id)}
                          className="text-[11.5px] font-medium text-status-cancelled"
                        >
                          Cancelar
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-muted-foreground">{p.texto}</p>
                    {p.detalle && p.estado !== "enviado" ? (
                      <p className="mt-1 text-[12px] text-muted-foreground">{p.detalle}</p>
                    ) : null}
                    {p.estado === "pendiente" && p.cancelar_si_responde ? (
                      <p className="mt-1 text-[12px] text-muted-foreground">Si ella escribe antes, no se manda.</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="prog-texto">Mensaje</Label>
              <Textarea
                id="prog-texto"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={4}
                maxLength={4000}
                className="rounded-xl"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => elegir(0, "16:30")} className={chip}>
                Hoy 4:30 pm
              </button>
              <button type="button" onClick={() => elegir(0, "18:00")} className={chip}>
                Hoy 6:00 pm
              </button>
              <button type="button" onClick={() => elegir(1, "10:00")} className={chip}>
                Mañana 10 am
              </button>
            </div>

            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="prog-fecha">Día</Label>
                <Input id="prog-fecha" type="date" value={fecha} min={hoyLima()} onChange={(e) => setFecha(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="flex w-32 flex-col gap-2">
                <Label htmlFor="prog-hora">Hora (Lima)</Label>
                <Input id="prog-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="h-11 rounded-xl" />
              </div>
            </div>

            <label className="flex items-start gap-2 text-[12.5px] text-muted-foreground">
              <input
                type="checkbox"
                checked={cancelarSiResponde}
                onChange={(e) => setCancelarSiResponde(e.target.checked)}
                className="mt-0.5 size-4 accent-gold"
              />
              No mandarlo si ella escribe antes de esa hora
            </label>

            {problema ? (
              <p role="alert" className="text-[12.5px] text-status-cancelled">
                {problema}
              </p>
            ) : null}
            <p className="text-[12px] text-muted-foreground">
              Sale a su nombre desde el WhatsApp del bot, como si lo escribieras tú, y queda en este chat.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {!errorTabla ? (
            <Button type="button" variant="gold" disabled={guardando || Boolean(problema)} onClick={() => void programar()}>
              {guardando ? "Guardando…" : momento && !problema ? `Programar · ${cuando(momento.toISOString())}` : "Programar"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
