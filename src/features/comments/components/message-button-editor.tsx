"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Limite da Meta para o rótulo do botão. */
export const MAX_BUTTON_TITLE_CHARS = 20;

export type MessageButtonValue = { title: string; url: string };

/**
 * Normaliza o que a pessoa digita: `nasaex.com` vira `https://nasaex.com`.
 * Sem isso, colar um domínio sem esquema derrubava o botão na validação — e o
 * motivo não aparecia em lugar nenhum.
 */
export function normalizeButtonUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function validateButton(button: MessageButtonValue): string | null {
  const title = button.title.trim();
  if (!title) return "Dê um título ao botão.";
  if (Array.from(title).length > MAX_BUTTON_TITLE_CHARS) {
    return `O título passa de ${MAX_BUTTON_TITLE_CHARS} caracteres.`;
  }

  const url = normalizeButtonUrl(button.url);
  if (!url) return "Informe o link que o botão abre.";
  try {
    new URL(url);
  } catch {
    return "O link não é uma URL válida.";
  }
  return null;
}

/**
 * Editor do botão em **popover ancorado na linha**, não em modal.
 *
 * São dois campos: escurecer a tela inteira e tirar o fluxo de vista para
 * preencher um título e um link custa mais atenção do que o conteúdo merece.
 * O popover mantém o canvas visível e fecha ao clicar fora.
 */
export function MessageButtonEditor({
  open,
  value,
  onOpenChange,
  onConfirm,
  onDelete,
  children,
}: {
  open: boolean;
  value: MessageButtonValue;
  onOpenChange: (open: boolean) => void;
  onConfirm: (value: MessageButtonValue) => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const [draft, setDraft] = useState(value);
  const [touched, setTouched] = useState(false);

  // O editor é reaproveitado entre botões — sem isto o segundo abriria com o
  // rascunho do primeiro.
  useEffect(() => {
    if (open) {
      setDraft(value);
      setTouched(false);
    }
  }, [open, value]);

  const error = validateButton(draft);
  const titleLength = Array.from(draft.title).length;

  const confirm = () => {
    const normalized = {
      title: draft.title.trim(),
      url: normalizeButtonUrl(draft.url),
    };
    if (validateButton(normalized)) {
      setTouched(true);
      return;
    }
    onConfirm(normalized);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={12}
        className="w-80 space-y-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Título do botão</Label>
            <span
              className={cn(
                "text-[11px]",
                titleLength > MAX_BUTTON_TITLE_CHARS
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {titleLength}/{MAX_BUTTON_TITLE_CHARS}
            </span>
          </div>
          <Input
            autoFocus
            value={draft.title}
            placeholder="Quero saber mais"
            onChange={(event) =>
              setDraft((current) => ({ ...current, title: event.target.value }))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                confirm();
              }
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs">
            <ExternalLink className="size-3.5" />
            Quando o botão for tocado, abrir
          </Label>
          <Input
            value={draft.url}
            placeholder="https://seusite.com"
            onChange={(event) =>
              setDraft((current) => ({ ...current, url: event.target.value }))
            }
            onBlur={() => {
              setTouched(true);
              setDraft((current) => ({
                ...current,
                url: normalizeButtonUrl(current.url),
              }));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                confirm();
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Link é o único tipo de botão que a Meta aceita na resposta privada a
            um comentário.
          </p>
        </div>

        {touched && error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
            Excluir
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={Boolean(error)}
            onClick={confirm}
          >
            Concluído
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
