"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import { FormPrefillProvider } from "@/features/form/context/form-prefill-context";
import type { FieldValue, FormBlockInstance, FormSettingsTyped } from "@/features/form/types";
import type { FormSettings } from "@/generated/prisma/client";

/**
 * Visão rápida de uma ficha (spec 0075, RF-9): o formulário inteiro em
 * leitura, renderizado pelos próprios blocos e reduzido por escala para caber
 * no diálogo. Usada na lista interna e na página do cliente.
 */

/** Largura em que o formulário é desenhado antes de reduzir: a mesma da ficha aberta. */
const SHEET_WIDTH_PX = 760;
const MAX_SHEET_SCALE = 0.8;

/** Escala que faz a ficha caber na largura disponível, sem rolagem lateral. */
function useFitScale() {
  const [scale, setScale] = useState(MAX_SHEET_SCALE);
  const containerRef = useCallback((container: HTMLDivElement | null) => {
    if (!container) return;
    const fit = () => setScale(Math.min(MAX_SHEET_SCALE, container.clientWidth / SHEET_WIDTH_PX));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  return { scale, containerRef };
}

export function parseResponseValues(jsonResponse: unknown): Record<string, FieldValue> {
  let parsed: unknown = jsonResponse;
  if (typeof jsonResponse === "string") {
    try {
      parsed = JSON.parse(jsonResponse);
    } catch {
      return {};
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const values: Record<string, FieldValue> = {};
  for (const [blockId, rawEntry] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof rawEntry === "string") {
      values[blockId] = { value: rawEntry };
      continue;
    }
    const entry = rawEntry as { value?: unknown; meta?: Record<string, unknown> } | null;
    if (entry && typeof entry.value === "string") values[blockId] = { value: entry.value, meta: entry.meta };
  }
  return values;
}

export function parseFormBlocks(jsonBlock: unknown): FormBlockInstance[] {
  if (Array.isArray(jsonBlock)) return jsonBlock as FormBlockInstance[];
  if (typeof jsonBlock !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(jsonBlock);
    return Array.isArray(parsed) ? (parsed as FormBlockInstance[]) : [];
  } catch {
    return [];
  }
}

export function FormRecordQuickView({
  isOpen,
  onOpenChange,
  title,
  subtitle,
  recordKey,
  blocks,
  settings,
  responseValues,
  isLoading,
  actions,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  subtitle?: string;
  /** Muda a cada ficha: reinicia o estado interno dos blocos. */
  recordKey: string;
  blocks: FormBlockInstance[];
  settings?: FormSettings | FormSettingsTyped | null;
  responseValues: Record<string, FieldValue>;
  isLoading?: boolean;
  actions?: ReactNode;
}) {
  const { scale, containerRef } = useFitScale();
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-[680px] flex-col gap-3 p-4 sm:max-w-[680px]">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="break-words text-base">{title}</DialogTitle>
          <DialogDescription className="break-words">{subtitle ?? "Visão rápida da ficha, somente leitura."}</DialogDescription>
        </DialogHeader>

        <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-md border bg-background">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner />
            </div>
          ) : blocks.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Não consegui carregar esta ficha.</p>
          ) : (
            // `zoom` reduz o desenho inteiro mantendo a proporção da ficha; o
            // `inert` tira tudo da navegação por teclado, e o
            // `pointer-events-none` garante a leitura mesmo onde `inert` não vale.
            <div
              inert
              // Em leitura, os botões de +/− das listas de itens só confundem.
              className="pointer-events-none p-4 [&_[data-record-stepper]]:hidden"
              style={{ width: SHEET_WIDTH_PX, zoom: scale }}
            >
              <FormPrefillProvider key={recordKey} values={responseValues} sessionKey={`quick-view-${recordKey}`}>
                <div className="flex flex-col gap-4">
                  {blocks.map((block) => {
                    const BlockForm = FormBlocks[block.blockType]?.formComponent;
                    if (!BlockForm) return null;
                    return <BlockForm key={block.id} blockInstance={block} settings={settings} />;
                  })}
                </div>
              </FormPrefillProvider>
            </div>
          )}
        </div>

        {actions && <div className="flex shrink-0 flex-wrap justify-end gap-2">{actions}</div>}
      </DialogContent>
    </Dialog>
  );
}
