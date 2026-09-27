-- 0020 — Rol `profesional`: cada profesional entra al panel con su propio
-- usuario y ve ÚNICAMENTE lo suyo (su agenda y sus clientas).
--
-- Se ejecuta de una sola vez en el SQL editor de Supabase. Es idempotente:
-- correrla dos veces no rompe nada.
--
-- ─── Criterio de diseño ─────────────────────────────────────────────────────
--
-- 1. La profesional NO es staff. is_staff() sigue devolviendo false para
--    ella, así que todo lo que ya está protegido (caja, conversaciones,
--    mensajes, canales, métricas, otras citas, teléfonos) le queda cerrado sin
--    tocar una sola policy existente. Se comprobó en producción antes de
--    escribir esto: un usuario sin privilegios solo lee su propio perfil y el
--    contenido público de la web; las otras 31 tablas devuelven 0 filas.
--
-- 2. NO se le da ninguna policy sobre `citas` ni sobre `clientes`. Lee por
--    funciones (mi_agenda, mis_clientas) que devuelven solo las columnas que
--    le tocan. Dos razones:
--      · El teléfono y el correo de la clienta no salen de la base. Una
--        policy sobre `clientes` da la fila entera; una función da lo que
--        decidimos, y desde un mismo rol de Postgres ('authenticated') no se
--        puede restringir por columna solo para ella.
--      · Una policy de `clientes` que consulta `citas` (o al revés) es el
--        ciclo que reventó el panel de Cieza con el error 42P17 (su 0029).
--        Sin policies cruzadas no hay ciclo posible.
--
-- 3. Todo lo que la profesional ESCRIBE (marcar una cita, registrar una
--    atención sin reserva, anotar la venta de un producto) pasa por el bot,
--    que corre con la service role y valida en código que sea suyo. Así
--    Google Calendar y los avisos nunca se saltan, y la caja sigue cerrada.
--
-- 4. Desactivar a una profesional en el panel (Profesionales → activa = off)
--    le corta el acceso sola: es_del_equipo() exige que su usuario esté
--    enlazado a una fila de `profesionales` con activa = true.

-- 1. El rol -----------------------------------------------------------------
-- Se borra cualquier CHECK sobre `role` sin importar cómo se llame: la base
-- en producción no siempre coincide con las migraciones del repo, y si el
-- viejo sobrevive, rechaza 'profesional' aunque el nuevo lo admita.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check check (role in ('staff', 'alumna', 'profesional'));

-- Guardia contra el autoascenso. Hoy `authenticated` ya no puede hacer UPDATE
-- sobre profiles (se probó: 403), pero la policy "Users can update own
-- profile" de la 0003 sigue en el repo y ahora el rol decide quién ve qué:
-- si algún día se le devuelve el permiso, cualquier profesional podría
-- ponerse role = 'staff' desde la consola del navegador. Se deja explícito.
revoke update on public.profiles from authenticated;

-- 2. Funciones de rol -------------------------------------------------------
-- SECURITY DEFINER + search_path vacío: resuelven "quién soy" saltándose RLS
-- (igual que is_staff()). Todas las tablas se califican con `public.`.

-- A qué fila de `profesionales` corresponde la sesión actual. null si la
-- cuenta no está enlazada o la profesional está desactivada.
create or replace function public.mi_profesional_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.profesionales
  where user_id = auth.uid() and activa
  limit 1;
$$;
revoke execute on function public.mi_profesional_id() from public, anon;
grant execute on function public.mi_profesional_id() to authenticated;

create or replace function public.is_profesional()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.profiles p
    join public.profesionales x on x.user_id = p.id and x.activa
    where p.id = auth.uid() and p.role = 'profesional'
  );
$$;
revoke execute on function public.is_profesional() from public, anon;
grant execute on function public.is_profesional() to authenticated;

-- Staff o profesional activa. Es lo que abre el catálogo compartido.
create or replace function public.es_del_equipo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff() or public.is_profesional();
$$;
revoke execute on function public.es_del_equipo() from public, anon;
grant execute on function public.es_del_equipo() to authenticated;

