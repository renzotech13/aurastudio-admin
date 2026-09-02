import WeeklyHours from "./WeeklyHours"
import Bloqueos from "./Bloqueos"
import Recordatorios from "./Recordatorios"
import { PageHeader } from "@/components/PageHeader"

export default function Disponibilidad() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <PageHeader
        eyebrow="Operación"
        titulo="Disponibilidad"
        descripcion="Define cuándo se pueden agendar citas. El bot y la web de reservas usan exactamente estas reglas."
      />

      <WeeklyHours />
      <Bloqueos />
      <Recordatorios />
    </div>
  )
}
