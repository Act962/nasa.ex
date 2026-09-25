"use client";

import { useState, type ReactNode } from "react";
import {
  CircleDashed as CircleDashedIcon,
  Film as FilmIcon,
  Image as ImageIcon,
  Layers as LayersIcon,
  Plus,
  Video as VideoIcon,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Cartão de escolha do assistente. Só o selecionado abre o conteúdo — é o que
 * mantém uma pergunta por tela em vez de todos os campos ao mesmo tempo.
 */
export function OptionCard({
  title,
  description,
  selected,
  onSelect,
  children,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        selected ? "border-primary bg-primary/5" : "hover:bg-muted/50",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-start gap-3 p-3 text-left"
      >
        <span
          className={cn(
            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-primary" : "border-muted-foreground/40",
          )}
        >
          {selected && <span className="size-2 rounded-full bg-primary" />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          {description && (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {description}
            </span>
          )}
        </span>
      </button>

      {selected && children && (
        <div className="space-y-3 border-t px-3 py-3">{children}</div>
      )}
    </div>
  );
}

export function TermInput({
  label,
  hint,
  placeholder = "Digite e pressione Enter",
  terms,
  onChange,
}: {
  label?: string;
  hint?: string;
  placeholder?: string;
  terms: string[];
  onChange: (terms: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (terms.some((term) => term.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...terms, value]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs">{label}</Label>}
      {terms.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {terms.map((term) => (
            <Badge key={term} variant="secondary" className="gap-1">
              {term}
              <button
                type="button"
                onClick={() => onChange(terms.filter((item) => item !== term))}
                aria-label={`Remover ${term}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={add}>
          <Plus className="size-4" />
        </Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Lista de textos livres, um por linha — usada nas respostas públicas. */
export function TextListInput({
  values,
  placeholder,
  addLabel,
  onChange,
}: {
  values: string[];
  placeholder: string;
  addLabel: string;
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      {values.map((value, index) => (
        <div key={index} className="flex gap-2">
          <Input
            value={value}
            placeholder={placeholder}
            onChange={(event) =>
              onChange(
                values.map((item, position) =>
                  position === index ? event.target.value : item,
                ),
              )
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() =>
              onChange(values.filter((_, position) => position !== index))
            }
            aria-label="Remover resposta"
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        onClick={() => onChange([...values, ""])}
      >
        <Plus className="size-4" />
        {addLabel}
      </Button>
    </div>
  );
}

export function PanelSectionTitle({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[11px] font-medium">
        {index}
      </span>
      <h4 className="text-sm font-medium">{children}</h4>
    </div>
  );
}

const CONTENT_LABELS: Record<string, string> = {
  IMAGE: "Imagem",
  VIDEO: "Vídeo",
  CAROUSEL: "Carrossel",
  REEL: "Reel",
  STORY: "Story",
  OTHER: "Publicação",
};

const CONTENT_ICONS: Record<string, LucideIcon> = {
  IMAGE: ImageIcon,
  VIDEO: VideoIcon,
  CAROUSEL: LayersIcon,
  REEL: FilmIcon,
  STORY: CircleDashedIcon,
  OTHER: ImageIcon,
};

/**
 * Miniatura da publicação.
 *
 * As URLs de mídia da Meta expiram, então a imagem falhar é caso normal, não
 * excepcional: cai para o ícone do tipo em vez de deixar um quadrado quebrado.
 */
export function ContentThumb({
  contentType = "OTHER",
  mediaUrl,
  caption,
  className,
  showLabel = false,
}: {
  contentType?: string;
  mediaUrl?: string | null;
  caption?: string | null;
  className?: string;
  showLabel?: boolean;
}) {
  const [hasImage, setHasImage] = useState(Boolean(mediaUrl));
  const Icon = CONTENT_ICONS[contentType] ?? ImageIcon;
  const label = CONTENT_LABELS[contentType] ?? CONTENT_LABELS.OTHER;

  return (
    <div
      className={cn(
        "relative flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted/40",
        className,
      )}
      title={caption ?? label}
    >
      {hasImage && mediaUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt={caption ?? label}
            className="size-full object-cover"
            onError={() => setHasImage(false)}
          />
          {contentType !== "IMAGE" && (
            <span className="absolute bottom-1 right-1 rounded bg-black/60 p-0.5">
              <Icon className="size-3 text-white" />
            </span>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-1 p-1 text-muted-foreground">
          <Icon className="size-4" />
          {showLabel && (
            <span className="text-[10px] leading-none">{label}</span>
          )}
        </div>
      )}
    </div>
  );
}
