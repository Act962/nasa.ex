import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppTemplatesGallery } from "@/features/admin/components/app-templates-gallery";
import { ToastProvider } from "@/contexts/toast-context";

export default async function PatternsPage() {
  // `getFullOrganization` lança APIError UNAUTHORIZED quando não há sessão
  // ativa — em vez de retornar null. Sem o try/catch o erro borbulha como
  // 500 e o redirect abaixo nunca é chamado.
  let organization: Awaited<ReturnType<typeof auth.api.getFullOrganization>> | null = null;
  try {
    organization = await auth.api.getFullOrganization({
      headers: await headers(),
    });
  } catch {
    organization = null;
  }

  if (!organization?.id) {
    redirect("/sign-in?callbackUrl=/patterns");
  }

  const organizationId = organization.id;

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Padrões ÓRBITA</h1>
          <p className="text-muted-foreground">
            Explore modelos pré-configurados para acelerar a criação de seus apps
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-info/10 border border-info/30 rounded-lg p-4 mb-8">
          <p className="text-sm text-info">
            ✨ Estes padrões foram criados por moderadores ÓRBITA como exemplos de como
            configurar e usar cada app. Você pode duplicar qualquer padrão para sua
            organização e adaptá-lo conforme suas necessidades.
          </p>
        </div>

        {/* Tabs */}
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

          <TabsContent value="tracking" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Padrões de Tracking</h2>
              <AppTemplatesGallery appType="tracking" organizationId={organizationId} />
            </div>
          </TabsContent>

          <TabsContent value="workspace" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Padrões de Workspace</h2>
              <AppTemplatesGallery appType="workspace" organizationId={organizationId} />
            </div>
          </TabsContent>

          <TabsContent value="forge-proposal" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Padrões de Proposta</h2>
              <AppTemplatesGallery appType="forge-proposal" organizationId={organizationId} />
            </div>
          </TabsContent>

          <TabsContent value="forge-contract" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Padrões de Contrato</h2>
              <AppTemplatesGallery appType="forge-contract" organizationId={organizationId} />
            </div>
          </TabsContent>

          <TabsContent value="form" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Padrões de Formulário</h2>
              <AppTemplatesGallery appType="form" organizationId={organizationId} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </ToastProvider>
  );
}
