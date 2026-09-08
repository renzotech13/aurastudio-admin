import { useEffect, useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase"
import { registrarWalkIn, BotApiError } from "@/lib/botApi"
import { useEquipo } from "@/lib/equipo"
import { LIMA_OFFSET } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Service } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type ClienteBreve = { id: string; nombre: string | null; telefono: string }

/** "2026-09-08T15:30" (lo que da un input datetime-local) → ISO con la zona de Lima. */
function aIsoLima(valorLocal: string): string {
  return `${valorLocal}:00${LIMA_OFFSET}`
}

/** Ahora, en el formato que espera un input datetime-local, en hora de Lima. */
function ahoraEnLima(): string {
  const partes = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date())
  // sv-SE da "2026-09-08 15:30"; el input quiere la T en medio.
  return partes.replace(" ", "T")
}

export default function WalkInDialog({
  open,
  onOpenChange,
  onGuardado,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGuardado: () => void
}) {
  const { sedes, profesionales } = useEquipo()
  const [servicios, setServicios] = useState<Service[]>([])
  const [asignaciones, setAsignaciones] = useState<{ profesional_id: string; sede_id: string }[]>([])
  const [especialidades, setEspecialidades] = useState<{ profesional_id: string; servicio_id: string }[]>([])

  const [busqueda, setBusqueda] = useState("")
  const [resultados, setResultados] = useState<ClienteBreve[]>([])
  const [cliente, setCliente] = useState<ClienteBreve | null>(null)
  const [nombre, setNombre] = useState("")
  const [telefono, setTelefono] = useState("")

  const [sedeId, setSedeId] = useState("")
  const [profesionalId, setProfesionalId] = useState("")
  const [servicioIds, setServicioIds] = useState<string[]>([])
  const [inicio, setInicio] = useState(ahoraEnLima())
  const [estado, setEstado] = useState<"completada" | "confirmada">("completada")
  const [comentario, setComentario] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    setBusqueda("")
    setResultados([])
    setCliente(null)
    setNombre("")
    setTelefono("")
    setServicioIds([])
    setProfesionalId("")
    setInicio(ahoraEnLima())
    setEstado("completada")
    setComentario("")

    Promise.all([
      supabase.from("services").select("*").eq("active", true).order("sort_order"),
      supabase.from("profesional_sedes").select("profesional_id,sede_id"),
      supabase.from("profesional_servicios").select("profesional_id,servicio_id"),
    ]).then(([svc, asig, esp]) => {
      setServicios((svc.data ?? []) as Service[])
      setAsignaciones(
        (asig.data ?? []).map((a) => ({
          profesional_id: a.profesional_id as string,
          sede_id: a.sede_id as string,
        })),
      )
      setEspecialidades(
        (esp.data ?? []).map((e) => ({
          profesional_id: e.profesional_id as string,
          servicio_id: e.servicio_id as string,
        })),
      )
    })
  }, [open])

  useEffect(() => {
    if (sedes.length > 0 && !sedeId) setSedeId(sedes[0].id)
  }, [sedes, sedeId])

  // Buscar clienta por nombre o teléfono, con una pausa para no consultar en
  // cada tecla.
  useEffect(() => {
    const termino = busqueda.trim()
    if (termino.length < 3 || cliente) {
      setResultados([])
      return
    }
    const id = setTimeout(async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id,nombre,telefono")
        .or(`nombre.ilike.%${termino}%,telefono.ilike.%${termino}%`)
        .limit(6)
      setResultados((data ?? []) as ClienteBreve[])
    }, 300)
    return () => clearTimeout(id)
  }, [busqueda, cliente])

  // Solo las que atienden en esa sede Y hacen todos los servicios elegidos:
  // la misma regla que la web, para que el panel no pueda crear una cita que
  // la reserva online consideraría imposible.
  const elegibles = useMemo(() => {
    const enSede = new Set(
      asignaciones.filter((a) => a.sede_id === sedeId).map((a) => a.profesional_id),
    )
    return profesionales.filter((p) => {
      if (!p.activa || !enSede.has(p.id)) return false
      if (servicioIds.length === 0) return true
      const suyos = new Set(
        especialidades.filter((e) => e.profesional_id === p.id).map((e) => e.servicio_id),
      )
      return servicioIds.every((s) => suyos.has(s))
    })
  }, [profesionales, asignaciones, especialidades, sedeId, servicioIds])

  // Si la elegida deja de calificar al cambiar sede o servicios, se limpia:
  // dejarla puesta mandaría al bot una combinación que va a rechazar.
  useEffect(() => {
    if (profesionalId && !elegibles.some((p) => p.id === profesionalId)) setProfesionalId("")
  }, [elegibles, profesionalId])

  const duracionTotal = useMemo(
    () =>
      servicioIds.reduce((suma, id) => {
        const s = servicios.find((x) => x.id === id)
        return suma + (s ? Number(s.duration.match(/\d+/)?.[0] ?? 0) : 0)
      }, 0),
    [servicioIds, servicios],
  )

  const valido =
    (!!cliente || (nombre.trim().length > 1 && telefono.replace(/\D/g, "").length >= 6)) &&
    servicioIds.length > 0 &&
    !!sedeId &&
    !!profesionalId &&
    !!inicio

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!valido) return
    setGuardando(true)
    try {
      await registrarWalkIn({
        ...(cliente ? { cliente_id: cliente.id } : { telefono: telefono.trim(), nombre: nombre.trim() }),
        servicio_ids: servicioIds,
        sede_id: sedeId,
        profesional_id: profesionalId,
        inicio: aIsoLima(inicio),
        estado,
        ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
      })
      toast.success("Atención registrada.", {
        description: "Si cobraste, regístralo también en Caja para que cuente en el arqueo.",
      })
      onOpenChange(false)
      onGuardado()
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo registrar.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar atención sin reserva</DialogTitle>
        </DialogHeader>

        <form onSubmit={guardar} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Clienta</Label>
            {cliente ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-gold bg-gold/10 px-3 py-2">
                <span className="text-[13px]">
                  {cliente.nombre?.trim() || "Sin nombre"}
                  <span className="ml-2 text-[11.5px] text-muted-foreground">{cliente.telefono}</span>
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCliente(null)}>
                  Cambiar
                </Button>
              </div>
            ) : (
              <>
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o teléfono…"
                />
                {resultados.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {resultados.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCliente(c)
                          setBusqueda("")
                        }}
                        className="rounded-lg border border-border px-3 py-2 text-left text-[12.5px] transition-colors hover:border-gold"
                      >
                        {c.nombre?.trim() || "Sin nombre"}
                        <span className="ml-2 text-muted-foreground">{c.telefono}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <p className="text-[11.5px] text-muted-foreground">
                  ¿No está registrada? Complétala abajo y se crea sola.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Nombre y apellido"
                  />
                  <Input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    inputMode="numeric"
                    placeholder="987 654 321"
                  />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Local</Label>
              <Select value={sedeId} onValueChange={(v) => setSedeId(v ?? "")}>
                <SelectTrigger className="h-10 w-full rounded-xl">
                  <SelectValue placeholder="Elegir local">
                    {(v) => sedes.find((s) => s.id === v)?.nombre ?? "Elegir local"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sedes
                    .filter((s) => s.activa)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="walkin-inicio">Cuándo</Label>
              <Input
                id="walkin-inicio"
                type="datetime-local"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Servicios</Label>
            <div className="max-h-52 overflow-y-auto rounded-xl border border-border p-2">
              {servicios.map((s) => (
                <label key={s.id} className="flex items-center gap-2 px-1 py-1 text-[12.5px]">
                  <input
                    type="checkbox"
                    checked={servicioIds.includes(s.id)}
                    onChange={() =>
                      setServicioIds((previos) =>
                        previos.includes(s.id)
                          ? previos.filter((x) => x !== s.id)
                          : [...previos, s.id],
                      )
                    }
                    className="size-3.5 accent-gold"
                  />
                  <span className="flex-1">{s.name}</span>
                  <span className="text-muted-foreground">S/ {s.price}</span>
                </label>
              ))}
            </div>
            {servicioIds.length > 0 ? (
              <p className="text-[11.5px] text-muted-foreground">
                {servicioIds.length} servicio{servicioIds.length === 1 ? "" : "s"} · {duracionTotal} min
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Profesional</Label>
            <Select value={profesionalId} onValueChange={(v) => setProfesionalId(v ?? "")}>
              <SelectTrigger className="h-10 w-full rounded-xl">
                <SelectValue placeholder="Elegir profesional">
                  {(v) => elegibles.find((p) => p.id === v)?.nombre ?? "Elegir profesional"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {elegibles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {elegibles.length === 0 ? (
              <p className="text-[11.5px] text-status-cancelled">
                Nadie en ese local hace todos los servicios elegidos. Quita alguno o cambia de local.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Estado</Label>
            <div className="flex gap-2">
              {(["completada", "confirmada"] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEstado(e)}
                  aria-pressed={estado === e}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2 text-[12.5px] transition-colors",
                    estado === e
                      ? "border-gold bg-gold/15 text-gold-deep dark:text-gold"
                      : "border-input text-muted-foreground hover:border-gold/50",
                  )}
                >
                  {e === "completada" ? "Ya se atendió" : "Está por atenderse"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="walkin-nota">Nota (opcional)</Label>
            <Textarea
              id="walkin-nota"
              rows={2}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Llegó sin cita, vino por recomendación…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="gold" disabled={!valido || guardando}>
              {guardando ? "Registrando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
