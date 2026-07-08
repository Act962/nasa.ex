"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  CornerUpLeft,
  Copy,
  ExternalLink,
  Loader2,
  Phone,
  Plus,
  Trash2,
  Variable,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DEFAULT_TEMPLATE_LANGUAGE,
  HEADER_MEDIA_ACCEPT,
  TEMPLATE_LANGUAGES,
  TEMPLATE_LIMITS,
} from "../../lib/template-constants";
import {
  countVariables,
  extractVariableNumbers,
  validateTemplateInput,
} from "../../lib/build-template-components";
import type { CreateTemplateInput } from "../../schema/template-schemas";
import { useCreateTemplate, useUploadTemplateSample } from "../../hooks/use-templates";
import {
  WhatsAppPreview,
  type PreviewButton,
  type PreviewHeader,
} from "./whatsapp-preview";

type HeaderState =
  | { type: "NONE" }
  | { type: "TEXT"; text: string; example: string }
  | {
      type: "IMAGE" | "VIDEO" | "DOCUMENT";
      handle: string | null;
      fileName: string | null;
      uploading: boolean;
    }
  | { type: "LOCATION" };

type ButtonState =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; urlType: "STATIC" | "DYNAMIC"; url: string; example: string }
  | { type: "PHONE_NUMBER"; text: string; phoneNumber: string }
  | { type: "COPY_CODE"; example: string };

const HEADER_OPTIONS = [
  { value: "NONE", label: "Nenhum" },
  { value: "TEXT", label: "Texto" },
  { value: "IMAGE", label: "Imagem" },
  { value: "VIDEO", label: "Vídeo" },
  { value: "DOCUMENT", label: "Documento" },
  { value: "LOCATION", label: "Localização" },
] as const;

