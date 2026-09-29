"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, CreditCard, Loader2, QrCode, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TEMPLATE_CATEGORY_LABELS, formatBrlCents } from "../../lib/meta-pricing";
import { useBroadcastFeeQuote, useCheckoutBroadcastFee, useConfirmBroadcastFee } from "../../hooks/use-broadcast-fee";
import { RequestTeamHelp } from "./request-team-help";

type FeeQuoteData = NonNullable<ReturnType<typeof useBroadcastFeeQuote>["data"]>;

/** A taxa está ligada e nenhum pagamento confirmado cobre os pendentes. */
export function isFeeBlocking(data: FeeQuoteData | undefined): boolean {
  if (!data?.quote.isFeeEnabled) return false;
  return !data.payments.some((payment) => payment.status === "PAID" && payment.recipients >= data.quote.recipients);
}

/** Custo estimado, plano de lotes e checkout da taxa ÓRBITA (spec 0040, RF-6/RF-7). */
export function BroadcastCostSummary({ broadcastId }: { broadcastId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data, isLoading, error } = useBroadcastFeeQuote(broadcastId);
  const checkout = useCheckoutBroadcastFee();
  const confirm = useConfirmBroadcastFee();
  const [payerDocument, setPayerDocument] = useState("");
  const [isAskingDocument, setIsAskingDocument] = useState(false);

  const pendingPayment = data?.payments.find((payment) => payment.status === "PENDING");
  const returnedPaymentId = searchParams.get("fee");
  const paymentToConfirm = returnedPaymentId ?? pendingPayment?.id ?? null;

  useEffect(() => {
    if (!paymentToConfirm) return;
    const confirmOnce = () =>
      confirm.mutate(
        { paymentId: paymentToConfirm },
        {
          onSuccess: (result) => {
            if (result.isReleased) {
              toast.success("Pagamento confirmado. Campanha liberada!");
              if (returnedPaymentId) router.replace(pathname);
            }
          },
        },
      );
    confirmOnce();
    const interval = setInterval(confirmOnce, 8_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentToConfirm]);

  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (error || !data) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Não foi possível estimar o custo agora. {error?.message}
      </div>
    );
  }

  const { quote } = data;
  const isBlocking = isFeeBlocking(data);
  const isPaid = quote.isFeeEnabled && !isBlocking;

  function startCheckout(paymentMethod: "CARD" | "PIX") {
    checkout.mutate(
      {
        broadcastId,
        paymentMethod,
        payerDocument: paymentMethod === "PIX" ? payerDocument || undefined : undefined,
        dispatchMode: "NOW",
        returnPath: pathname,
      },
      {
        onSuccess: (result) => {
          window.open(result.checkoutUrl, "_blank", "noopener");
          toast.info("Pagamento aberto em outra aba. A campanha dispara sozinha quando o pagamento for confirmado.");
        },
        onError: (checkoutError) => {
          const isDocumentMissing = checkoutError.message.includes("CPF ou CNPJ");
          if (isDocumentMissing) setIsAskingDocument(true);
          toast.error(checkoutError.message);
        },
      },
    );
  }

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Custo desta campanha</p>
        <span className="text-xs text-muted-foreground">
          {quote.recipients.toLocaleString("pt-BR")} contatos · {TEMPLATE_CATEGORY_LABELS[quote.category]}
        </span>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-xs text-muted-foreground">Meta (no seu cartão)</dt>
          <dd className="text-lg font-semibold">{formatBrlCents(quote.metaCost.totalBrlCents)}</dd>
          {quote.openWindowRecipients > 0 && quote.category === "UTILITY" && (
            <p className="text-[11px] text-muted-foreground">{quote.openWindowRecipients} com janela aberta não pagam.</p>
          )}
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-xs text-muted-foreground">Taxa ÓRBITA ({quote.fee.feePercent}%)</dt>
          <dd className="text-lg font-semibold">{formatBrlCents(quote.fee.serviceFeeBrlCents)}</dd>
          {quote.fee.isMinimumApplied && <p className="text-[11px] text-muted-foreground">Taxa mínima por campanha.</p>}
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-xs text-muted-foreground">Total estimado</dt>
          <dd className="text-lg font-semibold">{formatBrlCents(quote.fee.totalBrlCents)}</dd>
        </div>
      </dl>

      {quote.category === "MARKETING" && quote.utilityAlternativeBrlCents < quote.metaCost.totalBrlCents && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
          Com um modelo de <strong>Utilidade</strong>, a Meta cobraria cerca de{" "}
          <strong>{formatBrlCents(quote.utilityAlternativeBrlCents)}</strong>.
        </p>
      )}

      <div
        className={cn(
          "space-y-2 rounded-lg border p-3 text-sm",
          quote.batches.days > 1 && "border-amber-500/50 bg-amber-500/5",
        )}
      >
        <p className="flex items-center gap-2 font-medium">
          <CalendarDays className="size-4" />
          {quote.batches.days > 1
            ? `Sai em ${quote.batches.days} dias — seu número está no limite de ${quote.limit.label}`
            : `Sai no mesmo dia (limite do número: ${quote.limit.label})`}
        </p>
        {quote.batches.days > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {quote.batches.perDay.slice(0, 14).map((dayCount, index) => (
              <span key={index} className="rounded-md bg-background px-2 py-0.5 text-xs">
                Dia {index + 1}: {dayCount.toLocaleString("pt-BR")}
              </span>
            ))}
            {quote.batches.perDay.length > 14 && <span className="text-xs text-muted-foreground">…</span>}
          </div>
        )}
        {quote.howToReachNextLimit && quote.nextLimit && (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <TrendingUp className="mt-0.5 size-3.5 shrink-0" />
            Para subir para {quote.nextLimit.label}: {quote.howToReachNextLimit}
          </p>
        )}
      </div>

      {isPaid && (
        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4" /> Taxa paga. Pode disparar.
        </p>
      )}

      {isBlocking && (
        <div className="space-y-3 border-t pt-3">
          {pendingPayment ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
              Aguardando a confirmação do pagamento…
              {pendingPayment.checkoutUrl && (
                <Button variant="link" size="sm" asChild className="h-auto p-0">
                  <a href={pendingPayment.checkoutUrl} target="_blank" rel="noreferrer">
                    Abrir pagamento
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pague a taxa de serviço para liberar o disparo. A campanha começa assim que o pagamento é confirmado.
            </p>
          )}
          {isAskingDocument && (
            <Input
              value={payerDocument}
              onChange={(event) => setPayerDocument(event.target.value)}
              placeholder="CPF ou CNPJ de quem paga"
              className="max-w-xs"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => startCheckout("CARD")} disabled={checkout.isPending}>
              <CreditCard className="size-4" /> Pagar {formatBrlCents(quote.fee.serviceFeeBrlCents)} no cartão
            </Button>
            <Button variant="outline" onClick={() => startCheckout("PIX")} disabled={checkout.isPending}>
              <QrCode className="size-4" /> PIX ou boleto
            </Button>
            <RequestTeamHelp step="Pagamento da taxa da campanha" errorMessage={checkout.error?.message} />
          </div>
        </div>
      )}
    </div>
  );
}
