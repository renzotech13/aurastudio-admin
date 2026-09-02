-- ============================================================================
-- 0009 — Control de caja
--
-- Aura Studio cobra en el mostrador: servicios, productos y propinas entran por
-- efectivo/Yape/Plin/tarjeta, y del mismo cajón salen insumos, movilidad y
-- adelantos. Este módulo modela ese cajón:
--
--   caja_sesiones     un turno de caja (apertura → arqueo → cierre)
--   movimientos_caja  cada ingreso o egreso del turno
--
-- El arqueo compara el efectivo declarado al cerrar contra el esperado
-- (monto inicial + ingresos en efectivo − egresos en efectivo). Yape, tarjeta y
-- transferencia se registran igual porque son ingresos del negocio, pero NO
-- entran al arqueo del cajón físico: la vista caja_sesiones_resumen los separa.
--
-- Además corrige una escalada de privilegios abierta desde la 0003 (ver abajo).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Escalada de privilegios de la 0003
--
-- "Users can update own profile" es un UPDATE sobre la fila entera, así que
-- cualquier cuenta autenticada podía hacer:
--     update profiles set role = 'staff' where id = auth.uid();
-- y aparecer como staff ante is_staff(). Con dinero en la base eso deja de ser
-- hipotético. La política sigue existiendo (el usuario debe poder corregir su
-- nombre y teléfono), pero el privilegio de columna ya no incluye `role`:
-- Postgres evalúa el grant por columna ANTES que la política RLS.
-- ---------------------------------------------------------------------------
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- A partir de aquí, `role` solo se cambia desde el SQL editor como postgres.

-- ---------------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------------
create type metodo_pago as enum ('efectivo', 'yape', 'plin', 'tarjeta', 'transferencia', 'otro');
create type movimiento_tipo as enum ('ingreso', 'egreso');
create type caja_estado as enum ('abierta', 'cerrada');

-- Categorías: se guardan como text con CHECK en vez de enum porque el negocio
-- las va a querer ajustar y un CHECK se cambia sin bloquear la tabla.
-- ---------------------------------------------------------------------------
-- 2. Sesiones de caja
-- ---------------------------------------------------------------------------
create table caja_sesiones (
  id uuid primary key default gen_random_uuid(),
  estado caja_estado not null default 'abierta',

  abierta_por uuid not null references auth.users(id),
  apertura_at timestamptz not null default now(),
  monto_inicial numeric(10, 2) not null default 0 check (monto_inicial >= 0),
  apertura_nota text,

  cerrada_por uuid references auth.users(id),
  cierre_at timestamptz,
  -- Efectivo realmente contado en el cajón al cerrar.
  monto_declarado numeric(10, 2) check (monto_declarado >= 0),
  cierre_nota text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint caja_cierre_completo check (
    (estado = 'abierta' and cierre_at is null and monto_declarado is null)
    or
    (estado = 'cerrada' and cierre_at is not null and monto_declarado is not null)
  ),
  constraint caja_cierre_despues_apertura check (cierre_at is null or cierre_at >= apertura_at)
);

-- Una sola caja abierta a la vez: el índice parcial lo garantiza a nivel de
-- base, no de UI (dos pestañas del panel abriendo caja a la vez es un caso real).
create unique index caja_sesiones_una_abierta_idx
  on caja_sesiones ((estado)) where (estado = 'abierta');

create index caja_sesiones_apertura_idx on caja_sesiones (apertura_at desc);

