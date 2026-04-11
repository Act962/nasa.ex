"use client";

import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { useParams } from "next/navigation";
import { ProjectSelect } from "@/features/org-projects/components/project-select";
import { InfoItem } from "../Info-item";

interface FieldProjectProps {
  trackingId: string;
  orgProjectId?: string | null;
}

export function FieldProject({ trackingId, orgProjectId }: FieldProjectProps) {
  const { leadId } = useParams<{ leadId: string }>();
  const mutation = useMutationLeadUpdate(leadId, trackingId);

  const handleChange = (value: string | null) => {
    mutation.mutate({ id: leadId, orgProjectId: value });
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      <InfoItem label="Projeto / Cliente" value="" />
      <ProjectSelect
        value={orgProjectId}
        onChange={handleChange}
        placeholder="Sem projeto/cliente"
        className="h-8 text-sm"
      />
    </div>
  );
}
