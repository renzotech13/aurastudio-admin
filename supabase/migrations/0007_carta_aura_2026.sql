-- Carta real de Aura Studio — sede Los Olivos (agosto 2026).
--
-- Fuente: el widget de reservas que el negocio ya opera en Yocale
-- (https://www.yocale.com/widget/aura-studio, sede "Aura Studio - Los Olivos",
-- locations=171638). De ahí salen los 79 servicios con su duración y precio
-- reales; no hay nada estimado en este archivo.
--
-- Los nombres se normalizaron a mayúscula inicial y se corrigieron las erratas
-- del catálogo de Yocale ("TRATANIENTO NUTRICION", "UÑAS HUILDER",
-- "LACEADO ITALIANO/DOMINICACO", "FACIAL PREMIUN"...). El nombre tal como
-- aparece en Yocale queda anotado al lado de cada servicio para que el equipo
-- del salón pueda reconciliar ambas listas.
--
-- El catálogo de ejemplo heredado de la plantilla se desactiva en vez de
-- borrarse: las citas ya registradas guardan su servicio_id y deben seguir
-- siendo legibles en el admin.

-- 1. Fuera el catálogo de ejemplo de la plantilla -----------------------------
update services set active = false;
update service_categories set active = false;

-- 2. Categorías reales --------------------------------------------------------
insert into service_categories (id, icon, title, description, sort_order, active) values
  ('cabello', '✂️', 'Cabello', 'Corte, peinado, alisados, laceados, botox capilar y tratamientos reparadores.', 0, true),
  ('color', '🎨', 'Color', 'Raíces, canas, baño de color, balayage, morena iluminada y corrección de color.', 10, true),
  ('manicure', '💅', 'Manicure y uñas', 'Manicure clásica, esmaltado en gel, rubber, builder, esculpidas y diseños.', 20, true),
  ('pies', '🦶', 'Pedicure y pies', 'Pedicura tradicional, gel, francesa, pedi-spa y Pedi Aura Premium.', 30, true),
  ('pestanas', '👁️', 'Pestañas y extensiones', 'Lifting de pestañas y extensiones clásicas, rusas, wispy y tecnológicas.', 40, true),
  ('cejas', '🪶', 'Cejas', 'Laminado, planchado, henna y diseño con color brows.', 50, true),
  ('facial', '🧖', 'Faciales', 'Facial express, facial con aparatología y facial premium.', 60, true),
  ('maquillaje', '💄', 'Maquillaje', 'Maquillaje social, de noche, para graduación y de novias.', 70, true),
  ('depilacion', '🌿', 'Depilación y visajismo', 'Depilación facial y corporal con cera o técnica hindú, y visajismo.', 80, true)
on conflict (id) do update set
  icon = excluded.icon, title = excluded.title, description = excluded.description,
  sort_order = excluded.sort_order, active = true;

