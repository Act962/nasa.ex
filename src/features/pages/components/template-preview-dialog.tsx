"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Rocket, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { DIALOG_AS_MOBILE_BOTTOM_SHEET_CLASSES } from "../lib/mobile-sheet-classes";
import { ElementRenderer } from "./elements/element-renderer";
import { applyTemplate, type PageTemplate } from "../lib/page-templates";
import { RocketLoader } from "./rocket-loader";
import { isFlowSection } from "../lib/section-flow";
import type { ElementType } from "../types";
// Importa o CSS de animações no escopo do dialog pra que sections com
// `nasa-pages-anim-*` rodem mesmo aqui (separado do public-page-view).
import "../lib/animations.css";

const TEMPLATE_RENDER_WIDTH_PX = 1280;

/** Escala da prévia pela largura disponível (nunca maior que 1): sem rolagem lateral no celular. */
function usePreviewScale() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    if (!container) return;
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) setPreviewScale(Math.min(1, entry.contentRect.width / TEMPLATE_RENDER_WIDTH_PX));
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [container]);

  return { containerRef: setContainer, previewScale };
}

/**
 * Dialog de pré-visualização do template ANTES de debitar Stars e
 * criar a page de fato.
 *
 * Mostra o template renderizado em modo "landing" (mesmo motor do
 * public-page-view) num container scrollável. User decide:
 *   - "Criar landing page" → executa createPage + updatePage + debita
 *   - "Cancelar" → fecha sem custo
 *
 * Durante o processamento (isApplying), substitui o conteúdo pelo
 * RocketLoader com frases divertidas.
 */
export function TemplatePreviewDialog({
  open,
  onOpenChange,
  template,
  onConfirm,
  isApplying,
  costStars,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: PageTemplate | null;
  onConfirm: () => void;
  isApplying: boolean;
  costStars: number;
}) {
  const { containerRef, previewScale } = usePreviewScale();
  if (!template) return null;

  const applied = applyTemplate(template.id);
  const elements = applied?.elements ?? [];
  const flowElements = elements
    .filter((el) => isFlowSection(el.type as ElementType))
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0));

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isApplying && onOpenChange(isOpen)}>
      <DialogContent
        className={cn("flex max-h-[92dvh] flex-col gap-0 p-0 sm:max-w-5xl", DIALOG_AS_MOBILE_BOTTOM_SHEET_CLASSES)}
      >
        {/* Header */}
        <DialogHeader className="px-5 pt-6 pb-4 shrink-0 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-info" />
            {isApplying
              ? "Criando sua landing…"
              : `Pré-visualização: ${template.name}`}
          </DialogTitle>
          {!isApplying && (
            <DialogDescription>
              Veja como vai ficar antes de gastar Stars. Você pode editar
              tudo depois.
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Body */}
        {isApplying ? (
          <div className="dark min-h-[400px] bg-background flex items-center justify-center flex-1">
            <RocketLoader
              title="Preparando sua landing page"
              subtitle="Pode demorar alguns segundos. Não feche essa janela."
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Stats do template */}
            <div className="px-5 py-3 bg-muted/30 flex items-center gap-2 flex-wrap text-xs shrink-0 sm:px-6">
              <Badge variant="outline" className="gap-1 rounded-full">
                <Eye className="size-3" /> {flowElements.length} blocos
              </Badge>
              <Badge variant="outline" className="gap-1 rounded-full">
                <span
                  className="size-2 rounded-full"
                  style={{ background: template.tokens.primary }}
                />
                Cor primária
              </Badge>
              <Badge variant="outline" className="rounded-full">{template.category}</Badge>
            </div>

            {/* Renderiza em 1280px (como no computador) e reduz pela largura disponível com `zoom`. */}
            <div
              ref={containerRef}
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-panel"
              style={{ height: "65vh" }}
            >
              {flowElements.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Template sem blocos pra renderizar.
                </div>
              ) : (
                <div
                  className="mx-auto"
                  style={{
                    width: TEMPLATE_RENDER_WIDTH_PX,
                    background: template.tokens.bg,
                    zoom: previewScale,
                  }}
                >
                  {flowElements.map((el, idx) => (
                    <div
                      key={el.id ?? idx}
                      className="w-full"
                      data-preview-block={el.type}
                    >
                      <ElementRenderer
                        element={el}
                        readonly
                        tokens={
                          applied
                            ? { colors: applied.tokens }
                            : undefined
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        {!isApplying && (
          <DialogFooter className="px-5 py-4 gap-2 sm:gap-2 flex-col sm:flex-row sm:items-center shrink-0 sm:px-6">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-full max-sm:hidden sm:order-1"
            >
              Cancelar
            </Button>
            <div className="text-xs text-muted-foreground text-center sm:flex-1 sm:text-right sm:order-2 sm:mr-3">
              Custo:{" "}
              <strong className="text-foreground">
                {costStars.toLocaleString("pt-BR")} Stars
              </strong>
              <span> · </span>
              Volta sem custo se você apagar antes de publicar
            </div>
            <Button
              onClick={onConfirm}
              className="h-12 w-full gap-2 rounded-full sm:order-3 sm:h-10 sm:w-auto"
            >
              <Rocket className="size-4" />
              Criar landing page
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
