import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CategoriesPanel from "@/pages/Servicios/CategoriesPanel"
import ServicesPanel from "@/pages/Servicios/ServicesPanel"
import { PageHeader } from "@/components/PageHeader"

export default function Servicios() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <PageHeader
        eyebrow="Contenido"
        titulo="Servicios"
        descripcion="Categorías y servicios que se muestran en la carta del sitio y en el reservador."
      />

      <Tabs defaultValue="servicios">
        <TabsList className="mb-6">
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="servicios">Servicios</TabsTrigger>
        </TabsList>
        <TabsContent value="categorias">
          <CategoriesPanel />
        </TabsContent>
        <TabsContent value="servicios">
          <ServicesPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
