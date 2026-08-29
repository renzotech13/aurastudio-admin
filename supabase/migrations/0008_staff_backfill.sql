-- Backfill: promueve la cuenta inicial de staff (creada directo en Supabase,
-- ya que el panel todavía no tiene registro propio) a role='staff'. El
-- trigger on_auth_user_created la crea como 'alumna' por defecto.

update profiles set role = 'staff'
where id = '5b4a80bc-b619-4839-8e7e-27c2480a0ac3';
