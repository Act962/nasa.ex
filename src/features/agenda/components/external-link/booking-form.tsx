"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useQueryPublicAgenda } from "../../hooks/use-public-agenda";

interface BookingFormProps {
  orgSlug: string;
  agendaSlug: string;
}

export function BookingForm({ orgSlug, agendaSlug }: BookingFormProps) {
  const { agenda, isLoading } = useQueryPublicAgenda({ orgSlug, agendaSlug });

  return (
    <Card className="max-w-250 w-full mx-auto">
      <CardContent className="p-5 md:grid md:grid-cols-[1fr,auto,1fr,auto,1fr]">
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
        </div>
      </CardContent>
    </Card>
  );
}
