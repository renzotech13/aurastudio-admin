-- 0017 — Bandeja omnicanal: Messenger, Instagram y comentarios junto a WhatsApp.
--
-- Se ejecuta de una sola vez en el SQL editor. Segura de correr dos veces.
--
-- QUÉ AGREGA
-- Hasta hoy el CRM asume un solo canal y una sola identidad por clienta: el
-- teléfono. Un lead que escribe por Instagram no tiene teléfono hasta que lo
-- da, comenta con un id distinto del que usa para mandar DM, y puede terminar
-- siendo la misma persona que ya tiene ficha en WhatsApp. De ahí las tres
-- piezas nuevas: `cliente_identidades` (los identificadores de una clienta),
-- `conversaciones.canal/origen/hilo_externo` (una conversación por hilo real)
-- y `fusionar_clientes()` (unir dos fichas cuando se descubre que son la misma).
--
-- QUÉ ARREGLA DE PASO — cuatro cosas que ya están rotas hoy:
--
-- 1. `clientes` solo tiene policy de SELECT (0002, reemplazada por la 0004),
--    pero el panel escribe: ImportarClientesDialog.tsx:73 hace upsert y
--    ClientPanel.tsx / FichaClienteDialog.tsx:123 actualizan `notas`. El
--    upsert revienta con 42501 ("new row violates row-level security policy")
--    y el import muestra el toast genérico de error; el update NO falla, solo
--    afecta cero filas en silencio y el panel dice "Notas guardadas". Mismo
--    hallazgo que la 0012 documentó para `conversaciones`.
--
-- 2. Ninguna migración agregó tablas a la publicación `supabase_realtime`,
--    pero el panel depende de Realtime en mensajes, conversaciones, clientes,
--    cliente_etiquetas, citas y configuracion. Si están suscritas es porque
--    alguien las agregó a mano: acá queda declarado.
--
-- 3. Ni el bucket `comprobantes` ni la columna `clientes.email` están en
--    ninguna migración (los buckets declarados son `site-media` en la 0004 y
--    `plantillas-media` en la 0011). Clonar el repo y correr las migraciones
--    da una base donde el flujo de comprobantes de pago falla al primer Yape
--    y agendar dando el correo falla siempre. Se declaran acá porque la
--    sección 10 depende de `email`.
--
--    Queda deriva SIN cerrar, que no toca a esta migración y merece la suya:
--    bloqueos.google_event_id, citas.comprobante_{estado,path,monto_detectado,
--    nota}, y las tablas calendar_sync_state y configuracion.
--
-- 4. `getOrCreateConversacionActiva()` busca solo estado='activa', así que un
--    mensaje que llega a una conversación escalada crea una CONVERSACIÓN
--    NUEVA y el bot vuelve a responder encima del humano. El índice único
--    parcial de la sección 4 hace que eso sea imposible a nivel de base,
--    además del arreglo en el repositorio del bot.
--
-- ORDEN: las secciones no son intercambiables. Las identidades (2) tienen que
-- existir antes del backfill de `conversaciones.identidad_id` (4), y los
-- duplicados se cierran antes de crear el índice único que los prohíbe.

-- ---------------------------------------------------------------------------
-- 1. clientes: un lead puede no tener teléfono
-- ---------------------------------------------------------------------------
-- El UNIQUE se mantiene: Postgres admite varios NULL en una columna única, así
-- que muchos leads sin teléfono conviven sin chocar entre sí.
alter table clientes alter column telefono drop not null;

-- `email` es otra columna que el código usa y ninguna migración creó (la
-- escribe guardarEmailCliente() y la lee ClientPanel.tsx). Se cierra acá
-- porque fusionar_clientes() de la sección 10 la necesita: sin ella, la
-- función se crea sin protestar —plpgsql no valida columnas al compilar— y
-- revienta recién el día que alguien fusione dos fichas.
alter table clientes add column if not exists email text;

alter table clientes add column if not exists canal_origen text not null default 'whatsapp';
alter table clientes drop constraint if exists clientes_canal_origen_check;
alter table clientes add constraint clientes_canal_origen_check
  check (canal_origen in ('whatsapp', 'messenger', 'instagram', 'web', 'manual'));

-- Las policies que faltaban (ver punto 1 del encabezado). Van declaradas aunque
-- alguien ya las haya creado a mano en producción: el repo tiene que ser
-- reproducible desde cero.
drop policy if exists "Staff can insert clientes" on clientes;
create policy "Staff can insert clientes"
on clientes for insert to authenticated with check (is_staff());

drop policy if exists "Staff can update clientes" on clientes;
create policy "Staff can update clientes"
on clientes for update to authenticated using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------------
-- 2. cliente_identidades: por dónde escribe cada clienta
-- ---------------------------------------------------------------------------
-- Una misma persona puede llegar con cuatro identificadores distintos: wa_id
-- (WhatsApp), PSID (Messenger), IGSID (Instagram) y el id con el que comenta.
-- OJO: el `from.id` de un comentario NO es el PSID/IGSID de mensajería — son
-- espacios de ids distintos. Solo se enlazan cuando Meta lo confirma (la
-- respuesta de una private reply devuelve el `recipient_id` real), por eso
-- `tipo` distingue 'psid' de 'fb_comment_user'.
create table if not exists cliente_identidades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  canal text not null check (canal in ('whatsapp', 'messenger', 'instagram')),
  tipo text not null check (tipo in ('wa_id', 'psid', 'igsid', 'fb_comment_user', 'ig_comment_user')),
  external_id text not null,
  -- Id de NUESTRA página / cuenta de Instagram que recibió el contacto.
  cuenta_id text,
  nombre_perfil text,
  username text,
  -- La URL de foto que da Meta caduca; se refresca con cada mensaje entrante.
  foto_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canal, tipo, external_id)
);

