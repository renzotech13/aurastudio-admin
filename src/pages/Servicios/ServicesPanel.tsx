import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { numero } from "@/lib/format"
import { BOOKING_GROUPS, type Service, type ServiceCategory } from "@/lib/types"
import { Segmented, type OpcionSegmentada } from "@/components/Segmented"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import ServiceFormDialog from "@/pages/Servicios/ServiceFormDialog"

const GRUPOS: readonly OpcionSegmentada<(typeof BOOKING_GROUPS)[number]>[] = BOOKING_GROUPS.map((g) => ({
  id: g,
  label: g,
}))

export default function ServicesPanel() {
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<(typeof BOOKING_GROUPS)[number]>("Principales")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: svcs, error: svcErr }, { data: cats, error: catErr }] = await Promise.all([
      supabase.from("services").select("*").order("sort_order"),
      supabase.from("service_categories").select("*").order("sort_order"),
    ])
    if (svcErr || catErr) {
      toast.error("No se pudieron cargar los servicios.")
      setLoading(false)
      return
    }
    setServices(svcs as Service[])
    setCategories(cats as ServiceCategory[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel("services-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  )
  const filtered = useMemo(() => services.filter((s) => s.booking_group === group), [services, group])
  const activosEnGrupo = useMemo(() => filtered.filter((s) => s.active).length, [filtered])

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= filtered.length) return
    const a = filtered[index]
    const b = filtered[target]
    const previous = services
    setServices((rows) =>
      rows.map((r) => {
        if (r.id === a.id) return { ...r, sort_order: b.sort_order }
        if (r.id === b.id) return { ...r, sort_order: a.sort_order }
        return r
      }),
    )
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("services").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("services").update({ sort_order: a.sort_order }).eq("id", b.id),
    ])
    if (e1 || e2) {
      setServices(previous)
      toast.error("No se pudo reordenar.")
    }
  }

  async function toggleActive(service: Service) {
    const previous = services
    setServices((rows) => rows.map((s) => (s.id === service.id ? { ...s, active: !s.active } : s)))
    const { error } = await supabase.from("services").update({ active: !service.active }).eq("id", service.id)
    if (error) {
      setServices(previous)
      toast.error("No se pudo actualizar.")
    } else {
      toast.success(service.active ? "Servicio archivado." : "Servicio reactivado.")
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented opciones={GRUPOS} valor={group} onChange={setGroup} etiquetaAria="Filtrar por grupo de reserva" />
        <div className="flex items-center gap-3">
          <span className="text-[11.5px] text-muted-foreground">
            {loading ? "—" : `${numero(activosEnGrupo)} activo${activosEnGrupo === 1 ? "" : "s"} de ${numero(filtered.length)}`}
          </span>
          <Button
            variant="gold"
            size="sm"
            disabled={!categories.length}
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" />
            Nuevo servicio
          </Button>
        </div>
      </div>

      <Card crest>
        <CardHeader>
          <CardTitle>{group}</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <div className="space-y-2 px-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-5 text-[13px] text-muted-foreground">
              No hay servicios en este grupo todavía.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16"></TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Adelanto</TableHead>
                    <TableHead>Activo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s, i) => (
                    <TableRow key={s.id} className={s.active ? undefined : "opacity-55"}>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)}>
                            <ArrowUp className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={i === filtered.length - 1}
                            onClick={() => move(i, 1)}
                          >
                            <ArrowDown className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{s.name}</div>
                        <div className="text-[11.5px] text-muted-foreground">{s.id}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {categoryById[s.category_id]?.title ?? s.category_id}
                      </TableCell>
                      <TableCell>{s.duration}</TableCell>
                      <TableCell className="tnum">S/ {s.price}</TableCell>
                      <TableCell className="tnum text-muted-foreground">
                        {s.deposit_amount != null ? `S/ ${s.deposit_amount}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Switch checked={s.active} onCheckedChange={() => toggleActive(s)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setEditing(s)
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
        </CardContent>
      </Card>

      <ServiceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        service={editing}
        categories={categories}
        defaultBookingGroup={group}
        nextSortOrder={filtered.length ? Math.max(...filtered.map((s) => s.sort_order)) + 10 : 0}
        onSaved={load}
      />
    </div>
  )
}
