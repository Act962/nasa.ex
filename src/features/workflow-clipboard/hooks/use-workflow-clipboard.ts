"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { BlueprintV2 } from "../lib/types";

const STORAGE_KEY = "nasa_workflow_clipboard_v1";

/**
 * Clipboard híbrido pra workflows:
 *
 *  - `localStorage` é a fonte primária dentro da mesma sessão/navegador
 *    (sem dependência de permissão). Persiste entre refresh.
 *  - `navigator.clipboard.writeText` é usado em paralelo pra permitir
 *    Cmd+V em outro tab/browser/máquina (cross-device). Best-effort.
 *  - `navigator.clipboard.readText` é tentado no paste — se falhar
 *    (permissão negada ou tabular), cai pro localStorage.
 *
 * Detecção: blueprints são wrapped num envelope `{nasaWorkflowClipboard:1, payload}`
 * pro paste saber distinguir conteúdo aleatório do clipboard.
 */
export function useWorkflowClipboard() {
  const [hasClipboard, setHasClipboard] = useState(false);

  // Detecta presença de blueprint no localStorage ao montar
  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasClipboard(!!localStorage.getItem(STORAGE_KEY));
    // Escuta storage events de outros tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setHasClipboard(!!e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const writeBlueprint = useCallback(async (blueprint: BlueprintV2) => {
    if (typeof window === "undefined") return;
    const envelope = JSON.stringify({
      nasaWorkflowClipboard: 1,
      payload: blueprint,
    });
    localStorage.setItem(STORAGE_KEY, envelope);
    setHasClipboard(true);
    // Best-effort: writeText. Pode falhar se não houver permission;
    // não bloqueia o fluxo principal.
    try {
      await navigator.clipboard.writeText(envelope);
    } catch {
      // Sem permissão de clipboard — segue só com localStorage.
    }
  }, []);

  const readBlueprint = useCallback(async (): Promise<BlueprintV2 | null> => {
    if (typeof window === "undefined") return null;
    // Tenta clipboard primeiro — fonte mais recente
    try {
      const text = await navigator.clipboard.readText();
      const parsed = tryParseEnvelope(text);
      if (parsed) return parsed;
    } catch {
      // Permission denied ou contexto não-seguro — segue pro fallback
    }
    // Fallback: localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return tryParseEnvelope(stored);
  }, []);

  const clearClipboard = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
    setHasClipboard(false);
  }, []);

  const exportAsFile = useCallback(
    (blueprint: BlueprintV2, fileName: string) => {
      const blob = new Blob([JSON.stringify(blueprint, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    [],
  );

  const importFromFile = useCallback(async (): Promise<BlueprintV2 | null> => {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        try {
          const text = await file.text();
          const parsed = tryParseEnvelope(text) ?? tryParseRaw(text);
          if (!parsed) {
            toast.error("Arquivo inválido — não é um blueprint do NASA");
            return resolve(null);
          }
          resolve(parsed);
        } catch (err) {
          toast.error("Erro ao ler arquivo");
          console.error(err);
          resolve(null);
        }
      };
      input.click();
    });
  }, []);

  return {
    hasClipboard,
    writeBlueprint,
    readBlueprint,
    clearClipboard,
    exportAsFile,
    importFromFile,
  };
}

/**
 * Aceita o formato envelope ({nasaWorkflowClipboard:1, payload}).
 * Valida campos mínimos do payload.
 */
function tryParseEnvelope(text: string): BlueprintV2 | null {
  try {
    const obj = JSON.parse(text);
    if (
      obj &&
      typeof obj === "object" &&
      obj.nasaWorkflowClipboard === 1 &&
      obj.payload?.formatVersion === 1 &&
      Array.isArray(obj.payload?.nodes)
    ) {
      return obj.payload as BlueprintV2;
    }
  } catch {
    // não é JSON
  }
  return null;
}

/**
 * Aceita formato "cru" — BlueprintV2 sem envelope. Útil pra import via
 * arquivo onde alguém colou só o JSON do blueprint.
 */
function tryParseRaw(text: string): BlueprintV2 | null {
  try {
    const obj = JSON.parse(text);
    if (obj?.formatVersion === 1 && Array.isArray(obj.nodes)) {
      return obj as BlueprintV2;
    }
  } catch {
    // ignore
  }
  return null;
}
