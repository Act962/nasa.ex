"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { LeadDetails } from "./lead-details";
import { LeadInfo } from "./lead-info";
import { orpc } from "@/lib/orpc";
import { useParams } from "next/navigation";

export function LeadContainer() {
  const params = useParams<{ leadId: string }>();

  const { data } = useSuspenseQuery(
    orpc.leads.get.queryOptions({
      input: {
        id: params.leadId,
      },
    })
  );

  return (
    <div className="flex h-full">
      <LeadInfo initialData={data} className="hidden sm:block" />

      <LeadDetails initialData={data} />
    </div>
  );
}
