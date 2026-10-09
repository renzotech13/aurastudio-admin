import { supabase } from "./supabase"
import type { Cita, CitaEstado, Mensaje } from "./types"

const BASE_URL = import.meta.env.VITE_BOT_API_URL as string | undefined

/**
 * Enviar por WhatsApp no se puede hacer desde el navegador: el token de
 * Meta vive solo en el bot. Este módulo habla con los endpoints /admin/*
 * del bot, que validan el JWT de Supabase y exigen rol staff.
 */
export class BotApiError extends Error {
  readonly code: string
  /** El body completo del error, tal como lo mandó el bot — algunos endpoints
   *  (telefono_en_uso) van con datos extra que el mensaje traducido no cubre. */
  readonly detalle: Record<string, unknown>

  constructor(message: string, code: string, detalle: Record<string, unknown> = {}) {
    super(message)
    this.name = "BotApiError"
    this.code = code
    this.detalle = detalle
  }
}

const MENSAJES_ERROR: Record<string, string> = {
  sin_configurar: "Falta configurar VITE_BOT_API_URL para conectar con el bot.",
  sin_sesion: "Tu sesión expiró. Vuelve a iniciar sesión.",
  missing_token: "Tu sesión expiró. Vuelve a iniciar sesión.",
  invalid_token: "Tu sesión expiró. Vuelve a iniciar sesión.",
  forbidden: "Tu usuario no tiene permiso para esta acción.",
  conversacion_no_encontrada: "Esa conversación ya no existe.",
  conflicto_horario: "Esa profesional ya tiene una cita a esa hora. Elige otra hora u otra profesional.",
  fuera_de_politica: "Esa hora cae fuera del horario de atención del local.",
  profesional_no_encontrada: "Esa profesional no atiende en ese local.",
  cliente_no_encontrado: "Esa clienta ya no existe.",
  cita_no_encontrada: "Esa cita ya no existe.",
  bloqueo_no_encontrado: "Ese bloqueo ya no existe.",
  plantilla_no_encontrada: "Esa multimedia ya no existe.",
  whatsapp_send_failed: "WhatsApp rechazó el envío. Revisa los logs del bot.",
  red: "No se pudo conectar con el bot. Revisa que esté en línea.",
  // Bandeja omnicanal.
  human_agent_no_aprobado:
    "Pasaron más de 24 horas y Meta todavía no aprobó la función Human Agent para esta app — no se puede retomar por este canal.",
  comentario_no_admite_privado: "Ese comentario ya no admite respuesta privada (ya se usó, o pasaron más de 7 días).",
  comentario_no_encontrado: "Ese comentario ya no existe.",
  meta_send_failed: "Meta rechazó el envío. Revisa los logs del bot.",
  meta_api_failed: "No se pudo completar la acción en Meta. Revisa los logs del bot.",
  canal_no_configurado: "Ese canal todavía no está configurado en el bot.",
  canal_no_soportado: "Esa acción no está disponible para este canal.",
  telefono_en_uso: "Ese número ya es de otra clienta.",
  telefono_invalido: "Ese número no parece válido.",
  // App de la profesional.
  caja_cerrada: "No hay una caja abierta en tu local. Avisa a recepción para que la abra.",
  servicio_no_permitido: "Ese servicio no está entre los que haces tú.",
  solo_administracion: "Eso lo registra la administradora o la profesional que atendió.",
  meta_rechazo: "Meta no dejó enviar la plantilla. Casi siempre es que todavía no está aprobada o el nombre no coincide.",
  fecha_pasada: "Una reserva tiene que ser desde ahora en adelante. Para una atención que ya pasó, avisa a recepción.",
  fuera_de_rango: "Solo puedes anotar atenciones de los últimos dos días o de las próximas 24 horas.",
  profesional_inactiva: "Tu cuenta ya no está activa. Habla con el administrador.",
}