-- 3. Catálogo compartido (solo lectura) -------------------------------------
-- Lo que cualquiera del equipo necesita para trabajar y que ya es público en
-- la web: la carta, las sedes y quién atiende qué. Nada más: los bloqueos de
-- agenda (motivos personales) y el horario no los usa la app de la profesional,
-- así que no se abren.
-- `authenticated` es OTRO rol de Postgres que `anon`: las policies "Public
-- can view ..." de la web no le valen (por eso hoy lee 0 filas de estas).
do $$
declare t text;
begin
  foreach t in array array[
    'services', 'service_categories', 'sedes', 'profesionales',
    'profesional_servicios', 'profesional_sedes'
  ]
  loop
    execute format('drop policy if exists "Equipo ve %1$s" on public.%1$I', t);
    execute format(
      'create policy "Equipo ve %1$s" on public.%1$I for select to authenticated using (public.es_del_equipo())',
      t
    );
  end loop;
end $$;

-- 4. Su agenda --------------------------------------------------------------
-- Solo las citas asignadas a ella, en una ventana de fechas. NO devuelve el
-- teléfono ni el correo de la clienta: nombre y notas sí (las notas son lo
-- que necesita en la silla: una alergia, un tono que no le gusta).
create or replace function public.mi_agenda(p_desde timestamptz, p_hasta timestamptz)
returns table (
  id uuid,
  inicio_utc timestamptz,
  fin_utc timestamptz,
  estado text,
  notas text,
  sede_id text,
  cliente_id uuid,
  cliente_nombre text,
  cliente_notas text,
  servicio_id text,
  servicio text,
  servicio_duracion text,
  categoria_id text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.inicio_utc, c.fin_utc, c.estado::text, c.notas, c.sede_id,
    c.cliente_id, cl.nombre, cl.notas,
    c.servicio_id, s.name, s.duration, s.category_id
  from public.citas c
  join public.clientes cl on cl.id = c.cliente_id
  join public.services s on s.id = c.servicio_id
  where public.is_profesional()
    and c.profesional_id = public.mi_profesional_id()
    and c.inicio_utc >= p_desde
    and c.inicio_utc <  p_hasta
  order by c.inicio_utc;
$$;
revoke execute on function public.mi_agenda(timestamptz, timestamptz) from public, anon;
grant execute on function public.mi_agenda(timestamptz, timestamptz) to authenticated;

-- 5. Sus clientas -----------------------------------------------------------
-- Solo las que ya tienen (o tuvieron) una cita con ella, sin contar las
-- canceladas. Buscar es por nombre a propósito: buscar por teléfono serviría
-- para confirmar el número de una clienta que no es suya.
create or replace function public.mis_clientas(p_buscar text default null)
returns table (
  id uuid,
  nombre text,
  notas text,
  visitas bigint,
  ultima_visita timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select cl.id, cl.nombre, cl.notas, count(*), max(c.inicio_utc)
  from public.clientes cl
  join public.citas c on c.cliente_id = cl.id
  where public.is_profesional()
    and c.profesional_id = public.mi_profesional_id()
    and c.estado <> 'cancelada'
    and (nullif(btrim(p_buscar), '') is null or cl.nombre ilike '%' || btrim(p_buscar) || '%')
  group by cl.id
  order by max(c.inicio_utc) desc
  limit 200;
$$;
revoke execute on function public.mis_clientas(text) from public, anon;
grant execute on function public.mis_clientas(text) to authenticated;

-- 6. Cómo dar de alta a una profesional -------------------------------------
-- Lo hace el script admin/supabase/scripts/crear-cuentas-profesionales.mjs
-- (crea el usuario, le pone role = 'profesional' y lo enlaza). A mano sería:
--
--   -- 1. Authentication → Users → Add user (con "Auto Confirm User"):
--   --    correo: laura@aurastudio.pe
--   -- 2. Enlazarla y darle el rol:
--   update public.profiles
--   set role = 'profesional', full_name = 'Laura'
--   where id = (select id from auth.users where email = 'laura@aurastudio.pe');
--
--   update public.profesionales
--   set user_id = (select id from auth.users where email = 'laura@aurastudio.pe')
--   where nombre = 'Laura';
