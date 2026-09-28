"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BellRing,
  Check,
  FileCheck2,
  Loader2,
  Mail,
  Rocket,
  SearchCheck,
} from "lucide-react";
import { useTrafegoPendingPurchase } from "@/features/trafego/hooks/use-trafego-purchase";
import { useTrafegoPublicConfig } from "@/features/trafego/hooks/use-trafego-plans";

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 30;

/** O que acontece a seguir, na ordem em que acontece — evita o "e agora?". */
const NEXT_STEPS = [
  {
    icon: FileCheck2,
    text: "Recebemos seus dados e o comprovante de pagamento.",
  },
  { icon: SearchCheck, text: "Nossa equipe vai analisar suas informações." },
  { icon: BellRing, text: "Você receberá atualizações por WhatsApp e e-mail." },
  { icon: Rocket, text: "Em breve sua campanha estará no ar!" },
];

export function TrafegoSuccessPolling({
  pendingId,
}: {
  pendingId: string | null;
}) {
  const [attempts, setAttempts] = useState(0);
  const { data: config } = useTrafegoPublicConfig();
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
    const timer = setInterval(
      () => setAttempts((count) => count + 1),
      POLL_INTERVAL_MS,
    );
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
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-7 text-center sm:p-9">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/trafego-logo.png"
          alt="trafeGO"
          width={289}
          height={96}
          className="mx-auto h-6 w-auto"
        />

        <span className="mx-auto mt-7 flex size-14 items-center justify-center rounded-2xl bg-violet-500/15">
          <Check className="size-7 text-violet-300" />
        </span>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-300/80">
          Contratação realizada
        </p>
        <h1 className="mt-1.5 text-2xl font-bold text-white">
          Sua campanha está confirmada!
        </h1>
        <p className="mt-1.5 text-sm text-white/45">
          Agora é com a nossa equipe.
        </p>

        <ul className="mt-7 space-y-3 text-left">
          {NEXT_STEPS.map((step) => (
            <li key={step.text} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                <step.icon className="size-3.5 text-white/60" />
              </span>
              <span className="text-xs leading-relaxed text-white/60">
                {step.text}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
          {data.orderId || data.signupToken ? (
            <Link
              href={
                data.orderId
                  ? `/trafego/painel/${data.orderId}`
                  : `/trafego/ativar/${data.signupToken}`
              }
              className="flex-1 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              Acessar meu painel
            </Link>
          ) : (
            <p className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-xs text-white/55">
              <Mail className="size-4 shrink-0" />
              Link de acesso enviado para {data.email}
            </p>
          )}

          {config?.supportWhatsapp && (
            <a
              href={`https://wa.me/${config.supportWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Olá! Acabei de contratar uma campanha no trafeGO.")}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
            >
              Falar com o time
            </a>
          )}
        </div>
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
