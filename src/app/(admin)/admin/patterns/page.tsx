import { requireAdminSession } from "@/lib/admin-utils";
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
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-violet-400" /> Padrões NASA
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Gerencie os modelos pré-configurados disponíveis para as organizações
          </p>
        </div>

        <Tabs defaultValue="tracking" className="space-y-6">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="tracking" className="data-[state=active]:bg-violet-600">
              Tracking
            </TabsTrigger>
            <TabsTrigger value="workspace" className="data-[state=active]:bg-violet-600">
              Workspace
            </TabsTrigger>
            <TabsTrigger value="forge-proposal" className="data-[state=active]:bg-violet-600">
              Proposta
            </TabsTrigger>
            <TabsTrigger value="forge-contract" className="data-[state=active]:bg-violet-600">
              Contrato
            </TabsTrigger>
            <TabsTrigger value="form" className="data-[state=active]:bg-violet-600">
              Formulário
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tracking">
            <AppTemplatesGallery appType="tracking" organizationId="" showDelete />
          </TabsContent>
          <TabsContent value="workspace">
            <AppTemplatesGallery appType="workspace" organizationId="" showDelete />
          </TabsContent>
          <TabsContent value="forge-proposal">
            <AppTemplatesGallery appType="forge-proposal" organizationId="" showDelete />
          </TabsContent>
          <TabsContent value="forge-contract">
            <AppTemplatesGallery appType="forge-contract" organizationId="" showDelete />
          </TabsContent>
          <TabsContent value="form">
            <AppTemplatesGallery appType="form" organizationId="" showDelete />
          </TabsContent>
        </Tabs>
      </div>
    </ToastProvider>
  );
}
