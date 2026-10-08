"use client";

import type { ReactNode } from "react";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { renderTemplateText } from "@/features/campanhas/lib/template-variables";
import { useWhatsAppTemplates } from "@/features/tracking-chat/hooks/use-whatsapp-templates";

// Seletor de template aprovado da API Oficial para os passos de automação
// (spec 0077): usado no "Enviar Mensagem" do editor e do modo rápido.

const templateParameterSchema = z.string().trim().min(1, "Preencha a variável");

/**
 * Formato do template salvo num nó. `headerText`/`bodyText` são uma cópia do
 * texto do modelo: a Meta não devolve o corpo no envio.
 */
export const templateSelectionShape = {
  templateName: z.string().min(1, "Selecione um template"),
  languageCode: z.string().min(1, "Selecione um template"),
  headerText: z.string().nullable().optional(),
  bodyText: z.string().optional(),
  headerParameters: z.array(templateParameterSchema).optional(),
  bodyParameters: z.array(templateParameterSchema).optional(),
};

export const templateSelectionSchema = z.object(templateSelectionShape);

export interface WorkflowTemplateSelection {
  templateName: string;
  languageCode: string;
  headerText: string | null;
  bodyText: string;
  headerParameters: string[];
  bodyParameters: string[];
}

export const INCOMPLETE_TEMPLATE_MESSAGE =
  "Escolha um template e preencha todas as variáveis.";

export type TemplateParameterInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isInvalid: boolean;
};

interface WorkflowTemplateFieldsProps {
  trackingId: string;
  value: Partial<WorkflowTemplateSelection> | null | undefined;
  onChange: (selection: WorkflowTemplateSelection) => void;
  /** Marca em vermelho template não escolhido e variáveis vazias. */
  showValidation?: boolean;
  parameterPlaceholder?: string;
  renderParameterInput?: (props: TemplateParameterInputProps) => ReactNode;
  isCompact?: boolean;
}

const TEMPLATE_KEY_SEPARATOR = "::";

function toTemplateKey(templateName: string, languageCode: string): string {
  return `${templateName}${TEMPLATE_KEY_SEPARATOR}${languageCode}`;
}

export function readTemplateSelection(
  value: Partial<WorkflowTemplateSelection> | null | undefined,
): WorkflowTemplateSelection {
  return {
    templateName: value?.templateName ?? "",
    languageCode: value?.languageCode ?? "",
    headerText: value?.headerText ?? null,
    bodyText: value?.bodyText ?? "",
    headerParameters: value?.headerParameters ?? [],
    bodyParameters: value?.bodyParameters ?? [],
  };
}

export function isTemplateSelectionComplete(
  value: Partial<WorkflowTemplateSelection> | null | undefined,
): boolean {
  const selection = readTemplateSelection(value);
  return (
    selection.templateName.length > 0 &&
    [...selection.headerParameters, ...selection.bodyParameters].every(
      (parameter) => parameter.trim().length > 0,
    )
  );
}

export function WorkflowTemplateFields({
  trackingId,
  value,
  onChange,
  showValidation = false,
  parameterPlaceholder = "Texto fixo ou variável",
  renderParameterInput,
  isCompact = false,
}: WorkflowTemplateFieldsProps) {
  const { data, isLoading, error } = useWhatsAppTemplates(trackingId);
  const templates = data?.templates ?? [];
  const selection = readTemplateSelection(value);
  const selectedKey = selection.templateName
    ? toTemplateKey(selection.templateName, selection.languageCode)
    : "";

  const handleSelectTemplate = (templateKey: string) => {
    const template = templates.find(
      (item) => toTemplateKey(item.name, item.language) === templateKey,
    );
    if (!template) return;
    onChange({
      templateName: template.name,
      languageCode: template.language,
      headerText: template.headerText,
      bodyText: template.bodyText,
      headerParameters: Array(template.headerVariableCount).fill(""),
      bodyParameters: Array(template.bodyVariableCount).fill(""),
    });
  };

  const updateParameter = (
    section: "headerParameters" | "bodyParameters",
    parameterIndex: number,
    parameterValue: string,
  ) => {
    onChange({
      ...selection,
      [section]: selection[section].map((current, position) =>
        position === parameterIndex ? parameterValue : current,
      ),
    });
  };

  const renderParameter = (
    section: "headerParameters" | "bodyParameters",
    sectionLabel: string,
    parameterValue: string,
    parameterIndex: number,
  ) => {
    const inputProps: TemplateParameterInputProps = {
      value: parameterValue,
      onChange: (nextValue) => updateParameter(section, parameterIndex, nextValue),
      placeholder: parameterPlaceholder,
      isInvalid: showValidation && parameterValue.trim().length === 0,
    };
    return (
      <div key={`${section}-${parameterIndex}`} className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">
          {`${sectionLabel} — variável {{${parameterIndex + 1}}}`}
        </Label>
        {renderParameterInput ? (
          renderParameterInput(inputProps)
        ) : (
          <Input
            value={inputProps.value}
            onChange={(event) => inputProps.onChange(event.target.value)}
            placeholder={inputProps.placeholder}
            aria-invalid={inputProps.isInvalid}
            className={cn(isCompact && "h-8 text-xs")}
          />
        )}
      </div>
    );
  };

  const previewText = [
    selection.headerText
      ? renderTemplateText(selection.headerText, selection.headerParameters)
      : null,
    renderTemplateText(selection.bodyText, selection.bodyParameters),
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className={cn("flex flex-col", isCompact ? "gap-1.5" : "gap-3")}>
      <Select
        value={selectedKey}
        onValueChange={handleSelectTemplate}
        disabled={isLoading || templates.length === 0}
      >
        <SelectTrigger
          size={isCompact ? "sm" : "default"}
          aria-invalid={showValidation && !selection.templateName}
          className={cn(isCompact && "h-8 text-xs")}
        >
          <SelectValue
            placeholder={
              isLoading
                ? "Carregando..."
                : templates.length === 0
                  ? "Nenhum template aprovado"
                  : "Escolha um template aprovado"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => (
            <SelectItem
              key={toTemplateKey(template.name, template.language)}
              value={toTemplateKey(template.name, template.language)}
              disabled={!template.sendable}
            >
              {template.name} · {template.language}
              {!template.sendable && " (mídia/botões — ainda não suportado)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {error && (
        <p className="text-xs text-destructive">
          {error.message || "Erro ao carregar os templates."}
        </p>
      )}
      {showValidation && !isTemplateSelectionComplete(selection) && (
        <p className="text-xs text-destructive">{INCOMPLETE_TEMPLATE_MESSAGE}</p>
      )}

      {selection.headerParameters.map((parameterValue, parameterIndex) =>
        renderParameter("headerParameters", "Título", parameterValue, parameterIndex),
      )}
      {selection.bodyParameters.map((parameterValue, parameterIndex) =>
        renderParameter("bodyParameters", "Corpo", parameterValue, parameterIndex),
      )}

      {selection.templateName && (
        <div
          className={cn(
            "rounded-md bg-muted px-3 py-2 whitespace-pre-wrap",
            isCompact ? "text-xs" : "text-sm",
          )}
        >
          {previewText}
        </div>
      )}
    </div>
  );
}
