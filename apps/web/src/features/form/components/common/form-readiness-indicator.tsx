"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import {
  computeFormReadiness,
  type FormReadiness,
} from "@/features/form/lib/form-readiness";
import { cn } from "@/lib/utils";

/**
 * Badge que mostra "% pronto" pra publicar. Clicar abre popover com a
 * lista detalhada dos blocos com problema — o user vê EXATAMENTE o
 * que falta pra chegar a 100%.
 *
 * Também publica `formInvalidBlockIds` no `window` pra que o
 * `form-block-box` aplique borda vermelha nos blocos quebrados — assim
 * o user identifica visualmente no canvas.
 */
export function FormReadinessIndicator() {
  const { blockLayouts, handleSelectedLayout } = useBuilderStore();
  const [open, setOpen] = useState(false);

  const readiness: FormReadiness = useMemo(
    () => computeFormReadiness(blockLayouts),
    [blockLayouts],
  );

  // Expõe IDs inválidos globalmente pra form-block-box destacar.
  if (typeof window !== "undefined") {
    (window as unknown as { __formInvalidBlockIds?: Set<string> })
      .__formInvalidBlockIds = readiness.invalidIds;
    window.dispatchEvent(new CustomEvent("form:readiness-changed"));
  }

  const isReady = readiness.percent === 100;
  const color = isReady
    ? "text-emerald-600 border-emerald-500/40 bg-emerald-500/10"
    : readiness.percent >= 60
      ? "text-amber-600 border-amber-500/40 bg-amber-500/10"
      : "text-red-600 border-red-500/40 bg-red-500/10";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "gap-1.5 h-8 px-2 text-xs font-medium",
            color,
          )}
          title="Veja o que falta pra publicar"
        >
          {isReady ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5" />
          )}
          {readiness.percent}%
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-semibold">
              {isReady ? "Formulário pronto" : "Pronto pra publicar?"}
            </p>
            <span className="text-xs text-muted-foreground">
              {readiness.passed}/{readiness.totalChecks}
            </span>
          </div>
          <Progress value={readiness.percent} className="h-1.5" />
          {!isReady && (
            <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
              Os blocos abaixo estão sem alguma informação. Clique pra editar.
            </p>
          )}
        </div>

        {isReady ? (
          <div className="p-4 text-center text-sm text-emerald-700">
            <CheckCircle2 className="mx-auto mb-1 w-5 h-5" />
            Tudo certo! Você pode publicar o formulário.
          </div>
        ) : (
          <ul className="max-h-72 overflow-auto divide-y">
            {readiness.problems.map((p) => (
              <li key={p.blockId}>
                <button
                  type="button"
                  onClick={() => {
                    // Tenta encontrar o layout que contém esse bloco e
                    // selecioná-lo no inspector — assim o user já cai na
                    // tela de edição certa.
                    const target = blockLayouts.find(
                      (b) =>
                        b.id === p.blockId ||
                        b.childblocks?.some((c) => c.id === p.blockId),
                    );
                    if (target) handleSelectedLayout(target);
                    setOpen(false);
                  }}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {p.blockType === "__empty__" ? "Sem blocos" : p.blockType}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {p.message}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
