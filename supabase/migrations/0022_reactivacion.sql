-- 0022 — Reactivación de clientas ya atendidas.
--
-- Se ejecuta de una sola vez en el SQL editor de Supabase. Es idempotente:
-- correrla dos veces no rompe nada. Requiere la 0020 y la 0021.
--
-- ─── Qué hace ───────────────────────────────────────────────────────────────
-- Cuando una clienta se atendió y pasa cierto tiempo SIN volver, el bot le manda
-- un WhatsApp invitándola a regresar, con una oferta o un descuento. Cuánto
-- tiempo y qué oferta depende del servicio que se hizo:
--
--   · Reglas por categoría de servicio (uñas, cejas, cabello…) a los 15 o 21
--     días, con una oferta suave.
--   · Reglas generales al mes y a los dos meses, con un descuento estratégico
--     mayor para quien ya se está enfriando.
--
-- Todo lo decide la administradora desde la app (qué días, qué oferta, qué
-- plantilla) y NACE APAGADO: el envío automático es un interruptor global que
-- hay que prender a propósito, después de tener aprobadas las plantillas en Meta.
-- Las reglas sembradas también nacen apagadas.
--
-- ─── Qué NO hace ────────────────────────────────────────────────────────────
-- · No aplica el descuento solo: va en el mensaje con un código y se aplica al
--   cobrar. El bot hoy no maneja precios ni descuentos.
-- · No le escribe a quien ya volvió (tiene una cita confirmada o hecha después
--   de la última atención), a quien no tiene teléfono ni a quien se marcó
--   «no contactar».
-- · Nunca más de una reactivación cada `separacion_dias` días por clienta, para
--   no fastidiarla ni dañar la calidad del número de WhatsApp.

-- 1. A quién no se le escribe --------------------------------------------------
alter table public.clientes
  add column if not exists no_contactar boolean not null default false;

-- 2. Interruptor y topes globales (una sola fila) -----------------------------
create table if not exists public.reactivacion_config (
  id boolean primary key default true check (id),
  -- Interruptor general. Apagado = el bot no manda NADA aunque haya reglas activas.
  activa boolean not null default false,
  -- Cuántos días después del día exacto de la regla se sigue considerando a la
  -- clienta. Evita mandar mensajes de «hace 15 días» a quien se atendió hace 40.
  ventana_dias int not null default 5 check (ventana_dias between 1 and 30),
  -- Separación mínima entre dos reactivaciones a la misma clienta.
  separacion_dias int not null default 10 check (separacion_dias between 1 and 90),
  -- Tope por vuelta (el bot revisa varias veces al día): protege la calidad del
  -- número y evita un envío masivo el día que se prende.
  max_por_vuelta int not null default 25 check (max_por_vuelta between 1 and 200),
  -- Horario en que se puede escribir, hora de Lima.
  hora_desde int not null default 10 check (hora_desde between 0 and 23),
  hora_hasta int not null default 20 check (hora_hasta between 1 and 24),
  updated_at timestamptz not null default now(),
  check (hora_hasta > hora_desde)
);
insert into public.reactivacion_config (id) values (true) on conflict do nothing;

-- 3. Reglas: «a los N días de tal servicio, este mensaje» ---------------------
create table if not exists public.reglas_reactivacion (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) between 2 and 80),
  -- null = cualquier servicio. Una categoría concreta gana en lo que dice el
  -- mensaje (el {{servicio}}), pero las reglas son independientes entre sí.
  categoria_id text references public.service_categories(id) on delete set null,
  dias int not null check (dias between 1 and 365),
  -- Plantilla de WhatsApp (de categoría Marketing, aprobada por Meta) y el texto
  -- exacto que tiene, con {{1}}, {{2}}…: se usa para escribir lo mismo en el
  -- chat de la clienta y para que el bot sepa qué se le ofreció.
  plantilla text not null check (char_length(btrim(plantilla)) > 0),
  cuerpo text not null check (char_length(btrim(cuerpo)) > 0),
  -- Qué va en cada {{n}}, en orden. Valores posibles: nombre, servicio, oferta, codigo.
  variables text[] not null default array['nombre', 'servicio', 'oferta', 'codigo'],
  oferta text not null default '',
  codigo text not null default '',
  activa boolean not null default false,
  orden int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (variables <@ array['nombre', 'servicio', 'oferta', 'codigo'])
);
create index if not exists reglas_reactivacion_activas_idx
  on public.reglas_reactivacion (dias) where activa;

