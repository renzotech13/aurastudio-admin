import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Pencil, Plus, UserCheck, UserX } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { numero } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Profesional, Sede, Service, ServiceCategory } from "@/lib/types"
import { Cifra } from "@/components/charts"
import { PageHeader } from "@/components/PageHeader"
import { Segmented, type OpcionSegmentada } from "@/components/Segmented"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import ProfesionalDialog from "./ProfesionalDialog"

const DIA_CORTO = ["D", "L", "M", "X", "J", "V", "S"]

type Filtro = "activas" | "todas"

const FILTROS: readonly OpcionSegmentada<Filtro>[] = [
  { id: "activas", label: "Activas" },
  { id: "todas", label: "Todas" },
]

type Asignacion = { profesional_id: string; sede_id: string; dias: number[] }

export default function Equipo() {
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [categorias, setCategorias] = useState<ServiceCategory[]>([])
  const [servicios, setServicios] = useState<Service[]>([])
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [conteoServicios, setConteoServicios] = useState<Record<string, number>>({})
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>("activas")
  const [dialogo, setDialogo] = useState(false)
  const [editando, setEditando] = useState<Profesional | null>(null)

  async function cargar() {
    setCargando(true)
    const [profRes, sedesRes, catRes, svcRes, asigRes, psRes] = await Promise.all([
      supabase.from("profesionales").select("*").order("sort_order"),
      supabase.from("sedes").select("*").order("sort_order"),
      supabase.from("service_categories").select("*").order("sort_order"),
      supabase.from("services").select("*").order("sort_order"),
      supabase.from("profesional_sedes").select("profesional_id,sede_id,dias"),
      supabase.from("profesional_servicios").select("profesional_id"),
    ])
    if (profRes.error || sedesRes.error) {
      toast.error("No se pudo cargar el equipo.")
      setCargando(false)
      return
    }
    setProfesionales((profRes.data ?? []) as Profesional[])
    setSedes((sedesRes.data ?? []) as Sede[])
    setCategorias((catRes.data ?? []) as ServiceCategory[])
    setServicios((svcRes.data ?? []) as Service[])
    setAsignaciones(
      (asigRes.data ?? []).map((a) => ({
        profesional_id: a.profesional_id as string,
        sede_id: a.sede_id as string,
        dias: (a.dias as number[] | null) ?? [],
      })),
    )
    const cuenta: Record<string, number> = {}
    for (const f of psRes.data ?? []) {
      const id = f.profesional_id as string
      cuenta[id] = (cuenta[id] ?? 0) + 1
    }
    setConteoServicios(cuenta)
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  const visibles = useMemo(
    () => (filtro === "activas" ? profesionales.filter((p) => p.activa) : profesionales),
    [profesionales, filtro],
  )
  const activas = profesionales.filter((p) => p.activa).length
  const rotativas = useMemo(() => {
    const porProf = new Map<string, number>()
    for (const a of asignaciones) porProf.set(a.profesional_id, (porProf.get(a.profesional_id) ?? 0) + 1)
    return [...porProf.values()].filter((n) => n > 1).length
  }, [asignaciones])

  const nombreSede = (id: string) => sedes.find((s) => s.id === id)?.nombre ?? id

  async function alternarActiva(p: Profesional) {
    const previas = profesionales
    setProfesionales((rows) => rows.map((x) => (x.id === p.id ? { ...x, activa: !x.activa } : x)))
    const { error } = await supabase.from("profesionales").update({ activa: !p.activa }).eq("id", p.id)
    if (error) {
      setProfesionales(previas)
      toast.error("No se pudo actualizar.")
    } else {
      toast.success(p.activa ? "Profesional desactivada." : "Profesional reactivada.")
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
      <PageHeader
        eyebrow="Operación"
        titulo="Equipo"
        descripcion={
          cargando
            ? "Cargando…"
            : `${numero(activas)} profesional${activas === 1 ? "" : "es"} activa${
                activas === 1 ? "" : "s"
              }${rotativas > 0 ? `, ${numero(rotativas)} rotando entre locales` : ""}.`
        }
      />

      {cargando ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[124px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Cifra
            destacada
            etiqueta="Activas"
            valor={numero(activas)}
            icono={<UserCheck className="size-4 text-status-confirmed" />}
          />
          <Cifra
            etiqueta="Rotan entre locales"
            valor={numero(rotativas)}
            icono={<UserCheck className="size-4 text-gold-deep dark:text-gold" />}
          />
          <Cifra
            etiqueta="Fuera del equipo"
            valor={numero(profesionales.length - activas)}
            icono={<UserX className="size-4 text-status-cancelled" />}
          />
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          opciones={FILTROS}
          valor={filtro}
          onChange={setFiltro}
          etiquetaAria="Filtrar profesionales"
        />
        <Button
          variant="gold"
          size="sm"
          onClick={() => {
            setEditando(null)
            setDialogo(true)
          }}
        >
          <Plus className="size-4" />
          Nueva profesional
        </Button>
      </div>

      <Card crest>
        <CardHeader>
          <CardTitle>Profesionales</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {cargando ? (
            <div className="space-y-2 px-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 rounded-xl" />
              ))}
            </div>
          ) : visibles.length === 0 ? (
            <p className="px-5 text-[13px] text-muted-foreground">
              No hay profesionales en esta vista.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profesional</TableHead>
                    <TableHead>Dónde atiende</TableHead>
                    <TableHead>Servicios</TableHead>
                    <TableHead>Activa</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map((p) => {
                    const suyas = asignaciones.filter((a) => a.profesional_id === p.id)
                    return (
                      <TableRow key={p.id} className={p.activa ? undefined : "opacity-55"}>
                        <TableCell>
                          <div>{p.nombre}</div>
                          <div className="text-[11.5px] text-muted-foreground">{p.rol}</div>
                        </TableCell>
                        <TableCell className="text-[12px] text-muted-foreground">
                          {suyas.length === 0 ? (
                            <span className="text-status-cancelled">Sin local asignado</span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {suyas.map((a) => (
                                <span key={a.sede_id}>
                                  {nombreSede(a.sede_id)}
                                  {a.dias.length > 0 ? (
                                    <span className="ml-1.5 text-gold-deep dark:text-gold">
                                      {a.dias.map((d) => DIA_CORTO[d]).join(" ")}
                                    </span>
                                  ) : null}
                                </span>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="tnum">
                          <span
                            className={cn(
                              (conteoServicios[p.id] ?? 0) === 0 && "text-status-cancelled",
                            )}
                          >
                            {numero(conteoServicios[p.id] ?? 0)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Switch checked={p.activa} onCheckedChange={() => alternarActiva(p)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setEditando(p)
                              setDialogo(true)
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ProfesionalDialog
        open={dialogo}
        onOpenChange={setDialogo}
        profesional={editando}
        sedes={sedes}
        categorias={categorias}
        servicios={servicios}
        onSaved={cargar}
      />
    </div>
  )
}
