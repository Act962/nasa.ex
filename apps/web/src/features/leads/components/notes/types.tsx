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
    Icon: <StickyNoteIcon className="size-4 text-green-600" />,
    bgIcon: "bg-green-400/10",
  },
  ["TASK"]: {
    title: "Tarefa",
    Icon: <ClipboardCheckIcon className="size-4 text-yellow-600" />,
    bgIcon: "bg-yellow-400/10",
  },
  ["MEETING"]: {
    title: "Reunião",
    Icon: <PhoneIcon className="size-4 text-orange-600" />,
    bgIcon: "bg-orange-400/10",
  },
  ["ACTION"]: {
    title: "Ação",
    Icon: <PhoneIcon className="size-4 text-orange-600" />,
    bgIcon: "bg-orange-400/10",
  },
};