-- 4. Qué se envió (y que no se vuelva a enviar) -------------------------------
create table if not exists public.reactivaciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  regla_id uuid references public.reglas_reactivacion(id) on delete set null,
  -- La atención que motivó el mensaje.
  cita_origen_id uuid references public.citas(id) on delete set null,
  estado text not null default 'reservada'
    check (estado in ('reservada', 'enviada', 'fallida')),
  -- Se guarda lo que se ofreció, porque la regla se puede editar después.
  regla_nombre text not null,
  oferta text not null default '',
  codigo text not null default '',
  texto text,
  error text,
  created_at timestamptz not null default now(),
  enviada_at timestamptz
);
-- Una regla se manda UNA vez por atención: lo garantiza la base, no el código.
create unique index if not exists reactivaciones_unica_idx
  on public.reactivaciones (cliente_id, regla_id, cita_origen_id);
create index if not exists reactivaciones_cliente_idx
  on public.reactivaciones (cliente_id, created_at desc);

-- 5. Permisos ---------------------------------------------------------------
alter table public.reactivacion_config enable row level security;
alter table public.reglas_reactivacion enable row level security;
alter table public.reactivaciones enable row level security;

drop policy if exists "Staff ve la config de reactivación" on public.reactivacion_config;
create policy "Staff ve la config de reactivación" on public.reactivacion_config
  for select to authenticated using (public.is_staff());
drop policy if exists "Staff edita la config de reactivación" on public.reactivacion_config;
create policy "Staff edita la config de reactivación" on public.reactivacion_config
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Staff gestiona las reglas de reactivación" on public.reglas_reactivacion;
create policy "Staff gestiona las reglas de reactivación" on public.reglas_reactivacion
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- El historial lo ve también quien atiende (un vendedor necesita saber «ya le
-- ofrecimos 15 %»); solo el bot escribe.
drop policy if exists "Atención ve las reactivaciones" on public.reactivaciones;
create policy "Atención ve las reactivaciones" on public.reactivaciones
  for select to authenticated using (public.puede_atender());

grant select, update on public.reactivacion_config to authenticated;
grant select, insert, update, delete on public.reglas_reactivacion to authenticated;
grant select on public.reactivaciones to authenticated;
grant all on public.reactivacion_config, public.reglas_reactivacion, public.reactivaciones to service_role;

