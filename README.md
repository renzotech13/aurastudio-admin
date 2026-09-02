# Panel Aura Studio

Panel de administración de [aurastudio.pe](https://aurastudio.pe): reservas, caja,
conversaciones de WhatsApp y el contenido del sitio. Vite + React + Tailwind v4
sobre Supabase.

```bash
cp .env.example .env    # completar con los datos del proyecto Supabase
npm install
npm run dev
```

## Identidad

El panel usa la misma línea gráfica que el sitio (`web/assets/css/style.css`):

| Token | Valor |
|---|---|
| Dorado | `#C89116` (`--gold`) |
| Marrón | `#5C3A23` / `#3A2415` |
| Crema | fondo `#F3EEE3`, tarjeta `#FBF8F2` |
| Display | Libre Baskerville — clase `.aura-display` |
| Texto | Poppins |

Las fuentes se cargan por Google Fonts en `index.html`, igual que en la web.
Botones en píldora, campos de esquina suave con foco dorado, tarjetas de radio
2xl y filete dorado opcional (`<Card crest>` / `.aura-crest`).

Utilidades de marca en `src/index.css`: `.aura-display`, `.aura-eyebrow`,
`.aura-crest`, `.aura-diamond`, `.tnum`. Encabezado de página reutilizable en
`src/components/PageHeader.tsx`.

## Gráficos

`src/components/charts.tsx` — SVG a medida, sin librería de charts:
`LineaArea` (crosshair + tooltip), `Columnas` (simples o apiladas), `Dona`,
`Ranking`, `Sparkline` y `Cifra` (tarjeta de KPI), más `ChartFrame` con
conmutador de vista de tabla.

La paleta de series (`--chart-1..6`) está **validada** para daltonismo y
contraste en claro y oscuro. El **orden de los slots es el mecanismo de
seguridad**, no una decisión estética: no reordenarlos ni cambiar los hex sin
volver a validar.

| Slot | Claro | Oscuro |
|---|---|---|
| 1 dorado | `#b5820c` | `#bb881a` |
| 2 rosa | `#ad5078` | `#aa4d75` |
| 3 azul | `#4c8edf` | `#5294e6` |
| 4 verde | `#4e8626` | `#4b8323` |
| 5 violeta | `#8959ba` | `#8656b7` |
| 6 teal | `#05a388` | `#19aa8e` |

Peor par adyacente: ΔE 15.1 (claro) / 17.0 (oscuro) bajo protanopia y
deuteranopia; normal 19.3 / 20.7; todos ≥ 3:1 contra su superficie. Con seis
series validan **pares adyacentes** (barras, líneas, apiladas, dona). Para
formas donde cualquier par puede quedar contiguo (dispersión, burbujas) el tope
son 3 series: por encima, agrupar en «Otros».

Los colores de estado (`--status-*`) están reservados para significado
bien/mal y nunca se usan como «serie 4».

## Control de caja

`src/pages/Caja/` — turnos de caja y libro de movimientos.

- **Turno**: se abre con el efectivo del cajón y se cierra con un arqueo que
  compara lo contado contra lo esperado. Solo el **efectivo** entra al arqueo;
  Yape, Plin, tarjeta y transferencia se registran como ingresos del negocio
  pero no cambian lo que hay en el cajón.
- **Movimientos**: ingresos (servicio, producto, curso, propina, adelanto) y
  egresos (insumos, proveedor, sueldo, alquiler, servicios, movilidad, retiro).
  No se borran: se **anulan**, con motivo, y el rastro queda.
- **Rangos** (`rango.ts`): hoy, ayer, 7 días, quincena, mes, mes anterior, 30
  días — siempre en días de Lima, con desfase fijo `-05:00`. El filtro delimita
  las cifras, los gráficos y la tabla a la vez, así que los números nunca se
  contradicen entre tarjetas.

Una sola caja puede estar abierta a la vez; lo garantiza un índice parcial en la
base, no la interfaz.

## Migraciones

Las migraciones de `supabase/migrations/` se aplican **a mano** desde el SQL
editor de Supabase, en orden.

> **Pendiente:** aplicar `0009_caja.sql`. Además de crear las tablas de caja,
> cierra una escalada de privilegios abierta desde la `0003`: la política
> «Users can update own profile» permitía que cualquier cuenta autenticada
> hiciera `update profiles set role = 'staff'` sobre sí misma. A partir de la
> 0009 el permiso de columna solo cubre `full_name` y `phone`, y `role` se
> cambia únicamente desde el SQL editor como `postgres`.
