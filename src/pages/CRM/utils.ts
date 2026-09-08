import { ETIQUETA_COLORS, type ConversacionResumen, type EtiquetaColor, type Mensaje } from "@/lib/types"

const VENTANA_MS = 24 * 60 * 60_000
const VENTANA_HUMAN_AGENT_MS = 7 * 24 * 60 * 60_000

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

export type EstadoVentanaMeta = { abierta: true; modo: "RESPONSE" | "HUMAN_AGENT" } | { abierta: false; motivo: string }

/**
 * Mismo cálculo que `meta/window.ts` del bot (`calcularVentanaMeta`) — se
 * repite acá para poder mostrar el aviso correcto en el compositor ANTES de
 * intentar enviar, no solo después de que el bot lo rechace. Piensa siempre
 * en términos de "responde un humano" (rol='humano'): el compositor del
 * panel es justamente eso, nunca el bot.
 */
export function ventanaMeta(c: ConversacionResumen, humanAgentAprobado: boolean, ahora = Date.now()): EstadoVentanaMeta {
  const transcurrido = ahora - new Date(c.ultimo_mensaje_at).getTime()

  if (transcurrido < VENTANA_MS) return { abierta: true, modo: "RESPONSE" }

  if (transcurrido < VENTANA_HUMAN_AGENT_MS) {
    if (humanAgentAprobado) return { abierta: true, modo: "HUMAN_AGENT" }
    return {
      abierta: false,
      motivo: "Pasaron más de 24 horas. Se podría responder con la etiqueta Human Agent, pero Meta todavía no aprobó esa función para esta app.",
    }
  }

  return { abierta: false, motivo: "Pasaron más de 7 días desde el último mensaje. Ya no se puede retomar la conversación por este canal." }
}

const SIETE_DIAS_MS = 7 * 24 * 60 * 60_000

/** Meta permite UNA respuesta privada por comentario, hasta 7 días después de creado. */
export function puedeRespuestaPrivada(m: Pick<Mensaje, "created_at" | "metadata">, ahora = Date.now()): boolean {
  if (m.metadata?.respondido_privado) return false
  return ahora - new Date(m.created_at).getTime() < SIETE_DIAS_MS
}

/** Color estable por nombre: la misma etiqueta se ve igual siempre. */
export function colorPorNombre(nombre: string): EtiquetaColor {
  let hash = 0
  for (const char of nombre) hash = (hash + char.charCodeAt(0)) % 997
  return ETIQUETA_COLORS[hash % ETIQUETA_COLORS.length]
}
