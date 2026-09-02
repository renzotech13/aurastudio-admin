import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { money, precioNumerico } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  CATEGORIAS_EGRESO,
  CATEGORIAS_INGRESO,
  METODOS_PAGO,
  METODO_PAGO_LABEL,
  type CategoriaMovimiento,
  type MetodoPago,
  type MovimientoTipo,
  type Service,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export function MovimientoDialog({
  open,
  onOpenChange,
  sesionId,
  tipoInicial = "ingreso",
  onGuardado,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Sesión de caja abierta; si no hay, el movimiento queda sin turno. */
  sesionId: string | null
  tipoInicial?: MovimientoTipo
  onGuardado: () => void
}) {
  const { session } = useAuth()
  const [tipo, setTipo] = useState<MovimientoTipo>(tipoInicial)
  const [categoria, setCategoria] = useState<CategoriaMovimiento>("servicio")
  const [concepto, setConcepto] = useState("")
  const [monto, setMonto] = useState("")
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo")
  const [servicioId, setServicioId] = useState<string>("")
  const [nota, setNota] = useState("")
  const [servicios, setServicios] = useState<Service[]>([])
  const [guardando, setGuardando] = useState(false)

  const categorias = tipo === "ingreso" ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO

  useEffect(() => {
    if (!open) return
    setTipo(tipoInicial)
    setCategoria(tipoInicial === "ingreso" ? "servicio" : "insumo")
    setConcepto("")
    setMonto("")
    setMetodo("efectivo")
    setServicioId("")
    setNota("")
  }, [open, tipoInicial])

  useEffect(() => {
    if (!open) return
    void supabase
      .from("services")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => setServicios((data ?? []) as Service[]))
  }, [open])

  // Al elegir un servicio se propone su precio, pero solo si es un número
  // limpio: los "Consultar" y los rangos los pone una persona.
  function elegirServicio(id: string) {
    setServicioId(id)
    const s = servicios.find((x) => x.id === id)
    if (!s) return
    setConcepto(s.name)
    const precio = precioNumerico(s.price)
    if (precio !== null && !monto) setMonto(String(precio))
  }

  const montoNum = useMemo(() => {
    const n = Number(monto.replace(",", "."))
    return Number.isFinite(n) ? n : 0
  }, [monto])

  const valido = montoNum > 0 && concepto.trim().length > 0

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!valido || !session) return
    setGuardando(true)

    const conceptoFinal = nota.trim()
      ? `${concepto.trim()} — ${nota.trim()}`
      : concepto.trim()

    const { error } = await supabase.from("movimientos_caja").insert({
      sesion_id: sesionId,
      tipo,
      categoria,
      concepto: conceptoFinal,
      monto: montoNum,
      metodo,
      servicio_id: tipo === "ingreso" && servicioId ? servicioId : null,
      registrado_por: session.user.id,
    })

    setGuardando(false)

    if (error) {
      toast.error(`No se pudo registrar: ${error.message}`)
      return
    }

    toast.success(
      `${tipo === "ingreso" ? "Ingreso" : "Egreso"} de ${money(montoNum)} registrado`
    )
    onOpenChange(false)
    onGuardado()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
          <DialogDescription>
            {sesionId
              ? "Entra al turno de caja abierto."
              : "No hay caja abierta: el movimiento queda registrado sin turno y no entra al arqueo."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={guardar} className="space-y-4">
          {/* Ingreso / egreso: la decisión que cambia todo lo demás. */}
          <div className="grid grid-cols-2 gap-2 rounded-full border border-border bg-surface-2/60 p-1">
            {(["ingreso", "egreso"] as MovimientoTipo[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTipo(t)
                  setCategoria(t === "ingreso" ? "servicio" : "insumo")
                }}
                aria-pressed={tipo === t}
                className={cn(
                  "rounded-full py-2 text-[12px] tracking-[0.12em] uppercase transition-all duration-300",
                  "focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none",
                  tipo === t
                    ? t === "ingreso"
                      ? "bg-status-confirmed-bg text-status-confirmed"
                      : "bg-status-cancelled-bg text-status-cancelled"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "ingreso" ? "Ingreso" : "Egreso"}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mov-monto">Monto (S/)</Label>
              <Input
                id="mov-monto"
                inputMode="decimal"
                placeholder="0.00"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="tnum text-lg"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select
                value={categoria}
                onValueChange={(v) => setCategoria(v as CategoriaMovimiento)}
              >
                <SelectTrigger className="h-10 w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tipo === "ingreso" && categoria === "servicio" ? (
            <div className="space-y-1.5">
              <Label>Servicio de la carta (opcional)</Label>
              <Select value={servicioId} onValueChange={(v) => elegirServicio(v as string)}>
                <SelectTrigger className="h-10 w-full rounded-xl">
                  <SelectValue placeholder="Elegir de la carta" />
                </SelectTrigger>
                <SelectContent>
                  {servicios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} · {s.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Ligarlo a la carta alimenta el ranking de servicios más vendidos.
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="mov-concepto">Concepto</Label>
            <Input
              id="mov-concepto"
              placeholder={tipo === "ingreso" ? "Balayage + tratamiento" : "Compra de tintes"}
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Método de pago</Label>
            <div className="flex flex-wrap gap-1.5">
              {METODOS_PAGO.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetodo(m)}
                  aria-pressed={metodo === m}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12px] transition-all duration-300",
                    "focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none",
                    metodo === m
                      ? "border-gold bg-gold text-[#33200f]"
                      : "border-border text-muted-foreground hover:border-gold/50 hover:text-foreground"
                  )}
                >
                  {METODO_PAGO_LABEL[m]}
                </button>
              ))}
            </div>
            {metodo === "efectivo" ? (
              <p className="text-[11px] text-muted-foreground">
                El efectivo es lo único que entra al arqueo del cajón.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mov-nota">Nota (opcional)</Label>
            <Textarea
              id="mov-nota"
              rows={2}
              placeholder="Se añade al concepto"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              variant="gold"
              size="cta"
              disabled={!valido || guardando}
            >
              {guardando ? "Guardando…" : `Registrar ${money(montoNum)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
