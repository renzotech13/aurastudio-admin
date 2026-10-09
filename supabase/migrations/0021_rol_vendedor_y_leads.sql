-- 0021 — Rol `vendedor`, mensajes programados y seguimiento de leads.
--
-- Se ejecuta de una sola vez en el SQL editor de Supabase. Es idempotente:
-- correrla dos veces no rompe nada. Requiere la 0020 (rol profesional).
--
-- ─── Qué es un vendedor ─────────────────────────────────────────────────────
-- Atiende a las personas que escriben (WhatsApp, Instagram, Facebook) y les
-- agenda la cita. Ve y responde la bandeja de chats, ve las reservas de todo el
-- equipo y crea reservas nuevas. NO ve la caja, ni las ventas, ni las métricas,
-- ni puede editar servicios, profesionales, canales o promociones.
--
-- Eso se hace cumplir aquí, en la base, y no solo escondiendo pantallas:
-- aunque alguien pidiera esas tablas directamente a la API con su sesión,
-- Postgres le contestaría vacío.
--
--   is_staff()      → administradora (todo, igual que hasta hoy; NO cambia)
--   puede_atender() → administradora o vendedor
--
-- Solo las tablas de la bandeja y las reservas pasan de is_staff() a
-- puede_atender(); todo lo demás sigue exigiendo is_staff().
--
-- Lo que el vendedor ESCRIBE como reserva (crear o cancelar una cita) pasa por
-- el bot, que valida el rol en código y le fija el estado: nunca marca una
-- atención como «completada» (eso lo registra la profesional o recepción).

-- 1. El rol -----------------------------------------------------------------
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
  add constraint profiles_role_check
  check (role in ('staff', 'alumna', 'profesional', 'vendedor'));

-- 2. Funciones de rol -------------------------------------------------------
create or replace function public.is_vendedor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'vendedor'
  );
$$;
revoke execute on function public.is_vendedor() from public, anon;
grant execute on function public.is_vendedor() to authenticated;

-- Administradora o vendedor.
create or replace function public.puede_atender()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff() or public.is_vendedor();
$$;
revoke execute on function public.puede_atender() from public, anon;
grant execute on function public.puede_atender() to authenticated;

-- El catálogo compartido (servicios, sedes, quién atiende qué) que abrió la
-- 0020 para el equipo también lo necesita el vendedor para armar una reserva.
create or replace function public.es_del_equipo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff() or public.is_profesional() or public.is_vendedor();
$$;
revoke execute on function public.es_del_equipo() from public, anon;
grant execute on function public.es_del_equipo() to authenticated;

-- 3. Bandeja y clientes: de is_staff() a puede_atender() --------------------
-- Se reescriben las policies que YA existen en producción (en vez de crear
-- otras con nombre propio): así conservan sus condiciones finas — por ejemplo
-- que un mensaje del equipo solo pueda ser una nota firmada por quien la
-- escribe — y la base real, que no siempre coincide con las migraciones del
-- repo, queda cubierta sin adivinar nombres. Las de borrado no se tocan.
do $$
declare
  p record;
  nueva_using text;
  nueva_check text;
begin
  for p in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where (
      schemaname = 'public'
      and tablename in (
        'conversaciones', 'mensajes', 'eventos_conversacion', 'cliente_identidades',
        'respuestas_rapidas', 'etiquetas', 'cliente_etiquetas', 'clientes'
      )
    ) or (
      -- Los adjuntos que mandan las clientas (fotos, notas de voz) se leen con
      -- URL firmada: sin esto el vendedor vería los mensajes pero no la imagen.
      schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT'
      and coalesce(qual, '') like '%adjuntos%'
    )
  loop
    if p.cmd = 'DELETE' then
      continue;
    end if;
    nueva_using := regexp_replace(coalesce(p.qual, ''), '(public\.)?is_staff\(\)', 'public.puede_atender()', 'g');
    nueva_check := regexp_replace(coalesce(p.with_check, ''), '(public\.)?is_staff\(\)', 'public.puede_atender()', 'g');
    if nueva_using = coalesce(p.qual, '') and nueva_check = coalesce(p.with_check, '') then
      continue; -- ya usa puede_atender() o no depende de is_staff()
    end if;
    execute format(
      'alter policy %I on %I.%I %s %s',
      p.policyname, p.schemaname, p.tablename,
      case when p.qual is not null then format('using (%s)', nueva_using) else '' end,
      case when p.with_check is not null then format('with check (%s)', nueva_check) else '' end
    );
  end loop;
end $$;

-- Solo lectura: ve las citas de todo el equipo y la biblioteca de multimedia,
-- pero no las crea ni las edita (eso va por el bot y por la administradora).
drop policy if exists "Atención ve citas" on public.citas;
create policy "Atención ve citas" on public.citas
  for select to authenticated using (public.puede_atender());

drop policy if exists "Atención ve plantillas_media" on public.plantillas_media;
create policy "Atención ve plantillas_media" on public.plantillas_media
  for select to authenticated using (public.puede_atender());

-- Nombres del equipo: para asignar un chat y para mostrar a quién está asignado.
-- Solo administradoras y vendedores; nunca el perfil de una profesional o alumna.
drop policy if exists "Atención ve al equipo" on public.profiles;
create policy "Atención ve al equipo" on public.profiles
  for select to authenticated
  using (public.puede_atender() and role in ('staff', 'vendedor'));

