"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useQueryPublicAgenda } from "../../hooks/use-public-agenda";
import { CalendarX, Clock } from "lucide-react";
import dayjs from "dayjs";
import { Separator } from "@/components/ui/separator";
import { RenderCalendar } from "./render-calendar";

interface BookingFormProps {
  orgSlug: string;
  agendaSlug: string;
}

export function BookingForm({ orgSlug, agendaSlug }: BookingFormProps) {
  const { agenda, isLoading } = useQueryPublicAgenda({ orgSlug, agendaSlug });

  return (
    <Card className="max-w-250 w-full mx-auto">
      <CardContent className="p-5 md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4">
        <div className="">
          {agenda?.organization.logo && (
            <img
              src={agenda?.organization.logo}
              alt={agenda?.organization.name}
            />
          )}
          <p className="text-sm font-medium text-muted-foreground mt-1">
            {agenda?.organization.name}
          </p>
          <h1 className="text-xl font-semibold mt-2">{agenda?.name}</h1>
          <p className="text-sm font-medium text-muted-foreground">
            {agenda?.description}
          </p>

          <div className="mt-5 flex flex-col gap-y-3">
            <p className="flex items-center">
              <CalendarX className="size-4 mr-2 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">
                {dayjs().format("D MMMM YYYY")}
              </span>
            </p>

            <p className="flex items-center">
              <Clock className="size-4 mr-2 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">
                {agenda?.slotDuration} minutos
              </span>
            </p>
          </div>
        </div>

        <Separator orientation="vertical" className="w-px! h-full" />

        <RenderCalendar availabilities={agenda?.availabilities as any} />
      </CardContent>
    </Card>
  );
}
