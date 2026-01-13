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
import {
  useMoveToLast,
  userMoveToFirst,
} from "@/features/leads/hooks/use-lead";

import { Ellipsis } from "lucide-react";

interface CardOptionsProps {
  leadId: string;
  statusId: string;
}

export function CardOptions({ leadId, statusId }: CardOptionsProps) {
  const moveToFirst = userMoveToFirst();

  const moveToLast = useMoveToLast();

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