create trigger caja_sesiones_set_updated_at
before update on caja_sesiones
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Movimientos
-- ---------------------------------------------------------------------------
create table movimientos_caja (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid references caja_sesiones(id) on delete restrict,

  tipo movimiento_tipo not null,
  categoria text not null,
  concepto text not null,
  monto numeric(10, 2) not null check (monto > 0),
  metodo metodo_pago not null default 'efectivo',

  -- Trazabilidad opcional: de dónde salió el cobro.
  cita_id uuid references citas(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  servicio_id text references services(id) on delete set null,
  producto_id uuid references products(id) on delete set null,

  -- Los movimientos NO se borran: se anulan, y el rastro queda.
  anulado boolean not null default false,
  anulado_por uuid references auth.users(id),
  anulado_at timestamptz,
  anulado_motivo text,

  registrado_por uuid not null references auth.users(id),
  ocurrido_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint movimiento_categoria_valida check (
    (tipo = 'ingreso' and categoria in ('servicio', 'producto', 'curso', 'propina', 'adelanto', 'otro'))
    or
    (tipo = 'egreso' and categoria in ('insumo', 'proveedor', 'sueldo', 'alquiler', 'servicios', 'movilidad', 'retiro', 'otro'))
  ),
  constraint movimiento_anulado_completo check (
    (not anulado and anulado_at is null)
    or
    (anulado and anulado_at is not null)
  )
);

create index movimientos_caja_sesion_idx on movimientos_caja (sesion_id);
create index movimientos_caja_ocurrido_idx on movimientos_caja (ocurrido_at desc) where (not anulado);
create index movimientos_caja_cita_idx on movimientos_caja (cita_id) where (cita_id is not null);

create trigger movimientos_caja_set_updated_at
before update on movimientos_caja
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Vista de arqueo
--
-- El panel necesita, por sesión: ingresos y egresos totales, cuánto de eso fue
-- efectivo (lo único que toca el cajón físico) y la diferencia contra lo
-- declarado. Calcularlo en SQL evita que el front sume mal y que cada pantalla
-- lo sume distinto.
-- ---------------------------------------------------------------------------
create view caja_sesiones_resumen
with (security_invoker = true)
as
select
  s.*,
  coalesce(m.ingresos, 0)                                   as ingresos,
  coalesce(m.egresos, 0)                                    as egresos,
  coalesce(m.ingresos_efectivo, 0)                          as ingresos_efectivo,
  coalesce(m.egresos_efectivo, 0)                           as egresos_efectivo,
  coalesce(m.movimientos, 0)                                as movimientos,
  s.monto_inicial
    + coalesce(m.ingresos_efectivo, 0)
    - coalesce(m.egresos_efectivo, 0)                       as efectivo_esperado,
  case
    when s.monto_declarado is null then null
    else s.monto_declarado
      - (s.monto_inicial + coalesce(m.ingresos_efectivo, 0) - coalesce(m.egresos_efectivo, 0))
  end                                                       as diferencia
from caja_sesiones s
left join lateral (
  select
    count(*)                                                                   as movimientos,
    sum(monto) filter (where tipo = 'ingreso')                                 as ingresos,
    sum(monto) filter (where tipo = 'egreso')                                  as egresos,
    sum(monto) filter (where tipo = 'ingreso' and metodo = 'efectivo')         as ingresos_efectivo,
    sum(monto) filter (where tipo = 'egreso'  and metodo = 'efectivo')         as egresos_efectivo
  from movimientos_caja
  where sesion_id = s.id and not anulado
) m on true;

-- ---------------------------------------------------------------------------
-- 5. RLS
--
-- Todo el módulo es de staff. `alumna` no ve un solo sol: la caja es del
-- negocio, no del alumnado, y tras el fix de arriba nadie se auto-asciende.
-- ---------------------------------------------------------------------------
alter table caja_sesiones enable row level security;
alter table movimientos_caja enable row level security;

create policy "Staff can view caja sesiones"
on caja_sesiones for select to authenticated using (is_staff());

create policy "Staff can open caja"
on caja_sesiones for insert to authenticated
with check (is_staff() and abierta_por = auth.uid());

create policy "Staff can close caja"
on caja_sesiones for update to authenticated
using (is_staff()) with check (is_staff());

create policy "Staff can view movimientos"
on movimientos_caja for select to authenticated using (is_staff());

-- registrado_por forzado a auth.uid() por la propia política: nadie registra
-- un movimiento a nombre de otra persona.
create policy "Staff can register movimientos"
on movimientos_caja for insert to authenticated
with check (is_staff() and registrado_por = auth.uid());

create policy "Staff can annul movimientos"
on movimientos_caja for update to authenticated
using (is_staff()) with check (is_staff());

-- Sin política de DELETE, a propósito: la caja es un libro, no un borrador.

-- ---------------------------------------------------------------------------
-- 6. Permisos
--
-- Explícitos y no por privilegio por defecto: el grant es la puerta y la RLS
-- es el filtro. `anon` no aparece — la caja no se consulta desde el sitio.
-- ---------------------------------------------------------------------------
grant select, insert, update on public.caja_sesiones to authenticated;
grant select, insert, update on public.movimientos_caja to authenticated;
grant select on public.caja_sesiones_resumen to authenticated;

revoke all on public.caja_sesiones from anon;
revoke all on public.movimientos_caja from anon;
revoke all on public.caja_sesiones_resumen from anon;
