"use client";

import { useEffect, useState } from "react";
import { client as orpcClient } from "@/lib/orpc";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
  XCircle,
} from "lucide-react";

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 30;

type PendingState =
  | { kind: "loading"; attempt: number }
  | {
      kind: "paid";
      email: string;
      courseTitle: string;
      creatorOrgName: string;
    }
  | { kind: "still-pending"; email: string }
  | { kind: "missing-token" }
  | { kind: "not-found" }
  | { kind: "expired" }
  | { kind: "error"; message: string };

interface Props {
  pendingId: string | null;
}

export function SuccessPolling({ pendingId }: Props) {
  const [state, setState] = useState<PendingState>(
    pendingId
      ? { kind: "loading", attempt: 0 }
      : { kind: "missing-token" },
  );

  useEffect(() => {
    if (!pendingId) return;
    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;
      attempt++;
      try {
        const data = await orpcClient.nasaRoute.getPendingPurchase({
          pendingId: pendingId!,
        });

        if (cancelled) return;

        if (data.status === "PAID" || data.status === "REDEEMED") {
          setState({
            kind: "paid",
            email: data.email,
            courseTitle: data.course.title,
            creatorOrgName: data.course.creatorOrg.name,
          });
          return;
        }

        if (data.status === "EXPIRED") {
          setState({ kind: "expired" });
          return;
        }

        if (attempt >= MAX_ATTEMPTS) {
          setState({ kind: "still-pending", email: data.email });
          return;
        }

        setState({ kind: "loading", attempt });
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message ?? "";
        if (msg.toLowerCase().includes("não encontrada")) {
          setState({ kind: "not-found" });
          return;
        }
        if (attempt >= MAX_ATTEMPTS) {
          setState({
            kind: "error",
            message: msg || "Erro ao consultar a compra.",
          });
          return;
        }
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pendingId]);

  if (state.kind === "missing-token") {
    return (
      <Banner
        icon={<AlertCircle className="size-12 text-rose-400" />}
        title="Token ausente"
        subtitle="Não conseguimos identificar a sua compra. Verifique o link recebido por e-mail."
      />
    );
  }

  if (state.kind === "not-found") {
    return (
      <Banner
        icon={<XCircle className="size-12 text-rose-400" />}
        title="Compra não encontrada"
        subtitle="Verifique o link ou aguarde alguns instantes — pode demorar até alguns segundos para o Stripe sincronizar."
      />
    );
  }

  if (state.kind === "expired") {
    return (
      <Banner
        icon={<AlertCircle className="size-12 text-amber-400" />}
        title="Compra expirou"
        subtitle="Esta compra estourou o prazo de resgate. Contate o suporte para reabertura."
      />
    );
  }

  if (state.kind === "error") {
    return (
      <Banner
        icon={<XCircle className="size-12 text-rose-400" />}
        title="Erro inesperado"
        subtitle={state.message}
      />
    );
  }

  if (state.kind === "still-pending") {
    return (
      <Banner
        icon={<Loader2 className="size-12 animate-spin text-violet-400" />}
        title="Pagamento ainda processando"
        subtitle={`Estamos aguardando a confirmação do Stripe. Pode levar até 1 minuto. Já enviamos seu acesso para ${state.email} assim que confirmar.`}
      />
    );
  }

  if (state.kind === "paid") {
    return (
      <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/[0.04] p-8 text-center">
        <div className="inline-flex">
          <CheckCircle2 className="size-14 text-emerald-400" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-white">
          Compra confirmada! 🎉
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Você comprou{" "}
          <strong className="text-white">{state.courseTitle}</strong> de{" "}
          <strong className="text-white">{state.creatorOrgName}</strong>.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <Mail className="size-4 text-violet-400" />
            Próximo passo: verifique seu e-mail
          </p>
          <p className="mt-2 text-sm text-white/70">
            Enviamos um link para <strong>{state.email}</strong> com instruções
            para criar sua senha e acessar o curso.
          </p>
          <p className="mt-2 text-[11px] text-white/40">
            Não recebeu? Cheque o spam. O link é válido por 7 dias.
          </p>
        </div>

        <p className="mt-6 text-[11px] text-white/40">
          Pode fechar esta aba — todas as próximas etapas acontecem pelo
          e-mail.
        </p>
      </div>
    );
  }

  // Loading
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
      <Loader2 className="mx-auto size-12 animate-spin text-violet-400" />
      <h1 className="mt-4 text-xl font-bold text-white">
        Confirmando seu pagamento…
      </h1>
      <p className="mt-2 text-sm text-white/60">
        Estamos esperando o Stripe confirmar a transação. Não feche esta aba.
      </p>
      <div className="mt-4 inline-flex items-center gap-2 text-[11px] text-white/40">
        Tentativa {state.attempt} de {MAX_ATTEMPTS}
      </div>
    </div>
  );
}

function Banner({
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
      <p className="mt-2 text-sm text-white/60">{subtitle}</p>
    </div>
  );
}
