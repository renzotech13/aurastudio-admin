import { cn } from "@/lib/utils"
import type { Canal, ConversacionResumen } from "@/lib/types"

/**
 * Una sola fuente para cómo se ve cada canal en todo el panel — íconos y
 * colores repetidos en dos lugares es la forma más rápida de que un día
 * dejen de coincidir.
 *
 * Esta versión de lucide-react no trae íconos de marca (WhatsApp/Messenger/
 * Instagram no existen ahí) — el respaldo documentado en el plan es un
 * monograma, que además da más contraste de marca que un ícono genérico
 * mal asociado.
 */
export const CANAL_LABEL: Record<Canal, string> = {
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  instagram: "Instagram",
}

const CANAL_ESTILO: Record<Canal, { letra: string; clases: string }> = {
  whatsapp: { letra: "W", clases: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  messenger: { letra: "M", clases: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  instagram: { letra: "I", clases: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300" },
}

export function CanalIcon({ canal, className }: { canal: Canal; className?: string }) {
  const estilo = CANAL_ESTILO[canal]
  return (
    <span
      aria-label={CANAL_LABEL[canal]}
      title={CANAL_LABEL[canal]}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
        "size-4",
        estilo.clases,
        className,
      )}
    >
      {estilo.letra}
    </span>
  )
}

/** "@usuario" para Instagram, nombre para Messenger, teléfono para WhatsApp — lo que identifica a la clienta en ESE canal. */
export function describirIdentidad(conv: Pick<ConversacionResumen, "canal" | "identidad_username" | "identidad_nombre" | "cliente_telefono">): string {
  if (conv.canal === "instagram" && conv.identidad_username) return `@${conv.identidad_username}`
  if (conv.identidad_nombre) return conv.identidad_nombre
  if (conv.cliente_telefono) return conv.cliente_telefono
  return "Sin identificar"
}
