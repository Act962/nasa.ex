"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import type { FormBlockInstance } from "@/features/form/types";
import { toFieldKey } from "@/features/form-records/lib/record-fields";

/**
 * Configuração de ficha de um campo (spec 0075, RF-5): o nome-chave liga este
 * campo ao de mesmo nome em outro formulário; "pesquisável" o põe na busca;
 * "mostrar na lista" o transforma em coluna da lista de fichas.
 */
export function RecordFieldSettings({
  parentId,
  blockInstance,
  canBeReferenceDate,
}: {
  parentId: string;
  blockInstance: FormBlockInstance;
  canBeReferenceDate: boolean;
}) {
  const { updateChildBlock } = useBuilderStore();
  const attributes = (blockInstance.attributes ?? {}) as {
    fieldKey?: string;
    isSearchable?: boolean;
    showInList?: boolean;
    useAsReferenceDate?: boolean;
  };
  const [fieldKeyText, setFieldKeyText] = useState(attributes.fieldKey ?? "");

  const commit = (partial: typeof attributes) => {
    updateChildBlock(parentId, blockInstance.id, {
      ...blockInstance,
      attributes: { ...(blockInstance.attributes ?? {}), ...partial },
    });
  };

  const hasFieldKey = Boolean(attributes.fieldKey);

  return (
    <div className="px-4 pt-3 pb-1">
      <div className="space-y-2 rounded-md border border-foreground/10 bg-foreground/[0.03] p-3">
        <div className="space-y-1">
          <span className="text-[13px] font-medium">Nome-chave do campo</span>
          <Input
            value={fieldKeyText}
            maxLength={40}
            placeholder="Ex.: placa, modelo, cor"
            aria-label="Nome-chave do campo"
            onChange={(event) => setFieldKeyText(event.target.value)}
            onBlur={() => {
              const fieldKey = toFieldKey(fieldKeyText);
              setFieldKeyText(fieldKey);
              commit({ fieldKey: fieldKey || undefined });
            }}
          />
          <p className="text-[11px] leading-tight text-muted-foreground">
            Dê o mesmo nome-chave em dois formulários para um puxar o dado do outro. Sem nome-chave, o campo fica só neste formulário.
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px]">Pesquisável</span>
          <Switch
            checked={attributes.isSearchable === true}
            disabled={!hasFieldKey}
            aria-label="Campo pesquisável"
            onCheckedChange={(isSearchable) => commit({ isSearchable })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px]">Mostrar na lista de fichas</span>
          <Switch
            checked={attributes.showInList === true}
            disabled={!hasFieldKey}
            aria-label="Mostrar na lista de fichas"
            onCheckedChange={(showInList) => commit({ showInList })}
          />
        </div>
        {canBeReferenceDate && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px]">Usar como data da ficha</span>
            <Switch
              checked={attributes.useAsReferenceDate === true}
              aria-label="Usar como data da ficha"
              onCheckedChange={(useAsReferenceDate) => commit({ useAsReferenceDate })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
