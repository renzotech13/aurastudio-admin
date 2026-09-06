import {
  Droplet,
  Eye,
  Feather,
  Flower,
  Footprints,
  Gem,
  Hand,
  Leaf,
  Paintbrush,
  Palette,
  Scissors,
  Sparkles,
  SprayCan,
  type LucideIcon,
} from "lucide-react"

/**
 * Íconos de categoría del salón — trazo de Lucide, dibujado, no emoji.
 *
 * `service_categories.icon` guarda una de estas claves (el nombre del
 * componente, tal cual: "Scissors", "Palette"…), no un carácter. La web
 * (web/assets/js/booking.js) dibuja el MISMO path a mano por su cuenta —sin
 * depender de este paquete, porque es un sitio estático sin build— así que
 * si agregas un ícono acá, agrégalo también allá con el mismo trazo exacto
 * (cópialo de node_modules/lucide-react/dist/esm/icons/<nombre>.mjs) para
 * que panel y sitio muestren siempre el mismo dibujo.
 */
export const CATEGORY_ICON_OPTIONS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "Scissors", label: "Tijeras", Icon: Scissors },
  { key: "Palette", label: "Paleta", Icon: Palette },
  { key: "Hand", label: "Mano", Icon: Hand },
  { key: "Footprints", label: "Huellas", Icon: Footprints },
  { key: "Eye", label: "Ojo", Icon: Eye },
  { key: "Feather", label: "Pluma", Icon: Feather },
  { key: "Sparkles", label: "Destellos", Icon: Sparkles },
  { key: "Paintbrush", label: "Pincel", Icon: Paintbrush },
  { key: "Leaf", label: "Hoja", Icon: Leaf },
  { key: "Droplet", label: "Gota", Icon: Droplet },
  { key: "Flower", label: "Flor", Icon: Flower },
  { key: "Gem", label: "Gema", Icon: Gem },
  { key: "SprayCan", label: "Spray", Icon: SprayCan },
]

const ICON_BY_KEY: Record<string, LucideIcon> = Object.fromEntries(
  CATEGORY_ICON_OPTIONS.map((o) => [o.key, o.Icon]),
)

/** Ícono por defecto para categorías creadas antes de este cambio (con un
 * emoji guardado en vez de una clave) o con una clave que ya no existe. */
const ICONO_POR_DEFECTO = Sparkles

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_BY_KEY[name] ?? ICONO_POR_DEFECTO
  return <Icon className={className} aria-hidden />
}
