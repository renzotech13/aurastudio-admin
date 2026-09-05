-- ============================================================================
-- Fotografía del esquema real de producción
--
-- POR QUÉ EXISTE: las migraciones de este repo son un SUBCONJUNTO de lo que
-- hay en la base. Al menos estos objetos los usa el código a diario y no los
-- crea ningún archivo de migrations/:
--
--   tablas   notificaciones, configuracion, plantillas_media,
--            calendar_sync_state, etiquetas, cliente_etiquetas
--   vista    conversaciones_resumen
--   columnas clientes.email, bloqueos.google_event_id,
--            citas.comprobante_estado / _path / _monto_detectado / _nota
--   bucket   comprobantes
--
-- Se crearon a mano desde el panel de Supabase, igual que documentó la 0006.
-- Mientras no sepamos qué hay exactamente, cualquier migración nueva es una
-- apuesta: puede abortar a mitad (y en el editor SQL de Supabase todo el
-- archivo va en UNA transacción) o pisar algo que ya existe.
--
-- CÓMO USARLO: pegar cada bloque por separado en el SQL editor de Supabase y
-- guardar el resultado. No modifica nada — es solo lectura.
-- ============================================================================


-- 1. COLUMNAS de todas las tablas del esquema público ------------------------
-- Interesa sobre todo: citas (¿están las comprobante_*?), clientes (¿email?),
-- bloqueos (¿google_event_id?), profiles, movimientos_caja, caja_sesiones.
select
  table_name,
  ordinal_position as pos,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;


-- 2. TABLAS Y VISTAS que existen, y si la vista es security_invoker ----------
-- Una vista sin security_invoker se ejecuta con los permisos de su dueño y se
-- salta la RLS de las tablas base (ver el comentario de la 0009 sobre
-- caja_sesiones_resumen).
select
  c.relname                                   as objeto,
  case c.relkind when 'r' then 'tabla' when 'v' then 'vista' when 'm' then 'vista materializada' end as tipo,
  c.relrowsecurity                            as rls_activa,
  c.reloptions                                as opciones
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'v', 'm')
order by c.relkind, c.relname;


-- 3. RESTRICCIONES: primarias, únicas, CHECK y sobre todo EXCLUDE ------------
-- La que importa: el EXCLUDE de citas. Hay que conocer su NOMBRE REAL antes
-- de poder reescribirlo — el de la 0002 es autogenerado por Postgres y pudo
-- recrearse a mano con otro nombre.
select
  rel.relname                     as tabla,
  con.conname                     as restriccion,
  case con.contype
    when 'p' then 'primaria' when 'u' then 'unica' when 'f' then 'foranea'
    when 'c' then 'check'    when 'x' then 'EXCLUDE'
  end                             as tipo,
  pg_get_constraintdef(con.oid)   as definicion
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where n.nspname = 'public'
order by (con.contype = 'x') desc, rel.relname, con.conname;


-- 4. ÍNDICES ----------------------------------------------------------------
-- Ojo a caja_sesiones_una_abierta_idx: hoy es global y con dos sedes impide
-- que la segunda abra su turno.
select tablename as tabla, indexname as indice, indexdef as definicion
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;


-- 5. POLÍTICAS RLS ----------------------------------------------------------
select
  tablename as tabla,
  policyname as politica,
  cmd        as operacion,
  roles,
  qual       as using_,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;


-- 6. PRIVILEGIOS POR COLUMNA ------------------------------------------------
-- La 0009 cerró la escalada de privilegios con un grant por columna sobre
-- profiles. Esto confirma que sigue puesto.
select table_name as tabla, column_name as columna, grantee, privilege_type as privilegio
from information_schema.column_privileges
where table_schema = 'public' and grantee in ('anon', 'authenticated')
order by table_name, column_name, grantee;


-- 7. PRIVILEGIOS DE TABLA ---------------------------------------------------
-- Busca tablas con grant a anon: son las que quedan expuestas por PostgREST
-- si además les falta RLS (cruzar con el bloque 2).
select table_name as tabla, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;


-- 8. TIPOS ENUMERADOS y sus valores -----------------------------------------
-- cita_estado, metodo_pago, movimiento_tipo, caja_estado, cita_origen...
-- Añadir valores a un enum y usarlos en la misma transacción falla (55P04),
-- así que hay que saber cuáles existen ya.
select t.typname as tipo, string_agg(e.enumlabel, ' | ' order by e.enumsortorder) as valores
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
group by t.typname
order by t.typname;


-- 9. FUNCIONES --------------------------------------------------------------
-- is_staff() y compañía: quién es security definer y con qué search_path.
select
  p.proname                                   as funcion,
  pg_get_function_identity_arguments(p.oid)   as argumentos,
  p.prosecdef                                 as security_definer,
  p.proconfig                                 as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;


-- 10. TRIGGERS --------------------------------------------------------------
select
  c.relname   as tabla,
  t.tgname    as trigger,
  pg_get_triggerdef(t.oid) as definicion
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal
order by c.relname, t.tgname;


-- 11. BUCKETS DE STORAGE y sus políticas -------------------------------------
select id, name, public, file_size_limit, allowed_mime_types from storage.buckets order by id;

select policyname as politica, cmd as operacion, roles, qual as using_, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;


-- 12. ¿Está abierto el registro público? -------------------------------------
-- No se puede consultar por SQL: se mira en Authentication → Sign In / Up →
-- "Allow new users to sign up". Si está activo, cualquiera con la anon key
-- (que viaja en el bundle de la web) puede crearse una cuenta y el panel se
-- la renderiza, porque el Gate solo comprueba que haya sesión.
