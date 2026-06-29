import React, { FC, useState } from "react";
import { FieldValue, FormBlockInstance } from "@/features/form/types";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, ExternalLink, History, User } from "lucide-react";
import { JsonValue } from "@prisma/client/runtime/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadResponsesDialog } from "./lead-responses-dialog";
import { Button } from "@/components/ui/button";
import { ResponseValue, resolveBlockLabel } from "./response-value";
import { useRouter } from "next/navigation";

type Props = {
  blocks: FormBlockInstance[];
  responses: {
    formId: string;
    id: string;
    createdAt: Date;
    jsonResponse: JsonValue;
    leadId?: string | null;
    form: {
      settings: {
        needLogin: boolean;
        showEmail: boolean;
        showName: boolean;
        showPhone: boolean;
      } | null;
    };
  }[];
};

export function AllReponds({ blocks, responses }: Props) {
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const route = useRouter()

  const childblockMap = blocks
    .flatMap((block) => block.childblocks || [])
    .reduce(
      (acc, childblock) => {
        if (childblock) {
          // Tenta label, title, question, etc. — diferentes blocos usam
          // diferentes attrs pra rotular. Sem isso, blocos sem `label`
          // (heading-style, image-display custom) caíam como "Sem label".
          acc[childblock.id] =
            resolveBlockLabel(childblock?.attributes as Record<string, unknown>) ||
            "Sem label";
        }
        return acc;
      },
      {} as Record<string, string>,
    );

  const handleLeadClick = (identifier: string) => {
    setSelectedLead(identifier);
    setIsDialogOpen(true);
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-3 w-full">
      {responses.map((response) => {
        let parsedResponses: Record<string, FieldValue> = {};
        try {
          parsedResponses =
            typeof response.jsonResponse === "string"
              ? JSON.parse(response.jsonResponse)
              : (response.jsonResponse as Record<string, FieldValue>);
        } catch (e) {
          console.error("Error parsing jsonResponse", e);
        }

        // Safe value extractor
        const extractValue = (field: any): string | undefined => {
          if (!field) return undefined;
          if (typeof field === "object" && field !== null && "value" in field) {
            return String(field.value);
          }
          return String(field);
        };

        // Find lead name or phone from response for display
        const leadPhone = extractValue(
          parsedResponses.user_phone || parsedResponses.phone,
        );
        const leadName = extractValue(
          parsedResponses.user_name || parsedResponses.name,
        );
     
        const leadId = response.leadId;
        const displayLead = leadName || leadPhone || "Lead Desconhecido";
        const identifier = leadPhone || leadId || leadName;

        return (
          <Card key={response.id} className="bg-foreground/15 p-3 mb-2 w-full min-w-0 overflow-hidden">
            <CardContent className="pb-0 px-1 min-w-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-1 mb-2 px-1">
                  <div
                    className="flex items-center gap-2 cursor-pointer hover:text-foreground/80 transition-colors group"
                    title="Ver todas as respostas deste lead"
                  >
                    <div className="bg-primary/20 p-1.5 rounded-full group-hover:bg-primary/30 transition-colors">
                      <User className="h-4 w-4 text-foreground" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold truncate max-w-[150px]">
                        {displayLead as React.ReactNode}
                      </span>
                      {response.form.settings?.needLogin && (
                        <div className="flex flex-col gap-0 mt-0.5">
                          {leadPhone && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              {leadPhone as React.ReactNode}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center ">
                    <span className="text-[10px] text-muted-foreground flex items-center whitespace-nowrap">
                      <Clock className="w-3 h-3 mr-1" />
                      {format(new Date(response.createdAt), "dd/MM HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                    {leadId && (
                      <Button size={"icon-sm"} variant={"ghost"} asChild>
                        <span
                          onClick={() => route.replace(`/contatos/${leadId}`)}
                          
                        >
                          <ExternalLink className="h-4 w-4" />
                        </span>
                      </Button>
                    )}
                    <Button
                      size={"icon-sm"}
                      variant={"ghost"}
                      onClick={() => identifier && handleLeadClick(identifier)}
                      title="Ver histórico de respostas"
                    >
                      <History />
                    </Button>
                  </div>
                </div>

                <div className="pt-2 border-t border-foreground/10">
                  <h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-2 px-1">
                    Questões/Respostas
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(parsedResponses).map(([key, value]) => {
                      // Skip internal identifier fields in the card content list.
                      // `__` prefix = meta-campo do sistema (ex: __groupsReached
                      // do DatePicker reset trigger).
                      if (
                        key === "user_name" ||
                        key === "user_phone" ||
                        key === "user_email" ||
                        key.startsWith("__")
                      )
                        return null;

                      const displayValue =
                        typeof value === "object" && value !== null
                          ? (value as { value?: unknown }).value
                          : value;

                      return (
                        <div key={key} className="flex flex-col px-1 min-w-0">
                          <div className="font-semibold text-xs text-foreground/80 lowercase break-words">
                            {childblockMap[key] || "Campo desconhecido"}
                          </div>
                          <ResponseValue value={displayValue} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {selectedLead && (
        <LeadResponsesDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          leadIdentifier={selectedLead}
          responses={responses}
          blocks={blocks}
        />
      )}
    </div>
  );
}

export default AllReponds;
