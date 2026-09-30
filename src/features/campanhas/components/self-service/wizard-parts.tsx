"use client";

// Peças do assistente "Conectar número oficial" (spec 0040): etapas, compra
// de número Salvy e código SMS ao vivo.

import { useState } from "react";
import { Check, Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBuySalvyNumber, useSalvyLatestCode, useSalvyNumberOffer } from "../../hooks/use-official-number";
import { CopyField } from "@/features/meta-guide/components/copy-field";

export const STEPS = [
  { id: "number", label: "Número" },
  { id: "meta", label: "Meta" },
  { id: "card", label: "Cartão" },
  { id: "done", label: "Pronto" },
] as const;

export const OWN_NUMBER_CHECKLIST = [
  "Não está em uso em outro WhatsApp (nem no app comum, nem no Business)",
  "Recebe SMS ou ligação para o código de verificação",
  "É um número da empresa, que vai continuar ativo",
];

export type NumberSource = "own" | "salvy";

export function Stepper({ currentIndex }: { currentIndex: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-all duration-300",
                isDone && "border-emerald-500 bg-emerald-500 text-white",
                isCurrent && "scale-110 border-emerald-500 text-emerald-600",
              )}
            >
              {isDone ? <Check className="size-4 animate-in zoom-in" /> : index + 1}
            </span>
            <span className={cn("hidden text-xs sm:inline", !isCurrent && "text-muted-foreground")}>{step.label}</span>
            {index < STEPS.length - 1 && (
              <span className={cn("h-px flex-1 transition-colors duration-500", isDone ? "bg-emerald-500" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function SalvyPurchase({ trackingId, onBought }: { trackingId: string; onBought: (numberId: string, phoneNumber: string) => void }) {
  const { data: offer, isLoading } = useSalvyNumberOffer();
  const buyNumber = useBuySalvyNumber();
  const [areaCode, setAreaCode] = useState<number | null>(null);

  if (isLoading) return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
  if (!offer?.isAvailable) {
    return (
      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        A compra de números ainda não está liberada na sua conta. Peça ajuda à equipe que a gente providencia.
      </p>
    );
  }

  function buy() {
    if (!areaCode) return;
    buyNumber.mutate(
      { areaCode, trackingId },
      {
        onSuccess: (number) => {
          toast.success(`Número ${number.phoneNumber} comprado!`);
          onBought(number.id, number.phoneNumber);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Número móvel virtual, pronto para o WhatsApp oficial. Custa <strong>{offer.monthlyStars} Stars por mês</strong>, cobrados do saldo da empresa.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={areaCode ?? ""}
          onChange={(event) => setAreaCode(Number(event.target.value) || null)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">Escolha o DDD</option>
          {offer.areaCodes.map((code) => (
            <option key={code} value={code}>
              DDD {code}
            </option>
          ))}
        </select>
        <Button onClick={buy} disabled={!areaCode || buyNumber.isPending}>
          {buyNumber.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />} Comprar número
        </Button>
      </div>
    </div>
  );
}

export function LiveSmsCode({ numberId }: { numberId: string }) {
  const { data: latestCode } = useSalvyLatestCode(numberId);
  if (!latestCode) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Esperando o SMS da Meta chegar no seu número…
      </p>
    );
  }
  return <CopyField label="Código que chegou por SMS — cole no pop-up da Meta" value={latestCode.code} isHighlighted />;
}