create index if not exists cliente_identidades_cliente_idx on cliente_identidades (cliente_id);

drop trigger if exists cliente_identidades_set_updated_at on cliente_identidades;
create trigger cliente_identidades_set_updated_at
before update on cliente_identidades
for each row execute function set_updated_at();

alter table cliente_identidades enable row level security;
drop policy if exists "Staff can view cliente_identidades" on cliente_identidades;
create policy "Staff can view cliente_identidades"
on cliente_identidades for select to authenticated using (is_staff());
-- Sin policy de escritura a propósito: las identidades las resuelve el bot
-- (service role) a partir de lo que manda Meta, nunca el navegador.

-- Backfill: toda clienta con teléfono ya tenía una identidad de WhatsApp
-- implícita. Sin esto, las conversaciones existentes se quedan sin
-- `identidad_id` y el índice único de la sección 4 no las cubre.
insert into cliente_identidades (cliente_id, canal, tipo, external_id, nombre_perfil)
select id, 'whatsapp', 'wa_id', telefono, nombre
from clientes
where telefono is not null
on conflict (canal, tipo, external_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. canales: configuración y salud de cada canal
-- ---------------------------------------------------------------------------
-- NO se usa la tabla `configuracion`: existe en producción pero no en ninguna
-- migración (deriva conocida, ver inventario-deriva.sql). Meter ajustes nuevos
-- ahí sería agravarla.
create table if not exists canales (
  canal text primary key check (canal in ('whatsapp', 'messenger', 'instagram')),
  activo boolean not null default true,
  -- El bot responde los DMs nuevos de este canal.
  ia_activa boolean not null default true,
  -- Respuesta privada automática al comentario nuevo de una publicación.
  -- Arranca apagada: Meta permite UNA sola respuesta privada por comentario,
  -- así que gastarla con un texto mal redactado no tiene vuelta atrás.
  ia_comentarios_activa boolean not null default false,
  texto_respuesta_privada text,
  -- Los llena el bot al arrancar con estadoConexion(): page id + nombre, o
  -- id de la cuenta de Instagram + @username.
  cuenta_id text,
  cuenta_nombre text,
  -- Salud: último evento recibido por el webhook. Si se queda viejo, la
  -- suscripción se cayó aunque el token siga vivo.
  ultimo_webhook_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into canales (canal) values ('whatsapp'), ('messenger'), ('instagram')
on conflict (canal) do nothing;

drop trigger if exists canales_set_updated_at on canales;
create trigger canales_set_updated_at
before update on canales
for each row execute function set_updated_at();

alter table canales enable row level security;
drop policy if exists "Staff can view canales" on canales;
create policy "Staff can view canales"
on canales for select to authenticated using (is_staff());

drop policy if exists "Staff can update canales" on canales;
create policy "Staff can update canales"
on canales for update to authenticated using (is_staff()) with check (is_staff());
-- Sin insert ni delete: las tres filas son fijas, la UI solo alterna
-- interruptores y edita el texto de la respuesta privada.

-- ---------------------------------------------------------------------------
-- 4. conversaciones: canal, hilo, pipeline del lead y a quién le toca
-- ---------------------------------------------------------------------------
-- `estado` sigue significando QUIÉN RESPONDE ('activa' = el bot, 'escalada' =
-- una persona, 'cerrada' = archivada). `etapa` es el pipeline comercial del
-- lead. Son dos ejes distintos y no hay que mezclarlos: una conversación
-- puede estar 'activa' y 'calificado' a la vez.
alter table conversaciones add column if not exists canal text not null default 'whatsapp';
alter table conversaciones drop constraint if exists conversaciones_canal_check;
alter table conversaciones add constraint conversaciones_canal_check
  check (canal in ('whatsapp', 'messenger', 'instagram'));

-- Los DMs de un canal son una conversación; los comentarios de una persona
-- sobre una misma publicación son otra. Se separan porque las reglas de envío
-- no tienen nada que ver entre sí (ver ultimo_comentario_at más abajo).
alter table conversaciones add column if not exists origen text not null default 'dm';
alter table conversaciones drop constraint if exists conversaciones_origen_check;
alter table conversaciones add constraint conversaciones_origen_check
  check (origen in ('dm', 'comentario'));

-- A quién se le envía: el wa_id / PSID / IGSID concreto, no la clienta.
alter table conversaciones add column if not exists identidad_id uuid references cliente_identidades(id);
-- origen='comentario': id del post (Facebook) o del media (Instagram). null en DMs.
alter table conversaciones add column if not exists hilo_externo text;
-- Nuestra página / cuenta de Instagram que recibió el hilo.
alter table conversaciones add column if not exists cuenta_id text;
alter table conversaciones add column if not exists asignada_a uuid references profiles(id) on delete set null;

alter table conversaciones add column if not exists etapa text not null default 'nuevo';
alter table conversaciones drop constraint if exists conversaciones_etapa_check;
alter table conversaciones add constraint conversaciones_etapa_check
  check (etapa in ('nuevo', 'en_atencion', 'calificado', 'agendado', 'cerrado'));

alter table conversaciones add column if not exists motivo_cierre text;
alter table conversaciones drop constraint if exists conversaciones_motivo_cierre_check;
alter table conversaciones add constraint conversaciones_motivo_cierre_check
  check (motivo_cierre is null or motivo_cierre in ('ganado', 'perdido', 'spam', 'sin_respuesta', 'otro'));

-- Los cuatro sellos de tiempo que alimentan las métricas de atención. Los
-- mantiene el trigger de la sección 8, nunca el código de la aplicación.
alter table conversaciones add column if not exists ultima_respuesta_at timestamptz;
alter table conversaciones add column if not exists primera_respuesta_at timestamptz;
alter table conversaciones add column if not exists primera_respuesta_humana_at timestamptz;
-- Solo origen='comentario'. Deliberadamente separado de `ultimo_mensaje_at`:
-- un comentario NO abre la ventana de 24h de mensajería. La única forma de
-- escribirle por privado a quien solo comentó es la respuesta privada al
-- comentario (una por comentario, hasta 7 días).
alter table conversaciones add column if not exists ultimo_comentario_at timestamptz;

-- Backfill de identidad: todo lo existente es WhatsApp.
update conversaciones cv
set identidad_id = ci.id
from cliente_identidades ci
where ci.cliente_id = cv.cliente_id
  and ci.canal = 'whatsapp'
  and ci.tipo = 'wa_id'
  and cv.identidad_id is null;

-- Backfill de los sellos de respuesta, para que las métricas no arranquen en
-- blanco sobre el historial que ya existe.
update conversaciones cv
set ultima_respuesta_at = r.ultima,
    primera_respuesta_at = r.primera,
    primera_respuesta_humana_at = r.primera_humana
from (
  select conversacion_id,
         max(created_at) filter (where rol in ('assistant', 'humano')) as ultima,
         min(created_at) filter (where rol in ('assistant', 'humano')) as primera,
         min(created_at) filter (where rol = 'humano')                 as primera_humana
  from mensajes
  group by conversacion_id
) r
where r.conversacion_id = cv.id
  and cv.ultima_respuesta_at is null
  and cv.primera_respuesta_at is null
  and cv.primera_respuesta_humana_at is null;

-- Backfill de etapa. El `where etapa = 'nuevo'` es lo que lo hace idempotente:
-- en una segunda corrida no pisa lo que el equipo haya movido a mano.
-- El orden del CASE importa: una conversación con cita Y con respuesta humana
-- es 'agendado', que está más adelante en el embudo que 'en_atencion'.
update conversaciones cv
set etapa = case
  when cv.estado = 'cerrada' then 'cerrado'
  when exists (select 1 from citas c where c.cliente_id = cv.cliente_id and c.estado <> 'cancelada') then 'agendado'
  when exists (select 1 from mensajes m where m.conversacion_id = cv.id and m.rol = 'humano') then 'en_atencion'
  else 'nuevo'
end
where cv.etapa = 'nuevo';

-- Cerrar los duplicados que dejó el bug de getOrCreateConversacionActiva
-- (punto 4 del encabezado) ANTES de crear el índice que los prohíbe, o el
-- CREATE INDEX falla y la migración se cae a la mitad.
--
-- Criterio: de cada grupo de conversaciones abiertas de la misma clienta se
-- conserva la más reciente por actividad y las demás se cierran con motivo
-- 'otro'. No se borra ni se fusiona nada: los mensajes viejos siguen donde
-- están y se pueden leer entrando a esa conversación cerrada.
--
-- Y la sobreviviente HEREDA la escalada si alguna del grupo la tenía. Sin
-- esto el arreglo se muerde la cola: el bug parte la conversación de una
-- clienta que un humano ya estaba atendiendo, la escalada queda en el pedazo
-- viejo, y al cerrarlo el pedazo que sobrevive nace 'activa' — o sea, el bot
-- vuelve a responderle encima al humano, que es exactamente lo que veníamos
-- a impedir.
with grupos as (
  select id,
         cliente_id,
         row_number() over (
           partition by cliente_id, coalesce(hilo_externo, '')
           order by ultimo_mensaje_at desc, created_at desc
         ) as rn,
         bool_or(estado = 'escalada') over (
           partition by cliente_id, coalesce(hilo_externo, '')
         ) as hubo_escalada
  from conversaciones
  where estado <> 'cerrada'
)
update conversaciones cv
set estado = 'escalada'
from grupos g
where g.id = cv.id and g.rn = 1 and g.hubo_escalada and cv.estado <> 'escalada';

with grupos as (
  select id,
         row_number() over (
           partition by cliente_id, coalesce(hilo_externo, '')
           order by ultimo_mensaje_at desc, created_at desc
         ) as rn
  from conversaciones
  where estado <> 'cerrada'
)
update conversaciones cv
set estado = 'cerrada',
    etapa = 'cerrado',
    motivo_cierre = coalesce(cv.motivo_cierre, 'otro')
from grupos g
where g.id = cv.id and g.rn > 1;

-- Una sola conversación abierta por (identidad, hilo). Es la garantía real de
-- que un mensaje nuevo cae en la conversación escalada en vez de abrir otra:
-- el arreglo en el repositorio del bot es la mitad, esto es la otra.
--
-- Las filas con identidad_id null quedan fuera (NULL nunca choca en un índice
-- único), pero el backfill de arriba deja identidad a todo lo existente y el
-- bot siempre resuelve la identidad antes de crear la conversación.
create unique index if not exists conversaciones_hilo_abierto_idx
  on conversaciones (identidad_id, (coalesce(hilo_externo, '')))
  where estado <> 'cerrada';

create index if not exists conversaciones_canal_estado_idx on conversaciones (canal, estado);
create index if not exists conversaciones_asignada_idx on conversaciones (asignada_a) where estado <> 'cerrada';
create index if not exists conversaciones_etapa_idx on conversaciones (etapa);
-- La policy de UPDATE para staff ya existe (0012) y es por fila, así que cubre
-- las columnas nuevas (etapa, asignada_a, motivo_cierre) sin tocarla.

-- ---------------------------------------------------------------------------
-- 5. mensajes: dedupe persistente, notas internas y adjuntos privados
-- ---------------------------------------------------------------------------
-- `external_id` reemplaza el Map en memoria de routes/webhook.ts, que el
-- propio archivo marca como provisional: no sobrevive a un reinicio ni sirve
-- con más de una instancia. Con el índice único, un evento repetido de Meta
-- es un insert ... on conflict do nothing y se acabó.
alter table mensajes add column if not exists external_id text;

alter table mensajes add column if not exists tipo text not null default 'mensaje';
alter table mensajes drop constraint if exists mensajes_tipo_check;
alter table mensajes add constraint mensajes_tipo_check
  check (tipo in ('mensaje', 'comentario', 'nota', 'sistema'));
-- 'nota'   = interna del staff. NUNCA se envía y nunca la ve Claude.
-- 'sistema'= evento legible en el hilo ("Respuesta privada enviada"). Se
--            guarda con rol='assistant' para no disparar los sellos de
--            respuesta del trigger, que exigen tipo in ('mensaje','comentario').

alter table mensajes add column if not exists autor_id uuid references profiles(id) on delete set null;
-- Ruta en el bucket privado `adjuntos`. Lo público (biblioteca de multimedia)
-- sigue en media_url; lo que manda una clienta por Messenger/Instagram no
-- tiene por qué quedar accesible por URL directa.
alter table mensajes add column if not exists media_path text;
-- post_id, media_id, permalink, parent_id, comment_id, respondido_privado,
-- eliminado, via, attachment_type, reply_to_story…
alter table mensajes add column if not exists metadata jsonb not null default '{}'::jsonb;

-- wa_message_id se conserva por compatibilidad; el código nuevo lee
-- external_id y el de WhatsApp escribe las dos.
--
-- El backfill elige UNA fila por wa_message_id (la más antigua) en vez de
-- copiar la columna entera: el historial puede tener dos filas con el mismo
-- id de Meta y el índice único de abajo las rechazaría. A las perdedoras no
-- se les toca wa_message_id, así que no se pierde el rastro del envío.
--
-- El `not exists` es lo que lo hace idempotente. Un primer intento hacía el
-- backfill completo y después vaciaba los repetidos, y en la SEGUNDA corrida
-- volvía a rellenar justo lo que había vaciado, chocando contra el índice que
-- acababa de crear: la migración corría bien una vez y fallaba la siguiente.
with ganadores as (
  select distinct on (wa_message_id) id, wa_message_id
  from mensajes
  where wa_message_id is not null and external_id is null
  order by wa_message_id, created_at, id
)
update mensajes m
set external_id = g.wa_message_id
from ganadores g
where g.id = m.id
  and not exists (select 1 from mensajes otro where otro.external_id = g.wa_message_id);

create unique index if not exists mensajes_external_id_idx
  on mensajes (external_id) where external_id is not null;

create index if not exists mensajes_conversacion_tipo_idx on mensajes (conversacion_id, tipo, created_at);

-- Lo único que el panel inserta directo: sus propias notas internas. Todo lo
-- demás (mensajes de verdad) pasa por el bot, que es quien puede enviarlos —
-- guardar un mensaje que nunca salió dejaría en el historial algo que la
-- clienta no recibió y que Claude leería como contexto real.
drop policy if exists "Staff can insert notas" on mensajes;
create policy "Staff can insert notas"
on mensajes for insert to authenticated
with check (is_staff() and tipo = 'nota' and rol = 'humano' and autor_id = auth.uid());

-- Bucket privado para los adjuntos entrantes de Messenger/Instagram: las URLs
-- del CDN de Meta caducan, así que el bot descarga el archivo al momento y lo
-- sube acá. El panel lo muestra con URLs firmadas, igual que `comprobantes`.
insert into storage.buckets (id, name, public) values ('adjuntos', 'adjuntos', false)
on conflict (id) do nothing;

drop policy if exists "Staff can list adjuntos objects" on storage.objects;
create policy "Staff can list adjuntos objects"
on storage.objects for select to authenticated
using (bucket_id = 'adjuntos' and is_staff());
-- Sin policy de insert para authenticated: sube solo el bot (service role).

-- `comprobantes` se usa desde la Fase 8 pero no está en ninguna migración
-- (punto 3 del encabezado). Se declara acá para que el repo sea reproducible;
-- si ya existe, estas sentencias no cambian nada.
insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

drop policy if exists "Staff can list comprobantes objects" on storage.objects;
create policy "Staff can list comprobantes objects"
on storage.objects for select to authenticated
using (bucket_id = 'comprobantes' and is_staff());

-- ---------------------------------------------------------------------------
-- 6. respuestas_rapidas: plantillas de texto con atajo
-- ---------------------------------------------------------------------------
-- Distinto de `plantillas_media` (archivos que manda el agente) y de las
-- plantillas aprobadas por Meta (las de fuera de ventana): esto es texto que
-- el staff inserta en el compositor escribiendo /atajo.
create table if not exists respuestas_rapidas (
  id uuid primary key default gen_random_uuid(),
  -- Sin '/' y en minúsculas: el panel agrega la barra al mostrarlo.
  atajo text not null unique,
  titulo text not null,
  -- Admite {{nombre}}, {{sede}} y {{profesional}}; los rellena el panel con
  -- los datos de la clienta antes de insertar el texto en el compositor.
  contenido text not null,
  -- null = sirve para todos los canales.
  canal text check (canal is null or canal in ('whatsapp', 'messenger', 'instagram')),
  activa boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists respuestas_rapidas_set_updated_at on respuestas_rapidas;
create trigger respuestas_rapidas_set_updated_at
before update on respuestas_rapidas
for each row execute function set_updated_at();

alter table respuestas_rapidas enable row level security;
drop policy if exists "Staff can manage respuestas_rapidas" on respuestas_rapidas;
create policy "Staff can manage respuestas_rapidas"
on respuestas_rapidas for all to authenticated using (is_staff()) with check (is_staff());

insert into respuestas_rapidas (atajo, titulo, contenido, sort_order) values
  ('saludo', 'Saludo inicial',
   'Hola {{nombre}}! 💛 Gracias por escribir a Aura Studio. ¿En qué te puedo ayudar?', 10),
  ('precios', 'Precios y carta',
   'Te paso nuestra carta completa con precios y duraciones: https://aurastudio.pe' || chr(10) ||
   'Dime qué servicio te interesa y te confirmo el precio exacto y cuánto demora.', 20),
  ('reservar', 'Cómo reservar',
   'Para agendar necesito tres cositas: qué servicio quieres, qué día te acomoda y en qué sede.' || chr(10) ||
   'Con eso te digo los horarios libres y te la dejo reservada 💛', 30),
  ('horario', 'Horario de atención',
   'Atendemos todos los días de 10:00 a. m. a 9:00 p. m. ¿Qué día te queda mejor?', 50)
on conflict (atajo) do nothing;

-- Las direcciones salen de `sedes` en vez de escribirse a mano: si mañana Aura
-- se muda, se corrige en un solo lugar. El HAVING evita sembrar una respuesta
-- vacía en una base recién creada donde todavía no hay sedes.
insert into respuestas_rapidas (atajo, titulo, contenido, sort_order)
select
  'sedes',
  'Cómo llegar',
  'Tenemos dos locales:' || chr(10) ||
  string_agg('• ' || s.nombre || ' — ' || s.direccion, chr(10) order by s.sort_order) || chr(10) ||
  '¿Cuál te queda más cerca?',
  40
from sedes s
where s.activa
having count(*) > 0
on conflict (atajo) do nothing;

-- ---------------------------------------------------------------------------
-- 7. eventos_conversacion: auditoría y fuente de las notificaciones del panel
-- ---------------------------------------------------------------------------
create table if not exists eventos_conversacion (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references conversaciones(id) on delete cascade,
  tipo text not null check (tipo in
    ('asignacion', 'etapa', 'estado', 'cierre', 'fusion', 'respuesta_privada', 'escalada')),
  -- null = lo hizo el bot o un trigger sin usuario detrás (service role).
  actor_id uuid references profiles(id) on delete set null,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists eventos_conversacion_conv_idx on eventos_conversacion (conversacion_id, created_at desc);
create index if not exists eventos_conversacion_tipo_idx on eventos_conversacion (tipo, created_at desc);

alter table eventos_conversacion enable row level security;
drop policy if exists "Staff can view eventos_conversacion" on eventos_conversacion;
create policy "Staff can view eventos_conversacion"
on eventos_conversacion for select to authenticated using (is_staff());
-- Sin insert para authenticated: los escriben los triggers (security definer)
-- y el bot. Así el rastro no se puede falsificar desde el navegador.

-- ---------------------------------------------------------------------------
-- 8. Triggers
-- ---------------------------------------------------------------------------
-- 8.1 El mensaje mueve la conversación.
--
-- Esto reemplaza a marcarUltimoMensaje() del bot, que hacía un UPDATE aparte
-- después de cada insert: dos viajes a la base y una ventana en la que el
-- mensaje ya existe pero la conversación todavía no lo sabe. Acá es una sola
-- transacción y aplica también a lo que escriba el panel.
--
-- Es security definer porque el bot corre con service role y los triggers
-- tienen que valer igual para las dos vías; con search_path vacío para que
-- nadie pueda colar un esquema propio delante de public.
create or replace function mensajes_actualiza_conversacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.rol = 'user' and new.tipo = 'mensaje' then
    -- Solo los mensajes entrantes mueven ultimo_mensaje_at: de ahí se calcula
    -- la ventana de 24h, y avanzarlo al responder la volvería infinita.
    update public.conversaciones
       set ultimo_mensaje_at = new.created_at
     where id = new.conversacion_id;

  elsif new.rol = 'user' and new.tipo = 'comentario' then
    -- A propósito NO toca ultimo_mensaje_at: un comentario no abre la ventana.
    update public.conversaciones
       set ultimo_comentario_at = new.created_at
     where id = new.conversacion_id;

  elsif new.rol in ('assistant', 'humano') and new.tipo in ('mensaje', 'comentario') then
    update public.conversaciones
       set ultima_respuesta_at = new.created_at,
           primera_respuesta_at = coalesce(primera_respuesta_at, new.created_at),
           primera_respuesta_humana_at = case
             when new.rol = 'humano' then coalesce(primera_respuesta_humana_at, new.created_at)
             else primera_respuesta_humana_at
           end,
           -- Que una persona conteste es, por definición, que la está atendiendo.
           etapa = case when new.rol = 'humano' and etapa = 'nuevo' then 'en_atencion' else etapa end
     where id = new.conversacion_id;
  end if;

  return null;
end;
$$;

revoke execute on function public.mensajes_actualiza_conversacion() from public, anon, authenticated;

drop trigger if exists mensajes_actualiza_conversacion on mensajes;
create trigger mensajes_actualiza_conversacion
after insert on mensajes
for each row execute function mensajes_actualiza_conversacion();

-- 8.2 Asignar y cerrar mueven la etapa solas.
--
-- BEFORE UPDATE y no AFTER: así el cambio de etapa viaja en la misma fila y el
-- trigger de auditoría (8.5, AFTER) ve el valor final, no uno intermedio.
create or replace function conversaciones_etapa_asignacion()
returns trigger
language plpgsql
as $$
begin
  if new.asignada_a is not null and old.asignada_a is null and new.etapa = 'nuevo' then
    new.etapa := 'en_atencion';
  end if;

  if new.estado = 'cerrada' and old.estado <> 'cerrada' then
    if new.etapa <> 'cerrado' then
      new.etapa := 'cerrado';
    end if;
    if new.motivo_cierre is null then
      new.motivo_cierre := 'otro';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists conversaciones_etapa_asignacion on conversaciones;
create trigger conversaciones_etapa_asignacion
before update on conversaciones
for each row execute function conversaciones_etapa_asignacion();

-- 8.3 Un lead que suelta su teléfono queda calificado.
create or replace function clientes_telefono_califica()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.telefono is null and new.telefono is not null then
    update public.conversaciones
       set etapa = 'calificado'
     where cliente_id = new.id
       and estado <> 'cerrada'
       and etapa in ('nuevo', 'en_atencion');
  end if;
  return null;
end;
$$;

revoke execute on function public.clientes_telefono_califica() from public, anon, authenticated;

drop trigger if exists clientes_telefono_califica on clientes;
create trigger clientes_telefono_califica
after update of telefono on clientes
for each row execute function clientes_telefono_califica();

-- 8.4 Una cita agendada cierra el objetivo del lead.
create or replace function citas_marca_agendado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversaciones
     set etapa = 'agendado'
   where cliente_id = new.cliente_id
     and estado <> 'cerrada'
     and etapa in ('nuevo', 'en_atencion', 'calificado');
  return null;
end;
$$;

revoke execute on function public.citas_marca_agendado() from public, anon, authenticated;

drop trigger if exists citas_marca_agendado on citas;
create trigger citas_marca_agendado
after insert on citas
for each row execute function citas_marca_agendado();

-- 8.5 Rastro de todo lo que cambia de mano.
--
-- auth.uid() es null cuando escribe el bot (service role, sin sesión): eso es
-- justamente lo que distingue "lo movió una persona" de "lo movió el sistema".
create or replace function conversaciones_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.asignada_a is distinct from old.asignada_a then
    insert into public.eventos_conversacion (conversacion_id, tipo, actor_id, detalle)
    values (new.id, 'asignacion', auth.uid(),
            jsonb_build_object('de', old.asignada_a, 'a', new.asignada_a));
  end if;

  if new.etapa is distinct from old.etapa then
    insert into public.eventos_conversacion (conversacion_id, tipo, actor_id, detalle)
    values (new.id, 'etapa', auth.uid(),
            jsonb_build_object('de', old.etapa, 'a', new.etapa));
  end if;

  if new.estado is distinct from old.estado then
    insert into public.eventos_conversacion (conversacion_id, tipo, actor_id, detalle)
    values (new.id, 'estado', auth.uid(),
            jsonb_build_object('de', old.estado, 'a', new.estado));
  end if;

  if new.estado = 'cerrada' and old.estado <> 'cerrada' then
    insert into public.eventos_conversacion (conversacion_id, tipo, actor_id, detalle)
    values (new.id, 'cierre', auth.uid(),
            jsonb_build_object('motivo', new.motivo_cierre));
  end if;

  return null;
end;
$$;

revoke execute on function public.conversaciones_audit() from public, anon, authenticated;

drop trigger if exists conversaciones_audit on conversaciones;
create trigger conversaciones_audit
after update on conversaciones
for each row execute function conversaciones_audit();

-- ---------------------------------------------------------------------------
-- 9. conversaciones_resumen: la vista que alimenta la bandeja
-- ---------------------------------------------------------------------------
-- Va DROP + CREATE y no CREATE OR REPLACE: un replace solo admite agregar
-- columnas al final, y acá cambia el orden (canal e identidad tienen que ir
-- junto al resto de la cabecera de cada fila). El grant se rehace después
-- porque el DROP se lo lleva.
--
-- security_invoker sigue siendo obligatorio: sin él Postgres evalúa la vista
-- con los permisos de quien la creó y el filtro is_staff() de las tablas de
-- abajo dejaría de servir para nada. Va declarado en el CREATE porque un
-- replace borra las reloptions que no se vuelvan a declarar.
drop view if exists conversaciones_resumen;

create view conversaciones_resumen
with (security_invoker = true) as
select
  cv.id,
  cv.cliente_id,
  cv.estado,
  cv.created_at,
  cv.canal,
  cv.origen,
  cv.hilo_externo,
  cv.cuenta_id,
  cv.identidad_id,
  cv.etapa,
  cv.motivo_cierre,
  cv.asignada_a,
  p.full_name as asignada_nombre,
  c.nombre as cliente_nombre,
  -- Nullable desde la sección 1: un lead de Instagram no tiene teléfono.
  c.telefono as cliente_telefono,
  ci.nombre_perfil as identidad_nombre,
  ci.username as identidad_username,
  ci.foto_url as identidad_foto,
  m.contenido as ultimo_contenido,
  m.rol as ultimo_rol,
  m.tipo as ultimo_tipo,
  cv.ultimo_mensaje_at,
  cv.ultimo_comentario_at,
  cv.ultima_respuesta_at,
  cv.primera_respuesta_at,
  cv.primera_respuesta_humana_at,
  greatest(
    cv.ultimo_mensaje_at,
    coalesce(cv.ultimo_comentario_at, cv.ultimo_mensaje_at),
    coalesce(cv.ultima_respuesta_at, cv.ultimo_mensaje_at)
  ) as actividad_at
from conversaciones cv
join clientes c on c.id = cv.cliente_id
left join cliente_identidades ci on ci.id = cv.identidad_id
left join profiles p on p.id = cv.asignada_a
left join lateral (
  select contenido, rol, tipo
  from mensajes
  where mensajes.conversacion_id = cv.id
    -- Una nota interna no puede hacer que una conversación deje de "esperar
    -- respuesta": el panel decide eso mirando ultimo_rol.
    and mensajes.tipo <> 'nota'
  order by created_at desc
  limit 1
) m on true;

grant select on conversaciones_resumen to authenticated;
revoke all on conversaciones_resumen from anon;

-- ---------------------------------------------------------------------------
-- 10. Funciones
-- ---------------------------------------------------------------------------
-- 10.1 Unir dos fichas que resultaron ser la misma persona.
--
-- Pasa siempre por acá y no por updates sueltos desde el panel porque tiene
-- que ser atómico: mover media docena de tablas y borrar el origen a medias
-- deja citas o cobros apuntando a una clienta que ya no existe.
--
-- security definer con una excepción declarada: si hay sesión (auth.uid() no
-- es null) se exige staff, y si NO la hay se deja pasar. El caso sin sesión es
-- el bot con service role, que la llama desde la tool guardar_datos_contacto
-- cuando un lead de Instagram da un teléfono que ya tenía ficha en WhatsApp.
create or replace function fusionar_clientes(p_origen uuid, p_destino uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origen public.clientes%rowtype;
  v_conv uuid[];
begin
  if p_origen = p_destino then
    return;
  end if;

  if auth.uid() is not null and not public.is_staff() then
    raise exception 'Se requiere rol staff para fusionar clientas';
  end if;

  select * into v_origen from public.clientes where id = p_origen for update;
  if not found then
    raise exception 'La clienta de origen no existe';
  end if;
  perform 1 from public.clientes where id = p_destino for update;
  if not found then
    raise exception 'La clienta de destino no existe';
  end if;

  update public.cliente_identidades set cliente_id = p_destino where cliente_id = p_origen;

  -- Se anotan ANTES de moverlas: después de la actualización ya no se pueden
  -- distinguir de las que el destino tenía de antes, y el rastro de la fusión
  -- solo tiene sentido en las que efectivamente cambiaron de dueña.
  select array_agg(id) into v_conv from public.conversaciones where cliente_id = p_origen;
  update public.conversaciones set cliente_id = p_destino where cliente_id = p_origen;

  update public.citas set cliente_id = p_destino where cliente_id = p_origen;
  update public.notificaciones set cliente_id = p_destino where cliente_id = p_origen;
  update public.movimientos_caja set cliente_id = p_destino where cliente_id = p_origen;

  -- Las etiquetas son (cliente_id, etiqueta_id): las repetidas se ignoran y
  -- el resto se va solo por el on delete cascade al borrar el origen.
  insert into public.cliente_etiquetas (cliente_id, etiqueta_id)
  select p_destino, etiqueta_id from public.cliente_etiquetas where cliente_id = p_origen
  on conflict do nothing;

  -- El origen se borra ANTES de copiarle el teléfono al destino: si no, los
  -- dos tendrían el mismo valor un instante y el UNIQUE de clientes.telefono
  -- rechazaría el update.
  delete from public.clientes where id = p_origen;

  update public.clientes d
     set nombre   = coalesce(d.nombre, v_origen.nombre),
         email    = coalesce(d.email, v_origen.email),
         telefono = coalesce(d.telefono, v_origen.telefono),
         notas = nullif(concat_ws(chr(10), nullif(d.notas, ''), nullif(v_origen.notas, '')), '')
   where d.id = p_destino;

  insert into public.eventos_conversacion (conversacion_id, tipo, actor_id, detalle)
  select unnest(v_conv), 'fusion', auth.uid(),
         jsonb_build_object('origen', p_origen, 'destino', p_destino);
end;
$$;

revoke execute on function public.fusionar_clientes(uuid, uuid) from public, anon;
grant execute on function public.fusionar_clientes(uuid, uuid) to authenticated;

-- 10.2 Métricas de atención de la bandeja.
--
-- security invoker (el default para funciones sin SECURITY DEFINER) a
-- propósito: la RLS de conversaciones y mensajes tiene que seguir aplicando,
-- si no cualquier cuenta autenticada podría leer volúmenes del negocio por la
-- puerta de atrás.
--
-- El rango filtra por `conversaciones.created_at` (cuándo entró el lead), no
-- por la fecha de cada mensaje: la pregunta que responde esta pantalla es
-- "cómo atendimos a los leads que llegaron en este período".
create or replace function metricas_bandeja(p_desde timestamptz, p_hasta timestamptz)
returns jsonb
language sql
stable
as $$
with conv as (
  select * from conversaciones
  where created_at >= p_desde and created_at < p_hasta
),
entrantes as (
  select m.conversacion_id, count(*) as n
  from mensajes m
  where m.rol = 'user'
    and m.tipo in ('mensaje', 'comentario')
    and m.conversacion_id in (select id from conv)
  group by m.conversacion_id
),
base as (
  select c.*,
         coalesce(e.n, 0) as entrantes,
         extract(epoch from (c.primera_respuesta_at - c.created_at)) / 60        as min_primera,
         extract(epoch from (c.primera_respuesta_humana_at - c.created_at)) / 60 as min_humana
  from conv c
  left join entrantes e on e.conversacion_id = c.id
)
select jsonb_build_object(
  'desde', p_desde,
  'hasta', p_hasta,
  'total', (select count(*) from base),

  'por_canal', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'canal', canal,
             'conversaciones', n,
             'dm', dm,
             'comentario', com,
             'mensajes_entrantes', ent
           ) order by canal), '[]'::jsonb)
    from (
      select canal,
             count(*)                                   as n,
             count(*) filter (where origen = 'dm')        as dm,
             count(*) filter (where origen = 'comentario') as com,
             coalesce(sum(entrantes), 0)                 as ent
      from base group by canal
    ) t
  ),

  'etapas', (
    select coalesce(jsonb_object_agg(etapa, n), '{}'::jsonb)
    from (select etapa, count(*) as n from base group by etapa) t
  ),

  -- Mediana y no promedio: una conversación que quedó sin responder hasta el
  -- día siguiente arrastra el promedio y hace ver mal un día que estuvo bien.
  -- "Bot" son las que contestó primero el bot; "humana", el primer mensaje de
  -- una persona, respondiera o no el bot antes.
  'primera_respuesta', jsonb_build_object(
    'bot_min', (
      select percentile_cont(0.5) within group (order by min_primera)
      from base
      where min_primera is not null
        and (primera_respuesta_humana_at is null or primera_respuesta_at < primera_respuesta_humana_at)
    ),
    'humana_min', (
      select percentile_cont(0.5) within group (order by min_humana)
      from base where min_humana is not null
    ),
    'por_canal', (
      select coalesce(jsonb_object_agg(canal, med), '{}'::jsonb)
      from (
        select canal, percentile_cont(0.5) within group (order by min_primera) as med
        from base where min_primera is not null group by canal
      ) t
    )
  ),

  -- Sobre las que efectivamente pedían respuesta: una conversación sin ningún
  -- mensaje entrante no cuenta ni a favor ni en contra.
  'pct_respondidas_15min', (
    select case
      when count(*) filter (where entrantes > 0) = 0 then null
      else round(
        100.0 * count(*) filter (where entrantes > 0 and min_primera is not null and min_primera <= 15)
        / count(*) filter (where entrantes > 0), 1)
    end
    from base
  ),

  'por_agente', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'agente_id', a.asignada_a,
             'nombre', p.full_name,
             'asignadas', a.asignadas,
             'respondidas', a.respondidas,
             'mediana_respuesta_min', a.med
           ) order by a.asignadas desc), '[]'::jsonb)
    from (
      select asignada_a,
             count(*)                                                        as asignadas,
             count(*) filter (where primera_respuesta_humana_at is not null)  as respondidas,
             percentile_cont(0.5) within group (order by min_humana)
               filter (where min_humana is not null)                          as med
      from base where asignada_a is not null group by asignada_a
    ) a
    left join profiles p on p.id = a.asignada_a
  ),

  'comentarios', jsonb_build_object(
    'recibidos', (
      select count(*) from mensajes m join base b on b.id = m.conversacion_id
      where m.tipo = 'comentario' and m.rol = 'user'
    ),
    'respondidos_publico', (
      select count(*) from mensajes m join base b on b.id = m.conversacion_id
      where m.tipo = 'comentario' and m.rol = 'humano'
    ),
    'respondidos_privado', (
      select count(*) from mensajes m join base b on b.id = m.conversacion_id
      where m.tipo = 'comentario' and m.metadata ->> 'respondido_privado' = 'true'
    )
  ),

  -- Deliberadamente FUERA del rango: es el pendiente de ahora mismo, no del
  -- período que se esté mirando.
  'sin_responder_ahora', (
    select count(*) from conversaciones cv
    where cv.estado <> 'cerrada'
      and (
        select m.rol from mensajes m
        where m.conversacion_id = cv.id and m.tipo <> 'nota'
        order by m.created_at desc limit 1
      ) = 'user'
  )
);
$$;

