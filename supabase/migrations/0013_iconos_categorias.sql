-- 0013 — Cambia los emoji de service_categories.icon por el nombre del
-- ícono de Lucide que el panel dibuja en su lugar.
--
-- Se ejecuta de una sola vez en el SQL editor. Segura de correr dos veces.
--
-- El panel dejó de mostrar el emoji tal cual (admin/src/pages/Servicios/
-- CategoriesPanel.tsx) y ahora busca la clave en admin/src/lib/
-- categoryIcons.tsx para dibujar el trazo SVG correspondiente. La web
-- (web/assets/js/booking.js) hace exactamente lo mismo con el mismo trazo,
-- copiado a mano del mismo paquete de Lucide para no depender de él en un
-- sitio estático — por eso las claves de abajo tienen que coincidir
-- exactamente con las que booking.js espera.
--
-- Cada clave se eligió comparando el trazo SVG que ya estaba a mano en
-- booking.js contra el path real de cada ícono de Lucide 1.31.0 (no por
-- semántica a ojo): coinciden carácter por carácter.

update service_categories set icon = 'Scissors'   where id = 'cabello';
update service_categories set icon = 'Palette'    where id = 'color';
update service_categories set icon = 'Hand'       where id = 'manicure';
update service_categories set icon = 'Footprints' where id = 'pies';
update service_categories set icon = 'Eye'        where id = 'pestanas';
update service_categories set icon = 'Feather'    where id = 'cejas';
update service_categories set icon = 'Sparkles'   where id = 'facial';
update service_categories set icon = 'Paintbrush' where id = 'maquillaje';
update service_categories set icon = 'Leaf'       where id = 'depilacion';
