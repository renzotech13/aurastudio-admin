-- 0012 — El resto del esquema del CRM: la vista del inbox, las etiquetas y
-- el historial de notificaciones.
--
-- Se ejecuta de una sola vez en el SQL editor. Segura de correr dos veces.
--
-- SÍNTOMA QUE ARREGLA: la página Conversaciones del panel mostraba
-- "0 en total · No hay conversaciones en este filtro" aunque el bot sí
-- estuviera guardando mensajes. CRM/index.tsx:41-44 pide cuatro cosas de
-- golpe (conversaciones_resumen, clientes, etiquetas, cliente_etiquetas) y
-- si CUALQUIERA falla muestra la lista vacía — y tres de las cuatro no
-- existían en esta base.
--
-- Adaptado de la 0010 de Cieza Barber, que resolvió exactamente lo mismo,
-- con una diferencia deliberada: acá los tres tipos van como text + check
-- en vez de enum. Es el mismo criterio que el propio Cieza adoptó después
-- en su 0024 ("agregar un valor más adelante es un solo ALTER, sin el lío
-- de ALTER TYPE ... ADD VALUE y su transacción aparte"), y esta base ya
-- tuvo suficientes sustos con migraciones que se caen a la mitad.

-- 1. notificaciones: historial de recordatorios y promociones enviados -----
create table if not exists notificaciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  cita_id uuid references citas(id),
  tipo text not null check (tipo in ('recordatorio_cita', 'promocion')),
  plantilla text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviada', 'fallida', 'cancelada')),
  programada_para timestamptz not null default now(),
  enviada_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

-- El barrido de recordatorios se apoya en esto: si dos corridas concurrentes
-- intentan reservar la misma cita, la segunda choca con 23505 y no manda
-- nada. bot/src/db/repositories/notificaciones.ts:47 atrapa ese código
-- exacto y devuelve null en vez de duplicar el aviso a la clienta.
create unique index if not exists notificaciones_cita_tipo_idx
  on notificaciones (cita_id, tipo) where cita_id is not null;
create index if not exists notificaciones_cliente_idx on notificaciones (cliente_id);

alter table notificaciones enable row level security;

drop policy if exists "Staff can view notificaciones" on notificaciones;
create policy "Staff can view notificaciones"
on notificaciones for select to authenticated using (is_staff());
-- Sin policy de insert/update para authenticated a propósito: solo el bot
-- (service role) crea y actualiza notificaciones; el panel solo las lee.

-- 2. etiquetas + cliente_etiquetas: clasificación libre de clientas --------
create table if not exists etiquetas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  color text not null default 'slate'
    check (color in ('slate', 'rose', 'amber', 'emerald', 'sky', 'violet')),
  created_at timestamptz not null default now()
);

create table if not exists cliente_etiquetas (
  cliente_id uuid not null references clientes(id) on delete cascade,
  etiqueta_id uuid not null references etiquetas(id) on delete cascade,
  primary key (cliente_id, etiqueta_id)
);

alter table etiquetas enable row level security;
drop policy if exists "Staff can manage etiquetas" on etiquetas;
create policy "Staff can manage etiquetas"
on etiquetas for all to authenticated using (is_staff()) with check (is_staff());

alter table cliente_etiquetas enable row level security;
drop policy if exists "Staff can manage cliente_etiquetas" on cliente_etiquetas;
create policy "Staff can manage cliente_etiquetas"
on cliente_etiquetas for all to authenticated using (is_staff()) with check (is_staff());

-- 3. conversaciones_resumen: la vista que alimenta el inbox del CRM --------
-- security_invoker es obligatorio: sin él, Postgres evalúa la vista con los
-- permisos de quien la creó (que puede saltarse la RLS) en vez de los de
-- quien consulta, y el filtro is_staff() de las tablas de abajo dejaría de
-- servir para nada. Va repetido dentro del CREATE OR REPLACE porque un
-- replace BORRA las reloptions que no se vuelvan a declarar.
create or replace view conversaciones_resumen
with (security_invoker = true) as
select
  cv.id,
  cv.cliente_id,
  cv.estado,
  cv.created_at,
  c.nombre as cliente_nombre,
  c.telefono as cliente_telefono,
  m.contenido as ultimo_contenido,
  m.rol as ultimo_rol,
  cv.ultimo_mensaje_at,
  cv.ultimo_mensaje_at as actividad_at
from conversaciones cv
join clientes c on c.id = cv.cliente_id
left join lateral (
  select contenido, rol
  from mensajes
  where mensajes.conversacion_id = cv.id
  order by created_at desc
  limit 1
) m on true;

-- El grant es la puerta y la RLS el filtro (mismo criterio que la 0009).
grant select on conversaciones_resumen to authenticated;
revoke all on conversaciones_resumen from anon;

-- 4. conversaciones: policy de UPDATE que nunca se creó -------------------
-- El toggle "Respondo yo" de ChatThread.tsx:155 hace un update directo a
-- conversaciones.estado ('activa' <-> 'escalada'), pero la tabla solo tiene
-- policy de SELECT (0002, reemplazada por la 0004) — nunca de UPDATE. Con
-- RLS activa y sin policy para ese comando, Postgres no actualiza ninguna
-- fila y TAMPOCO lanza error: el panel muestra el toast de éxito (solo
-- comprueba `error`, no las filas afectadas) y el bot sigue respondiendo
-- como si nada. Mismo hallazgo que la 0012 de Cieza.
drop policy if exists "Staff can update conversaciones" on conversaciones;
create policy "Staff can update conversaciones"
on conversaciones for update to authenticated using (is_staff()) with check (is_staff());
