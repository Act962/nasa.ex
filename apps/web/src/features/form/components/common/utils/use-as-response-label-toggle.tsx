"use client";

import { Switch } from "@/components/ui/switch";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import type { FormBlockInstance } from "@/features/form/types";

/**
 * Toggle "Usar valor como título da resposta".
 *
 * Quando ligado em um bloco de input simples (TextField, MaskedField,
 * Dropdown, TextArea, DatePicker), o **valor** preenchido nesse bloco
 * passa a ser copiado pro campo `label` da `FormResponses` no submit/save.
 * Aparece como sufixo no nome (ex: "Checklist · #00123").
 *
 * Apenas UM bloco pode estar marcado por form (a UI permite múltiplos,
 * mas `deriveResponseLabel` server-side pega só o primeiro em ordem de
 * DOM). Override manual via lápis na página de respostas prevalece sobre
 * essa auto-derivação.
 */
export function UseAsResponseLabelToggle({
  parentId,
  blockInstance,
}: {
  parentId: string;
  blockInstance: FormBlockInstance;
}) {
  const { updateChildBlock } = useBuilderStore();
  const attrs = (blockInstance.attributes ?? {}) as {
    useAsResponseLabel?: boolean;
  };
  const enabled = attrs.useAsResponseLabel === true;

  function commit(value: boolean) {
    updateChildBlock(parentId, blockInstance.id, {
      ...blockInstance,
      attributes: {
        ...(blockInstance.attributes ?? {}),
        useAsResponseLabel: value,
      },
    });
  }

  return (
    <div className="px-4 pt-3 pb-1">
      <div className="rounded-md border border-foreground/10 bg-foreground/[0.03] p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium">
            Usar valor como título da resposta
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={commit}
            aria-label="Usar valor como título da resposta"
          />
        </div>
        <p className="text-[11px] text-muted-foreground leading-tight">
          Quando ligado, o que o usuário preencher aqui vira sufixo no nome
          da resposta (ex: <strong>Checklist · #00123</strong>). Útil pra
          identificar respostas pela O.S, número de pedido, placa, etc.
        </p>
      </div>
    </div>
  );
}
