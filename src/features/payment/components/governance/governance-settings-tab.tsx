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
import { ShieldCheck } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
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
  const [sessionTimeoutMin, setSessionTimeoutMin] = useState<number>(30);
  const [otpEveryN, setOtpEveryN] = useState<number>(10);

  useEffect(() => {
    if (!data?.config) return;
    setThresholdReais(
      data.config.autoApprovalThresholdCents !== null
        ? String(data.config.autoApprovalThresholdCents / 100)
        : "",
    );
    setPayableRequired(data.config.payableRequiresApproval);
    setNotifyHours(data.config.notifyApproversAfterHours);
    setSessionTimeoutMin(data.config.sessionTimeoutMinutes);
    setOtpEveryN(data.config.otpEveryNSessions);
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
        sessionTimeoutMinutes: sessionTimeoutMin,
        otpEveryNSessions: otpEveryN,
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
        <OrbitaSpinner className="size-4 " /> Carregando…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 border-warning/50 bg-warning/40">
        <div className="flex items-start gap-3">
          <ShieldCheck className="size-5 text-warning shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium text-warning">Governança de pagamentos</p>
            <p className="text-warning/80 mt-0.5">
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
            Exigir aprovação para toda "Despesa"
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

      <div className="rounded-md border border-info/30 bg-info/5 p-3 space-y-3">
        <p className="text-xs font-medium text-info">
          Segurança de Acesso (ÓRBITA Payment Gate)
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="session-timeout" className="text-xs">
              Auto-lock por inatividade (min)
            </Label>
            <Input
              id="session-timeout"
              type="number"
              min={1}
              max={720}
              value={sessionTimeoutMin}
              onChange={(event) =>
                setSessionTimeoutMin(parseInt(event.target.value || "30", 10))
              }
              disabled={!isMaster}
            />
            <p className="text-[10px] text-muted-foreground">
              Após X min sem atividade, fecha o módulo e pede senha de novo.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="otp-every" className="text-xs">
              OTP WhatsApp a cada N sessões
            </Label>
            <Input
              id="otp-every"
              type="number"
              min={0}
              max={100}
              value={otpEveryN}
              onChange={(event) =>
                setOtpEveryN(parseInt(event.target.value || "10", 10))
              }
              disabled={!isMaster}
            />
            <p className="text-[10px] text-muted-foreground">
              0 desliga. 10 = a cada 10 logins pede código WhatsApp extra.
            </p>
          </div>
        </div>
      </div>

      {isMaster && (
        <Button
          onClick={handleSave}
          disabled={updateMut.isPending}
          className="w-full"
        >
          {updateMut.isPending && <OrbitaSpinner className="size-4 mr-2" />}
          Salvar governança
        </Button>
      )}
    </div>
  );
}
