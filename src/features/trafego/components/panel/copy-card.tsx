import { Check, Pencil, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CopyComplianceBadge } from "./copy-compliance-badge";

export interface TrafegoCopy {
  id: string;
  headline: string | null;
  primaryText: string;
  description: string | null;
  callToAction: string | null;
  isSelected: boolean;
  source?: string;
  complianceLevel?: string | null;
  complianceIssues?: unknown;
}

interface CopyCardProps {
  copy: TrafegoCopy;
  readOnly: boolean;
  onEdit: () => void;
  onToggleSelected: () => void;
  onRemove: () => void;
}

export function CopyCard({
  copy,
  readOnly,
  onEdit,
  onToggleSelected,
  onRemove,
}: CopyCardProps) {
  return (
    <div
      className={cn(
        "rounded-[20px] border bg-card p-4 transition",
        copy.isSelected && "border-primary/50 bg-primary/[0.03]",
      )}
    >
      <div className="min-w-0">
        {copy.headline && (
          <p className="font-semibold leading-snug">{copy.headline}</p>
        )}
        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
          {copy.primaryText}
        </p>
        {copy.description && (
          <p className="mt-1 text-xs text-muted-foreground">
            {copy.description}
          </p>
        )}
        {copy.callToAction && (
          <span className="mt-2 inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium">
            {copy.callToAction}
          </span>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {copy.source === "SUGGESTED_BY_NASA" && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-info">
              <Sparkles className="size-3" />
              Sugerida pelo Astro
            </span>
          )}
          <CopyComplianceBadge
            level={copy.complianceLevel ?? null}
            issues={copy.complianceIssues}
          />
        </div>
      </div>

      {!readOnly && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSelected}
            aria-pressed={copy.isSelected}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition",
              copy.isSelected
                ? "border-primary/50 bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Check className="size-3.5" />
            {copy.isSelected ? "Vai no anúncio" : "Usar no anúncio"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="ml-auto grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Editar texto"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
            aria-label="Remover texto"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
