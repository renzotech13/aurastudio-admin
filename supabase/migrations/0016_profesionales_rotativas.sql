-- 0016 — Una profesional puede atender en varias sedes, y en días distintos
-- en cada una.
--
-- Hasta ahora `profesionales.sede_id` ataba a cada persona a UN local. Con
-- gente que rota (Laura en ambas sedes, Linda solo los lunes en Mega) eso ya
-- no alcanza: hace falta una tabla aparte que diga dónde atiende cada una y
-- qué días.
--
-- `profesionales.sede_id` NO se elimina: queda como "sede principal", que es
-- lo que usa el panel para agrupar. Dónde se la puede reservar sale de
-- `profesional_sedes` — esa es la fuente de verdad para la agenda.
--
-- Se ejecuta de una sola vez en el SQL editor. Segura de correr dos veces.

-- ---------------------------------------------------------------------------
-- 1. Dónde atiende cada profesional
-- ---------------------------------------------------------------------------
create table if not exists profesional_sedes (
  profesional_id uuid not null references profesionales(id) on delete cascade,
  sede_id text not null references sedes(id) on delete cascade,
  -- Días de la semana en esa sede: 0=domingo … 6=sábado, misma convención que
  -- `business_hours.weekday` y que getDay() de JavaScript.
  --
  -- Arreglo VACÍO = todos los días que el local esté abierto. Es el default a
  -- propósito: quien no rota (la mayoría) no tiene que cargar nada, y al
  -- sembrar desde el modelo viejo nadie pierde disponibilidad.
  dias smallint[] not null default '{}',
  primary key (profesional_id, sede_id),
  constraint profesional_sedes_dias_validos check (
    dias <@ array[0,1,2,3,4,5,6]::smallint[]
  )
);

create index if not exists profesional_sedes_sede_idx on profesional_sedes (sede_id);

-- ---------------------------------------------------------------------------
-- 2. Semilla: cada quien donde ya estaba, todos los días
-- ---------------------------------------------------------------------------
insert into profesional_sedes (profesional_id, sede_id, dias)
select id, sede_id, '{}'::smallint[]
from profesionales
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Bajas
-- ---------------------------------------------------------------------------
-- Se desactivan, NO se borran: sus citas y cobros pasados siguen colgando de
-- ellas y el panel tiene que poder seguir mostrando de quién fueron.
update profesionales set activa = false where slug in ('regina-vasquez', 'dylan-ramirez');

-- ---------------------------------------------------------------------------
-- 4. Altas y rotación
-- ---------------------------------------------------------------------------
-- Michelle Chavez ya existía cargada pero sin especialidades ni horario (venía
-- así de Yocale). Entra activa como especialista en uñas.
update profesionales
set activa = true, rol = 'Especialista en uñas'
where slug = 'mishel-chavez';

insert into profesional_servicios (profesional_id, servicio_id)
select p.id, s.id
from profesionales p
join services s on s.category_id in ('manicure', 'pies')
where p.slug = 'mishel-chavez'
on conflict do nothing;

-- Marleni entra sin especialidades ni sede a propósito: no tenemos ese dato
-- todavía. Aparece INACTIVA en el panel para completarla desde
-- Equipo → Editar, y por estar inactiva no se ofrece para reservar.
insert into profesionales (slug, nombre, sede_id, rol, activa, sort_order)
values ('marleni', 'Marleni', 'independencia', 'Estilista', false, 90)
on conflict (slug) do nothing;

-- Laura rota: atiende en las dos sedes, todos los días.
insert into profesional_sedes (profesional_id, sede_id, dias)
select p.id, 'independencia', '{}'::smallint[]
from profesionales p
where p.slug = 'laura-ballena'
on conflict (profesional_id, sede_id) do nothing;

-- Linda va a Mega los lunes. Su disponibilidad en Los Olivos se deja como
-- estaba (todos los días) en vez de recortarla: reducirla por una lectura
-- ambigua rompería reservas reales. Los días exactos se ajustan desde el
-- panel, en Equipo → Editar → Sedes.
insert into profesional_sedes (profesional_id, sede_id, dias)
select p.id, 'independencia', array[1]::smallint[]
from profesionales p
where p.slug = 'linda-atencia'
on conflict (profesional_id, sede_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. RLS — mismo patrón que profesional_servicios (migración 0014)
-- ---------------------------------------------------------------------------
alter table profesional_sedes enable row level security;

drop policy if exists "Public can view profesional sedes" on profesional_sedes;
create policy "Public can view profesional sedes"
on profesional_sedes for select to anon using (true);

drop policy if exists "Authenticated can manage profesional sedes" on profesional_sedes;
create policy "Authenticated can manage profesional sedes"
on profesional_sedes for all to authenticated using (is_staff()) with check (is_staff());
