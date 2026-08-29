import { useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Info } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { colorPorNombre } from "./utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Fila = { nombre: string; telefono: string }

/**
 * Acepta números como los suelen anotar en Perú: con o sin +51, con
 * espacios/guiones, o solo los 9 dígitos del celular — todo se normaliza al
 * mismo formato que ya usa el resto del sistema (51 + 9 dígitos, sin +).
 */
function normalizarTelefono(crudo: string): string | null {
  const digitos = crudo.replace(/\D/g, "")
  if (digitos.length === 9 && digitos.startsWith("9")) return `51${digitos}`
  if (digitos.length === 11 && digitos.startsWith("51")) return digitos
  return digitos.length >= 8 ? digitos : null
}

/** "Nombre, Teléfono" o "Nombre \t Teléfono" (así pega Excel/Sheets), una fila por línea. */
function parsearLineas(texto: string): { filas: Fila[]; invalidas: number } {
  const filas: Fila[] = []
  let invalidas = 0

  for (const linea of texto.split("\n")) {
    const limpia = linea.trim()
    if (!limpia) continue

    const partes = limpia.split(/\t|,/).map((p) => p.trim())
    const [nombre, telefonoCrudo] = partes
    const telefono = telefonoCrudo ? normalizarTelefono(telefonoCrudo) : null

    if (!nombre || !telefono) {
      invalidas++
      continue
    }
    filas.push({ nombre, telefono })
  }

  return { filas, invalidas }
}

export default function ImportarClientesDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [texto, setTexto] = useState("")
  const [etiquetaGrupo, setEtiquetaGrupo] = useState("")
  const [importando, setImportando] = useState(false)

  const { filas, invalidas } = useMemo(() => parsearLineas(texto), [texto])

  async function importar(e: FormEvent) {
    e.preventDefault()
    if (filas.length === 0) return

    setImportando(true)
    try {
      // upsert por teléfono: si ya existe (p. ej. ya escribió al bot antes),
      // no se pisa nada más que el nombre — no vale la pena bloquear el
      // import completo por unos cuantos que ya estaban.
      const { data: clientes, error } = await supabase
        .from("clientes")
        .upsert(filas, { onConflict: "telefono" })
        .select("id")
      if (error) throw error

      const nombreEtiqueta = etiquetaGrupo.trim()
      if (nombreEtiqueta && clientes) {
        let etiqueta = (await supabase.from("etiquetas").select("*").ilike("nombre", nombreEtiqueta).maybeSingle())
          .data as { id: string } | null

        if (!etiqueta) {
          const creada = await supabase
            .from("etiquetas")
            .insert({ nombre: nombreEtiqueta, color: colorPorNombre(nombreEtiqueta) })
            .select("*")
            .single()
          if (creada.error) throw creada.error
          etiqueta = creada.data as { id: string }
        }

        await supabase
          .from("cliente_etiquetas")
          .upsert(
            clientes.map((c) => ({ cliente_id: c.id, etiqueta_id: etiqueta!.id })),
            { onConflict: "cliente_id,etiqueta_id" },
          )
      }

      toast.success(`Se importaron ${filas.length} clienta(s).`)
      onOpenChange(false)
      setTexto("")
      setEtiquetaGrupo("")
    } catch {
      toast.error("No se pudo completar la importación.")
    } finally {
      setImportando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar clientas</DialogTitle>
        </DialogHeader>

        <form onSubmit={importar} className="flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Solo se guardan sus datos — para escribirles la primera vez necesitas una{" "}
              <strong>plantilla de Marketing aprobada por Meta</strong> (Enviar promoción), y que hayan dado su
              número esperando que el negocio les escriba.
            </span>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="import-clientes">Pega la lista (una por línea: Nombre, Teléfono)</Label>
            <Textarea
              id="import-clientes"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={8}
              placeholder={"María Torres, 987654321\nAna Vargas, 51912345678"}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              {filas.length} lista{filas.length !== 1 ? "s" : ""} para importar
              {invalidas > 0 && `, ${invalidas} línea${invalidas !== 1 ? "s" : ""} sin nombre o teléfono válido`}.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="import-etiqueta">Etiquétalas como (opcional)</Label>
            <Input
              id="import-etiqueta"
              value={etiquetaGrupo}
              onChange={(e) => setEtiquetaGrupo(e.target.value)}
              placeholder="Ej. Lista salón agosto"
            />
            <p className="text-xs text-muted-foreground">
              Así puedes elegir justo este grupo después, al mandar la promoción.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={importando || filas.length === 0}>
              {importando ? "Importando…" : `Importar ${filas.length}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
