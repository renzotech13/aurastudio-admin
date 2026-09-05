-- ============================================================================
-- Inventario de la deriva — proyecto jpclzlzpkzmsmibweopn (Aura)
--
-- La consulta anterior solo devolvía filas de lo que EXISTE, así que una
-- ausencia era invisible: había que deducirla de un hueco en el orden
-- alfabético. Esta da una fila por objeto esperado, con SÍ o NO.
--
-- Cada NO es código que ya está en producción hablando con algo que no está
-- en la base. Solo lectura.
-- ============================================================================

select cosa, case when hay then 'SI' else 'NO  <-- falta' end as estado
from (
  select 'columna  citas.comprobante_estado' as cosa, exists(select 1 from information_schema.columns where table_schema='public' and table_name='citas' and column_name='comprobante_estado') as hay
  union all
  select 'columna  citas.comprobante_path' as cosa, exists(select 1 from information_schema.columns where table_schema='public' and table_name='citas' and column_name='comprobante_path') as hay
  union all
  select 'columna  citas.comprobante_monto_detectado' as cosa, exists(select 1 from information_schema.columns where table_schema='public' and table_name='citas' and column_name='comprobante_monto_detectado') as hay
  union all
  select 'columna  citas.comprobante_nota' as cosa, exists(select 1 from information_schema.columns where table_schema='public' and table_name='citas' and column_name='comprobante_nota') as hay
  union all
  select 'columna  clientes.email' as cosa, exists(select 1 from information_schema.columns where table_schema='public' and table_name='clientes' and column_name='email') as hay
  union all
  select 'columna  bloqueos.google_event_id' as cosa, exists(select 1 from information_schema.columns where table_schema='public' and table_name='bloqueos' and column_name='google_event_id') as hay
  union all
  select 'columna  services.duration_minutes' as cosa, exists(select 1 from information_schema.columns where table_schema='public' and table_name='services' and column_name='duration_minutes') as hay
  union all
  select 'columna  services.deposit_amount' as cosa, exists(select 1 from information_schema.columns where table_schema='public' and table_name='services' and column_name='deposit_amount') as hay
  union all
  select 'tabla    notificaciones', exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='notificaciones')
  union all
  select 'tabla    configuracion', exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='configuracion')
  union all
  select 'tabla    plantillas_media', exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='plantillas_media')
  union all
  select 'tabla    calendar_sync_state', exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='calendar_sync_state')
  union all
  select 'tabla    etiquetas', exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='etiquetas')
  union all
  select 'tabla    cliente_etiquetas', exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='cliente_etiquetas')
  union all
  select 'tabla    conversaciones_resumen', exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='conversaciones_resumen')
  union all
  select 'tabla    caja_sesiones', exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='caja_sesiones')
  union all
  select 'tabla    movimientos_caja', exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='movimientos_caja')
  union all
  select 'tabla    caja_sesiones_resumen', exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='caja_sesiones_resumen')
  union all
  select 'tabla    bookings', exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='bookings')
  union all
  select 'tabla    site_content', exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='site_content')
  union all
  select 'tabla    testimonials', exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='testimonials')
  union all
  select 'bucket   comprobantes', exists(select 1 from storage.buckets where id='comprobantes')
  union all
  select 'bucket   plantillas-media', exists(select 1 from storage.buckets where id='plantillas-media')
  union all
  select 'bucket   site-media', exists(select 1 from storage.buckets where id='site-media')
  union all
  select 'mensajes.rol admite ''humano''', exists(select 1 from pg_constraint con join pg_class rel on rel.oid=con.conrelid where rel.relname='mensajes' and pg_get_constraintdef(con.oid) like '%humano%')
) t
order by hay, cosa;
