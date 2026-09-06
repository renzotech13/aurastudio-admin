import { useEffect, useState } from "react"

import { supabase } from "@/lib/supabase"
import type { Profesional, Sede } from "@/lib/types"

/**
 * Sedes y profesionales, para los filtros de Reservas y Caja.
 *
 * Se traen las INACTIVAS también: una profesional dada de baja sigue teniendo
 * citas y cobros viejos a su nombre, y si no estuviera acá esas filas
 * aparecerían sin nombre al filtrar el historial. Quien quiera ofrecerla para
 * agendar debe filtrar por `activa` en su propia pantalla.
 */
export function useEquipo() {
  const [sedes, setSedes] = useState<Sede[]>([])
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    async function cargar() {
      const [sedesRes, profRes] = await Promise.all([
        supabase.from("sedes").select("*").order("sort_order"),
        supabase.from("profesionales").select("*").order("sort_order"),
      ])
      if (!activo) return
      if (sedesRes.data) setSedes(sedesRes.data as Sede[])
      if (profRes.data) setProfesionales(profRes.data as Profesional[])
      setCargando(false)
    }
    cargar()
    return () => {
      activo = false
    }
  }, [])

  const nombreSede = (id: string | null) =>
    id ? (sedes.find((s) => s.id === id)?.nombre ?? id) : "—"

  const nombreProfesional = (id: string | null) =>
    id ? (profesionales.find((p) => p.id === id)?.nombre ?? "—") : "—"

  return { sedes, profesionales, cargando, nombreSede, nombreProfesional }
}
