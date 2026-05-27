"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { SendAppActionBaseDialog } from "../send-app-actions/base-dialog";
import { ResourceSelect } from "../send-app-actions/resource-select";
import { orpc } from "@/lib/orpc";
import type { SendNboxData } from "./executor";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: SendNboxData;
  onSubmit: (values: SendNboxData) => void;
}

const DEFAULT_MSG =
  "Olá {{nome}}, segue o arquivo {{arquivo_nome}}: {{url}}";

export function SendNboxDialog({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
}: Props) {
  const [nboxItemId, setNboxItemId] = useState(defaultValues?.nboxItemId ?? "");
  const [messageTemplate, setMessageTemplate] = useState(
    defaultValues?.messageTemplate ?? "",
  );

  useEffect(() => {
    if (open) {
      setNboxItemId(defaultValues?.nboxItemId ?? "");
      setMessageTemplate(defaultValues?.messageTemplate ?? "");
    }
  }, [open, defaultValues]);

  return (
    <SendAppActionBaseDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Enviar Arquivo N-Box"
      description="Garante o arquivo público e envia link de download pro lead."
      messageTemplate={messageTemplate}
      onMessageTemplateChange={setMessageTemplate}
      defaultMessagePreview={DEFAULT_MSG}
      extraVariables={["{{arquivo_nome}}", "{{arquivo_tipo}}"]}
      canSubmit={nboxItemId.trim().length > 0}
      onSubmit={() =>
        onSubmit({
          nboxItemId: nboxItemId.trim(),
          messageTemplate: messageTemplate.trim() || undefined,
        })
      }
    >
      <div className="space-y-2">
        <Label htmlFor="nboxItemId">Arquivo N-Box</Label>
        <ResourceSelect
          queryOptions={orpc.nbox.items.getMany.queryOptions({ input: {} })}
          getItems={(d: any) => d?.items ?? []}
          getId={(it: any) => it.id}
          getLabel={(it: any) =>
            `${it.name}${it.mimeType ? ` (${it.mimeType})` : ""}`
          }
          value={nboxItemId}
          onValueChange={setNboxItemId}
          placeholder="Selecione um arquivo"
          emptyMessage="Nenhum arquivo encontrado."
        />
        <p className="text-[10px] text-muted-foreground">
          Ao executar, o arquivo será marcado como público (se ainda não for).
        </p>
      </div>
    </SendAppActionBaseDialog>
  );
}
