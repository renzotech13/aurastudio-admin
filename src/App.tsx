import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider, useAuth } from "@/lib/auth"
import Login from "@/pages/Login"
import Resumen from "@/pages/Resumen"
import Caja from "@/pages/Caja"
import Bookings from "@/pages/Bookings"
import Front from "@/pages/Front"
import Productos from "@/pages/Productos"
import Servicios from "@/pages/Servicios"
import CRM from "@/pages/CRM"
import Disponibilidad from "@/pages/Disponibilidad"
import Multimedia from "@/pages/Multimedia"
import AppShell from "@/components/AppShell"

function Gate() {
  const { session, loading } = useAuth()

  if (loading) return null
  if (!session) return <Login />

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/resumen" replace />} />
        <Route path="/resumen" element={<Resumen />} />
        <Route path="/caja" element={<Caja />} />
        <Route path="/front" element={<Front />} />
        <Route path="/productos" element={<Productos />} />
        <Route path="/servicios" element={<Servicios />} />
        <Route path="/reservas" element={<Bookings />} />
        <Route path="/disponibilidad" element={<Disponibilidad />} />
        <Route path="/conversaciones" element={<CRM />} />
        <Route path="/multimedia" element={<Multimedia />} />
        <Route path="*" element={<Navigate to="/resumen" replace />} />
      </Routes>
    </AppShell>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  )
}
