import { SidebarInset } from "@/components/ui/sidebar";
import HeadingContacts from "../../../../features/leads/components/heading-contact";
import { TableLeads } from "../../../../features/leads/components/table-leads";
import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { orpc } from "@/lib/orpc";

export default async function ContatosPage() {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(orpc.leads.list.queryOptions());
  return (
    <SidebarInset className="min-h-full pb-8">
      <HeadingContacts />

      <div className="mt-6 px-6">
        <HydrateClient client={queryClient}>
          <TableLeads />
        </HydrateClient>
      </div>
    </SidebarInset>
  );
}
