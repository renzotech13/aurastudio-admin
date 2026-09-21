-- ============================================================================
-- 0019: revisión de las guías gratuitas por parte del salón.
--
-- Aura publica videos que terminan con "Escríbeme [palabra] y te mando la
-- guía"; cada palabra lleva a una guía de aurastudio.pe/guias/*. Antes de
-- publicarlas, alguien del salón (colorista, esteticista, manicurista...)
-- tiene que confirmar que lo que dicen coincide con cómo se trabaja de
-- verdad. Esta migración deja dónde guardar esas respuestas y cómo recibirlas
-- desde el celular de esa persona, que NO tiene cuenta en el panel.
--
-- Diseño:
--   * revision_tokens  — enlaces de revisión. El token va en la URL
--     (/revision/<token>) y se puede desactivar para cortar el acceso.
--   * guia_revisiones  — una fila por guía enviada. El detalle (respuestas
--     a las preguntas y correcciones) viaja en `respuestas` (jsonb) y guarda
--     el TEXTO de cada pregunta/afirmación: así la respuesta sigue teniendo
--     sentido aunque la guía se edite después.
--   * enviar_revision_guia() — la ÚNICA puerta pública. El rol anon no puede
--     leer ni escribir las tablas directamente; solo llamar a esta función,
--     que valida el token, el formato y un tope de envíos por hora.
--
-- Segura de correr dos veces: todo lleva "if not exists" / "or replace".
-- ============================================================================

create table if not exists revision_tokens (
  token text primary key,
  etiqueta text not null default 'Salón',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists guia_revisiones (
  id uuid primary key default gen_random_uuid(),
  -- Identificador de la guía tal como está en su URL: 'balayage', 'naranja'...
  -- Sin lista cerrada a propósito: sumar una guía no debería pedir migración.
  guia text not null check (guia ~ '^[a-z0-9-]{2,30}$'),
  revisor text not null check (char_length(btrim(revisor)) between 1 and 80),
  respuestas jsonb not null check (jsonb_typeof(respuestas) = 'object'),
  atendida boolean not null default false,
  token_etiqueta text,
  created_at timestamptz not null default now(),
  constraint guia_revisiones_respuestas_tamano check (pg_column_size(respuestas) <= 60000)
);

create index if not exists guia_revisiones_guia_idx on guia_revisiones (guia, created_at desc);
create index if not exists guia_revisiones_pendientes_idx on guia_revisiones (atendida, created_at desc);

alter table revision_tokens enable row level security;
alter table guia_revisiones enable row level security;

-- Solo el staff ve y gestiona ambas tablas desde el panel.
drop policy if exists "Staff manages revision_tokens" on revision_tokens;
create policy "Staff manages revision_tokens"
on revision_tokens for all to authenticated
using (is_staff()) with check (is_staff());

drop policy if exists "Staff manages guia_revisiones" on guia_revisiones;
create policy "Staff manages guia_revisiones"
on guia_revisiones for all to authenticated
using (is_staff()) with check (is_staff());

-- La puerta pública. SECURITY DEFINER porque anon no tiene (ni debe tener)
-- permiso sobre las tablas; search_path fijo para que nadie pueda colar un
-- objeto homónimo por delante.
create or replace function enviar_revision_guia(
  p_token text,
  p_guia text,
  p_revisor text,
  p_respuestas jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etiqueta text;
  v_id uuid;
begin
  select etiqueta into v_etiqueta
  from revision_tokens
  where token = p_token and activo;

  if not found then
    raise exception 'enlace_invalido' using errcode = '42501';
  end if;

  if p_guia is null or p_guia !~ '^[a-z0-9-]{2,30}$' then
    raise exception 'guia_invalida' using errcode = '22023';
  end if;

  if p_revisor is null or char_length(btrim(p_revisor)) not between 1 and 80 then
    raise exception 'revisor_invalido' using errcode = '22023';
  end if;

  if p_respuestas is null
     or jsonb_typeof(p_respuestas) <> 'object'
     or pg_column_size(p_respuestas) > 60000 then
    raise exception 'respuestas_invalidas' using errcode = '22023';
  end if;

  -- Tope contra abuso: un enlace filtrado no puede llenar la tabla.
  if (
    select count(*) from guia_revisiones
    where token_etiqueta = v_etiqueta and created_at > now() - interval '1 hour'
  ) >= 100 then
    raise exception 'demasiados_envios' using errcode = '54000';
  end if;

  insert into guia_revisiones (guia, revisor, respuestas, token_etiqueta)
  values (p_guia, btrim(p_revisor), p_respuestas, v_etiqueta)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function enviar_revision_guia(text, text, text, jsonb) from public;
grant execute on function enviar_revision_guia(text, text, text, jsonb) to anon, authenticated;

-- Un primer enlace listo para usar. 32 caracteres hexadecimales al azar
-- (gen_random_uuid() es aleatorio criptográfico, y no exige pgcrypto). Se
-- puede desactivar y generar otro desde el panel: Revisión de guías.
insert into revision_tokens (token, etiqueta)
select replace(gen_random_uuid()::text, '-', ''), 'Salón'
where not exists (select 1 from revision_tokens);
