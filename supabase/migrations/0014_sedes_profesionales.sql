-- 0014 — Sedes, profesionales y una agenda que admite más de una clienta.
--
-- ESTA ES LA MIGRACIÓN QUE DESBLOQUEA TODO LO DEMÁS. Hasta hoy la tabla
-- `citas` tiene una restricción de exclusión GLOBAL:
--
--     exclude using gist (periodo with &&) where (estado <> 'cancelada')
--
-- es decir: dos citas que se solapen se rechazan aunque sean de clientas
-- distintas, en sedes distintas y con profesionales distintas. Con dos locales
-- y ocho profesionales, la base sólo permitía UNA clienta a la vez en todo el
-- negocio. Acá se reemplaza por una exclusión POR PROFESIONAL.
--
-- Los datos sembrados salen del widget que el salón opera hoy
-- (https://www.yocale.com/widget/aura-studio), leído el 2026-09-06: sedes,
-- direcciones, equipos y qué hace cada profesional. Las cantidades de servicios
-- por categoría que muestra Yocale coinciden exactamente con la carta de la
-- migración 0007 (79 servicios, 9 categorías), así que el mapeo se puede sembrar
-- por categoría — con una sola excepción, Victoria Ponce, que hace 4 de los 11
-- servicios de manicure y por eso la tabla de abajo es por servicio y no por
-- categoría.
--
-- Se ejecuta de una sola vez en el SQL editor. Segura de correr dos veces.
--
-- ADVERTENCIA: cambia una restricción de la tabla de citas. Conviene correrla
-- con el bot detenido un minuto (Railway → pausar) para que ninguna cita entre
-- justo mientras la restricción no existe.

-- Necesaria para poder mezclar `=` sobre uuid con `&&` sobre rango en el mismo
-- índice GiST de la exclusión. Sin esto, el `alter table ... add constraint`
-- de más abajo falla.
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- 1. Sedes
-- ---------------------------------------------------------------------------
create table if not exists sedes (
  id text primary key,
  nombre text not null,
  direccion text not null,
  -- Para el enlace "cómo llegar" y el pie de la web.
  maps_url text,
  telefono text,
  -- Número al que se le hace Yape del adelanto. Puede diferir por local.
  yape_numero text,
  yape_titular text,
  activa boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Se siembran acá y no más abajo porque el backfill de la sección 6
-- (citas.sede_id y caja_sesiones.sede_id) apunta a 'los-olivos' por clave
-- foránea: si las sedes no existieran todavía, ese update fallaría.
insert into sedes (id, nombre, direccion, activa, sort_order) values
  ('los-olivos', 'Aura Studio — Los Olivos',
   'Urb. Good Year, Jr. Manuel Gonzáles Prada 757, Los Olivos 15301', true, 10),
  ('independencia', 'Aura Studio — Mega',
   'C. 1 130, Independencia 15311', true, 20)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Profesionales
-- ---------------------------------------------------------------------------
-- Ojo: `profesionales` NO es `profiles`. `profiles` son las cuentas que entran
-- al panel (auth.users); una profesional puede existir en la agenda sin tener
-- cuenta todavía. Cuando se le cree cuenta, se enlaza con user_id.
create table if not exists profesionales (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  sede_id text not null references sedes(id) on delete restrict,
  rol text not null default 'Estilista',
  foto_url text,
  user_id uuid references auth.users(id) on delete set null,
  activa boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profesionales_sede_idx on profesionales (sede_id) where activa;

-- ---------------------------------------------------------------------------
-- 3. Qué hace cada profesional
-- ---------------------------------------------------------------------------
-- Por servicio y no por categoría: Yocale ya tiene un caso partido (Victoria
-- Ponce hace 4 de los 11 de manicure) y va a haber más. Sembrar por categoría
-- es sólo una comodidad del INSERT de más abajo.
create table if not exists profesional_servicios (
  profesional_id uuid not null references profesionales(id) on delete cascade,
  servicio_id text not null references services(id) on delete cascade,
  primary key (profesional_id, servicio_id)
);

create index if not exists profesional_servicios_servicio_idx
  on profesional_servicios (servicio_id);

-- ---------------------------------------------------------------------------
-- 4. La cita ahora sabe dónde y con quién
-- ---------------------------------------------------------------------------
alter table citas add column if not exists sede_id text references sedes(id);
alter table citas add column if not exists profesional_id uuid references profesionales(id);

create index if not exists citas_profesional_inicio_idx
  on citas (profesional_id, inicio_utc) where estado <> 'cancelada';

-- ---------------------------------------------------------------------------
-- 5. La restricción de exclusión, ahora por profesional
-- ---------------------------------------------------------------------------
-- La restricción vieja no tiene nombre en la migración 0002: se lo puso
-- Postgres solo. Escribir aquí `drop constraint if exists citas_periodo_excl`
-- sería una apuesta — si el nombre real fuera otro, el DROP no haría nada, la
-- nueva restricción se agregaría AL LADO de la global, y el sistema seguiría
-- rechazando dos clientas a la vez sin ningún error visible. Así que en vez de
-- adivinar el nombre se buscan en el catálogo todas las restricciones de
-- exclusión de `citas` y se eliminan.
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.citas'::regclass
      and contype = 'x'
  loop
    execute format('alter table public.citas drop constraint %I', r.conname);
    raise notice 'citas: eliminada restricción de exclusión %', r.conname;
  end loop;
end $$;

-- Dos citas sólo chocan si son de la MISMA profesional. Las citas viejas (que
-- no tienen profesional asignada) quedan fuera de la restricción, así que nada
-- de lo que ya está guardado se rompe al correr esto.
--
-- Regla de la aplicación, no de la base: "Cualquier profesional" en el modal NO
-- guarda null — el sistema elige una concreta y la escribe. Si se guardara null,
-- esa cita no chocaría con nada y se podrían agendar diez clientas a la misma
-- hora. Además, sin profesional en la cita no se puede filtrar la caja por
-- profesional, que es justamente lo que se quiere medir.
alter table citas
  add constraint citas_periodo_por_profesional_excl
  exclude using gist (profesional_id with =, periodo with &&)
  where (estado <> 'cancelada' and profesional_id is not null);

-- ---------------------------------------------------------------------------
-- 6. La caja también es por sede
-- ---------------------------------------------------------------------------
-- Hoy `caja_sesiones_una_abierta_idx` permite UNA sola caja abierta en todo el
-- negocio. Con dos locales, abrir caja en Los Olivos cerraba la de Mega.
alter table caja_sesiones add column if not exists sede_id text references sedes(id);
alter table movimientos_caja add column if not exists profesional_id uuid references profesionales(id) on delete set null;

create index if not exists movimientos_caja_profesional_idx
  on movimientos_caja (profesional_id) where not anulado;

-- Todo lo que ya está guardado es de Los Olivos: es el único local que ha
-- operado hasta hoy. Se rellena ANTES de crear el índice único de abajo.
update caja_sesiones   set sede_id = 'los-olivos' where sede_id is null;
update citas           set sede_id = 'los-olivos' where sede_id is null;

drop index if exists caja_sesiones_una_abierta_idx;

-- Sobre coalesce y no sobre sede_id a secas: en Postgres dos NULL no se
-- consideran iguales, así que un índice único sobre `sede_id` dejaría abrir
-- infinitas cajas mientras la sede vaya en null — justo la garantía que este
-- índice existe para dar. Con coalesce, una caja sin sede también choca.
create unique index if not exists caja_sesiones_una_abierta_por_sede_idx
  on caja_sesiones (coalesce(sede_id, 'sin-sede')) where (estado = 'abierta');

-- ---------------------------------------------------------------------------
-- 7. Semilla — profesionales
-- ---------------------------------------------------------------------------
-- Mishel Chavez existe en Yocale pero sin especialidades ni horario cargados
-- ("No availability"), así que entra desactivada: aparece en el panel para
-- completarla, y no en el modal de reserva.
insert into profesionales (slug, nombre, sede_id, activa, sort_order) values
  ('laura-ballena',   'Laura Ballena',   'los-olivos',    true,  10),
  ('linda-atencia',   'Linda Atencia',   'los-olivos',    true,  20),
  ('lucero-benancio', 'Lucero Benancio', 'los-olivos',    true,  30),
  ('victoria-ponce',  'Victoria Ponce',  'los-olivos',    true,  40),
  ('regina-vasquez',  'Regina Vasquez',  'independencia', true,  50),
  ('tatiana-huari',   'Tatiana Huari',   'independencia', true,  60),
  ('dylan-ramirez',   'Dylan Ramírez',   'independencia', true,  70),
  ('mishel-chavez',   'Mishel Chavez',   'independencia', false, 80)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Semilla — especialidades
-- ---------------------------------------------------------------------------
-- Categorías completas, tal como las muestra Yocale por profesional.
insert into profesional_servicios (profesional_id, servicio_id)
select p.id, s.id
from profesionales p
join services s on s.category_id = any (
  case p.slug
    when 'regina-vasquez'  then array['manicure','depilacion','pies']
    when 'tatiana-huari'   then array['cejas','depilacion','pestanas','facial']
    when 'dylan-ramirez'   then array['cabello','color','maquillaje']
    when 'laura-ballena'   then array['manicure','pestanas','maquillaje','pies']
    when 'linda-atencia'   then array['cabello','color','cejas','maquillaje']
    when 'lucero-benancio' then array['manicure','cejas','pestanas','pies']
    when 'victoria-ponce'  then array['cabello','color','maquillaje']
    else array[]::text[]
  end
)
on conflict do nothing;

-- La excepción: Victoria Ponce hace sólo 4 de los 11 servicios de manicure.
-- Verificado uno por uno contra precio y duración en Yocale ("UÑAS HUILDER" y
-- "UÑAS RUBER" están mal escritos allá; son builder y rubber).
insert into profesional_servicios (profesional_id, servicio_id)
select p.id, s.id
from profesionales p
join services s on s.id in ('esmaltado-en-gel','manicure-clasica','unas-builder','unas-rubber')
where p.slug = 'victoria-ponce'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 9. RLS — mismo patrón que services/service_categories (migración 0001)
-- ---------------------------------------------------------------------------
alter table sedes enable row level security;
alter table profesionales enable row level security;
alter table profesional_servicios enable row level security;

drop policy if exists "Public can view active sedes" on sedes;
create policy "Public can view active sedes"
on sedes for select to anon using (activa = true);

drop policy if exists "Authenticated can manage sedes" on sedes;
create policy "Authenticated can manage sedes"
on sedes for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "Public can view active profesionales" on profesionales;
create policy "Public can view active profesionales"
on profesionales for select to anon using (activa = true);

drop policy if exists "Authenticated can manage profesionales" on profesionales;
create policy "Authenticated can manage profesionales"
on profesionales for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "Public can view profesional servicios" on profesional_servicios;
create policy "Public can view profesional servicios"
on profesional_servicios for select to anon using (true);

drop policy if exists "Authenticated can manage profesional servicios" on profesional_servicios;
create policy "Authenticated can manage profesional servicios"
on profesional_servicios for all to authenticated using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------------
-- 10. updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists sedes_set_updated_at on sedes;
create trigger sedes_set_updated_at
before update on sedes
for each row execute function set_updated_at();

drop trigger if exists profesionales_set_updated_at on profesionales;
create trigger profesionales_set_updated_at
before update on profesionales
for each row execute function set_updated_at();
