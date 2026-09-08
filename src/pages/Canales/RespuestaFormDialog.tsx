import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { CANALES, type RespuestaRapida } from "@/lib/types"
import { CANAL_LABEL } from "@/lib/canales"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function RespuestaFormDialog({
  open,
  onOpenChange,
  respuesta,
  nextSortOrder,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  respuesta: RespuestaRapida | null
  nextSortOrder: number
  onSaved: () => void
}) {
  const isEdit = !!respuesta
  const [atajo, setAtajo] = useState("")
  const [titulo, setTitulo] = useState("")
  const [contenido, setContenido] = useState("")
  const [canal, setCanal] = useState<string>("todos")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setAtajo(respuesta?.atajo ?? "")
    setTitulo(respuesta?.titulo ?? "")
    setContenido(respuesta?.contenido ?? "")
    setCanal(respuesta?.canal ?? "todos")
  }, [open, respuesta])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const payload = {
      atajo: atajo.trim().replace(/^\//, ""),
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      canal: canal === "todos" ? null : canal,
    }

    const { error } = isEdit
      ? await supabase.from("respuestas_rapidas").update(payload).eq("id", respuesta!.id)
      : await supabase.from("respuestas_rapidas").insert({ ...payload, sort_order: nextSortOrder })

    setSubmitting(false)
    if (error) {
      toast.error(isEdit ? "No se pudo guardar la respuesta." : "No se pudo crear la respuesta.")
      return
    }
    toast.success(isEdit ? "Respuesta actualizada." : "Respuesta creada.")
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar respuesta rápida" : "Nueva respuesta rápida"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="resp-atajo">Atajo</Label>
            <Input
              id="resp-atajo"
              required
              placeholder="horarios"
              value={atajo}
              onChange={(e) => setAtajo(e.target.value)}
            />
            <p className="text-[11.5px] text-muted-foreground">Se escribe como /{atajo || "atajo"} en el compositor.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="resp-titulo">Título</Label>
            <Input id="resp-titulo" required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="resp-canal">Canal</Label>
            <Select value={canal} onValueChange={(v) => setCanal(v ?? "todos")}>
              <SelectTrigger id="resp-canal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los canales</SelectItem>
                {CANALES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CANAL_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="resp-contenido">Contenido</Label>
            <Textarea
              id="resp-contenido"
              required
              rows={4}
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
            />
            <p className="text-[11.5px] text-muted-foreground">
              Admite {"{{nombre}}"}, {"{{sede}}"} y {"{{profesional}}"} — se reemplazan con los datos de la clienta al usarla.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
