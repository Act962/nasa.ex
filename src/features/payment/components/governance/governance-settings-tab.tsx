"use client";

/**
 * GovernanceSettingsTab — sub-aba do Settings sheet do Payment.
 *
 * Config global por org (PaymentGovernanceConfig):
 *   - `autoApprovalThresholdCents`: valor mínimo (R$) pra disparar aprovação automática
 *   - `payableRequiresApproval`: toggle "todo PAYABLE exige aprovação"
 *   - `notifyApproversAfterHours`: horas até re-notificar aprovadores
 *
 * Apenas Master pode editar. UI mostra alerta caso o user não seja Master.
 */

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  usePaymentGovernanceConfig,
  useUpdatePaymentGovernanceConfig,
} from "../../hooks/use-payment-approvals";
import { useOrgRole } from "@/hooks/use-org-role";

export function GovernanceSettingsTab() {
  const { isMaster } = useOrgRole();
  const { data, isLoading } = usePaymentGovernanceConfig();
  const updateMut = useUpdatePaymentGovernanceConfig();

  // Form local — sincroniza com o data quando carrega
  const [thresholdReais, setThresholdReais] = useState<string>("");
  const [payableRequired, setPayableRequired] = useState(false);
  const [notifyHours, setNotifyHours] = useState<number>(24);

  useEffect(() => {
    if (!data?.config) return;
    setThresholdReais(
      data.config.autoApprovalThresholdCents !== null
        ? String(data.config.autoApprovalThresholdCents / 100)
        : "",
    );
    setPayableRequired(data.config.payableRequiresApproval);
    setNotifyHours(data.config.notifyApproversAfterHours);
  }, [data]);

  function handleSave() {
    const trimmed = thresholdReais.trim();
    const cents = trimmed === ""
      ? null
      : Math.round(parseFloat(trimmed.replace(",", ".")) * 100);
    if (trimmed !== "" && (Number.isNaN(cents!) || cents! < 0)) {
      toast.error("Valor inválido");
      return;
    }
    updateMut.mutate(
      {
        autoApprovalThresholdCents: cents,
        payableRequiresApproval: payableRequired,
        notifyApproversAfterHours: notifyHours,
      },
      {
        onSuccess: () => toast.success("Configuração de governança salva"),
        onError: (err) => toast.error(err.message || "Erro ao salvar"),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 border-amber-500/50 bg-amber-50/40">
        <div className="flex items-start gap-3">
          <ShieldCheck className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium text-amber-900">Governança de pagamentos</p>
            <p className="text-amber-800/80 mt-0.5">
              Pagamentos que disparam aprovação nascem em <strong>PENDENTE APROVAÇÃO</strong>{" "}
              e ficam invisíveis pro fluxo de pagamento até serem aprovados por
              Master, Adm ou usuário com permissão explícita.
            </p>
          </div>
        </div>
      </Card>

      {!isMaster && (
        <Card className="p-3 text-xs text-muted-foreground">
          Apenas o Master pode alterar a configuração. Você está em modo só-leitura.
        </Card>
      )}

      <div className="space-y-2">
        <Label htmlFor="threshold" className="text-xs">
          Valor mínimo para exigir aprovação (R$)
        </Label>
        <Input
          id="threshold"
          type="number"
          step="0.01"
          min={0}
          value={thresholdReais}
          onChange={(e) => setThresholdReais(e.target.value)}
          placeholder="Ex.: 5000 (deixe em branco para desativar)"
          disabled={!isMaster}
        />
        <p className="text-[11px] text-muted-foreground">
          Qualquer pagamento ≥ esse valor cai em fila de aprovação, independente
          do tipo (Receber ou Pagar).
        </p>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div className="space-y-0.5">
          <Label className="text-xs font-medium">
            Exigir aprovação para todo "A pagar"
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Independente do valor, todo PAYABLE entra em aprovação.
          </p>
        </div>
        <Switch
          checked={payableRequired}
          onCheckedChange={setPayableRequired}
          disabled={!isMaster}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notify-hours" className="text-xs">
          Re-notificar aprovadores após (horas)
        </Label>
        <Input
          id="notify-hours"
          type="number"
          min={1}
          max={168}
          value={notifyHours}
          onChange={(e) => setNotifyHours(parseInt(e.target.value || "24", 10))}
          disabled={!isMaster}
        />
        <p className="text-[11px] text-muted-foreground">
          Se o pedido continuar pendente após X horas, os aprovadores recebem
          notificação de lembrete (entre 1h e 1 semana).
        </p>
      </div>

      {isMaster && (
        <Button
          onClick={handleSave}
          disabled={updateMut.isPending}
          className="w-full"
        >
          {updateMut.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
          Salvar governança
        </Button>
      )}
    </div>
  );
}
