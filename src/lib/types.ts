export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed"

export type Booking = {
  id: string
  customer_name: string
  phone: string
  service_ids: string[]
  booking_date: string
  booking_time: string
  first_visit: boolean | null
  comment: string | null
  status: BookingStatus
  created_at: string
  updated_at: string
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
}

export type BookingGroup = "Principales" | "Complementarios" | "Opcionales"
export const BOOKING_GROUPS: BookingGroup[] = ["Principales", "Complementarios", "Opcionales"]

export type ServiceCategory = {
  id: string
  icon: string
  title: string
  description: string
  images: string[]
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

export type Service = {
  id: string
  category_id: string
  booking_group: BookingGroup
  name: string
  duration: string
  price: string
  description: string
  sort_order: number
  active: boolean
  deposit_amount: number | null
  created_at: string
  updated_at: string
}

export type Product = {
  id: string
  name: string
  price: number
  description: string
  image_url: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type SiteContent = {
  id: number
  logo_url: string | null
  logo_header_height: number
  logo_footer_height: number
  hero_eyebrow: string
  hero_title: string
  hero_subtitle: string
  hero_image_url: string | null
  about_eyebrow: string
  about_title: string
  about_body: string
  about_image_big: string | null
  about_image_small1: string | null
  about_image_small2: string | null
  belleza_image_url: string | null
  salon_image_url: string | null
  academia_image_url: string | null
  compare_before_image: string | null
  compare_after_image: string | null
  footer_tagline: string
  updated_at: string
}

export type Testimonial = {
  id: string
  avatar_url: string | null
  name: string
  service: string
  quote: string
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

export type Profile = {
  id: string
  role: "staff" | "alumna"
  full_name: string | null
  phone: string | null
  created_at: string
}

/* ---------- CRM: bandeja omnicanal (migración 0017) ---------- */

export type Canal = "whatsapp" | "messenger" | "instagram"
export const CANALES: Canal[] = ["whatsapp", "messenger", "instagram"]

/** De dónde vino la clienta la primera vez. Solo informativo. */
export type CanalOrigen = Canal | "web" | "manual"

/** Los DMs de un canal son una conversación; los comentarios de una publicación, otra. */
export type OrigenConversacion = "dm" | "comentario"

/**
 * 'activa' = el bot responde. 'escalada' = un humano tomó la conversación
 * y el bot se calla (lo aplica el bot en handleMessage.ts). 'cerrada' =
 * archivada, tampoco responde.
 *
 * OJO: esto es QUIÉN RESPONDE, no en qué punto va el lead — eso es `Etapa`.
 * Una conversación puede estar 'activa' y 'calificado' a la vez.
 */
export type ConversacionEstado = "activa" | "escalada" | "cerrada"

/** El embudo comercial. Lo mueven triggers de Postgres, no el panel. */
export type Etapa = "nuevo" | "en_atencion" | "calificado" | "agendado" | "cerrado"

export const ETAPAS: Etapa[] = ["nuevo", "en_atencion", "calificado", "agendado", "cerrado"]

export const ETAPA_LABEL: Record<Etapa, string> = {
  nuevo: "Nuevo",
  en_atencion: "En atención",
  calificado: "Calificado",
  agendado: "Agendado",
  cerrado: "Cerrado",
}

export type MotivoCierre = "ganado" | "perdido" | "spam" | "sin_respuesta" | "otro"

export const MOTIVOS_CIERRE: MotivoCierre[] = ["ganado", "perdido", "spam", "sin_respuesta", "otro"]

export const MOTIVO_CIERRE_LABEL: Record<MotivoCierre, string> = {
  ganado: "Ganado",
  perdido: "Perdido",
  spam: "Spam",
  sin_respuesta: "Sin respuesta",
  otro: "Otro",
}

/** 'humano' es una respuesta escrita por el staff desde este panel. */
export type RolMensaje = "user" | "assistant" | "humano"

export type Cliente = {
  id: string
  /**
   * Null desde la 0017: un lead que llegó por Instagram o Messenger no tiene
   * teléfono hasta que lo da. Todo lo que dependa de WhatsApp (promociones,
   * recordatorios, el enlace wa.me) tiene que filtrar por esto.
   */
  telefono: string | null
  nombre: string | null
  email: string | null
  notas: string | null
  canal_origen: CanalOrigen
  created_at: string
  updated_at: string
}

/**
 * Un identificador de una clienta en un canal. Una misma persona puede tener
 * varios: wa_id en WhatsApp, PSID en Messenger, IGSID en Instagram, y otro
 * distinto con el que comenta — el id de un comentario NO es el de mensajería.
 */
export type TipoIdentidad = "wa_id" | "psid" | "igsid" | "fb_comment_user" | "ig_comment_user"

export type ClienteIdentidad = {
  id: string
  cliente_id: string
  canal: Canal
  tipo: TipoIdentidad
  external_id: string
  cuenta_id: string | null
  nombre_perfil: string | null
  username: string | null
  /** La URL que da Meta caduca; el bot la refresca con cada mensaje. */
  foto_url: string | null
  created_at: string
  updated_at: string
}

/** Fila de `canales`: interruptores y salud de cada canal. */
export type CanalConfig = {
  canal: Canal
  activo: boolean
  ia_activa: boolean
  ia_comentarios_activa: boolean
  texto_respuesta_privada: string | null
  cuenta_id: string | null
  cuenta_nombre: string | null
  ultimo_webhook_at: string | null
  updated_at: string
}

/** Plantilla de texto que el staff inserta escribiendo /atajo. */
export type RespuestaRapida = {
  id: string
  atajo: string
  titulo: string
  /** Admite {{nombre}}, {{sede}} y {{profesional}}. */
  contenido: string
  /** Null = sirve para todos los canales. */
  canal: Canal | null
  activa: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type TipoEvento =
  | "asignacion"
  | "etapa"
  | "estado"
  | "cierre"
  | "fusion"
  | "respuesta_privada"
  | "escalada"

export type EventoConversacion = {
  id: string
  conversacion_id: string
  tipo: TipoEvento
  /** Null = lo hizo el bot o un trigger, no una persona. */
  actor_id: string | null
  detalle: Record<string, unknown>
  created_at: string
}

export type TipoMedia = "image" | "video" | "audio" | "document"

/**
 * 'nota' es interna: nunca se envía y Claude no la ve. 'sistema' es un evento
 * legible dentro del hilo ("Respuesta privada enviada").
 */
export type TipoMensaje = "mensaje" | "comentario" | "nota" | "sistema"

export type MensajeMetadata = {
  post_id?: string
  media_id?: string
  permalink?: string
  parent_id?: string
  comment_id?: string
  respondido_privado?: boolean
  eliminado?: boolean
  /** 'business_suite' cuando el mensaje lo escribió alguien desde Meta, no desde este panel. */
  via?: string
  attachment_type?: string
  reply_to_story?: string
  [clave: string]: unknown
}

export type Mensaje = {
  id: string
  conversacion_id: string
  rol: RolMensaje
  tipo: TipoMensaje
  contenido: string
  /** mid de Messenger/Instagram, id del comentario, o el wa_message_id. */
  external_id: string | null
  wa_message_id: string | null
  /** Quién lo escribió desde el panel. Null si fue el bot o llegó de la clienta. */
  autor_id: string | null
  media_url: string | null
  /** Ruta en el bucket privado `adjuntos`; se muestra con URL firmada. */
  media_path: string | null
  media_type: TipoMedia | null
  metadata: MensajeMetadata
  error_entrega: string | null
  created_at: string
}

export type PlantillaMedia = {
  id: string
  nombre: string
  tipo: TipoMedia
  storage_path: string
  descripcion_uso: string
  caption: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export const TIPO_MEDIA_LABEL: Record<TipoMedia, string> = {
  image: "Imagen",
  video: "Video",
  audio: "Audio",
  document: "Documento",
}

/**
 * Fila de la vista conversaciones_resumen: conversación + clienta + identidad
 * + último mensaje. El último mensaje EXCLUYE las notas internas, para que
 * escribir una nota no haga parecer que la conversación ya fue respondida.
 */
export type ConversacionResumen = {
  id: string
  cliente_id: string
  estado: ConversacionEstado
  created_at: string
  canal: Canal
  origen: OrigenConversacion
  /** Id del post (Facebook) o del media (Instagram) cuando origen='comentario'. */
  hilo_externo: string | null
  cuenta_id: string | null
  identidad_id: string | null
  etapa: Etapa
  motivo_cierre: MotivoCierre | null
  asignada_a: string | null
  asignada_nombre: string | null
  cliente_nombre: string | null
  /** Null en un lead que todavía no dio su número. */
  cliente_telefono: string | null
  identidad_nombre: string | null
  identidad_username: string | null
  identidad_foto: string | null
  ultimo_contenido: string | null
  ultimo_rol: RolMensaje | null
  ultimo_tipo: TipoMensaje | null
  /**
   * Solo avanza con mensajes entrantes: de acá sale la ventana de 24 h. Un
   * comentario NO lo mueve (para eso está ultimo_comentario_at), porque un
   * comentario no habilita escribir por privado.
   */
  ultimo_mensaje_at: string
  ultimo_comentario_at: string | null
  ultima_respuesta_at: string | null
  primera_respuesta_at: string | null
  primera_respuesta_humana_at: string | null
  actividad_at: string
}

export type Etiqueta = {
  id: string
  nombre: string
  color: EtiquetaColor
  created_at: string
}

export type ClienteEtiqueta = {
  cliente_id: string
  etiqueta_id: string
}

export const ETIQUETA_COLORS = ["slate", "rose", "amber", "emerald", "sky", "violet"] as const
export type EtiquetaColor = (typeof ETIQUETA_COLORS)[number]

export const ETIQUETA_CLASSES: Record<EtiquetaColor, string> = {
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200",
}

export type CitaEstado = "confirmada" | "cancelada" | "completada" | "no_asistio"

export const CITA_ESTADO_LABEL: Record<CitaEstado, string> = {
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  completada: "Completada",
  no_asistio: "No asistió",
}

export type ComprobanteEstado = "sin_comprobante" | "confirmado" | "en_revision"

export const COMPROBANTE_ESTADO_LABEL: Record<ComprobanteEstado, string> = {
  sin_comprobante: "Sin comprobante",
  confirmado: "Pago confirmado",
  en_revision: "Comprobante en revisión",
}

/** Local de Aura. Ver migración 0014. */
export type Sede = {
  id: string
  nombre: string
  direccion: string
  yape_numero: string | null
  yape_titular: string | null
  activa: boolean
  sort_order: number
}

/**
 * Quien atiende. OJO: no es lo mismo que `profiles`, que son las cuentas que
 * entran al panel — una profesional puede existir en la agenda sin tener
 * cuenta todavía (`user_id` en null).
 */
export type Profesional = {
  id: string
  slug: string
  nombre: string
  sede_id: string
  rol: string
  foto_url: string | null
  user_id: string | null
  activa: boolean
  sort_order: number
}

export type Cita = {
  id: string
  cliente_id: string
  servicio_id: string
  /** Null en las citas anteriores a la migración 0014. */
  sede_id: string | null
  profesional_id: string | null
  inicio_utc: string
  fin_utc: string
  estado: CitaEstado
  creada_por: "bot" | "humano"
  notas: string | null
  comprobante_estado: ComprobanteEstado
  comprobante_path: string | null
  comprobante_monto_detectado: number | null
  comprobante_nota: string | null
}

export type NotificacionEstado = "pendiente" | "enviada" | "fallida" | "cancelada"

export type Notificacion = {
  id: string
  cliente_id: string
  cita_id: string | null
  tipo: "recordatorio_cita" | "promocion"
  plantilla: string
  estado: NotificacionEstado
  programada_para: string
  enviada_at: string | null
  error: string | null
  created_at: string
}

export type Course = {
  id: string
  icon: string
  title: string
  meta: string
  description: string
  images: string[]
  price: number | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

export type CourseDay = {
  id: string
  course_id: string
  title: string
  sort_order: number
}

export type LessonModality = "Video" | "Presencial"

export type CourseLesson = {
  id: string
  day_id: string
  title: string
  modality: LessonModality
  duration: string
  video_url: string | null
  sort_order: number
}

export type CourseMaterial = {
  id: string
  course_id: string
  name: string
  meta: string
  file_url: string
  sort_order: number
}

export type EnrollmentStatus = "pending" | "active" | "cancelled" | "completed"

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  pending: "Pendiente",
  active: "Activa",
  cancelled: "Cancelada",
  completed: "Completada",
}

export type Enrollment = {
  id: string
  student_id: string
  course_id: string
  status: EnrollmentStatus
  requested_at: string
  decided_at: string | null
}

/* ---------- Control de caja (migración 0009) ---------- */

export type MetodoPago = "efectivo" | "yape" | "plin" | "tarjeta" | "transferencia" | "otro"

export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  yape: "Yape",
  plin: "Plin",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  otro: "Otro",
}

export const METODOS_PAGO: MetodoPago[] = [
  "efectivo",
  "yape",
  "plin",
  "tarjeta",
  "transferencia",
  "otro",
]

/** Solo el efectivo pasa por el cajón físico: es lo único que entra al arqueo. */
export const METODO_ES_EFECTIVO = (m: MetodoPago) => m === "efectivo"

export type MovimientoTipo = "ingreso" | "egreso"

export type CategoriaIngreso =
  | "servicio"
  | "producto"
  | "curso"
  | "propina"
  | "adelanto"
  | "otro"

export type CategoriaEgreso =
  | "insumo"
  | "proveedor"
  | "sueldo"
  | "alquiler"
  | "servicios"
  | "movilidad"
  | "retiro"
  | "otro"

export type CategoriaMovimiento = CategoriaIngreso | CategoriaEgreso

export const CATEGORIAS_INGRESO: { id: CategoriaIngreso; label: string }[] = [
  { id: "servicio", label: "Servicio" },
  { id: "producto", label: "Producto" },
  { id: "curso", label: "Curso / academia" },
  { id: "propina", label: "Propina" },
  { id: "adelanto", label: "Adelanto de cita" },
  { id: "otro", label: "Otro ingreso" },
]

export const CATEGORIAS_EGRESO: { id: CategoriaEgreso; label: string }[] = [
  { id: "insumo", label: "Insumos" },
  { id: "proveedor", label: "Proveedor" },
  { id: "sueldo", label: "Sueldo / comisión" },
  { id: "alquiler", label: "Alquiler" },
  { id: "servicios", label: "Luz, agua, internet" },
  { id: "movilidad", label: "Movilidad" },
  { id: "retiro", label: "Retiro de caja" },
  { id: "otro", label: "Otro egreso" },
]

export const CATEGORIA_LABEL: Record<CategoriaMovimiento, string> = Object.fromEntries([
  ...CATEGORIAS_INGRESO.map((c) => [c.id, c.label]),
  ...CATEGORIAS_EGRESO.map((c) => [c.id, c.label]),
]) as Record<CategoriaMovimiento, string>

export type CajaEstado = "abierta" | "cerrada"

export type CajaSesion = {
  id: string
  estado: CajaEstado
  abierta_por: string
  apertura_at: string
  monto_inicial: number
  /** Local del turno. Null en los turnos anteriores a la migración 0014. */
  sede_id: string | null
  apertura_nota: string | null
  cerrada_por: string | null
  cierre_at: string | null
  monto_declarado: number | null
  cierre_nota: string | null
  created_at: string
  updated_at: string
}

/** Fila de la vista caja_sesiones_resumen: la sesión más su arqueo calculado. */
export type CajaSesionResumen = CajaSesion & {
  ingresos: number
  egresos: number
  ingresos_efectivo: number
  egresos_efectivo: number
  movimientos: number
  efectivo_esperado: number
  /** declarado − esperado. Null mientras la caja siga abierta. */
  diferencia: number | null
}

export type MovimientoCaja = {
  id: string
  sesion_id: string | null
  tipo: MovimientoTipo
  categoria: CategoriaMovimiento
  concepto: string
  monto: number
  metodo: MetodoPago
  cita_id: string | null
  cliente_id: string | null
  servicio_id: string | null
  producto_id: string | null
  /** A quién se le acredita el cobro. Null en lo registrado antes de la 0014. */
  profesional_id: string | null
  anulado: boolean
  anulado_por: string | null
  anulado_at: string | null
  anulado_motivo: string | null
  registrado_por: string
  ocurrido_at: string
  created_at: string
  updated_at: string
}