async function llamar<T>(path: string, init: RequestInit): Promise<T> {
  if (!BASE_URL) throw new BotApiError(MENSAJES_ERROR.sin_configurar, "sin_configurar")

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new BotApiError(MENSAJES_ERROR.sin_sesion, "sin_sesion")

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new BotApiError(MENSAJES_ERROR.red, "red")
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const code = typeof json.error === "string" ? json.error : "desconocido"
    // El bot manda `mensaje` cuando el detalle importa para el usuario
    // (p. ej. la ventana de 24h cerrada); si no, se traduce el código.
    const texto =
      typeof json.mensaje === "string" ? json.mensaje : (MENSAJES_ERROR[code] ?? "No se pudo completar la acción.")
    throw new BotApiError(texto, code, json)
  }
  return json as T
}

function post<T>(path: string, body: unknown): Promise<T> {
  return llamar<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function get<T>(path: string): Promise<T> {
  return llamar<T>(path, { method: "GET" })
}

export function enviarMensajeHumano(conversacionId: string, texto: string) {
  return post<{ mensaje: Mensaje }>("/admin/mensajes", { conversacionId, texto })
}

export function enviarPlantillaMensaje(conversacionId: string, plantillaId: string) {
  return post<{ mensaje: Mensaje }>("/admin/mensajes", { conversacionId, plantillaId })
}

export function enviarPromocion(params: { clienteIds: string[]; plantilla: string; parametros?: string[] }) {
  return post<{ enviadas: number; fallidas: { clienteId: string; motivo: string }[] }>("/admin/promociones", params)
}

export type PlantillaWhatsapp = {
  nombre: string
  estado: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED"
  categoria: "UTILITY" | "MARKETING" | "AUTHENTICATION"
  idioma: string
  variables: number
}

export function listarPlantillas() {
  return get<{ plantillas: PlantillaWhatsapp[] }>("/admin/plantillas")
}

/**
 * Registrar a una clienta que llegó sin reservar. Pasa por el bot porque
 * ahí vive la validación de solapamiento y el permiso para saltarse la
 * antelación mínima, que desde el navegador no se puede otorgar.
 */
export function registrarWalkIn(params: {
  cliente_id?: string
  telefono?: string
  nombre?: string
  servicio_ids: string[]
  sede_id: string
  profesional_id: string
  inicio: string
  estado: "confirmada" | "completada"
  comentario?: string
}) {
  return post<{ citas: Cita[]; cliente: { id: string; nombre: string | null; telefono: string } }>(
    "/admin/citas",
    params,
  )
}

/**
 * Pasa por el bot (no un update directo a Supabase) para que, al cancelar,
 * también borre el evento de Calendar — el navegador nunca tiene las
 * credenciales de la service account.
 */
export function actualizarEstadoCita(citaId: string, estado: CitaEstado) {
  return post<{ cita: Cita }>(`/admin/citas/${citaId}/estado`, { estado })
}

/** Mismo motivo que actualizarEstadoCita: si el bloqueo vino de Calendar, hay que borrar el evento también. */
export function eliminarBloqueo(bloqueoId: string) {
  return post<Record<string, never>>(`/admin/bloqueos/${bloqueoId}/eliminar`, {})
}

/**
 * Responder un comentario de Facebook/Instagram. En público devuelve el
 * mensaje nuevo (para pintar la burbuja sin esperar el realtime); en
 * privado devuelve a qué conversación de DM saltar.
 */
export type RespuestaComentarioResultado = { mensaje: Mensaje } | { conversacionDmId: string }

export function responderComentario(mensajeId: string, params: { modo: "publico" | "privado"; texto: string }) {
  return post<RespuestaComentarioResultado>(`/admin/comentarios/${mensajeId}/responder`, params)
}

/** Un borrador de respuesta — nunca envía ni guarda nada solo, el staff decide qué hacer con el texto. */
export function sugerirRespuesta(conversacionId: string) {
  return post<{ texto: string }>("/admin/ia/sugerencia", { conversacionId })
}

/**
 * Misma lógica que la tool guardar_datos_contacto del bot: si el teléfono ya
 * es de otra clienta, el error `telefono_en_uso` trae `clienteExistente` en
 * `BotApiError.detalle` — reintentar con `fusionar: true` completa la fusión.
 */
export function guardarTelefonoCliente(clienteId: string, telefono: string, fusionar?: boolean) {
  return post<{ clienteId: string; fusionado: boolean }>(`/admin/clientes/${clienteId}/telefono`, {
    telefono,
    ...(fusionar ? { fusionar: true } : {}),
  })
}

export type EstadoCanales = {
  whatsapp: { configurado: boolean; numero: string | null }
  messenger: { configurado: boolean; pagina: string | null; suscrito: boolean; tokenVence: string | null }
  instagram: { configurado: boolean; cuenta: string | null; username: string | null }
  /** Aprobación de Meta a nivel de app, no un interruptor de negocio — se necesita para calcular el aviso de ventana. */
  metaHumanAgentAprobado: boolean
}

export function estadoCanales() {
  return get<EstadoCanales>("/admin/canales/estado")
}

/**
 * Manda la plantilla de una regla de reactivación a UN número, con datos de
 * ejemplo: sirve para ver que Meta ya la aprobó antes de prender el envío.
 */
export function probarPlantillaReactivacion(reglaId: string, telefono: string) {
  return post<{ ok: true }>("/admin/reactivacion/prueba", { regla_id: reglaId, telefono })
}

/** Cosmético del lado de Meta (sender_action: mark_seen); en WhatsApp no hace nada. */
export function marcarVisto(conversacionId: string) {
  return post<Record<string, never>>(`/admin/conversaciones/${conversacionId}/visto`, {})
}

// ─── Lo que hace una profesional desde su app (rutas /equipo/*) ─────────────
// Son distintas de las /admin/* a propósito: el bot les exige el rol
// `profesional` y filtra todo por SU id. Las respuestas son mínimas — no traen
// el teléfono ni las notas de la clienta.

export function marcarCitaComoProfesional(citaId: string, estado: CitaEstado) {
  return post<{ cita: { id: string; estado: CitaEstado } }>(`/equipo/citas/${citaId}/estado`, { estado })
}

export function registrarAtencionProfesional(params: {
  cliente_id?: string
  telefono?: string
  nombre?: string
  servicio_ids: string[]
  sede_id: string
  inicio: string
  estado: "confirmada" | "completada"
  comentario?: string
}) {
  return post<{
    citas: { id: string; inicio_utc: string; fin_utc: string; estado: CitaEstado }[]
    cliente: { id: string; nombre: string | null }
  }>("/equipo/atencion", params)
}

export function registrarVentaProfesional(params: {
  sede_id: string
  concepto: string
  monto: number
  metodo: string
}) {
  return post<{ movimiento: { id: string; concepto: string; monto: number } }>("/equipo/ventas", params)
}

// ---- Campañas (bot/src/routes/campanias.ts) ----

export type EstadoPlantillaMeta = PlantillaWhatsapp["estado"] | null

export type PlantillaCampania = {
  clave: string
  nombre: string
  titulo: string
  descripcion: string
  categoria: "UTILITY" | "MARKETING"
  cuerpo: string
  pie: string | null
  botones: string[]
  /** La manda el bot sola (recordatorio): no hay envío por lote, solo prueba. */
  automatica: boolean
  /** Estado en Meta; null = todavía no se mandó a aprobar. */
  estado: EstadoPlantillaMeta
  /** Motivo por el que hoy no se puede mandar el lote (fuera de sus fechas), o null. */
  fueraDeFecha: string | null
  revisadas: number
  alcanza: number
  excluidas: { motivo: string; cantidad: number }[]
  muestra: { nombre: string | null; telefono: string }[]
}

export function listarCampanias() {
  return get<{ metaDisponible: boolean; plantillas: PlantillaCampania[] }>("/admin/campanias")
}

export function crearPlantillaCampania(clave: string) {
  return post<{ estado: string; creada: boolean }>("/admin/campanias/plantilla", { clave })
}

export type ResultadoEnvioCampania = { enviados: number; fallidos: { telefono: string; motivo: string }[]; quedan: number }

export function enviarCampania(params: { clave: string; limite?: number; telefonos?: string[] }) {
  return post<ResultadoEnvioCampania>("/admin/campanias/enviar", params)
}
