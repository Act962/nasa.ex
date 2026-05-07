"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, BellRing, SendIcon } from "lucide-react";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useReminderOccurrences } from "../../hooks/use-remimber";
import dayjs from "dayjs";

interface ReminderOccurrencesPopoverProps {
  reminderId: string;
}

export function ReminderOccurrencesPopover({
  reminderId,
}: ReminderOccurrencesPopoverProps) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useReminderOccurrences(reminderId, open);

  const occurrences = data?.occurrences ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 size-7 text-muted-foreground hover:text-foreground"
          title="Ver envios"
        >
          <ChevronDownIcon
            className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
          <span className="sr-only">Ver envios</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        className="w-72 p-0"
        sideOffset={8}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b">
          <BellRing className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">
            Envios realizados
          </span>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Spinner className="size-4" />
          </div>
        )}

        {!isLoading && occurrences.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 px-3 text-center">
            <SendIcon className="size-6 text-muted-foreground/40 mb-1.5" />
            <p className="text-xs text-muted-foreground">
              Nenhum envio ainda.
            </p>
          </div>
        )}

        {!isLoading && occurrences.length > 0 && (
          <div className="flex flex-col divide-y max-h-60 overflow-y-auto">
            {occurrences.map((occ) => (
              <div
                key={occ.id}
                className="flex items-center gap-2.5 px-3 py-2.5"
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${
                    occ.sent
                      ? "bg-success/15"
                      : "bg-muted-foreground/10"
                  }`}
                >
                  <SendIcon
                    className={`size-3 ${occ.sent ? "text-success" : "text-muted-foreground"}`}
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-foreground">
                    {dayjs(occ.sentAt ?? occ.scheduledAt).format(
                      "DD/MM/YYYY [às] HH:mm",
                    )}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {occ.sent ? "Enviado via WhatsApp" : "Disparado (sem WhatsApp conectado)"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
