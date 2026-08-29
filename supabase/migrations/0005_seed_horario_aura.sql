-- Horario de atención de Aura Studio: todos los días de 10:00 a 21:00.
-- Fuente: la ficha de contacto del sitio (aurastudiope.com) y el widget de
-- reservas de Yocale, que coinciden.
--
-- weekday sigue la convención de JS: 0 = domingo … 6 = sábado.

delete from business_hours;

insert into business_hours (weekday, opens_at, closes_at)
values
  (0, '10:00', '21:00'), (1, '10:00', '21:00'), (2, '10:00', '21:00'),
  (3, '10:00', '21:00'), (4, '10:00', '21:00'), (5, '10:00', '21:00'),
  (6, '10:00', '21:00');
