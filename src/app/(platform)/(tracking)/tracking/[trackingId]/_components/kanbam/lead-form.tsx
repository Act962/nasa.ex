"use client";

import { Button } from "@/components/ui/button";
import { useCreateLead } from "@/context/leads/hooks/use-lead";
import { Plus } from "lucide-react";
import { useParams } from "next/navigation";

interface LeadFormProps {
  statusId: string;
}

export const LeadForm = ({ statusId }: LeadFormProps) => {
  const params = useParams<{ trackingId: string }>();
  const createLead = useCreateLead({ trackingId: params.trackingId });

  const onCreateLead = () => {
    createLead.mutate({
      name: "Sem nome",
      statusId,
      phone: Math.random().toString(),
      trackingId: params.trackingId,
    });
  };

  return (
    <div className="pt-2 px-2">
      <Button
        onClick={onCreateLead}
        size="sm"
        variant="ghost"
        className="h-auto px-2 py-1.5 w-full justify-start text-sm"
      >
        <Plus />
        Adicionar Lead
      </Button>
    </div>
  );
};