-- 3. Servicios ----------------------------------------------------------------
-- booking_group agrupa la carta para el prompt del bot (solo acepta
-- Principales / Complementarios / Opcionales). El modal de la web filtra por
-- category_id, que es lo que la clienta reconoce.
insert into services (id, category_id, booking_group, name, duration, price, description, sort_order, duration_minutes, active) values
  ('acido-girsa-3-meses', 'cabello', 'Principales', 'Ácido Girsa 3 meses', '1 h 30 min', '130', null, 0, 90, true),  -- Yocale: ACIDO GIRSA 3 MESE
  ('alisado-brasileno', 'cabello', 'Principales', 'Alisado brasileño', '2 h', '180', null, 10, 120, true),  -- Yocale: ALISADO BRASILEÑO
  ('alisado-hialuronico', 'cabello', 'Principales', 'Alisado hialurónico', '2 h', '160', null, 20, 120, true),  -- Yocale: ALISADO HIALURONICO
  ('alisado-organico', 'cabello', 'Principales', 'Alisado orgánico', '2 h 30 min', '250', null, 30, 150, true),  -- Yocale: ALISADO ORGANICO
  ('botox-instantaneo', 'cabello', 'Principales', 'Botox instantáneo', '1 h 30 min', '90', null, 40, 90, true),  -- Yocale: BOTOX INTANTANEO
  ('botox-italian-max', 'cabello', 'Principales', 'Botox Italian Max', '1 h 30 min', '120', null, 50, 90, true),  -- Yocale: BOTOX ITALIAN MAX
  ('botox-kerasil', 'cabello', 'Principales', 'Botox Kerasil', '1 h 30 min', '100', null, 60, 90, true),  -- Yocale: BOTOX KERASIL
  ('botox-moda', 'cabello', 'Principales', 'Botox Moda', '1 h 30 min', '80', null, 70, 90, true),  -- Yocale: BOTOX MODA
  ('corte-elaborado-cepillado', 'cabello', 'Principales', 'Corte + elaborado + cepillado', '30 min', '50', null, 80, 30, true),  -- Yocale: CORTE+ ELAVORADO+ CEPILLADO
  ('exfoliacion-capilar', 'cabello', 'Complementarios', 'Exfoliación capilar', '1 h', '80', null, 90, 60, true),  -- Yocale: EXFOLIACION CAPILAR
  ('keratina', 'cabello', 'Principales', 'Keratina', '1 h 30 min', '150', null, 100, 90, true),  -- Yocale: KERATINA
  ('laceado-dual', 'cabello', 'Principales', 'Laceado dual', '4 h', '380', null, 110, 240, true),  -- Yocale: LACEADO DUAL
  ('laceado-italiano-dominicano', 'cabello', 'Principales', 'Laceado italiano / dominicano', '2 h 30 min', '280', null, 120, 150, true),  -- Yocale: LACEADO ITALIANO/DOMINICACO
  ('laceado-japones', 'cabello', 'Principales', 'Laceado japonés', '3 h 30 min', '350', null, 130, 210, true),  -- Yocale: LACEADO JAPONES
  ('lavado-cepillado-ondas-con-tenaza', 'cabello', 'Principales', 'Lavado + cepillado + ondas con tenaza', '1 h', '70', null, 140, 60, true),  -- Yocale: LAVADO+CEPILLADO + ONDAS C/ TENEZA
  ('lavado-cepillado-planchado', 'cabello', 'Principales', 'Lavado + cepillado + planchado', '50 min', '60', null, 150, 50, true),  -- Yocale: LAVADO+CEPILLADO + PLANCHADO
  ('nanoplastia', 'cabello', 'Principales', 'Nanoplastia', '1 h 30 min', '150', null, 160, 90, true),  -- Yocale: NANOPLASTIA
  ('ondulacion-cabello-corto', 'cabello', 'Principales', 'Ondulación cabello corto', '1 h 30 min', '120', null, 170, 90, true),  -- Yocale: ONDULACION C. CORTO
  ('ondulacion-cabello-largo', 'cabello', 'Principales', 'Ondulación cabello largo', '2 h 30 min', '280', null, 180, 150, true),  -- Yocale: ONDULACION C. LARGO
  ('taninoplastia', 'cabello', 'Principales', 'Taninoplastia', '1 h 30 min', '140', null, 190, 90, true),  -- Yocale: TANINOPLASTIA
  ('tratamiento-celulas-madre', 'cabello', 'Principales', 'Tratamiento células madre', '1 h', '120', null, 200, 60, true),  -- Yocale: TRATAMIENTO CELUS MADRE
  ('cirugia-capilar', 'cabello', 'Principales', 'Cirugía capilar', '2 h', '180', null, 210, 120, true),  -- Yocale: TRATAMIENTO CIRUJIA CAPILAR
  ('tratamiento-de-coctel', 'cabello', 'Principales', 'Tratamiento de cóctel', '1 h 30 min', '150', null, 220, 90, true),  -- Yocale: TRATAMIENTO DE COCTEL
  ('tratamiento-de-hidratacion', 'cabello', 'Principales', 'Tratamiento de hidratación', '1 h', '100', null, 230, 60, true),  -- Yocale: TRATAMIENTO DE HIDRATACION
  ('tratamiento-plex-sos', 'cabello', 'Principales', 'Tratamiento Plex SOS', '1 h', '150', null, 240, 60, true),  -- Yocale: TRATAMIENTO PLEX SOS
  ('tratamiento-reconstructivo', 'cabello', 'Principales', 'Tratamiento reconstructivo', '1 h', '100', null, 250, 60, true),  -- Yocale: TRATAMIENTO RECONSTRUCTIVO
  ('shock-de-keratina', 'cabello', 'Principales', 'Shock de keratina', '2 h', '100', null, 260, 120, true),  -- Yocale: TRATAMIENTO SHOCK DE KERATINA
  ('tratamiento-de-nutricion', 'cabello', 'Principales', 'Tratamiento de nutrición', '1 h', '100', null, 270, 60, true),  -- Yocale: TRATANIENTO NUTRICION
  ('balayage', 'color', 'Principales', 'Balayage', '4 h', '350', 'Válido solo hasta la altura del brasier, previa evaluación del colorista.', 0, 240, true),  -- Yocale: BALAYAGE
  ('bano-de-color', 'color', 'Principales', 'Baño de color', '1 h', '150', 'Válido solo hasta la altura del brasier, previa evaluación del colorista.', 10, 60, true),  -- Yocale: BAÑO DE COLOR
  ('correccion-de-color', 'color', 'Principales', 'Corrección de color', '1 h 30 min', '230', 'Válido solo hasta la altura del brasier, previa evaluación del colorista.', 20, 90, true),  -- Yocale: CORRECCION DE COLOR
  ('cubrimiento-de-canas', 'color', 'Principales', 'Cubrimiento de canas', '1 h 30 min', '100', 'Válido solo hasta la altura del brasier, previa evaluación del colorista.', 30, 90, true),  -- Yocale: CUBRIMIENTO DE CANAS
  ('decapage', 'color', 'Principales', 'Decapage', '2 h 30 min', '280', 'Válido solo hasta la altura del brasier, previa evaluación del colorista.', 40, 150, true),  -- Yocale: DECAPAGE
  ('morena-iluminada', 'color', 'Principales', 'Morena iluminada', '4 h', '300', 'Válido solo hasta la altura del brasier, previa evaluación del colorista.', 50, 240, true),  -- Yocale: MORENA ILUMINADA
  ('raices', 'color', 'Principales', 'Raíces', '1 h 30 min', '100', 'Válido solo hasta la altura del brasier, previa evaluación del colorista.', 60, 90, true),  -- Yocale: RAICES
  ('tinte-completo', 'color', 'Principales', 'Tinte completo', '2 h', '180', 'Válido solo hasta la altura del brasier, previa evaluación del colorista.', 70, 120, true),  -- Yocale: TINTE COMPLETO
  ('baby-boomer', 'manicure', 'Principales', 'Baby boomer', '1 h 30 min', '75', null, 0, 90, true),  -- Yocale: BABY BOOMER
  ('baby-color', 'manicure', 'Principales', 'Baby color', '1 h 30 min', '75', null, 10, 90, true),  -- Yocale: BABY COLOR
  ('baby-glitter', 'manicure', 'Principales', 'Baby glitter', '1 h 30 min', '75', null, 20, 90, true),  -- Yocale: BABY GLITER
  ('esmaltado-en-gel', 'manicure', 'Complementarios', 'Esmaltado en gel', '40 min', '30', null, 30, 40, true),  -- Yocale: ESMALTADO EN GEL
  ('unas-hibridas', 'manicure', 'Principales', 'Uñas híbridas', '1 h 30 min', '90', null, 40, 90, true),  -- Yocale: HIBRIDAS
  ('manicure-clasica', 'manicure', 'Principales', 'Manicure clásica', '30 min', '25', null, 50, 30, true),  -- Yocale: MANICURE CLASICA
  ('ojo-de-gato', 'manicure', 'Principales', 'Ojo de gato', '1 h 30 min', '80', null, 60, 90, true),  -- Yocale: OJO DE GATO
  ('unas-esculpidas', 'manicure', 'Principales', 'Uñas esculpidas', '1 h 30 min', '100', null, 70, 90, true),  -- Yocale: SCULPIDAS
  ('unicolor', 'manicure', 'Principales', 'Unicolor', '1 h 30 min', '60', null, 80, 90, true),  -- Yocale: UNICOLOR
  ('unas-builder', 'manicure', 'Principales', 'Uñas builder', '1 h', '65', null, 90, 60, true),  -- Yocale: UÑAS HUILDER
  ('unas-rubber', 'manicure', 'Principales', 'Uñas rubber', '1 h', '50', null, 100, 60, true),  -- Yocale: UÑAS RUBER
  ('pedi-aura-premium', 'pies', 'Principales', 'Pedi Aura Premium', '1 h 15 min', '100', null, 0, 75, true),  -- Yocale: PEDI- AURA PREMIUN
  ('pedi-spa', 'pies', 'Principales', 'Pedi-Spa', '1 h', '80', null, 10, 60, true),  -- Yocale: PEDI- SPA
  ('pedicura-francesa', 'pies', 'Principales', 'Pedicura francesa', '1 h', '60', null, 20, 60, true),  -- Yocale: PEDICURA FRANCESA
  ('pedicura-gel', 'pies', 'Principales', 'Pedicura gel', '1 h', '50', null, 30, 60, true),  -- Yocale: PEDICURA GEL
  ('pedicura-tradicional', 'pies', 'Principales', 'Pedicura tradicional', '40 min', '40', null, 40, 40, true),  -- Yocale: PEDICURA TRADICIONAL
  ('extensiones-aura', 'pestanas', 'Principales', 'Extensiones Aura', '2 h', '120', null, 0, 120, true),  -- Yocale: EXTENSIONES AURA
  ('extensiones-clasicas', 'pestanas', 'Principales', 'Extensiones clásicas', '1 h', '80', null, 10, 60, true),  -- Yocale: EXTENSIONES CLASICAS
  ('extensiones-rimel', 'pestanas', 'Principales', 'Extensiones rímel', '1 h 30 min', '85', null, 20, 90, true),  -- Yocale: EXTENSIONES RIMEL
  ('extensiones-rusas', 'pestanas', 'Principales', 'Extensiones rusas', '2 h', '130', null, 30, 120, true),  -- Yocale: EXTENSIONES RUSA
  ('extensiones-tecnologicas', 'pestanas', 'Principales', 'Extensiones tecnológicas', '2 h', '100', null, 40, 120, true),  -- Yocale: EXTENSIONES TECNOLOGICAS
  ('extensiones-wispy', 'pestanas', 'Principales', 'Extensiones wispy', '2 h', '100', null, 50, 120, true),  -- Yocale: EXTENSIONES WISPY
  ('lifting-de-pestanas-con-botox', 'pestanas', 'Principales', 'Lifting de pestañas con botox', '45 min', '70', null, 60, 45, true),  -- Yocale: LIFTING DE PESTAÑAS C/ BOTOX
  ('lifting-de-pestanas-con-color', 'pestanas', 'Principales', 'Lifting de pestañas con color', '45 min', '70', null, 70, 45, true),  -- Yocale: LIFTING DE PESTAÑAS C/ COLOR
  ('retiro-de-extensiones', 'pestanas', 'Opcionales', 'Retiro de extensiones', '30 min', '20', null, 80, 30, true),  -- Yocale: RETIRO DE EXTENSIONES
  ('cejas-con-henna', 'cejas', 'Complementarios', 'Cejas con henna', '40 min', '40', null, 0, 40, true),  -- Yocale: CEJAS HENNA
  ('diseno-y-color-brows', 'cejas', 'Complementarios', 'Diseño y color brows', '40 min', '50', null, 10, 40, true),  -- Yocale: DISEÑO Y COLOR BROWS
  ('laminado-de-cejas', 'cejas', 'Complementarios', 'Laminado de cejas', '40 min', '40', null, 20, 40, true),  -- Yocale: LAMINADO DE CEJAS
  ('planchado-de-cejas', 'cejas', 'Complementarios', 'Planchado de cejas', '35 min', '40', null, 30, 35, true),  -- Yocale: PLANCHADO DE CEJAS
  ('facial-con-aparatologia', 'facial', 'Principales', 'Facial con aparatología', '1 h 30 min', '80', null, 0, 90, true),  -- Yocale: FACIA C/ APARATOLOGIA
  ('facial-express', 'facial', 'Principales', 'Facial express', '45 min', '40', null, 10, 45, true),  -- Yocale: FACIAL EXPRES
  ('facial-premium', 'facial', 'Principales', 'Facial premium', '1 h 30 min', '120', null, 20, 90, true),  -- Yocale: FACIAL PREMIUN
  ('maquillaje-de-noche', 'maquillaje', 'Principales', 'Maquillaje de noche', '1 h 30 min', '120', null, 0, 90, true),  -- Yocale: MAQUILLAJE DE NOCHE
  ('maquillaje-de-novias', 'maquillaje', 'Principales', 'Maquillaje de novias', '2 h', '300', null, 10, 120, true),  -- Yocale: MAQUILLAJE DE NOVIAS
  ('maquillaje-para-graduacion', 'maquillaje', 'Principales', 'Maquillaje para graduación', '1 h', '100', null, 20, 60, true),  -- Yocale: MAQUILLAJE PARA GRADUACION
  ('maquillaje-social', 'maquillaje', 'Principales', 'Maquillaje social', '1 h', '80', null, 30, 60, true),  -- Yocale: MAQUILLAJE SOCIAL
  ('depilacion-de-bozo-hindu', 'depilacion', 'Complementarios', 'Depilación de bozo (hindú)', '15 min', '10', null, 0, 15, true),  -- Yocale: DEPILACION D/ BOZO-HINDU
  ('depilacion-de-brazo-completo', 'depilacion', 'Complementarios', 'Depilación de brazo completo', '40 min', '90', null, 10, 40, true),  -- Yocale: DEPILACION D/ BRAZO. COMPLETA
  ('depilacion-de-ceja-hindu', 'depilacion', 'Complementarios', 'Depilación de ceja (hindú)', '15 min', '20', null, 20, 15, true),  -- Yocale: DEPILACION D/ CEJA-HINDU
  ('depilacion-de-pierna-completa', 'depilacion', 'Complementarios', 'Depilación de pierna completa', '40 min', '70', null, 30, 40, true),  -- Yocale: DEPILACION D/ PIERNA COMPLETA
  ('depilacion-de-rostro-con-cera', 'depilacion', 'Complementarios', 'Depilación de rostro con cera', '30 min', '50', null, 40, 30, true),  -- Yocale: DEPILACION D/ ROSTRO-CERA
  ('depilacion-de-rostro-hindu', 'depilacion', 'Complementarios', 'Depilación de rostro (hindú)', '30 min', '35', null, 50, 30, true),  -- Yocale: DEPILACION D/ ROSTRO-HINDU
  ('visajismo', 'depilacion', 'Opcionales', 'Visajismo', '15 min', '25', null, 60, 15, true)  -- Yocale: VISAJISMO
on conflict (id) do update set
  category_id = excluded.category_id, booking_group = excluded.booking_group,
  name = excluded.name, duration = excluded.duration, price = excluded.price,
  description = excluded.description, sort_order = excluded.sort_order,
  duration_minutes = excluded.duration_minutes, active = true;
