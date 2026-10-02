import { TypeAction } from "@/generated/prisma/enums";
import { ClipboardCheckIcon, PhoneIcon, StickyNoteIcon } from "lucide-react";
import { ReactNode } from "react";

export interface IconsData {
  title: string;
  Icon: ReactNode;
  bgIcon: string;
}

export const ICONS: Record<TypeAction, IconsData> = {
  ["NOTE"]: {
    title: "Nota",
    Icon: <StickyNoteIcon className="size-4 text-success" />,
    bgIcon: "bg-success/10",
  },
  ["TASK"]: {
    title: "Tarefa",
    Icon: <ClipboardCheckIcon className="size-4 text-warning" />,
    bgIcon: "bg-warning/10",
  },
  ["MEETING"]: {
    title: "Reunião",
    Icon: <PhoneIcon className="size-4 text-warning" />,
    bgIcon: "bg-warning/10",
  },
  ["ACTION"]: {
    title: "Ação",
    Icon: <PhoneIcon className="size-4 text-warning" />,
    bgIcon: "bg-warning/10",
  },
};
