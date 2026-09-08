import { useEffect, useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { CategoryIcon } from "@/lib/categoryIcons"
import type { Profesional, Sede, Service, ServiceCategory } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ImagePicker } from "@/components/ImagePicker"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/** 0=domingo … 6=sábado, igual que business_hours y getDay(). */
const DIAS = [
  { n: 1, label: "L" },
  { n: 2, label: "M" },
  { n: 3, label: "X" },
  { n: 4, label: "J" },
  { n: 5, label: "V" },
  { n: 6, label: "S" },
  { n: 0, label: "D" },
]

export type SedeAsignada = { sede_id: string; dias: number[] }

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export default function ProfesionalDialog({
  open,
  onOpenChange,
  profesional,
  sedes,
  categorias,
  servicios,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  profesional: Profesional | null
  sedes: Sede[]
  categorias: ServiceCategory[]
  servicios: Service[]
  onSaved: () => void
}) {
  const esEdicion = !!profesional
  const [nombre, setNombre] = useState("")
  const [rol, setRol] = useState("Estilista")
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [activa, setActiva] = useState(true)
  const [asignadas, setAsignadas] = useState<SedeAsignada[]>([])
  const [serviciosIds, setServiciosIds] = useState<Set<string>>(new Set())
  const [expandida, setExpandida] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!open) return
    setNombre(profesional?.nombre ?? "")
    setRol(profesional?.rol ?? "Estilista")
    setFotoUrl(profesional?.foto_url ?? null)
    setActiva(profesional?.activa ?? true)
    setExpandida(null)

    if (!profesional) {
      setAsignadas([])
      setServiciosIds(new Set())
      return
    }

    setCargando(true)
    Promise.all([
      supabase.from("profesional_sedes").select("sede_id,dias").eq("profesional_id", profesional.id),
      supabase.from("profesional_servicios").select("servicio_id").eq("profesional_id", profesional.id),
    ]).then(([sedesRes, svcRes]) => {
      setAsignadas(
        (sedesRes.data ?? []).map((f) => ({
          sede_id: f.sede_id as string,
          dias: (f.dias as number[] | null) ?? [],
        })),
      )
      setServiciosIds(new Set((svcRes.data ?? []).map((f) => f.servicio_id as string)))
      setCargando(false)
    })
  }, [open, profesional])

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, Service[]>()
    for (const s of servicios) {
      if (!mapa.has(s.category_id)) mapa.set(s.category_id, [])
      mapa.get(s.category_id)!.push(s)
    }
    return mapa
  }, [servicios])

  function alternarSede(sedeId: string) {
    setAsignadas((previas) =>
      previas.some((a) => a.sede_id === sedeId)
        ? previas.filter((a) => a.sede_id !== sedeId)
        : [...previas, { sede_id: sedeId, dias: [] }],
    )
  }

  function alternarDia(sedeId: string, dia: number) {
    setAsignadas((previas) =>
      previas.map((a) =>
        a.sede_id === sedeId
          ? { ...a, dias: a.dias.includes(dia) ? a.dias.filter((d) => d !== dia) : [...a.dias, dia].sort() }
          : a,
      ),
    )
  }

  function alternarCategoria(categoriaId: string) {
    const delGrupo = porCategoria.get(categoriaId) ?? []
    const todos = delGrupo.every((s) => serviciosIds.has(s.id))
    setServiciosIds((previos) => {
      const siguiente = new Set(previos)
      for (const s of delGrupo) {
        if (todos) siguiente.delete(s.id)
        else siguiente.add(s.id)
      }
      return siguiente
    })
  }

  function alternarServicio(id: string) {
    setServiciosIds((previos) => {
      const siguiente = new Set(previos)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    setGuardando(true)

    const datos = {
      nombre: nombre.trim(),
      rol: rol.trim() || "Estilista",
      foto_url: fotoUrl,
      activa,
      // Sede principal: solo agrupa en el panel. Dónde se la puede reservar
      // sale de profesional_sedes (ver migración 0016).
      sede_id: asignadas[0]?.sede_id ?? sedes[0]?.id,
    }

    let id = profesional?.id
    if (esEdicion) {
      const { error } = await supabase.from("profesionales").update(datos).eq("id", id!)
      if (error) {
        setGuardando(false)
        toast.error("No se pudo guardar.")
        return
      }
    } else {
      const { data, error } = await supabase
        .from("profesionales")
        .insert({ ...datos, slug: slugify(nombre), sort_order: 100 })
        .select("id")
        .single()
      if (error || !data) {
        setGuardando(false)
        toast.error(
          error?.code === "23505" ? "Ya existe una profesional con ese nombre." : "No se pudo crear.",
        )
        return
      }
      id = data.id as string
    }

    // Sedes y especialidades se reemplazan enteras: es más simple y seguro
    // que calcular altas y bajas, y son tablas de dos columnas sin historial
    // propio que se pueda perder.
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("profesional_sedes").delete().eq("profesional_id", id!),
      supabase.from("profesional_servicios").delete().eq("profesional_id", id!),
    ])
    if (e1 || e2) {
      setGuardando(false)
      toast.error("Se guardaron los datos pero no las sedes o especialidades.")
      return
    }

    const fallos: unknown[] = []
    if (asignadas.length > 0) {
      const { error } = await supabase
        .from("profesional_sedes")
        .insert(asignadas.map((a) => ({ profesional_id: id, sede_id: a.sede_id, dias: a.dias })))
      if (error) fallos.push(error)
    }
    if (serviciosIds.size > 0) {
      const { error } = await supabase
        .from("profesional_servicios")
        .insert([...serviciosIds].map((s) => ({ profesional_id: id, servicio_id: s })))
      if (error) fallos.push(error)
    }
    setGuardando(false)

    if (fallos.length > 0) {
      toast.error("Se guardaron los datos pero fallaron las sedes o especialidades.")
      return
    }
    toast.success(esEdicion ? "Profesional actualizada." : "Profesional creada.")
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar profesional" : "Nueva profesional"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={guardar} className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="prof-nombre">Nombre</Label>
              <Input
                id="prof-nombre"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Laura Ballena"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="prof-rol">Rol</Label>
              <Input
                id="prof-rol"
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                placeholder="Estilista"
              />
            </div>
          </div>

          <ImagePicker label="Foto" value={fotoUrl} onChange={setFotoUrl} />

          <div className="flex items-center gap-2">
            <Switch id="prof-activa" checked={activa} onCheckedChange={setActiva} />
            <Label htmlFor="prof-activa">Activa (se puede reservar con ella)</Label>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Sedes y días</Label>
            <p className="text-[11.5px] text-muted-foreground">
              Marca los locales donde atiende. Si no eliges días, se entiende que va todos los que el
              local esté abierto — marca días solo si rota.
            </p>
            {sedes.map((s) => {
              const asignada = asignadas.find((a) => a.sede_id === s.id)
              return (
                <div key={s.id} className="rounded-xl border border-border p-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!asignada}
                      onChange={() => alternarSede(s.id)}
                      className="size-4 accent-gold"
                    />
                    <span className="text-[13px]">{s.nombre}</span>
                  </label>
                  {asignada ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
                      {DIAS.map((d) => (
                        <button
                          key={d.n}
                          type="button"
                          onClick={() => alternarDia(s.id, d.n)}
                          aria-pressed={asignada.dias.includes(d.n)}
                          className={cn(
                            "size-7 rounded-lg border text-[11.5px] transition-colors",
                            asignada.dias.includes(d.n)
                              ? "border-gold bg-gold/15 text-gold-deep dark:text-gold"
                              : "border-input text-muted-foreground hover:border-gold/50",
                          )}
                        >
                          {d.label}
                        </button>
                      ))}
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        {asignada.dias.length === 0 ? "todos los días" : `${asignada.dias.length} día(s)`}
                      </span>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Especialidades</Label>
            <p className="text-[11.5px] text-muted-foreground">
              Solo se le ofrecerán a la clienta los servicios marcados. Toca una categoría para
              ajustar servicios sueltos.
            </p>
            {cargando ? (
              <p className="text-[13px] text-muted-foreground">Cargando…</p>
            ) : (
              categorias.map((c) => {
                const delGrupo = porCategoria.get(c.id) ?? []
                const marcados = delGrupo.filter((s) => serviciosIds.has(s.id)).length
                const todos = marcados === delGrupo.length && delGrupo.length > 0
                return (
                  <div key={c.id} className="rounded-xl border border-border">
                    <div className="flex items-center gap-2 p-2.5">
                      <input
                        type="checkbox"
                        checked={todos}
                        ref={(el) => {
                          // Estado indeterminado: la categoría está a medias
                          // (p. ej. Victoria hace 4 de los 11 de manicure).
                          if (el) el.indeterminate = marcados > 0 && !todos
                        }}
                        onChange={() => alternarCategoria(c.id)}
                        className="size-4 accent-gold"
                      />
                      <CategoryIcon name={c.icon} className="size-4 text-gold-deep dark:text-gold" />
                      <button
                        type="button"
                        onClick={() => setExpandida(expandida === c.id ? null : c.id)}
                        className="flex-1 text-left text-[13px]"
                      >
                        {c.title}
                      </button>
                      <span className="text-[11.5px] text-muted-foreground">
                        {marcados}/{delGrupo.length}
                      </span>
                    </div>
                    {expandida === c.id ? (
                      <div className="grid gap-1 border-t border-border px-3 py-2">
                        {delGrupo.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 text-[12px]">
                            <input
                              type="checkbox"
                              checked={serviciosIds.has(s.id)}
                              onChange={() => alternarServicio(s.id)}
                              className="size-3.5 accent-gold"
                            />
                            {s.name}
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="gold" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
