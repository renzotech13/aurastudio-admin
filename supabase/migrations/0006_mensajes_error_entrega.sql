-- Columna `error_entrega` en `mensajes`.
--
-- DERIVA DE MIGRACIONES: el bot y el admin de Raabta ya leen y escriben esta
-- columna desde el commit fa7ef77 ("Detectar y mostrar cuando WhatsApp no
-- logra entregar un mensaje saliente"), pero nunca se agregó a ninguna
-- migración — se creó a mano en el dashboard de Supabase. Clonar el repo y
-- correr las migraciones tal cual produce una base SIN esta columna, y el bot
-- revienta al primer fallo de entrega:
--
--   bot/src/db/repositories/mensajes.ts:72
--     .update({ error_entrega: error.slice(0, 500) })
--   admin/src/lib/types.ts:  error_entrega: string | null
--
-- Guarda el motivo que devuelve Meta cuando un mensaje saliente no llega
-- (número inválido, fuera de la ventana de 24 h, media que Meta no pudo
-- descargar...). null = entregado o todavía sin veredicto.

alter table mensajes add column if not exists error_entrega text;
