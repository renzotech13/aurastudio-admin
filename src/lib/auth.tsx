import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "./supabase"
import type { ProfileRole } from "./types"

type AuthState = {
  session: Session | null
  /** true hasta saber si hay una sesión guardada. */
  loading: boolean
  /** Rol de la cuenta. null = todavía no se sabe, o la cuenta no tiene perfil. */
  role: ProfileRole | null
  /** La fila de `profesionales` de esta cuenta. Solo la tiene una profesional activa. */
  profesionalId: string | null
  /**
   * true mientras se consulta el rol de esta sesión. Las puertas esperan en
   * vez de decidir: si no, alguien con acceso completo que abre un enlace
   * directo rebotaría a la pantalla equivocada antes de saber quién es.
   */
  roleCargando: boolean
  /**
   * La consulta del rol falló (sin internet, por ejemplo). Es distinto de
   * «no tiene rol»: a nadie se le dice que no tiene acceso por un corte de red.
   */
  roleError: boolean
  reintentarRol: () => void
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  cambiarContrasena: (nueva: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<ProfileRole | null>(null)
  const [profesionalId, setProfesionalId] = useState<string | null>(null)
  const [roleCargando, setRoleCargando] = useState(false)
  const [roleError, setRoleError] = useState(false)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Depende del id, no del objeto de sesión: cada refresco de token trae un
  // objeto nuevo y no hay por qué volver a preguntar el rol por eso.
  const userId = session?.user.id ?? null
  useEffect(() => {
    if (!userId) {
      setRole(null)
      setProfesionalId(null)
      setRoleCargando(false)
      setRoleError(false)
      return
    }
    let activo = true
    setRoleCargando(true)
    setRoleError(false)

    async function cargar() {
      const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle()
      if (!activo) return
      if (error) return fallar()

      const rol = (data?.role as ProfileRole | undefined) ?? null
      let miProfesional: string | null = null
      // Solo la profesional tiene fila propia en `profesionales`. mi_profesional_id()
      // devuelve null si su cuenta está desactivada: ahí no tiene acceso.
      if (rol === "profesional") {
        const res = await supabase.rpc("mi_profesional_id")
        if (!activo) return
        if (res.error) return fallar()
        miProfesional = (res.data as string | null) ?? null
      }
      setRole(rol)
      setProfesionalId(miProfesional)
      setRoleCargando(false)
    }

    function fallar() {
      setRole(null)
      setProfesionalId(null)
      setRoleError(true)
      setRoleCargando(false)
    }

    cargar().catch(fallar)
    return () => {
      activo = false
    }
  }, [userId, intento])

  const reintentarRol = useCallback(() => setIntento((n) => n + 1), [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? error.message : null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function cambiarContrasena(nueva: string) {
    const { error } = await supabase.auth.updateUser({ password: nueva })
    return { error: error ? error.message : null }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        role,
        profesionalId,
        roleCargando,
        roleError,
        reintentarRol,
        signIn,
        signOut,
        cambiarContrasena,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider")
  return ctx
}
