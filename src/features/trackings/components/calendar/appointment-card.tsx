import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { useState } from "react";
import { ViewAppointment } from "./view-appointment";

interface AppointmentCardProps {
  start: Date;
  end: Date;
  title: string | null;
  id: string;
  status?: string;
}

const statusColorMap: Record<string, string> = {
  PENDING:
    "bg-warning/10 text-warning border-l-warning hover:bg-warning/15",
  CONFIRMED:
    "bg-success/10 text-success border-l-success hover:bg-success/15",
  CANCELED: "bg-destructive/10 text-destructive border-l-destructive hover:bg-destructive/15",
  NO_SHOW: "bg-destructive/10 text-destructive border-l-destructive hover:bg-destructive/15",
  FINISHED: "bg-info/10 text-info border-l-info hover:bg-info/15",
  DEFAULT: "bg-muted text-foreground border-l-line hover:bg-accent",
};

export const AppointmentCard = ({
  id,
  title,
  start,
  end,
  status,
}: AppointmentCardProps) => {
  const [openView, setOpenView] = useState(false);
  const colorClass = statusColorMap[status || ""] || statusColorMap.DEFAULT;

  return (
    <>
      <div className="px-1 py-0.5 h-full" onClick={() => setOpenView(true)}>
        <div
          className={cn(
            "p-1.5 text-xs border border-transparent rounded-md border-l-4 flex flex-col gap-1 cursor-pointer transition-colors overflow-hidden h-full shadow-sm",
            colorClass
          )}
        >
          <p className="font-semibold truncate leading-tight">{title}</p>
          <div className="flex items-center gap-1 opacity-80 mt-auto text-[10px]">
            <span className="truncate">
              {dayjs(start).format("HH:mm")} - {dayjs(end).format("HH:mm")}
            </span>
          </div>
        </div>
      </div>

      <ViewAppointment
        open={openView}
        onOpenChange={setOpenView}
        appointmentId={id}
      />
    </>
  );
};
