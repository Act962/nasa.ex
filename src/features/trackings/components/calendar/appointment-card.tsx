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
    "bg-yellow-50 text-yellow-800 border-l-yellow-500 hover:bg-yellow-100",
  CONFIRMED:
    "bg-green-50 text-green-800 border-l-green-500 hover:bg-green-100",
  CANCELED: "bg-red-50 text-red-800 border-l-red-500 hover:bg-red-100",
  NO_SHOW: "bg-red-50 text-red-800 border-l-red-500 hover:bg-red-100",
  FINISHED: "bg-blue-50 text-blue-800 border-l-blue-500 hover:bg-blue-100",
  DEFAULT: "bg-slate-50 text-slate-800 border-l-slate-400 hover:bg-slate-100",
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
      <div className="px-1 py-[2px] h-full" onClick={() => setOpenView(true)}>
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
