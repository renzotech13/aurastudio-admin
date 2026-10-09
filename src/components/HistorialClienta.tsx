import { useEffect, useState } from "react"

import { supabase } from "@/lib/supabase"
import { fechaCorta } from "@/lib/format"
import { CITA_ESTADO_LABEL, type CitaEstado } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"

type Visita = {
  id: string
  inicio_utc: string
  fin_utc: string
  estado: CitaEstado
  services: { name: string } | null
  profesionales: { nombre: string } | null
}

type Aviso = {
  id: string
  regla_nombre: string
  oferta: string
  estado: "reservada" | "enviada" | "fallida"
  created_at: string
  enviada_at: string | null
}

function haceDias(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (dias <= 0) return "hoy"
  if (dias === 1) return "ayer"
  return `hace ${dias} días`
}

/**
 * Historial de una clienta: sus servicios (con cuándo y con quién) y los
 * mensajes de reactivación que se le mandaron. Sirve para saber qué se le hizo,
 * cuánto hace que no viene y si ya se le ofreció algo antes de escribirle.
 * Las citas las ve quien atiende; el bot solo escribe los avisos.
 */
export default function HistorialClienta({ clienteId }: { clienteId: string }) {
  const [visitas, setVisitas] = useState<Visita[] | null>(null)
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    let activo = true
    Promise.all([
      supabase
        .from("citas")
        .select("id,inicio_utc,fin_utc,estado,services(name),profesionales(nombre)")
        .eq("cliente_id", clienteId)
        .order("inicio_utc", { ascending: false })
        .limit(15),
      supabase
        .from("reactivaciones")
        .select("id,regla_nombre,oferta,estado,created_at,enviada_at")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]).then(([cit, rea]) => {
      if (!activo) return
      if (cit.error) return setError(true)
      setVisitas((cit.data ?? []) as unknown as Visita[])
      // Sin la migración 0022 no hay tabla de avisos: el historial de citas igual se ve.
      setAvisos(rea.error ? [] : ((rea.data ?? []) as Aviso[]))
    })
    return () => {
      activo = false
    }
  }, [clienteId])

  if (error) return <p className="text-[12.5px] text-status-cancelled">No se pudo cargar el historial.</p>
  if (visitas === null) return <Skeleton className="h-16 rounded-xl" />

  const atendidas = visitas.filter((v) => v.estado === "completada")
  const ultima = atendidas[0]

  return (
    <div className="flex flex-col gap-3 text-[12.5px]">
      <p className="text-muted-foreground">
        {ultima ? (
          <>
            <strong className="text-foreground">{atendidas.length}</strong> atención{atendidas.length === 1 ? "" : "es"} · la última{" "}
            <strong className="text-foreground">{haceDias(ultima.fin_utc)}</strong> ({ultima.services?.name ?? "servicio"})
          </>
        ) : (
          "Todavía no tiene atenciones registradas."
        )}
      </p>

      {visitas.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {visitas.map((v) => (
            <li key={v.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">
                {v.services?.name ?? "Servicio"}
                {v.profesionales ? <span className="text-muted-foreground"> · {v.profesionales.nombre}</span> : null}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {fechaCorta(v.inicio_utc)}
                {v.estado !== "completada" ? ` · ${CITA_ESTADO_LABEL[v.estado].toLowerCase()}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {avisos.length > 0 ? (
        <div className="rounded-lg bg-gold/10 px-3 py-2">
          <p className="mb-1 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">Mensajes para que vuelva</p>
          <ul className="flex flex-col gap-1">
            {avisos.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{a.oferta || a.regla_nombre}</span>{" "}
                <span className="text-muted-foreground">
                  · {fechaCorta(a.enviada_at ?? a.created_at)}
                  {a.estado === "fallida" ? " · no salió" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