revoke execute on function public.metricas_bandeja(timestamptz, timestamptz) from public, anon;
grant execute on function public.metricas_bandeja(timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Publicación de Realtime
-- ---------------------------------------------------------------------------
-- Ninguna migración la había tocado (punto 2 del encabezado). El panel entero
-- depende de esto: la bandeja se recarga con postgres_changes sobre mensajes,
-- conversaciones, clientes y cliente_etiquetas, y los avisos nuevos escuchan
-- eventos_conversacion.
--
-- `to_regclass` cubre a `configuracion`, que existe en producción pero no en
-- ninguna migración: en una base recién creada simplemente no está y no hay
-- por qué caerse por eso.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach t in array array[
    'mensajes', 'conversaciones', 'clientes', 'cliente_etiquetas', 'citas',
    'configuracion', 'canales', 'eventos_conversacion', 'cliente_identidades'
  ]
  loop
    if to_regclass('public.' || t) is not null
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
       )
    then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Permisos de tabla
-- ---------------------------------------------------------------------------
-- Explícitos y no por privilegio por defecto (mismo criterio que la 0009): el
-- grant es la puerta y la RLS el filtro. Las dos tienen que estar.
grant select on cliente_identidades to authenticated;
grant select, update on canales to authenticated;
grant select, insert, update, delete on respuestas_rapidas to authenticated;
grant select on eventos_conversacion to authenticated;

revoke all on cliente_identidades from anon;
revoke all on canales from anon;
revoke all on respuestas_rapidas from anon;
revoke all on eventos_conversacion from anon;
