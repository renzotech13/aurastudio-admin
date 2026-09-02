import { useEffect, useState, type ReactNode } from "react"
import { NavLink, useLocation } from "react-router-dom"
import {
  CalendarCheck2,
  CalendarClock,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  PenLine,
  ShoppingBag,
  Sparkles,
  Wallet,
  X,
} from "lucide-react"

import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * La navegación va en dos bloques porque son dos oficios distintos: quien
 * atiende el mostrador vive en «Operación», quien mantiene la web vive en
 * «Contenido».
 */
const GRUPOS = [
  {
    titulo: "Operación",
    items: [
      { to: "/resumen", label: "Resumen", icon: LayoutDashboard },
      { to: "/caja", label: "Caja", icon: Wallet },
      { to: "/reservas", label: "Reservas", icon: CalendarCheck2 },
      { to: "/disponibilidad", label: "Disponibilidad", icon: CalendarClock },
      { to: "/conversaciones", label: "Conversaciones", icon: MessagesSquare },
    ],
  },
  {
    titulo: "Contenido",
    items: [
      { to: "/front", label: "Front", icon: PenLine },
      { to: "/servicios", label: "Servicios", icon: Sparkles },
      { to: "/productos", label: "Productos", icon: ShoppingBag },
      { to: "/multimedia", label: "Multimedia", icon: Images },
    ],
  },
]

export default function AppShell({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const { pathname } = useLocation()

  // Navegar cierra el menú móvil: si no, tapa la página a la que acabas de ir.
  useEffect(() => setAbierto(false), [pathname])

  return (
    <div className="flex min-h-svh flex-col bg-background lg:flex-row">
      {/* Barra superior — solo en móvil y tablet */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[rgba(247,243,234,0.12)] bg-[#241a12] px-4 py-3 text-[#f2ebdd] lg:hidden">
        <Marca />
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls="nav-movil"
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          className="rounded-full border border-[rgba(247,243,234,0.25)] p-2 transition-colors hover:border-gold focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none"
        >
          {abierto ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </header>

      {/* Barra lateral (y panel desplegable en móvil) */}
      <aside
        id="nav-movil"
        className={cn(
          "z-30 shrink-0 flex-col border-[rgba(247,243,234,0.1)] bg-[#241a12] text-[#f2ebdd]",
          "lg:sticky lg:top-0 lg:flex lg:h-svh lg:w-[248px] lg:border-r",
          abierto ? "flex border-b" : "hidden"
        )}
      >
        <div className="hidden px-5 py-6 lg:block">
          <Marca />
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4 lg:py-0">
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo}>
              <p className="mb-2 px-3 text-[10px] tracking-[0.2em] text-[#f2ebdd]/40 uppercase">
                {grupo.titulo}
              </p>
              <ul className="space-y-0.5">
                {grupo.items.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      className={({ isActive }) =>
                        cn(
                          "group/nav relative flex items-center gap-3 rounded-full px-3 py-2.5 text-[13px] transition-all duration-300",
                          "focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none",
                          isActive
                            ? "bg-[#f2ebdd] font-medium text-[#241a12]"
                            : "text-[#f2ebdd]/70 hover:bg-[rgba(247,243,234,0.08)] hover:text-[#f2ebdd]"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={cn(
                              "size-4 shrink-0 transition-colors",
                              isActive ? "text-[#241a12]" : "text-gold/70 group-hover/nav:text-gold"
                            )}
                          />
                          {label}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-[rgba(247,243,234,0.1)] p-3">
          <div className="mb-2 truncate px-3 text-[11px] text-[#f2ebdd]/50">
            {session?.user.email}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-[#f2ebdd]/75 hover:bg-[rgba(247,243,234,0.08)] hover:text-[#f2ebdd]"
            onClick={() => signOut()}
          >
            <LogOut className="size-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}

function Marca() {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="flex size-9 items-center justify-center rounded-full border border-gold/50 font-heading text-[15px] text-gold"
      >
        A
      </span>
      <span className="leading-tight">
        <span className="block font-heading text-[13px] tracking-[0.12em] uppercase">
          Aura Studio
        </span>
        <span className="block text-[10.5px] tracking-[0.18em] text-[#f2ebdd]/45 uppercase">
          Panel
        </span>
      </span>
    </div>
  )
}
