"use client";

import { LeadAction } from "@/generated/prisma/enums";
import { useLostOrWin } from "@/hooks/use-lost-or-win";
import { Button } from "@/components/ui/button";
import { CheckCircleIcon, PencilIcon, XCircleIcon } from "lucide-react";

interface FieldWinOrLostProps {
  lead: {
    id: string;
    trackingId: string;
    value: LeadAction;
  };
  displayName: string;
}

export function FieldWinOrLost({ lead, displayName }: FieldWinOrLostProps) {
  const { onOpen } = useLostOrWin();

  type LeadActionType = (typeof LeadAction)[keyof typeof LeadAction];

  const LeadActionLabel: Record<LeadActionType, string> = {
    ACTIVE: "Ativo",
    DELETED: "Deletado",
    WON: "Ganho",
    LOST: "Perdido",
  };

  return (
    <div className="flex flex-col gap-2 group">
      <span className="text-xs font-bold text-muted-foreground tracking-tight">
        {displayName}
      </span>
      <div className="flex flex-wrap gap-2">
        <div className="flex justify-between items-center w-full">
          <span className={"text-sm font-medium truncate"}>
            {LeadActionLabel[lead.value]}
          </span>
          {lead.value == "ACTIVE" && (
            <div>
              <Button
                variant={"ghost"}
                size={"icon-sm"}
                className="opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity "
                onClick={() =>
                  onOpen(
                    { leadId: lead.id, trackingId: lead.trackingId },
                    "LOSS",
                  )
                }
              >
                <XCircleIcon className="text-red-400" />
              </Button>
              <Button
                variant={"ghost"}
                size={"icon-sm"}
                className="opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity "
                onClick={() =>
                  onOpen(
                    { leadId: lead.id, trackingId: lead.trackingId },
                    "WIN",
                  )
                }
              >
                <CheckCircleIcon className={"text-green-500"} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
