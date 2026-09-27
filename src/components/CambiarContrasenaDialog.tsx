import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const MIN = 8

/**
 * Cambiar la propia contraseña. Existe porque las cuentas del equipo se
 * entregan con una contraseña inicial: la primera cosa que debe hacer cada
 * quien es ponerse una que solo ella conozca.
 *
 * Sin «olvidé mi contraseña» por correo: las cuentas son nombre@aurastudio.pe
 * y esos buzones no existen (solo info@), así que el enlace no llegaría a
 * ningún lado. Quien la olvide, se la restablece el administrador.
 */
export default function CambiarContrasenaDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { cambiarContrasena } = useAuth()
  const [nueva, setNueva] = useState("")
  const [repetida, setRepetida] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function cerrar(abierto: boolean) {
    if (!abierto) {
      setNueva("")
      setRepetida("")
      setError(null)
    }
    onOpenChange(abierto)
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (nueva.length < MIN) return setError(`Usa al menos ${MIN} caracteres.`)
    if (nueva !== repetida) return setError("Las dos contraseñas no coinciden.")

    setGuardando(true)
    setError(null)
    const { error: fallo } = await cambiarContrasena(nueva)
    setGuardando(false)
    if (fallo) {
      // Supabase no deja repetir la anterior y avisa en inglés: se traduce lo
      // que se puede y lo demás se dice sin el detalle técnico.
      setError(
        /different from the old password/i.test(fallo)
          ? "La nueva contraseña tiene que ser distinta de la actual."
          : "No se pudo cambiar la contraseña. Vuelve a intentarlo.",
      )
      return
    }
    toast.success("Contraseña actualizada.")
    cerrar(false)
  }

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
        </DialogHeader>
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pass-nueva">Nueva contraseña</Label>
            <Input
              id="pass-nueva"
              type="password"
              autoComplete="new-password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              placeholder={`Mínimo ${MIN} caracteres`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pass-repetida">Repítela</Label>
            <Input
              id="pass-repetida"
              type="password"
              autoComplete="new-password"
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="text-[12.5px] text-status-cancelled">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => cerrar(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="gold" disabled={guardando || !nueva || !repetida}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
