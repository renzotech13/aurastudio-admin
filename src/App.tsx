import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider, useAuth } from "@/lib/auth"
import Login from "@/pages/Login"
import SinAcceso from "@/pages/SinAcceso"
import Resumen from "@/pages/Resumen"
import Caja from "@/pages/Caja"
import Bookings from "@/pages/Bookings"
import Productos from "@/pages/Productos"
import Servicios from "@/pages/Servicios"
import Equipo from "@/pages/Equipo"
import CRM from "@/pages/CRM"
import Metricas from "@/pages/CRM/Metricas"
import Canales from "@/pages/Canales"
import Disponibilidad from "@/pages/Disponibilidad"
import Multimedia from "@/pages/Multimedia"
import RevisionGuias from "@/pages/RevisionGuias"
import RevisionPublica from "@/pages/RevisionPublica"
import AppAgenda from "@/pages/App/Agenda"
import AppChats from "@/pages/App/Chats"
import AppClientas from "@/pages/App/Clientas"
import AppRegistrar from "@/pages/App/Registrar"
import AppVender from "@/pages/App/Vender"
import AppMas from "@/pages/App/Mas"
import AppPorCerrar from "@/pages/App/PorCerrar"
import AppDirectorio from "@/pages/App/Directorio"
import AppShell from "@/components/AppShell"
import AppMovilShell from "@/components/AppMovilShell"
import { Button } from "@/components/ui/button"

/**
 * Pantalla de espera mientras se sabe quién es. Las puertas esperan en vez de
 * decidir: sin esto, quien abre un enlace directo rebotaría a la pantalla
 * equivocada antes de que la base responda cuál es su rol.
 */
function Cargando() {
  return <div className="min-h-svh bg-background" aria-busy aria-label="Cargando" />
}

function FalloRol() {
  const { reintentarRol, signOut } = useAuth()
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="aura-display text-[22px] leading-tight">No pudimos verificar tu cuenta</h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
          Parece un problema de conexión. Revisa tu internet e inténtalo otra vez.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="gold" onClick={reintentarRol}>
            Reintentar
          </Button>
          <Button variant="ghost" onClick={() => signOut()}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    </main>
  )
}

/** Devuelve la pantalla que corresponde cuando todavía no hay un rol que abra algo. */
function useEstadoAcceso() {
  const { session, loading, role, roleCargando, roleError } = useAuth()
  if (loading) return { vista: <Cargando /> }
  if (!session) return { vista: <Login /> }
  if (roleCargando) return { vista: <Cargando /> }
  if (roleError) return { vista: <FalloRol /> }
  return { vista: null, role }
}

/**
 * Un celular (no una tablet) va directo a la app: el panel de escritorio
 * tiene sidebar fija y tablas anchas, inusable con el pulgar. 640px deja del
 * lado del panel a la tablet del local, que es donde sí se quiere.
 */
function esCelular(): boolean {
  return window.matchMedia("(max-width: 639px)").matches
}

/** Panel de escritorio: solo administración. La profesional va a su app. */
function Gate() {
  const { role, profesionalId } = useAuth()
  const { vista } = useEstadoAcceso()
  if (vista) return vista

  if (role === "profesional") {
    return profesionalId ? <Navigate to="/app" replace /> : <SinAcceso />
  }
  // El vendedor solo existe en la app: el panel de escritorio depende de
  // is_staff(), que para él es false — vería todo vacío.
  if (role === "vendedor") return <Navigate to="/app" replace />
  if (role !== "staff") return <SinAcceso />
  if (esCelular()) return <Navigate to="/app" replace />

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/resumen" replace />} />
        <Route path="/resumen" element={<Resumen />} />
        <Route path="/caja" element={<Caja />} />
        <Route path="/productos" element={<Productos />} />
        <Route path="/servicios" element={<Servicios />} />
        <Route path="/reservas" element={<Bookings />} />
        <Route path="/profesionales" element={<Equipo />} />
        <Route path="/disponibilidad" element={<Disponibilidad />} />
        <Route path="/conversaciones" element={<CRM />} />
        <Route path="/conversaciones/metricas" element={<Metricas />} />
        <Route path="/canales" element={<Canales />} />
        <Route path="/multimedia" element={<Multimedia />} />
        <Route path="/revision-guias" element={<RevisionGuias />} />
        <Route path="*" element={<Navigate to="/resumen" replace />} />
      </Routes>
    </AppShell>
  )
}

/**
 * App móvil (/app). Un solo árbol de rutas por rol: la administradora ve
 * control, agenda de todos, caja y gestión; la profesional solo su agenda,
 * sus clientas y lo que puede registrar. Ningún rol ve las rutas del otro.
 */
function GateApp() {
  const { role, profesionalId } = useAuth()
  const { vista } = useEstadoAcceso()
  if (vista) return vista

  if (role === "staff") {
    return (
      <AppMovilShell modo="admin">
        <Routes>
          <Route index element={<Resumen />} />
          <Route path="agenda" element={<AppAgenda modo="admin" />} />
          <Route path="chats" element={<AppChats modo="admin" />} />
          <Route path="caja" element={<Caja />} />
          <Route path="mas" element={<AppMas />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </AppMovilShell>
    )
  }

  if (role === "vendedor") {
    return (
      <AppMovilShell modo="vendedor">
        <Routes>
          <Route index element={<Navigate to="/app/chats" replace />} />
          <Route path="chats" element={<AppChats modo="vendedor" />} />
          <Route path="por-cerrar" element={<AppPorCerrar />} />
          <Route path="reservas" element={<AppAgenda modo="vendedor" />} />
          <Route path="clientas" element={<AppDirectorio />} />
          <Route path="*" element={<Navigate to="/app/chats" replace />} />
        </Routes>
      </AppMovilShell>
    )
  }

  if (role === "profesional" && profesionalId) {
    return (
      <AppMovilShell modo="profesional">
        <Routes>
          <Route index element={<AppAgenda modo="profesional" />} />
          <Route path="clientas" element={<AppClientas />} />
          <Route path="registrar" element={<AppRegistrar />} />
          <Route path="vender" element={<AppVender />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </AppMovilShell>
    )
  }

  return <SinAcceso />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pública, sin sesión: la abre alguien del salón desde su celular con un enlace con token. */}
        <Route path="/revision/:token" element={<RevisionPublica />} />
        <Route
          path="*"
          element={
            <AuthProvider>
              <Routes>
                <Route path="/app/*" element={<GateApp />} />
                <Route path="*" element={<Gate />} />
              </Routes>
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
