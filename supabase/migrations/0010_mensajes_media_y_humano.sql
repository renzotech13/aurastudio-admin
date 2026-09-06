-- 0010 — Cierra la deriva de `mensajes` que bloquea CADA mensaje entrante.
--
-- Se ejecuta de una sola vez en el SQL editor.
--
-- El bot intenta guardar `media_url` y `media_type` en TODO mensaje que
-- procesa (bot/src/db/repositories/mensajes.ts:37-45), sea o no multimedia
-- —el valor va como null cuando no aplica, pero la columna igual tiene que
-- existir—. Ninguna migración de Aura las creó nunca, así que ahora mismo
-- CADA mensaje que llega por WhatsApp falla al guardarse con
-- PGRST204 "Could not find the 'media_type' column of 'mensajes'". El
-- webhook igual responde 200 a Meta (por eso la clienta ve los dos checks
-- de entregado), pero el bot nunca llega a leerlo ni a responder.
--
-- De paso, el mismo tipo de drift en la misma tabla: `rol` solo admite
-- ('user','assistant'), pero admin.ts:74 y :83 escriben rol='humano' cuando
-- el staff responde desde el CRM del panel — eso también falla hoy
-- (23514, violates check constraint). Se corrige en la misma migración
-- porque es la misma tabla y el mismo tipo de arreglo.

alter table mensajes add column if not exists media_url text;
alter table mensajes add column if not exists media_type text;

alter table mensajes drop constraint if exists mensajes_media_type_check;
alter table mensajes add constraint mensajes_media_type_check
  check (media_type is null or media_type in ('image', 'video', 'audio', 'document'));

alter table mensajes drop constraint if exists mensajes_rol_check;
alter table mensajes add constraint mensajes_rol_check
  check (rol in ('user', 'assistant', 'humano'));
