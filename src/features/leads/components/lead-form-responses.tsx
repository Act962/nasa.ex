"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, ClipboardList } from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type ResponseEntry = {
  id: string;
  createdAt: Date | string;
  jsonResponse: unknown;
  form: { id: string; name: string };
};

const SYSTEM_KEYS = new Set(["user_name", "user_email", "user_phone"]);

function parseResponse(json: unknown): Record<string, unknown> {
  if (!json) return {};
  if (typeof json === "string") {
    try {
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof json === "object") return json as Record<string, unknown>;
  return {};
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value || "-";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const v = value as { value?: unknown; responseValue?: unknown };
    if (v.value !== undefined) return renderValue(v.value);
    if (v.responseValue !== undefined) return renderValue(v.responseValue);
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }
  return String(value);
}

export function LeadFormResponses({ leadId }: { leadId: string }) {
  const { data, isLoading } = useQuery(
    orpc.leads.listFormResponses.queryOptions({ input: { leadId } }),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  const responses: ResponseEntry[] = (data?.responses as ResponseEntry[]) ?? [];

  return (
    <div className="flex flex-col w-full h-full min-h-0 space-y-4">
      <div className="shrink-0">
        <h2 className="text-lg font-semibold">Formulários respondidos</h2>
        <p className="text-xs text-muted-foreground">
          Histórico de respostas vinculadas a este lead.
        </p>
      </div>
      <ScrollArea className="flex-1 w-full min-h-0 rounded-md">
        <div className="flex flex-col gap-4 pr-4">
          {responses.map((response) => {
            const parsed = parseResponse(response.jsonResponse);
            return (
              <Card
                key={response.id}
                className="bg-foreground/5 border-foreground/10"
              >
                <CardContent className="px-4">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-foreground/10">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ClipboardList className="w-4 h-4" />
                      {response.form.name}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(response.createdAt), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(parsed)
                      .filter(([key]) => !SYSTEM_KEYS.has(key))
                      .map(([key, value]) => (
                        <div key={key} className="flex flex-col">
                          <span className="text-[10px] font-semibold text-foreground/70 uppercase tracking-wider">
                            {key}
                          </span>
                          <span className="text-sm text-foreground break-words">
                            {renderValue(value)}
                          </span>
                        </div>
                      ))}
                    {Object.keys(parsed).filter((k) => !SYSTEM_KEYS.has(k)).length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Resposta sem campos preenchidos.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {responses.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardList />
                </EmptyMedia>
                <EmptyTitle>Nenhuma resposta ainda</EmptyTitle>
                <EmptyDescription>
                  As respostas dos formulários vinculados a este lead aparecerão
                  aqui.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
