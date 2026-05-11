"use client";

import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { useParams } from "next/navigation";
import { ProjectSelect } from "@/features/org-projects/components/project-select";

interface FieldProjectProps {
  trackingId: string;
  orgProjectId?: string | null;
}

/**
 * Render no mesmo padrão do `FieldTracking`: label simples + Select inline.
 * Antes usava `<InfoItem label value="" />` que adicionava um wrapper com
 * `min-h-8` vazio entre o label e o select, criando um gap visual grande.
 */
export function FieldProject({ trackingId, orgProjectId }: FieldProjectProps) {
  const { leadId } = useParams<{ leadId: string }>();
  const mutation = useMutationLeadUpdate(leadId, trackingId);

  const handleChange = (value: string | null) => {
    mutation.mutate({ id: leadId, orgProjectId: value });
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      <span className="text-xs font-medium opacity-50">Projeto / Cliente</span>
      <ProjectSelect
        value={orgProjectId}
        onChange={handleChange}
        placeholder="Sem projeto/cliente"
        className="h-8 text-sm"
      />
    </div>
  );
}
