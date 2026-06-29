"use client";

/**
 * NerpFinancialToggle — placeholder pra Fase 2+. Persiste a flag
 * `Organization.nerpFinancialEnabled` (sem sync real ainda).
 *
 * Quando o NERP expor API de faturas/recebimentos:
 *   - Orgs com `enabled=true` recebem replicação automática
 *   - Webhooks NERP→NASA aterrissam em `/api/sync/nerp` (já existe pra auth)
 *   - Modelos `NasaInvoiceMapping` etc serão adicionados em outra fase.
 *
 * Apenas Master pode tocar — server-side garante via OrgRole check.
 */

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Link2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useOrgRole } from "@/hooks/use-org-role";

export function NerpFinancialToggle() {
  const { isMaster } = useOrgRole();
  const qc = useQueryClient();
  const flagQuery = useQuery(orpc.payment.nerp.getFlag.queryOptions({ input: {} }));
  const updateMut = useMutation({
    ...orpc.payment.nerp.updateFlag.mutationOptions(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment", "nerp"] }),
  });

  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (flagQuery.data) setEnabled(flagQuery.data.enabled);
  }, [flagQuery.data]);

  function handleToggle(next: boolean) {
    setEnabled(next); // optimistic
    updateMut.mutate(
      { enabled: next },
      {
        onSuccess: () => toast.success(next ? "Integração NERP ativada" : "Integração NERP desativada"),
        onError: (err) => {
          setEnabled(!next);
          toast.error(err.message ?? "Erro");
        },
      },
    );
  }

  return (
    <Card className="p-4 border-dashed">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-md bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
          <Link2 className="size-4" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Integração NERP — Financeiro</p>
            <Switch
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={!isMaster || updateMut.isPending || flagQuery.isLoading}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>Em breve:</strong> sincronização de faturas, recebimentos e
            conciliação com NERP. Hoje a flag só fica persistida — deixa sua org
            "preparada" pra plugar quando a API estiver disponível.
          </p>
          {!isMaster && (
            <p className="text-[11px] text-muted-foreground italic">
              Somente Master pode alterar.
            </p>
          )}
          {updateMut.isPending && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" /> Salvando…
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
