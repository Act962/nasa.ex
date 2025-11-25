import { SidebarInset } from "@/components/ui/sidebar";
import { LeadContainer } from "../_components/lead-container";
import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { orpc } from "@/lib/orpc";

type LeadPageProps = {
  params: Promise<{ leadId: string }>;
};

export default async function LeadPage({ params }: LeadPageProps) {
  const { leadId } = await params;

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(
    orpc.leads.get.queryOptions({
      input: {
        id: leadId,
      },
    })
  );

  return (
    <SidebarInset>
      <HydrateClient client={queryClient}>
        <LeadContainer />
      </HydrateClient>
    </SidebarInset>
  );
}
