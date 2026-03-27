"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, SparklesIcon } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { eventIteratorToStream } from "@orpc/client";
import { client } from "@/lib/orpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef, useState } from "react";
import { pt } from "react-day-picker/locale";
import dayjs from "dayjs";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";

interface Props {
  conversationId: string;
}

export function SummerizeConversation({ conversationId }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<DateRange>({
    from: dayjs().startOf("day").toDate(),
    to: dayjs().endOf("day").toDate(),
  });
  const dateRef = useRef(date);
  dateRef.current = date;

  const {
    messages,
    status,
    error,
    sendMessage,
    setMessages,
    stop,
    clearError,
  } = useChat({
    id: `conversation-summary:${conversationId}`,
    transport: {
      async sendMessages(options) {
        return eventIteratorToStream(
          await client.ia.conversation.summary.generate(
            {
              conversationId: conversationId,
              dateInit: dateRef.current.from?.toISOString() ?? "",
              dateEnd: dateRef.current.to?.toISOString() ?? "",
            },
            { signal: options.abortSignal },
          ),
        );
      },
      reconnectToStream() {
        throw new Error("Method not implemented.");
      },
    },
  });

  const onSelectedDateRange = (dateRange: DateRange) => {
    setDate(dateRange);
  };

  const lastAssistent = messages.findLast((m) => m.role === "assistant");

  const summaryText =
    lastAssistent?.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n\n") ?? "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm">
          <SparklesIcon className="size-4" />
          Resumo
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-100 p-0" align="end">
        <div className="p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Resumo da conversa</h2>
            <p className="text-xs text-muted-foreground">
              Aqui você pode ver um resumo da conversa de hoje.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => sendMessage({ text: "Resuma a conversa de hoje" })}
            >
              {" "}
              <SparklesIcon className="size-4" />
              Gerar resumo
            </Button>
            <SelectDateRange onApply={onSelectedDateRange} dateRange={date} />
          </div>

          {status === "streaming" && (
            <Button type="button" onClick={() => stop()} variant="outline">
              Parar
            </Button>
          )}

          <div className="max-h-80 overflow-y-auto">
            {error ? (
              <div>
                <p className="text-red-500">Erro ao gerar resumo</p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    clearError();
                    setMessages([]);
                    sendMessage({ text: "Resuma a conversa de hoje" });
                  }}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : summaryText ? (
              // <p>{summaryText}</p>
              <Message from="assistant">
                <MessageContent>
                  <MessageResponse parseIncompleteMarkdown={status !== "ready"}>
                    {summaryText}
                  </MessageResponse>
                </MessageContent>
              </Message>
            ) : status === "submitted" || status === "streaming" ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface SelectDateRangeProps {
  onApply: (dateRange: DateRange) => void;
  dateRange: DateRange | undefined;
}

export const SelectDateRange = ({
  onApply,
  dateRange,
}: SelectDateRangeProps) => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>(dateRange);

  useEffect(() => {
    setDate(dateRange);
  }, [dateRange]);

  const intervals = [
    {
      label: "Hoje",
      from: dayjs().toDate(),
      to: dayjs().toDate(),
    },
    {
      label: "Semana",
      from: dayjs().day(0).toDate(),
      to: dayjs().day(6).toDate(),
    },
    {
      label: "Mês",
      from: dayjs().startOf("month").toDate(),
      to: dayjs().endOf("month").toDate(),
    },
    {
      label: "Ano",
      from: dayjs().startOf("year").toDate(),
      to: dayjs().endOf("year").toDate(),
    },
    {
      label: "Últimos 7 Dias",
      from: dayjs().subtract(6, "day").toDate(),
      to: dayjs().toDate(),
    },
    {
      label: "Últimos 30 Dias",
      from: dayjs().subtract(29, "day").toDate(),
      to: dayjs().toDate(),
    },
  ];

  const handleApply = () => {
    if (date?.from && date?.to) {
      onApply({
        from: dayjs(date.from).startOf("day").toDate(),
        to: dayjs(date.to).endOf("day").toDate(),
      });
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon-sm" variant="outline">
          <CalendarIcon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="p-0 border rounded-lg shadow-sm w-fit flex overflow-hidden"
      >
        <div className="hidden md:flex flex-col gap-0.5 border-r border-border w-36 px-2 py-2">
          {intervals.map((interval) => (
            <Button
              key={interval.label}
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => {
                setDate({
                  from: interval.from,
                  to: interval.to,
                });
              }}
            >
              {interval.label}
            </Button>
          ))}
        </div>
        <div>
          <Calendar
            mode="range"
            selected={date}
            onSelect={setDate}
            locale={pt}
            timeZone="America/Sao_Paulo"
            className="border-none"
          />
          <div className="flex justify-end gap-2 p-2">
            <Button onClick={handleApply}>Aplicar</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
