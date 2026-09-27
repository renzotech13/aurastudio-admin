import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"

/**
 * Cuenta que inició sesión bien pero no tiene un rol que abra algo: una
 * alumna, una cuenta sin perfil, o una profesional que el administrador
 * desactivó. No se le dice «error»: la contraseña estaba bien.
 */
export default function SinAcceso() {
  const { session, signOut } = useAuth()

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center">
        <span
          aria-hidden
          className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full border border-gold/50 font-heading text-[20px] text-gold-deep dark:text-gold"
        >
          A
        </span>
        <h1 className="aura-display text-[22px] leading-tight">Esta cuenta no tiene acceso</h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
          {session?.user.email ? <span className="block break-all">{session.user.email}</span> : null}
          Si eres parte del equipo de Aura Studio, pídele a la administradora que revise tu acceso.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => signOut()}>
          Cerrar sesión
        </Button>
      </div>
    </main>
  )
}
