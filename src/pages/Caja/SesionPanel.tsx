import { useMemo, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Check, Lock, Unlock } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { fechaHora, money } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { CajaSesionResumen } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"

/**
 * El turno de caja. Solo el efectivo pasa por aquí: Yape y tarjeta son
 * ingresos del negocio, pero no cambian lo que hay en el cajón, así que el
 * arqueo los deja fuera a propósito.
 */
export function SesionPanel({
  sesion,
  onCambio,
}: {
  sesion: CajaSesionResumen | null
  onCambio: () => void
}) {
  const { session } = useAuth()
  const [abriendo, setAbriendo] = useState(false)
  const [montoInicial, setMontoInicial] = useState("")
  const [cerrando, setCerrando] = useState(false)

  async function abrirCaja() {
    if (!session) return
    const inicial = Number(montoInicial.replace(",", ".")) || 0
    const { error } = await supabase.from("caja_sesiones").insert({
      abierta_por: session.user.id,
      monto_inicial: inicial,
    })

    if (error) {
      // El índice parcial deja una sola caja abierta: si otra pestaña se
      // adelantó, esto es lo que se ve.
      toast.error(
        error.code === "23505"
          ? "Ya hay una caja abierta. Recarga la página."
          : `No se pudo abrir la caja: ${error.message}`
      )
      return
    }

    toast.success(`Caja abierta con ${money(inicial)}`)
    setAbriendo(false)
    setMontoInicial("")
    onCambio()
  }

  if (!sesion) {
    return (
      <Card crest className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Unlock className="size-4 text-gold-deep dark:text-gold" />
            Caja cerrada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[13px] text-muted-foreground">
            Abre el turno con el efectivo que hay en el cajón para que el arqueo
            del cierre cuadre.
          </p>

          {abriendo ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="monto-inicial">Monto inicial (S/)</Label>
                <Input
                  id="monto-inicial"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={montoInicial}
                  onChange={(e) => setMontoInicial(e.target.value)}
                  className="tnum w-40"
                  autoFocus
                />
              </div>
              <Button variant="gold" onClick={abrirCaja}>
                Abrir turno
              </Button>
              <Button variant="ghost" onClick={() => setAbriendo(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button variant="gold" size="cta" onClick={() => setAbriendo(true)}>
              Abrir caja
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card crest>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-confirmed opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-status-confirmed" />
            </span>
            Caja abierta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Dato etiqueta="Desde" valor={fechaHora(sesion.apertura_at)} />
            <Dato etiqueta="Monto inicial" valor={money(sesion.monto_inicial)} />
            <Dato
              etiqueta="Efectivo del turno"
              valor={money(sesion.ingresos_efectivo - sesion.egresos_efectivo)}
            />
            <Dato
              etiqueta="Esperado en cajón"
              valor={money(sesion.efectivo_esperado)}
              destacado
            />
          </dl>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <span>
              {sesion.movimientos} movimiento{sesion.movimientos === 1 ? "" : "s"}
            </span>
            <span aria-hidden className="aura-diamond opacity-40" />
            <span>Ingresos {money(sesion.ingresos)}</span>
            <span aria-hidden className="aura-diamond opacity-40" />
            <span>Egresos {money(sesion.egresos)}</span>
          </div>

          <Button variant="outline" onClick={() => setCerrando(true)}>
            <Lock /> Cerrar caja y arquear
          </Button>
        </CardContent>
      </Card>

      <CierreDialog
        open={cerrando}
        onOpenChange={setCerrando}
        sesion={sesion}
        onCerrada={onCambio}
      />
    </>
  )
}

function Dato({
  etiqueta,
  valor,
  destacado = false,
}: {
  etiqueta: string
  valor: string
  destacado?: boolean
}) {
  return (
    <div>
      <dt className="text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">
        {etiqueta}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-[15px] text-foreground",
          destacado && "font-medium text-gold-deep dark:text-gold"
        )}
      >
        {valor}
      </dd>
    </div>
  )
}

function CierreDialog({
  open,
  onOpenChange,
  sesion,
  onCerrada,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sesion: CajaSesionResumen
  onCerrada: () => void
}) {
  const { session } = useAuth()
  const [declarado, setDeclarado] = useState("")
  const [nota, setNota] = useState("")
  const [guardando, setGuardando] = useState(false)

  const declaradoNum = useMemo(() => {
    const n = Number(declarado.replace(",", "."))
    return Number.isFinite(n) ? n : null
  }, [declarado])

  const diferencia = declaradoNum === null ? null : declaradoNum - sesion.efectivo_esperado
  const cuadra = diferencia !== null && Math.abs(diferencia) < 0.005

  async function cerrar() {
    if (declaradoNum === null || !session) return
    setGuardando(true)

    const { error } = await supabase
      .from("caja_sesiones")
      .update({
        estado: "cerrada",
        cierre_at: new Date().toISOString(),
        cerrada_por: session.user.id,
        monto_declarado: declaradoNum,
        cierre_nota: nota.trim() || null,
      })
      .eq("id", sesion.id)

    setGuardando(false)

    if (error) {
      toast.error(`No se pudo cerrar: ${error.message}`)
      return
    }

    toast.success(
      cuadra
        ? "Caja cerrada y cuadrada"
        : `Caja cerrada con ${diferencia! > 0 ? "sobrante" : "faltante"} de ${money(Math.abs(diferencia!))}`
    )
    onOpenChange(false)
    setDeclarado("")
    setNota("")
    onCerrada()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Arqueo de caja</DialogTitle>
          <DialogDescription>
            Cuenta el efectivo del cajón y escríbelo tal cual. La diferencia se
            guarda con el turno: cuadre o no, queda el registro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-2/60 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-muted-foreground">Esperado en el cajón</span>
              <span className="tnum text-[15px] font-medium">{money(sesion.efectivo_esperado)}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {money(sesion.monto_inicial)} inicial + {money(sesion.ingresos_efectivo)} en efectivo
              − {money(sesion.egresos_efectivo)} de salidas
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="declarado">Contado en el cajón (S/)</Label>
            <Input
              id="declarado"
              inputMode="decimal"
              placeholder="0.00"
              value={declarado}
              onChange={(e) => setDeclarado(e.target.value)}
              className="tnum text-lg"
              autoFocus
            />
          </div>

          {/* El estado nunca va solo por color: icono + palabra + cifra. */}
          {diferencia !== null ? (
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px]",
                cuadra
                  ? "bg-status-confirmed-bg text-status-confirmed"
                  : "bg-status-pending-bg text-status-pending"
              )}
            >
              {cuadra ? (
                <Check className="size-4 shrink-0" />
              ) : (
                <AlertTriangle className="size-4 shrink-0" />
              )}
              <span className="font-medium">
                {cuadra
                  ? "Cuadra exacto"
                  : diferencia > 0
                    ? `Sobran ${money(diferencia)}`
                    : `Faltan ${money(Math.abs(diferencia))}`}
              </span>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="cierre-nota">Nota del cierre (opcional)</Label>
            <Textarea
              id="cierre-nota"
              rows={2}
              placeholder="Por ejemplo: se pagó movilidad sin boleta"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="gold"
            size="cta"
            onClick={cerrar}
            disabled={declaradoNum === null || guardando}
          >
            {guardando ? "Cerrando…" : "Cerrar turno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
