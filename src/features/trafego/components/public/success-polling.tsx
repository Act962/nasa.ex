"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { useTrafegoPendingPurchase } from "@/features/trafego/hooks/use-trafego-purchase";
import { PriceBreakdown } from "./price-breakdown";

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 30;

export function TrafegoSuccessPolling({ pendingId }: { pendingId: string | null }) {
  const [attempts, setAttempts] = useState(0);
  const gaveUp = attempts >= MAX_ATTEMPTS;

  const { data, isError } = useTrafegoPendingPurchase(
    { pendingId: pendingId ?? undefined },
    {
      enabled: Boolean(pendingId) && !gaveUp,
      refetchInterval: gaveUp ? false : POLL_INTERVAL_MS,
    },
  );

  const isConfirmed = data?.status === "PAID" || data?.status === "REDEEMED";

  useEffect(() => {
    if (!pendingId || isConfirmed || gaveUp) return;
    const timer = setInterval(() => setAttempts((count) => count + 1), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pendingId, isConfirmed, gaveUp]);

  if (!pendingId) {
    return (
      <Panel
        icon={<AlertCircle className="size-12 text-rose-400" />}
        title="Link incompleto"
        subtitle="Não conseguimos identificar sua compra. Se o pagamento foi feito, verifique seu e-mail — enviamos o acesso por lá."
      />
    );
  }

  if (isError) {
    return (
      <Panel
        icon={<AlertCircle className="size-12 text-rose-400" />}
        title="Compra não encontrada"
        subtitle="Se o pagamento foi concluído, o acesso chega por e-mail em instantes."
      />
    );
  }

  if (isConfirmed && data) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-400" />
        <h1 className="mt-4 text-2xl font-bold text-white">Pagamento confirmado</h1>
        <p className="mt-2 text-sm text-white/60">
          {data.planName ? `${data.planName} — ` : ""}falta só criar sua conta para
          enviar os criativos.
        </p>

        <PriceBreakdown
          className="mt-6 text-left"
          adBudgetBrlCents={data.adBudgetBrlCents}
          serviceFeeBrlCents={data.serviceFeeBrlCents}
          totalBrlCents={data.amountBrlCents}
        />

        {data.signupToken ? (
          <Link
            href={`/trafego/ativar/${data.signupToken}`}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Criar minha conta
          </Link>
        ) : (
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-white/60">
            <Mail className="size-4" />
            Enviamos o link de acesso para {data.email}
          </p>
        )}
      </div>
    );
  }

  if (gaveUp) {
    return (
      <Panel
        icon={<Mail className="size-12 text-amber-400" />}
        title="Ainda estamos confirmando"
        subtitle="O pagamento pode levar alguns minutos para ser processado. Assim que confirmar, enviamos o link de acesso por e-mail — não é preciso manter esta página aberta."
      />
    );
  }

  return (
    <Panel
      icon={<Loader2 className="size-12 animate-spin text-violet-400" />}
      title="Confirmando seu pagamento"
      subtitle="Isso costuma levar poucos segundos. Não feche esta página."
    />
  );
}

function Panel({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
      <div className="inline-flex">{icon}</div>
      <h1 className="mt-4 text-2xl font-bold text-white">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-white/60">{subtitle}</p>
    </div>
  );
}
