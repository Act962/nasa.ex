"use client";

import { useState } from "react";
import { useQueryState } from "nuqs";
import { CheckCircle2, Circle, PlusIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useQueryLeadAction } from "@/features/leads/hooks/use-lead-action";
import { CreateLeadActionModal } from "./create-lead-action-modal";

interface LeadActionsPopoverProps {
  leadId: string;
  leadName: string;
  trackingId: string;
  // Elemento que dispara o popover (ícone do card, item de menu, etc.).
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}

export function LeadActionsPopover({
  leadId,
  leadName,
  trackingId,
  children,
  align = "end",
}: LeadActionsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [, setActionId] = useQueryState("actionId", { shallow: true });

  // Fetch lazy: só busca a lista quando o popover está aberto.
  const { data, isLoading } = useQueryLeadAction({ leadId, enabled: open });
  const actions = data?.actions ?? [];

  const openActionCard = (actionId: string) => {
    setOpen(false);
    setActionId(actionId);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent
          align={align}
          className="w-72 p-0"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-medium">Atividades</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
            >
              <PlusIcon className="size-3.5" />
              Adicionar
            </Button>
          </div>

          <div className="flex max-h-64 flex-col overflow-y-auto p-1">
            {isLoading && (
              <div className="flex justify-center py-6">
                <Spinner className="size-4" />
              </div>
            )}

            {!isLoading && actions.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhuma atividade ainda.
              </p>
            )}

            {!isLoading &&
              actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => openActionCard(action.id)}
                  className="flex items-start gap-2 rounded-md px-2 py-2 text-left text-sm outline-hidden hover:bg-accent focus-visible:bg-accent"
                >
                  {action.isDone ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span
                    className={
                      action.isDone
                        ? "line-clamp-2 text-muted-foreground line-through"
                        : "line-clamp-2"
                    }
                  >
                    {action.title}
                  </span>
                </button>
              ))}
          </div>
        </PopoverContent>
      </Popover>

      <CreateLeadActionModal
        leadId={leadId}
        leadName={leadName}
        trackingId={trackingId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(actionId) => setActionId(actionId)}
      />
    </>
  );
}
