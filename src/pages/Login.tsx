import { useState, type FormEvent } from "react"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) setError("No se pudo iniciar sesión. Revisa el correo y la contraseña.")
  }

  return (
    /* Fondo marrón profundo con el halo dorado del sitio: la puerta del panel
       se parece a la portada, no a un formulario cualquiera. */
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#241a12] px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 size-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70"
        style={{
          background:
            "radial-gradient(circle, rgba(200,145,22,0.20) 0%, rgba(200,145,22,0.06) 42%, transparent 68%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <span
            aria-hidden
            className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full border border-gold/50 font-heading text-[22px] text-gold"
          >
            A
          </span>
          <h1 className="aura-display text-[22px] text-[#f2ebdd]">Aura Studio</h1>
          <p className="mt-2 text-[11px] tracking-[0.22em] text-[#f2ebdd]/45 uppercase">
            Panel de administración
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="aura-crest flex flex-col gap-4 rounded-2xl border border-[rgba(247,243,234,0.14)] bg-[rgba(247,243,234,0.04)] p-6 backdrop-blur-sm"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-[#f2ebdd]/80">
              Correo
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-[rgba(247,243,234,0.2)] bg-[rgba(247,243,234,0.05)] text-[#f2ebdd] placeholder:text-[#f2ebdd]/35 focus-visible:bg-[rgba(247,243,234,0.08)]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-[#f2ebdd]/80">
              Contraseña
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-[rgba(247,243,234,0.2)] bg-[rgba(247,243,234,0.05)] text-[#f2ebdd] placeholder:text-[#f2ebdd]/35 focus-visible:bg-[rgba(247,243,234,0.08)]"
            />
          </div>

          {error ? (
            <p role="alert" className="text-[13px] text-status-cancelled">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="gold" size="cta" disabled={submitting} className="mt-2 w-full">
            {submitting ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-[11px] text-[#f2ebdd]/35">aurastudio.pe · Los Olivos, Lima</p>
      </div>
    </div>
  )
}
