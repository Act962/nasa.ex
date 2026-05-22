"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { client as orpcClient } from "@/lib/orpc";
import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 30;

type State =
  | { kind: "loading"; attempt: number }
  | { kind: "paid"; courseId: string; courseTitle: string }
  | { kind: "still-pending" }
  | { kind: "missing-token" }
  | { kind: "not-found" }
  | { kind: "expired" }
  | { kind: "error"; message: string };

interface Props {
  pendingId: string | null;
}

export function AuthenticatedSuccessPolling({ pendingId }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>(
    pendingId ? { kind: "loading", attempt: 0 } : { kind: "missing-token" },
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
            courseId: data.course.id,
            courseTitle: data.course.title,
          });
          setTimeout(() => {
            router.replace(`/nasa-route/curso/${data.course.id}`);
          }, 1200);
          return;
        }

        if (data.status === "EXPIRED") {
          setState({ kind: "expired" });
          return;
        }

        if (attempt >= MAX_ATTEMPTS) {
          setState({ kind: "still-pending" });
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
  }, [pendingId, router]);

  if (state.kind === "missing-token") {
    return (
      <Banner
        icon={<AlertCircle className="size-12 text-rose-400" />}
        title="Token ausente"
        subtitle="Não conseguimos identificar a sua compra."
      />
    );
  }

  if (state.kind === "not-found") {
    return (
      <Banner
        icon={<XCircle className="size-12 text-rose-400" />}
        title="Compra não encontrada"
        subtitle="Aguarde alguns instantes — pode levar alguns segundos pro Stripe sincronizar."
      />
    );
  }

  if (state.kind === "expired") {
    return (
      <Banner
        icon={<AlertCircle className="size-12 text-amber-400" />}
        title="Compra expirou"
        subtitle="Contate o suporte para reabertura."
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
        subtitle="O Stripe está demorando para confirmar. Atualize esta página em alguns instantes — sua matrícula será liberada automaticamente."
      />
    );
  }

  if (state.kind === "paid") {
    return (
      <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/[0.04] p-8 text-center">
        <CheckCircle2 className="mx-auto size-14 text-emerald-400" />
        <h1 className="mt-4 text-2xl font-bold">Compra confirmada! 🎉</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Você comprou <strong>{state.courseTitle}</strong>. Redirecionando pro
          curso…
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
      <Loader2 className="mx-auto size-12 animate-spin text-violet-400" />
      <h1 className="mt-4 text-xl font-bold">Confirmando seu pagamento…</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Estamos esperando o Stripe confirmar. Não feche esta aba.
      </p>
      <div className="mt-4 text-[11px] text-muted-foreground">
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
      <h1 className="mt-4 text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
