import { SidebarInset } from "@/components/ui/sidebar";
import { AgentsList } from "@/features/auto-agent/components/agents-list";

/**
 * Página de agentes IA por tracking.
 * Mostra agents do tracking atual + os org-wide (trackingId=null).
 */
export default async function TrackingAgentePage({
  params,
}: {
  params: Promise<{ trackingId: string }>;
}) {
  const { trackingId } = await params;
  return (
    <SidebarInset className="overflow-y-auto">
      <div className="container mx-auto max-w-6xl p-6">
        <AgentsList trackingId={trackingId} />
      </div>
    </SidebarInset>
  );
}
