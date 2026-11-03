"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { emitTourResult } from "@/features/tour/store";
import { describePaymentError } from "../../lib/describe-error";
import { useSetBankChargeMethod } from "../../hooks/use-payment-bank-connections";

// "Como cobrar" da conexão (spec 0133, RF-1, RF-2): só PIX ou boleto com PIX, e multa, juros e
// desconto do boleto. O boleto só liga com as permissões conferidas.

type ChargeMethod = "PIX" | "BOLETO_PIX";

export interface BankChargeMethodView {
  id: string;
  chargeMethod: ChargeMethod;
  missingForBoleto: string[] | null;
  isBoletoSupported: boolean;
  boletoWebhookRegisteredAt: Date | null;
  boletoFinePercent: number | null;
  boletoInterestMonthlyPercent: number | null;
  boletoDiscountPercent: number | null;
  boletoDiscountDays: number | null;
}

const METHOD_OPTIONS: Array<{ value: ChargeMethod; title: string; description: string }> = [
  { value: "PIX", title: "Só PIX", description: "O cliente recebe o PIX copia e cola. Precisa só do CPF/CNPJ." },
  {
    value: "BOLETO_PIX",
    title: "Boleto com PIX",
    description: "Boleto com QR Code PIX: o cliente paga como preferir. Precisa de CPF/CNPJ e endereço; sem eles, sai só o PIX.",
  },
];

function toPercentText(value: number | null): string {
  return value === null ? "" : String(value).replace(".", ",");
}

function parsePercent(text: string): number | null {
  const value = Number(text.replace(",", "."));
  return text.trim() && Number.isFinite(value) && value > 0 ? value : null;
}

export function BankChargeMethod({ connection }: { connection: BankChargeMethodView }) {
  const [chargeMethod, setChargeMethod] = useState<ChargeMethod>(connection.chargeMethod);
  const [fine, setFine] = useState(toPercentText(connection.boletoFinePercent));
  const [interest, setInterest] = useState(toPercentText(connection.boletoInterestMonthlyPercent));
  const [discount, setDiscount] = useState(toPercentText(connection.boletoDiscountPercent));
  const [discountDays, setDiscountDays] = useState(connection.boletoDiscountDays?.toString() ?? "");
  const setMethod = useSetBankChargeMethod();

  if (!connection.isBoletoSupported) return null;
  const isBoletoBlocked = connection.missingForBoleto === null || connection.missingForBoleto.length > 0;

  async function handleSave() {
    try {
      const { connection: saved } = await setMethod.mutateAsync({
        connectionId: connection.id,
        chargeMethod,
        finePercent: parsePercent(fine),
        interestMonthlyPercent: parsePercent(interest),
        discountPercent: parsePercent(discount),
        discountDays: discountDays.trim() ? Number(discountDays) : null,
      });
      emitTourResult({ kind: GUIDE_RESULT_KINDS.bankChargeMethodSaved });
      toast.success(
        saved.chargeMethod === "BOLETO_PIX"
          ? saved.boletoWebhookRegisteredAt
            ? "As próximas cobranças saem com boleto e PIX."
            : "Boleto ligado. Falta ativar o aviso de pagamento do boleto (só em produção)."
          : "As cobranças voltam a sair só com PIX. Boletos já emitidos continuam valendo.",
      );
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível salvar."));
    }
  }

  return (
    <div className="space-y-3 rounded-xl border px-4 py-3" data-guide={GUIDE_ANCHORS.paymentBankChargeMethod.id}>
      <p className="text-sm font-semibold">Como cobrar</p>
      <div className="grid gap-2">
        {METHOD_OPTIONS.map((option) => {
          const isDisabled = option.value === "BOLETO_PIX" && isBoletoBlocked;
          const isSelected = chargeMethod === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={isDisabled}
              onClick={() => setChargeMethod(option.value)}
              className={`rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                isSelected ? "border-info bg-info/5" : "border-border/60 hover:border-info/50"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className={`size-3.5 rounded-full border-2 ${isSelected ? "border-info bg-info" : "border-muted-foreground/40"}`} />
                {option.title}
              </span>
              <span className="mt-1 block pl-5.5 text-xs text-muted-foreground">
                {isDisabled ? "Libere as permissões de boleto na integração do banco e confira de novo." : option.description}
              </span>
            </button>
          );
        })}
      </div>

      {chargeMethod === "BOLETO_PIX" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Multa após o vencimento (%)</Label>
            <Input inputMode="decimal" placeholder="Ex.: 2" value={fine} onChange={(event) => setFine(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Juros ao mês (%)</Label>
            <Input inputMode="decimal" placeholder="Ex.: 1" value={interest} onChange={(event) => setInterest(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Desconto por antecipação (%)</Label>
            <Input inputMode="decimal" placeholder="Opcional" value={discount} onChange={(event) => setDiscount(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até quantos dias antes</Label>
            <Input
              inputMode="numeric"
              placeholder="Ex.: 5"
              disabled={!parsePercent(discount)}
              value={discountDays}
              onChange={(event) => setDiscountDays(event.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>
      )}

      <Button size="sm" className="w-full gap-1.5 bg-info text-white hover:bg-info/90" disabled={setMethod.isPending} onClick={() => void handleSave()}>
        {setMethod.isPending && <Loader2 className="size-3.5 animate-spin" />}
        Salvar forma de cobrar
      </Button>
    </div>
  );
}
