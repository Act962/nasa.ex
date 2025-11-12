import { orpc } from "@/lib/orpc";
import { gerarId } from "@/utils/generate-id";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { CirclePlus } from "lucide-react";

interface ButtonAddLeadProps {
  columnId: string;
}

export function ButtonAddLead({ columnId }: ButtonAddLeadProps) {
  const params = useParams<{ trackingId: string }>();
  const queryClient = useQueryClient();

  const createColumnMutation = useMutation(
    orpc.leads.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Lead criado!`);

        queryClient.invalidateQueries({
          queryKey: orpc.status.list.queryKey({
            input: {
              trackingId: params.trackingId,
            },
          }),
        });
      },
      onError: () => {
        toast.error("Erro ao criar lead, tente novamente.");
      },
    })
  );

  function handleAddLead() {
    createColumnMutation.mutate({
      name: "Sem Nome",
      phone: gerarId(12),
      statusId: columnId,
      trackingId: params.trackingId,
    });
  }

  return (
    <div
      onClick={handleAddLead}
      className="mt-2 py-1.5 flex flex-row justify-center items-center gap-2 rounded-b-lg hover:bg-foreground/10 cursor-pointer transition-colors"
    >
      Adicionar Lead <CirclePlus className="size-4" />
    </div>
  );
}
