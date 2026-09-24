import { SidebarInset } from "@/components/ui/sidebar";
import HeadingContacts from "@/features/contacts/heading-contact";
import { TableLeads } from "@/features/contacts/table-leads";
import { SegmentsHeader } from "@/features/contacts/segments-header";
import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { orpc } from "@/lib/orpc";

export default async function ContatosPage() {
  const queryClient = getQueryClient();

  // Prefetch sem filtro: é o estado inicial (Total, sem recorte).
  await queryClient.prefetchQuery(
    orpc.leads.list.queryOptions({ input: { dateField: "createdAt" } }),
  );
  return (
    <SidebarInset className="min-h-full pb-8">
      <HeadingContacts />
      <SegmentsHeader />

      <div className="mt-6 px-6">
        <HydrateClient client={queryClient}>
          <TableLeads />
        </HydrateClient>
      </div>
    </SidebarInset>
  );
}
