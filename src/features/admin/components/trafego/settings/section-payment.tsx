"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useReconcileTrafegoPix } from "@/features/trafego/hooks/use-trafego-ops";
import type {
  TrafegoSettingsFormState,
  TrafegoSettingsPatch,
} from "@/features/admin/lib/trafego-settings-form";
import {
  SettingsCard,
  SettingsField,
  SettingsGrid,
  SettingsNotice,
} from "./settings-primitives";

export function PaymentSection({
  form,
  patch,
}: {
  form: TrafegoSettingsFormState;
  patch: TrafegoSettingsPatch;
}) {
  return (
    <div className="space-y-5">
      <SettingsCard
        title="PIX manual (sem Asaas)"
        description="A chave aparece para o cliente quando o gateway Asaas está desligado. Sem chave e sem gateway, o PIX some do wizard e só o cartão é oferecido."
      >
        <SettingsGrid>
          <SettingsField
            label="Chave PIX"
            wide
            hint="CNPJ, e-mail, telefone ou chave aleatória."
          >
            <Input
              value={form.pixKey}
              onChange={(event) => patch({ pixKey: event.target.value })}
              placeholder="00.000.000/0001-00"
            />
          </SettingsField>

          <SettingsField label="Titular da conta">
            <Input
              value={form.pixHolderName}
              onChange={(event) => patch({ pixHolderName: event.target.value })}
              placeholder="Órbita Hub LTDA"
            />
          </SettingsField>

          <SettingsField label="Banco">
            <Input
              value={form.pixBankName}
              onChange={(event) => patch({ pixBankName: event.target.value })}
              placeholder="Inter"
            />
          </SettingsField>

          <SettingsField
            label="Validade da cobrança (minutos)"
            hint="Contagem do nosso lado: depois disso a cobrança vira “vencida” na fila. O cliente ainda consegue pagar e o pagamento continua sendo confirmado."
          >
            <Input
              type="number"
              min={1}
              max={43200}
              value={form.pixExpiryMinutes}
              onChange={(event) =>
                patch({ pixExpiryMinutes: event.target.value })
              }
            />
          </SettingsField>

          {!form.pixKey.trim() && (
            <SettingsNotice tone="info">
              Sem chave cadastrada. Se o Asaas também estiver desligado, o
              cliente só verá cartão no checkout.
            </SettingsNotice>
          )}
        </SettingsGrid>
      </SettingsCard>

      <SettingsCard
        title="Cobrança PIX pelo Asaas"
        description="Reconciliação manual: pergunta ao Asaas o estado das cobranças abertas e confirma o que já foi pago. Use quando um cliente disser que pagou e o pedido não liberou."
      >
        <ReconcilePixButton />
      </SettingsCard>
    </div>
  );
}

/**
 * Saída manual quando o Inngest está fora. As outras duas camadas de
 * recuperação (acompanhamento por pedido e sweep horário) rodam na fila; esta
 * roda no request e não depende dela.
 */
function ReconcilePixButton() {
  const reconcile = useReconcileTrafegoPix();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={reconcile.isPending}
        onClick={() =>
          reconcile.mutate(
            { minAgeMinutes: 0, maxAgeDays: 7 },
            {
              onSuccess: (result) => toast.success(result.message),
              onError: (error) =>
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Não foi possível falar com o Asaas.",
                ),
            },
          )
        }
      >
        {reconcile.isPending ? (
          <Loader2 className="mr-1.5 size-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-1.5 size-4" />
        )}
        Reconciliar PIX agora
      </Button>
      <p className="text-xs text-muted-foreground">
        Não duplica nada: quem já estava confirmado é ignorado.
      </p>
    </div>
  );
}
