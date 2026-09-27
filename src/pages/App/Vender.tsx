import { useEffect, useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Check } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { registrarVentaProfesional, BotApiError } from "@/lib/botApi"
import { useAuth } from "@/lib/auth"
import { useEquipo } from "@/lib/equipo"
import { money } from "@/lib/format"
import { cn } from "@/lib/utils"
import { METODOS_PAGO, METODO_PAGO_LABEL, type MetodoPago } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Mismo tope que el bot (MAX_VENTA_SOLES): si se pasa, el bot la rechaza igual,
// pero así se avisa antes de mandar y no después.
const MAX_VENTA = 1500

type VentaAnotada = { id: string; concepto: string; monto: number; metodo: MetodoPago }

/**
 * Anotar la venta de un producto (un shampoo, una mascarilla). Cae en la caja
 * abierta de su local como ingreso de «producto», a su nombre. Si no hay caja
 * abierta, el bot lo dice y no se anota nada: eso lo abre recepción.
 */
export default function Vender() {
  const { profesionalId } = useAuth()
  const { sedes } = useEquipo()

  const [misSedes, setMisSedes] = useState<string[]>([])
  const [sedeId, setSedeId] = useState("")
  const [concepto, setConcepto] = useState("")
  const [monto, setMonto] = useState("")
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo")
  const [guardando, setGuardando] = useState(false)
  // Solo vive en pantalla: es la confirmación de lo que acaba de anotar, no un
  // historial. Lo que cuenta para el arqueo está en la Caja de recepción.
  const [anotadas, setAnotadas] = useState<VentaAnotada[]>([])

  useEffect(() => {
    if (!profesionalId) return
    let activo = true
    supabase
      .from("profesional_sedes")
      .select("sede_id")
      .eq("profesional_id", profesionalId)
      .then(({ data }) => {
        if (activo) setMisSedes((data ?? []).map((r) => r.sede_id as string))
      })
    return () => {
      activo = false
    }
  }, [profesionalId])

  const sedesElegibles = useMemo(() => sedes.filter((s) => s.activa && misSedes.includes(s.id)), [sedes, misSedes])

  useEffect(() => {
    if (!sedeId && sedesElegibles.length > 0) setSedeId(sedesElegibles[0].id)
  }, [sedesElegibles, sedeId])

  const montoNum = Number(monto.replace(",", "."))
  const montoValido = Number.isFinite(montoNum) && montoNum > 0 && montoNum <= MAX_VENTA
  const valido = concepto.trim().length >= 2 && montoValido && !!sedeId

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!valido) return
    setGuardando(true)
    try {
      const { movimiento } = await registrarVentaProfesional({
        sede_id: sedeId,
        concepto: concepto.trim(),
        monto: Math.round(montoNum * 100) / 100,
        metodo,
      })
      setAnotadas((previas) => [
        { id: movimiento.id, concepto: movimiento.concepto, monto: movimiento.monto, metodo },
        ...previas,
      ])
      setConcepto("")
      setMonto("")
      toast.success(`Venta de ${money(movimiento.monto)} anotada.`)
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo anotar la venta.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-5">
      <p className="text-[10.5px] tracking-[0.2em] text-gold-deep uppercase dark:text-gold">Productos</p>
      <h1 className="aura-display mb-5 text-[24px] leading-tight">Anotar una venta</h1>

      <form onSubmit={guardar} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="venta-concepto">¿Qué vendiste?</Label>
          <Input
            id="venta-concepto"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Ej. Shampoo reparador 300 ml"
            maxLength={120}
            autoComplete="off"
            className="h-11 rounded-xl"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="venta-monto">Monto cobrado (S/)</Label>
          <Input
            id="venta-monto"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            className="h-11 rounded-xl tnum"
            aria-invalid={!!monto && !montoValido}
          />
          {monto && !montoValido ? (
            <p role="alert" className="text-[12px] text-status-cancelled">
              Escribe un monto entre S/ 0.01 y S/ {MAX_VENTA}.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Método de pago</Label>
          <div className="flex flex-wrap gap-2">
            {METODOS_PAGO.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetodo(m)}
                aria-pressed={metodo === m}
                className={cn(
                  "rounded-full border px-4 py-2 text-[13px] transition-colors",
                  metodo === m
                    ? "border-gold bg-gold/15 text-gold-deep dark:text-gold"
                    : "border-border text-muted-foreground hover:border-gold/50",
                )}
              >
                {METODO_PAGO_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        {sedesElegibles.length > 1 ? (
          <div className="flex flex-col gap-2">
            <Label>Local</Label>
            <div className="flex flex-wrap gap-2">
              {sedesElegibles.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSedeId(s.id)}
                  aria-pressed={sedeId === s.id}
                  className={cn(
                    "rounded-full border px-4 py-2 text-[13px] transition-colors",
                    sedeId === s.id
                      ? "border-gold bg-gold/15 text-gold-deep dark:text-gold"
                      : "border-border text-muted-foreground hover:border-gold/50",
                  )}
                >
                  {s.nombre}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Button type="submit" variant="gold" size="lg" className="h-12 w-full" disabled={!valido || guardando}>
          {guardando ? "Anotando…" : "Anotar venta"}
        </Button>
      </form>

      {anotadas.length > 0 ? (
        <section className="mt-8" aria-label="Ventas anotadas en esta sesión">
          <h2 className="mb-2 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Anotadas ahora</h2>
          <ul className="flex flex-col gap-2">
            {anotadas.map((v) => (
              <li key={v.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                <Check aria-hidden className="size-4 shrink-0 text-gold-deep dark:text-gold" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px]">{v.concepto}</span>
                  <span className="block text-[11.5px] text-muted-foreground">{METODO_PAGO_LABEL[v.metodo]}</span>
                </span>
                <span className="tnum text-[14px] font-medium">{money(v.monto)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
