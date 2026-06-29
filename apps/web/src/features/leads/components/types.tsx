import { Trophy, XCircle, Trash2, Activity } from "lucide-react";
import { LeadAction } from "@/generated/prisma/enums";

export const ACTION_CONFIG: Record<
  LeadAction,
  { label: string; icon: React.ReactNode; className: string }
> = {
  ACTIVE: {
    label: "Movimentação",
    icon: <Activity className="size-4" />,
    className: "bg-blue-500/10 text-blue-500",
  },
  WON: {
    label: "Lead Ganho",
    icon: <Trophy className="size-4" />,
    className: "bg-emerald-500/10 text-emerald-500",
  },
  LOST: {
    label: "Lead Perdido",
    icon: <XCircle className="size-4" />,
    className: "bg-red-500/10 text-red-500",
  },
  DELETED: {
    label: "Arquivado",
    icon: <Trash2 className="size-4" />,
    className: "bg-zinc-500/10 text-zinc-500",
  },
};
