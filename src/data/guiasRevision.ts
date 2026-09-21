// Generado a partir de las guías (web/guias/*.html) y de la lista de preguntas de revisión.
// El formulario público y la pantalla del panel leen de acá el TEXTO de cada pregunta.

export type PasoGuia = { titulo: string; parrafos: string[]; tip: string; items: string[]; familias: string[] }
export type TextoGuia = { titulo: string; intro: string; datos: string[]; pasos: PasoGuia[]; lista: string[]; cierre: string; nota: string }
export type GuiaRevision = {
  slug: string
  nombre: string
  publicada: boolean
  quien: string
  preguntas: string[]
  afirmaciones: string[]
  guia: TextoGuia
}

export const GUIAS_REVISION: GuiaRevision[] = [
  {
    "slug": "balayage",
    "nombre": "Balayage",
    "publicada": true,
    "quien": "Colorista",
    "preguntas": [
      "¿Se sigue haciendo válido solo hasta la altura del brasier, previa evaluación? (dato de la carta)"
    ],
    "afirmaciones": [
      "La prueba de las venas de la muñeca (verdosas: tonos cálidos; azuladas o moradas: fríos) como pista, no como regla.",
      "Muchas clientas pasan tres o cuatro meses sin retoque.",
      "Las cuatro etapas de la sesión: diseño de particiones, decoloración progresiva, matiz o baño de color, tratamiento de cierre (del blog de Aura).",
      "El servicio toma unas 4 horas y cuesta S/ 350."
    ],
    "guia": {
      "titulo": "Tu balayage, paso a paso",
      "intro": "Siete pasos para llegar al color que imaginas, sin sorpresas el día de tu cita. Es lo mismo que le pediría tu colorista que tengas claro antes de sentarte.",
      "datos": [
        "4 h de servicio",
        "S/ 350 balayage",
        "3–4 m sin retoque"
      ],
      "pasos": [
        {
          "titulo": "Elige tu referencia",
          "parrafos": [
            "Guarda dos o tres fotos del tono que quieres, mejor con luz natural: la luz del salón y la de tu celular cambian el color que se ve."
          ],
          "tip": "Suma una foto de lo que NO quieres (amarillo, naranja, una línea marcada en la raíz). A tu colorista le sirve tanto como la otra.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Ubica tu punto de partida",
          "parrafos": [
            "Anota tu color actual y todo lo que le has hecho: tintes, decoloraciones, alisados. Con fechas aproximadas."
          ],
          "tip": "Un alisado con formol o una decoloración reciente cambian el camino. Contarlo desde el inicio evita que el resultado te sorprenda.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Escoge tu familia de tono",
          "parrafos": [
            "Casi todos los balayage caen en una de tres familias:"
          ],
          "tip": "Prueba rápida: mira las venas de tu muñeca con luz de día. Si se ven verdosas, suelen favorecerte los cálidos; si se ven azuladas o moradas, los fríos. Es una pista, la decisión final la tomas con tu colorista.",
          "items": [],
          "familias": [
            "Cálidos miel, caramelo",
            "Neutros avellana, beige",
            "Fríos cenizo"
          ]
        },
        {
          "titulo": "Sé realista con cuánto se aclara",
          "parrafos": [
            "El balayage aclara de medios a puntas, y hasta dónde llega depende del estado de tu fibra. Si tu cabello es oscuro o ya tiene tintes, quizá el tono se alcance por etapas."
          ],
          "tip": "Eso lo define la evaluación con la colorista, no una foto. Nuestro balayage es válido hasta la altura del brasier, previa evaluación.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Revisa la salud de tu cabello",
          "parrafos": [
            "La decoloración abre la cutícula, y eso pide una base resistente. Un cabello sano retiene mejor el tono y refleja mejor la luz."
          ],
          "tip": "Si tienes químicos recientes, primero conviene recuperar con un tratamiento de nutrición o reconstrucción y recién después aclarar.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Tu día en el salón",
          "parrafos": [
            "Son unas cuatro horas y no se apuran: cada sección se trabaja por separado. Así se hace:"
          ],
          "tip": "",
          "items": [
            "Diseño de particiones. Se decide dónde va la luz y dónde quedan mechas oscuras para dar profundidad.",
            "Decoloración progresiva. Con oxidantes bajos, lenta y controlada, para cuidar la fibra.",
            "Matiz o baño de color. Neutraliza el cobrizo o el amarillo y deja el tono exacto que buscas.",
            "Tratamiento de cierre. Devuelve la hidratación que se pierde en el proceso."
          ],
          "familias": []
        },
        {
          "titulo": "Cuídalo en casa y planea el retoque",
          "parrafos": [
            "El salón hace la mitad del trabajo; la otra mitad es tu rutina. Como el balayage no deja línea de raíz, muchas clientas pasan tres o cuatro meses sin retocar."
          ],
          "tip": "",
          "items": [
            "Champú sin sulfatos: los sulfatos barren el matiz en pocas semanas.",
            "Mascarilla nutritiva al menos una vez por semana.",
            "Protector térmico si usas plancha o rizador.",
            "Lavados espaciados: cada dos días ayuda a proteger la fibra."
          ],
          "familias": []
        }
      ],
      "lista": [
        "Dos o tres fotos del tono que quieres",
        "Una foto de lo que no quieres",
        "La lista de tus químicos con fechas (tintes, decoloraciones, alisados)",
        "Tiempo libre: el servicio toma unas 4 horas"
      ],
      "cierre": "Reserva tu evaluación de balayage. Cuéntanos qué tono imaginas y te decimos si se logra en una sesión o por etapas.",
      "nota": "Precio y duración según la carta vigente 2026. La colorista confirma el presupuesto final tras evaluar tu cabello."
    }
  },
  {
    "slug": "naranja",
    "nombre": "Se te puso naranja (corrección de color)",
    "publicada": false,
    "quien": "Colorista",
    "preguntas": [
      "El video dice que a veces la corrección toma dos sesiones. La carta trae un solo precio (S/ 230, 1 h 30). ¿La segunda sesión se cobra aparte? ¿Cuánto?",
      "¿Cuándo se necesita una segunda sesión y cuándo alcanza con una?"
    ],
    "afirmaciones": [
      "No taparlo con un tinte oscuro por cuenta propia.",
      "Anotar el producto y el tiempo de aplicación, y fotografiar la etiqueta.",
      "Si la fibra está sensible, se puede llegar al tono por etapas.",
      "No usar matizadores ni tratamientos caseros mientras llega la cita.",
      "Lavar con suavidad y con poco calor hasta la cita.",
      "El naranja aparece porque el cabello oscuro tiene pigmento rojo y anaranjado debajo; echarle otro decolorante encima lo quema."
    ],
    "guia": {
      "titulo": "Se te puso naranja, y no es culpa tuya",
      "intro": "Siete pasos para saber qué hacer, y qué no, antes de venir. Es lo mismo que tu colorista querría que tengas claro antes de sentarte.",
      "datos": [
        "1 h 30 de servicio",
        "S/ 230 precio desde",
        "1–2 sesiones"
      ],
      "pasos": [
        {
          "titulo": "Deja de tocarlo",
          "parrafos": [
            "Si ya te pasó, no lo toques más: ni otra decoloración, ni otro tinte encima, ni un producto más de farmacia. Cada intento nuevo se lo cobra a una fibra que ya trabajó de más."
          ],
          "tip": "Echarle otro decolorante encima no lo arregla: lo quema. Tampoco lo tapes con un tinte oscuro por tu cuenta: cambia tu punto de partida y complica la corrección.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Entiende por qué pasó",
          "parrafos": [
            "El cabello oscuro tiene pigmento rojo y anaranjado por debajo. Al decolorar, ese pigmento sale antes que el amarillo, y el kit de farmacia levanta hasta ahí y se queda."
          ],
          "tip": "No es culpa tuya. Es lo que hace el cabello oscuro cuando se decolora a medias, y hay un camino para salir de ahí.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Recuerda qué le hiciste",
          "parrafos": [
            "Anota qué producto usaste, cuándo, cuánto tiempo lo dejaste y cuál era tu color antes. Suma los tintes, decoloraciones o alisados anteriores, con fechas aproximadas."
          ],
          "tip": "Toma una foto de la caja o de la etiqueta del producto que usaste. Es la pista más útil que le puedes dar a tu colorista.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Toma tus fotos",
          "parrafos": [
            "Fotografía tu cabello hoy, seco y con luz natural: raíz, medios y puntas. Guarda también una foto del tono al que quieres llegar y, si tienes, una de tu color de antes."
          ],
          "tip": "La luz del salón y la de tu celular cambian cómo se ve el naranja. La foto orienta; la evaluación con la colorista decide.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Así se corrige de verdad",
          "parrafos": [
            "La corrección de color se hace al revés de lo que uno piensa: primero se neutraliza el fondo que quedó, y recién después se lleva al tono que querías."
          ],
          "tip": "A veces se hace en dos sesiones. Eso lo define la evaluación, no una foto.",
          "items": [
            "Evaluar tu cabello. La colorista mira cómo quedó tu fibra y de dónde partes.",
            "Neutralizar el fondo. Se trabaja el naranja que quedó antes de buscar el tono nuevo.",
            "Llevar al tono que querías. Recién en este punto se busca el color final."
          ],
          "familias": []
        },
        {
          "titulo": "Sé realista con el tono",
          "parrafos": [
            "El tono final depende de cómo quedó tu fibra y del color con el que partes. Si el cabello está sensible, lo prudente puede ser llegar por etapas y no forzarlo todo en un día."
          ],
          "tip": "Corrección de color: 1 h 30 min, S/ 230. Válido solo hasta la altura del brasier, previa evaluación de la colorista.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Mientras llega tu cita",
          "parrafos": [
            "Hasta tu evaluación, cuida lo que tienes y no pruebes nada nuevo:"
          ],
          "tip": "Si tuviste alguna molestia con los productos, cuéntala en tu evaluación: con la especialista se define cómo seguir.",
          "items": [
            "Lava con suavidad y sin apuro por repetir el lavado.",
            "Champú sin sulfatos: los sulfatos barren el color con más facilidad.",
            "Mascarilla nutritiva una vez por semana.",
            "Poco calor: si usas plancha o secador, con protector térmico.",
            "Nada casero: ni matizadores ni tratamientos para ver si mejora."
          ],
          "familias": []
        }
      ],
      "lista": [
        "Fotos de tu cabello hoy, con luz natural",
        "Una foto del tono al que quieres llegar",
        "El producto o la etiqueta que usaste, con la fecha",
        "Tiempo libre: la corrección toma 1 h 30 min y, a veces, hay una segunda sesión"
      ],
      "cierre": "Reserva tu evaluación de corrección de color. Cuéntanos qué producto usaste y cómo quedó, y la colorista te dice cómo salir de ahí.",
      "nota": "Precio y duración según la carta vigente 2026. La colorista confirma el presupuesto final tras evaluar tu cabello."
    }
  },
  {
    "slug": "laceado",
    "nombre": "Tres laceados (italiano/dominicano, dual, japonés)",
    "publicada": false,
    "quien": "Colorista / estilista",
    "preguntas": [
      "El video dice que el laceado japonés solo va sobre cabello sano. ¿Es una regla del salón? La carta no lo indica.",
      "¿Las tres descripciones son correctas? Italiano/dominicano: ondas suaves, queda liso con movimiento. Dual: cabello mixto o con químicos. Japonés: el liso total, el rizo no regresa."
    ],
    "afirmaciones": [
      "Lo que crece nuevo desde la raíz sale con la textura natural.",
      "Si el cabello está decolorado o muy trabajado, se orienta a otra opción.",
      "Cuidado en casa: shampoo sin sulfatos, dos o tres lavados por semana, protector térmico (tomado del blog de keratina, no de un laceado)."
    ],
    "guia": {
      "titulo": "Tres laceados, elige el tuyo",
      "intro": "Siete pasos para llegar sabiendo cuál de los tres laceados le conviene a tu cabello. La diferencia entre ellos no es el precio, es tu cabello.",
      "datos": [
        "2½–4 h de servicio",
        "S/ 280 precio desde",
        "3 laceados"
      ],
      "pasos": [
        {
          "titulo": "Son tres, y ninguno es mejor",
          "parrafos": [
            "Aura tiene tres laceados y cada uno resuelve un cabello distinto. La diferencia entre ellos no es el precio: es tu cabello."
          ],
          "tip": "No elijas por precio ni por duración. Lo que decide cuál es el tuyo es cómo está y cómo es tu cabello.",
          "items": [
            "Italiano / dominicano: 2 h 30 min, S/ 280.",
            "Japonés: 3 h 30 min, S/ 350.",
            "Dual: 4 h, S/ 380."
          ],
          "familias": []
        },
        {
          "titulo": "Conoce tu cabello natural",
          "parrafos": [
            "Antes de elegir, fíjate cómo es tu cabello al natural, sin plancha ni secador: liso, con ondas suaves, rizado o una mezcla. Es lo primero que mira tu colorista."
          ],
          "tip": "Déjalo secar al aire un día y tómale una foto. Así se ve tu textura real.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Cuenta lo que le hiciste",
          "parrafos": [
            "Anota los químicos que ha tenido tu cabello: tintes, decoloraciones, alisados o laceados anteriores, con fechas aproximadas. Un cabello que ya pasó por químicos tiene un camino distinto al de uno que no."
          ],
          "tip": "Si tu cabello es mixto o ya pasó por químicos, cuéntalo desde el inicio: es la pista que más orienta hacia el laceado dual.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Italiano o dominicano: liso con movimiento",
          "parrafos": [
            "Es para cabello con ondas suaves que quieres más manejable. Queda liso, pero con movimiento."
          ],
          "tip": "2 h 30 min, S/ 280. Si lo que buscas es un liso total, sigue leyendo: puede que el tuyo sea otro.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Dual: dos sistemas en uno",
          "parrafos": [
            "Combina dos sistemas y es para cabello mixto o que ya pasó por químicos."
          ],
          "tip": "4 h, S/ 380. Es el laceado más largo de la carta: resérvale el día con calma.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Japonés: el liso de verdad",
          "parrafos": [
            "Reestructura el cabello y el rizo no regresa, por eso solo va sobre cabello sano. Lo que crece nuevo desde la raíz sale con tu textura natural."
          ],
          "tip": "3 h 30 min, S/ 350. Si tu cabello está decolorado o muy trabajado, la colorista lo dirá en la evaluación y te orientará a otra opción.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Llega lista a tu evaluación",
          "parrafos": [
            "Con lo anterior ya sabes hacia cuál inclinarte. La elección final la haces con tu colorista, viendo tu cabello. Y para cuidarlo después:"
          ],
          "tip": "La colorista te da las indicaciones exactas del laceado que te hagan, y esas mandan sobre cualquier consejo general.",
          "items": [
            "Champú sin sulfatos: limpia sin barrer lo que el salón dejó en tu cabello.",
            "Lavados espaciados: de dos a tres por semana suele bastar.",
            "Protector térmico si usas secador o plancha."
          ],
          "familias": []
        }
      ],
      "lista": [
        "Una foto de tu cabello natural, sin plancha",
        "La lista de tus químicos con fechas (tintes, decoloraciones, alisados)",
        "Una idea clara del liso que quieres: con movimiento o liso total",
        "Tiempo libre: según el laceado, de 2 h 30 min a 4 h"
      ],
      "cierre": "Reserva tu evaluación de laceado. Cuéntanos cómo es tu cabello y qué le has hecho, y te decimos cuál de los tres es el tuyo.",
      "nota": "Precio y duración según la carta vigente 2026. La colorista confirma el presupuesto final tras evaluar tu cabello."
    }
  },
  {
    "slug": "botox",
    "nombre": "Botox capilar (no alisa)",
    "publicada": false,
    "quien": "Colorista / estilista",
    "preguntas": [
      "El video habla de cuatro versiones según el daño. ¿Cuál va con qué nivel de daño? Botox Moda (S/ 80), Instantáneo (S/ 90), Kerasil (S/ 100), Italian Max (S/ 120).",
      "¿Cuánto dura el efecto, más o menos?"
    ],
    "afirmaciones": [
      "La decoloración y la plancha como causas de una fibra hueca (viene del video).",
      "Ubicar el desgaste en puntas, medios o todo el largo para decidir la versión.",
      "Cuánto dura el efecto depende del cabello y del cuidado.",
      "Cuidado en casa (sin sulfatos, mascarilla, protector térmico), tomado del blog de keratina."
    ],
    "guia": {
      "titulo": "Botox capilar, no alisa, y está bien",
      "intro": "Siete pasos para saber si el botox es lo que buscas y llegar sabiendo qué esperar. Trabaja el relleno de la fibra, no la forma del cabello.",
      "datos": [
        "1 h 30 de servicio",
        "S/ 80 precio desde",
        "4 versiones"
      ],
      "pasos": [
        {
          "titulo": "El botox capilar no alisa",
          "parrafos": [
            "Casi todas lo piden pensando que alisa, y no. La keratina y los alisados trabajan la forma: te quitan el rizo. El botox trabaja el relleno."
          ],
          "tip": "Que no alise no es un defecto: es justamente lo que lo hace distinto.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Qué hace por tu fibra",
          "parrafos": [
            "Entra en las zonas donde la fibra quedó hueca, por decoloración o plancha, y las rellena. El resultado es un cabello más pesado, más brillante y con menos frizz."
          ],
          "tip": "Tu rizo sigue ahí, pero más definido.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Decide qué buscas",
          "parrafos": [
            "Si lo que quieres es cabello lacio, el botox no es tu servicio: te va a quedar lindo, pero puedes irte decepcionada. Si buscas brillo, peso, menos frizz y rizo definido, sí va contigo."
          ],
          "tip": "Si quieres lacio, dilo desde el inicio. En la carta hay alisados, keratina y laceados pensados para eso.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Ubica dónde está tu daño",
          "parrafos": [
            "Piensa en tus decoloraciones y en la plancha: son las dos causas que este tratamiento viene a rellenar. Fíjate si el desgaste está solo en las puntas, en los medios o en todo el largo."
          ],
          "tip": "Anota cuántas veces has decolorado y cada cuánto planchas. Con eso la colorista dimensiona tu caso.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Elige tu versión: son cuatro",
          "parrafos": [
            "Hay cuatro versiones, según el daño de tu cabello. Todas duran 1 h 30 min:"
          ],
          "tip": "No elijas por precio. Cuál va con tu cabello lo define la colorista en la evaluación.",
          "items": [
            "Botox Moda: S/ 80.",
            "Botox instantáneo: S/ 90.",
            "Botox Kerasil: S/ 100.",
            "Botox Italian Max: S/ 120."
          ],
          "familias": []
        },
        {
          "titulo": "Ajusta tus expectativas",
          "parrafos": [
            "Al salir vas a notar más peso, más brillo y menos frizz; tu rizo o tus ondas siguen, con más definición. Cuánto dura el efecto depende de tu cabello y de cómo lo cuides."
          ],
          "tip": "Lleva una foto de cómo quieres que se vea tu cabello al salir: brillo, definición, peso. Así hablan el mismo idioma.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Cuídalo en casa",
          "parrafos": [
            "El salón hace una parte; la otra es tu rutina:"
          ],
          "tip": "La colorista te indica los cuidados de la versión que te apliquen.",
          "items": [
            "Champú sin sulfatos: limpia sin arrastrar el tratamiento.",
            "Lavados espaciados: de dos a tres por semana suele bastar.",
            "Mascarilla nutritiva una vez por semana.",
            "Protector térmico si usas plancha o secador."
          ],
          "familias": []
        }
      ],
      "lista": [
        "Una foto de tu cabello natural",
        "La lista de decoloraciones, plancha y alisados con fechas",
        "Claro si quieres cabello lacio o rizo definido",
        "Tiempo libre: el servicio toma 1 h 30 min"
      ],
      "cierre": "Reserva tu evaluación de botox capilar. Cuéntanos cómo está tu cabello y qué esperas, y te decimos cuál de las cuatro versiones va contigo.",
      "nota": "Precio y duración según la carta vigente 2026. La colorista confirma el presupuesto final tras evaluar tu cabello."
    }
  },
  {
    "slug": "pestanas",
    "nombre": "Extensiones de pestañas (clásicas, rusas, wispy)",
    "publicada": false,
    "quien": "Especialista en pestañas",
    "preguntas": [
      "¿Cada cuánto se suele hacer el retoque? (la guía no da plazos a propósito)",
      "¿Qué se recomienda hacer y no hacer en los días siguientes a la cita?"
    ],
    "afirmaciones": [
      "Llegar con una foto sin rímel y con la mirada hacia abajo.",
      "Las etapas del día: evaluación, elección del efecto, aplicación con los ojos cerrados, indicaciones.",
      "No tirar, frotar ni arrancar las extensiones.",
      "El retiro se hace en el salón (S/ 20 en la carta).",
      "El retoque depende del crecimiento de cada pestaña."
    ],
    "guia": {
      "titulo": "Tus pestañas, paso a paso",
      "intro": "Clásicas, rusas o wispy: la diferencia no es cuánto duran, sino cuál va con la pestaña que tú tienes. Siete pasos para elegir bien y llegar a tu cita sabiendo qué pedir.",
      "datos": [
        "1–2 h de servicio",
        "S/ 80 desde, clásicas",
        "S/ 20 retiro de extensiones"
      ],
      "pasos": [
        {
          "titulo": "Mira tu pestaña natural",
          "parrafos": [
            "Todo parte de ahí: cuánta pestaña tienes. Frente a un espejo, con buena luz, fíjate si tu pestaña es poblada, si tiene huecos o si es escasa."
          ],
          "tip": "Tómale una foto sin rímel y con la mirada hacia abajo. Es la mejor manera de mostrarle a tu especialista tu punto de partida.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Define el efecto que buscas",
          "parrafos": [
            "Piensa en la palabra que más se parece a lo que quieres: natural y llena, con volumen de verdad, o un efecto despeinado y ligero. Guarda dos o tres fotos de referencia."
          ],
          "tip": "Una foto vale más que una descripción: lo que tú llamas natural, otra persona puede llamarlo dramático.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Conoce las tres opciones",
          "parrafos": [
            "Cada una trabaja la pestaña de una manera distinta:"
          ],
          "tip": "Clásicas: se ven naturales y llenas si tu pestaña es poblada. Rusas: dan volumen de verdad si tienes poca. Wispy: dejan huecos a propósito para ese efecto despeinado.",
          "items": [],
          "familias": [
            "Clási­cas una extensión por cada pestaña · S/ 80 · 1 h",
            "Rusas abanicos finos sobre una pestaña · S/ 130 · 2 h",
            "Wispy largos mezclados, con huecos · S/ 100 · 2 h"
          ]
        },
        {
          "titulo": "Cuál te toca según tu base",
          "parrafos": [
            "Si tu pestaña es poblada y quieres verte natural, van las clásicas. Si tienes poca y quieres volumen, van las rusas. Si te gusta el efecto despeinado, van las wispy."
          ],
          "tip": "Si tu pestaña es escasa, las clásicas pueden decepcionarte. No es el trabajo: es la base. Por eso la misma técnica se ve distinta en cada persona.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Cuéntale tu salud y tu comodidad",
          "parrafos": [
            "Las extensiones se aplican muy cerca de tus ojos. Si tienes alergias, sensibilidad ocular, alguna molestia o estás embarazada, dilo antes de reservar."
          ],
          "tip": "Eso se define en la evaluación con la especialista, no en una guía. Ella decide contigo qué es lo más adecuado.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Tu día en el salón",
          "parrafos": [
            "Las clásicas toman alrededor de 1 h; las rusas y las wispy, unas 2 h. Es un trabajo detallado, así que ve sin apuro. Así suele ser:"
          ],
          "tip": "",
          "items": [
            "Evaluación. Se mira tu pestaña natural y se confirma cuál opción te conviene.",
            "Elección del efecto. Ajustan el largo y el estilo contigo, según tus fotos.",
            "Aplicación. Se trabaja con los ojos cerrados y con calma, pestaña por pestaña.",
            "Indicaciones. Te explican cómo cuidarlas al salir."
          ],
          "familias": []
        },
        {
          "titulo": "Cuídalas y planea el retiro",
          "parrafos": [
            "Tus extensiones son delicadas: no las tires, no las frotes y no te las arranques. Cuando quieras quitártelas, hazlo en el salón: el retiro de extensiones toma 30 min y cuesta S/ 20."
          ],
          "tip": "Pregúntale a tu especialista cada cuánto conviene retocar en tu caso: depende de tu pestaña natural y de su ritmo de crecimiento.",
          "items": [],
          "familias": []
        }
      ],
      "lista": [
        "Una foto de tu pestaña natural, sin rímel",
        "Dos o tres fotos del efecto que quieres",
        "Lo que debas contarle sobre tus ojos: alergias, sensibilidad o molestias",
        "Tiempo libre: 1 h para clásicas, unas 2 h para rusas o wispy"
      ],
      "cierre": "Reserva tu evaluación de pestañas. Cuéntanos qué efecto imaginas y te decimos cuál de las tres te toca según tu pestaña.",
      "nota": "Precios y duraciones según la carta vigente 2026. La especialista confirma el servicio y el presupuesto final tras evaluarte."
    }
  },
  {
    "slug": "cejas",
    "nombre": "Laminado o henna de cejas",
    "publicada": false,
    "quien": "Especialista en cejas",
    "preguntas": [
      "¿Hacer laminado y henna en la misma cita tiene precio o tiempo combinado? (el video dice que se pueden hacer las dos)",
      "¿Cuánto dura cada uno de forma realista? La guía dice solo 'semanas' para el laminado."
    ],
    "afirmaciones": [
      "El laminado no rellena huecos; ordena el pelo que ya hay.",
      "La henna da más densidad de color y tiñe un poco la piel.",
      "La henna se desvanece; el laminado dura semanas.",
      "El visajismo estudia la forma que va con el rostro.",
      "Las etapas de la cita.",
      "Avisar al reservar si se quieren las dos."
    ],
    "guia": {
      "titulo": "Tus cejas, paso a paso",
      "intro": "Laminado o henna: no son lo mismo ni sirven para la misma ceja. Siete pasos para saber cuál es la tuya y llegar a tu cita sabiendo qué pedir.",
      "datos": [
        "40 min cada servicio",
        "S/ 40 laminado o henna",
        "1 cita para hacer las dos"
      ],
      "pasos": [
        {
          "titulo": "Mira tu ceja sin maquillar",
          "parrafos": [
            "Antes de elegir, mírala tal cual es: ¿tienes pelo pero te crece caído o para todos lados? ¿O tienes espacios vacíos? Esa respuesta decide casi todo."
          ],
          "tip": "Tómale una foto sin lápiz ni gel, de frente y con luz de día. A tu especialista le sirve mucho verla al natural.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Conoce el laminado",
          "parrafos": [
            "El laminado trabaja el pelo que ya tienes: lo levanta, lo peina hacia arriba y lo fija así por semanas. Toma 40 min y cuesta S/ 40."
          ],
          "tip": "Sirve si tienes pelo, pero te crece caído o desordenado. Si tienes huecos, el laminado no los rellena.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Conoce la henna",
          "parrafos": [
            "La henna trabaja el color: pinta el pelo y también tiñe un poco la piel debajo, por eso rellena huecos y la ceja se ve más tupida. Toma 40 min y cuesta S/ 40."
          ],
          "tip": "Sirve si tienes espacios vacíos o quieres más densidad de color.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Cuál es para tu ceja",
          "parrafos": [
            "Resumen rápido, según cómo es tu ceja:"
          ],
          "tip": "Si es todo junto, se pueden hacer las dos en la misma cita. Al reservar, avísanos que quieres ambas.",
          "items": [],
          "familias": [
            "Laminado poblada pero desordenada",
            "Henna con espacios vacíos",
            "Las dos desorden y huecos a la vez"
          ]
        },
        {
          "titulo": "Piensa también en la forma",
          "parrafos": [
            "El laminado y la henna trabajan la textura y el color; la forma es otro tema. Si quieres redefinirla, en la carta tienes el diseño y color brows (40 min, S/ 50) y el visajismo (15 min, S/ 25), que estudia qué forma va mejor con tu rostro."
          ],
          "tip": "Lleva una foto de la ceja que te gusta, pero recuerda que tu especialista la adapta a tu rostro, no la copia igual.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Piel y salud, primero",
          "parrafos": [
            "La henna tiñe la piel y el laminado usa productos sobre el pelo y la piel de la zona. Si tienes piel sensible, alergias, alguna condición en la piel o estás embarazada, avísalo antes."
          ],
          "tip": "Eso se define en la evaluación con la especialista, no en una guía ni en una foto.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Tu día en el salón y después",
          "parrafos": [
            "Cada servicio toma unos 40 min. Así suele ser la cita:"
          ],
          "tip": "Ninguno es para siempre: el laminado dura semanas y la henna se va desvaneciendo. Pregunta cuándo conviene volver a hacerlo en tu caso.",
          "items": [
            "Evaluación. Se mira tu ceja y se decide si va laminado, henna o ambas.",
            "Servicio. Se hace el que elegiste, con calma y atención al detalle.",
            "Indicaciones. Te explican los cuidados para los primeros días."
          ],
          "familias": []
        }
      ],
      "lista": [
        "Una foto de tu ceja sin maquillar",
        "Una foto de la ceja que te gusta",
        "Lo que debas contarle sobre tu piel: alergias o sensibilidad",
        "Tiempo libre: 40 min por cada servicio"
      ],
      "cierre": "Reserva tu evaluación de cejas. Cuéntanos cómo es tu ceja y te decimos si te toca laminado, henna o las dos.",
      "nota": "Precios y duraciones según la carta vigente 2026. La especialista confirma el servicio y el presupuesto final tras evaluarte."
    }
  },
  {
    "slug": "unas",
    "nombre": "Uñas rubber, builder o esculpidas",
    "publicada": false,
    "quien": "Manicurista",
    "preguntas": [
      "¿El precio de rubber (S/ 50) y de builder (S/ 65) incluye color? En la carta 'Unicolor' aparece aparte (S/ 60).",
      "¿Cuál de las tres dura más? El video prometía 'cuál te aguanta más' y no se responde; la guía tampoco da una ganadora."
    ],
    "afirmaciones": [
      "La rubber protege la uña natural y deja que crezca.",
      "La builder corrige la forma y sostiene un largo moderado.",
      "El largo lo sostiene la base: cuanto más largo, más base necesita.",
      "Color y diseño se consultan al reservar.",
      "No despegarse ni morderse las uñas.",
      "Las etapas de la cita."
    ],
    "guia": {
      "titulo": "Tus uñas, paso a paso",
      "intro": "Rubber, builder y esculpidas se ven parecidas en una foto, pero no son lo mismo. Siete pasos para elegir la tuya y llegar a tu cita sabiendo qué pedir.",
      "datos": [
        "1–1,5 h de servicio",
        "S/ 50 desde, rubber",
        "S/ 100 esculpidas"
      ],
      "pasos": [
        {
          "titulo": "Mira tu uña natural",
          "parrafos": [
            "Revisa el largo que tienes hoy y cómo se comporta tu uña: si se te quiebra, si se dobla o si la tienes muy corta. Es tu base, y de ella depende qué te conviene."
          ],
          "tip": "Tómale una foto a tus manos sin esmalte. Tu especialista ve ahí mucho más que en una descripción.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Decide el largo que quieres",
          "parrafos": [
            "Piensa si buscas una uña corta y resistente, un largo moderado o un largo llamativo. Guarda dos o tres fotos de referencia."
          ],
          "tip": "Ojo con el largo: cuanto más largo lo quieres, más base necesita.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Conoce las tres opciones",
          "parrafos": [
            "Cada una trabaja la uña de manera distinta:"
          ],
          "tip": "",
          "items": [],
          "familias": [
            "Rubber capa flexible sobre tu uña · S/ 50 · 1 h",
            "Builder gel más denso que corrige la forma · S/ 65 · 1 h",
            "Escul­pidas se construyen sobre un molde · S/ 100 · 1 h 30"
          ]
        },
        {
          "titulo": "Cuál te aguanta más",
          "parrafos": [
            "No hay una ganadora para todas: la que mejor te aguanta es la que va con tu uña y con tu largo. La rubber protege tu uña natural y la deja crecer; la builder sostiene un largo moderado; en las esculpidas el largo lo decides tú."
          ],
          "tip": "Cuánto te dura depende de tu uña, tu largo y tu día a día. Tu especialista te dice qué esperar en tu caso.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Cuál te conviene",
          "parrafos": [
            "Si tu uña se quiebra pero ya tiene largo, la rubber es ideal. Si además quieres corregir la forma y sostener un largo moderado, la builder. Si quieres más largo, o casi no tienes uña, las esculpidas."
          ],
          "tip": "La decisión final la toma tu especialista al ver tu uña. Lleva tus fotos y dile lo que buscas.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Tu uña natural y su cuidado",
          "parrafos": [
            "Ninguna daña la uña si se retira bien: lo que la daña es arrancártela en casa. Si tienes una uña lastimada, con molestia o alguna condición, dilo antes de reservar."
          ],
          "tip": "No las despegues ni las muerdas. Cuando quieras cambiarlas, ven al salón. Si algo te preocupa de tu uña, se define en la evaluación con la especialista.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Tu día en el salón y después",
          "parrafos": [
            "La rubber y la builder toman alrededor de 1 h; las esculpidas, 1 h 30. Así suele ser la cita:"
          ],
          "tip": "Si además quieres color o diseño, pregúntalo al reservar para confirmar el tiempo y el precio.",
          "items": [
            "Evaluación. Se mira tu uña y se confirma la opción que te conviene.",
            "Aplicación. Se trabaja sobre tu uña natural o sobre molde, según la que elijas.",
            "Forma y largo. Se deja como en tus fotos, dentro de lo que tu uña sostenga."
          ],
          "familias": []
        }
      ],
      "lista": [
        "Una foto de tus manos, sin esmalte",
        "Dos o tres fotos del largo y la forma que quieres",
        "Lo que debas contarle sobre tus uñas: molestias o lesiones",
        "Tiempo libre: 1 h para rubber o builder, 1 h 30 para esculpidas"
      ],
      "cierre": "Reserva tu evaluación de uñas. Cuéntanos qué largo imaginas y te decimos cuál te conviene según tu uña.",
      "nota": "Precios y duraciones según la carta vigente 2026. La especialista confirma el servicio y el presupuesto final tras evaluarte."
    }
  },
  {
    "slug": "piel",
    "nombre": "Facial con aparatología (cuidar tu piel)",
    "publicada": false,
    "quien": "Esteticista",
    "preguntas": [
      "La carta tiene tres faciales: Express (S/ 40, 45 min), con aparatología (S/ 80, 1 h 30) y Premium (S/ 120, 1 h 30). ¿Qué incluye cada uno? La guía solo da precio y duración.",
      "¿Cuál de ellos lleva ultrasonido, alta frecuencia y succión?"
    ],
    "afirmaciones": [
      "Venir sin maquillaje si se puede; si no, se retira al empezar.",
      "El ultrasonido ayuda a que el activo llegue a la capa donde trabaja.",
      "La alta frecuencia seca un brote y desinflama.",
      "La succión limpia el punto negro sin apretar con los dedos.",
      "La rutina de casa no se reemplaza: se potencia."
    ],
    "guia": {
      "titulo": "Tu piel, paso a paso",
      "intro": "Siete pasos para entender por qué la crema sola no llega a todas partes, qué hace la aparatología y cómo cuidar tu piel entre cita y cita. Es lo que te pediríamos que tengas claro antes de sentarte en cabina.",
      "datos": [
        "1 h 30 de servicio",
        "S/ 80 facial",
        "3 técnicas"
      ],
      "pasos": [
        {
          "titulo": "Tu crema no está fallando",
          "parrafos": [
            "La piel está hecha para funcionar como una barrera: deja pasar muy poco. Por eso lo que te pones en casa trabaja sobre todo en la superficie. No es culpa de tu crema, y tu piel tampoco está mal."
          ],
          "tip": "Tu rutina de casa se queda. La cabina no la reemplaza: la potencia.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Conoce la otra vía",
          "parrafos": [
            "La aparatología le da a tu piel un camino distinto. En el facial trabajamos con tres técnicas:"
          ],
          "tip": "Cuáles se usan en tu caso las define la especialista al evaluar tu piel. No todas las pieles necesitan lo mismo.",
          "items": [
            "Ultrasonido: abre paso para que el activo llegue a la capa donde sí trabaja.",
            "Alta frecuencia: se usa para secar un brote y desinflamar.",
            "Succión: saca el punto negro sin apretarte la cara con los dedos."
          ],
          "familias": []
        },
        {
          "titulo": "Cuenta cómo está tu piel hoy",
          "parrafos": [
            "Antes de tu cita, piensa cómo la sientes en el día a día y qué te gustaría mejorar. Dilo con tus palabras: no hace falta usar términos técnicos."
          ],
          "tip": "Si tienes alguna condición de la piel, alergias, sensibilidad, estás embarazada o sigues un tratamiento con tu médico, cuéntalo en la evaluación. Eso lo define la especialista contigo; una guía no puede decidirlo.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Anota tu rutina de casa",
          "parrafos": [
            "Qué productos usas en la mañana y en la noche, y desde cuándo. Puedes llevar una foto de cada etiqueta en tu celular."
          ],
          "tip": "Sirve para ver qué ya estás usando y qué conversar con la especialista. No hace falta llevar los frascos.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Tu día en cabina",
          "parrafos": [
            "Son hora y media y no se apuran. La especialista evalúa tu piel y decide contigo qué técnicas usar."
          ],
          "tip": "Llega unos minutos antes, con calma, y si puedes sin maquillaje. Si vienes con maquillaje no pasa nada: se retira al empezar.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Elige tu facial",
          "parrafos": [
            "La carta tiene tres opciones. Si dudas cuál te conviene, pregúntalo al reservar."
          ],
          "tip": "La guía habla del facial con aparatología. Para saber qué incluye cada opción, consulta con nosotras antes de reservar.",
          "items": [
            "Facial express: 45 min, S/ 40.",
            "Facial con aparatología: 1 h 30 min, S/ 80.",
            "Facial premium: 1 h 30 min, S/ 120."
          ],
          "familias": []
        },
        {
          "titulo": "Después, cuida tu piel en casa",
          "parrafos": [
            "Cada piel responde distinto, por eso no prometemos el mismo resultado para todas. Los cuidados de los días siguientes te los indica la especialista según tu piel."
          ],
          "tip": "Cabina y casa se complementan. Lo que haces cada día sigue importando: la cita potencia tu rutina, no la sustituye.",
          "items": [],
          "familias": []
        }
      ],
      "lista": [
        "Los productos que usas en casa, mañana y noche (basta con fotos de las etiquetas)",
        "Lo que te gustaría mejorar en tu piel, con tus palabras",
        "Lo que debe saber la especialista: alergias, sensibilidad, embarazo o tratamientos en curso",
        "Tiempo libre: el facial toma hora y media"
      ],
      "cierre": "Reserva tu facial con aparatología. Cuéntanos qué te gustaría cuidar de tu piel y te orientamos con la opción de la carta que más te conviene.",
      "nota": "Precio y duración según la carta vigente 2026. La especialista confirma qué técnicas usar tras evaluar tu piel."
    }
  },
  {
    "slug": "novia",
    "nombre": "Prueba de maquillaje de novia",
    "publicada": false,
    "quien": "Maquilladora",
    "preguntas": [
      "¿Cuánto cuesta y cuánto dura la prueba? La carta solo trae el maquillaje de novias (S/ 300, 2 h), no la prueba.",
      "¿En la prueba también se prueba el peinado con el velo puesto, como dice el video?"
    ],
    "afirmaciones": [
      "La prueba mide cuánto dura la base y si el tono se oxida (se pone más naranja) con las horas.",
      "También se ve cómo sale el maquillaje en foto con flash.",
      "El velo cambia el peso, la caída y la forma del peinado; llevar uno parecido si aún no lo tiene.",
      "La hora de la boda influye en el maquillaje.",
      "Llevar foto del vestido y del escote."
    ],
    "guia": {
      "titulo": "Tu prueba de novia, paso a paso",
      "intro": "Siete pasos para definir tu maquillaje antes de la prueba y saber qué se evalúa en ella. La prueba no es un lujo: es lo que te permite llegar al gran día sin sorpresas.",
      "datos": [
        "2 h el día de tu boda",
        "S/ 300 maquillaje de novia",
        "3 cosas que medimos"
      ],
      "pasos": [
        {
          "titulo": "Entiende para qué sirve la prueba",
          "parrafos": [
            "No es para ver si te queda lindo: es para ver cómo se comporta el maquillaje sobre tu piel, durante horas."
          ],
          "tip": "La novia que llega sin prueba no se ve mal: se pasa el día retocándose.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Esto es lo que medimos",
          "parrafos": [
            "En la prueba evaluamos tres cosas que una foto de referencia no te muestra. Que el tono se oxide significa que se pone más naranja con las horas."
          ],
          "tip": "El flash cambia todo. Por eso conviene mirar cómo sales con flash y también a la luz del día.",
          "items": [],
          "familias": [
            "Base cuánto dura",
            "Tono si se oxida",
            "Flash cómo sales en la foto"
          ]
        },
        {
          "titulo": "Prueba el peinado con el velo puesto",
          "parrafos": [
            "El velo lo cambia todo: peso, caída y hasta la forma en que se ve el peinado. Por eso también lo probamos con el velo puesto."
          ],
          "tip": "Lleva tu velo o tocado, o uno parecido, si aún no lo tienes.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Define tu estilo",
          "parrafos": [
            "Lo que te gusta en una foto no siempre es lo que te favorece. La prueba sirve para elegir el estilo mirándote a ti, no a la modelo."
          ],
          "tip": "Reúne tres fotos de maquillajes que te gustan y una de lo que no quieres (muy cargado, muy pálido, muy brillante). Con eso empezamos a conversar.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Piensa en tu vestido y tu ceremonia",
          "parrafos": [
            "Tu vestido, el escote, las joyas y la hora de la ceremonia influyen en el maquillaje. No es igual una boda de día que una de noche."
          ],
          "tip": "Si tienes una foto de tu vestido, llévala. Ayuda a ver los colores y el escote junto al maquillaje.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Cuenta lo que tu piel necesita",
          "parrafos": [
            "Si tienes alergias o sensibilidad, o hay productos que no te sientan bien, dilo desde el inicio."
          ],
          "tip": "Eso se define en la prueba con la maquilladora, no antes por mensaje ni con una guía. Mejor conversarlo con tiempo antes de tu boda.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Lleva los ajustes al gran día",
          "parrafos": [
            "Al terminar, revisa cómo quedaste y anota qué cambiarías: más cobertura, otro tono de labios, otro peinado. Así el día de tu boda no se improvisa nada."
          ],
          "tip": "Toma fotos de tu prueba con flash y con luz de día, y revísalas en casa con calma antes de confirmar.",
          "items": [],
          "familias": []
        }
      ],
      "lista": [
        "Tres fotos de maquillajes que te gustan y una de lo que no quieres",
        "Una foto de tu vestido, sobre todo del escote",
        "Tu velo o tocado, si ya lo tienes",
        "La fecha, la hora y el lugar de tu boda"
      ],
      "cierre": "Reserva tu prueba de maquillaje. Cuéntanos la fecha de tu boda y el estilo que imaginas, y te confirmamos horarios y detalles de la prueba.",
      "nota": "El maquillaje de novia figura en la carta vigente 2026 con 2 h y S/ 300. El precio y la duración de la prueba te los confirmamos por WhatsApp."
    }
  },
  {
    "slug": "morena",
    "nombre": "Morena iluminada",
    "publicada": false,
    "quien": "Colorista",
    "preguntas": [
      "¿Cuántos tonos se aclara como máximo y en cuántas sesiones se logra? (la guía no lo asegura)"
    ],
    "afirmaciones": [
      "Las luces van alrededor del rostro y en las puntas, dentro de la misma familia de color.",
      "Tonos: café (suave), miel (cálido), chocolate (profundo).",
      "Llegar con una foto del cabello actual, sin filtros, y evitar referencias de cabello rubio.",
      "Como no se aclara tanto, el cabello sufre menos que en un rubio.",
      "Cuidado en casa (sin sulfatos, mascarilla, protector térmico), tomado del blog de balayage.",
      "Son 4 horas y S/ 300."
    ],
    "guia": {
      "titulo": "Tu morena iluminada, paso a paso",
      "intro": "Siete pasos para pedir luz sin dejar de ser morena y llegar con las fotos correctas. Es lo mismo que le pediría tu colorista que tengas claro antes de sentarte.",
      "datos": [
        "4 h de servicio",
        "S/ 300 morena iluminada",
        "3 tonos"
      ],
      "pasos": [
        {
          "titulo": "Entiende qué es una morena iluminada",
          "parrafos": [
            "Es para la que quiere luz, pero no quiere dejar de ser morena. En vez de aclarar todo el cabello, se colocan luces finas alrededor del rostro y en las puntas."
          ],
          "tip": "Luz sin volverte rubia: tu color base se queda como es.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Escoge tu tono",
          "parrafos": [
            "Los tonos van en café, miel o chocolate, siempre dentro de tu misma familia de color:"
          ],
          "tip": "Elige el que más se parezca a tu color de base. La decisión final la tomas con tu colorista.",
          "items": [
            "Café: luz suave, cerca de tu color natural.",
            "Miel: luz más cálida y luminosa.",
            "Chocolate: luz profunda, para quedarte en tonos oscuros."
          ],
          "familias": []
        },
        {
          "titulo": "Lleva las fotos correctas",
          "parrafos": [
            "Guarda dos o tres fotos de la luz que quieres, mejor con luz natural: la luz del salón y la de tu celular cambian el color que se ve."
          ],
          "tip": "Busca referencias con una base parecida a la tuya. Una foto sobre cabello rubio no muestra lo que pasará sobre uno moreno.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Una foto de tu cabello de hoy",
          "parrafos": [
            "Toma una foto de tu cabello tal como está, con luz natural y sin filtros. Sirve para que la colorista vea de dónde partimos."
          ],
          "tip": "Suma una foto de lo que NO quieres (rubio muy claro, mechas marcadas, una línea visible). A tu colorista le sirve tanto como la otra.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Cuenta lo que le has hecho a tu cabello",
          "parrafos": [
            "Anota tintes, decoloraciones, alisados y otros químicos, con fechas aproximadas."
          ],
          "tip": "Un tinte oscuro o un alisado reciente pueden cambiar el camino. Contarlo desde el inicio evita sorpresas; lo define la colorista al evaluar.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Tu día en el salón",
          "parrafos": [
            "Son cuatro horas de trabajo. Nuestra morena iluminada es válida hasta la altura del brasier, previa evaluación de la colorista."
          ],
          "tip": "Llega con tiempo libre y con tus fotos en el celular. Se ve natural y se nota en la foto, pero cuánta luz lleva lo define la evaluación.",
          "items": [],
          "familias": []
        },
        {
          "titulo": "Cuídala y planea el retoque",
          "parrafos": [
            "Como no se aclara tanto, tu cabello sufre menos que con un rubio, y al crecer no deja una raíz marcada. Aun así, el cuidado en casa cuenta."
          ],
          "tip": "El retoque lo conversas con tu colorista en la cita, según tu cabello.",
          "items": [
            "Champú sin sulfatos: los sulfatos barren el matiz en pocas semanas.",
            "Mascarilla nutritiva al menos una vez por semana.",
            "Protector térmico si usas plancha o rizador."
          ],
          "familias": []
        }
      ],
      "lista": [
        "Dos o tres fotos de la luz que quieres (con base parecida a la tuya)",
        "Una foto de tu cabello de hoy, con luz natural",
        "Una foto de lo que no quieres",
        "Tiempo libre: el servicio toma unas 4 horas"
      ],
      "cierre": "Reserva tu evaluación de morena iluminada. Cuéntanos qué luz imaginas y te decimos qué se puede lograr con tu cabello.",
      "nota": "Precio y duración según la carta vigente 2026. La colorista confirma el presupuesto final tras evaluar tu cabello."
    }
  }
]
