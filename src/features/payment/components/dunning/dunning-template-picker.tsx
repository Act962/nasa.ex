"use client";

// Modelo aprovado da Meta que o aviso usa fora da janela de 24h (spec 0115, RF-13). Só aparece
// quando o número das cobranças é oficial. Lista os modelos Utilitários enviáveis e liga cada
// {{n}} do corpo a uma variável da régua.

import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWhatsAppTemplates } from "@/features/tracking-chat/hooks/use-whatsapp-templates";
import { DUNNING_VARIABLES } from "../../lib/dunning-presets";

const NO_TEMPLATE = "__none__";
// Ordem de sugestão ao escolher um modelo: o que costuma aparecer primeiro numa cobrança.
const SUGGESTED_PARAM_ORDER = ["{{contato}}", "{{descricao}}", "{{valor}}", "{{vencimento}}", "{{link_pagamento}}"];

export type DunningTemplateSelection = { name: string; language: string; params: string[] } | null;

export function DunningTemplatePicker({
  senderTrackingId,
  value,
  onChange,
}: {
  senderTrackingId: string;
  value: DunningTemplateSelection;
  onChange: (selection: DunningTemplateSelection) => void;
}) {
  const { data, isLoading, error } = useWhatsAppTemplates(senderTrackingId);
  const templates = (data?.templates ?? []).filter(
    (template) => template.category === "UTILITY" && template.sendable && template.headerVariableCount === 0,
  );
  const selected = value ? templates.find((template) => template.name === value.name && template.language === value.language) : undefined;
  const selectedKey = value ? `${value.name}::${value.language}` : NO_TEMPLATE;

  function handleTemplateChange(key: string) {
    if (key === NO_TEMPLATE) return onChange(null);
    const template = templates.find((candidate) => `${candidate.name}::${candidate.language}` === key);
    if (!template) return;
    onChange({
      name: template.name,
      language: template.language,
      params: Array.from({ length: template.bodyVariableCount }, (_, index) => SUGGESTED_PARAM_ORDER[index] ?? "{{contato}}"),
    });
  }

  function handleParamChange(index: number, token: string) {
    if (!value) return;
    const params = [...value.params];
    params[index] = token;
    onChange({ ...value, params });
  }

  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label className="text-xs">Fora da janela de 24h (número oficial)</Label>
          <p className="text-[11px] text-muted-foreground">
            Com a janela aberta sai o texto acima. Fechada, a Meta só aceita um modelo Utilitário aprovado.
          </p>
        </div>
        <Link
          href="/campanhas/templates/new"
          target="_blank"
          className="inline-flex shrink-0 items-center gap-1 text-[11px] text-info hover:underline"
        >
          Criar modelo <ExternalLink className="size-3" />
        </Link>
      </div>

      {error ? (
        <p className="text-[11px] text-destructive">Não foi possível carregar os modelos: {error.message}</p>
      ) : (
        <Select value={selectedKey} onValueChange={handleTemplateChange} disabled={isLoading}>
          <SelectTrigger className="h-9 w-full text-sm">
            <SelectValue placeholder={isLoading ? "Carregando modelos..." : "Escolha um modelo"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_TEMPLATE} className="text-sm">Sem modelo (o aviso falha fora da janela)</SelectItem>
            {templates.map((template) => (
              <SelectItem key={`${template.name}::${template.language}`} value={`${template.name}::${template.language}`} className="text-sm">
                {template.name} · {template.language}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {!isLoading && !error && templates.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Nenhum modelo Utilitário aprovado neste número. Crie um em Campanhas (aprovação leva de minutos a horas).
        </p>
      )}

      {value && !selected && !isLoading && (
        <p className="text-[11px] text-warning">
          O modelo &quot;{value.name}&quot; não está mais aprovado neste número. Escolha outro.
        </p>
      )}

      {selected && value && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 whitespace-pre-wrap rounded-lg bg-background p-2 text-xs">
            <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            {selected.bodyText}
          </div>
          {value.params.map((token, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-12 shrink-0 font-mono text-[11px] text-muted-foreground">{`{{${index + 1}}}`}</span>
              <Select value={token} onValueChange={(nextToken) => handleParamChange(index, nextToken)}>
                <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DUNNING_VARIABLES.map((variable) => (
                    <SelectItem key={variable.token} value={variable.token} className="text-xs">
                      {variable.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
