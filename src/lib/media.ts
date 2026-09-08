import { useEffect, useState } from "react"
import { supabase } from "./supabase"

/**
 * Mismo patrón que `verComprobante()` en ClientPanel.tsx (URLs de 60s), pero
 * como hook reutilizable — las burbujas del hilo se re-renderizan seguido
 * (realtime), y sin caché cada render pediría una URL firmada nueva para el
 * mismo adjunto.
 */
const cache = new Map<string, { url: string; expiraEn: number }>()
const VIDA_MS = 55_000 // un poco menos que los 60s reales, para no servir una a punto de vencer

/** null mientras carga o si no hay `path`; también null si Supabase no pudo firmarla. */
export function useUrlFirmada(bucket: string, path: string | null | undefined): string | null {
  const key = path ? `${bucket}/${path}` : null

  const [url, setUrl] = useState<string | null>(() => {
    if (!key) return null
    const cacheada = cache.get(key)
    return cacheada && cacheada.expiraEn > Date.now() ? cacheada.url : null
  })

  useEffect(() => {
    if (!key || !path) {
      setUrl(null)
      return
    }

    const cacheada = cache.get(key)
    if (cacheada && cacheada.expiraEn > Date.now()) {
      setUrl(cacheada.url)
      return
    }

    let activo = true
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60)
      .then(({ data, error }) => {
        if (!activo) return
        if (error || !data) {
          setUrl(null)
          return
        }
        cache.set(key, { url: data.signedUrl, expiraEn: Date.now() + VIDA_MS })
        setUrl(data.signedUrl)
      })

    return () => {
      activo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return url
}
