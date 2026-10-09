import { Link } from "react-router-dom"
import {
  CalendarCheck2,
  CalendarClock,
  BellRing,
  ChevronRight,
  Images,
  Radio,
  ShoppingBag,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react"

type Enlace = { to: string; label: string; detalle: string; icon: LucideIcon }

// Todo lo que el panel de escritorio gestiona y que no cabe en las cuatro
// pestañas de la app. Cada enlace abre la sección completa: el panel ya se
// adapta al celular, no hay que duplicar cada pantalla acá.
const GRUPOS: { titulo: string; enlaces: Enlace[] }[] = [
  {
    titulo: "Operación",
    enlaces: [
      { to: "/reservas", label: "Reservas", detalle: "Todas las citas, filtros y comprobantes", icon: CalendarCheck2 },
      { to: "/app/clientas", label: "Clientas", detalle: "Historial, servicios y a quién no escribirle", icon: Users },
      { to: "/app/reactivacion", label: "Reactivación", detalle: "Invitar a volver a quien ya se atendió", icon: BellRing },
      { to: "/profesionales", label: "Profesionales", detalle: "Equipo, servicios y locales", icon: Users },
      { to: "/disponibilidad", label: "Disponibilidad", detalle: "Horarios y bloqueos", icon: CalendarClock },
      { to: "/canales", label: "Canales", detalle: "Estado de las conexiones del bot", icon: Radio },
    ],
  },
  {
    titulo: "Contenido",
    enlaces: [
      { to: "/servicios", label: "Servicios", detalle: "Catálogo, precios y duraciones", icon: Sparkles },
      { to: "/productos", label: "Productos", detalle: "Tienda y precios", icon: ShoppingBag },
      { to: "/multimedia", label: "Multimedia", detalle: "Fotos y videos del sitio", icon: Images },
    ],
  },
]

export default function Mas() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-5">
      <p className="text-[10.5px] tracking-[0.2em] text-gold-deep uppercase dark:text-gold">Gestión</p>
      <h1 className="aura-display mb-5 text-[24px] leading-tight">Todo el panel</h1>

      <div className="flex flex-col gap-6">
        {GRUPOS.map((grupo) => (
          <section key={grupo.titulo} aria-label={grupo.titulo}>
            <h2 className="mb-2 px-1 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">{grupo.titulo}</h2>
            <ul className="overflow-hidden rounded-2xl border border-border bg-card">
              {grupo.enlaces.map(({ to, label, detalle, icon: Icon }) => (
                <li key={to} className="border-b border-border last:border-b-0">
                  <Link
                    to={to}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-gold/10 focus-visible:bg-gold/10 focus-visible:outline-none"
                  >
                    <Icon aria-hidden className="size-5 shrink-0 text-gold-deep dark:text-gold" strokeWidth={1.7} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium">{label}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">{detalle}</span>
                    </span>
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground/60" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
