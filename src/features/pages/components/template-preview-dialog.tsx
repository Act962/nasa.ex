"use client";

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
import { ElementRenderer } from "./elements/element-renderer";
import { applyTemplate, type PageTemplate } from "../lib/page-templates";
import { RocketLoader } from "./rocket-loader";
import { isFlowSection } from "../lib/section-flow";
import type { ElementType } from "../types";
// Importa o CSS de animações no escopo do dialog pra que sections com
// `nasa-pages-anim-*` rodem mesmo aqui (separado do public-page-view).
import "../lib/animations.css";

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
  if (!template) return null;

  const applied = applyTemplate(template.id);
  const elements = applied?.elements ?? [];
  const flowElements = elements
    .filter((el) => isFlowSection(el.type as ElementType))
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0));

  return (
    <Dialog open={open} onOpenChange={(o) => !isApplying && onOpenChange(o)}>
      <DialogContent className="max-w-5xl max-h-[92vh] p-0 gap-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-violet-500" />
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
          <div className="min-h-[400px] bg-zinc-950 flex items-center justify-center flex-1">
            <RocketLoader
              title="Preparando sua landing page"
              subtitle="Pode demorar alguns segundos. Não feche essa janela."
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Stats do template */}
            <div className="px-6 py-3 border-b bg-muted/30 flex items-center gap-3 flex-wrap text-xs shrink-0">
              <Badge variant="outline" className="gap-1">
                <Eye className="size-3" /> {flowElements.length} blocos
              </Badge>
              <Badge variant="outline" className="gap-1">
                <span
                  className="size-2 rounded-full"
                  style={{ background: template.tokens.primary }}
                />
                Cor primária
              </Badge>
              <Badge variant="outline">{template.category}</Badge>
              <span className="ml-auto text-muted-foreground">
                Estilo "{template.intent}"
              </span>
            </div>

            {/* Preview renderizado em "viewport desktop simulado".
                Container interno tem largura fixa de 1280px pra que
                media queries das sections (md:, lg:) funcionem
                corretamente. Usuário pode rolar horizontal se o dialog
                for menor (no mobile do builder), e o conteúdo é visto
                exatamente como aparece no desktop publicado.
                Scroll vertical interno separado pra ver tudo. */}
            <div
              className="flex-1 min-h-0 overflow-auto bg-zinc-900"
              style={{ height: "65vh" }}
            >
              {flowElements.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Template sem blocos pra renderizar.
                </div>
              ) : (
                <div
                  className="bg-white dark:bg-zinc-950 mx-auto"
                  style={{ width: 1280, minWidth: 1280 }}
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
          <DialogFooter className="px-6 py-4 border-t gap-2 sm:gap-2 flex-col sm:flex-row shrink-0">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="sm:order-1"
            >
              Cancelar
            </Button>
            <div className="text-xs text-muted-foreground sm:flex-1 sm:text-right sm:order-2 sm:mr-3">
              Custo:{" "}
              <strong className="text-foreground">
                {costStars.toLocaleString("pt-BR")} ★
              </strong>
              <br className="sm:hidden" />
              <span className="hidden sm:inline"> · </span>
              Reverte sem custo se você apagar antes de publicar
            </div>
            <Button
              onClick={onConfirm}
              className="gap-2 sm:order-3"
              size="lg"
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
