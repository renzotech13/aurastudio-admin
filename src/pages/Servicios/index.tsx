import { useState } from "react"

import { Segmented, type OpcionSegmentada } from "@/components/Segmented"
import { PageHeader } from "@/components/PageHeader"
import CategoriesPanel from "@/pages/Servicios/CategoriesPanel"
import ServicesPanel from "@/pages/Servicios/ServicesPanel"

type Tab = "categorias" | "servicios"

const TABS: readonly OpcionSegmentada<Tab>[] = [
  { id: "categorias", label: "Categorías" },
  { id: "servicios", label: "Servicios" },
]

export default function Servicios() {
  const [tab, setTab] = useState<Tab>("servicios")

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
      <PageHeader
        eyebrow="Contenido"
        titulo="Servicios"
        descripcion="Categorías y servicios que se muestran en la carta del sitio y en el reservador."
      />

      <div className="mb-6">
        <Segmented opciones={TABS} valor={tab} onChange={setTab} etiquetaAria="Ver categorías o servicios" />
      </div>

      {tab === "categorias" ? <CategoriesPanel /> : <ServicesPanel />}
    </div>
  )
}
