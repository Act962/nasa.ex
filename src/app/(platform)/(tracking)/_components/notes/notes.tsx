"use client";

import { RichtTextEditor } from "../rich-text-editor/editor";
import { ContainerItemLead } from "./container-item-lead";
import { useParams } from "next/navigation";
import { useLeadAction } from "@/features/leads/hooks/use-lead-action";

export function TabNotes() {
  const params = useParams<{ leadId: string }>();
  const { data, isLoading } = useLeadAction({ leadId: params.leadId });

  if (isLoading) return <div>Loading...</div>;
  return (
    <div className="w-full space-y-4">
      <h2 className="text-lg font-semibold">Adicione um nova nota</h2>
      <RichtTextEditor />
      <div className="flex flex-col gap-5">
        {data?.actions.map((action) => (
          <ContainerItemLead key={action.id} {...action} />
        ))}
      </div>
    </div>
  );
}