-- 6. Quién toca ahora --------------------------------------------------------
-- Una fila por (regla, clienta): la clienta cuya ÚLTIMA atención terminada cayó
-- hace entre `dias` y `dias + ventana_dias` días, que no volvió ni tiene cita
-- por venir, tiene teléfono, no pidió que no la contacten y no recibió otra
-- reactivación hace poco. La usan el bot (para enviar) y la app (para mostrar
-- «a quién se le enviaría», sin enviar nada).
--
-- SECURITY DEFINER para leer clientes/citas sin depender de quién pregunta, con
-- una guarda: una sesión de usuario tiene que ser de la administradora. Sin
-- sesión (auth.uid() es null) es el bot con la service role.
create or replace function public.reactivacion_candidatas(p_ahora timestamptz default now())
returns table (
  regla_id uuid,
  regla_nombre text,
  plantilla text,
  cuerpo text,
  variables text[],
  oferta text,
  codigo text,
  cliente_id uuid,
  cliente_nombre text,
  cliente_telefono text,
  cita_id uuid,
  servicio text,
  categoria_id text,
  atendida_at timestamptz,
  dias_desde int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cfg public.reactivacion_config%rowtype;
begin
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'Se requiere rol staff';
  end if;

  select * into cfg from public.reactivacion_config where id;

  return query
  with ultima as (
    -- La última atención terminada de cada clienta.
    select distinct on (c.cliente_id)
      c.id as cita_id, c.cliente_id, c.fin_utc, s.name as servicio, s.category_id
    from public.citas c
    join public.services s on s.id = c.servicio_id
    where c.estado = 'completada'
    order by c.cliente_id, c.fin_utc desc
  )
  select
    r.id, r.nombre, r.plantilla, r.cuerpo, r.variables, r.oferta, r.codigo,
    cl.id, cl.nombre, cl.telefono,
    u.cita_id, u.servicio, u.category_id, u.fin_utc,
    floor(extract(epoch from (p_ahora - u.fin_utc)) / 86400)::int
  from ultima u
  join public.clientes cl on cl.id = u.cliente_id
  join public.reglas_reactivacion r
    on r.activa and (r.categoria_id is null or r.categoria_id = u.category_id)
  where cl.telefono is not null
    and not cl.no_contactar
    and p_ahora >= u.fin_utc + make_interval(days => r.dias)
    and p_ahora <  u.fin_utc + make_interval(days => r.dias + cfg.ventana_dias)
    -- Ya volvió, o tiene una cita por venir.
    and not exists (
      select 1 from public.citas c2
      where c2.cliente_id = u.cliente_id
        and c2.estado in ('confirmada', 'completada')
        and c2.inicio_utc > u.fin_utc
    )
    -- Esta regla ya se le mandó por esta atención.
    and not exists (
      select 1 from public.reactivaciones x
      where x.cliente_id = u.cliente_id and x.regla_id = r.id and x.cita_origen_id = u.cita_id
    )
    -- Se le escribió hace muy poco por cualquier otra regla.
    and not exists (
      select 1 from public.reactivaciones y
      where y.cliente_id = u.cliente_id
        and y.estado in ('reservada', 'enviada')
        and y.created_at > p_ahora - make_interval(days => cfg.separacion_dias)
    )
  -- Primero la regla de más días y, a igual de días, la de su categoría antes que
  -- la general: si dos reglas le tocan a la vez, el bot manda solo la primera
  -- (una por clienta por vuelta; ver `separacion_dias`).
  order by r.dias desc, (r.categoria_id is null) asc, u.fin_utc asc;
end;
$$;
revoke execute on function public.reactivacion_candidatas(timestamptz) from public, anon;
grant execute on function public.reactivacion_candidatas(timestamptz) to authenticated, service_role;

-- 7. Resultado: ¿volvió? ------------------------------------------------------
-- Una clienta «volvió» si tiene una cita confirmada o hecha, creada DESPUÉS de
-- que se le escribió y dentro de los 45 días siguientes.
drop view if exists public.reactivaciones_resultado;
create view public.reactivaciones_resultado with (security_invoker = true) as
select
  x.id,
  x.cliente_id,
  cl.nombre as cliente_nombre,
  x.regla_id,
  x.regla_nombre,
  x.oferta,
  x.codigo,
  x.estado,
  x.error,
  x.created_at,
  x.enviada_at,
  exists (
    select 1 from public.citas c
    where c.cliente_id = x.cliente_id
      and c.estado in ('confirmada', 'completada')
      and x.enviada_at is not null
      and c.created_at > x.enviada_at
      and c.inicio_utc < x.enviada_at + interval '45 days'
  ) as volvio
from public.reactivaciones x
join public.clientes cl on cl.id = x.cliente_id;

grant select on public.reactivaciones_resultado to authenticated, service_role;
revoke all on public.reactivaciones_resultado from anon;

-- 8. Reglas de partida (todas APAGADAS) ----------------------------------------
-- Son un punto de partida para ir afinando desde la app, no una verdad: los días
-- salen de cada cuánto suele volver una clienta de ese servicio. Las plantillas
-- (`vuelve_aura` y `te_extranamos_aura`) hay que crearlas en Meta con
-- estos mismos textos; ver bot/CONFIGURAR-REACTIVACION.md.
-- Solo se siembran si la tabla está vacía: correr esto otra vez no pisa lo que
-- ya se editó.
do $$
declare
  suave constant text :=
    'Hola {{1}} 💛 Gracias por visitarnos en Aura Studio ({{2}}). Para tu próxima cita tienes {{3}} con el código {{4}}. Si quieres separar tu espacio, respóndenos por aquí y te ayudamos.';
  extrano constant text :=
    'Hola {{1}} 💛 Te extrañamos en Aura Studio. Pasó un tiempo desde tu última visita ({{2}}) y queremos verte de vuelta: {{3}} con el código {{4}} en tu próxima cita. Respóndenos por aquí y te reservamos tu espacio.';
begin
  if exists (select 1 from public.reglas_reactivacion) then
    return;
  end if;

  insert into public.reglas_reactivacion (nombre, categoria_id, dias, plantilla, cuerpo, oferta, codigo, orden)
  select nombre, categoria, dias, plantilla, cuerpo, oferta, codigo, orden
  from (values
    ('Uñas · a los 15 días',      'manicure',   15, 'vuelve_aura',        suave,   '10 % de descuento en tu próxima manicure', 'UNAS10',  10),
    ('Pestañas · a los 15 días',  'pestanas',   15, 'vuelve_aura',        suave,   '10 % de descuento en tu retoque',          'PESTA10', 20),
    ('Cejas · a los 15 días',     'cejas',      15, 'vuelve_aura',        suave,   '10 % de descuento en tu retoque de cejas', 'CEJAS10', 30),
    ('Cabello · a los 15 días',   'cabello',    15, 'vuelve_aura',        suave,   '10 % de descuento en tu próximo tratamiento', 'PELO10', 40),
    ('Color · al mes',            'color',      30, 'vuelve_aura',        suave,   '10 % de descuento en tu retoque de color', 'COLOR10', 50),
    ('Pedicura · a los 21 días',  'pies',       21, 'vuelve_aura',        suave,   '10 % de descuento en tu próxima pedicura', 'PIES10',  60),
    ('Te extrañamos · al mes',    null,         30, 'te_extranamos_aura', extrano, '15 % de descuento en cualquier servicio',  'VUELVE15', 70),
    ('Te extrañamos · a los 2 meses', null,      60, 'te_extranamos_aura', extrano, '20 % de descuento en cualquier servicio',  'VUELVE20', 80)
  ) as v(nombre, categoria, dias, plantilla, cuerpo, oferta, codigo, orden);
end $$;
