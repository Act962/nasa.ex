import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Copy } from "lucide-react";
import { JsonValue } from "@prisma/client/runtime/client";
import { FormBlockInstance } from "@/features/form/types";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Response = {
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
};

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  leadIdentifier: string;
  responses: Response[];
  blocks: FormBlockInstance[];
};

export function LeadResponsesDialog({
  isOpen,
  onOpenChange,
  leadIdentifier,
  responses,
  blocks,
}: Props) {
  const childblockMap = blocks
    .flatMap((block) => block.childblocks || [])
    .reduce(
      (acc, childblock) => {
        if (childblock) {
          acc[childblock.id] = childblock?.attributes?.label || "Sem label";
        }
        return acc;
      },
      {} as Record<string, string>,
    );

  const filteredResponses = responses
    .filter((res) => {
      let parsed: any = {};
      try {
        parsed =
          typeof res.jsonResponse === "string"
            ? JSON.parse(res.jsonResponse)
            : res.jsonResponse;
      } catch (e) {
        parsed = res.jsonResponse;
      }

      const phone = parsed.user_phone || parsed.phone;
      const name = parsed.user_name || parsed.name;
      return (
        res.leadId === leadIdentifier ||
        phone === leadIdentifier ||
        name === leadIdentifier
      );
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const handleCopyAll = () => {
    try {
      const text = filteredResponses
        .map((response) => {
          let parsed: Record<string, any> = {};
          try {
            parsed =
              typeof response.jsonResponse === "string"
                ? JSON.parse(response.jsonResponse)
                : (response.jsonResponse as Record<string, any>);
          } catch (e) {
            console.error("Error parsing response for copy", e);
          }

          const dateStr = format(
            new Date(response.createdAt),
            "dd/MM/yyyy HH:mm",
            { locale: ptBR },
          );
          const name = parsed.user_name || parsed.name || "Lead";

          let responseText = `--- Resposta em ${dateStr} ---\n`;
          responseText += `Nome: ${name}\n`;
          if (parsed.user_email) responseText += `Email: ${parsed.user_email}\n`;
          if (parsed.user_phone)
            responseText += `Telefone: ${parsed.user_phone}\n`;

          responseText += "\nPERGUNTAS E RESPOSTAS:\n";

          Object.entries(parsed).forEach(([key, value]) => {
            if (
              key === "user_name" ||
              key === "user_phone" ||
              key === "user_email" ||
              key === "name" ||
              key === "phone"
            )
              return;

            const label = childblockMap[key] || "Campo desconhecido";
            const displayValue =
              typeof value === "object" && value !== null
                ? (value as any).responseValue
                : value;

            responseText += `${label}: ${displayValue || "-"}\n`;
          });

          return responseText;
        })
        .join("\n\n");

      navigator.clipboard.writeText(text);
      toast.success("Respostas copiadas para a área de transferência!");
    } catch (err) {
      toast.error("Erro ao copiar respostas");
      console.error(err);
    }
  };

  const firstParsed = filteredResponses[0]
    ? typeof filteredResponses[0].jsonResponse === "string"
      ? JSON.parse(filteredResponses[0].jsonResponse)
      : filteredResponses[0].jsonResponse
    : {};

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between pr-8">
          <DialogTitle className="text-xl flex text-foreground items-center gap-2">
            Histórico de Respostas
          </DialogTitle>
          {filteredResponses.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleCopyAll}
            >
              <Copy className="w-4 h-4" />
              Copiar Tudo
            </Button>
          )}
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4 max-h-[400px] overflow-y-auto">
          <div className="space-y-4 py-2">
            {filteredResponses.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                Nenhuma outra resposta encontrada para este lead.
              </div>
            ) : (
              filteredResponses.map((response) => {
                let parsedResponses: Record<string, any> = {};
                try {
                  parsedResponses =
                    typeof response.jsonResponse === "string"
                      ? JSON.parse(response.jsonResponse)
                      : (response.jsonResponse as Record<string, any>);
                } catch (e) {
                  console.error("Error parsing jsonResponse", e);
                }

                const cardName =
                  parsedResponses.user_name ||
                  parsedResponses.name ||
                  leadIdentifier;

                return (
                  <Card
                    key={response.id}
                    className="bg-foreground/5 border-foreground/10"
                  >
                    <CardContent className="px-4">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-foreground/10">
                        <div className="flex flex-col">
                          <CardTitle className="text-sm font-semibold">
                            {cardName}
                          </CardTitle>
                          {response.form.settings?.needLogin && (
                            <div className="flex flex-col gap-0 mt-0.5">
                              {parsedResponses.user_email && (
                                <span className="text-[10px] text-muted-foreground lowercase">
                                  {parsedResponses.user_email}
                                </span>
                              )}
                              {parsedResponses.user_phone && (
                                <span className="text-[10px] text-muted-foreground">
                                  {parsedResponses.user_phone}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(
                            new Date(response.createdAt),
                            "dd/MM/yyyy HH:mm",
                            {
                              locale: ptBR,
                            },
                          )}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {Object.entries(parsedResponses).map(([key, value]) => {
                          // Ignore system fields in the list if they are just identifiers
                          if (
                            key === "user_name" ||
                            key === "user_phone" ||
                            key === "user_email"
                          )
                            return null;

                          // Check if value is a string or has a responseValue property
                          const displayValue =
                            typeof value === "object" && value !== null
                              ? value.responseValue
                              : value;

                          return (
                            <div key={key} className="flex flex-col">
                              <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                                {childblockMap[key] || "Campo desconhecido"}
                              </span>
                              <span className="text-sm text-foreground">
                                {displayValue || "-"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
