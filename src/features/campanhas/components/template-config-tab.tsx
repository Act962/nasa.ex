"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTemplates } from "../hooks/use-templates";
import { useSetBroadcastTemplate } from "../hooks/use-broadcasts";
import { languageLabel } from "../lib/template-constants";
import type { BroadcastTemplateParam } from "../schema/broadcast-schemas";

interface AttachedTemplate {
  templateName: string | null;
  templateLanguage: string | null;
  templateCategory: "MARKETING" | "UTILITY" | "AUTHENTICATION" | null;
  templateVariables: unknown;
}

interface TemplateConfigTabProps {
  broadcastId: string;
  trackingId: string;
  readOnly: boolean;
  attached: AttachedTemplate;
}

const SOURCE_OPTIONS: Array<{ value: BroadcastTemplateParam["source"]; label: string }> = [
  { value: "static", label: "Texto fixo" },
  { value: "recipientName", label: "Nome do contato" },
  { value: "recipientPhone", label: "Telefone do contato" },
  { value: "customField", label: "Campo da planilha" },
];

function templateKey(name: string, language: string): string {
  return `${name}::${language}`;
}

function readSavedBody(variables: unknown): BroadcastTemplateParam[] {
  if (!variables || typeof variables !== "object") return [];
  const body = (variables as { body?: unknown }).body;
  return Array.isArray(body) ? (body as BroadcastTemplateParam[]) : [];
}

export function TemplateConfigTab({
  broadcastId,
  trackingId,
  readOnly,
  attached,
}: TemplateConfigTabProps) {
  const { data, isLoading } = useTemplates(trackingId);
  const setTemplate = useSetBroadcastTemplate();

  const approved = useMemo(
    () => (data?.templates ?? []).filter((template) => template.status === "APPROVED"),
    [data],
  );

  const initialKey =
    attached.templateName && attached.templateLanguage
      ? templateKey(attached.templateName, attached.templateLanguage)
      : "";
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const [body, setBody] = useState<BroadcastTemplateParam[]>(() =>
    readSavedBody(attached.templateVariables),
  );

  const selected = approved.find(
    (template) => templateKey(template.name, template.language) === selectedKey,
  );

  function handleSelect(key: string) {
    setSelectedKey(key);
    const template = approved.find(
      (item) => templateKey(item.name, item.language) === key,
    );
    const count = template?.variableCount ?? 0;
    const saved = readSavedBody(attached.templateVariables);
    setBody(
      Array.from({ length: count }, (_, index) =>
        saved[index] ?? { source: "static", value: "" },
      ),
    );
  }

  function updateParam(index: number, patch: Partial<BroadcastTemplateParam>) {
    setBody((current) =>
      current.map((param, position) =>
        position === index ? { ...param, ...patch } : param,
      ),
    );
  }

  function handleSave() {
    if (!selected) return;
    setTemplate.mutate(
      {
        broadcastId,
        templateName: selected.name,
        templateLanguage: selected.language,
        templateCategory: selected.category as
          | "MARKETING"
          | "UTILITY"
          | "AUTHENTICATION",
        mapping: { header: [], body },
      },
      {
        onSuccess: () => toast.success("Modelo salvo na campanha."),
        onError: (error) => toast.error(error.message ?? "Falha ao salvar o modelo."),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (approved.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum modelo aprovado neste número. Crie e aguarde a aprovação da Meta
        em <span className="font-medium text-foreground">Modelos</span>.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Modelo aprovado</label>
        <Select value={selectedKey} onValueChange={handleSelect} disabled={readOnly}>
          <SelectTrigger className="w-full sm:w-96">
            <SelectValue placeholder="Escolha um modelo aprovado" />
          </SelectTrigger>
          <SelectContent>
            {approved.map((template) => (
              <SelectItem
                key={templateKey(template.name, template.language)}
                value={templateKey(template.name, template.language)}
              >
                {template.name} · {languageLabel(template.language)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected && (
        <>
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {selected.category === "UTILITY" ? "Utilidade" : "Marketing"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {selected.variableCount} variável(is) no corpo
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{selected.bodyText || "—"}</p>
          </div>

          {body.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Variáveis do corpo</p>
              {body.map((param, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
                >
                  <span className="w-14 shrink-0 font-mono text-sm text-muted-foreground">
                    {`{{${index + 1}}}`}
                  </span>
                  <Select
                    value={param.source}
                    onValueChange={(value) =>
                      updateParam(index, {
                        source: value as BroadcastTemplateParam["source"],
                      })
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger className="w-full sm:w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(param.source === "static" || param.source === "customField") && (
                    <Input
                      value={param.value}
                      disabled={readOnly}
                      onChange={(event) =>
                        updateParam(index, { value: event.target.value })
                      }
                      placeholder={
                        param.source === "static"
                          ? "Texto fixo"
                          : "Nome da coluna na planilha"
                      }
                      className="flex-1"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {!readOnly && (
            <div>
              <Button onClick={handleSave} disabled={setTemplate.isPending}>
                {setTemplate.isPending ? "Salvando..." : "Salvar modelo"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
