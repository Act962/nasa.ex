import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AgentsSection } from "@/features/astro/components/settings/agents-section";

export default async function AstroSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");
  if (!session.session.activeOrganizationId) redirect("/settings");

  return (
    <div className="px-4 pb-8 max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Agentes IA</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure quais agentes do ASTRO estão ativos na organização e como
          eles atuam (manual, sob trigger ou automático).
        </p>
      </div>
      <AgentsSection />
    </div>
  );
}
