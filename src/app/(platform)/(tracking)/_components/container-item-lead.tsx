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
  children: ReactNode;
}

export function ContainerItemLead({ type, children }: ComtainerItemLeadProps) {
  const [toggleDetails, setToggleDetails] = useState(true);

  const createDate = `Hoje, 12:00 PM`;

  function handleToggleDetails() {
    setToggleDetails((current) => !current);
  }
  function handleIconType(): ReactNode {
    switch (type) {
      case "Activity":
        return (
          <div className=" text-blue-600 bg-blue-400/10 p-1 rounded-sm">
            <ClipboardList className="size-4" />
          </div>
        );
      case "Note":
        return (
          <div className=" text-green-600 bg-green-400/10 p-1 rounded-sm">
            <StickyNote className="size-4" />
          </div>
        );
      case "Task":
        return (
          <div className=" text-yellow-600 bg-yellow-400/10 p-1 rounded-sm">
            <ClipboardCheck className="size-4" />
          </div>
        );
      case "Meeting":
        return (
          <div className=" text-orange-600 bg-orange-400/10 p-1 rounded-sm">
            <Phone className="size-4" />
          </div>
        );
    }
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
          {handleIconType()}
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
      {children}
    </div>
  );
}
