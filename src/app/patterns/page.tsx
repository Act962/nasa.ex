import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppTemplatesGallery } from "@/features/admin/components/app-templates-gallery";
import { ToastProvider } from "@/contexts/toast-context";

export default async function PatternsPage() {
  const organization = await auth.api.getFullOrganization({
    headers: await headers(),
  });

  if (!organization?.id) {
    redirect("/auth/login");
  }

  const organizationId = organization.id;

  return (
    <ToastProvider>
      <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Padrões NASA</h1>
          <p className="text-zinc-400">
            Explore modelos pré-configurados para acelerar a criação de seus apps
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-violet-600/10 border border-violet-600/30 rounded-lg p-4 mb-8">
          <p className="text-sm text-violet-300">
            ✨ Estes padrões foram criados por moderadores NASA como exemplos de como
            configurar e usar cada app. Você pode duplicar qualquer padrão para sua
            organização e adaptá-lo conforme suas necessidades.
          </p>
        </div>

        {/* Tabs */}
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

          <TabsContent value="tracking" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Padrões de Tracking</h2>
              <AppTemplatesGallery appType="tracking" organizationId={organizationId} />
            </div>
          </TabsContent>

          <TabsContent value="workspace" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Padrões de Workspace</h2>
              <AppTemplatesGallery appType="workspace" organizationId={organizationId} />
            </div>
          </TabsContent>

          <TabsContent value="forge-proposal" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Padrões de Proposta</h2>
              <AppTemplatesGallery appType="forgeProposal" organizationId={organizationId} />
            </div>
          </TabsContent>

          <TabsContent value="forge-contract" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Padrões de Contrato</h2>
              <AppTemplatesGallery appType="forgeContract" organizationId={organizationId} />
            </div>
          </TabsContent>

          <TabsContent value="form" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Padrões de Formulário</h2>
              <AppTemplatesGallery appType="form" organizationId={organizationId} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </ToastProvider>
  );
}
