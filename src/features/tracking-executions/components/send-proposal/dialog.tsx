"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { SendAppActionBaseDialog } from "../send-app-actions/base-dialog";
import { ResourceSelect } from "../send-app-actions/resource-select";
import { orpc } from "@/lib/orpc";
import type { SendProposalData } from "./executor";

/**
 * Dialog SEND_PROPOSAL — diferente dos outros porque tem 2 selects:
 *  - **Produtos** (multi-select via checkboxes — ForgeProduct[])
 *  - **Responsável** (select único — Member.user)
 *  - **Validade em dias** (input numérico)
 *  - **Template de mensagem** (textarea opcional)
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: SendProposalData;
  onSubmit: (values: SendProposalData) => void;
}

const DEFAULT_MSG =
  "Olá {{nome}}, sua proposta nº {{numero}} no valor de {{valor}}, válida até {{validade}}: {{url}}";

interface ForgeProductItem {
  id: string;
  name: string;
  value: string | number;
}
interface MemberItem {
  id: string;
  name: string;
  email: string;
}

export function SendProposalDialog({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
}: Props) {
  const [productIds, setProductIds] = useState<string[]>(
    defaultValues?.productIds ?? [],
  );
  const [responsibleId, setResponsibleId] = useState(
    defaultValues?.responsibleId ?? "",
  );
  const [validityDays, setValidityDays] = useState(
    String(defaultValues?.validityDays ?? 7),
  );
  const [messageTemplate, setMessageTemplate] = useState(
    defaultValues?.messageTemplate ?? "",
  );

  useEffect(() => {
    if (open) {
      setProductIds(defaultValues?.productIds ?? []);
      setResponsibleId(defaultValues?.responsibleId ?? "");
      setValidityDays(String(defaultValues?.validityDays ?? 7));
      setMessageTemplate(defaultValues?.messageTemplate ?? "");
    }
  }, [open, defaultValues]);

  // Multi-select de produtos — checkbox list
  const productsQuery = useQuery(
    orpc.forge.products.list.queryOptions({ input: {} }),
  );
  const products = (productsQuery.data as any)?.products as
    | ForgeProductItem[]
    | undefined;

  const toggleProduct = (id: string) => {
    setProductIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  };

  const canSubmit = productIds.length > 0 && responsibleId.trim().length > 0;

  return (
    <SendAppActionBaseDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Enviar Proposta"
      description="Cria proposta vinculada ao lead com produtos + responsável e envia link."
      messageTemplate={messageTemplate}
      onMessageTemplateChange={setMessageTemplate}
      defaultMessagePreview={DEFAULT_MSG}
      extraVariables={[
        "{{numero}}",
        "{{valor}}",
        "{{produtos}}",
        "{{validade}}",
      ]}
      canSubmit={canSubmit}
      onSubmit={() =>
        onSubmit({
          productIds,
          responsibleId: responsibleId.trim(),
          validityDays: parseInt(validityDays, 10) || 7,
          messageTemplate: messageTemplate.trim() || undefined,
        })
      }
    >
      <div className="space-y-2">
        <Label>Produtos</Label>
        <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1.5">
          {productsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="size-3.5 animate-spin" />
              Carregando produtos…
            </div>
          ) : !products?.length ? (
            <div className="text-xs text-muted-foreground py-2">
              Nenhum produto cadastrado.
            </div>
          ) : (
            products.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 px-2 py-1 rounded text-sm"
              >
                <Checkbox
                  checked={productIds.includes(p.id)}
                  onCheckedChange={() => toggleProduct(p.id)}
                />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  R$ {Number(p.value).toFixed(2)}
                </span>
              </label>
            ))
          )}
        </div>
        {productIds.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {productIds.length} produto(s) selecionado(s)
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="responsibleId">Responsável</Label>
        <ResourceSelect
          queryOptions={orpc.orgs.listMembers.queryOptions({
            input: { query: {} },
          })}
          getItems={(d: any) => d?.members ?? []}
          getId={(it: MemberItem) => it.id}
          getLabel={(it: MemberItem) => `${it.name} (${it.email})`}
          value={responsibleId}
          onValueChange={setResponsibleId}
          placeholder="Selecione um responsável"
          emptyMessage="Nenhum membro encontrado."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="validityDays">Validade (dias)</Label>
        <Input
          id="validityDays"
          type="number"
          min={1}
          value={validityDays}
          onChange={(e) => setValidityDays(e.target.value)}
        />
      </div>
    </SendAppActionBaseDialog>
  );
}
