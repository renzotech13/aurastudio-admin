import { useState, type ReactNode } from "react"
import { Link, NavLink } from "react-router-dom"
import {
  CalendarDays,
  Ellipsis,
  MessageCircle,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Monitor,
  PenLine,
  PhoneCall,
  Plus,
  ShoppingBag,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { useAuth } from "@/lib/auth"
import { AvisosProvider, useAvisos } from "@/lib/avisos"
import { useEquipo } from "@/lib/equipo"
import { cn } from "@/lib/utils"
import WalkInDialog from "@/pages/Reservas/WalkInDialog"
import CambiarContrasenaDialog from "@/components/CambiarContrasenaDialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type ModoApp = "admin" | "profesional" | "vendedor"

/** Aviso a la agenda de que se guardó una cita desde el botón central. */
export const EVENTO_CITA_GUARDADA = "aura:cita-guardada"

type Item = { to: string; label: string; icon: LucideIcon; end?: boolean }

// Cada rol ve solo lo suyo. La profesional no tiene «Control» ni «Caja»: no
// solo porque el menú no los muestre, sino porque la base tampoco se los abre.
const ITEMS: Record<ModoApp, { izquierda: Item[]; derecha: Item[] }> = {
  admin: {
    izquierda: [
      { to: "/app", label: "Control", icon: LayoutDashboard, end: true },
      { to: "/app/agenda", label: "Agenda", icon: CalendarDays },
      { to: "/app/chats", label: "Chats", icon: MessageCircle },
    ],
    derecha: [
      { to: "/app/caja", label: "Caja", icon: Wallet },
      { to: "/app/mas", label: "Más", icon: Ellipsis },
    ],
  },
  // El vendedor atiende a quienes escriben y les agenda la cita: chats, a quién
  // falta cerrar, las reservas de todo el equipo y el directorio de clientas.
  // Sin caja, sin ventas, sin métricas.
  vendedor: {
    izquierda: [
      { to: "/app/chats", label: "Chats", icon: MessageCircle },
      { to: "/app/por-cerrar", label: "Por cerrar", icon: PhoneCall },
    ],
    derecha: [
      { to: "/app/reservas", label: "Reservas", icon: CalendarDays },
      { to: "/app/clientas", label: "Clientas", icon: Users },
    ],
  },
  profesional: {
    izquierda: [
      { to: "/app", label: "Agenda", icon: CalendarDays, end: true },
      { to: "/app/clientas", label: "Clientas", icon: Users },
    ],
    derecha: [
      { to: "/app/registrar", label: "Registrar", icon: PenLine },
      { to: "/app/vender", label: "Vender", icon: ShoppingBag },
    ],
  },
}

export default function AppMovilShell({ modo, children }: { modo: ModoApp; children: ReactNode }) {
  // La administradora y el vendedor reciben los avisos de mensajes nuevos, igual
  // que en el panel de escritorio; la profesional no tiene bandeja.
  const cuerpo = <ShellInterno modo={modo}>{children}</ShellInterno>
  return modo === "profesional" ? cuerpo : <AvisosProvider>{cuerpo}</AvisosProvider>
}

function ShellInterno({ modo, children }: { modo: ModoApp; children: ReactNode }) {
  const { session, profesionalId, signOut } = useAuth()
  const { profesionales } = useEquipo()
  const [nuevaReserva, setNuevaReserva] = useState(false)
  const [contrasena, setContrasena] = useState(false)

  const yo = profesionales.find((p) => p.id === profesionalId)
  const nombre =
    modo === "profesional" ? (yo?.nombre ?? "Profesional") : modo === "vendedor" ? "Ventas" : "Administrador"
  const inicial = (modo === "vendedor" ? (session?.user.email ?? nombre) : nombre).charAt(0).toUpperCase()
  const { izquierda, derecha } = ITEMS[modo]

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* El padding de arriba respeta la muesca del celular cuando la app se
          instala en la pantalla de inicio. */}
      <header className="sticky top-0 z-40 border-b border-[rgba(247,243,234,0.12)] bg-[#241a12] pt-[env(safe-area-inset-top)] text-[#f2ebdd]">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-full border border-gold/50 font-heading text-[14px] text-gold"
            >
              A
            </span>
            <span className="leading-tight">
              <span className="block font-heading text-[12.5px] tracking-[0.12em] uppercase">Aura Studio</span>
              <span className="block text-[10.5px] tracking-[0.16em] text-[#f2ebdd]/50 uppercase">
                {modo === "admin" ? "Administrador" : modo === "vendedor" ? "Ventas" : "Profesional"}
              </span>
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Mi cuenta"
              className="flex size-9 items-center justify-center rounded-full border border-[rgba(247,243,234,0.25)] font-heading text-[14px] transition-colors hover:border-gold focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none"
            >
              {inicial}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuLabel className="font-normal">
                <span className="block text-[13px] font-medium text-foreground">{nombre}</span>
                <span className="block truncate text-[11.5px] text-muted-foreground">{session?.user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setContrasena(true)}>
                <KeyRound />
                Cambiar contraseña
              </DropdownMenuItem>
              {modo === "admin" ? (
                <DropdownMenuItem render={<Link to="/resumen" />}>
                  <Monitor />
                  Abrir el panel completo
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="min-w-0 flex-1 pb-[calc(88px+env(safe-area-inset-bottom))]">{children}</main>

      <nav
        aria-label="Navegación de la app"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[rgba(247,243,234,0.12)] bg-[#241a12] pb-[env(safe-area-inset-bottom)] text-[#f2ebdd]"
      >
        <ul className="mx-auto flex max-w-xl items-end justify-around px-2">
          {izquierda.map((it) =>
            modo !== "profesional" && it.to === "/app/chats" ? (
              <AvisoChats key={it.to}>{(n) => <Pestana item={it} aviso={n} />}</AvisoChats>
            ) : (
              <Pestana key={it.to} item={it} aviso={0} />
            ),
          )}
          {modo !== "profesional" ? (
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setNuevaReserva(true)}
                aria-label="Nueva reserva"
                className="mx-auto -mt-5 flex size-14 flex-col items-center justify-center rounded-full bg-gold text-[#33200f] shadow-[0_6px_18px_rgba(0,0,0,0.35)] transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#241a12] focus-visible:outline-none"
              >
                <Plus className="size-6" strokeWidth={2.2} />
              </button>
              <span className="block pt-0.5 pb-1.5 text-center text-[10px] text-[#f2ebdd]/60">Reservar</span>
            </li>
          ) : null}
          {derecha.map((it) => (
            <Pestana key={it.to} item={it} aviso={0} />
          ))}
        </ul>
      </nav>

      {modo !== "profesional" ? (
        <WalkInDialog
          open={nuevaReserva}
          onOpenChange={setNuevaReserva}
          onGuardado={() => window.dispatchEvent(new Event(EVENTO_CITA_GUARDADA))}
          titulo="Nueva reserva"
          modo="reserva"
          puedeCerrarAtencion={modo === "admin"}
        />
      ) : null}
      <CambiarContrasenaDialog open={contrasena} onOpenChange={setContrasena} />
    </div>
  )
}

/** Lee el contador de sin-responder para la pestaña Chats. Vive aparte de
 *  ShellInterno para no llamar useAvisos() bajo una condición: este
 *  componente solo se monta cuando modo === "admin", dentro de AvisosProvider. */
function AvisoChats({ children }: { children: (sinResponder: number) => ReactNode }) {
  const { sinResponder } = useAvisos()
  return children(sinResponder)
}

function Pestana({ item, aviso }: { item: Item; aviso: number }) {
  const { to, label, icon: Icon, end } = item
  return (
    <li className="flex-1">
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          cn(
            "flex flex-col items-center gap-0.5 rounded-xl px-1 pt-2 pb-1.5 text-[10px] transition-colors",
            "focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:outline-none",
            isActive ? "text-gold" : "text-[#f2ebdd]/60 hover:text-[#f2ebdd]",
          )
        }
      >
        <span className="relative">
          <Icon className="size-[22px]" strokeWidth={1.8} />
          {aviso > 0 ? (
            <span className="tnum absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-semibold text-[#33200f]">
              {aviso > 9 ? "9+" : aviso}
            </span>
          ) : null}
        </span>
        {label}
      </NavLink>
    </li>
  )
}
