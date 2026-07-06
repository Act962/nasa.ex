"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  useCreateTemplateMessage,
  useWhatsAppTemplates,
} from "../hooks/use-whatsapp-templates";

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId: string;
  conversationId: string;
  leadPhone: string | null;
  onSent?: () => void;
}

/**
 * Seletor de template HSM (Fase 9). Lista os templates aprovados da WABA,
 * coleta as variáveis (body + header de texto) e envia via
 * `message.createTemplate`. Usado pra abrir conversa fora da janela de 24h
 * — disponível só pra trackings `META_CLOUD`.
 */
export function TemplatePicker({
  open,
  onOpenChange,
  trackingId,
  conversationId,
  leadPhone,
  onSent,
}: TemplatePickerProps) {
  const { data, isLoading, error } = useWhatsAppTemplates(trackingId, {
    enabled: open,
  });
  const createTemplate = useCreateTemplateMessage(conversationId);

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [headerParams, setHeaderParams] = useState<string[]>([]);

  const templates = useMemo(() => data?.templates ?? [], [data]);
  const selected = useMemo(
    () => templates.find((template) => template.name === selectedName) ?? null,
    [templates, selectedName],
  );

  function selectTemplate(name: string) {
    const template = templates.find((item) => item.name === name);
    setSelectedName(name);
    setBodyParams(Array(template?.bodyVariableCount ?? 0).fill(""));
    setHeaderParams(Array(template?.headerVariableCount ?? 0).fill(""));
  }

  function renderPreview(text: string, params: string[]): string {
    return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, index) => {
      const value = params[Number(index) - 1];
      return value && value.trim().length > 0 ? value : match;
    });
  }

  const previewBody = selected
    ? [
        selected.headerText
          ? renderPreview(selected.headerText, headerParams)
          : null,
        renderPreview(selected.bodyText, bodyParams),
      ]
        .filter(Boolean)
        .join("\n\n")
    : "";

  const allParamsFilled =
    bodyParams.every((value) => value.trim().length > 0) &&
    headerParams.every((value) => value.trim().length > 0);

  function handleSend() {
    if (!selected || !leadPhone) return;
    createTemplate.mutate(
      {
        conversationId,
        leadPhone,
        templateName: selected.name,
        languageCode: selected.language,
        bodyParameters: bodyParams.length ? bodyParams : undefined,
        headerParameters: headerParams.length ? headerParams : undefined,
        previewBody,
      },
      {
        onSuccess: () => {
          toast.success("Template enviado.");
          onOpenChange(false);
          setSelectedName(null);
          onSent?.();
        },
        onError: (mutationError) => {
          toast.error(
            mutationError instanceof Error
              ? mutationError.message
              : "Falha ao enviar template.",
          );
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar template</DialogTitle>
          <DialogDescription>
            Templates aprovados na Meta. Use pra reabrir a conversa fora da
            janela de 24h.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
            <Spinner className="size-4" /> Carregando templates…
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : "Erro ao carregar templates."}
          </p>
        ) : templates.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum template aprovado encontrado nesta conta.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <ScrollArea className="max-h-48 rounded-md border">
              <div className="flex flex-col">
                {templates.map((template) => (
                  <button
                    key={`${template.name}-${template.language}`}
                    type="button"
                    disabled={!template.sendable}
                    onClick={() => selectTemplate(template.name)}
                    className={cn(
                      "flex items-start justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-foreground/5 disabled:opacity-50 disabled:cursor-not-allowed",
                      selectedName === template.name && "bg-foreground/10",
                    )}
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">{template.name}</span>
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {template.bodyText}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        {template.language}
                      </Badge>
                      {!template.sendable && (
                        <Badge variant="secondary" className="text-[10px]">
                          mídia/botões
                        </Badge>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>

            {selected && (
              <div className="flex flex-col gap-2">
                {selected.headerVariableCount > 0 && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Variáveis do título</Label>
                    {headerParams.map((value, index) => (
                      <Input
                        key={`header-${index}`}
                        value={value}
                        placeholder={`{{${index + 1}}}`}
                        onChange={(event) =>
                          setHeaderParams((prev) =>
                            prev.map((item, position) =>
                              position === index ? event.target.value : item,
                            ),
                          )
                        }
                      />
                    ))}
                  </div>
                )}
                {selected.bodyVariableCount > 0 && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Variáveis do corpo</Label>
                    {bodyParams.map((value, index) => (
                      <Input
                        key={`body-${index}`}
                        value={value}
                        placeholder={`{{${index + 1}}}`}
                        onChange={(event) =>
                          setBodyParams((prev) =>
                            prev.map((item, position) =>
                              position === index ? event.target.value : item,
                            ),
                          )
                        }
                      />
                    ))}
                  </div>
                )}
                <div className="rounded-md bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
                  {previewBody}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={
              !selected ||
              !leadPhone ||
              !allParamsFilled ||
              createTemplate.isPending
            }
          >
            {createTemplate.isPending ? (
              <Spinner className="size-4" />
            ) : (
              "Enviar template"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
