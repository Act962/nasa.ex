"use client";

import { useEffect, useRef, useState } from "react";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { useMutationUpdateForm } from "./use-form";

export type AutoSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 800;
const HISTORY_DEBOUNCE_MS = 350;

/**
 * Liga auto-save + histórico no builder de formulário:
 *  - Snapshot do estado é empilhado a cada mudança (com debounce curto pra
 *    coalescer rajadas de updates) — base do undo/redo.
 *  - A cada mudança, agenda salvamento server-side com debounce maior.
 *  - Atalhos Cmd/Ctrl+Z (undo) e Cmd/Ctrl+Shift+Z (redo).
 *
 * Implementação: usa refs pra função/objetos estáveis (mutate, push) e timers,
 * evitando que re-renders causados por `setStatus` cancelem os timers via
 * cleanup do useEffect.
 */
export function useFormAutosave() {
  const {
    formData,
    blockLayouts,
    pushHistorySnapshot,
    undo,
    redo,
    isApplyingHistory,
  } = useBuilderStore();

  const mutate = useMutationUpdateForm();
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Refs estáveis pra valores e funções
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerializedRef = useRef<string>("");
  const initializedRef = useRef(false);
  const blocksRef = useRef(blockLayouts);
  const settingsRef = useRef(formData?.settings ?? null);
  const mutateRef = useRef(mutate);
  const pushRef = useRef(pushHistorySnapshot);

  // Mantém refs atualizadas a cada render — não dispara efeitos
  useEffect(() => {
    blocksRef.current = blockLayouts;
  }, [blockLayouts]);
  useEffect(() => {
    settingsRef.current = formData?.settings ?? null;
  }, [formData?.settings]);
  useEffect(() => {
    mutateRef.current = mutate;
  });
  useEffect(() => {
    pushRef.current = pushHistorySnapshot;
  });

  const settings = formData?.settings;
  const formId = formData?.id;

  // Inicialização: empilha snapshot inicial quando o form carrega
  useEffect(() => {
    if (!formId) return;
    if (initializedRef.current) return;
    initializedRef.current = true;
    pushRef.current();
    lastSerializedRef.current = JSON.stringify({ blockLayouts, settings });
  }, [formId, blockLayouts, settings]);

  // Watcher: detecta mudança e agenda snapshot/save com debounce.
  // IMPORTANTE: este efeito NÃO tem cleanup que cancele os timers, porque
  // re-renders causados por setStatus iriam cancelar os timers que acabamos
  // de agendar. Os timers vivem em refs e só são cancelados quando agendamos
  // outros (ou no unmount, abaixo).
  useEffect(() => {
    if (!formId || !initializedRef.current) return;
    if (isApplyingHistory) return;

    const serialized = JSON.stringify({ blockLayouts, settings });
    if (serialized === lastSerializedRef.current) return;
    lastSerializedRef.current = serialized;

    setStatus("dirty");

    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      pushRef.current();
    }, HISTORY_DEBOUNCE_MS);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const currentSettings = settingsRef.current;
      const currentBlocks = blocksRef.current;
      if (!formId) return;
      setStatus("saving");
      mutateRef.current.mutate(
        {
          id: formId,
          jsonBlock: JSON.stringify(currentBlocks),
          ...(currentSettings && {
            settings: {
              primaryColor: currentSettings.primaryColor,
              backgroundColor: currentSettings.backgroundColor,
              backgroundImage: currentSettings.backgroundImage,
              trackingId: currentSettings.trackingId,
              statusId: currentSettings.statusId,
              showName: currentSettings.showName,
              showEmail: currentSettings.showEmail,
              showPhone: currentSettings.showPhone,
              needLogin: currentSettings.needLogin,
              finishMessage: currentSettings.finishMessage,
              redirectUrl: currentSettings.redirectUrl,
              idPixel: currentSettings.idPixel,
              idTagManager: currentSettings.idTagManager,
              validateWhatsapp: ((currentSettings as unknown) as {
                validateWhatsapp?: boolean;
              }).validateWhatsapp,
              stepMode:
                ((currentSettings as unknown) as { stepMode?: string })
                  .stepMode || "off",
              nextButtonLabel:
                ((currentSettings as unknown) as {
                  nextButtonLabel?: string;
                }).nextButtonLabel || "Próximo",
              ...(Array.isArray(
                ((currentSettings as unknown) as {
                  progressMascots?: unknown;
                }).progressMascots,
              ) && {
                progressMascots: ((currentSettings as unknown) as {
                  progressMascots?: Array<{
                    min: number;
                    max: number;
                    label: string;
                    emoji?: string;
                    imageUrl?: string;
                  }>;
                }).progressMascots,
              }),
              ...(typeof ((currentSettings as unknown) as {
                nextButtonAction?: unknown;
              }).nextButtonAction === "object" &&
              ((currentSettings as unknown) as {
                nextButtonAction?: unknown;
              }).nextButtonAction !== null
                ? {
                    nextButtonAction: ((currentSettings as unknown) as {
                      nextButtonAction?: {
                        type:
                          | "next_block"
                          | "form"
                          | "external_link"
                          | "add_tag";
                        formId?: string | null;
                        externalUrl?: string | null;
                        tagId?: string | null;
                        passLeadData?: boolean;
                      };
                    }).nextButtonAction,
                  }
                : {}),
            },
          }),
        },
        {
          onSuccess: () => {
            setStatus("saved");
            setLastSavedAt(new Date());
          },
          onError: () => setStatus("error"),
        },
      );
    }, DEBOUNCE_MS);
  }, [blockLayouts, settings, formId, isApplyingHistory]);

  // Limpeza só no unmount real do componente
  useEffect(() => {
    return () => {
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Atalhos de teclado: Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z ou Y (redo)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === "z" && e.shiftKey) {
        if (isEditable) return;
        e.preventDefault();
        redo();
      } else if (key === "z") {
        if (isEditable) return;
        e.preventDefault();
        undo();
      } else if (key === "y") {
        if (isEditable) return;
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return { status, lastSavedAt };
}
