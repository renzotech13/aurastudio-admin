-- ============================================================================
-- Inventario de la deriva — proyecto jpclzlzpkzmsmibweopn (Aura)
--
-- La consulta anterior solo devolvía filas de lo que EXISTE, así que una
-- ausencia era invisible: había que deducirla de un hueco en el orden
-- alfabético. Esta da una fila por objeto esperado, con SÍ o NO.
--
-- Cada NO es código que ya está en producción hablando con algo que no está
-- en la base. Solo lectura.
--
-- Desde la 0017 cubre también la bandeja omnicanal, y de paso las filas de
-- `realtime`: el panel se recarga con postgres_changes, así que una tabla
-- fuera de la publicación no da error — simplemente el panel deja de
-- actualizarse solo y nadie sabe por qué.
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

  -- ---- Omnicanal (migración 0017) ----
  union all
  select 'tabla    cliente_identidades', exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='cliente_identidades')
  union all
  select 'tabla    canales', exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='canales')
  union all
  select 'tabla    respuestas_rapidas', exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='respuestas_rapidas')
  union all
  select 'tabla    eventos_conversacion', exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='eventos_conversacion')
  union all
  select 'bucket   adjuntos', exists(select 1 from storage.buckets where id='adjuntos')
  union all
  select 'columna  clientes.canal_origen', exists(select 1 from information_schema.columns where table_schema='public' and table_name='clientes' and column_name='canal_origen')
  union all
  select 'columna  conversaciones.canal', exists(select 1 from information_schema.columns where table_schema='public' and table_name='conversaciones' and column_name='canal')
  union all
  select 'columna  conversaciones.origen', exists(select 1 from information_schema.columns where table_schema='public' and table_name='conversaciones' and column_name='origen')
  union all
  select 'columna  conversaciones.identidad_id', exists(select 1 from information_schema.columns where table_schema='public' and table_name='conversaciones' and column_name='identidad_id')
  union all
  select 'columna  conversaciones.hilo_externo', exists(select 1 from information_schema.columns where table_schema='public' and table_name='conversaciones' and column_name='hilo_externo')
  union all
  select 'columna  conversaciones.cuenta_id', exists(select 1 from information_schema.columns where table_schema='public' and table_name='conversaciones' and column_name='cuenta_id')
  union all
  select 'columna  conversaciones.asignada_a', exists(select 1 from information_schema.columns where table_schema='public' and table_name='conversaciones' and column_name='asignada_a')
  union all
  select 'columna  conversaciones.etapa', exists(select 1 from information_schema.columns where table_schema='public' and table_name='conversaciones' and column_name='etapa')
  union all
  select 'columna  conversaciones.motivo_cierre', exists(select 1 from information_schema.columns where table_schema='public' and table_name='conversaciones' and column_name='motivo_cierre')
  union all
  select 'columna  conversaciones.ultima_respuesta_at', exists(select 1 from information_schema.columns where table_schema='public' and table_name='conversaciones' and column_name='ultima_respuesta_at')
  union all
  select 'columna  conversaciones.primera_respuesta_at', exists(select 1 from information_schema.columns where table_schema='public' and table_name='conversaciones' and column_name='primera_respuesta_at')
  union all
  select 'columna  conversaciones.primera_respuesta_humana_at', exists(select 1 from information_schema.columns where table_schema='public' and table_name='conversaciones' and column_name='primera_respuesta_humana_at')
  union all
  select 'columna  conversaciones.ultimo_comentario_at', exists(select 1 from information_schema.columns where table_schema='public' and table_name='conversaciones' and column_name='ultimo_comentario_at')
  union all
  select 'columna  mensajes.external_id', exists(select 1 from information_schema.columns where table_schema='public' and table_name='mensajes' and column_name='external_id')
  union all
  select 'columna  mensajes.tipo', exists(select 1 from information_schema.columns where table_schema='public' and table_name='mensajes' and column_name='tipo')
  union all
  select 'columna  mensajes.autor_id', exists(select 1 from information_schema.columns where table_schema='public' and table_name='mensajes' and column_name='autor_id')
  union all
  select 'columna  mensajes.media_path', exists(select 1 from information_schema.columns where table_schema='public' and table_name='mensajes' and column_name='media_path')
  union all
  select 'columna  mensajes.metadata', exists(select 1 from information_schema.columns where table_schema='public' and table_name='mensajes' and column_name='metadata')
  union all
  select 'clientes.telefono admite null', exists(select 1 from information_schema.columns where table_schema='public' and table_name='clientes' and column_name='telefono' and is_nullable='YES')
  union all
  select 'conversaciones_resumen trae canal', exists(select 1 from information_schema.columns where table_schema='public' and table_name='conversaciones_resumen' and column_name='canal')
  union all
  select 'funcion  fusionar_clientes', exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='fusionar_clientes')
  union all
  select 'funcion  metricas_bandeja', exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='metricas_bandeja')
  union all
  select 'indice   conversaciones_hilo_abierto_idx', exists(select 1 from pg_class where relkind='i' and relname='conversaciones_hilo_abierto_idx')
  union all
  select 'indice   mensajes_external_id_idx', exists(select 1 from pg_class where relkind='i' and relname='mensajes_external_id_idx')
  union all
  select 'trigger  mensajes_actualiza_conversacion', exists(select 1 from pg_trigger tg join pg_class c on c.oid=tg.tgrelid where c.relname='mensajes' and tg.tgname='mensajes_actualiza_conversacion')
  union all
  select 'trigger  conversaciones_etapa_asignacion', exists(select 1 from pg_trigger tg join pg_class c on c.oid=tg.tgrelid where c.relname='conversaciones' and tg.tgname='conversaciones_etapa_asignacion')
  union all
  select 'trigger  conversaciones_audit', exists(select 1 from pg_trigger tg join pg_class c on c.oid=tg.tgrelid where c.relname='conversaciones' and tg.tgname='conversaciones_audit')
  union all
  select 'trigger  clientes_telefono_califica', exists(select 1 from pg_trigger tg join pg_class c on c.oid=tg.tgrelid where c.relname='clientes' and tg.tgname='clientes_telefono_califica')
  union all
  select 'trigger  citas_marca_agendado', exists(select 1 from pg_trigger tg join pg_class c on c.oid=tg.tgrelid where c.relname='citas' and tg.tgname='citas_marca_agendado')
  union all
  select 'realtime mensajes', exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mensajes')
  union all
  select 'realtime conversaciones', exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='conversaciones')
  union all
  select 'realtime clientes', exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='clientes')
  union all
  select 'realtime cliente_etiquetas', exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cliente_etiquetas')
  union all
  select 'realtime citas', exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='citas')
  union all
  select 'realtime canales', exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='canales')
  union all
  select 'realtime eventos_conversacion', exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='eventos_conversacion')
  union all
  select 'realtime cliente_identidades', exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cliente_identidades')
  union all
  select 'policy   clientes insert (staff)', exists(select 1 from pg_policies where schemaname='public' and tablename='clientes' and cmd='INSERT')
  union all
  select 'policy   clientes update (staff)', exists(select 1 from pg_policies where schemaname='public' and tablename='clientes' and cmd='UPDATE')
) t
order by hay, cosa;
