-- ============================================================================
-- 0018: metricas_contenido_diarias — foto diaria de alcance/impresiones/
-- seguidores de Facebook e Instagram (PROMPT-OMNICANAL.md §4.11/§5.11/§6.6).
--
-- Quedó documentada en el prompt desde la fase 1 pero nunca se llevó a un
-- archivo de migración real — se detectó al construir la fase 5 (el barrido
-- del bot y la pestaña "Contenido" de Métricas ya la dan por existente).
--
-- La Insights API de Meta no es un histórico: la mayoría de métricas de
-- página solo se pueden pedir por una ventana corta hacia atrás, y las de
-- Instagram tienen límites parecidos según el `period`. Para que el panel
-- pueda mostrar "últimos 30 días" o comparar mes contra mes, alguien tiene
-- que ir guardando una foto diaria — por eso es una tabla propia y no una
-- consulta en vivo a la API cada vez que se abre la pantalla.
-- ============================================================================

create table if not exists metricas_contenido_diarias (
  id uuid primary key default gen_random_uuid(),
  canal text not null check (canal in ('facebook', 'instagram')),
  fecha date not null,
  -- Nombres genéricos a propósito: la métrica exacta que los alimenta difiere
  -- entre Facebook e Instagram — el detalle de qué metric de Meta llena cada
  -- columna se documenta en bot/src/meta/insights.ts, no acá.
  alcance int,
  impresiones int,
  interacciones int,
  -- Página: `followers_count` del nodo de la Página. Instagram: `followers_count`
  -- del nodo de la cuenta. Ninguno de los dos es un metric de Insights — ver
  -- el comentario en insights.ts sobre por qué.
  seguidores int,
  -- Solo Instagram: profile_views. Null en canal='facebook'.
  visitas_perfil int,
  -- Payload crudo de la Insights API de ese día, para poder auditar o
  -- recalcular columnas nuevas sin tener que volver a pedirle el dato a Meta
  -- (las ventanas cortas de la API significan que un día perdido no se
  -- puede recuperar después).
  crudo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (canal, fecha)
);

create index if not exists metricas_contenido_diarias_fecha_idx
  on metricas_contenido_diarias (fecha desc);

alter table metricas_contenido_diarias enable row level security;
drop policy if exists "Staff can view metricas_contenido_diarias" on metricas_contenido_diarias;
create policy "Staff can view metricas_contenido_diarias"
on metricas_contenido_diarias for select to authenticated using (is_staff());
-- Sin policy de insert/update: solo el bot (service role) escribe, una vez
-- cada tanto (ver el barrido en bot/src/index.ts). El panel es de solo
-- lectura sobre esto.

grant select on metricas_contenido_diarias to authenticated;
revoke all on metricas_contenido_diarias from anon;
