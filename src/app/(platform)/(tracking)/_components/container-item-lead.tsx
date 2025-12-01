"use client";

import { ReactNode, useState } from "react";
import {
  CalendarFoldIcon,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  MoreHorizontal,
  Phone,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type TypeContainerItemLead = "Activity" | "Note" | "Task" | "Meeting";

interface ComtainerItemLeadProps {
  type: TypeContainerItemLead;
}

export function ContainerItemLead({ type }: ComtainerItemLeadProps) {
  const [toggleDetails, setToggleDetails] = useState(true);

  const createDate = `Hoje, 12:00 PM`;

  function handleToggleDetails() {
    setToggleDetails((current) => !current);
  }

  return (
    <div className="rounded-md bg-accent-foreground/5">
      <div className="flex items-center justify-between px-4 py-5">
        <div className="flex items-center gap-3 ">
          <Button
            variant="ghost"
            size="icon-xs"
            className="mr-1"
            onClick={handleToggleDetails}
          >
            {toggleDetails ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
          <div className={`p-1 rounded-sm ${ICONS[type].bgIcon}`}>
            {ICONS[type].Icon}
          </div>
          <span className="text-sm">
            <span className="font-medium">{type}</span> Criado por
            <span className="font-medium"> John Marson</span>
          </span>
        </div>
        <div className="flex fle-row items-center gap-3 ">
          <CalendarFoldIcon className="size-4" />
          <span className="text-sm ">{createDate}</span>
          <Button variant="ghost" size="icon-xs" className="mr-1">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>
      <Separator className="w-full" />

      <CardDetails type={type} />
    </div>
  );
}

interface IconsData {
  Icon: ReactNode;
  bgIcon: string;
}

export const ICONS: Record<TypeContainerItemLead, IconsData> = {
  ["Activity"]: {
    Icon: <ClipboardList className="size-4 text-blue-600" />,
    bgIcon: "bg-blue-400/10",
  },
  ["Note"]: {
    Icon: <StickyNote className="size-4 text-green-600" />,
    bgIcon: "bg-green-400/10",
  },
  ["Task"]: {
    Icon: <ClipboardCheck className="size-4 text-yellow-600" />,
    bgIcon: "bg-yellow-400/10",
  },
  ["Meeting"]: {
    Icon: <Phone className="size-4 text-orange-600" />,
    bgIcon: "bg-orange-400/10",
  },
};

interface CardDetailsProps {
  type: TypeContainerItemLead;
  image?: string;
}

function CardDetails({ type, image }: CardDetailsProps) {
  return (
    <div className="p-5 flex flex-row">
      <div className="flex flex-col gap-2">
        <span className="font-medium">Titulo Mocado</span>
        <span className="text-sm font-mono text-accent-foreground/60">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Temporibus,
          dolor! Consequatur, modi. Tempora quidem nulla cum explicabo, impedit
          error eos quas sunt? Inventore, obcaecati. Perferendis minima
          blanditiis soluta eum inventore. Lorem ipsum, dolor sit amet
          consectetur adipisicing elit. Architecto iusto assumenda ex
          accusantium consequatur eos qui nisi repellat debitis dolore quibusdam
          nihil velit, consectetur, quidem corporis provident maxime minima
          itaque?
        </span>
      </div>
      {image && <img src={image} className="w-full" />}
    </div>
  );
}
