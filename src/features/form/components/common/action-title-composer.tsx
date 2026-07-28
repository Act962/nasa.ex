"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlusIcon, XIcon } from "lucide-react";
import type { FormBlockInstance, FormBlockType } from "@/features/form/types";
import { listFillableFields } from "@/features/form/lib/list-fillable-fields";
import type { TitleToken } from "@/features/form/lib/generate-actions-config";

type Props = {
  blocks: FormBlockInstance[];
  value: TitleToken[];
  onChange: (tokens: TitleToken[]) => void;
};

// Só campos de TEXTO podem compor o título (nada de imagem, arquivo, assinatura,
// heading, etc.). Selects simples entram porque resolvem para um valor textual.
const TEXT_TITLE_TYPES = new Set<FormBlockType>([
  "TextField",
  "TextArea",
  "MaskedField",
  "Url",
  "Dropdown",
  "RadioSelect",
]);

/**
 * Compositor do título da action: sequência de tokens (campos do form + texto
 * literal). Guarda `blockId` (rename-safe); o label é resolvido ao vivo. Emite
 * `TitleToken[]`. Não reusa o VariablePicker `{{}}` (lista fixa nome/phone/email).
 */
export function ActionTitleComposer({ blocks, value, onChange }: Props) {
  const fields = useMemo(() => listFillableFields(blocks), [blocks]);
  const labelById = useMemo(
    () => new Map(fields.map((field) => [field.id, field.label])),
    [fields],
  );
  // Só oferece campos de texto E obrigatórios: a action não pode ficar sem
  // título, então o campo escolhido precisa estar sempre preenchido.
  const insertableFields = useMemo(
    () =>
      fields.filter(
        (field) => TEXT_TITLE_TYPES.has(field.blockType) && field.required,
      ),
    [fields],
  );
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addField = (blockId: string) => {
    onChange([...value, { type: "field", blockId }]);
    setDraft("");
    inputRef.current?.focus();
  };

  // Commita o texto digitado como um segmento literal (Enter ou blur).
  const commitDraft = () => {
    if (draft.length === 0) return;
    onChange([...value, { type: "literal", text: draft }]);
    setDraft("");
  };

  const removeAt = (index: number) =>
    onChange(value.filter((_, position) => position !== index));

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      event.preventDefault();
      onChange(value.slice(0, -1));
    }
  };

  const preview = value
    .map((token) =>
      token.type === "literal"
        ? token.text
        : `{${labelById.get(token.blockId) ?? "campo"}}`,
    )
    .join("");

  return (
    <div className="space-y-2">
      <div
        className="flex min-h-10 cursor-text flex-wrap items-center gap-1 rounded-md border p-2 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault();
            inputRef.current?.focus();
          }
        }}
      >
        {value.map((token, index) =>
          token.type === "field" ? (
            <span
              key={`field-${index}`}
              className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
            >
              {labelById.get(token.blockId) ?? "campo removido"}
              <button
                type="button"
                onClick={() => removeAt(index)}
                className="text-primary/60 hover:text-primary"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ) : (
            <span
              key={`literal-${index}`}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs"
            >
              <span className="whitespace-pre">{token.text}</span>
              <button
                type="button"
                onClick={() => removeAt(index)}
                className="text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ),
        )}

        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          placeholder={
            value.length === 0 ? "Digite um texto ou insira um campo…" : ""
          }
          className="min-w-[80px] flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-8">
            <PlusIcon className="size-3.5" />
            Inserir campo
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
          {insertableFields.length === 0 ? (
            <DropdownMenuItem disabled>
              Nenhum campo de texto obrigatório
            </DropdownMenuItem>
          ) : (
            insertableFields.map((field) => (
              <DropdownMenuItem
                key={field.id}
                onClick={() => addField(field.id)}
              >
                {field.label}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Prévia: <span className="text-foreground">{preview}</span>
        </p>
      )}
    </div>
  );
}
