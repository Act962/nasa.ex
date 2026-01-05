import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ellipsis } from "lucide-react";
import { useParams } from "next/navigation";
import { toast } from "sonner";

interface CardOptionsProps {
  leadId: string;
  statusId: string;
}

export function CardOptions({ leadId, statusId }: CardOptionsProps) {
  const params = useParams<{ trackingId: string }>();
  const queryClient = useQueryClient();

  const moveToFirst = useMutation(
    orpc.leads.addToFirst.mutationOptions({
      onSuccess: (output) => {
        toast.success(`${output.leadName} movido para o início da coluna`);

        queryClient.invalidateQueries(
          orpc.status.list.queryOptions({
            input: {
              trackingId: params.trackingId,
            },
          })
        );
      },
    })
  );

  const moveToLast = useMutation(
    orpc.leads.addToLast.mutationOptions({
      onSuccess: (output) => {
        toast.success(`${output.leadName} movido para o fim da coluna`);

        queryClient.invalidateQueries(
          orpc.status.list.queryOptions({
            input: {
              trackingId: params.trackingId,
            },
          })
        );
      },
    })
  );

  function handleMoveLeadToTop() {
    moveToFirst.mutate({
      leadId,
      statusId,
    });
  }
  function handleMoveLeadToEnd() {
    moveToLast.mutate({
      leadId,
      statusId,
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={"ghost"}
          size={"icon-sm"}
          className="opacity-0 group-hover:opacity-100"
        >
          <Ellipsis className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Mover</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={handleMoveLeadToTop}>
                Início
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleMoveLeadToEnd}>
                Fim
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
