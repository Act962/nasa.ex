"use client";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { LeadDetails } from "./lead-details";
import { orpc } from "@/lib/orpc";
import { useParams } from "next/navigation";
import { LeadInfo } from "./lead-info";
import { EntityLoading } from "@/components/entity-components";

export function LeadContainer() {
  const params = useParams<{ leadId: string }>();

  const { data, isLoading } = useQuery(
    orpc.leads.get.queryOptions({
      input: {
        id: params.leadId,
      },
    }),
  );

  if (isLoading) return <EntityLoading />;

  if (!data) {
    return <div>Lead não encontrado</div>;
  }

  return (
    <div className="flex h-screen min-h-full overflow-hidden">
      <LeadInfo initialData={data} className="hidden sm:block shrink-0" />
      <LeadDetails initialData={data} />
    </div>
  );
}
