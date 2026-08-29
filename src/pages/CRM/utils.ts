import { ETIQUETA_COLORS, type ConversacionResumen, type EtiquetaColor } from "@/lib/types"

const VENTANA_MS = 24 * 60 * 60_000

/** Una conversación espera respuesta si lo último que llegó fue del cliente. */
export function esperaRespuesta(c: ConversacionResumen): boolean {
  return c.ultimo_rol === "user"
}

/**
 * Meta solo permite texto libre dentro de las 24h posteriores al último
 * mensaje del cliente. `ultimo_mensaje_at` solo avanza con mensajes
 * entrantes, justamente para que este cálculo siga siendo válido cuando el
 * negocio responde.
 */
export function ventanaAbierta(c: ConversacionResumen, ahora = Date.now()): boolean {
  return ahora - new Date(c.ultimo_mensaje_at).getTime() < VENTANA_MS
}

/** Horas que faltan para que se cierre la ventana de 24h. */
export function horasRestantesVentana(c: ConversacionResumen, ahora = Date.now()): number {
  const restante = VENTANA_MS - (ahora - new Date(c.ultimo_mensaje_at).getTime())
  return Math.max(0, Math.floor(restante / 3_600_000))
}

/** Color estable por nombre: la misma etiqueta se ve igual siempre. */
export function colorPorNombre(nombre: string): EtiquetaColor {
  let hash = 0
  for (const char of nombre) hash = (hash + char.charCodeAt(0)) % 997
  return ETIQUETA_COLORS[hash % ETIQUETA_COLORS.length]
}
