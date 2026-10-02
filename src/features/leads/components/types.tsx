import { Trophy, XCircle, Trash2, Activity } from "lucide-react";
import { LeadAction } from "@/generated/prisma/enums";

export const ACTION_CONFIG: Record<
  LeadAction,
  { label: string; icon: React.ReactNode; className: string }
> = {
  ACTIVE: {
    label: "Movimentação",
    icon: <Activity className="size-4" />,
    className: "bg-info/10 text-info",
  },
  WON: {
    label: "Lead Ganho",
    icon: <Trophy className="size-4" />,
    className: "bg-success/10 text-success",
  },
  LOST: {
    label: "Lead Perdido",
    icon: <XCircle className="size-4" />,
    className: "bg-destructive/10 text-destructive",
  },
  DELETED: {
    label: "Arquivado",
    icon: <Trash2 className="size-4" />,
    className: "bg-knob/10 text-muted-foreground",
  },
};
