-- 0011 — Crea `plantillas_media`, otra tabla que el bot usa a diario y
-- ninguna migración de Aura llegó a crear.
--
-- Se ejecuta de una sola vez en el SQL editor. Segura de correr dos veces
-- por error: todo lleva "if not exists" / "if exists".
--
-- `buildSystemPrompt()` arma el prompt de CADA turno del agente con
-- `Promise.all([listActiveServices(), listActivePlantillas()])`
-- (bot/src/agent/systemPrompt.ts:55). Como `plantillas_media` no existe,
-- ese Promise.all rechaza completo y el prompt nunca se arma — el agente
-- no puede responder NADA, ni siquiera un "hola", así la clienta escriba
-- lo que escriba. No es un problema de multimedia: bloquea la conversación
-- entera desde la raíz.
--
-- Estructura y comentario del bucket tomados literalmente de
-- bot/src/db/repositories/plantillasMedia.ts y admin/src/pages/Multimedia.tsx
-- (que ya escriben y leen contra este esquema, solo que contra el vacío).

create table if not exists plantillas_media (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('image', 'video', 'audio', 'document')),
  storage_path text not null,
  descripcion_uso text not null,
  caption text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plantillas_media_activo_idx on plantillas_media (activo);

drop trigger if exists plantillas_media_set_updated_at on plantillas_media;
create trigger plantillas_media_set_updated_at
before update on plantillas_media
for each row execute function set_updated_at();

alter table plantillas_media enable row level security;

-- Solo el staff la gestiona desde el panel. El bot la lee con la service
-- role key (bypasea RLS); nadie más necesita tocar esta tabla.
drop policy if exists "Staff can manage plantillas_media" on plantillas_media;
create policy "Staff can manage plantillas_media"
on plantillas_media for all to authenticated
using (is_staff()) with check (is_staff());

-- Bucket público a propósito (mismo criterio que 'site-media' en la 0004):
-- WhatsApp tiene que poder pedir el archivo por su URL directa al momento
-- de enviarlo, sin pasar por una URL firmada que expira. Que el bucket sea
-- público NO abre la tabla ni el panel — solo el archivo, y solo a quien
-- ya tenga la ruta exacta.
insert into storage.buckets (id, name, public) values ('plantillas-media', 'plantillas-media', true)
on conflict (id) do nothing;

drop policy if exists "Staff can list plantillas-media objects" on storage.objects;
create policy "Staff can list plantillas-media objects"
on storage.objects for select to authenticated
using (bucket_id = 'plantillas-media' and is_staff());

drop policy if exists "Staff can upload plantillas-media objects" on storage.objects;
create policy "Staff can upload plantillas-media objects"
on storage.objects for insert to authenticated
with check (bucket_id = 'plantillas-media' and is_staff());

drop policy if exists "Staff can update plantillas-media objects" on storage.objects;
create policy "Staff can update plantillas-media objects"
on storage.objects for update to authenticated
using (bucket_id = 'plantillas-media' and is_staff())
with check (bucket_id = 'plantillas-media' and is_staff());

drop policy if exists "Staff can delete plantillas-media objects" on storage.objects;
create policy "Staff can delete plantillas-media objects"
on storage.objects for delete to authenticated
using (bucket_id = 'plantillas-media' and is_staff());
