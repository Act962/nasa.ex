"use client";

import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateId } from "better-auth";
import { Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { toast } from "sonner";

interface LeadFormProps {
  statusId: string;
}

export const LeadForm = ({ statusId }: LeadFormProps) => {
  const params = useParams<{ trackingId: string }>();

  const queryClient = useQueryClient();

  const createInitalLead = useMutation(
    orpc.leads.create.mutationOptions({
      onSuccess: () => {
        toast.success("Lead criada com sucesso!");

        queryClient.invalidateQueries({
          queryKey: orpc.status.list.queryKey({
            input: {
              trackingId: params.trackingId,
            },
          }),
        });
      },
      onError: () => {
        toast.error("Erro ao criar lead, tente novamente");
      },
    })
  );

  const onCreateLead = () => {
    createInitalLead.mutate({
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
