-- 0015 — La vista de caja vuelve a incluir todas las columnas de la tabla.
--
-- `caja_sesiones_resumen` (migración 0009) se define con `select s.*`, pero
-- Postgres expande ese `*` a una lista de columnas EN EL MOMENTO DE CREARLA.
-- Como la 0014 agregó `caja_sesiones.sede_id` después, la vista quedó sin esa
-- columna: verificado contra producción, devuelve 19 columnas y ninguna es
-- sede_id. Sin ella el panel no puede decir a qué local pertenece la caja
-- abierta, ni distinguir dos turnos abiertos a la vez.
--
-- Se ejecuta de una sola vez en el SQL editor. Segura de correr dos veces.
--
-- OJO con `security_invoker`: un `create or replace view` descarta las
-- reloptions, así que hay que repetirlo o la vista pasaría a ejecutarse con
-- los permisos de quien la creó y saltaría el RLS de quien la consulta.

drop view if exists caja_sesiones_resumen;

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

grant select on public.caja_sesiones_resumen to authenticated;
revoke all on public.caja_sesiones_resumen from anon;