-- 4. Mensajes programados ---------------------------------------------------
-- La persona escribe el texto y la hora («hoy 4:30 pm, recuérdale que atendemos
-- hasta las 5») y el bot lo manda solo a esa hora, como si lo hubiera escrito
-- ella desde el panel.
--   · cancelar_si_responde: si la clienta escribe antes de la hora, no se manda.
--   · El bot reserva cada envío pasando de 'pendiente' a 'enviando' con un update
--     condicionado: nunca sale dos veces.
create table if not exists public.mensajes_programados (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 4000),
  programado_para timestamptz not null,
  cancelar_si_responde boolean not null default true,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviando', 'enviado', 'fallido', 'cancelado')),
  creado_por uuid references auth.users(id) on delete set null default auth.uid(),
  mensaje_id uuid references public.mensajes(id) on delete set null,
  detalle text,
  created_at timestamptz not null default now(),
  enviado_at timestamptz
);

create index if not exists mensajes_programados_pendientes_idx
  on public.mensajes_programados (programado_para) where estado = 'pendiente';
create index if not exists mensajes_programados_conversacion_idx
  on public.mensajes_programados (conversacion_id, programado_para desc);

alter table public.mensajes_programados enable row level security;

drop policy if exists "Atención ve mensajes programados" on public.mensajes_programados;
create policy "Atención ve mensajes programados" on public.mensajes_programados
  for select to authenticated using (public.puede_atender());

drop policy if exists "Atención programa mensajes" on public.mensajes_programados;
create policy "Atención programa mensajes" on public.mensajes_programados
  for insert to authenticated
  with check (public.puede_atender() and estado = 'pendiente' and creado_por = auth.uid());

-- Solo para cancelar uno que todavía no salió.
drop policy if exists "Atención cancela mensajes programados" on public.mensajes_programados;
create policy "Atención cancela mensajes programados" on public.mensajes_programados
  for update to authenticated
  using (public.puede_atender() and estado = 'pendiente')
  with check (public.puede_atender() and estado in ('pendiente', 'cancelado'));

grant select, insert, update on public.mensajes_programados to authenticated;
grant all on public.mensajes_programados to service_role;

-- 5. Leads por cerrar -------------------------------------------------------
-- Cada intento de contacto (llamada o WhatsApp) con alguien que escribió y no
-- agendó. Deja el resultado para no llamar dos veces a la misma persona ni
-- perder el hilo cuando atienden dos vendedores.
create table if not exists public.contactos_lead (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  conversacion_id uuid references public.conversaciones(id) on delete set null,
  medio text not null check (medio in ('llamada', 'whatsapp')),
  resultado text not null
    check (resultado in ('no_contesto', 'hablamos', 'agendara', 'no_le_interesa')),
  nota text not null check (char_length(btrim(nota)) between 2 and 1000),
  staff_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists contactos_lead_cliente_idx
  on public.contactos_lead (cliente_id, created_at desc);

alter table public.contactos_lead enable row level security;

drop policy if exists "Atención ve contactos de leads" on public.contactos_lead;
create policy "Atención ve contactos de leads" on public.contactos_lead
  for select to authenticated using (public.puede_atender());

drop policy if exists "Atención registra contactos de leads" on public.contactos_lead;
create policy "Atención registra contactos de leads" on public.contactos_lead
  for insert to authenticated
  with check (public.puede_atender() and staff_id = auth.uid());

grant select, insert on public.contactos_lead to authenticated;
grant all on public.contactos_lead to service_role;

-- Quién sigue sin agendar: escribió, la conversación sigue abierta, está en una
-- etapa previa a «agendado», la última actividad es de los últimos 14 días, no
-- tiene una cita confirmada (de ayer en adelante) y nadie anotó «no le interesa».
-- Va sobre conversaciones_resumen, que ya trae el último mensaje y la actividad.
-- security_invoker: la vista se evalúa con los permisos de quien consulta.
drop view if exists public.leads_por_cerrar;
create view public.leads_por_cerrar with (security_invoker = true) as
select
  r.id as conversacion_id,
  r.cliente_id,
  r.canal,
  r.etapa,
  r.cliente_nombre,
  r.cliente_telefono,
  r.identidad_nombre,
  r.identidad_username,
  r.ultimo_contenido,
  r.ultimo_rol,
  r.actividad_at,
  lc.created_at as ultimo_contacto_at,
  lc.medio as ultimo_contacto_medio,
  lc.resultado as ultimo_contacto_resultado,
  lc.nota as ultimo_contacto_nota
from public.conversaciones_resumen r
left join lateral (
  select l.created_at, l.medio, l.resultado, l.nota
  from public.contactos_lead l
  where l.cliente_id = r.cliente_id
  order by l.created_at desc
  limit 1
) lc on true
where r.origen = 'dm'
  and r.estado <> 'cerrada'
  and r.etapa in ('nuevo', 'en_atencion', 'calificado')
  and r.actividad_at > now() - interval '14 days'
  and coalesce(lc.resultado, '') <> 'no_le_interesa'
  and not exists (
    select 1 from public.citas c
    where c.cliente_id = r.cliente_id
      and c.estado = 'confirmada'
      and c.inicio_utc > now() - interval '1 day'
  );

grant select on public.leads_por_cerrar to authenticated, service_role;
revoke all on public.leads_por_cerrar from anon;
