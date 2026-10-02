import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppTemplatesGallery } from "@/features/admin/components/app-templates-gallery";
import { LayoutTemplate } from "lucide-react";
import { ToastProvider } from "@/contexts/toast-context";

export default async function AdminPatternsPage() {
  await requireAdminSession();

  return (
    <ToastProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-info" /> Padrões ÓRBITA
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os modelos pré-configurados disponíveis para as
            organizações
          </p>
        </div>

        <Tabs defaultValue="tracking" className="space-y-6">
          <TabsList>
            <TabsTrigger value="tracking">
              Tracking
            </TabsTrigger>
            <TabsTrigger value="workspace">
              Workspace
            </TabsTrigger>
            <TabsTrigger value="forge-proposal">
              Proposta
            </TabsTrigger>
            <TabsTrigger value="forge-contract">
              Contrato
            </TabsTrigger>
            <TabsTrigger value="form">
              Formulário
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tracking">
            <AppTemplatesGallery appType="tracking" organizationId="" />
          </TabsContent>
          <TabsContent value="workspace">
            <AppTemplatesGallery appType="workspace" organizationId="" />
          </TabsContent>
          <TabsContent value="forge-proposal">
            <AppTemplatesGallery appType="forge-proposal" organizationId="" />
          </TabsContent>
          <TabsContent value="forge-contract">
            <AppTemplatesGallery appType="forge-contract" organizationId="" />
          </TabsContent>
          <TabsContent value="form">
            <AppTemplatesGallery appType="form" organizationId="" />
          </TabsContent>
        </Tabs>
      </div>
    </ToastProvider>
  );
}
