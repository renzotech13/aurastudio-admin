import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ImageIcon } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useServiceNames } from "@/lib/services"
import { useEquipo } from "@/lib/equipo"
import { fechaConDiaSemana, horaLima, money } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  CITA_ESTADO_LABEL,
  COMPROBANTE_ESTADO_LABEL,
  METODO_PAGO_LABEL,
  type Cita,
  type MovimientoCaja,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Cliente = {
  id: string
  nombre: string | null
  telefono: string
  email: string | null
  notas: string | null
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
      <span className="text-[11.5px] text-muted-foreground">{etiqueta}</span>
      <span className="text-right text-[13px]">{children}</span>
    </div>
  )
}

/**
 * Ficha de la clienta, abierta desde una reserva.
 *
 * Junta lo que hasta ahora estaba repartido: sus datos, su historial de citas,
 * el comprobante que mandó por WhatsApp y lo que realmente se le cobró en caja
 * (con el método: Yape, Plin, tarjeta…). El comprobante NO se enlaza directo
 * — el bucket es privado y el enlace se firma al momento, válido un minuto.
 */
export default function FichaClienteDialog({
  clienteId,
  citaDestacadaId,
  open,
  onOpenChange,
}: {
  clienteId: string | null
  citaDestacadaId?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { serviceName } = useServiceNames()
  const { nombreSede, nombreProfesional } = useEquipo()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [citas, setCitas] = useState<Cita[]>([])
  const [cobros, setCobros] = useState<MovimientoCaja[]>([])
  const [notas, setNotas] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!open || !clienteId) return
    let activo = true
    setCargando(true)

    async function cargar() {
      const [cliRes, citasRes, cobrosRes] = await Promise.all([
        supabase.from("clientes").select("id,nombre,telefono,email,notas").eq("id", clienteId).maybeSingle(),
        supabase
          .from("citas")
          .select("*")
          .eq("cliente_id", clienteId)
          .order("inicio_utc", { ascending: false })
          .limit(20),
        supabase
          .from("movimientos_caja")
          .select("*")
          .eq("cliente_id", clienteId)
          .eq("anulado", false)
          .order("ocurrido_at", { ascending: false })
          .limit(20),
      ])
      if (!activo) return
      if (cliRes.data) {
        setCliente(cliRes.data as Cliente)
        setNotas((cliRes.data as Cliente).notas ?? "")
      }
      if (citasRes.data) setCitas(citasRes.data as Cita[])
      // Los cobros son opcionales: si la caja no tiene nada de esta clienta,
      // la ficha igual sirve.
      if (cobrosRes.data) setCobros(cobrosRes.data as MovimientoCaja[])
      setCargando(false)
    }
    cargar()
    return () => {
      activo = false
    }
  }, [open, clienteId])

  async function verComprobante(path: string) {
    const { data, error } = await supabase.storage.from("comprobantes").createSignedUrl(path, 60)
    if (error || !data) {
      toast.error("No se pudo abrir el comprobante.")
      return
    }
    window.open(data.signedUrl, "_blank", "noreferrer")
  }

  async function guardarNotas() {
    if (!clienteId) return
    setGuardando(true)
    const { error } = await supabase.from("clientes").update({ notas: notas.trim() || null }).eq("id", clienteId)
    setGuardando(false)
    if (error) toast.error("No se pudieron guardar las notas.")
    else toast.success("Notas guardadas.")
  }

  const totalCobrado = cobros
    .filter((m) => m.tipo === "ingreso")
    .reduce((suma, m) => suma + Number(m.monto), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{cliente?.nombre?.trim() || "Clienta"}</DialogTitle>
        </DialogHeader>

        {cargando ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <section>
              <Dato etiqueta="WhatsApp">{cliente?.telefono ?? "—"}</Dato>
              <Dato etiqueta="Correo">{cliente?.email || "—"}</Dato>
              <Dato etiqueta="Citas registradas">{citas.length}</Dato>
              <Dato etiqueta="Cobrado en caja">
                <span className="tnum">{money(totalCobrado)}</span>
              </Dato>
            </section>

            <section>
              <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Citas
              </h4>
              {citas.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Sin citas registradas.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {citas.map((c) => (
                    <li
                      key={c.id}
                      className={cn(
                        "rounded-xl border p-3",
                        c.id === citaDestacadaId ? "border-gold bg-gold/10" : "border-border",
                      )}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[13px]">{serviceName(c.servicio_id)}</span>
                        <span className="text-[11.5px] text-muted-foreground">
                          {CITA_ESTADO_LABEL[c.estado]}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                        {fechaConDiaSemana(c.inicio_utc)} · {horaLima(c.inicio_utc)} ·{" "}
                        {nombreSede(c.sede_id)} · {nombreProfesional(c.profesional_id)}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-[11.5px] text-muted-foreground">
                          {COMPROBANTE_ESTADO_LABEL[c.comprobante_estado]}
                          {c.comprobante_monto_detectado != null
                            ? ` · ${money(c.comprobante_monto_detectado)} detectados`
                            : ""}
                        </span>
                        {c.comprobante_path ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => verComprobante(c.comprobante_path!)}
                          >
                            <ImageIcon className="size-4" />
                            Ver comprobante
                          </Button>
                        ) : null}
                      </div>
                      {c.comprobante_nota ? (
                        <p className="mt-1 text-[11.5px] text-muted-foreground">{c.comprobante_nota}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Cobros en caja
              </h4>
              {cobros.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  Nada cobrado a esta clienta todavía.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {cobros.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-border px-3 py-2"
                    >
                      <span className="text-[13px]">{m.concepto}</span>
                      <span className="text-[11.5px] text-muted-foreground">
                        {METODO_PAGO_LABEL[m.metodo]} · {nombreProfesional(m.profesional_id)} ·{" "}
                        <span className="tnum">{money(Number(m.monto))}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Notas internas
              </h4>
              <Textarea
                rows={3}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Alergias, preferencias, historial de color…"
              />
              <div className="flex justify-end">
                <Button variant="gold" size="sm" onClick={guardarNotas} disabled={guardando}>
                  {guardando ? "Guardando…" : "Guardar notas"}
                </Button>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