function renderWithExamples(text: string, examples: string[]): string {
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (token, rawIndex) => {
    const value = examples[Number(rawIndex) - 1];
    return value?.trim() ? value : token;
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function TemplateBuilder({
  trackingId,
  trackingName,
}: {
  trackingId: string;
  trackingName: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [language, setLanguage] = useState<string>(DEFAULT_TEMPLATE_LANGUAGE);
  const [header, setHeader] = useState<HeaderState>({ type: "NONE" });
  const [bodyText, setBodyText] = useState("");
  const [bodyExamples, setBodyExamples] = useState<string[]>([]);
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<ButtonState[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const createTemplate = useCreateTemplate(trackingId);
  const uploadSample = useUploadTemplateSample();

  function handleBodyChange(text: string) {
    setBodyText(text);
    const variableCount = extractVariableNumbers(text).length;
    setBodyExamples((current) => {
      const next = current.slice(0, variableCount);
      while (next.length < variableCount) next.push("");
      return next;
    });
  }

  function addBodyVariable() {
    const nextIndex = extractVariableNumbers(bodyText).length + 1;
    handleBodyChange(`${bodyText}{{${nextIndex}}}`);
  }

  function changeHeaderType(type: string) {
    if (type === "TEXT") setHeader({ type: "TEXT", text: "", example: "" });
    else if (type === "IMAGE" || type === "VIDEO" || type === "DOCUMENT")
      setHeader({ type, handle: null, fileName: null, uploading: false });
    else if (type === "LOCATION") setHeader({ type: "LOCATION" });
    else setHeader({ type: "NONE" });
  }

  async function handleMediaFile(file: File) {
    if (header.type !== "IMAGE" && header.type !== "VIDEO" && header.type !== "DOCUMENT")
      return;
    const format = header.type;
    setHeader({ type: format, handle: null, fileName: file.name, uploading: true });
    try {
      const base64 = await fileToBase64(file);
      const result = await uploadSample.mutateAsync({
        trackingId,
        format,
        base64,
        mimetype: file.type,
        filename: file.name,
      });
      setHeader({ type: format, handle: result.handle, fileName: file.name, uploading: false });
      toast.success("Amostra enviada");
    } catch (error) {
      setHeader({ type: format, handle: null, fileName: null, uploading: false });
      toast.error(
        error instanceof Error ? error.message : "Falha ao enviar a amostra",
      );
    }
  }

  function addButton(type: ButtonState["type"]) {
    setButtons((current) => {
      if (current.length >= TEMPLATE_LIMITS.maxButtons) return current;
      if (type === "QUICK_REPLY") return [...current, { type, text: "" }];
      if (type === "URL")
        return [...current, { type, text: "", urlType: "STATIC", url: "", example: "" }];
      if (type === "PHONE_NUMBER")
        return [...current, { type, text: "", phoneNumber: "" }];
      return [...current, { type: "COPY_CODE", example: "" }];
    });
  }

  function updateButton(index: number, patch: Partial<ButtonState>) {
    setButtons((current) =>
      current.map((button, buttonIndex) =>
        buttonIndex === index ? ({ ...button, ...patch } as ButtonState) : button,
      ),
    );
  }

  function removeButton(index: number) {
    setButtons((current) => current.filter((_, buttonIndex) => buttonIndex !== index));
  }

  const urlButtonCount = buttons.filter((button) => button.type === "URL").length;
  const phoneButtonCount = buttons.filter(
    (button) => button.type === "PHONE_NUMBER",
  ).length;
  const copyButtonCount = buttons.filter(
    (button) => button.type === "COPY_CODE",
  ).length;

  const input = useMemo<CreateTemplateInput>(() => {
    const schemaHeader: CreateTemplateInput["header"] =
      header.type === "TEXT"
        ? { type: "TEXT", text: header.text, example: header.example || undefined }
        : header.type === "IMAGE" || header.type === "VIDEO" || header.type === "DOCUMENT"
          ? { type: header.type, handle: header.handle ?? "" }
          : header.type === "LOCATION"
            ? { type: "LOCATION" }
            : { type: "NONE" };

    return {
      name,
      language,
      category: "MARKETING",
      header: schemaHeader,
      body: { text: bodyText, examples: bodyExamples },
      footer: footer.trim() || undefined,
      buttons: buttons.map((button) => ({ ...button })) as CreateTemplateInput["buttons"],
    };
  }, [name, language, header, bodyText, bodyExamples, footer, buttons]);

  const validationErrors = useMemo(() => {
    const errors = validateTemplateInput(input);
    if (!name) errors.unshift("Dê um nome ao modelo.");
    if (!/^[a-z0-9_]+$/.test(name) && name)
      errors.unshift("O nome só aceita minúsculas, números e underscore.");
    if (!bodyText.trim()) errors.unshift("O corpo é obrigatório.");
    if (
      (header.type === "IMAGE" || header.type === "VIDEO" || header.type === "DOCUMENT") &&
      !header.handle
    )
      errors.push("Envie a amostra de mídia do cabeçalho.");
    return errors;
  }, [input, name, bodyText, header]);

  const previewHeader = useMemo<PreviewHeader>(() => {
    if (header.type === "TEXT")
      return {
        kind: "text",
        text: renderWithExamples(header.text, header.example ? [header.example] : []),
      };
    if (header.type === "IMAGE" || header.type === "VIDEO" || header.type === "DOCUMENT")
      return { kind: "media", format: header.type, fileName: header.fileName };
    if (header.type === "LOCATION") return { kind: "location" };
    return { kind: "none" };
  }, [header]);

  const previewButtons = useMemo<PreviewButton[]>(
    () =>
      buttons.map((button) => ({
        type: button.type,
        label: button.type === "COPY_CODE" ? "Copiar código" : button.text,
      })),
    [buttons],
  );

  function handleSubmit() {
    setSubmitted(true);
    if (validationErrors.length > 0) {
      toast.error(validationErrors[0]);
      return;
    }
    createTemplate.mutate(
      { trackingId, ...input },
      {
        onSuccess: () => {
          toast.success("Modelo enviado para análise da Meta");
          router.push(`/campanhas/templates?trackingId=${trackingId}`);
        },
        onError: (error) => {
          toast.error(error.message ?? "Não foi possível criar o modelo");
        },
      },
    );
  }

  const bodyVariableCount = countVariables(bodyText);
  const headerHasVariable = header.type === "TEXT" && countVariables(header.text) === 1;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        {/* Categoria + número */}
        <section className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
              Marketing
            </Badge>
            <span className="text-sm text-muted-foreground">
              via {trackingName}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Modelos de marketing servem pra promoções, ofertas e novidades.
            Requer opt-in do contato e passa por análise da Meta.
          </p>
        </section>

        {/* Nome + idioma */}
        <section className="flex flex-col gap-4 rounded-lg border p-4">
          <h2 className="text-sm font-semibold">Nome e idioma do modelo</h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="template-name">Nome</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
                  )
                }
                placeholder="promo_julho"
                maxLength={TEMPLATE_LIMITS.name}
              />
              <span className="text-xs text-muted-foreground">
                Só minúsculas, números e underscore.
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Idioma</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_LANGUAGES.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Conteúdo */}
        <section className="flex flex-col gap-5 rounded-lg border p-4">
          <h2 className="text-sm font-semibold">Conteúdo</h2>

          {/* Header */}
          <div className="flex flex-col gap-2">
            <Label>Cabeçalho · opcional</Label>
            <Select value={header.type} onValueChange={changeHeaderType}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEADER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {header.type === "TEXT" && (
              <div className="flex flex-col gap-2">
                <Input
                  value={header.text}
                  onChange={(event) =>
                    setHeader({ ...header, text: event.target.value })
                  }
                  placeholder="Título do cabeçalho"
                  maxLength={TEMPLATE_LIMITS.headerText}
                />
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={headerHasVariable}
                    onClick={() =>
                      setHeader({ ...header, text: `${header.text}{{1}}` })
                    }
                  >
                    <Variable className="size-3.5" /> Adicionar variável
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {header.text.length}/{TEMPLATE_LIMITS.headerText}
                  </span>
                </div>
                {headerHasVariable && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Exemplo de {"{{1}}"}</Label>
                    <Input
                      value={header.example}
                      onChange={(event) =>
                        setHeader({ ...header, example: event.target.value })
                      }
                      placeholder="Ex: João"
                    />
                  </div>
                )}
              </div>
            )}

            {(header.type === "IMAGE" ||
              header.type === "VIDEO" ||
              header.type === "DOCUMENT") && (
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={HEADER_MEDIA_ACCEPT[header.type]}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleMediaFile(file);
                    event.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  disabled={header.uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {header.uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {header.fileName ? "Trocar amostra" : "Enviar amostra"}
                </Button>
                {header.fileName && (
                  <span className="text-xs text-muted-foreground">
                    {header.fileName}
                    {header.handle ? " · pronto" : ""}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  A amostra é usada só na análise da Meta. No disparo, cada
                  contato pode receber uma mídia própria (Fase 3).
                </span>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-body">Corpo</Label>
            <Textarea
              id="template-body"
              value={bodyText}
              onChange={(event) => handleBodyChange(event.target.value)}
              placeholder="Escreva a mensagem. Use {{1}}, {{2}}… para personalizar."
              rows={5}
              maxLength={TEMPLATE_LIMITS.bodyText}
            />
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={addBodyVariable}
              >
                <Variable className="size-3.5" /> Adicionar variável
              </Button>
              <span className="text-xs text-muted-foreground">
                {bodyText.length}/{TEMPLATE_LIMITS.bodyText}
              </span>
            </div>

            {bodyVariableCount > 0 && (
              <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-3">
                <span className="text-xs font-medium">
                  Exemplos das variáveis
                </span>
                {Array.from({ length: bodyVariableCount }).map((_, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-xs text-muted-foreground">
                      {`{{${index + 1}}}`}
                    </span>
                    <Input
                      value={bodyExamples[index] ?? ""}
                      onChange={(event) =>
                        setBodyExamples((current) => {
                          const next = [...current];
                          next[index] = event.target.value;
                          return next;
                        })
                      }
                      placeholder={`Exemplo para {{${index + 1}}}`}
                      className="h-8"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-footer">Rodapé · opcional</Label>
            <Input
              id="template-footer"
              value={footer}
              onChange={(event) => setFooter(event.target.value)}
              placeholder="Uma linha curta no fim da mensagem"
              maxLength={TEMPLATE_LIMITS.footerText}
            />
            <span className="self-end text-xs text-muted-foreground">
              {footer.length}/{TEMPLATE_LIMITS.footerText}
            </span>
          </div>
        </section>

        {/* Botões */}
        <section className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Botões · opcional</h2>
              <p className="text-xs text-muted-foreground">
                Até {TEMPLATE_LIMITS.maxButtons} botões pra respostas rápidas ou
                chamadas para ação.
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={buttons.length >= TEMPLATE_LIMITS.maxButtons}
                >
                  <Plus className="size-4" /> Adicionar botão
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => addButton("QUICK_REPLY")}>
                  <CornerUpLeft className="size-4" /> Resposta rápida
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={urlButtonCount >= TEMPLATE_LIMITS.maxUrlButtons}
                  onSelect={() => addButton("URL")}
                >
                  <ExternalLink className="size-4" /> Acessar site
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={phoneButtonCount >= TEMPLATE_LIMITS.maxPhoneButtons}
                  onSelect={() => addButton("PHONE_NUMBER")}
                >
                  <Phone className="size-4" /> Ligar
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={copyButtonCount >= TEMPLATE_LIMITS.maxCopyCodeButtons}
                  onSelect={() => addButton("COPY_CODE")}
                >
                  <Copy className="size-4" /> Copiar código da oferta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {buttons.length > 0 && (
            <div className="flex flex-col gap-3">
              {buttons.map((button, index) => (
                <ButtonEditor
                  key={index}
                  button={button}
                  onChange={(patch) => updateButton(index, patch)}
                  onRemove={() => removeButton(index)}
                />
              ))}
            </div>
          )}

          {buttons.length > 3 && (
            <p className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
              Você adicionou mais de 3 botões. Todos entram numa lista de botões;
              os 2 primeiros também aparecem direto na mensagem.
            </p>
          )}
        </section>

        {submitted && validationErrors.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {validationErrors.map((message) => (
              <li key={message}>• {message}</li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/campanhas/templates?trackingId=${trackingId}`)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={createTemplate.isPending}
          >
            {createTemplate.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Enviar para análise
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <h2 className="text-sm font-semibold">Prévia do modelo</h2>
          <WhatsAppPreview
            header={previewHeader}
            body={renderWithExamples(bodyText, bodyExamples)}
            footer={footer.trim() || undefined}
            buttons={previewButtons}
          />
        </div>
      </div>
    </div>
  );
}

function ButtonEditor({
  button,
  onChange,
  onRemove,
}: {
  button: ButtonState;
  onChange: (patch: Partial<ButtonState>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{BUTTON_LABEL[button.type]}</Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {button.type === "QUICK_REPLY" && (
        <Input
          value={button.text}
          onChange={(event) => onChange({ text: event.target.value })}
          placeholder="Texto do botão"
          maxLength={TEMPLATE_LIMITS.quickReplyText}
        />
      )}

      {button.type === "PHONE_NUMBER" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={button.text}
            onChange={(event) => onChange({ text: event.target.value })}
            placeholder="Texto do botão"
            maxLength={TEMPLATE_LIMITS.phoneButtonText}
          />
          <Input
            value={button.phoneNumber}
            onChange={(event) => onChange({ phoneNumber: event.target.value })}
            placeholder="+55 11 99999-9999"
          />
        </div>
      )}

      {button.type === "COPY_CODE" && (
        <Input
          value={button.example}
          onChange={(event) => onChange({ example: event.target.value })}
          placeholder="Código de exemplo (ex: PROMO10)"
          maxLength={TEMPLATE_LIMITS.copyCodeText}
        />
      )}

      {button.type === "URL" && (
        <div className="flex flex-col gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={button.text}
              onChange={(event) => onChange({ text: event.target.value })}
              placeholder="Texto do botão"
              maxLength={TEMPLATE_LIMITS.urlButtonText}
            />
            <Select
              value={button.urlType}
              onValueChange={(value) =>
                onChange({ urlType: value as "STATIC" | "DYNAMIC" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STATIC">URL estática</SelectItem>
                <SelectItem value="DYNAMIC">URL dinâmica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            value={button.url}
            onChange={(event) => onChange({ url: event.target.value })}
            placeholder={
              button.urlType === "DYNAMIC"
                ? "https://site.com/promo/{{1}}"
                : "https://site.com/promo"
            }
            maxLength={TEMPLATE_LIMITS.url}
          />
          {button.urlType === "DYNAMIC" && (
            <Input
              value={button.example}
              onChange={(event) => onChange({ example: event.target.value })}
              placeholder="Exemplo do valor de {{1}} (ex: abc123)"
            />
          )}
        </div>
      )}
    </div>
  );
}

const BUTTON_LABEL: Record<ButtonState["type"], string> = {
  QUICK_REPLY: "Resposta rápida",
  URL: "Acessar site",
  PHONE_NUMBER: "Ligar",
  COPY_CODE: "Copiar código",
};
