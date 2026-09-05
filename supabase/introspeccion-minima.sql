-- ============================================================================
-- Lo MÍNIMO para poder escribir la migración 0010 (sedes y profesionales)
--
-- Una sola consulta, un solo resultado. Devuelve dos columnas (bloque, dato).
-- Es solo lectura.
--
-- Lo que hace falta saber y por qué:
--   · constraint:citas → el NOMBRE REAL del EXCLUDE. Hay que borrarlo para
--     reescribirlo por profesional, y el de la 0002 es autogenerado: si en
--     producción se recreó a mano con otro nombre, el DROP falla y —como el
--     editor SQL corre el archivo entero en una transacción— se cae la
--     migración completa.
--   · columna:*  → qué columnas existen de verdad en citas, clientes y
--     bloqueos, para no volver a añadir algo que ya está.
--   · existe     → cuáles de los objetos que el código usa fueron creados a
--     mano y si tienen RLS activa.
--   · enum:*     → valores actuales, porque añadir uno y usarlo en la misma
--     transacción falla (55P04).
--   · bucket     → si 'comprobantes' existe y si es público.
-- ============================================================================

select 'constraint:citas' as bloque,
       con.conname || '  ::  ' || pg_get_constraintdef(con.oid) as dato
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where n.nspname = 'public' and rel.relname = 'citas'

union all
select 'columna:citas', column_name || ' — ' || data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'citas'

union all
select 'columna:clientes', column_name || ' — ' || data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'clientes'

union all
select 'columna:bloqueos', column_name || ' — ' || data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'bloqueos'

union all
select 'columna:profiles', column_name || ' — ' || data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'

union all
select 'existe',
       c.relname
       || ' ('
       || case c.relkind when 'r' then 'tabla' when 'v' then 'vista' else c.relkind::text end
       || ', rls=' || c.relrowsecurity::text || ')'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'v')
  and c.relname in (
    'notificaciones', 'configuracion', 'plantillas_media', 'calendar_sync_state',
    'etiquetas', 'cliente_etiquetas', 'conversaciones_resumen',
    'sedes', 'profesionales'
  )

union all
select 'enum:' || t.typname,
       string_agg(e.enumlabel, '  |  ' order by e.enumsortorder)
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
group by t.typname

union all
select 'bucket', id || '  (public=' || public::text || ')'
from storage.buckets

order by 1, 2;
