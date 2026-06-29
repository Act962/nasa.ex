"use client";

import { CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FillProgress } from "@/features/form/lib/form-fill-progress";

/**
 * Barra "X% preenchido" exibida no topo da tela de preenchimento do form.
 * Clicar abre lista dos campos obrigatórios faltando — clicar num item
 * faz scroll até o bloco e ele pisca em vermelho.
 *
 * Usado em `form-submit-component.tsx` (submit-form e /formulario).
 */
interface Props {
  progress: FillProgress;
  /** Cores do tema do form (sobrescreve defaults). */
  primaryColor?: string;
  textColor?: string;
  /** Quando o user clica num item da lista, foca o bloco. */
  onFocusBlock?: (blockId: string) => void;
}

export function FormFillProgressBar({
  progress,
  primaryColor,
  textColor,
  onFocusBlock,
}: Props) {
  const { percent, totalRequired, filledRequired, missing } = progress;
  const isComplete = percent === 100;

  if (totalRequired === 0) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-20 w-full rounded-md border px-3 py-2 backdrop-blur-md",
        isComplete
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-amber-500/40 bg-amber-500/10",
      )}
      style={{ color: textColor || undefined }}
    >
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {isComplete ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          )}
          <span className="text-xs font-medium">
            {isComplete
              ? "Tudo preenchido!"
              : `${percent}% preenchido (${filledRequired}/${totalRequired})`}
          </span>
        </div>

        {!isComplete && missing.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] gap-1"
                style={{ color: textColor || undefined }}
              >
                {missing.length} faltando
                <ChevronDown className="w-3 h-3 opacity-70" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
              <div className="border-b px-3 py-2">
                <p className="text-xs font-semibold">Campos obrigatórios</p>
                <p className="text-[11px] text-muted-foreground">
                  Clique pra ir direto ao campo.
                </p>
              </div>
              <ul className="max-h-72 overflow-auto divide-y">
                {missing.map((m) => (
                  <li key={m.blockId}>
                    <button
                      type="button"
                      onClick={() => onFocusBlock?.(m.blockId)}
                      className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                    >
                      <AlertCircle className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">
                          {m.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {m.blockType}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <Progress
        value={percent}
        className="h-1.5"
        style={
          isComplete
            ? undefined
            : ({ "--progress-color": primaryColor } as React.CSSProperties)
        }
      />
    </div>
  );
}
